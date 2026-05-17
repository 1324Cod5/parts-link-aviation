import { useState } from "react";
import { Link } from "wouter";
import { useGetMroProfiles } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Wrench, Star, MapPin, Clock, ShieldCheck,
  Plane, ChevronRight, Filter, X
} from "lucide-react";

export const SERVICE_TYPES = [
  "Component Repair", "Engine Overhaul", "Heavy Maintenance Check",
  "Line Maintenance", "Avionics Repair", "NDT / Inspection",
  "AOG Support", "Calibration & Testing", "Parts Manufacturing",
  "ETOPS Support", "Borescope Inspection", "Fuel System Service",
];

export const CERTIFICATIONS = [
  "FAA Part 145", "EASA Part 145", "CAAC CCAR-145",
  "Transport Canada (AMO)", "ANAC", "GCAA", "JCAB", "DGCA",
  "ISO 9001:2015", "AS9100D",
];

export const AIRCRAFT_FAMILIES = [
  "Boeing 737 NG/MAX", "Boeing 737 Classic", "Boeing 757", "Boeing 767",
  "Boeing 777", "Boeing 787", "Airbus A220", "Airbus A320 Family",
  "Airbus A330", "Airbus A350", "Airbus A380", "Embraer E-Jet",
  "Bombardier CRJ", "ATR 42/72", "DHC-8 Dash 8",
];

const CERT_COLORS: Record<string, string> = {
  "FAA Part 145": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "EASA Part 145": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "CAAC CCAR-145": "bg-red-500/20 text-red-400 border-red-500/30",
  "ISO 9001:2015": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "AS9100D": "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function certColor(cert: string) {
  return CERT_COLORS[cert] ?? "bg-secondary/60 text-muted-foreground border-border";
}

export default function MroDirectoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    aircraftType?: string; serviceType?: string; certification?: string; country?: string;
  }>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useGetMroProfiles({
    q: debouncedSearch || undefined,
    aircraftType: filters.aircraftType || undefined,
    serviceType: filters.serviceType || undefined,
    certification: filters.certification || undefined,
    country: filters.country || undefined,
    page,
    limit: 20,
  });

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as any)._mroSearchTimer);
    (window as any)._mroSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  }

  function setFilter(key: keyof typeof filters, val: string) {
    setFilters(f => ({ ...f, [key]: val || undefined }));
    setPage(1);
  }

  function clearFilter(key: keyof typeof filters) {
    setFilters(f => { const n = { ...f }; delete n[key]; return n; });
    setPage(1);
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-border bg-card/30 py-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Wrench className="w-4 h-4" />
                  <span>Maintenance, Repair & Overhaul Services</span>
                </div>
                <h1 className="text-3xl font-bold text-white">MRO Services Directory</h1>
                <p className="text-muted-foreground mt-1">
                  Find certified MRO providers for aircraft components and maintenance services worldwide.
                </p>
              </div>
              <Link href="/mro/register">
                <Button className="bg-primary hover:bg-primary/90 gap-2 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                  List Your MRO
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or description…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(s => !s)}
              className={`gap-2 border-border ${showFilters || activeFilterCount > 0 ? "border-primary/50 text-primary" : "text-muted-foreground hover:text-white"}`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="border border-border rounded-lg bg-card p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Aircraft Type", key: "aircraftType" as const, options: AIRCRAFT_FAMILIES },
                { label: "Service Type", key: "serviceType" as const, options: SERVICE_TYPES },
                { label: "Certification", key: "certification" as const, options: CERTIFICATIONS },
                { label: "Country", key: "country" as const, options: [] },
              ].map(({ label, key, options }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
                  <div className="relative">
                    {options.length > 0 ? (
                      <select
                        value={filters[key] ?? ""}
                        onChange={e => setFilter(key, e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground appearance-none pr-8"
                      >
                        <option value="">All</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input
                        placeholder={`Filter by ${label.toLowerCase()}…`}
                        value={filters[key] ?? ""}
                        onChange={e => setFilter(key, e.target.value)}
                        className="bg-background border-border text-sm"
                      />
                    )}
                    {filters[key] && (
                      <button onClick={() => clearFilter(key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1">
                  {v}
                  <button onClick={() => clearFilter(k as any)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button onClick={() => { setFilters({}); setPage(1); }}
                className="text-xs text-muted-foreground hover:text-white underline">
                Clear all
              </button>
            </div>
          )}

          <div className="text-sm text-muted-foreground mb-5">
            {isLoading ? "…" : total} MRO provider{total !== 1 ? "s" : ""} found
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-lg bg-card/50 animate-pulse" />
              ))}
            </div>
          ) : data?.profiles.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No MRO providers found</p>
              <p className="text-sm mt-1 mb-4">Try different filters or be the first to list your MRO services</p>
              <Link href="/mro/register">
                <Button className="gap-2"><Plus className="w-4 h-4" />List Your MRO</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.profiles.map(mro => (
                <Link key={mro.id} href={`/mro/${mro.id}`}>
                  <div className="group border border-border rounded-lg bg-card hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer p-5 h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white truncate">{mro.companyName}</h3>
                          {mro.featured && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
                              <Star className="w-3 h-3 fill-amber-400" /> Featured
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{[mro.city, mro.country].filter(Boolean).join(", ")}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2 mt-1" />
                    </div>

                    {/* Description */}
                    {mro.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mro.description}</p>
                    )}

                    {/* Certifications */}
                    {mro.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {mro.certifications.slice(0, 4).map(c => (
                          <span key={c} className={`text-xs border rounded px-1.5 py-0.5 ${certColor(c)}`}>
                            <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" />{c}
                          </span>
                        ))}
                        {mro.certifications.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{mro.certifications.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Service types */}
                    {mro.serviceTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {mro.serviceTypes.slice(0, 3).map(s => (
                          <span key={s} className="text-xs bg-secondary/50 text-muted-foreground rounded px-1.5 py-0.5">
                            {s}
                          </span>
                        ))}
                        {mro.serviceTypes.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{mro.serviceTypes.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Footer meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-1">
                      {mro.turnaroundTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{mro.turnaroundTime}
                        </span>
                      )}
                      {mro.aircraftTypes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Plane className="w-3 h-3" />{mro.aircraftTypes.slice(0, 2).join(", ")}
                          {mro.aircraftTypes.length > 2 && ` +${mro.aircraftTypes.length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="border-border text-muted-foreground hover:text-white">Previous</Button>
              <span className="text-sm text-muted-foreground flex items-center px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="border-border text-muted-foreground hover:text-white">Next</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
