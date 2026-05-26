const BLUE = "#1976d2";
const GOLD = "#f5a623";
const BORDER = "#1a3050";
const MUTED = "#4a6480";

export function Footer() {
  const cols = [
    {
      heading: "Marketplace",
      links: [
        { label: "Browse Parts", href: "/marketplace" },
        { label: "New Condition", href: "/marketplace?condition=new" },
        { label: "Verified Listings", href: "/marketplace?badge=verified" },
        { label: "RFQ Board", href: "/rfqs" },
        { label: "MRO Services", href: "/mro" },
      ],
    },
    {
      heading: "Sellers",
      links: [
        { label: "Become a Seller", href: "/seller/register" },
        { label: "Seller Login", href: "/seller/login" },
        { label: "Seller Dashboard", href: "/seller/dashboard" },
        { label: "Pricing Plans", href: "/pricing" },
        { label: "Seller Guidelines", href: "#" },
      ],
    },
    {
      heading: "Trust & Safety",
      links: [
        { label: "Certification Process", href: "#" },
        { label: "Buyer Protection", href: "#" },
        { label: "Compliance Overview", href: "#" },
        { label: "Contact Support", href: "#" },
      ],
    },
  ];

  const badges = ["FAA Approved", "EASA Part 145", "AS9120", "ISO 9001:2015"];

  return (
    <footer style={{ background: "#060e1a", borderTop: `1px solid ${BORDER}`, padding: "52px 24px 28px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 44 }} className="ap-footer-grid">

          {/* Brand column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 7,
                background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 14, color: "#fff",
              }}>PL</div>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>
                Parts Link <span style={{ color: GOLD }}>Aviation</span>
              </span>
            </div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 18, maxWidth: 260 }}>
              The precision marketplace for certified aircraft components. Built for MROs, airlines, and brokers worldwide.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {badges.map(b => (
                <span key={b} style={{
                  fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 600,
                  color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 3, padding: "2px 8px", letterSpacing: 0.3, textTransform: "uppercase",
                }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map(col => (
            <div key={col.heading}>
              <h4 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18,
              }}>{col.heading}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#a0b4cc")}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 22, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#2a4060" }}>
            © {new Date().getFullYear()} Parts Link Aviation. All rights reserved.
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(l => (
              <a
                key={l}
                href="#"
                style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#2a4060", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#4a6480")}
                onMouseLeave={e => (e.currentTarget.style.color = "#2a4060")}
              >{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
