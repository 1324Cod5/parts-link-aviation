import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ReactNode } from "react";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
