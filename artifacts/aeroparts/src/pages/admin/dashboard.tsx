import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  useGetAdminListings, getGetAdminListingsQueryKey,
  useGetAdminStats, getGetAdminStatsQueryKey,
  useUpdateListingBadge, useAdminRemoveListing,
  useGetAdminMroProfiles, getGetAdminMroProfilesQueryKey,
  useAdminSetMroStatus,
  useGetAdminSellers, getGetAdminSellersQueryKey,
  useAdminSetSellerStatus, useAdminSetSellerPlan,
  useGetRfqs,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, Package, ShieldCheck, CreditCard, Wrench,
  MessageSquare, AlertTriangle, ChevronRight, LogOut, ShieldAlert,
  ExternalLink, CheckCircle2, XCircle, MapPin, Clock, TrendingUp,
  Building2, Mail, Phone, Globe, Star, AlertCircle, Search,
  ArrowUpDown, Lock, Unlock, FileText
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtPrice(n: number | null) {
  if (n == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  free:       { label: "Free",       color: "text-muted-foreground", bg: "bg-secondary/40 border border-border" },
  pro:        { label: "Pro",        color: "text-primary",          bg: "bg-primary/10 border border-primary/30" },
  enterprise: { label: "Enterprise", color: "text-amber-400",        bg: "bg-amber-500/10 border border-amber-500/30" },
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",    color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
  suspended: { label: "Suspended", color: "text-red-400",     bg: "bg-red-500/10 border border-red-500/20" },
  pending:   { label: "Pending",   color: "text-amber-400",   bg: "bg-amber-500/10 border border-amber-500/20" },
};
const BADGE_META: Record<string, { label: string; color: string }> = {
  pending_verification:   { label: "Pending",       color: "text-amber-400" },
  documentation_reviewed: { label: "Docs Reviewed", color: "text-blue-400" },
  verified:               { label: "Verified",      color: "text-emerald-400" },
};

// ─── navigation ─────────────────────────────────────────────────────────────

type Section = "overview" | "sellers" | "listings" | "certifications" | "subscriptions" | "mro" | "rfqs" | "disputes";

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",        label: "Overview",          icon: LayoutDashboard },
  { id: "sellers",         label: "Seller Management", icon: Users },
  { id: "listings",        label: "Listing Review",    icon: Package },
  { id: "certifications",  label: "Certification Review", icon: ShieldCheck },
  { id: "subscriptions",   label: "Subscriptions",     icon: CreditCard },
  { id: "mro",             label: "MRO Management",    icon: Wrench },
  { id: "rfqs",            label: "RFQ Monitoring",    icon: MessageSquare },
  { id: "disputes",        label: "Dispute Resolution",icon: AlertTriangle },
];

