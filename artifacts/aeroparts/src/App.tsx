import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Marketplace from "@/pages/marketplace";
import ListingDetail from "@/pages/listing-detail";
import SellerRegister from "@/pages/seller/register";
import SellerLogin from "@/pages/seller/login";
import SellerDashboard from "@/pages/seller/dashboard";
import NewListing from "@/pages/seller/new-listing";
import EditListing from "@/pages/seller/edit-listing";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLogin from "@/pages/admin/login";
import AdminChangePassword from "@/pages/admin/change-password";
import AdminCertReview from "@/pages/admin/cert-review";
import Pricing from "@/pages/pricing";
import SubscriptionManagement from "@/pages/seller/subscription";
import RfqsPage from "@/pages/rfqs/index";
import NewRfqPage from "@/pages/rfqs/new";
import RfqDetailPage from "@/pages/rfqs/detail";
import MroDirectoryPage from "@/pages/mro/index";
import MroRegisterPage from "@/pages/mro/register";
import MroDetailPage from "@/pages/mro/detail";
import DebugLoginFreeSeller from "@/pages/debug-login";
import AuthTestPage from "@/pages/auth-test";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/listings/:id" component={ListingDetail} />
      <Route path="/seller/register" component={SellerRegister} />
      <Route path="/seller/login" component={SellerLogin} />
      <Route path="/seller/dashboard" component={SellerDashboard} />
      <Route path="/seller/listings/new" component={NewListing} />
      <Route path="/seller/listings/:id/edit" component={EditListing} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/change-password" component={AdminChangePassword} />
      <Route path="/admin/review-cert/:id" component={AdminCertReview} />
      <Route path="/admin/:section" component={AdminDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/seller/subscription" component={SubscriptionManagement} />
      <Route path="/rfqs" component={RfqsPage} />
      <Route path="/rfqs/new" component={NewRfqPage} />
      <Route path="/rfqs/:id" component={RfqDetailPage} />
      <Route path="/mro" component={MroDirectoryPage} />
      <Route path="/mro/register" component={MroRegisterPage} />
      <Route path="/mro/:id" component={MroDetailPage} />
      <Route path="/debug-login-free-seller" component={DebugLoginFreeSeller} />
      <Route path="/auth-test" component={AuthTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
