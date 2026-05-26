import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/context/AuthContext";
import { Copy, Check, Key, Code2, Globe, Lock, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BLUE = "#1976d2";
const GOLD = "#f5a623";
const BORDER = "#1a3050";
const MUTED = "#7ea8c8";
const CARD = "#0d1f38";
const CODE_BG = "#060e1a";

const BASE_URL = "https://api.partslinkaviation.com/v1";

const ENDPOINTS = [
  { method: "GET",    path: "/parts",          desc: "List all available parts with pagination and filters" },
  { method: "GET",    path: "/parts/:id",       desc: "Retrieve a single part by ID including documents" },
  { method: "GET",    path: "/rfqs",            desc: "List open RFQs on the board, filtered by status" },
  { method: "POST",   path: "/rfqs",            desc: "Post a new Request for Quotation" },
  { method: "GET",    path: "/sellers/:id",     desc: "Get seller profile and trust score" },
  { method: "GET",    path: "/market/price/:pn", desc: "Get price benchmarking data for a part number" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "#4ade80", POST: "#60a5fa", PUT: "#facc15", DELETE: "#f87171",
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "relative", background: CODE_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
      <button onClick={copy} style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 10px", color: MUTED, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, fontFamily: "'Barlow', sans-serif" }}>
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
      <pre style={{ fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 13, color: "#e2e8f0", padding: "18px 20px", margin: 0, overflowX: "auto", lineHeight: 1.7 }}>{code}</pre>
    </div>
  );
}

function SectionH({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", textTransform: "uppercase", marginBottom: 16, marginTop: 48, letterSpacing: "0.02em" }}>{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.7, marginBottom: 14 }}>{children}</p>;
}

function generateMockKey(seed: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "plav_";
  for (let i = 0; i < 40; i++) {
    result += chars[(seed.charCodeAt(i % seed.length) + i * 7) % chars.length];
  }
  return result;
}

export default function DeveloperPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasPlan = user && (user.plan === "enterprise" || user.plan === "pro");

  const storedKey = typeof window !== "undefined" ? localStorage.getItem("pl_api_key") : null;
  const [apiKey, setApiKey] = useState<string | null>(storedKey);
  const [generating, setGenerating] = useState(false);

  const handleGenerateKey = () => {
    if (!hasPlan) {
      toast({ title: "Fleet Manager plan required", description: "Upgrade to Fleet Manager or Mission Control to access the API.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      const key = generateMockKey(user!.email + Date.now());
      localStorage.setItem("pl_api_key", key);
      setApiKey(key);
      setGenerating(false);
      toast({ title: "API key generated", description: "Keep this key secret — it grants full API access." });
    }, 900);
  };

  const curlExample = `curl -X GET "${BASE_URL}/parts" \\
  -H "Authorization: Bearer ${apiKey ?? "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json"`;

  const jsExample = `const response = await fetch("${BASE_URL}/parts?limit=20", {
  headers: {
    "Authorization": "Bearer ${apiKey ?? "YOUR_API_KEY"}",
    "Content-Type": "application/json",
  },
});
const { listings, total } = await response.json();
console.log(\`Found \${total} parts\`);`;

  const rfqExample = `curl -X POST "${BASE_URL}/rfqs" \\
  -H "Authorization: Bearer ${apiKey ?? "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "partNumber": "CFM56-7B27",
    "description": "HPT Blade Set",
    "quantity": 1,
    "urgency": "routine",
    "buyerName": "Jane Smith",
    "buyerEmail": "jane@airline.com"
  }'`;

  const responseExample = `{
  "listings": [
    {
      "id": 42,
      "partNumber": "CFM56-7B27",
      "manufacturer": "CFM International",
      "condition": "overhauled",
      "price": 165000.00,
      "badge": "verified",
      "seller": {
        "companyName": "AviaTech Components",
        "trustBadge": "aviation_verified"
      }
    }
  ],
  "total": 1,
  "page": 1
}`;

  return (
    <MainLayout>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48, paddingBottom: 32, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(25,118,210,0.1)", border: `1px solid rgba(25,118,210,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <Code2 size={12} color={BLUE} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Developer API</span>
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", lineHeight: 1.05, marginBottom: 12 }}>
            API <span style={{ color: GOLD }}>Reference</span>
          </h1>
          <P>Integrate the Parts Link Aviation catalog, RFQ board, and market intelligence directly into your ERP, MRO system, or custom application.</P>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: CODE_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              <Globe size={13} color={MUTED} />
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: "#e2e8f0" }}>{BASE_URL}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4ade80" }}>API Operational</span>
            </div>
          </div>
        </div>

        {/* API Key */}
        <SectionH><Key size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Authentication</SectionH>
        <P>All API requests must include your API key in the <code style={{ fontFamily: "monospace", background: CODE_BG, padding: "2px 6px", borderRadius: 4, color: "#60a5fa" }}>Authorization</code> header as a Bearer token. API access requires the <strong style={{ color: "#fff" }}>Fleet Manager</strong> plan or above.</P>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Your API Key</p>
              {apiKey ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: "#4ade80", background: CODE_BG, padding: "8px 14px", borderRadius: 8, letterSpacing: "0.05em" }}>
                    {apiKey.slice(0, 12)}…{apiKey.slice(-8)}
                  </code>
                </div>
              ) : (
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, margin: 0 }}>No API key generated yet.</p>
              )}
            </div>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              style={{ padding: "10px 22px", background: hasPlan ? BLUE : "#374151", border: "none", borderRadius: 8, color: "#fff", cursor: hasPlan ? "pointer" : "not-allowed", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, opacity: generating ? 0.7 : 1 }}
            >
              {!hasPlan && <Lock size={14} />}
              <Key size={14} />
              {generating ? "Generating…" : apiKey ? "Regenerate Key" : "Generate API Key"}
            </button>
          </div>
          {!hasPlan && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 8, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#f5a623" }}>
              Fleet Manager or Mission Control plan required for API access. <a href="/pricing" style={{ color: "#f5a623", fontWeight: 600 }}>Upgrade →</a>
            </div>
          )}
        </div>

        {/* Endpoints */}
        <SectionH>Endpoints</SectionH>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {ENDPOINTS.map(ep => (
            <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px" }}>
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 700, color: METHOD_COLORS[ep.method] ?? "#fff", background: `${METHOD_COLORS[ep.method] ?? "#fff"}18`, border: `1px solid ${METHOD_COLORS[ep.method] ?? "#fff"}40`, borderRadius: 4, padding: "2px 10px", flexShrink: 0, minWidth: 52, textAlign: "center" }}>{ep.method}</span>
              <code style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: "#e2e8f0", flex: 1 }}>{ep.path}</code>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED }}>{ep.desc}</span>
            </div>
          ))}
        </div>

        {/* Code examples */}
        <SectionH><Zap size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Code Examples</SectionH>

        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 10 }}>GET /parts — curl</h3>
        <CodeBlock code={curlExample} />

        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 10 }}>GET /parts — JavaScript</h3>
        <CodeBlock code={jsExample} />

        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 10 }}>POST /rfqs — Submit an RFQ</h3>
        <CodeBlock code={rfqExample} />

        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 10 }}>Sample Response</h3>
        <CodeBlock code={responseExample} />

        {/* Rate limits */}
        <SectionH>Rate Limits</SectionH>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
          {[
            { plan: "Fleet Manager", limit: "1,000 req/hr" },
            { plan: "Mission Control", limit: "10,000 req/hr" },
            { plan: "Free / Solo", limit: "Not available" },
          ].map(row => (
            <div key={row.plan} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 6 }}>{row.plan}</p>
              <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 15, color: BLUE, margin: 0 }}>{row.limit}</p>
            </div>
          ))}
        </div>

        <P>Need a higher rate limit or enterprise SLA? <a href="/contact" style={{ color: BLUE, textDecoration: "none" }}>Contact our sales team →</a></P>
      </div>
    </MainLayout>
  );
}
