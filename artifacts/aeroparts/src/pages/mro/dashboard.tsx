import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useGetMyMroProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  pending_verification:   "Pending Verification",
  documentation_reviewed: "Documentation Reviewed",
  verified:               "Verified",
};

const STATUS_VARIANTS: Record<string, "secondary" | "outline" | "default"> = {
  pending_verification:   "secondary",
  documentation_reviewed: "outline",
  verified:               "default",
};

export default function MroDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: profile, isLoading: profileLoading } = useGetMyMroProfile();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">You must be signed in to access the MRO dashboard.</p>
        <Button variant="outline" onClick={() => navigate("/seller/login")}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            MRO Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user.companyName ?? user.email}
          </p>
        </div>

        {/* Profile card */}
        {profileLoading ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ) : profile ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {profile.companyName}
                </CardTitle>
                <Badge variant={STATUS_VARIANTS[profile.status] ?? "secondary"}>
                  {STATUS_LABELS[profile.status] ?? profile.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Certifications
                  </p>
                  <p className="text-foreground">
                    {profile.certifications?.length
                      ? profile.certifications.join(", ")
                      : "None listed"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Country
                  </p>
                  <p className="text-foreground">{profile.country ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Service Types
                  </p>
                  <p className="text-foreground">
                    {profile.serviceTypes?.length
                      ? profile.serviceTypes.join(", ")
                      : "None listed"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Contact
                  </p>
                  <p className="text-foreground">{profile.contactEmail ?? "—"}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/mro/${profile.id}`)}
                >
                  View Public Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/rfqs")}
                >
                  Browse RFQs
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                No MRO profile found. Register your organization to appear in the directory.
              </p>
              <Button onClick={() => navigate("/mro/register")}>
                Register MRO Profile
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/rfqs")}
          >
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                RFQ Board
              </p>
              <p className="text-sm text-foreground">Browse open requests for quotes</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/marketplace")}
          >
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Parts Marketplace
              </p>
              <p className="text-sm text-foreground">Search available aircraft parts</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/mro")}
          >
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                MRO Directory
              </p>
              <p className="text-sm text-foreground">View all registered MRO providers</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
