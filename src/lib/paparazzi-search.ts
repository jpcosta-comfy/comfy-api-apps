import { assertPublicImageUrl } from "@/lib/fetch-image";
import { AppError } from "@/lib/http";

export type SearchProviderId = "serpapi" | "google-cse" | "bing" | "duckduckgo";

export type SearchHit = {
  title: string;
  imageUrl: string;
  thumbUrl: string;
  pageUrl: string;
  width: number;
  height: number;
  source: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PROVIDER_LABEL: Record<SearchProviderId, string> = {
  serpapi: "SerpAPI",
  "google-cse": "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
};

export function providerLabel(id: SearchProviderId): string {
  return PROVIDER_LABEL[id];
}

export function noResultsMessage(name: string): string {
  return `No paparazzi photos found for “${name}”. Try another spelling, or upload a scene photo.`;
}

export function normalizeCelebrityName(raw: string): string {
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new AppError(400, "invalid_input", "Enter a celebrity name.");
  if (name.length > 80) throw new AppError(400, "invalid_input", "Celebrity name must be 80 characters or less.");
  if (!/^[\p{L}\p{M}\p{N} .'\-]+$/u.test(name)) {
    throw new AppError(400, "invalid_input", "Enter a celebrity name, not a URL or sentence.");
  }
  return name;
}

export function celebrityQuery(name: string): string {
  return `${normalizeCelebrityName(name)} paparazzi candid photo`;
}

/** SerpAPI if set, then Google CSE, then Bing, otherwise DuckDuckGo (no key). */
export function activeSearchProvider(): SearchProviderId {
  if (process.env.SERPAPI_API_KEY?.trim()) return "serpapi";
  const googleKey = process.env.GOOGLE_CSE_API_KEY?.trim() ?? "";
  const googleCx = process.env.GOOGLE_CSE_CX?.trim() ?? "";
  if (googleKey || googleCx) {
    if (!googleKey || !googleCx) {
      throw new AppError(500, "search_unconfigured", "Set both GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX to use Google image search.");
    }
    return "google-cse";
  }
  if (process.env.BING_IMAGE_SEARCH_KEY?.trim()) return "bing";
  return "duckduckgo";
}

function fold(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function mentionsName(hit: SearchHit, name: string): boolean {
  const hay = fold(`${hit.title} ${hit.pageUrl} ${hit.source}`);
  const tokens = fold(name)
    .split(/[\s-]+/)
    .filter((token) => token.length >= 3);
  if (tokens.length === 0) return hay.includes(fold(name));
  return tokens.every((token) => hay.includes(token));
}

function scoreHit(hit: SearchHit, name: string): number {
  const title = fold(hit.title);
  let score = 0;
  if (/\b(paparazzi|candid|spotted)\b/.test(title)) score += 6;
  if (/\b(premiere|airport|street)\b/.test(title) || title.includes("red carpet")) score += 2;
  if (/\b(poster|logo|cartoon|drawing|illustration|wallpaper|fanart|avatar|meme)\b/.test(title) || title.includes("fan art")) {
    score -= 6;
  }
  if (hit.width >= 900 && hit.height >= 700) score += 2;
  if (hit.width > 0 && (hit.width < 480 || hit.height < 480)) score -= 3;
  if (hit.width > 0 && hit.height > 0) {
    const aspect = hit.width / hit.height;
    if (aspect > 2.4 || aspect < 0.35) score -= 2;
  }
  if (title.includes(fold(name))) score += 1;
  return score;
}

function usableUrl(raw: string): string | null {
  if (!raw || /\.(svg|gif)(\?|$)/i.test(raw)) return null;
  try {
    return assertPublicImageUrl(raw).toString();
  } catch {
    return null;
  }
}

/** Keep name matches, drop posters behind candid shots, cap at 8. */
export function selectCelebrityHits(name: string, hits: SearchHit[]): SearchHit[] {
  const celebrity = normalizeCelebrityName(name);
  const seen = new Set<string>();
  const filtered: SearchHit[] = [];
  for (const hit of hits) {
    const imageUrl = usableUrl(hit.imageUrl);
    if (!imageUrl || seen.has(imageUrl)) continue;
    const thumbUrl = usableUrl(hit.thumbUrl) ?? imageUrl;
    const next = { ...hit, imageUrl, thumbUrl, title: hit.title.trim() || celebrity };
    if (!mentionsName(next, celebrity)) continue;
    seen.add(imageUrl);
    filtered.push(next);
  }
  return filtered
    .map((hit, index) => ({ hit, index, score: scoreHit(hit, celebrity) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .map((item) => item.hit);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function hostOf(pageUrl: string, fallback: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return fallback.replace(/^www\./, "");
  }
}

export function parseDuckDuckGo(payload: unknown): SearchHit[] {
  const results = asRecord(payload)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const imageUrl = text(record.image);
    const pageUrl = text(record.url);
    if (!imageUrl) return [];
    return [
      {
        title: text(record.title),
        imageUrl,
        thumbUrl: text(record.thumbnail) || imageUrl,
        pageUrl,
        width: num(record.width),
        height: num(record.height),
        source: hostOf(pageUrl, ""),
      },
    ];
  });
}

export function parseSerpApi(payload: unknown): SearchHit[] {
  const results = asRecord(payload)?.images_results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const imageUrl = text(record.original);
    const pageUrl = text(record.link);
    if (!imageUrl) return [];
    return [
      {
        title: text(record.title),
        imageUrl,
        thumbUrl: text(record.thumbnail) || imageUrl,
        pageUrl,
        width: num(record.original_width),
        height: num(record.original_height),
        source: text(record.source) || hostOf(pageUrl, ""),
      },
    ];
  });
}

export function parseGoogleCse(payload: unknown): SearchHit[] {
  const items = asRecord(payload)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const record = asRecord(item);
    const image = asRecord(record?.image);
    if (!record || !image) return [];
    const imageUrl = text(record.link);
    const pageUrl = text(image.contextLink);
    if (!imageUrl) return [];
    return [
      {
        title: text(record.title),
        imageUrl,
        thumbUrl: text(image.thumbnailLink) || imageUrl,
        pageUrl,
        width: num(image.width),
        height: num(image.height),
        source: text(record.displayLink) || hostOf(pageUrl, ""),
      },
    ];
  });
}

