import { useState } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRegisterUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type AccountType = "seller" | "buyer";

export default function Register() {
  const { toast } = useToast();
  const [accountType, setAccountType] = useState<AccountType>("seller");
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", password: "", phone: "", country: "",
  });

  const register = useRegisterUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      email: form.email,
      password: form.password,
      contactName: form.contactName,
      role: accountType,
      phone: form.phone || null,
      country: form.country || null,
      ...(accountType === "seller" && { companyName: form.companyName }),
    };
    register.mutate(
      { data },
      {
        onSuccess: () => {
          const msg = accountType === "buyer"
            ? "Welcome to AeroParts. Redirecting to the marketplace..."
            : "Welcome to AeroParts. Redirecting to your dashboard...";
          toast({ title: "Account created", description: msg });
          window.location.href = accountType === "buyer" ? "/marketplace" : "/seller/dashboard";
        },
        onError: () => {
          toast({
            title: "Registration failed",
            description: "That email may already be registered.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <div className="bg-card border border-border rounded-md p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-muted-foreground text-sm">
              One account, one email — switch between buyer and seller roles anytime.
            </p>
          </div>

          {/* Account type selector */}
          <div className="mb-6 p-1 bg-muted/30 rounded-md flex gap-1">
            <button
              type="button"
              onClick={() => setAccountType("seller")}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                accountType === "seller"
                  ? "bg-card text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Register as Seller
            </button>
            <button
              type="button"
              onClick={() => setAccountType("buyer")}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                accountType === "buyer"
                  ? "bg-card text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Register as Buyer
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-5">
            {accountType === "seller"
              ? "List certified aircraft components to a global buyer network."
              : "Browse parts, send RFQs, and contact verified sellers directly."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {accountType === "seller" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Company Name *
                </label>
                <Input
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Aviation Technologies Inc."
                  required={accountType === "seller"}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {accountType === "seller" ? "Contact Name *" : "Full Name *"}
              </label>
              <Input
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="John Smith"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email Address *
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Password *
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Phone
                </label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1-555-000-0000"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Country
                </label>
                <Input
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="US"
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={register.isPending}>
              {register.isPending
                ? "Creating Account..."
                : accountType === "buyer"
                  ? "Create Buyer Account"
                  : "Create Seller Account"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/seller/login" className="text-primary hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
