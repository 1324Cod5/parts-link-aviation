import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

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
            <Link href="/pricing" className={`text-sm font-medium transition-colors hover:text-primary ${location === '/pricing' ? 'text-primary' : 'text-muted-foreground'}`}>
              Pricing
            </Link>
            {user?.role === 'seller' && (
              <Link href="/seller/dashboard" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/seller') ? 'text-primary' : 'text-muted-foreground'}`}>
                Dashboard
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground'}`}>
                Admin Portal
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-4">
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