export function parseBing(payload: unknown): SearchHit[] {
  const results = asRecord(payload)?.value;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const imageUrl = text(record.contentUrl);
    const pageUrl = text(record.hostPageUrl);
    if (!imageUrl) return [];
    return [
      {
        title: text(record.name),
        imageUrl,
        thumbUrl: text(record.thumbnailUrl) || imageUrl,
        pageUrl,
        width: num(record.width),
        height: num(record.height),
        source: text(record.hostPageDomainFriendlyName) || hostOf(pageUrl, ""),
      },
    ];
  });
}

function authHint(provider: SearchProviderId): string {
  if (provider === "serpapi") return "Check SERPAPI_API_KEY on the server.";
  if (provider === "google-cse") return "Check GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX on the server.";
  if (provider === "bing") return "Check BING_IMAGE_SEARCH_KEY on the server.";
  return "Try again, upload a scene photo, or set SERPAPI_API_KEY (or Google CSE or Bing) on the server.";
}

function providerFailure(provider: SearchProviderId, status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError(502, "search_failed", `Image search rejected the request. ${authHint(provider)}`);
  }
  if (status === 429) {
    return new AppError(429, "search_failed", "Image search is rate-limited. Wait a moment and try again, or upload a scene photo.");
  }
  return new AppError(502, "search_failed", `Image search failed. ${authHint(provider)}`);
}

