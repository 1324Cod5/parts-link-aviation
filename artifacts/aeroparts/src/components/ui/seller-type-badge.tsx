import { ShieldCheck, User } from "lucide-react";

interface SellerTypeBadgeProps {
  sellerType: "private" | "verified_vendor" | string | undefined | null;
  size?: "sm" | "md";
}

export function SellerTypeBadge({ sellerType, size = "sm" }: SellerTypeBadgeProps) {
  const isVerified = sellerType === "verified_vendor";
  const iconClass = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const textClass = size === "md" ? "text-xs" : "text-[10px]";

  if (isVerified) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${textClass} bg-emerald-500/10 text-emerald-400 border-emerald-500/30`}
        title="Admin-verified vendor with submitted business credentials"
      >
        <ShieldCheck className={iconClass} />
        Verified Vendor
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${textClass} bg-amber-500/10 text-amber-400 border-amber-500/30`}
      title="Private individual or unverified business seller"
    >
      <User className={iconClass} />
      Private Seller
    </span>
  );
}
