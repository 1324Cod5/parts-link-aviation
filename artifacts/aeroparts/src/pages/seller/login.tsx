import { useState } from "react";
import { useSearch, Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export default function SellerLogin() {
  const [showPassword, setShowPassword] = useState(false);
  // Read error + pre-fill email from query string (set by the server on failed login).
  const search = useSearch();
  const params = new URLSearchParams(search);
  const errorMsg = params.get("error") ?? "";
  const prefillEmail = params.get("email") ?? "";
  const verifiedParam = params.get("verified") ?? "";

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="bg-card border border-border rounded-md p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Sign In</h1>
            <p className="text-muted-foreground text-sm">
              Access your Parts Link Aviation seller dashboard.
            </p>
          </div>

          {verifiedParam === "true" && (
            <div className="mb-4 rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              Email verified! You can now log in.
            </div>
          )}
          {errorMsg === "email_not_verified" && (
            <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              Please verify your email before logging in. Check your inbox.
            </div>
          )}
          {errorMsg === "token_expired" && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Verification link expired. Please register again.
            </div>
          )}
          {errorMsg === "invalid_token" && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Invalid verification link.
            </div>
          )}
          {errorMsg && !["email_not_verified", "token_expired", "invalid_token"].includes(errorMsg) && (
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
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2">
              Sign In
            </Button>
          </form>

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
