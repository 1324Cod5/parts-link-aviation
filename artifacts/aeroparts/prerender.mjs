/**
 * Build-time prerenderer for public routes.
 *
 * Runs after `vite build`. For every public route in src/seo/routes-meta.json it
 * writes dist/public/<route>/index.html with route-specific meta tags and a
 * static, crawlable content block inside #root. React replaces the block on
 * hydration, so users see the normal app — but crawlers that don't execute
 * JavaScript (most AI crawlers, social link previews) see real content.
 *
 * Also writes dist/public/__spa.html — a pristine copy of the app shell that
 * the API server uses as the fallback for client-side routes and 404s.
 *
 * No dependencies — plain Node.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, "dist", "public");
const META = JSON.parse(fs.readFileSync(path.join(here, "src", "seo", "routes-meta.json"), "utf8"));

const SITE_URL = META.siteUrl;

const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Static crawlable content per route, injected into #root.
 * Copy mirrors the real rendered pages. Keep in sync when page copy changes.
 * Routes without an entry get a generic block built from their meta.
 */
const CONTENT = {
  "/": `
    <h1>The Aviation Parts Marketplace Built for Transparency</h1>
    <p>Parts Link Aviation is a transparent marketplace for certified aircraft components, connecting verified sellers with professional buyers worldwide. List your certified inventory, connect with verified buyers — no middlemen. 0% commission on sales, free to list, transparent pricing.</p>
    <h2>Founding Seller Program</h2>
    <p>Be one of the first verified suppliers on Parts Link Aviation. Founding sellers get 6 months of Solo Operator access completely free — no credit card required. Includes a verified seller badge, unlimited listings, buyer analytics and AOG request matching.</p>
    <h2>Browse by Category</h2>
    <p>Eight core aviation part categories: Avionics (navigation, comms and displays), Engines &amp; APU (turbofan, turboprop and APU units), Landing Gear (struts, actuators and doors), Hydraulics (pumps, actuators and lines), Airframe (panels, frames and fairings), Interiors (seats, galleys and overhead bins), Wheels &amp; Brakes, and Electrical (wiring, connectors and PCBs).</p>
    <h2>Built for Aviation Professionals</h2>
    <p>AOG emergency response: post urgent AOG requests and get matched with verified suppliers. Verified certification docs: every part comes with traceable 8130-3, EASA Form 1 or equivalent airworthiness documentation. Real-time pricing intelligence, smart part alerts, and native ERP/MRO integration for AMOS, Ramco and SAP.</p>
    <h2>How It Works</h2>
    <p>1. Submit your part number, condition requirements and urgency level. 2. Verified suppliers respond in real time with pricing, lead time and certification documentation. 3. Review seller trust scores and audit history. 4. Parts ship with full documentation — track delivery and log receipt in the platform.</p>
    <nav><a href="/marketplace">Browse Parts</a> <a href="/rfqs">RFQ Board</a> <a href="/mro">MRO Services</a> <a href="/pricing">Pricing</a> <a href="/seller/register">Become a Founding Seller</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav>`,

  "/marketplace": `
    <h1>Parts Marketplace</h1>
    <p>Search certified aircraft parts by category, condition and part number. Every listing includes traceable 8130-3, EASA Form 1 or equivalent airworthiness documentation. Categories: Avionics, Engines &amp; APU, Landing Gear, Hydraulics, Airframe, Interiors, Wheels &amp; Brakes, Electrical.</p>
    <nav><a href="/rfqs/new">Submit a Part Request</a> <a href="/pricing">Pricing</a> <a href="/">Home</a></nav>`,

  "/pricing": `
    <h1>Plans for Every Operation</h1>
    <p>Founding sellers list free for 6 months — no credit card required, 0% commission on sales.</p>
    <h2>Solo Operator — $149/mo</h2>
    <p>Free during the founding period, then $149/mo. Unlimited marketplace searches, access to all verified listings, email support.</p>
    <h2>Fleet Manager — $349/mo</h2>
    <p>Unlimited marketplace searches, full access to all verified listings, watchlist alerts, API access, business-hours email support.</p>
    <h2>Mission Control — $799/mo</h2>
    <p>Everything in Fleet Manager plus ERP &amp; MRO integration and unlimited multi-user seats.</p>
    <nav><a href="/seller/register">Claim Your Free Founding Seller Spot</a> <a href="/contact">Contact for Enterprise Pricing</a></nav>`,

  "/rfqs": `
    <h1>RFQ Board &amp; AOG Requests</h1>
    <p>Post part requirements and AOG (aircraft on ground) requests. Verified suppliers respond with quotes, lead times and certification documentation in real time. AOG requests are flagged immediately for fastest response.</p>
    <nav><a href="/rfqs/new">Submit a Request</a> <a href="/marketplace">Browse Parts</a></nav>`,

  "/mro": `
    <h1>MRO Services Directory</h1>
    <p>Find verified MRO providers for component repair, overhaul and exchange. Compare capabilities, certifications and turnaround times.</p>
    <nav><a href="/marketplace">Browse Parts</a> <a href="/rfqs">RFQ Board</a></nav>`,

  "/about": `
    <h1>About Parts Link Aviation</h1>
    <p>Parts Link Aviation is a transparent marketplace for certified aircraft components, connecting verified sellers with professional buyers worldwide. We built the platform around three principles: transparent pricing with 0% commission, full documentation traceability on every listing, and verified participants on both sides of every transaction.</p>
    <p>All sellers are required to provide airworthiness documentation (FAA 8130-3, EASA Form 1 or equivalent) for listed parts.</p>
    <nav><a href="/compliance">Compliance Overview</a> <a href="/seller/register">Become a Founding Seller</a> <a href="/contact">Contact Us</a></nav>`,

  "/compliance": `
    <h1>Compliance &amp; Documentation Standards</h1>
    <p>Every listing on Parts Link Aviation must include traceable airworthiness documentation: FAA 8130-3, EASA Form 1 or equivalent. This page explains our documentation requirements, seller verification process and traceability standards.</p>
    <nav><a href="/certification">Part Certification</a> <a href="/seller-guidelines">Seller Guidelines</a></nav>`,

  "/seller/register": `
    <h1>Become a Founding Seller</h1>
    <p>Apply as a founding seller and list certified aircraft parts free for 6 months. No credit card required, 0% commission. Founding sellers get a verified seller badge, unlimited listings, buyer analytics and AOG request matching.</p>
    <nav><a href="/pricing">See All Plans</a> <a href="/seller-guidelines">Seller Guidelines</a></nav>`,
};

