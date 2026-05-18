import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRegisterUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function SellerRegister() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", password: "", phone: "", country: ""
  });

  const register = useRegisterUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(
      { data: { ...form, phone: form.phone || null, country: form.country || null } },
      {
        onSuccess: (data) => {
          toast({ title: "Account created", description: "Welcome to AeroParts. Redirecting to your dashboard..." });
          // Write user directly into cache so dashboard sees auth immediately.
          queryClient.setQueryData(getGetCurrentUserQueryKey(), data.user);
          navigate("/seller/dashboard");
        },
        onError: () => {
          toast({ title: "Registration failed", description: "That email may already be registered.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <div className="bg-card border border-border rounded-md p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create Seller Account</h1>
            <p className="text-muted-foreground text-sm">
              Join AeroParts to list your certified aircraft components to a global buyer network.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Company Name *</label>
              <Input
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="Aviation Technologies Inc."
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Contact Name *</label>
              <Input
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="John Smith"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Email Address *</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Password *</label>
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1-555-000-0000"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Country</label>
                <Input
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="US"
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={register.isPending}>
              {register.isPending ? "Creating Account..." : "Create Account"}
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
