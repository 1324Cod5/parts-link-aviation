import { Link, useLocation } from "wouter";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetConversationsUnreadCount,
  getGetConversationsUnreadCountQueryKey,
} from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer View",
  seller: "Seller View",
  admin: "Admin View",
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

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">AeroParts</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/marketplace" className={`text-sm font-medium transition-colors hover:text-primary ${location === '/marketplace' ? 'text-primary' : 'text-muted-foreground'}`}>
              Marketplace
            </Link>
            <Link href="/rfqs" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/rfqs') ? 'text-primary' : 'text-muted-foreground'}`}>
              RFQ Board
            </Link>
            <Link href="/mro" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/mro') ? 'text-primary' : 'text-muted-foreground'}`}>
              MRO Services
            </Link>
            <Link href="/pricing" className={`text-sm font-medium transition-colors hover:text-primary ${location === '/pricing' ? 'text-primary' : 'text-muted-foreground'}`}>
              Pricing
            </Link>
            {activeRole === 'seller' && (
              <Link href="/seller/dashboard" className={`relative text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/seller') ? 'text-primary' : 'text-muted-foreground'}`}>
                Dashboard
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-3.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white px-1 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            {activeRole === 'admin' && (
              <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground'}`}>
                Admin Portal
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <Link href="/seller/login">
                <Button variant="ghost" className="text-white hover:text-primary">Sign In</Button>
              </Link>
              <Link href="/seller/register">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Become a Seller</Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* Role switcher — shown only when the account has multiple roles */}
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

              <span className="text-sm text-muted-foreground hidden md:inline-flex items-center gap-2">
                {user.contactName}
                {user.plan && user.plan !== 'free' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
                    user.plan === 'enterprise' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {user.plan}
                  </span>
                )}
              </span>
              <Button variant="ghost" onClick={logout} className="text-muted-foreground hover:text-white">
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
