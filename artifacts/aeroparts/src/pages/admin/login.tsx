import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoginUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Eye, EyeOff, Lock, Mail, AlertTriangle, Clock,
} from "lucide-react";

function LockoutBanner({ lockedUntil }: { lockedUntil: Date }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const secs = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      setRemaining(secs);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = remaining > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : "Unlocking…";

  return (
    <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 flex items-start gap-3">
      <Lock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-400 mb-0.5">Account Locked</p>
        <p className="text-xs text-red-300/80">
          Too many failed attempts. Try again in{" "}
          <span className="font-mono font-bold text-red-300">{display}</span>
        </p>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [attemptsWarning, setAttemptsWarning] = useState<string | null>(null);

  const login = useLoginUser();

  const isLocked = lockedUntil !== null && lockedUntil > new Date();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setAttemptsWarning(null);
    login.mutate(
      { data: form },
      {
        onSuccess: (data) => {
          const user = data.user;
          if (user.computedRole !== "admin") {
            toast({
              title: "Access denied",
              description: "This portal is for administrators only.",
              variant: "destructive",
            });
            return;
          }
          setLockedUntil(null);
          setAttemptsWarning(null);
          // Full page navigation so the browser sends the session cookie on mount.
          if (user.mustChangePassword) {
            window.location.href = "/admin/change-password";
          } else {
            window.location.href = "/admin";
          }
        },
        onError: (err: any) => {
          const data = err?.response?.data ?? {};
          const msg: string = data.error ?? "Invalid email or password.";

          if (data.lockedUntil) {
            setLockedUntil(new Date(data.lockedUntil));
            setAttemptsWarning(null);
          } else if (msg.includes("attempt")) {
            setAttemptsWarning(msg);
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Subtle grid */}
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
          <p className="text-sm text-muted-foreground mt-1">Parts Link Aviation — Restricted Access</p>
        </div>

        {/* Session notice */}
        <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-lg px-3 py-2 mb-4">
          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sessions expire after <span className="text-white font-medium">30 minutes</span> of inactivity
          </p>
        </div>

        {/* Lockout banner */}
        {isLocked && lockedUntil && (
          <div className="mb-4">
            <LockoutBanner lockedUntil={lockedUntil} />
          </div>
        )}

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
                  disabled={isLocked}
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
                  disabled={isLocked}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  disabled={isLocked}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Attempts warning inline */}
              {attemptsWarning && !isLocked && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-400">{attemptsWarning}</p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-2 gap-2"
              disabled={login.isPending || isLocked}
            >
              {isLocked
                ? <><Lock className="w-4 h-4" /> Account Locked</>
                : login.isPending
                  ? "Authenticating…"
                  : <><ShieldCheck className="w-4 h-4" /> Sign In to Admin Portal</>
              }
            </Button>
          </form>

          {/* Security info */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span>bcrypt password hashing</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>Locks after 5 failures</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>30 min session timeout</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-3 h-3 flex-shrink-0" />
              <span>Force reset on first login</span>
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
