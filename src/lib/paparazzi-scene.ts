import { downloadPublicImage } from "@/lib/fetch-image";
import { AppError } from "@/lib/http";
import { prepareImageBuffer } from "@/lib/images";
import { searchCelebrityPhotos } from "@/lib/paparazzi-search";
import { readSceneChoice } from "@/lib/scene-token";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function prepared(url: string, maxSide: number): Promise<Buffer> {
  const raw = await downloadPublicImage(url);
  return prepareImageBuffer(raw, maxSide);
}

/**
 * Scene file was omitted. Use the signed search choice, or search and take the best photo that downloads.
 * The celebrity name is not written into the workflow.
 */
export async function resolvePaparazziScene(form: FormData, maxSide: number): Promise<Buffer> {
  const token = text(form, "sceneToken");
  if (token) {
    const choice = readSceneChoice(token);
    try {
      return await prepared(choice.imageUrl, maxSide);
    } catch (error) {
      if (error instanceof AppError && error.code === "scene_expired") throw error;
      throw new AppError(502, "scene_download_failed", "Could not download that photo. Pick another scene or upload one.");
    }
  }

  if (!text(form, "celebrity")) {
    throw new AppError(400, "invalid_input", "Enter a celebrity name or upload a scene photo.");
  }

  const { hits } = await searchCelebrityPhotos(text(form, "celebrity"));
  for (const hit of hits.slice(0, 4)) {
    try {
      return await prepared(hit.imageUrl, maxSide);
    } catch {
      continue;
    }
  }
  throw new AppError(502, "scene_download_failed", "Could not download a paparazzi photo. Pick another scene or upload one.");
}
