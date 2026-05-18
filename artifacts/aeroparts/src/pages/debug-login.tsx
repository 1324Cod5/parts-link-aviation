import { useEffect } from "react";

// Development-only bypass: immediately redirects to the API debug login route,
// which creates a session for freeseller@test.com and then redirects to /seller/dashboard.
// Visit /debug-login-free-seller to trigger this.
export default function DebugLoginFreeSeller() {
  useEffect(() => {
    window.location.href = "/api/debug/login-free-seller";
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a1628", color: "#ccc", fontFamily: "monospace" }}>
      Establishing debug session… redirecting to dashboard.
    </div>
  );
}
