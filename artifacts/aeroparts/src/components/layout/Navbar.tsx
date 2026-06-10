import { Link, useLocation } from "wouter";
import { ChevronDown, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";h
import {
  useGetConversationsUnreadCount,
  getGetConversationsUnreadCountQueryKey,
} from "@workspace/api-client-react";

// ─── Brand tokens (match homepage) ────────────────────────────────────────────
const BLUE = "#1976d2";
const GOLD = "#f5a623";
const NAVY = "#0a1628";

const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer View",
  seller: "Seller View",
  admin: "Admin View",
};

const PLAN_LABELS: Record<string, string> = {
  pro: "PRO",
  enterprise: "ENTERPRISE",
  mro_verified: "MRO",
  mro_premium: "MRO+",
  mro_provider: "MRO",
};

export function Navbar() {
  const { user, logout, switchRole, isSwitchingRole } = useAuth();
  const [location] = useLocation();

  const activeRole = user?.activeRole ?? user?.role ?? "";
  const userRoles: string[] = (user as any)?.roles ?? (user?.role ? [user.role] : []);
  const hasMultipleRoles = userRoles.length > 1;

  const { data: unreadData } = useGetConversationsUnreadCount({
    query: {
      queryKey: getGetConversationsUnreadCountQueryKey(),
      enabled: !!user && activeRole === "seller",
      refetchInterval: 30_000,
      retry: false,
    },
  });
  const unreadCount = unreadData?.count ?? 0;

  const navLinkStyle = (active: boolean) => ({
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    textDecoration: "none",
    color: active ? "#fff" : "#7ea8c8",
    transition: "color 0.2s",
    position: "relative" as const,
  });

  return (
    <nav style={{ background: "rgba(10,22,40,0.97)", borderBottom: "1px solid #1a3050", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
      <div className="container mx-auto px-4" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Left: Logo + nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 7,
              background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 14, color: "#fff", letterSpacing: -0.5, flexShrink: 0,
            }}>PL</div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
              Parts Link <span style={{ color: GOLD }}>Aviation</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 24 }}>
            <Link
              href="/marketplace"
              style={navLinkStyle(location === "/marketplace")}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = location === "/marketplace" ? "#fff" : "#7ea8c8")}
            >Marketplace</Link>

            <Link
              href="/rfqs"
              style={navLinkStyle(location.startsWith("/rfqs"))}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = location.startsWith("/rfqs") ? "#fff" : "#7ea8c8")}
            >RFQ Board</Link>

            <Link
              href="/mro"
              style={navLinkStyle(location.startsWith("/mro"))}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = location.startsWith("/mro") ? "#fff" : "#7ea8c8")}
            >MRO Services</Link>

            <Link
              href="/pricing"
              style={navLinkStyle(location === "/pricing")}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = location === "/pricing" ? "#fff" : "#7ea8c8")}
            >Pricing</Link>

            {activeRole === "seller" && (
              <Link
                href="/seller/dashboard"
                style={{ ...navLinkStyle(location.startsWith("/seller")), position: "relative" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = location.startsWith("/seller") ? "#fff" : "#7ea8c8")}
              >
                Dashboard
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -8, right: -14,
                    height: 16, minWidth: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, background: BLUE, color: "#fff",
                    fontSize: 9, fontWeight: 700, padding: "0 3px", lineHeight: 1,
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {activeRole === "admin" && (
              <Link
                href="/admin"
                style={navLinkStyle(location.startsWith("/admin"))}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = location.startsWith("/admin") ? "#fff" : "#7ea8c8")}
              >Admin Portal</Link>
            )}
          </div>
        </div>

        {/* Right: AOG button + auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* AOG Request button */}
          <a
            href="/rfqs/new?urgency=aog"
            className="hidden md:inline-flex"
            style={{
              alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 6,
              background: "#991b1b", color: "#fff",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
              letterSpacing: "0.06em", textDecoration: "none", textTransform: "uppercase",
            }}
          >
            <Zap size={12} />⚡ Submit AOG Request
          </a>

          {!user ? (
            <>
              <Link href="/seller/login">
                <button style={{
                  background: "none", border: "1px solid #1a3050", color: "#7ea8c8", cursor: "pointer", borderRadius: 6,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14,
                  letterSpacing: "0.06em", textTransform: "uppercase", padding: "7px 12px",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#7ea8c8")}
                >Sign In</button>
              </Link>
              <Link href="/seller/register">
                <button style={{
                  padding: "8px 18px", borderRadius: 6, background: BLUE, border: "none",
                  color: "#fff", cursor: "pointer",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  Get Started
                </button>
              </Link>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Role switcher */}
              {hasMultipleRoles && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSwitchingRole}
                      className="h-7 text-xs border-border text-muted-foreground hover:text-white gap-1 px-2"
                    >
                      {ROLE_LABELS[activeRole] ?? activeRole}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    {userRoles.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        disabled={r === activeRole || isSwitchingRole}
                        onClick={() => r !== activeRole && switchRole(r)}
                        className={r === activeRole ? "font-semibold text-primary cursor-default" : "cursor-pointer"}
                      >
                        {ROLE_LABELS[r] ?? r}
                        {r === activeRole && (
                          <span className="ml-auto text-[10px] text-muted-foreground">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs text-muted-foreground cursor-default" disabled>
                      Single account, multiple roles
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* User name + plan badge */}
              <span className="hidden md:inline-flex" style={{ alignItems: "center", gap: 8, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#7ea8c8" }}>
                {user.contactName}
                {user.plan && user.plan !== "free" && PLAN_LABELS[user.plan] && (
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: GOLD, color: NAVY,
                    padding: "2px 7px", borderRadius: 3,
                  }}>
                    {PLAN_LABELS[user.plan]}
                  </span>
                )}
              </span>

              {/* Sign out */}
              <button
                onClick={logout}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid #1a3050",
                  color: "#7ea8c8", cursor: "pointer", borderRadius: 6,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                  fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "7px 14px", transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#7ea8c8"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
