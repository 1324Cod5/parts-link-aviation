import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoginUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { ShieldCheck, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "admin@aeroparts.com", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const login = useLoginUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: form },
      {
        onSuccess: (data) => {
          const user = data.user;
          if (user.role !== "admin" && user.role !== "super_admin") {
            toast({
              title: "Access denied",
              description: "This portal is for administrators only.",
              variant: "destructive",
            });
            return;
          }
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          if (user.mustChangePassword) {
            navigate("/admin/change-password");
          } else {
            navigate("/admin");
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Invalid email or password.";
          toast({ title: "Sign in failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">AeroParts Marketplace — Restricted Access</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Sign in to continue</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Administrator credentials required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="pl-9 bg-background border-border"
                  placeholder="admin@aeroparts.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="pl-9 pr-10 bg-background border-border"
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2 gap-2"
              disabled={login.isPending}
            >
              <ShieldCheck className="w-4 h-4" />
              {login.isPending ? "Authenticating…" : "Sign In to Admin Portal"}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="bg-secondary/30 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Default credentials</p>
              <div className="space-y-0.5">
                <p className="font-mono text-xs text-white">admin@aeroparts.com</p>
                <p className="font-mono text-xs text-white">password</p>
              </div>
              <p className="text-xs text-amber-400 mt-2">You will be prompted to set a new password on first login.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Not an administrator?{" "}
          <a href="/seller/login" className="text-primary hover:underline">Seller sign in →</a>
        </p>
      </div>
    </div>
  );
}
