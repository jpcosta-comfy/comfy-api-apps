import { createHmac, timingSafeEqual } from "node:crypto";
import { assertPublicImageUrl } from "@/lib/fetch-image";
import { apiKey } from "@/lib/env";
import { AppError } from "@/lib/http";

const TTL_SECONDS = 20 * 60;

export type SceneChoice = {
  imageUrl: string;
  thumbUrl: string;
  source: string;
};

function signingKey(): string {
  const explicit = process.env.OUTPUT_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  return apiKey() ?? "";
}

function mac(payload: string): string {
  return createHmac("sha256", signingKey()).update(`paparazzi-scene\n${payload}`).digest("base64url");
}

function invalid(): never {
  throw new AppError(400, "invalid_input", "That scene choice is not valid. Search again.");
}

export function signSceneChoice(choice: SceneChoice): string {
  const imageUrl = assertPublicImageUrl(choice.imageUrl).toString();
  const thumbUrl = assertPublicImageUrl(choice.thumbUrl || choice.imageUrl).toString();
  const body = Buffer.from(
    JSON.stringify({
      imageUrl,
      thumbUrl,
      source: choice.source.slice(0, 80),
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    }),
    "utf8",
  ).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function readSceneChoice(token: string): SceneChoice {
  if (!token || token.length > 8000) invalid();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) invalid();
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const expected = mac(body);
  const givenBuf = Buffer.from(given);
  const expectedBuf = Buffer.from(expected);
  if (givenBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    invalid();
  }
  if (!timingSafeEqual(givenBuf, expectedBuf)) invalid();
  let parsed: { imageUrl?: unknown; thumbUrl?: unknown; source?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    invalid();
  }
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) invalid();
  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new AppError(400, "scene_expired", "That scene choice expired. Search again.");
  }
  if (typeof parsed.imageUrl !== "string" || typeof parsed.thumbUrl !== "string") invalid();
  return {
    imageUrl: assertPublicImageUrl(parsed.imageUrl).toString(),
    thumbUrl: assertPublicImageUrl(parsed.thumbUrl).toString(),
    source: typeof parsed.source === "string" ? parsed.source : "",
  };
}
