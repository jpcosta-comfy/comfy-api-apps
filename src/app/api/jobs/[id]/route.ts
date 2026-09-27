import { fetchJob } from "@/lib/comfy";
import { isMockMode } from "@/lib/env";
import { errorJson, errorResponse, AppError } from "@/lib/http";
import { isMockJobId, isUuid } from "@/lib/ids";
import { mockJobView, readMockMeta } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (isMockJobId(id)) {
      if (!isMockMode()) throw new AppError(404, "not_found", "Job not found.");
      const meta = await readMockMeta(id);
      if (!meta) throw new AppError(404, "not_found", "Job not found.");
      return Response.json(mockJobView(meta));
    }
    if (!isUuid(id)) return errorJson(404, "not_found", "Job not found.");
    return Response.json(await fetchJob(id));
  } catch (error) {
    return errorResponse(error);
  }
}
