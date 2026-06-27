"use client";

import { createContext, useContext } from "react";

const BasePathContext = createContext<string>("/dashboard");

export function BasePathProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <BasePathContext.Provider value={value}>
      {children}
    </BasePathContext.Provider>
  );
}

/**
 * Base path of the current product surface — "/dashboard" for the sales SaaS,
 * "/courtier" for the broker SaaS proposal module. Defaults to "/dashboard" so
 * existing sales pages keep working without wrapping them in a provider.
 *
 * Sub-paths stay identical across surfaces (deals, transcripts, archive…), so
 * shared components only need to swap this prefix.
 */
export function useBasePath(): string {
  return useContext(BasePathContext);
}