// ─── stat card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "text-white" }: {
  icon: React.ElementType; label: string; value?: number | null; sub?: string; color?: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      {value == null ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <>
          <p className={`text-3xl font-bold font-mono ${color}`}>{fmt(value)}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── section: overview ──────────────────────────────────────────────────────

function OverviewSection() {
  const { data: stats, isLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: rfqData } = useGetRfqs({ status: "open", limit: 1 });

  const statCards = [
    { icon: Package,      label: "Total Listings",    value: isLoading ? null : stats?.totalListings,       sub: `${stats?.pendingVerification ?? 0} pending review` },
    { icon: Users,        label: "Active Sellers",    value: isLoading ? null : stats?.activeSellers,       sub: `${stats?.suspendedSellers ?? 0} suspended`, color: "text-emerald-400" as const },
    { icon: MessageSquare,label: "Total Inquiries",   value: isLoading ? null : stats?.totalInquiries },
    { icon: ShieldCheck,  label: "Pending Verification", value: isLoading ? null : stats?.pendingVerification, color: stats?.pendingVerification ? "text-amber-400" as const : "text-white" as const },
    { icon: Wrench,       label: "MRO Providers",     value: isLoading ? null : stats?.totalMro },
    { icon: MessageSquare,label: "Open RFQs",         value: rfqData?.total == null ? null : rfqData.total },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Marketplace Overview</h2>
        <p className="text-sm text-muted-foreground">Real-time snapshot of AeroParts marketplace activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} color={c.color} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Review Pending Listings", section: "listings" as Section, icon: Package, badge: stats?.pendingVerification },
            { label: "Manage Sellers",          section: "sellers" as Section,  icon: Users },
            { label: "Check Certifications",    section: "certifications" as Section, icon: ShieldCheck },
            { label: "Monitor RFQs",            section: "rfqs" as Section, icon: MessageSquare },
          ].map(({ label, icon: Icon, badge }) => (
            <div key={label} className="relative border border-border rounded-md p-4 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer">
              <Icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm text-white font-medium leading-tight">{label}</p>
              {badge ? (
                <span className="absolute top-2 right-2 text-xs bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Subscription breakdown */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Subscription Breakdown</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { plan: "Free",       color: "text-muted-foreground", revenue: "$0" },
            { plan: "Pro",        color: "text-primary",          revenue: "$149/seat" },
            { plan: "Enterprise", color: "text-amber-400",        revenue: "$299/seat" },
          ].map(p => (
            <div key={p.plan} className="border border-border rounded-md p-4">
              <p className={`text-sm font-semibold ${p.color}`}>{p.plan}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.revenue}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── section: sellers ───────────────────────────────────────────────────────

function SellersSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const { data: sellers, isLoading } = useGetAdminSellers({ query: { queryKey: getGetAdminSellersQueryKey() } });
  const statusMutation = useAdminSetSellerStatus();
  const planMutation = useAdminSetSellerPlan();

  function handleStatus(id: number, status: "active" | "suspended", name: string) {
    statusMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: `Seller ${status === "suspended" ? "suspended" : "activated"}`, description: name });
      },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  }

  function handlePlan(id: number, plan: string) {
    planMutation.mutate({ id, data: { plan: plan as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        toast({ title: "Plan updated" });
      },
      onError: () => toast({ title: "Failed to update plan", variant: "destructive" }),
    });
  }

  const filtered = (sellers ?? []).filter(s => {
    const matchPlan = planFilter === "all" || s.plan === planFilter;
    const matchSearch = !search || s.companyName.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    return matchPlan && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Seller Management</h2>
          <p className="text-sm text-muted-foreground">View, approve, and suspend seller accounts.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search sellers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card border-border w-48" />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-8 text-xs w-32 bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No sellers found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-4">Company</th>
                  <th className="text-left p-4 hidden md:table-cell">Contact</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4 hidden lg:table-cell">Listings</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Change Plan</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(seller => {
                  const planMeta = PLAN_META[seller.plan] ?? PLAN_META.free;
                  const stMeta = STATUS_META[seller.status] ?? STATUS_META.active;
                  return (
                    <tr key={seller.id} className={`border-b border-border/50 hover:bg-secondary/10 transition-colors ${seller.status === "suspended" ? "opacity-60" : ""}`}>
                      <td className="p-4">
                        <p className="font-medium text-white">{seller.companyName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3" />{seller.country ?? "—"}
                        </p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{seller.email}</p>
                        {seller.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{seller.phone}</p>}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${planMeta.bg} ${planMeta.color}`}>{planMeta.label}</span>
                      </td>
                      <td className="p-4 hidden lg:table-cell font-mono text-white">{seller.activeListings}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${stMeta.bg} ${stMeta.color}`}>{stMeta.label}</span>
                      </td>
                      <td className="p-4">
                        <Select value={seller.plan} onValueChange={v => handlePlan(seller.id, v)} disabled={planMutation.isPending}>
                          <SelectTrigger className="h-7 text-xs w-32 bg-secondary/30 border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-right">
                        {seller.status === "suspended" ? (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                            onClick={() => handleStatus(seller.id, "active", seller.companyName)} disabled={statusMutation.isPending}>
                            <Unlock className="w-3 h-3" /> Activate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                            onClick={() => handleStatus(seller.id, "suspended", seller.companyName)} disabled={statusMutation.isPending}>
                            <Lock className="w-3 h-3" /> Suspend
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── section: listings ──────────────────────────────────────────────────────

function ListingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [badgeFilter, setBadgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryParams = {
    badge: badgeFilter !== "all" ? badgeFilter as any : undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  };
  const { data: listings, isLoading } = useGetAdminListings(queryParams, { query: { queryKey: getGetAdminListingsQueryKey(queryParams) } });
  const badgeMutation = useUpdateListingBadge();
  const removeMutation = useAdminRemoveListing();

  function handleBadge(id: number, badge: string) {
    badgeMutation.mutate({ id, data: { badge: badge as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(queryParams) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Badge updated", description: badge.replace(/_/g, " ") });
      },
    });
  }

  function handleRemove(id: number, partNumber: string) {
    if (!confirm(`Remove listing ${partNumber}?`)) return;
    removeMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(queryParams) });
        toast({ title: "Listing removed", description: partNumber });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Listing Review Queue</h2>
          <p className="text-sm text-muted-foreground">Approve, reject, and badge parts listings.</p>
        </div>
        <div className="flex gap-2">
          <Select value={badgeFilter} onValueChange={setBadgeFilter}>
            <SelectTrigger className="h-8 text-xs w-40 bg-card border-border"><SelectValue placeholder="All Badges" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Badges</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="documentation_reviewed">Docs Reviewed</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-32 bg-card border-border"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : listings?.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No listings match the filters.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-4">Part Number</th>
                  <th className="text-left p-4 hidden md:table-cell">Seller</th>
                  <th className="text-left p-4 hidden lg:table-cell">Condition</th>
                  <th className="text-left p-4 hidden lg:table-cell">Price</th>
                  <th className="text-left p-4">Badge</th>
                  <th className="text-left p-4">Set Badge</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings?.map(listing => (
                  <tr key={listing.id} className={`border-b border-border/50 hover:bg-secondary/10 transition-colors ${listing.status === "removed" ? "opacity-40" : ""}`}>
                    <td className="p-4">
                      <Link href={`/listings/${listing.id}`}>
                        <span className="font-mono text-primary hover:underline cursor-pointer flex items-center gap-1 text-xs">
                          {listing.partNumber}<ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                      {listing.status === "removed" && <span className="text-xs text-destructive">(removed)</span>}
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground text-xs">{listing.seller?.companyName ?? "—"}</td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{formatCondition(listing.condition)}</td>
                    <td className="p-4 hidden lg:table-cell font-mono text-white text-xs">{fmtPrice(listing.price)}</td>
                    <td className="p-4"><BadgeIndicator badge={listing.badge} /></td>
                    <td className="p-4">
                      {listing.status !== "removed" && (
                        <Select value={listing.badge} onValueChange={v => handleBadge(listing.id, v)} disabled={badgeMutation.isPending}>
                          <SelectTrigger className="h-7 text-xs w-36 bg-secondary/30 border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending_verification">Pending</SelectItem>
                            <SelectItem value="documentation_reviewed">Docs Reviewed</SelectItem>
                            <SelectItem value="verified">Verified</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {listing.status !== "removed" && (
                        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive h-7"
                          onClick={() => handleRemove(listing.id, listing.partNumber)} disabled={removeMutation.isPending}>
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── section: certifications ────────────────────────────────────────────────

function CertificationsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const qp = { badge: "pending_verification" as any };
  const { data: listings, isLoading } = useGetAdminListings(qp, { query: { queryKey: getGetAdminListingsQueryKey(qp) } });
  const badgeMutation = useUpdateListingBadge();

  function handleApprove(id: number, partNumber: string) {
    badgeMutation.mutate({ id, data: { badge: "documentation_reviewed" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(qp) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Documentation approved", description: partNumber });
      },
    });
  }

  function handleVerify(id: number, partNumber: string) {
    badgeMutation.mutate({ id, data: { badge: "verified" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(qp) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Listing fully verified", description: partNumber });
      },
    });
  }

  const withDocs = (listings ?? []).filter(l => l.certificationDocs && l.certificationDocs.length > 0);
  const withoutDocs = (listings ?? []).filter(l => !l.certificationDocs || l.certificationDocs.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Certification Review Center</h2>
        <p className="text-sm text-muted-foreground">Review uploaded documentation and approve or reject certifications.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pending Review</p>
          <p className="text-2xl font-bold font-mono text-amber-400">{isLoading ? "—" : listings?.length ?? 0}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Has Documents</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{isLoading ? "—" : withDocs.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Awaiting Docs</p>
          <p className="text-2xl font-bold font-mono text-muted-foreground">{isLoading ? "—" : withoutDocs.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : listings?.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center bg-card">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
          <p className="text-white font-medium">All certifications reviewed</p>
          <p className="text-sm text-muted-foreground mt-1">No listings pending certification review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings?.map(listing => (
            <div key={listing.id} className="border border-border rounded-lg p-5 bg-card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link href={`/listings/${listing.id}`}>
                      <span className="font-mono text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1">
                        {listing.partNumber}<ExternalLink className="h-3 w-3" />
                      </span>
                    </Link>
                    <BadgeIndicator badge={listing.badge} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{listing.seller?.companyName ?? "Unknown Seller"} · {formatCondition(listing.condition)}</p>

                  {listing.certificationDocs && listing.certificationDocs.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {listing.certificationDocs.map((doc: string, i: number) => (
                        <a key={i} href={doc} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded px-2.5 py-1 hover:bg-primary/10 transition-colors">
                          <FileText className="w-3 h-3" />
                          Document {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" />No documents uploaded yet
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/admin/review-cert/${listing.id}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border text-muted-foreground hover:text-white gap-1">
                      <FileText className="w-3 h-3" /> Review
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-1"
                    onClick={() => handleApprove(listing.id, listing.partNumber)} disabled={badgeMutation.isPending}>
                    <CheckCircle2 className="w-3 h-3" /> Approve Docs
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                    onClick={() => handleVerify(listing.id, listing.partNumber)} disabled={badgeMutation.isPending}>
                    <ShieldCheck className="w-3 h-3" /> Full Verify
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── section: subscriptions ─────────────────────────────────────────────────

function SubscriptionsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sellers, isLoading } = useGetAdminSellers({ query: { queryKey: getGetAdminSellersQueryKey() } });
  const planMutation = useAdminSetSellerPlan();

  function handlePlan(id: number, plan: string, company: string) {
    planMutation.mutate({ id, data: { plan: plan as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        toast({ title: "Plan updated", description: `${company} → ${plan}` });
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  const grouped = { free: [] as any[], pro: [] as any[], enterprise: [] as any[] };
  (sellers ?? []).forEach(s => { if (grouped[s.plan as keyof typeof grouped]) grouped[s.plan as keyof typeof grouped].push(s); });

  const MRO_TIERS = [
    { name: "Free MRO",     price: "$0",      seats: grouped.free.length,       color: "text-muted-foreground" },
    { name: "Verified MRO", price: "$49/mo",  seats: grouped.pro.length,        color: "text-primary" },
    { name: "Premium MRO",  price: "$149/mo", seats: grouped.enterprise.length, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Subscription Management</h2>
        <p className="text-sm text-muted-foreground">View active plans, manage upgrades, and track subscription status.</p>
      </div>

      {/* Plan overview */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { plan: "Free",       count: grouped.free.length,       revenue: "$0/mo",      color: "text-muted-foreground", bg: "border-border" },
          { plan: "Pro",        count: grouped.pro.length,        revenue: `$${grouped.pro.length * 149}/mo`,        color: "text-primary",    bg: "border-primary/30" },
          { plan: "Enterprise", count: grouped.enterprise.length, revenue: `$${grouped.enterprise.length * 299}/mo`, color: "text-amber-400",  bg: "border-amber-500/30" },
        ].map(p => (
          <div key={p.plan} className={`border rounded-lg p-5 bg-card ${p.bg}`}>
            <p className={`text-sm font-semibold ${p.color} mb-1`}>{p.plan}</p>
            <p className="text-2xl font-bold font-mono text-white">{isLoading ? "—" : p.count}</p>
            <p className="text-xs text-muted-foreground mt-1">{isLoading ? "—" : p.revenue} est. revenue</p>
          </div>
        ))}
      </div>

      {/* Seller plan table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">All Seller Subscriptions</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-4">Company</th>
                  <th className="text-left p-4">Current Plan</th>
                  <th className="text-left p-4 hidden md:table-cell">Expires</th>
                  <th className="text-left p-4 hidden lg:table-cell">Active Listings</th>
                  <th className="text-left p-4">Change Plan</th>
                </tr>
              </thead>
              <tbody>
                {(sellers ?? []).map(seller => {
                  const planMeta = PLAN_META[seller.plan] ?? PLAN_META.free;
                  return (
                    <tr key={seller.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-white text-sm">{seller.companyName}</p>
                        <p className="text-xs text-muted-foreground">{seller.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${planMeta.bg} ${planMeta.color}`}>{planMeta.label}</span>
                      </td>
                      <td className="p-4 hidden md:table-cell text-xs text-muted-foreground">
                        {seller.planExpiresAt ? new Date(seller.planExpiresAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-4 hidden lg:table-cell font-mono text-white text-xs">{seller.activeListings}</td>
                      <td className="p-4">
                        <Select value={seller.plan} onValueChange={v => handlePlan(seller.id, v, seller.companyName)} disabled={planMutation.isPending}>
                          <SelectTrigger className="h-7 text-xs w-32 bg-secondary/30 border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── section: MRO ───────────────────────────────────────────────────────────

function MroSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: mroData, isLoading } = useGetAdminMroProfiles({ query: { queryKey: getGetAdminMroProfilesQueryKey() } });
  const statusMutation = useAdminSetMroStatus();

  function handleStatus(id: number, status: "active" | "pending" | "suspended") {
    statusMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminMroProfilesQueryKey() });
        toast({ title: "MRO status updated", description: `Set to ${status}` });
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">MRO Management</h2>
        <p className="text-sm text-muted-foreground">Approve, activate, and suspend MRO service providers.</p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Registered MRO Providers</h3>
          <span className="text-xs text-muted-foreground">{mroData?.total ?? 0} total</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : !mroData?.profiles.length ? (
          <div className="p-12 text-center text-muted-foreground"><Wrench className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No MRO providers registered.</p></div>
        ) : (
          <div className="divide-y divide-border/50">
            {mroData.profiles.map(mro => {
              const stMeta = STATUS_META[mro.status] ?? STATUS_META.active;
              return (
                <div key={mro.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/10 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/mro/${mro.id}`}>
                          <span className="font-medium text-white hover:text-primary cursor-pointer">{mro.companyName}</span>
                        </Link>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${stMeta.bg} ${stMeta.color}`}>{stMeta.label}</span>
                        {mro.featured && <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5"><Star className="w-2.5 h-2.5 inline mr-0.5" />Featured</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[mro.city, mro.country].filter(Boolean).join(", ")}</span>
                        <span>{mro.serviceTypes.length} services</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{mro.contactEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-12 sm:ml-0 flex-shrink-0">
                    {mro.status !== "active" && (
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                        onClick={() => handleStatus(mro.id, "active")} disabled={statusMutation.isPending}>
                        <CheckCircle2 className="w-3 h-3" /> Activate
                      </Button>
                    )}
                    {mro.status !== "suspended" && (
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                        onClick={() => handleStatus(mro.id, "suspended")} disabled={statusMutation.isPending}>
                        <XCircle className="w-3 h-3" /> Suspend
                      </Button>
                    )}
                    <Link href={`/mro/${mro.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7 border-border text-muted-foreground hover:text-white gap-1">
                        <ExternalLink className="w-3 h-3" /> View
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── section: RFQs ──────────────────────────────────────────────────────────

function RfqsSection() {
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | undefined>("open");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetRfqs({ status: statusFilter, q: search || undefined, limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">RFQ Monitoring</h2>
          <p className="text-sm text-muted-foreground">Track RFQ activity across the marketplace.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search part…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card border-border w-40" />
          </div>
          {(["open", "closed", undefined] as const).map(s => (
            <Button key={String(s)} variant={statusFilter === s ? "default" : "outline"} size="sm" className={`h-8 text-xs ${statusFilter !== s ? "border-border text-muted-foreground hover:text-white" : ""}`}
              onClick={() => setStatusFilter(s)}>
              {s === undefined ? "All" : s === "open" ? "Open" : "Closed"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Showing</p>
          <p className="text-2xl font-bold font-mono text-white">{isLoading ? "—" : data?.total ?? 0}</p>
        </div>
        <div className="border border-emerald-500/20 rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Status Filter</p>
          <p className="text-sm font-semibold text-emerald-400 capitalize">{statusFilter ?? "All"}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Responses</p>
          <p className="text-2xl font-bold font-mono text-white">—</p>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : data?.rfqs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No RFQs found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-4">Part Number</th>
                  <th className="text-left p-4 hidden md:table-cell">Buyer</th>
                  <th className="text-left p-4 hidden lg:table-cell">Aircraft</th>
                  <th className="text-left p-4">Qty</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4 hidden md:table-cell">Posted</th>
                  <th className="text-right p-4">View</th>
                </tr>
              </thead>
              <tbody>
                {data?.rfqs.map(rfq => (
                  <tr key={rfq.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                    <td className="p-4 font-mono text-primary text-xs">{rfq.partNumber}</td>
                    <td className="p-4 hidden md:table-cell text-xs text-muted-foreground">{rfq.buyerCompany ?? rfq.buyerName}</td>
                    <td className="p-4 hidden lg:table-cell text-xs text-muted-foreground">{rfq.aircraftApplicability ?? "—"}</td>
                    <td className="p-4 text-xs font-mono text-white">{rfq.quantity}</td>
                    <td className="p-4">
                      <Badge className={rfq.status === "open" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs" : "bg-muted text-muted-foreground text-xs"}>
                        {rfq.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-4 hidden md:table-cell text-xs text-muted-foreground">{timeAgo(rfq.createdAt)}</td>
                    <td className="p-4 text-right">
                      <Link href={`/rfqs/${rfq.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-muted-foreground hover:text-white">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── section: disputes ──────────────────────────────────────────────────────

function DisputesSection() {
  const MOCK_DISPUTES = [
    { id: 1, type: "Listing Fraud",       reporter: "Gulf Air Procurement",   target: "Unknown Vendor",          status: "open",     priority: "high",   date: "2026-05-15", description: "Part number does not match documentation provided." },
    { id: 2, type: "Non-Delivery",        reporter: "Iberia MRO",             target: "FastParts International", status: "reviewing",priority: "high",   date: "2026-05-13", description: "Payment made but parts not received after 30 days." },
    { id: 3, type: "Condition Mismatch",  reporter: "AirAsia Engineering",    target: "Pacific Components Ltd",  status: "resolved", priority: "medium", date: "2026-05-10", description: "Part listed as Serviceable delivered As Removed." },
    { id: 4, type: "Cert Discrepancy",    reporter: "Turkish Technics",       target: "EuroTech Supply",         status: "open",     priority: "medium", date: "2026-05-09", description: "FAA 8130 certificate serial number does not match part." },
    { id: 5, type: "Pricing Dispute",     reporter: "Ryanair Technical",      target: "Apex Components",         status: "reviewing",priority: "low",    date: "2026-05-07", description: "Invoice price exceeds agreed quote by 35%." },
  ];

  const [filter, setFilter] = useState("all");
  const [toasts, setToasts] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const filtered = MOCK_DISPUTES.filter(d => filter === "all" || d.status === filter);

  const PRIORITY_META: Record<string, string> = {
    high:   "text-red-400 bg-red-500/10 border border-red-500/20",
    medium: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
    low:    "text-muted-foreground bg-secondary/40 border border-border",
  };
  const DISPUTE_STATUS_META: Record<string, string> = {
    open:      "text-red-400 bg-red-500/10 border border-red-500/20",
    reviewing: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
    resolved:  "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
  };

  function handleAction(id: number, action: string) {
    setToasts(t => ({ ...t, [id]: action }));
    toast({ title: `Dispute ${action}`, description: `Case #${id} marked as ${action}` });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Dispute Resolution</h2>
          <p className="text-sm text-muted-foreground">Manage complaints, fraud reports, and seller-buyer disputes.</p>
        </div>
        <div className="flex gap-2">
          {(["all", "open", "reviewing", "resolved"] as const).map(s => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm"
              className={`h-8 text-xs capitalize ${filter !== s ? "border-border text-muted-foreground hover:text-white" : ""}`}
              onClick={() => setFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",      count: MOCK_DISPUTES.filter(d => d.status === "open").length,      color: "text-red-400" },
          { label: "Reviewing", count: MOCK_DISPUTES.filter(d => d.status === "reviewing").length, color: "text-amber-400" },
          { label: "Resolved",  count: MOCK_DISPUTES.filter(d => d.status === "resolved").length,  color: "text-emerald-400" },
        ].map(c => (
          <div key={c.label} className="border border-border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{c.label}</p>
            <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.count}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(dispute => (
          <div key={dispute.id} className="border border-border rounded-lg p-5 bg-card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground">#{dispute.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_META[dispute.priority]}`}>{dispute.priority.toUpperCase()}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${DISPUTE_STATUS_META[dispute.status]}`}>{dispute.status}</span>
                  <span className="text-xs font-semibold text-white">{dispute.type}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{dispute.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span>Reporter: <span className="text-white">{dispute.reporter}</span></span>
                  <span>Against: <span className="text-white">{dispute.target}</span></span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(dispute.date)}</span>
                </div>
              </div>
              {dispute.status !== "resolved" && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {dispute.status === "open" && (
                    <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1"
                      onClick={() => handleAction(dispute.id, "reviewing")}>
                      <ArrowUpDown className="w-3 h-3" /> Review
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                    onClick={() => handleAction(dispute.id, "resolved")}>
                    <CheckCircle2 className="w-3 h-3" /> Resolve
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
                    onClick={() => handleAction(dispute.id, "escalated")}>
                    <AlertTriangle className="w-3 h-3" /> Escalate
                  </Button>
                </div>
              )}
              {dispute.status === "resolved" && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main admin shell ────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });

  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && user?.mustChangePassword) {
      navigate("/admin/change-password");
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm w-full mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-destructive/60" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground text-sm mb-6">This area is restricted to AeroParts administrators only.</p>
          <Link href="/admin/login">
            <Button className="w-full mb-3">Sign In to Admin Portal</Button>
          </Link>
          <p className="text-xs text-muted-foreground">Use <span className="font-mono">admin@aeroparts.com</span> / <span className="font-mono">password</span></p>
        </div>
      </div>
    );
  }

  const SECTION_BADGES: Partial<Record<Section, number | undefined>> = {
    listings:       stats?.pendingVerification,
    certifications: stats?.pendingVerification,
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card/50 flex flex-col hidden lg:flex">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <Link href="/">
            <span className="text-lg font-bold text-white tracking-tight">AeroParts</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">Admin Portal</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const badge = SECTION_BADGES[id];
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all text-left ${
                  active ? "bg-primary/15 text-white border border-primary/20" : "text-muted-foreground hover:text-white hover:bg-secondary/40"
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className="text-xs bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0 leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {user.companyName?.[0] ?? "A"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.companyName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-xs text-muted-foreground hover:text-white gap-2 h-7">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white">
              {NAV.find(n => n.id === section)?.label ?? "Admin"}
            </h1>
            <p className="text-xs text-muted-foreground">AeroParts Admin Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs border-border text-muted-foreground hover:text-white gap-1.5 h-8">
                <ExternalLink className="w-3.5 h-3.5" /> View Site
              </Button>
            </Link>
            {/* Mobile nav */}
            <div className="lg:hidden flex gap-1 flex-wrap">
              {NAV.map(({ id, icon: Icon }) => (
                <Button key={id} variant={section === id ? "default" : "ghost"} size="sm"
                  className="h-7 w-7 p-0" onClick={() => setSection(id)}>
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 overflow-y-auto p-6">
          {section === "overview"       && <OverviewSection />}
          {section === "sellers"        && <SellersSection />}
          {section === "listings"       && <ListingsSection />}
          {section === "certifications" && <CertificationsSection />}
          {section === "subscriptions"  && <SubscriptionsSection />}
          {section === "mro"            && <MroSection />}
          {section === "rfqs"           && <RfqsSection />}
          {section === "disputes"       && <DisputesSection />}
        </main>
      </div>
    </div>
  );
}
