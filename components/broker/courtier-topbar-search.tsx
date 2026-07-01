"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { FileText, Loader2, ScrollText, Search, Users } from "lucide-react";
import { BrokerStatusBadge } from "@/components/broker/broker-status-badge";

type SearchType = "client" | "contract" | "document";

type SearchResult = {
  id: string;
  type: SearchType;
  href: string;
  title: string;
  subtitle: string;
  status?: string;
};

const typeMeta: Record<
  SearchType,
  { label: string; icon: React.ReactNode }
> = {
  client: {
    label: "Dossier",
    icon: <Users className="size-3.5" strokeWidth={1.75} />,
  },
  contract: {
    label: "Contrat",
    icon: <ScrollText className="size-3.5" strokeWidth={1.75} />,
  },
  document: {
    label: "Document",
    icon: <FileText className="size-3.5" strokeWidth={1.75} />,
  },
};

export function CourtierTopbarSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [focus, setFocus] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= 2;

  React.useEffect(() => {
    function handle(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setFocus(false);
      }
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  React.useEffect(() => {
    if (!shouldSearch) {
      setResults(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/broker/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
        setActiveIndex(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, shouldSearch]);

  const open = focus && (loading || shouldSearch);

  function goTo(href: string) {
    setFocus(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!results || results.length === 0) {
      if (event.key === "Escape") {
        setQuery("");
        (event.currentTarget as HTMLInputElement).blur();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) goTo(target.href);
    } else if (event.key === "Escape") {
      setQuery("");
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  return (
    <div ref={containerRef} className="relative hidden w-full md:block">
      <div
        className="relative flex h-10 items-center"
        style={{
          background: focus ? "#FFFFFF" : "var(--brand-navy-50)",
          border: `1px solid ${focus ? "var(--accent)" : "var(--border-1)"}`,
          borderRadius: 8,
          boxShadow: focus ? "0 0 0 3px rgba(184,146,42,.18)" : "none",
          transition:
            "background 120ms var(--ease-out), border-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out)",
        }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 size-4"
          style={{ color: "var(--fg-3)" }}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocus(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-full w-full bg-transparent pr-10 pl-10 text-[13.5px] outline-none placeholder:text-[var(--fg-3)]"
          style={{ color: "var(--fg-1)" }}
          aria-autocomplete="list"
          aria-controls="courtier-search-results"
        />
        {loading ? (
          <Loader2
            className="absolute right-3 size-4 animate-spin"
            style={{ color: "var(--fg-3)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {open ? (
        <div
          id="courtier-search-results"
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-full overflow-hidden rounded-lg border bg-white"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {results && results.length > 0 ? (
            <ul className="max-h-[360px] overflow-y-auto py-1">
              {results.map((result, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={result.id}>
                    <Link
                      href={result.href}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setFocus(false);
                        setQuery("");
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                      style={{
                        background: isActive
                          ? "var(--brand-navy-50)"
                          : "transparent",
                      }}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: "var(--brand-navy-50)",
                          color: "var(--brand-navy-700)",
                          border: "1px solid var(--border-1)",
                        }}
                      >
                        {typeMeta[result.type]?.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                          {result.title}
                        </p>
                        <p className="truncate text-[12px] text-[var(--fg-3)]">
                          {result.subtitle}
                        </p>
                      </div>
                      {result.type === "client" && result.status ? (
                        <BrokerStatusBadge
                          status={result.status}
                          showDot={false}
                        />
                      ) : (
                        <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--fg-4)]">
                          {typeMeta[result.type]?.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : loading ? null : results && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--fg-3)]">
              Aucun résultat pour «&nbsp;{trimmed}&nbsp;».
            </p>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--fg-3)]">
              Tapez au moins 2 caractères pour rechercher.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
