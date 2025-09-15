"use client";

import { ReactNode, useEffect, useRef, useState, Suspense } from "react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Loader from "@/components/loader";
import { usePathname, useSearchParams } from "next/navigation";

interface ClientLayoutProps {
  children: ReactNode;
}

// Separate component that uses useSearchParams with Suspense
function LayoutWithSearchParams({ children }: ClientLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(true);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track last route for scroll behavior
  const lastPathname = useRef<string | null>(null);

  // Routes where we disable the global loader
  const skipLoaderRoutes = ["/cart", "/checkout", "/checkout/success", "/dashboard"];
  const skipLoader = skipLoaderRoutes.includes(pathname);

  // Hide Navbar/Footer
  const hideLayout = pathname.startsWith("/checkout") || pathname === "/feed" || pathname === "/dashboard";

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Loader handling (only for non-checkout routes)
  useEffect(() => {
    if (!mounted || skipLoader) return;

    if (pathname === "/404" || pathname === "/not-found") {
      setLoading(false);
      setShowContent(true);
      return;
    }

    let timeout: NodeJS.Timeout;
    const video = document.querySelector<HTMLVideoElement>("video.banner-video");

    if (video) {
      video.preload = "auto";

      const handleVideoReady = () => {
        clearTimeout(timeout);
        setLoading(false);
        setShowContent(true);
      };

      video.addEventListener("canplaythrough", handleVideoReady, { once: true });

      // Fallback if video takes too long
      timeout = setTimeout(() => {
        setLoading(false);
        setShowContent(true);
      }, 4000);

      return () => {
        video.removeEventListener("canplaythrough", handleVideoReady);
        clearTimeout(timeout);
      };
    } else {
      timeout = setTimeout(() => {
        setLoading(false);
        setShowContent(true);
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [pathname, mounted, skipLoader]);

  // Auto scroll to top after route OR query change
  useEffect(() => {
    if (!mounted) return;

    requestAnimationFrame(() => {
      if (lastPathname.current !== pathname) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        lastPathname.current = pathname;
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    });
  }, [pathname, searchParams, mounted]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Global Loader (disabled on cart/checkout routes) */}
      {!skipLoader && (
        <div
          className={`absolute inset-0 z-50 transition-opacity duration-1000 ${
            loading ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Loader isLoading={loading} />
        </div>
      )}

      {/* Content (render only after loader finishes) */}
      {mounted && (!loading || skipLoader) && (
        <div
          className={`transition-opacity duration-1000 ${
            showContent || skipLoader ? "opacity-100" : "opacity-0"
          }`}
        >
          {!hideLayout && <Navbar />}
          <main>{children}</main>
          {!hideLayout && <Footer />}
        </div>
      )}
    </div>
  );
}

// Loading fallback component
function LayoutFallback() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-50">
        <Loader isLoading={true} />
      </div>
    </div>
  );
}

// Main component with Suspense wrapper
export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <Suspense fallback={<LayoutFallback />}>
      <LayoutWithSearchParams>{children}</LayoutWithSearchParams>
    </Suspense>
  );
}
