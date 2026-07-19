"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startTokenScheduler, stopTokenScheduler } from "@/lib/tokenScheduler";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  useEffect(() => {
    startTokenScheduler(() => router.push("/"));
    return () => stopTokenScheduler();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}