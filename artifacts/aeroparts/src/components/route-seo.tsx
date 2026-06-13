import { useLocation } from "wouter";
import { SEO } from "@/components/seo";
import seoData from "@/seo/routes-meta.json";

interface RouteMeta {
  title: string;
  description: string;
  noindex?: boolean;
}

const ROUTE_META = seoData.routes as Record<string, RouteMeta>;
const NOINDEX_PREFIXES: string[] = seoData.noindexPrefixes;
const DYNAMIC_PUBLIC_PREFIXES: string[] = seoData.dynamicPublicPrefixes;

function metaForPath(path: string): RouteMeta {
  const normalized = path !== "/" ? path.replace(/\/$/, "") : "/";

  const exact = ROUTE_META[normalized];
  if (exact) return exact;

  if (NOINDEX_PREFIXES.some((p) => normalized === p || normalized.startsWith(p + "/"))) {
    return {
      title: "Parts Link Aviation",
      description: "Parts Link Aviation account area.",
      noindex: true,
    };
  }

  // Dynamic public detail pages — indexable with generic meta.
  // (Listing/RFQ/MRO detail pages should eventually set their own <SEO> with real data.)
  if (DYNAMIC_PUBLIC_PREFIXES.some((p) => normalized.startsWith(p))) {
    return {
      title: "Parts Link Aviation — Certified Aircraft Parts",
      description:
        "Certified aircraft parts with full documentation traceability on Parts Link Aviation.",
    };
  }

  // Unknown route → 404, keep it out of the index.
  return {
    title: "Page Not Found | Parts Link Aviation",
    description: "The page you are looking for does not exist.",
    noindex: true,
  };
}

/** Renders per-route SEO tags based on the current wouter location. */
export function RouteSEO() {
  const [location] = useLocation();
  const meta = metaForPath(location);
  return <SEO title={meta.title} description={meta.description} path={location} noindex={meta.noindex} />;
}

export default RouteSEO;
