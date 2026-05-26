import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useGetAdminListings, getGetAdminListingsQueryKey,
  useGetAdminStats, getGetAdminStatsQueryKey,
  useUpdateListingBadge, useAdminRemoveListing,
  useGetAdminMroProfiles, getGetAdminMroProfilesQueryKey,
  useAdminSetMroStatus,
  useGetAdminSellers, getGetAdminSellersQueryKey,
  useAdminSetSellerStatus, useAdminSetSellerPlan,
  useGetRfqs,
  useGetAdminRfqs, getGetAdminRfqsQueryKey,
  useAdminRfqAction,
  useAdminSetRfqUrgency,
  useGetAdminRfqAudit, getGetAdminRfqAuditQueryKey,
  useGetAdminInventory, getGetAdminInventoryQueryKey,
  useCreateAdminInventoryListing,
  useUpdateAdminInventoryListing,
  useDeleteAdminInventoryListing,
  useSuspendAdminInventoryListing,
  useRestoreAdminInventoryListing,
  useFeatureAdminInventoryListing,
  useGetAdminInventoryAudit,
  useGetAdminFraudScan, getGetAdminFraudScanQueryKey,
  useAdminAutoSuspendHighRisk,
  useAdminSuspendSellerIntelligence,
  useGetAdminRfqPredictions, getGetAdminRfqPredictionsQueryKey,
  useGetAdminDemandReport, getGetAdminDemandReportQueryKey,
  useGetAdminVendorVerifications, getGetAdminVendorVerificationsQueryKey,
  useAdminApproveVendorVerification,
  useAdminRejectVendorVerification,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, Package, ShieldCheck, CreditCard, Wrench,
  MessageSquare, AlertTriangle, ChevronRight, LogOut, ShieldAlert,
  ExternalLink, CheckCircle2, XCircle, MapPin, Clock, TrendingUp,
  Building2, Mail, Phone, Globe, Star, AlertCircle, Search,
  ArrowUpDown, Lock, Unlock, FileText, BarChart2, Trophy, Loader2,
  ChevronDown, MoreVertical, History,
  Boxes, Plus, Pencil, Trash2, Ban, RefreshCw, ChevronLeft, ChevronRight as ChevronRightIcon,
  Brain, ShieldX, Zap, Activity, Radar, TrendingDown, CircleDot, FlameKindling,
  BadgeCheck, UserX, FileCheck, Store,
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

