"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/session";
import { clearQueryCache, registerQueryClient } from "@/lib/query/client";

/**
 * Wires the non-React parts of the app to the QueryClient and drops the cache when the
 * signed-in identity changes. Identity starts null and flips to the user on the first
 * refresh of a cold load — that transition has nothing user-scoped cached yet, so it is
 * deliberately not treated as a change.
 */
function SessionCacheGuard({ client }: { client: QueryClient }) {
  useEffect(() => {
    registerQueryClient(client);
    return useSession.subscribe((state, prev) => {
      const before = prev.user ? `${prev.user.id}:${prev.user.role}` : null;
      const after = state.user ? `${state.user.id}:${state.user.role}` : null;
      if (before !== null && before !== after) clearQueryCache();
    });
  }, [client]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* attribute="class" is what the `.dark` token block in globals.css and the
          `dark:` variants key off; defaultTheme on <html> needs suppressHydrationWarning
          in layout.tsx because next-themes rewrites it before hydration. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionCacheGuard client={queryClient} />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
