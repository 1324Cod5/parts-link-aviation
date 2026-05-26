import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useGetListings } from "@workspace/api-client-react";
import { Heart, Package, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const NAVY = "#0a1628";
const BORDER = "#1a3050";
const MUTED = "#7ea8c8";
const CARD = "#0d1f38";

function formatPrice(p: number | null) {
  if (p == null) return "Contact for Price";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);
}

export default function WatchlistPage() {
  const { ids, remove } = useWatchlist();
  const { toast } = useToast();

  const { data } = useGetListings({ limit: 200 });
  const watched = (data?.listings ?? []).filter(l => ids.includes(l.id));

  const handleRemove = (id: number, partNumber: string) => {
    remove(id);
    toast({ title: "Removed from watchlist", description: partNumber });
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        {/* Header */}
        <Link href="/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 13, textDecoration: "none", marginBottom: 24, fontFamily: "'Barlow', sans-serif" }}>
          <ArrowLeft size={14} /> Back to Marketplace
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={20} color="#ef4444" fill="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#fff", textTransform: "uppercase", margin: 0 }}>
              My Watchlist
            </h1>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, margin: 0 }}>
              {ids.length === 0 ? "No saved listings" : `${ids.length} saved listing${ids.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {ids.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Heart size={48} color="#1a3050" style={{ margin: "0 auto 20px" }} />
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, color: "#fff", marginBottom: 10 }}>No saved listings yet</h2>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, marginBottom: 24 }}>
              Click the heart icon on any listing to save it here.
            </p>
            <Link href="/marketplace" style={{ display: "inline-block", padding: "12px 28px", background: "#1976d2", color: "#fff", borderRadius: 8, textDecoration: "none", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ids.length > 0 && watched.length === 0 && (
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED }}>Loading your saved listings…</p>
            )}
            {watched.map(listing => (
              <div key={listing.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                {/* Photo */}
                {listing.photos && listing.photos.length > 0 ? (
                  <img src={listing.photos[0]} alt={listing.partNumber} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 80, height: 60, background: "#1a3050", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package size={24} color="#4a6480" />
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "0.02em" }}>{listing.partNumber}</span>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: MUTED }}>{listing.manufacturer}</span>
                  </div>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.description}</p>
                </div>

                {/* Price */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, color: "#60a5fa" }}>{formatPrice(listing.price as any)}</div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: MUTED, marginTop: 2 }}>{listing.condition}</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <Link href={`/listings/${listing.id}`} style={{ display: "block", padding: "8px 16px", background: "#1976d2", color: "#fff", borderRadius: 6, textDecoration: "none", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", textAlign: "center" }}>
                    View
                  </Link>
                  <button
                    onClick={() => handleRemove(listing.id, listing.partNumber)}
                    style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${BORDER}`, color: "#ef4444", borderRadius: 6, cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontSize: 13, display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
