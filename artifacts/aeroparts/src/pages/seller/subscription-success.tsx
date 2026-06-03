import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function SubscriptionSuccessPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">You're all set!</h1>
          <p className="text-muted-foreground mb-8">
            Your plan has been activated. All features are unlocked and ready to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/seller/dashboard">
              <Button className="w-full sm:w-auto px-6">Go to Dashboard</Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" className="w-full sm:w-auto px-6 border-border text-muted-foreground hover:text-white">
                Browse Parts
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
