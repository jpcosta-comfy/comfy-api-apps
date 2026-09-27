import { Studio } from "@/components/studio";
import { buildCatalog } from "@/lib/catalog";
import { hasApiKey, isMockMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <Studio apps={buildCatalog()} mock={isMockMode()} configured={hasApiKey()} />;
}
