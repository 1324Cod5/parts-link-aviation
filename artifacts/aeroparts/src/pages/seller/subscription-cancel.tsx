import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft } from "lucide-react";

export default function SubscriptionCancelPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-secondary/50 border border-border flex items-center justify-center mx-auto mb-6">
            <X className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">No changes made</h1>
          <p className="text-muted-foreground mb-8">
            You cancelled the checkout — your current plan wasn't changed. You can upgrade at any time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/pricing">
              <Button className="w-full sm:w-auto px-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pricing
              </Button>
            </Link>
            <Link href="/seller/dashboard">
              <Button variant="outline" className="w-full sm:w-auto px-6 border-border text-muted-foreground hover:text-white">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
