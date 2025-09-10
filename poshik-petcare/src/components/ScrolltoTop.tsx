"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // keep track of the last pathname
  const lastPathname = useRef(pathname);

  useEffect(() => {
    // if pathname changed → smooth scroll
    if (lastPathname.current !== pathname) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      lastPathname.current = pathname;
    } 
    // if only query params changed (pagination, filters) → instant scroll
    else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [pathname, searchParams]);

  return null;
}
