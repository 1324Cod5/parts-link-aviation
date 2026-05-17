import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLoginUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SellerLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const login = useLoginUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: form },
      {
        onSuccess: (data) => {
          const { computedRole, contactName } = data.user;
          toast({ title: "Signed in", description: `Welcome back, ${contactName}` });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          if (computedRole === "admin") {
            navigate("/admin");
          } else if (computedRole.startsWith("seller_")) {
            navigate("/seller/dashboard");
          } else if (computedRole.startsWith("mro_")) {
            navigate("/mro");
          } else {
            toast({ title: "Access denied", description: "Your account does not have a valid role.", variant: "destructive" });
          }
        },
        onError: (err: any) => {
          const msg: string = err?.response?.data?.error ?? "Invalid email or password.";
          toast({ title: "Sign in failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Email Address</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full mt-2" disabled={login.isPending}>
              {login.isPending ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p className="mb-2">Demo credentials:</p>
            <p className="font-mono text-xs bg-secondary/50 rounded px-3 py-1.5 inline-block">avtech@example.com / password</p>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/seller/register" className="text-primary hover:underline">Register as a seller</Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
