"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useCatalogSearch(queryString: string) {
  const router = useRouter();
  const urlQuery = new URLSearchParams(queryString).get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const submitted = useRef<string | null>(null);
  useEffect(() => {
    if (submitted.current === urlQuery) { submitted.current = null; return; }
    queueMicrotask(() => setQuery(urlQuery));
  }, [urlQuery]);
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(queryString);
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.set("page", "1");
      submitted.current = query.trim();
      router.replace(`/gestion/productos?${params}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, urlQuery, queryString, router]);
  return [query, setQuery] as const;
}
