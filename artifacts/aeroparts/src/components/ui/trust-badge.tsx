import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Star } from "lucide-react";
import type { TrustBadge as TrustBadgeType } from "@workspace/api-client-react";

interface TrustBadgeProps {
  badge: TrustBadgeType | string | null | undefined;
  score?: number | null;
  showScore?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const TRUST_BADGE_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof Shield;
  scoreRange: string;
}> = {
  unverified: {
    label: "Unverified",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    icon: Shield,
    scoreRange: "0–39",
  },
  document_verified: {
    label: "Doc Verified",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: ShieldCheck,
    scoreRange: "40–69",
  },
  aviation_verified: {
    label: "Aviation Verified",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: ShieldCheck,
    scoreRange: "70–89",
  },
  trusted_partner: {
    label: "Trusted Partner",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: Star,
    scoreRange: "90–100",
  },
};

export function TrustBadge({ badge, score, showScore = false, size = "sm", className = "" }: TrustBadgeProps) {
  const key = badge ?? "unverified";
  const meta = TRUST_BADGE_META[key] ?? TRUST_BADGE_META.unverified;
  const Icon = meta.icon;

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const textSize = size === "sm" ? "text-xs" : "text-xs";

  return (
    <Badge
      variant="outline"
      className={`${meta.bg} ${meta.color} ${meta.border} font-medium inline-flex items-center gap-1 ${textSize} ${className}`}
    >
      <Icon className={`${iconSize} flex-shrink-0`} />
      {meta.label}
      {showScore && score != null && (
        <span className="ml-0.5 opacity-70 font-mono">{score}</span>
      )}
    </Badge>
  );
}

export function TrustScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 90 ? "bg-emerald-400" :
    pct >= 70 ? "bg-amber-400" :
    pct >= 40 ? "bg-blue-400" :
    "bg-slate-500";

  return (
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
