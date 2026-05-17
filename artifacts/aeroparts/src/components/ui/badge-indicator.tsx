import { Badge } from "@/components/ui/badge";
import { ListingBadge } from "@workspace/api-client-react/src/generated/api.schemas";

interface BadgeIndicatorProps {
  badge: ListingBadge;
  className?: string;
}

export function BadgeIndicator({ badge, className = "" }: BadgeIndicatorProps) {
  switch (badge) {
    case 'verified':
      return (
        <Badge variant="outline" className={`bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium ${className}`}>
          Verified
        </Badge>
      );
    case 'documentation_reviewed':
      return (
        <Badge variant="outline" className={`bg-blue-500/10 text-blue-400 border-blue-500/20 font-medium ${className}`}>
          Docs Reviewed
        </Badge>
      );
    case 'pending_verification':
    default:
      return (
        <Badge variant="outline" className={`bg-slate-500/10 text-slate-400 border-slate-500/20 font-medium ${className}`}>
          Pending
        </Badge>
      );
  }
}
