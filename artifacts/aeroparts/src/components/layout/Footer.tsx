export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <span className="text-xl font-bold tracking-tight text-white mb-4 block">AeroParts</span>
            <p className="text-sm text-muted-foreground">
              The precision marketplace for certified aircraft components. Built for MROs, airlines, and brokers.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Marketplace</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/marketplace" className="hover:text-primary transition-colors">Browse Parts</a></li>
              <li><a href="/marketplace?condition=new" className="hover:text-primary transition-colors">New Condition</a></li>
              <li><a href="/marketplace?badge=verified" className="hover:text-primary transition-colors">Verified Listings</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Sellers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/seller/register" className="hover:text-primary transition-colors">Become a Seller</a></li>
              <li><a href="/seller/login" className="hover:text-primary transition-colors">Seller Login</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Seller Guidelines</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Trust & Safety</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Certification Process</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Buyer Protection</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AeroParts Marketplace. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