function genericContent(route, meta) {
  const h1 = meta.title.split("|")[0].split("—")[0].trim();
  return `\n    <h1>${esc(h1)}</h1>\n    <p>${esc(meta.description)}</p>\n    <nav><a href="/">Parts Link Aviation Home</a> <a href="/marketplace">Browse Parts</a></nav>`;
}

function renderRoute(template, route, meta) {
  const url = SITE_URL + (route === "/" ? "/" : route);
  const t = esc(meta.title);
  const d = esc(meta.description);

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`);

  const content = CONTENT[route] ?? genericContent(route, meta);
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${content}\n    </div>`,
  );
  return html;
}

function main() {
  const indexPath = path.join(DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("prerender: dist/public/index.html not found — run vite build first");
    process.exit(1);
  }
  const template = fs.readFileSync(indexPath, "utf8");

  // Pristine shell for SPA fallback / 404s.
  fs.writeFileSync(path.join(DIST, "__spa.html"), template);

  let count = 0;
  for (const [route, meta] of Object.entries(META.routes)) {
    const html = renderRoute(template, route, meta);
    const outFile =
      route === "/" ? indexPath : path.join(DIST, route.replace(/^\//, ""), "index.html");
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    count++;
  }
  console.log(`prerender: wrote ${count} routes + __spa.html`);
}

main();