type Section = "overview" | "sellers" | "listings" | "certifications" | "billing" | "mro" | "rfqs" | "trust" | "analytics" | "disputes" | "inventory" | "intelligence" | "vendors";

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",        label: "Overview",               icon: LayoutDashboard },
  { id: "inventory",       label: "Inventory Management",   icon: Boxes },
  { id: "sellers",         label: "Seller Management",      icon: Users },
  { id: "listings",        label: "Listing Review",         icon: Package },
  { id: "certifications",  label: "Certification Review",   icon: ShieldCheck },
  { id: "billing",         label: "Billing & Subscriptions",icon: CreditCard },
  { id: "mro",             label: "MRO Management",         icon: Wrench },
  { id: "rfqs",            label: "RFQ Monitoring",         icon: MessageSquare },
  { id: "trust",           label: "Trust Scores",           icon: Trophy },
  { id: "analytics",       label: "Platform Analytics",     icon: BarChart2 },
  { id: "disputes",        label: "Dispute Resolution",     icon: AlertTriangle },
  { id: "intelligence",    label: "Market Intelligence",    icon: Brain },
  { id: "vendors",         label: "Vendor Verification",    icon: ShieldCheck },
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
  const [, navigate] = useLocation();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  function handleQuickAction(href: string, label: string) {
    if (navigatingTo) return;
    setNavigatingTo(label);
    navigate(href);
  }

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
        <p className="text-sm text-muted-foreground">Real-time snapshot of Parts Link Aviation marketplace activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} color={c.color} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: "Review Certifications",      href: "/admin/certifications", icon: ShieldCheck, badge: stats?.pendingVerification },
            { label: "Manage Sellers",             href: "/admin/sellers",        icon: Users },
            { label: "Review RFQs",                href: "/admin/rfqs",           icon: MessageSquare },
            { label: "Manage MRO Providers",       href: "/admin/mro",            icon: Wrench },
            { label: "Billing & Subscriptions",    href: "/admin/billing",        icon: CreditCard },
            { label: "Trust Scores / Leaderboard", href: "/admin/trust",          icon: Trophy },
            { label: "Platform Analytics",         href: "/admin/analytics",      icon: BarChart2 },
          ].map(({ label, icon: Icon, badge, href }) => {
            const loading = navigatingTo === label;
            const busy = navigatingTo !== null;
            return (
              <button
                key={label}
                onClick={() => handleQuickAction(href, label)}
                disabled={busy}
                className={[
                  "group relative w-full text-left rounded-md p-4 border transition-all duration-150 select-none outline-none",
                  "focus-visible:ring-2 focus-visible:ring-primary/50",
                  loading
                    ? "border-primary/50 bg-primary/10 scale-[0.97] cursor-wait"
                    : busy
                    ? "border-border bg-card/50 opacity-50 cursor-not-allowed"
                    : "border-border bg-card/50 cursor-pointer hover:bg-card/90 hover:border-primary/40 hover:scale-[1.02] hover:shadow-md hover:shadow-primary/10 active:scale-[0.97] active:bg-card/60 active:border-primary/60",
                ].join(" ")}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 text-primary mb-2 animate-spin" />
                ) : (
                  <Icon className={`w-5 h-5 mb-2 transition-colors duration-150 ${busy ? "text-muted-foreground" : "text-primary group-hover:text-primary/80"}`} />
                )}
                <p className={`text-sm font-medium leading-tight transition-colors duration-150 ${loading ? "text-primary" : busy ? "text-muted-foreground" : "text-white"}`}>
                  {label}
                </p>
                {badge && !loading ? (
                  <span className="absolute top-2 right-2 text-xs bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subscription breakdown */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Subscription Breakdown</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { plan: "Free",       color: "text-muted-foreground", revenue: "$0" },
            { plan: "Pro",        color: "text-primary",          revenue: "$29/seat" },
            { plan: "Enterprise", color: "text-amber-400",        revenue: "$99/seat" },
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
    { name: "Free MRO",      price: "$0",     seats: grouped.free.length,       color: "text-muted-foreground" },
    { name: "MRO Provider",  price: "$10/mo", seats: grouped.pro.length,        color: "text-primary" },
    { name: "Premium MRO",   price: "$149/mo (legacy)", seats: grouped.enterprise.length, color: "text-amber-400" },
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
          { plan: "Pro",        count: grouped.pro.length,        revenue: `$${grouped.pro.length * 29}/mo`,        color: "text-primary",    bg: "border-primary/30" },
          { plan: "Enterprise", count: grouped.enterprise.length, revenue: `$${grouped.enterprise.length * 99}/mo`, color: "text-amber-400",  bg: "border-amber-500/30" },
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

// ─── RFQ status display helpers ──────────────────────────────────────────────

const RFQ_STATUS_META: Record<string, { label: string; className: string }> = {
  open:      { label: "OPEN",      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  closed:    { label: "CLOSED",    className: "bg-muted text-muted-foreground border-border" },
  archived:  { label: "ARCHIVED",  className: "bg-secondary/60 text-muted-foreground border-border" },
  suspended: { label: "SUSPENDED", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  deleted:   { label: "DELETED",   className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

// Actions available per status
const RFQ_ACTIONS: Record<string, Array<{ action: string; label: string; danger?: boolean }>> = {
  open:      [
    { action: "close",   label: "Close RFQ" },
    { action: "suspend", label: "Suspend RFQ" },
    { action: "archive", label: "Archive RFQ" },
    { action: "delete",  label: "Soft Delete", danger: true },
  ],
  closed:    [
    { action: "reopen",  label: "Reopen RFQ" },
    { action: "archive", label: "Archive RFQ" },
    { action: "delete",  label: "Soft Delete", danger: true },
  ],
  archived:  [
    { action: "reopen",  label: "Reopen RFQ" },
    { action: "delete",  label: "Soft Delete", danger: true },
  ],
  suspended: [
    { action: "reopen",  label: "Reopen RFQ" },
    { action: "archive", label: "Archive RFQ" },
    { action: "delete",  label: "Soft Delete", danger: true },
  ],
  deleted:   [],
};

// ─── Audit log drawer ────────────────────────────────────────────────────────

function RfqAuditDialog({ rfqId, partNumber, open, onClose }: { rfqId: number; partNumber: string; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useGetAdminRfqAudit(rfqId, {
    query: { enabled: open, queryKey: getGetAdminRfqAuditQueryKey(rfqId) },
  });

  const ACTION_COLORS: Record<string, string> = {
    close:   "text-muted-foreground",
    archive: "text-muted-foreground",
    suspend: "text-amber-400",
    reopen:  "text-emerald-400",
    delete:  "text-red-400",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Audit Log — <span className="font-mono text-primary text-sm">{partNumber}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2 py-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : !data?.entries.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No admin actions recorded yet.</p>
          ) : (
            data.entries.map(entry => (
              <div key={entry.id} className="border border-border rounded-md p-3 bg-card/50">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${ACTION_COLORS[entry.action] ?? "text-white"}`}>
                    {entry.action}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-white/80">{entry.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">Admin ID: {entry.adminId}</p>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="border-border text-muted-foreground hover:text-white">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action confirmation dialog ───────────────────────────────────────────────

function RfqActionDialog({
  rfqId, partNumber, action, onConfirm, onCancel, isPending,
}: {
  rfqId: number;
  partNumber: string;
  action: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const isDanger = action === "delete" || action === "suspend";
  const ACTION_LABELS: Record<string, string> = {
    close:   "Close RFQ",
    archive: "Archive RFQ",
    suspend: "Suspend RFQ",
    reopen:  "Reopen RFQ",
    delete:  "Soft Delete RFQ",
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDanger ? "text-red-400" : "text-white"}`}>
            {ACTION_LABELS[action] ?? action}
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            RFQ <span className="font-mono text-primary">#{rfqId}</span> — {partNumber}
          </p>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Admin Reason <span className="text-red-400">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Provide a clear reason for this action. This will be logged."
            className="bg-card border-border text-white resize-none h-24 text-sm"
            autoFocus
          />
          {isDanger && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This action changes the RFQ status. No data is permanently deleted.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending} className="border-border text-muted-foreground hover:text-white">
            Cancel
          </Button>
          <Button
            size="sm"
            variant={isDanger ? "destructive" : "default"}
            onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
            disabled={!reason.trim() || isPending}
            className="min-w-[100px]"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

type RfqUrgency = "aog" | "urgent" | "routine";

const RFQ_URGENCY_META: Record<RfqUrgency, { label: string; className: string; show: boolean }> = {
  aog:     { label: "AOG",     className: "bg-red-500/20 text-red-400 border-red-500/40",     show: true },
  urgent:  { label: "URGENT",  className: "bg-amber-500/20 text-amber-400 border-amber-500/30", show: true },
  routine: { label: "ROUTINE", className: "bg-muted text-muted-foreground border-border",     show: false },
};

const URGENCY_OPTIONS: { value: RfqUrgency; label: string }[] = [
  { value: "aog",     label: "AOG — Aircraft on Ground" },
  { value: "urgent",  label: "Urgent" },
  { value: "routine", label: "Routine" },
];

// ─── Urgency override dialog ──────────────────────────────────────────────────

function RfqUrgencyDialog({
  rfqId, partNumber, currentUrgency, onConfirm, onCancel, isPending,
}: {
  rfqId: number;
  partNumber: string;
  currentUrgency: RfqUrgency;
  onConfirm: (urgency: RfqUrgency, urgencyReason: string | null, reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [urgency, setUrgency] = useState<RfqUrgency>(currentUrgency);
  const [urgencyReason, setUrgencyReason] = useState("");
  const [adminReason, setAdminReason] = useState("");

  const isAog = urgency === "aog";
  const canSubmit = adminReason.trim().length > 0 && (!isAog || urgencyReason.trim().length > 0);

  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Override Urgency
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            RFQ <span className="font-mono text-primary">#{rfqId}</span> — {partNumber}
          </p>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              New Urgency Level <span className="text-red-400">*</span>
            </label>
            <Select value={urgency} onValueChange={v => setUrgency(v as RfqUrgency)}>
              <SelectTrigger className={`bg-background border-border ${isAog ? "border-red-500/50 text-red-400" : ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAog && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                AOG Reason <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={urgencyReason}
                onChange={e => setUrgencyReason(e.target.value)}
                placeholder="Describe the grounding situation for this AOG request…"
                className="bg-card border-border text-white resize-none h-20 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admin Reason <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={adminReason}
              onChange={e => setAdminReason(e.target.value)}
              placeholder="Why is this urgency being changed? This will be logged in the audit trail."
              className="bg-card border-border text-white resize-none h-20 text-sm"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}
            className="border-border text-muted-foreground hover:text-white">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (canSubmit) onConfirm(urgency, isAog ? urgencyReason.trim() : null, adminReason.trim());
            }}
            disabled={!canSubmit || isPending}
            className={`min-w-[100px] ${isAog ? "bg-red-600 hover:bg-red-700" : ""}`}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── section: RFQ management ─────────────────────────────────────────────────

type RfqStatusFilter = "open" | "closed" | "archived" | "suspended" | "deleted" | undefined;

function RfqsSection() {
  const [statusFilter, setStatusFilter] = useState<RfqStatusFilter>("open");
  const [search, setSearch]             = useState("");
  const [pendingAction, setPendingAction] = useState<{ rfqId: number; partNumber: string; action: string } | null>(null);
  const [auditTarget, setAuditTarget]     = useState<{ rfqId: number; partNumber: string } | null>(null);
  const [urgencyTarget, setUrgencyTarget] = useState<{ rfqId: number; partNumber: string; currentUrgency: RfqUrgency } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = { status: statusFilter, q: search || undefined, limit: 50 };
  const { data, isLoading } = useGetAdminRfqs(queryParams, {
    query: { queryKey: getGetAdminRfqsQueryKey(queryParams) },
  });

  const { mutate: applyAction, isPending } = useAdminRfqAction({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminRfqsQueryKey() });
        toast({ title: "Action applied", description: `RFQ #${result.rfq.id} is now ${result.rfq.status}.` });
        setPendingAction(null);
      },
      onError: () => {
        toast({ title: "Action failed", description: "Could not apply action. Please try again.", variant: "destructive" });
      },
    },
  });

  const { mutate: applyUrgency, isPending: isUrgencyPending } = useAdminSetRfqUrgency({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminRfqsQueryKey() });
        const u = ((result.rfq as any).urgency as string).toUpperCase().replace("_", " ");
        toast({ title: "Urgency updated", description: `RFQ #${result.rfq.id} urgency set to ${u}.` });
        setUrgencyTarget(null);
      },
      onError: () => {
        toast({ title: "Update failed", description: "Could not update urgency. Please try again.", variant: "destructive" });
      },
    },
  });

  function confirmAction(reason: string) {
    if (!pendingAction) return;
    applyAction({ id: pendingAction.rfqId, data: { action: pendingAction.action as any, reason } });
  }

  function confirmUrgency(urgency: RfqUrgency, urgencyReason: string | null, reason: string) {
    if (!urgencyTarget) return;
    applyUrgency({ id: urgencyTarget.rfqId, data: { urgency, urgencyReason: urgencyReason ?? undefined, reason } });
  }

  const STATUS_TABS: Array<{ value: RfqStatusFilter; label: string }> = [
    { value: undefined,   label: "All" },
    { value: "open",      label: "Open" },
    { value: "closed",    label: "Closed" },
    { value: "archived",  label: "Archived" },
    { value: "suspended", label: "Suspended" },
    { value: "deleted",   label: "Deleted" },
  ];

  const counts = data?.rfqs.reduce((acc, rfq) => {
    acc[rfq.status] = (acc[rfq.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">RFQ Management</h2>
          <p className="text-sm text-muted-foreground">Manage RFQ lifecycle. Every action is logged with an admin reason.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search part / buyer…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card border-border w-52" />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(({ value, label }) => (
          <Button key={String(value)} size="sm"
            variant={statusFilter === value ? "default" : "outline"}
            className={`h-7 text-xs px-3 ${statusFilter !== value ? "border-border text-muted-foreground hover:text-white" : ""}`}
            onClick={() => setStatusFilter(value)}>
            {label}
          </Button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Showing",   value: data?.total ?? 0, color: "text-white" },
          { label: "Open",      value: isLoading ? null : (counts?.open ?? 0), color: "text-emerald-400" },
          { label: "Suspended", value: isLoading ? null : (counts?.suspended ?? 0), color: "text-amber-400" },
          { label: "Deleted",   value: isLoading ? null : (counts?.deleted ?? 0), color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value === null || isLoading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : !data?.rfqs.length ? (
          <div className="p-12 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No RFQs match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">ID</th>
                  <th className="text-left p-3">Part Number</th>
                  <th className="text-left p-3 hidden md:table-cell">Buyer</th>
                  <th className="text-left p-3 hidden lg:table-cell">Aircraft</th>
                  <th className="text-left p-3">Qty</th>
                  <th className="text-left p-3">Urgency</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3 hidden md:table-cell">Posted</th>
                  <th className="text-right p-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rfqs.map(rfq => {
                  const statusMeta  = RFQ_STATUS_META[rfq.status] ?? RFQ_STATUS_META.closed;
                  const actions     = RFQ_ACTIONS[rfq.status] ?? [];
                  const urgency     = ((rfq as any).urgency ?? "routine") as RfqUrgency;
                  const urgencyMeta = RFQ_URGENCY_META[urgency];
                  const isAogRow    = urgency === "aog";
                  return (
                    <tr key={rfq.id}
                      className={`border-b border-border/50 hover:bg-secondary/10 transition-colors ${isAogRow ? "bg-red-500/5" : ""}`}>
                      <td className="p-3 pl-4 text-xs font-mono text-muted-foreground">#{rfq.id}</td>
                      <td className="p-3 font-mono text-primary text-xs">
                        <div className="flex items-center gap-1.5">
                          {isAogRow && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 animate-pulse" />}
                          {rfq.partNumber}
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-xs text-muted-foreground max-w-[120px] truncate">
                        {rfq.buyerCompany ?? rfq.buyerName}
                      </td>
                      <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">{rfq.aircraftApplicability ?? "—"}</td>
                      <td className="p-3 text-xs font-mono text-white">{rfq.quantity}</td>
                      <td className="p-3">
                        {urgencyMeta.show ? (
                          <Badge className={`text-xs border ${urgencyMeta.className} ${isAogRow ? "animate-pulse" : ""}`}>
                            {urgencyMeta.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs border ${statusMeta.className}`}>{statusMeta.label}</Badge>
                      </td>
                      <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{timeAgo(rfq.createdAt)}</td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Audit log */}
                          <Button size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                            title="View audit log"
                            onClick={() => setAuditTarget({ rfqId: rfq.id, partNumber: rfq.partNumber })}>
                            <History className="w-3.5 h-3.5" />
                          </Button>
                          {/* External link */}
                          <Link href={`/rfqs/${rfq.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-white" title="View RFQ">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {/* Admin actions dropdown — always shown (includes urgency override) */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-border text-muted-foreground hover:text-white gap-1">
                                <MoreVertical className="w-3.5 h-3.5" />
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border w-48">
                              {/* Urgency override — always available */}
                              <DropdownMenuItem
                                className="text-xs cursor-pointer text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
                                onClick={() => setUrgencyTarget({ rfqId: rfq.id, partNumber: rfq.partNumber, currentUrgency: urgency })}>
                                <AlertTriangle className="w-3 h-3 mr-1.5 inline-block" />
                                Override Urgency
                              </DropdownMenuItem>
                              {/* Lifecycle actions */}
                              {actions.length > 0 && <DropdownMenuSeparator className="bg-border/50" />}
                              {actions.map((act, idx) => (
                                <span key={act.action}>
                                  {act.danger && idx > 0 && <DropdownMenuSeparator className="bg-border/50" />}
                                  <DropdownMenuItem
                                    className={`text-xs cursor-pointer ${act.danger ? "text-red-400 focus:text-red-300 focus:bg-red-500/10" : "text-white focus:bg-secondary/40"}`}
                                    onClick={() => setPendingAction({ rfqId: rfq.id, partNumber: rfq.partNumber, action: act.action })}>
                                    {act.label}
                                  </DropdownMenuItem>
                                </span>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action confirmation dialog */}
      {pendingAction && (
        <RfqActionDialog
          rfqId={pendingAction.rfqId}
          partNumber={pendingAction.partNumber}
          action={pendingAction.action}
          isPending={isPending}
          onConfirm={confirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* Audit log dialog */}
      {auditTarget && (
        <RfqAuditDialog
          rfqId={auditTarget.rfqId}
          partNumber={auditTarget.partNumber}
          open={!!auditTarget}
          onClose={() => setAuditTarget(null)}
        />
      )}

      {/* Urgency override dialog */}
      {urgencyTarget && (
        <RfqUrgencyDialog
          rfqId={urgencyTarget.rfqId}
          partNumber={urgencyTarget.partNumber}
          currentUrgency={urgencyTarget.currentUrgency}
          isPending={isUrgencyPending}
          onConfirm={confirmUrgency}
          onCancel={() => setUrgencyTarget(null)}
        />
      )}
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

// ─── section: trust scores ───────────────────────────────────────────────────

function TrustSection() {
  const { data: sellers, isLoading } = useGetAdminSellers({ query: { queryKey: getGetAdminSellersQueryKey() } });

  const ranked = (sellers ?? []).slice().sort((a, b) => (b.activeListings ?? 0) - (a.activeListings ?? 0));
  const activeCount = (sellers ?? []).filter(s => s.status === "active").length;
  const suspendedCount = (sellers ?? []).filter(s => s.status === "suspended").length;

  const rankColors = ["text-amber-400", "text-slate-300", "text-amber-700"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Trust Scores &amp; Leaderboard</h2>
        <p className="text-sm text-muted-foreground">Seller trust ranking based on verified listings, plan tier, and account standing.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-emerald-500/20 rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Active Sellers</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{isLoading ? "—" : activeCount}</p>
        </div>
        <div className="border border-red-500/20 rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Suspended</p>
          <p className="text-2xl font-bold font-mono text-red-400">{isLoading ? "—" : suspendedCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Sellers</p>
          <p className="text-2xl font-bold font-mono text-white">{isLoading ? "—" : (sellers ?? []).length}</p>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Seller Leaderboard
          </h3>
          <span className="text-xs text-muted-foreground">Ranked by active listings</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : ranked.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No sellers yet.</p></div>
        ) : (
          <div className="divide-y divide-border/50">
            {ranked.map((seller, idx) => {
              const planMeta = PLAN_META[seller.plan] ?? PLAN_META.free;
              const stMeta = STATUS_META[seller.status] ?? STATUS_META.active;
              return (
                <div key={seller.id} className="flex items-center gap-4 p-4 hover:bg-secondary/10 transition-colors">
                  <div className={`w-8 text-center font-bold font-mono text-sm flex-shrink-0 ${rankColors[idx] ?? "text-muted-foreground"}`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{seller.companyName}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${planMeta.bg} ${planMeta.color}`}>{planMeta.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${stMeta.bg} ${stMeta.color}`}>{stMeta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{seller.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono font-bold text-white">{seller.activeListings}</p>
                    <p className="text-xs text-muted-foreground">active listings</p>
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

// ─── section: analytics ──────────────────────────────────────────────────────

function AnalyticsSection() {
  const { data: stats, isLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: sellers } = useGetAdminSellers({ query: { queryKey: getGetAdminSellersQueryKey() } });
  const { data: rfqData } = useGetRfqs({ status: "open", limit: 1 });

  const proCount = (sellers ?? []).filter(s => s.plan === "pro").length;
  const enterpriseCount = (sellers ?? []).filter(s => s.plan === "enterprise").length;
  const freeCount = (sellers ?? []).filter(s => s.plan === "free").length;
  const estRevenue = proCount * 29 + enterpriseCount * 99;

  const kpis = [
    { label: "Total Listings",   value: stats?.totalListings,       color: "text-white"       as const, icon: Package },
    { label: "Active Sellers",   value: stats?.activeSellers,       color: "text-emerald-400" as const, icon: Users },
    { label: "Pending Review",   value: stats?.pendingVerification, color: "text-amber-400"   as const, icon: ShieldCheck },
    { label: "Total Inquiries",  value: stats?.totalInquiries,      color: "text-primary"     as const, icon: MessageSquare },
    { label: "MRO Providers",    value: stats?.totalMro,            color: "text-white"       as const, icon: Wrench },
    { label: "Open RFQs",        value: rfqData?.total,             color: "text-white"       as const, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Platform Analytics</h2>
        <p className="text-sm text-muted-foreground">Real-time platform health metrics and revenue overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <StatCard key={k.label} icon={k.icon} label={k.label} value={isLoading ? null : (k.value ?? null)} color={k.color} />
        ))}
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          Revenue Estimates
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "Free Tier",  count: freeCount,       revenue: "$0/mo",                                    color: "text-muted-foreground", bg: "border-border" },
            { label: "Pro Tier",   count: proCount,        revenue: `$${(proCount * 29).toLocaleString()}/mo`,        color: "text-primary",    bg: "border-primary/30" },
            { label: "Enterprise", count: enterpriseCount, revenue: `$${(enterpriseCount * 99).toLocaleString()}/mo`, color: "text-amber-400",  bg: "border-amber-500/30" },
          ].map(p => (
            <div key={p.label} className={`border rounded-lg p-4 bg-card/60 ${p.bg}`}>
              <p className={`text-sm font-semibold mb-1 ${p.color}`}>{p.label}</p>
              <p className="text-xl font-bold font-mono text-white">{p.count} sellers</p>
              <p className="text-xs text-muted-foreground mt-1">{p.revenue}</p>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated Monthly Revenue</span>
          <span className="text-lg font-bold font-mono text-emerald-400">${estRevenue.toLocaleString()}/mo</span>
        </div>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Listing Verification Funnel
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Pending Verification", value: stats?.pendingVerification ?? 0, color: "text-amber-400" },
            { label: "Active Listings",      value: stats?.totalListings ?? 0,       color: "text-white" },
            { label: "Total Inquiries",      value: stats?.totalInquiries ?? 0,      color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="border border-border rounded-lg p-4 bg-card/60">
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{isLoading ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── section: inventory ──────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "all",          label: "All" },
  { value: "active",       label: "Active" },
  { value: "suspended",    label: "Suspended" },
  { value: "pending_review", label: "Pending Review" },
  { value: "deleted",      label: "Deleted" },
  { value: "removed",      label: "Removed" },
];

const LISTING_STATUS_META: Record<string, { label: string; cls: string }> = {
  active:         { label: "Active",         cls: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" },
  suspended:      { label: "Suspended",      cls: "text-amber-400 bg-amber-500/10 border border-amber-500/20" },
  pending_review: { label: "Pending Review", cls: "text-blue-400 bg-blue-500/10 border border-blue-500/20" },
  deleted:        { label: "Deleted",        cls: "text-red-400 bg-red-500/10 border border-red-500/20" },
  removed:        { label: "Removed",        cls: "text-red-400/70 bg-red-500/10 border border-red-500/20" },
};

const CONDITION_OPTS = ["new","overhauled","serviceable","as_removed","repaired"];
const SALE_TYPE_OPTS = ["outright","exchange","both"];
const BADGE_OPTS     = ["pending_verification","documentation_reviewed","verified"];

function fmt2(s: string) { return s.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }

function InventoryFormModal({
  open, onClose, initial, sellers, onSubmit, submitting, title,
}: {
  open: boolean;
  onClose: () => void;
  initial?: any;
  sellers: any[];
  onSubmit: (data: any) => void;
  submitting: boolean;
  title: string;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    sellerId:              initial?.sellerId ? String(initial.sellerId) : "",
    partNumber:            initial?.partNumber ?? "",
    description:           initial?.description ?? "",
    manufacturer:          initial?.manufacturer ?? "",
    condition:             initial?.condition ?? "serviceable",
    saleType:              initial?.saleType ?? "outright",
    quantity:              initial?.quantity ? String(initial.quantity) : "1",
    price:                 initial?.price != null ? String(initial.price) : "",
    aircraftApplicability: initial?.aircraftApplicability ?? "",
    traceHistory:          initial?.traceHistory ?? "",
    badge:                 initial?.badge ?? "pending_verification",
    featured:              initial?.featured ?? false,
  });

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      partNumber: form.partNumber.trim(),
      description: form.description.trim(),
      manufacturer: form.manufacturer.trim(),
      condition: form.condition,
      saleType: form.saleType,
      quantity: parseInt(form.quantity) || 1,
      price: form.price ? parseFloat(form.price) : null,
      aircraftApplicability: form.aircraftApplicability.trim() || null,
      traceHistory: form.traceHistory.trim() || null,
      badge: form.badge,
      featured: form.featured,
    };
    if (!isEdit) payload.sellerId = parseInt(form.sellerId);
    onSubmit(payload);
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!isEdit && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Seller *</label>
              <Select value={form.sellerId} onValueChange={v => set("sellerId", v)}>
                <SelectTrigger className="bg-background border-border text-white">
                  <SelectValue placeholder="Select seller…" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.companyName} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Part Number *</label>
              <Input value={form.partNumber} onChange={e => set("partNumber", e.target.value)} required className="bg-background border-border text-white font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Manufacturer *</label>
              <Input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} required className="bg-background border-border text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Description *</label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} required rows={2} className="bg-background border-border text-white resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Condition</label>
              <Select value={form.condition} onValueChange={v => set("condition", v)}>
                <SelectTrigger className="bg-background border-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITION_OPTS.map(o => <SelectItem key={o} value={o}>{fmt2(o)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Sale Type</label>
              <Select value={form.saleType} onValueChange={v => set("saleType", v)}>
                <SelectTrigger className="bg-background border-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{SALE_TYPE_OPTS.map(o => <SelectItem key={o} value={o}>{fmt2(o)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Badge</label>
              <Select value={form.badge} onValueChange={v => set("badge", v)}>
                <SelectTrigger className="bg-background border-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{BADGE_OPTS.map(o => <SelectItem key={o} value={o}>{fmt2(o)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</label>
              <Input type="number" min={1} value={form.quantity} onChange={e => set("quantity", e.target.value)} className="bg-background border-border text-white font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Price (USD)</label>
              <Input type="number" min={0} step="0.01" placeholder="Leave blank for POA" value={form.price} onChange={e => set("price", e.target.value)} className="bg-background border-border text-white font-mono" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Aircraft Applicability</label>
            <Input value={form.aircraftApplicability} onChange={e => set("aircraftApplicability", e.target.value)} placeholder="e.g. Boeing 737, Airbus A320" className="bg-background border-border text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Trace History</label>
            <Textarea value={form.traceHistory} onChange={e => set("traceHistory", e.target.value)} rows={2} className="bg-background border-border text-white resize-none" placeholder="Optional trace documentation notes…" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="inv-featured" checked={form.featured} onChange={e => set("featured", e.target.checked)} className="w-4 h-4 accent-primary" />
            <label htmlFor="inv-featured" className="text-sm text-muted-foreground cursor-pointer">Featured listing (appears in homepage showcase)</label>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-background font-semibold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEdit ? "Save Changes" : "Create Listing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogModal({ listingId, partNumber, onClose }: { listingId: number; partNumber: string; onClose: () => void }) {
  const { data: logs, isLoading } = useGetAdminInventoryAudit(listingId);

  const ACTION_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    create:   { label: "Created",   cls: "text-emerald-400", icon: Plus },
    edit:     { label: "Edited",    cls: "text-blue-400",    icon: Pencil },
    suspend:  { label: "Suspended", cls: "text-amber-400",   icon: Ban },
    restore:  { label: "Restored",  cls: "text-emerald-400", icon: RefreshCw },
    delete:   { label: "Deleted",   cls: "text-red-400",     icon: Trash2 },
    remove:   { label: "Removed",   cls: "text-red-400",     icon: Trash2 },
    feature:  { label: "Featured",  cls: "text-yellow-400",  icon: Star },
    unfeature:{ label: "Unfeatured",cls: "text-muted-foreground", icon: Star },
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-white">Audit Log — <span className="font-mono text-primary">{partNumber}</span></DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !logs?.length ? (
          <div className="py-8 text-center text-muted-foreground text-sm"><History className="w-6 h-6 mx-auto mb-2 opacity-40" />No audit entries yet.</div>
        ) : (
          <div className="space-y-2 py-2">
            {logs.map((log: any) => {
              const meta = ACTION_META[log.action] ?? { label: log.action, cls: "text-muted-foreground", icon: FileText };
              const Icon = meta.icon;
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-md bg-background/50 border border-border/50">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.cls}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${meta.cls}`}>{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">by {log.admin?.name ?? log.admin?.email ?? `Admin #${log.admin?.id}`}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-xs text-muted-foreground/70 mt-1 font-mono truncate">{JSON.stringify(log.metadata)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InventorySection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [auditTarget, setAuditTarget] = useState<{ id: number; partNumber: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const params = {
    page,
    limit: 25,
    status: statusTab !== "all" ? statusTab as any : undefined,
    q: search || undefined,
  };
  const qKey = getGetAdminInventoryQueryKey(params);
  const { data, isLoading } = useGetAdminInventory(params, { query: { queryKey: qKey } });
  const { data: sellersData } = useGetAdminSellers({ query: { queryKey: getGetAdminSellersQueryKey() } });

  const createM  = useCreateAdminInventoryListing();
  const updateM  = useUpdateAdminInventoryListing();
  const deleteM  = useDeleteAdminInventoryListing();
  const suspendM = useSuspendAdminInventoryListing();
  const restoreM = useRestoreAdminInventoryListing();
  const featureM = useFeatureAdminInventoryListing();

  function invalidate() {
    qc.invalidateQueries({ queryKey: qKey });
    qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
  }

  function handleCreate(payload: any) {
    createM.mutate({ data: payload }, {
      onSuccess: () => { invalidate(); setShowCreate(false); toast({ title: "Listing created", description: payload.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to create listing", variant: "destructive" }),
    });
  }

  function handleEdit(payload: any) {
    if (!editTarget) return;
    updateM.mutate({ id: editTarget.id, data: payload }, {
      onSuccess: () => { invalidate(); setEditTarget(null); toast({ title: "Listing updated", description: editTarget.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to update listing", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteM.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Listing deleted", description: deleteTarget.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to delete listing", variant: "destructive" }),
    });
  }

  function handleSuspend() {
    if (!suspendTarget) return;
    suspendM.mutate({ id: suspendTarget.id, data: suspendReason ? { reason: suspendReason } : undefined }, {
      onSuccess: () => { invalidate(); setSuspendTarget(null); setSuspendReason(""); toast({ title: "Listing suspended", description: suspendTarget.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to suspend listing", variant: "destructive" }),
    });
  }

  function handleRestore(listing: any) {
    restoreM.mutate({ id: listing.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Listing restored", description: listing.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to restore listing", variant: "destructive" }),
    });
  }

  function handleFeature(listing: any) {
    featureM.mutate({ id: listing.id }, {
      onSuccess: () => { invalidate(); toast({ title: listing.featured ? "Unfeatured" : "Featured", description: listing.partNumber }); },
      onError:   () => toast({ title: "Error", description: "Failed to update featured", variant: "destructive" }),
    });
  }

  const sellers = (sellersData ?? []) as any[];
  const listings = data?.listings ?? [];
  const total    = data?.total ?? 0;
  const counts   = (data?.statusCounts ?? {}) as Record<string, number>;
  const totalPages = Math.ceil(total / 25);

  const canSuspend = (l: any) => l.status !== "suspended" && l.status !== "deleted" && l.status !== "removed";
  const canRestore = (l: any) => l.status === "suspended" || l.status === "pending_review";
  const canDelete  = (l: any) => l.status !== "deleted" && l.status !== "removed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Inventory Management</h2>
          <p className="text-sm text-muted-foreground">Create, edit, suspend, and manage all marketplace listings.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary text-background font-semibold h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Listing
        </Button>
      </div>

      {/* Status count pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => {
          const count = tab.value === "all" ? total : (counts[tab.value] ?? 0);
          const active = statusTab === tab.value;
          return (
            <button key={tab.value} onClick={() => { setStatusTab(tab.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active ? "bg-primary/20 border-primary/40 text-white" : "bg-card border-border text-muted-foreground hover:text-white hover:border-border/80"
              }`}>
              {tab.label}{count > 0 ? <span className={`ml-1.5 font-mono ${active ? "text-primary" : "text-muted-foreground"}`}>{count}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search part number, description…"
            className="pl-9 h-8 text-xs bg-card border-border text-white"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs border-border text-muted-foreground" onClick={() => { setSearch(searchInput); setPage(1); }}>
          Search
        </Button>
        {search && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : listings.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Boxes className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No listings match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-4">Part / Description</th>
                  <th className="text-left p-4 hidden md:table-cell">Seller</th>
                  <th className="text-left p-4 hidden lg:table-cell">Condition</th>
                  <th className="text-left p-4 hidden lg:table-cell">Price</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4 hidden xl:table-cell">Featured</th>
                  <th className="text-left p-4 hidden xl:table-cell">Created</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing: any) => {
                  const sm = LISTING_STATUS_META[listing.status] ?? { label: listing.status, cls: "text-muted-foreground" };
                  const isDead = listing.status === "deleted" || listing.status === "removed";
                  return (
                    <tr key={listing.id} className={`border-b border-border/50 hover:bg-secondary/10 transition-colors ${isDead ? "opacity-50" : ""}`}>
                      <td className="p-4 max-w-[200px]">
                        <Link href={`/listings/${listing.id}`}>
                          <span className="font-mono text-primary hover:underline cursor-pointer text-xs flex items-center gap-1">
                            {listing.partNumber}<ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </span>
                        </Link>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{listing.description}</p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="text-xs text-white">{listing.seller?.companyName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{listing.seller?.plan ?? ""}</p>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{fmt2(listing.condition ?? "")}</span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-xs font-mono text-white">{listing.price != null ? `$${Number(listing.price).toLocaleString()}` : "POA"}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        {listing.featured
                          ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          : <Star className="w-4 h-4 text-muted-foreground/30" />}
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        <span className="text-xs text-muted-foreground">{timeAgo(listing.createdAt)}</span>
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border text-sm w-48">
                            <DropdownMenuItem onClick={() => setEditTarget(listing)} className="gap-2 cursor-pointer">
                              <Pencil className="w-3.5 h-3.5" /> Edit Listing
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAuditTarget({ id: listing.id, partNumber: listing.partNumber })} className="gap-2 cursor-pointer">
                              <History className="w-3.5 h-3.5" /> Audit Log
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => handleFeature(listing)}
                              className="gap-2 cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5" />
                              {listing.featured ? "Remove from Featured" : "Mark as Featured"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            {canSuspend(listing) && (
                              <DropdownMenuItem onClick={() => { setSuspendTarget(listing); setSuspendReason(""); }} className="gap-2 cursor-pointer text-amber-400 focus:text-amber-400">
                                <Ban className="w-3.5 h-3.5" /> Suspend Listing
                              </DropdownMenuItem>
                            )}
                            {canRestore(listing) && (
                              <DropdownMenuItem onClick={() => handleRestore(listing)} className="gap-2 cursor-pointer text-emerald-400 focus:text-emerald-400">
                                <RefreshCw className="w-3.5 h-3.5" /> Restore to Active
                              </DropdownMenuItem>
                            )}
                            {canDelete(listing) && (
                              <>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem onClick={() => setDeleteTarget(listing)} className="gap-2 cursor-pointer text-red-400 focus:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Listing
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <InventoryFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        sellers={sellers}
        onSubmit={handleCreate}
        submitting={createM.isPending}
        title="Create New Listing"
      />
      {editTarget && (
        <InventoryFormModal
          open
          onClose={() => setEditTarget(null)}
          initial={editTarget}
          sellers={sellers}
          onSubmit={handleEdit}
          submitting={updateM.isPending}
          title={`Edit — ${editTarget.partNumber}`}
        />
      )}
      {auditTarget && (
        <AuditLogModal listingId={auditTarget.id} partNumber={auditTarget.partNumber} onClose={() => setAuditTarget(null)} />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Listing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Soft-delete <span className="font-mono text-white">{deleteTarget?.partNumber}</span>? The listing will be hidden from the marketplace and marked as deleted in the audit log.
          </p>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-muted-foreground">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleteM.isPending} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              {deleteM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Suspend Listing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Suspend <span className="font-mono text-white">{suspendTarget?.partNumber}</span>? It will be hidden from buyers until restored.
          </p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason (optional)</label>
            <Input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Awaiting documentation…" className="bg-background border-border text-white text-sm" />
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="ghost" onClick={() => setSuspendTarget(null)} className="text-muted-foreground">Cancel</Button>
            <Button onClick={handleSuspend} disabled={suspendM.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              {suspendM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── section: intelligence ───────────────────────────────────────────────────

type IntelTab = "fraud" | "demand" | "predictions";

const RISK_META: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: "Low",      color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
  medium:   { label: "Medium",   color: "text-amber-400",   bg: "bg-amber-500/10 border border-amber-500/20" },
  high:     { label: "High",     color: "text-orange-400",  bg: "bg-orange-500/10 border border-orange-500/20" },
  critical: { label: "Critical", color: "text-red-400",     bg: "bg-red-500/10 border border-red-500/20" },
};

const FLAG_ICONS: Record<string, React.ElementType> = {
  duplicate_listings: Boxes,
  abnormal_pricing:   TrendingDown,
  missing_certs:      ShieldX,
  dispute_history:    AlertTriangle,
  velocity_risk:      Zap,
};

function IntelligenceSection() {
  const [tab, setTab] = useState<IntelTab>("fraud");
  const [rfqIdInput, setRfqIdInput] = useState<string>("");
  const [selectedRfqId, setSelectedRfqId] = useState<number | null>(null);
  const [demandWindow, setDemandWindow] = useState<number>(30);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Fraud scan ─────────────────────────────────────────────────────────────
  const { data: fraudData, isLoading: fraudLoading, refetch: refetchFraud } =
    useGetAdminFraudScan({ query: { queryKey: getGetAdminFraudScanQueryKey(), enabled: tab === "fraud" } });

  const autoSuspendM = useAdminAutoSuspendHighRisk({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `Auto-suspended ${data.suspendedCount} seller${data.suspendedCount !== 1 ? "s" : ""}`, description: "All critical-risk sellers have been suspended." });
        queryClient.invalidateQueries({ queryKey: getGetAdminFraudScanQueryKey() });
        refetchFraud();
      },
      onError: () => toast({ title: "Auto-suspend failed", variant: "destructive" }),
    },
  });

  const suspendSellerM = useAdminSuspendSellerIntelligence({
    mutation: {
      onSuccess: (_, vars) => {
        toast({ title: `Seller #${vars.sellerId} suspended` });
        queryClient.invalidateQueries({ queryKey: getGetAdminFraudScanQueryKey() });
        refetchFraud();
      },
      onError: () => toast({ title: "Suspend failed", variant: "destructive" }),
    },
  });

  // ── RFQ predictions ────────────────────────────────────────────────────────
  const { data: predData, isLoading: predLoading } = useGetAdminRfqPredictions(
    selectedRfqId ?? 0,
    { query: { queryKey: getGetAdminRfqPredictionsQueryKey(selectedRfqId ?? 0), enabled: selectedRfqId !== null && tab === "predictions" } },
  );

  // ── Demand report ──────────────────────────────────────────────────────────
  const { data: demandData, isLoading: demandLoading } = useGetAdminDemandReport(
    { window: demandWindow },
    { query: { queryKey: getGetAdminDemandReportQueryKey({ window: demandWindow }), enabled: tab === "demand" } },
  );

  const tabBtns: { id: IntelTab; label: string; icon: React.ElementType }[] = [
    { id: "fraud",       label: "Fraud Detection",   icon: ShieldX },
    { id: "demand",      label: "Demand Intelligence", icon: Activity },
    { id: "predictions", label: "RFQ Predictions",   icon: Radar },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" /> Market Intelligence System
        </h2>
        <p className="text-sm text-muted-foreground">Fraud detection, demand analytics, and RFQ winner predictions powered by live marketplace data.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabBtns.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-primary text-white"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Fraud Detection tab ── */}
      {tab === "fraud" && (
        <div className="space-y-4">
          {/* Summary cards */}
          {fraudData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Critical", value: fraudData.criticalCount, color: "text-red-400" },
                { label: "High",     value: fraudData.highCount,     color: "text-orange-400" },
                { label: "Medium",   value: fraudData.mediumCount,   color: "text-amber-400" },
                { label: "Low",      value: fraudData.lowCount,      color: "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
                  <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label} Risk</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {fraudData ? `Scanned ${fraudData.totalSellers} sellers · ${new Date(fraudData.scannedAt).toLocaleString()}` : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchFraud()} disabled={fraudLoading}
                className="text-xs border-border text-muted-foreground hover:text-white gap-1.5 h-8">
                {fraudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh Scan
              </Button>
              <Button size="sm" onClick={() => autoSuspendM.mutate()} disabled={autoSuspendM.isPending}
                className="text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5 h-8">
                {autoSuspendM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldX className="w-3.5 h-3.5" />}
                Auto-Suspend Critical
              </Button>
            </div>
          </div>

          {fraudLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Seller</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Flags</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Listings</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(fraudData?.sellers ?? []).map(seller => {
                    const rm = RISK_META[seller.riskLevel] ?? RISK_META.low;
                    return (
                      <tr key={seller.sellerId} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm leading-tight">{seller.companyName}</p>
                          <p className="text-xs text-muted-foreground">{seller.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${rm.bg} ${rm.color}`}>
                            {rm.label}
                          </span>
                          {seller.status === "suspended" && (
                            <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/50 text-muted-foreground border border-border">
                              Suspended
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${seller.riskScore >= 80 ? "bg-red-500" : seller.riskScore >= 60 ? "bg-orange-500" : seller.riskScore >= 35 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${seller.riskScore}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-white">{seller.riskScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {seller.flags.map((flag, fi) => {
                              const FIcon = FLAG_ICONS[flag.type] ?? AlertCircle;
                              return (
                                <span key={fi} title={flag.detail}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                    flag.severity === "high" ? "bg-red-500/15 text-red-400" :
                                    flag.severity === "medium" ? "bg-amber-500/15 text-amber-400" :
                                    "bg-secondary/50 text-muted-foreground"
                                  }`}>
                                  <FIcon className="w-3 h-3" />
                                </span>
                              );
                            })}
                            {seller.flags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-white font-mono">{seller.activeListings}</span>
                          {seller.removedListings > 0 && (
                            <span className="text-xs text-red-400 ml-1">({seller.removedListings} removed)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {seller.status !== "suspended" && seller.riskScore > 0 && (
                            <Button
                              size="sm" variant="ghost"
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                              disabled={suspendSellerM.isPending}
                              onClick={() => suspendSellerM.mutate({ sellerId: seller.sellerId })}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!fraudLoading && (fraudData?.sellers ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No sellers found. Run a refresh scan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Demand Intelligence tab ── */}
      {tab === "demand" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time window:</span>
              {[7, 14, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDemandWindow(d)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${demandWindow === d ? "bg-primary/15 border-primary/30 text-white" : "border-border text-muted-foreground hover:text-white"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            {demandData && (
              <p className="text-xs text-muted-foreground">Generated {new Date(demandData.generatedAt).toLocaleString()}</p>
            )}
          </div>

          {demandLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : demandData ? (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Total RFQs",        value: demandData.summary.totalRfqs,                color: "text-white" },
                  { label: "AOG RFQs",           value: demandData.summary.aogRfqs,                 color: "text-red-400" },
                  { label: "Unique Parts",        value: demandData.summary.uniquePartsRequested,    color: "text-white" },
                  { label: "Aircraft Types",      value: demandData.summary.uniqueAircraftTypes,     color: "text-blue-400" },
                  { label: "Parts Covered",       value: demandData.summary.partsCoveredByInventory, color: "text-emerald-400" },
                  { label: "Shortage Alerts",     value: demandData.summary.partsWithShortage,       color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trending parts */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-white">Trending Parts</h3>
                    <span className="text-xs text-muted-foreground ml-auto">Last {demandWindow}d</span>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {demandData.trendingParts.slice(0, 12).map((part, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/20">
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-white truncate">{part.partNumber}</p>
                          <div className="flex gap-2 mt-0.5">
                            {part.aogCount > 0 && (
                              <span className="text-xs text-red-400 font-semibold">{part.aogCount} AOG</span>
                            )}
                            {part.urgentCount > 0 && (
                              <span className="text-xs text-amber-400">{part.urgentCount} urgent</span>
                            )}
                            <span className="text-xs text-muted-foreground">{part.routineCount} routine</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-white">{part.rfqCount}</p>
                          <span className={`text-xs ${
                            part.trend === "shortage" ? "text-red-400" :
                            part.trend === "rising"   ? "text-amber-400" :
                            "text-muted-foreground"
                          }`}>
                            {part.trend === "shortage" ? "⚠ shortage" : part.trend === "rising" ? "↑ rising" : "stable"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {demandData.trendingParts.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No RFQ data in this window.</p>
                    )}
                  </div>
                </div>

                {/* Inventory shortages */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Inventory Shortages</h3>
                    <span className="text-xs text-muted-foreground ml-auto">Parts with &lt;2 listings</span>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {demandData.inventoryShortages.slice(0, 12).map((item, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/20">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.urgencyLevel === "critical" ? "bg-red-500" :
                          item.urgencyLevel === "high"     ? "bg-amber-500" :
                          "bg-blue-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-white truncate">{item.partNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.rfqCount} RFQ{item.rfqCount !== 1 ? "s" : ""}
                            {item.aogCount > 0 && <span className="text-red-400 ml-1">· {item.aogCount} AOG</span>}
                            {" · "}{item.activeListings} listing{item.activeListings !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold uppercase ${
                          item.urgencyLevel === "critical" ? "text-red-400" :
                          item.urgencyLevel === "high"     ? "text-amber-400" :
                          "text-blue-400"
                        }`}>{item.urgencyLevel}</span>
                      </div>
                    ))}
                    {demandData.inventoryShortages.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No shortages detected. Inventory looks healthy.</p>
                    )}
                  </div>
                </div>

                {/* AOG daily spikes */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center gap-2">
                    <FlameKindling className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-white">AOG Demand Spikes</h3>
                    <span className="text-xs text-muted-foreground ml-auto">Last 14 days</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {demandData.aogDailySpikes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No AOG activity in this window.</p>
                    ) : (
                      demandData.aogDailySpikes.map((day, i) => {
                        const maxTotal = Math.max(...demandData.aogDailySpikes.map(d => d.totalCount), 1);
                        const pct = (day.totalCount / maxTotal) * 100;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{day.date}</span>
                            <div className="flex-1 h-6 bg-secondary/40 rounded overflow-hidden relative">
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-red-600/60 to-amber-600/40"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="absolute inset-0 flex items-center gap-1 px-2">
                                {day.aogCount > 0 && <span className="text-xs text-red-300 font-semibold">{day.aogCount} AOG</span>}
                                {day.urgentCount > 0 && <span className="text-xs text-amber-300">{day.urgentCount} urgent</span>}
                                {day.routineCount > 0 && <span className="text-xs text-muted-foreground">{day.routineCount} routine</span>}
                              </div>
                            </div>
                            <span className="text-xs font-mono text-white w-6 text-right">{day.totalCount}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Aircraft demand */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center gap-2">
                    <CircleDot className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Aircraft Demand Trends</h3>
                    <span className="text-xs text-muted-foreground ml-auto">By platform</span>
                  </div>
                  <div className="divide-y divide-border max-h-72 overflow-y-auto">
                    {demandData.aircraftDemandTrends.map((ac, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-secondary/20">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-white truncate">{ac.aircraftType}</p>
                          <div className="flex gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs font-bold text-white">{ac.rfqCount} RFQs</span>
                            {ac.aogCount > 0 && <span className="text-xs text-red-400">{ac.aogCount} AOG</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {ac.topParts.slice(0, 4).map((pn, pi) => (
                            <span key={pi} className="font-mono text-xs bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                              {pn}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {demandData.aircraftDemandTrends.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No aircraft applicability data in this window.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── RFQ Predictions tab ── */}
      {tab === "predictions" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-white font-medium mb-3">Select RFQ to predict winners</p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter RFQ ID…"
                value={rfqIdInput}
                onChange={e => setRfqIdInput(e.target.value)}
                className="bg-background border-border text-white text-sm max-w-40 font-mono"
              />
              <Button
                size="sm"
                onClick={() => {
                  const id = parseInt(rfqIdInput, 10);
                  if (!isNaN(id) && id > 0) setSelectedRfqId(id);
                }}
                disabled={!rfqIdInput || isNaN(parseInt(rfqIdInput, 10))}
                className="text-sm"
              >
                <Radar className="w-4 h-4 mr-2" /> Predict
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ranks all active sellers using trust score, win rate, pricing accuracy, and response speed.</p>
          </div>

          {predLoading && <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>}

          {predData && !predLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">RFQ #{predData.rfqId}</p>
                    <p className="text-sm font-mono text-white font-bold">{predData.partNumber}</p>
                  </div>
                  <div className="border-l border-border pl-3">
                    <p className="text-xs text-muted-foreground">Urgency</p>
                    <span className={`text-xs font-semibold uppercase ${predData.urgency === "aog" ? "text-red-400" : predData.urgency === "urgent" ? "text-amber-400" : "text-muted-foreground"}`}>
                      {predData.urgency}
                    </span>
                  </div>
                  {predData.condition && (
                    <div className="border-l border-border pl-3">
                      <p className="text-xs text-muted-foreground">Condition</p>
                      <p className="text-xs text-white">{predData.condition}</p>
                    </div>
                  )}
                  <div className="border-l border-border pl-3">
                    <p className="text-xs text-muted-foreground">Eligible sellers</p>
                    <p className="text-sm font-bold text-white">{predData.eligibleSellers}</p>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Seller</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Trust / Win Rate</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Breakdown</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Inventory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {predData.predictions.map(pred => (
                      <tr key={pred.sellerId} className={`hover:bg-secondary/20 transition-colors ${pred.rank === 1 ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold font-mono ${pred.rank === 1 ? "text-primary" : pred.rank <= 3 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {pred.rank === 1 ? "★" : pred.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm leading-tight">{pred.companyName}</p>
                          <p className="text-xs text-muted-foreground">{pred.plan} plan</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pred.predictedScore}%` }} />
                            </div>
                            <span className="text-sm font-bold font-mono text-white">{pred.predictedScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs text-white">Trust: <span className="font-mono font-semibold">{pred.trustScore}</span></p>
                          <p className="text-xs text-muted-foreground">Win rate: <span className="text-white">{(pred.winRate * 100).toFixed(0)}%</span> ({pred.wins}/{pred.totalQuotes})</p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                            {[
                              ["Trust",   pred.scoreBreakdown.trustScorePoints, 30],
                              ["Win%",    pred.scoreBreakdown.winRatePoints, 25],
                              ["Pricing", pred.scoreBreakdown.pricingAccuracyPoints, 20],
                              ["Speed",   pred.scoreBreakdown.responseSpeedPoints, 15],
                              ["Plan",    pred.scoreBreakdown.planTierPoints, 10],
                              ["Match",   pred.scoreBreakdown.inventoryMatchBonus, 5],
                            ].map(([label, val, max]) => (
                              <div key={label as string} className="flex items-center gap-1">
                                <span className="text-muted-foreground w-10">{label}</span>
                                <span className="font-mono text-white">{val}/{max}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {pred.hasMatchingListing ? (
                            <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">In stock</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {predData.predictions.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No eligible sellers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── section: vendor verification ───────────────────────────────────────────

function VendorVerificationSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading, refetch } = useGetAdminVendorVerifications({
    query: { queryKey: getGetAdminVendorVerificationsQueryKey() },
  });

  const approveMutation = useAdminApproveVendorVerification();
  const rejectMutation = useAdminRejectVendorVerification();

  function handleApprove(id: number) {
    approveMutation.mutate(
      { id, data: { reviewNote: reviewNote[id] || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Vendor approved", description: "Seller has been promoted to Verified Vendor." });
          void queryClient.invalidateQueries({ queryKey: getGetAdminVendorVerificationsQueryKey() });
          setReviewNote(n => { const c = { ...n }; delete c[id]; return c; });
        },
        onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
      },
    );
  }

  function handleReject(id: number) {
    if (!reviewNote[id]?.trim()) {
      toast({ title: "Review note required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    rejectMutation.mutate(
      { id, data: { reviewNote: reviewNote[id] } },
      {
        onSuccess: () => {
          toast({ title: "Request rejected", description: "Seller has been notified." });
          void queryClient.invalidateQueries({ queryKey: getGetAdminVendorVerificationsQueryKey() });
          setReviewNote(n => { const c = { ...n }; delete c[id]; return c; });
        },
        onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
      },
    );
  }

  const requests = (data as any)?.requests ?? [];
  const pendingCount = (data as any)?.pendingCount ?? 0;

  const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    pending:  { color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30",  label: "Pending" },
    approved: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Approved" },
    rejected: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",      label: "Rejected" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-400" />
            Vendor Verification Requests
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve sellers applying for Verified Vendor status
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pendingCount} pending
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
        <FileCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-muted-foreground">
          <span className="text-white font-medium">Verified Vendor</span> status gives sellers a green badge on all listings, higher search ranking, and an +8 pt boost in RFQ prediction scoring.
          Certification URL is submitted by the seller when applying.
        </div>
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No verification requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Row header */}
                <button
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{r.seller?.companyName ?? `Seller #${r.sellerId}`}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${s.bg} ${s.color}`}>
                        {s.label}
                      </span>
                      {r.seller?.plan && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/50 text-muted-foreground">{r.seller.plan}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                      <span>{r.seller?.email}</span>
                      <span>Applied {new Date(r.createdAt).toLocaleDateString()}</span>
                      {r.businessName && <span>"{r.businessName}"</span>}
                    </div>
                  </div>
                  <ChevronRightIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Submission details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Business Name</p>
                        <p className="text-white">{r.businessName ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Certification URL</p>
                        {r.certificationUrl ? (
                          <a href={r.certificationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block font-mono text-xs">
                            {r.certificationUrl}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </div>
                      {r.notes && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Seller Notes</p>
                          <p className="text-white/80 text-sm">{r.notes}</p>
                        </div>
                      )}
                      {r.reviewNote && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Review Note</p>
                          <p className="text-white/80 text-sm">{r.reviewNote}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions — only for pending */}
                    {r.status === "pending" && (
                      <div className="border-t border-border/50 pt-4 space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Review Note (required for rejection)</p>
                          <textarea
                            className="w-full rounded-md border border-border bg-secondary/20 text-sm text-white p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            rows={2}
                            placeholder="Optional note for approval; required for rejection…"
                            value={reviewNote[r.id] ?? ""}
                            onChange={e => setReviewNote(n => ({ ...n, [r.id]: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApprove(r.id)}
                            disabled={approveMutation.isPending}
                          >
                            <BadgeCheck className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleReject(r.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <UserX className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                    {r.status !== "pending" && r.reviewedAt && (
                      <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                        Reviewed on {new Date(r.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── main admin shell ────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { section: sectionParam } = useParams<{ section?: string }>();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });

  const VALID_SECTIONS = new Set<string>(["overview", "sellers", "listings", "certifications", "billing", "mro", "rfqs", "trust", "analytics", "disputes", "intelligence", "vendors"]);
  const section: Section = (sectionParam && VALID_SECTIONS.has(sectionParam) ? sectionParam : "overview") as Section;

  function navTo(id: Section) {
    navigate(id === "overview" ? "/admin" : `/admin/${id}`);
  }

  useEffect(() => {
    if (authLoading) return;
    if (user?.mustChangePassword) {
      navigate("/admin/change-password");
      return;
    }
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    if (!user || !isAdmin) {
      navigate("/admin/login");
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
        <div className="text-muted-foreground text-sm">Redirecting to login…</div>
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
            <span className="text-lg font-bold text-white tracking-tight">Parts Link Aviation</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">Admin Portal</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const badge = SECTION_BADGES[id];
            const active = section === id;
            return (
              <button key={id} onClick={() => navTo(id)}
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
            <p className="text-xs text-muted-foreground">Parts Link Aviation Admin Portal</p>
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
                  className="h-7 w-7 p-0" onClick={() => navTo(id)}>
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 overflow-y-auto p-6">
          {section === "overview"       && <OverviewSection />}
          {section === "inventory"      && <InventorySection />}
          {section === "sellers"        && <SellersSection />}
          {section === "listings"       && <ListingsSection />}
          {section === "certifications" && <CertificationsSection />}
          {section === "billing"        && <SubscriptionsSection />}
          {section === "mro"            && <MroSection />}
          {section === "rfqs"           && <RfqsSection />}
          {section === "trust"          && <TrustSection />}
          {section === "analytics"      && <AnalyticsSection />}
          {section === "disputes"       && <DisputesSection />}
          {section === "intelligence"   && <IntelligenceSection />}
          {section === "vendors"        && <VendorVerificationSection />}
        </main>
      </div>
    </div>
  );
}
