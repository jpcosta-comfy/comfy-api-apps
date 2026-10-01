import { errorResponse } from "@/lib/http";
import { providerLabel, searchCelebrityPhotos } from "@/lib/paparazzi-search";
import { signSceneChoice } from "@/lib/scene-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const name = new URL(request.url).searchParams.get("q") ?? "";
    const { provider, hits } = await searchCelebrityPhotos(name);
    return Response.json({
      provider: providerLabel(provider),
      candidates: hits.map((hit) => ({
        token: signSceneChoice(hit),
        title: hit.title,
        source: hit.source,
        width: hit.width,
        height: hit.height,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
