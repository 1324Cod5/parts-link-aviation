import { useEffect } from "react";

const SITE_URL = "https://www.partslinkaviation.com";
const SITE_NAME = "Parts Link Aviation";
const DEFAULT_TITLE = "Parts Link Aviation — Transparent Aircraft Parts Marketplace";
const DEFAULT_DESCRIPTION =
  "A transparent marketplace for certified aircraft parts. Founding sellers list free — 0% commission, full 8130-3/EASA Form 1 traceability, AOG matching.";

interface SEOProps {
  /** Page title, ≤60 chars. Site name is NOT appended automatically — include it if desired. */
  title?: string;
  /** Meta description, ≤155 chars. */
  description?: string;
  /** Path for the canonical URL, e.g. "/pricing". Defaults to current pathname. */
  path?: string;
  /** Set true on pages that should not be indexed (404, admin, dashboards). */
  noindex?: boolean;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Per-route SEO tags. Renders nothing; mutates document head on mount/update.
 * Usage: <SEO title="Pricing | Parts Link Aviation" description="..." path="/pricing" />
 */
export function SEO({ title, description, path, noindex }: SEOProps) {
  useEffect(() => {
    const t = title || DEFAULT_TITLE;
    const d = description || DEFAULT_DESCRIPTION;
    const canonicalPath = path ?? window.location.pathname;
    const url = SITE_URL + (canonicalPath === "/" ? "/" : canonicalPath.replace(/\/$/, ""));

    document.title = t;
    setMeta("name", "description", d);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setCanonical(url);
    setMeta("property", "og:title", t);
    setMeta("property", "og:description", d);
    setMeta("property", "og:url", url);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("name", "twitter:title", t);
    setMeta("name", "twitter:description", d);
  }, [title, description, path, noindex]);

  return null;
}

export default SEO;
