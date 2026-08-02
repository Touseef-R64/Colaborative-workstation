"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/useAuth";

export default function Navbar() {
  const { data: user } = useCurrentUser();
  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <nav className="flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3">
      <Link href="/board" className="font-display text-lg font-semibold text-ink">
        Miro Lite
      </Link>

      <Link
        href="/settings"
        title="Account settings"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-marker-blue text-sm font-semibold text-white transition hover:opacity-90"
      >
        {initial}
      </Link>
    </nav>
  );
}