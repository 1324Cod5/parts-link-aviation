import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Clock, CheckCircle2 } from "lucide-react";

const BLUE = "#1976d2";
const MUTED = "#7ea8c8";
const BORDER = "#1a3050";
const CARD = "#0d1f38";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", background: "#060e1a",
  border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff",
  fontFamily: "'Barlow', sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box",
};

const SUBJECTS = ["General Inquiry", "Technical Support", "Billing", "Seller Verification", "Report Listing", "API Access", "Other"];

export default function ContactPage() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
      toast({ title: "Message received", description: "Our team will respond within 1 business day." });
    }, 1000);
  };

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <MainLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 80px" }}>
        {/* Header */}
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 8 }}>
          Contact <span style={{ color: "#f5a623" }}>Support</span>
        </h1>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 16, color: MUTED, marginBottom: 48 }}>
          Our aviation specialist team is available 24/7 for AOG emergencies and responds to general inquiries within 1 business day.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 32 }} className="contact-grid">
          {/* Contact info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: Mail,  label: "Support Email",  value: "support@partslinkaviation.com", href: "mailto:support@partslinkaviation.com" },
              { icon: Phone, label: "AOG Hotline",    value: "1-800-AERO-247", href: "tel:+18002376247" },
              { icon: Phone, label: "Sales",          value: "+1 (302) 555-0147", href: "tel:+13025550147" },
              { icon: Clock, label: "Support Hours",  value: "Mon–Fri 08:00–20:00 EST\nAOG line: 24/7/365", href: null },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={BLUE} />
                </div>
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
                  {href ? (
                    <a href={href} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, textDecoration: "none" }}>{value}</a>
                  ) : (
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, whiteSpace: "pre-line", margin: 0 }}>{value}</p>
                  )}
                </div>
              </div>
            ))}

            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "18px 20px" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, color: "#ef4444", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>⚡ AOG Emergency</p>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#fca5a5", margin: 0 }}>
                For aircraft-on-ground situations, call our 24/7 AOG hotline: <strong>1-800-AERO-247</strong>. Average sourcing response: under 4 hours.
              </p>
            </div>
          </div>

          {/* Form */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "32px 28px" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <CheckCircle2 size={28} color="#4ade80" />
                </div>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", marginBottom: 10 }}>Message Received</h2>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED }}>
                  We'll respond to <strong style={{ color: "#fff" }}>{form.email}</strong> within 1 business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: "0 0 8px" }}>Send a Message</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, display: "block", marginBottom: 6 }}>Your Name *</label>
                    <input style={inputStyle} required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, display: "block", marginBottom: 6 }}>Email *</label>
                    <input type="email" style={inputStyle} required value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@airline.com" />
                  </div>
                </div>
                <div>
                  <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, display: "block", marginBottom: 6 }}>Subject *</label>
                  <select style={{ ...inputStyle, appearance: "none" }} required value={form.subject} onChange={e => set("subject", e.target.value)}>
                    <option value="">Select a topic…</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, display: "block", marginBottom: 6 }}>Message *</label>
                  <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 130 }} required value={form.message} onChange={e => set("message", e.target.value)} placeholder="Describe your question or issue in detail…" />
                </div>
                <button type="submit" disabled={submitting} style={{ padding: "13px 0", background: BLUE, border: "none", borderRadius: 8, color: "#fff", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>

        <style>{`@media (max-width: 680px) { .contact-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </MainLayout>
  );
}