async function getJson(url: string, headers: Record<string, string>, provider: SearchProviderId): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
      redirect: "follow",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AppError(504, "search_failed", "Image search timed out. Try again or upload a scene photo.");
    }
    throw new AppError(502, "search_failed", `Image search is unavailable right now. ${authHint(provider)}`);
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) throw providerFailure(provider, res.status);
    throw new AppError(502, "search_failed", `Image search failed. ${authHint(provider)}`);
  }
  if (!res.ok) throw providerFailure(provider, res.status);
  const record = asRecord(payload);
  const errorText = text(record?.error);
  const nested = asRecord(record?.error);
  if (errorText || nested) {
    const status = num(nested?.code) || res.status || 502;
    throw providerFailure(provider, status >= 400 ? status : 502);
  }
  return payload;
}

function extractVqd(html: string): string | null {
  const quoted = html.match(/vqd="([^"]+)"/) ?? html.match(/vqd=\\"([^\\"]+)\\"/);
  if (quoted?.[1]) return quoted[1];
  const bare = html.match(/[?&]vqd=([\d-]+)/);
  return bare?.[1] ?? null;
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const homeUrl = `https://duckduckgo.com/?${new URLSearchParams({ q: query })}`;
  let home: Response;
  try {
    home = await fetch(homeUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AppError(504, "search_failed", "Image search timed out. Try again or upload a scene photo.");
    }
    throw new AppError(502, "search_failed", `Image search is unavailable right now. ${authHint("duckduckgo")}`);
  }
  if (!home.ok) throw providerFailure("duckduckgo", home.status);
  const vqd = extractVqd(await home.text());
  if (!vqd) throw new AppError(502, "search_failed", `Image search failed. ${authHint("duckduckgo")}`);
  const imageUrl = `https://duckduckgo.com/i.js?${new URLSearchParams({
    l: "us-en",
    o: "json",
    q: query,
    vqd,
    f: ",,,",
    p: "1",
  })}`;
  const payload = await getJson(imageUrl, { "User-Agent": BROWSER_UA, Referer: "https://duckduckgo.com/" }, "duckduckgo");
  return parseDuckDuckGo(payload);
}

async function searchSerpApi(query: string): Promise<SearchHit[]> {
  const key = process.env.SERPAPI_API_KEY?.trim() ?? "";
  const url = `https://serpapi.com/search.json?${new URLSearchParams({
    engine: "google_images",
    q: query,
    api_key: key,
    ijn: "0",
    tbs: "itp:photo",
  })}`;
  return parseSerpApi(await getJson(url, { Accept: "application/json" }, "serpapi"));
}

async function searchGoogleCse(query: string): Promise<SearchHit[]> {
  const url = `https://www.googleapis.com/customsearch/v1?${new URLSearchParams({
    key: process.env.GOOGLE_CSE_API_KEY?.trim() ?? "",
    cx: process.env.GOOGLE_CSE_CX?.trim() ?? "",
    q: query,
    searchType: "image",
    num: "10",
    imgType: "photo",
    safe: "active",
  })}`;
  return parseGoogleCse(await getJson(url, { Accept: "application/json" }, "google-cse"));
}

async function searchBing(query: string): Promise<SearchHit[]> {
  const url = `https://api.bing.microsoft.com/v7.0/images/search?${new URLSearchParams({
    q: query,
    count: "20",
    imageType: "Photo",
    size: "Large",
    safeSearch: "Moderate",
  })}`;
  return parseBing(
    await getJson(url, { Accept: "application/json", "Ocp-Apim-Subscription-Key": process.env.BING_IMAGE_SEARCH_KEY?.trim() ?? "" }, "bing"),
  );
}

export async function searchCelebrityPhotos(rawName: string): Promise<{ provider: SearchProviderId; hits: SearchHit[] }> {
  const name = normalizeCelebrityName(rawName);
  const provider = activeSearchProvider();
  const query = celebrityQuery(name);
  const raw =
    provider === "serpapi"
      ? await searchSerpApi(query)
      : provider === "google-cse"
        ? await searchGoogleCse(query)
        : provider === "bing"
          ? await searchBing(query)
          : await searchDuckDuckGo(query);
  const hits = selectCelebrityHits(name, raw);
  if (hits.length === 0) throw new AppError(404, "no_results", noResultsMessage(name));
  return { provider, hits };
}
