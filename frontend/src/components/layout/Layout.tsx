import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Move focus to main content on route change for accessibility
  useEffect(() => {
    const heading = mainRef.current?.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main ref={mainRef} className="flex-1" id="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
}
