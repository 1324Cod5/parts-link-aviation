import { useSearch, Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SellerLogin() {
  // Read error + pre-fill email from query string (set by the server on failed login).
  const search = useSearch();
  const params = new URLSearchParams(search);
  const errorMsg = params.get("error") ?? "";
  const prefillEmail = params.get("email") ?? "";

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="bg-card border border-border rounded-md p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Sign In</h1>
            <p className="text-muted-foreground text-sm">
              Access your AeroParts seller dashboard.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {/*
            Native browser POST — NOT fetch/AJAX.
            The server responds with a 302 redirect, so the session cookie is
            set via a browser navigation response. This is the only reliable way
            to store cookies in a cross-site iframe context (e.g. Replit preview).
          */}
          <form method="POST" action="/api/auth/login-form" className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block"
              >
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={prefillEmail}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Your password"
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full mt-2">
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p className="mb-2">Demo credentials:</p>
            <p className="font-mono text-xs bg-secondary/50 rounded px-3 py-1.5 inline-block">
              avtech@example.com / password
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/seller/register" className="text-primary hover:underline">
              Register as a seller
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
