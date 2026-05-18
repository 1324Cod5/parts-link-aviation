import { useState, useEffect } from "react";
import { useSearch } from "wouter";

interface SessionInfo {
  authenticated: boolean;
  user: { email: string; role: string } | null;
}

export default function AuthTestPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const errorMsg   = params.get("error") ?? "";
  const prefillEmail = params.get("email") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Fetch current session state from the debug endpoint on mount
  useEffect(() => {
    fetch("/api/auth-test/me", { credentials: "include" })
      .then(r => r.json())
      .then((data: SessionInfo) => setSession(data))
      .catch(() => setSession({ authenticated: false, user: null }))
      .finally(() => setLoadingSession(false));
  }, []);

  const boxStyle: React.CSSProperties = {
    background: "#0d1f3c",
    border: "1px solid #2a3f5f",
    borderRadius: 8,
    padding: 24,
    marginBottom: 20,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8fa3c0",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0a1628",
    border: "1px solid #2a3f5f",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#e2e8f0",
    fontSize: 14,
    boxSizing: "border-box",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 0",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  };

  const badgeStyle = (ok: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 700,
    background: ok ? "#14532d" : "#450a0a",
    color: ok ? "#4ade80" : "#f87171",
    border: `1px solid ${ok ? "#16a34a" : "#dc2626"}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#060e1c", color: "#e2e8f0", fontFamily: "system-ui,sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>
            Auth Test System
          </h1>
          <p style={{ margin: "6px 0 0", color: "#8fa3c0", fontSize: 13 }}>
            Isolated authentication test — no marketplace logic.
          </p>
        </div>

        {/* Debug panel */}
        <div style={{ ...boxStyle, fontFamily: "monospace", fontSize: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8fa3c0", marginBottom: 14 }}>
            Debug Panel
          </div>

          {loadingSession ? (
            <p style={{ color: "#8fa3c0", margin: 0 }}>Checking session…</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#8fa3c0", paddingBottom: 10, paddingRight: 16, verticalAlign: "top" }}>Session exists</td>
                  <td style={{ paddingBottom: 10 }}>
                    <span style={badgeStyle(session?.authenticated ?? false)}>
                      {session?.authenticated ? "YES" : "NO"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#8fa3c0", paddingBottom: 10, paddingRight: 16, verticalAlign: "top" }}>Session user</td>
                  <td style={{ paddingBottom: 10, color: session?.user ? "#4ade80" : "#f87171" }}>
                    {session?.user
                      ? JSON.stringify(session.user)
                      : "null"}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#8fa3c0", paddingRight: 16, verticalAlign: "top" }}>Protected route</td>
                  <td>
                    <a
                      href="/api/auth-test/protected"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60a5fa", fontSize: 12 }}
                    >
                      /api/auth-test/protected ↗
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {session?.authenticated && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#0a1e10", border: "1px solid #16a34a", borderRadius: 6, fontSize: 14, color: "#4ade80" }}>
              ✓ Authenticated as <strong>{session.user?.email}</strong>
            </div>
          )}
        </div>

        {/* Login form */}
        {!session?.authenticated && (
          <div style={boxStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8fa3c0", marginBottom: 16 }}>
              Sign In
            </div>

            {errorMsg && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 6, fontSize: 13, color: "#f87171" }}>
                {errorMsg}
              </div>
            )}

            <form method="POST" action="/api/auth-test/login">
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={prefillEmail}
                  placeholder="admin@test.com"
                  required
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    required
                    autoComplete="current-password"
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8fa3c0", cursor: "pointer", fontSize: 13 }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" style={btnStyle}>Sign In</button>
            </form>

            <div style={{ marginTop: 16, padding: "10px 14px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, fontSize: 12, fontFamily: "monospace", color: "#8fa3c0", lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>TEST CREDENTIALS</div>
              admin@test.com / Admin123!<br />
              freeseller@test.com / Seller123!
            </div>
          </div>
        )}

        {/* Logout */}
        {session?.authenticated && (
          <div style={boxStyle}>
            <form method="POST" action="/api/auth-test/logout">
              <button type="submit" style={{ ...btnStyle, background: "#7f1d1d", marginTop: 0 }}>
                Sign Out
              </button>
            </form>
          </div>
        )}

        {/* Info */}
        <div style={{ fontSize: 12, color: "#4a5568", textAlign: "center", marginTop: 8 }}>
          All routes: &nbsp;
          <code style={{ color: "#60a5fa" }}>POST /api/auth-test/login</code> &nbsp;·&nbsp;
          <code style={{ color: "#60a5fa" }}>GET /api/auth-test/me</code> &nbsp;·&nbsp;
          <code style={{ color: "#60a5fa" }}>POST /api/auth-test/logout</code>
        </div>
      </div>
    </div>
  );
}
