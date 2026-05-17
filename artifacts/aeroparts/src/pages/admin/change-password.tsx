import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { ShieldCheck, Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-emerald-400" : "text-muted-foreground"}`}>
      {met ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label}
    </div>
  );
}

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const pw = form.newPassword;
  const rules = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    match:     pw.length > 0 && pw === form.confirmPassword,
  };
  const allMet = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;

    setIsPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to change password");
      }

      toast({ title: "Password updated", description: "Your new password is now active." });
      // Invalidate the current user cache so mustChangePassword is refreshed
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      navigate("/admin");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set Your Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Security requirement — first login password change</p>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-5 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            You are signed in with the default admin password. You must set a new secure password before accessing the admin portal.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className="pl-9 pr-10 bg-background border-border"
                  placeholder="Current password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setShowCurrent(s => !s)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showNew ? "text" : "password"}
                  value={form.newPassword}
                  onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="pl-9 pr-10 bg-background border-border"
                  placeholder="New secure password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setShowNew(s => !s)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Rules */}
              {pw.length > 0 && (
                <div className="mt-2 space-y-1">
                  <PasswordRule met={rules.length}    label="At least 8 characters" />
                  <PasswordRule met={rules.uppercase} label="One uppercase letter" />
                  <PasswordRule met={rules.number}    label="One number" />
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className={`pl-9 bg-background border-border ${form.confirmPassword && !rules.match ? "border-destructive/50 focus-visible:ring-destructive/30" : ""}`}
                  placeholder="Repeat new password"
                  required
                  autoComplete="new-password"
                />
              </div>
              {form.confirmPassword && !rules.match && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-2 gap-2"
              disabled={isPending || !allMet}
            >
              <ShieldCheck className="w-4 h-4" />
              {isPending ? "Updating…" : "Set New Password & Continue"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          AeroParts Admin Portal · Secure Access
        </p>
      </div>
    </div>
  );
}
