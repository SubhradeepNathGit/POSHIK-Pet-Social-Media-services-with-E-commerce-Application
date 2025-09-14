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
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lastPathname = useRef<string | null>(null);

  const skipLoaderRoutes = ["/cart", "/checkout", "/checkout/success"];
  const skipLoader = skipLoaderRoutes.includes(pathname);

  const hideLayout =
    pathname.startsWith("/checkout") ||
    pathname === "/feed" ||
    pathname === "/admin" ||
    pathname === "/delete";

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Force 3 sec loader on every route except skipLoaderRoutes
  useEffect(() => {
    if (!mounted || skipLoader) return;

    setLoading(true);
    setShowContent(false);

    const timeout = setTimeout(() => {
      setLoading(false);
      setShowContent(true);
    }, 3000);

    return () => clearTimeout(timeout);
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

      {/* Content */}
      {mounted && (
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

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </Suspense>
  );
}
