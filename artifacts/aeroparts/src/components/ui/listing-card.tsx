import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { BadgeIndicator } from "./badge-indicator";
import { TrustBadge } from "./trust-badge";
import type { Listing } from "@workspace/api-client-react";

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const formatCondition = (condition: string) => {
    return condition.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "Contact for Price";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };

  const hasPhoto = listing.photos && listing.photos.length > 0;

  return (
    <Link href={`/listings/${listing.id}`}>
      <Card className="h-full overflow-hidden flex flex-col bg-card hover:border-primary/50 transition-colors cursor-pointer group">
        <div className="aspect-video w-full bg-muted relative overflow-hidden">
          {hasPhoto ? (
            <img 
              src={listing.photos![0]} 
              alt={listing.description}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
              <span className="text-sm font-medium uppercase tracking-wider">No Photo Available</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <BadgeIndicator badge={listing.badge} />
          </div>
        </div>
        
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-2 gap-4">
            <div>
              <h3 className="font-bold text-lg text-white truncate max-w-[200px]" title={listing.partNumber}>
                {listing.partNumber}
              </h3>
              <p className="text-sm text-muted-foreground uppercase tracking-wider text-xs font-mono">
                {listing.manufacturer}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-1 bg-secondary rounded-sm text-xs font-medium text-white mb-1">
                {formatCondition(listing.condition)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-white/80 line-clamp-2 mt-2 flex-1">
            {listing.description}
          </p>
          
          {listing.aircraftApplicability && (
            <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground flex gap-2 items-center">
              <span className="uppercase tracking-wider">For:</span>
              <span className="font-mono text-white/70 truncate">{listing.aircraftApplicability}</span>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="p-4 bg-secondary/30 border-t border-border flex items-center justify-between gap-2">
          <div className="font-mono font-medium text-primary">
            {formatPrice(listing.price)}
          </div>
          <div className="flex items-center gap-2">
            {listing.seller?.trustBadge && listing.seller.trustBadge !== "unverified" && (
              <TrustBadge badge={listing.seller.trustBadge} />
            )}
            <span className="text-xs text-muted-foreground">
              {listing.saleType === 'both' ? 'Outright / Exchange' : listing.saleType.charAt(0).toUpperCase() + listing.saleType.slice(1)}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
