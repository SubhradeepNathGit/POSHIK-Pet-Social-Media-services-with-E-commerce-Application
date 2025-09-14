"use client";

import { ReactNode, useEffect, useRef, useState, Suspense } from "react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Loader from "@/components/loader";
import { usePathname, useSearchParams } from "next/navigation";

interface ClientLayoutProps {
  children: ReactNode;
}

function ClientLayoutContent({ children }: ClientLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderReady, setLoaderReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathname = useRef<string | null>(null);

  const skipLoaderRoutes = ["/cart", "/checkout", "/checkout/success"];
  const skipLoader = skipLoaderRoutes.includes(pathname);

  const hideLayout =
    pathname.startsWith("/checkout") ||
    pathname === "/feed" ||
    pathname === "/admin" ||
    pathname === "/delete" ||
    pathname === "/signup";

  // Check if this is truly the initial page load
  const checkInitialLoad = () => {
    if (typeof window === "undefined") return true;
    
    const hasVisited = sessionStorage.getItem("hasVisited");
    if (!hasVisited) return true;
    
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return navigation?.type === "reload";
  };

  // Initialize states
  useEffect(() => {
    const isInitial = checkInitialLoad();
    const shouldShow = isInitial && !skipLoader;
    
    setShowLoader(shouldShow);
    setLoaderReady(shouldShow);
    setMounted(true);

    if (shouldShow && !sessionStorage.getItem("hasVisited")) {
      sessionStorage.setItem("hasVisited", "true");
    }
  }, [skipLoader]);

  // Handle loader completion
  useEffect(() => {
    if (!showLoader) return;

    const completeLoader = setTimeout(() => {
      setShowLoader(false);
      // Small delay to ensure smooth transition
      setTimeout(() => setContentReady(true), 100);
    }, 3800); // Slightly longer to account for exit animations

    return () => clearTimeout(completeLoader);
  }, [showLoader]);

  // Set content ready immediately if no loader
  useEffect(() => {
    if (!showLoader && mounted) {
      setContentReady(true);
    }
  }, [showLoader, mounted]);

  // Smooth scroll to top on navigation
  useEffect(() => {
    if (!mounted || !contentReady) return;

    const scrollToTop = () => {
      if (lastPathname.current !== pathname) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        lastPathname.current = pathname;
      }
    };

    requestAnimationFrame(scrollToTop);
  }, [pathname, searchParams, mounted, contentReady]);

  // Server-side rendering fallback
  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#f5f5dc]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 border-7 border-orange-600/50 border-t-orange-700 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loader Layer */}
      {loaderReady && (
        <Loader isLoading={showLoader} />
      )}

      {/* Main Content Layer */}
      <div 
        className={`min-h-screen transition-all duration-1000 ease-out ${
          showLoader ? 'opacity-0 translate-y-8 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
        style={{
          visibility: contentReady ? 'visible' : 'hidden'
        }}
      >
        {!hideLayout && <Navbar />}
        <main>{children}</main>
        {!hideLayout && <Footer />}
      </div>
    </>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <Suspense 
      fallback={
        <div className="fixed inset-0 z-[9999] bg-[#f5f5dc]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-7 border-orange-600/50 border-t-orange-700 rounded-full animate-spin"></div>
          </div>
        </div>
      }
    >
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </Suspense>
  );
}