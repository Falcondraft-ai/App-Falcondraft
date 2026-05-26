"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { Toaster } from "@/components/ui/sonner";
import { initPostHog } from "@/lib/posthog/client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  React.useEffect(() => {
    initPostHog();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </LanguageProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
