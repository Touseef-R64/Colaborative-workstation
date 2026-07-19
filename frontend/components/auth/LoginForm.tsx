"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await login(username, password);
      setTokens(tokens.access, tokens.refresh);
      router.push("/board");
    } catch {
      setError("That username or password isn't right.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink/60">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-marker-blue focus:bg-white focus:ring-2 focus:ring-marker-blue/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink/60">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-marker-blue focus:bg-white focus:ring-2 focus:ring-marker-blue/20"
        />
      </div>

      {error && <p className="text-sm text-marker-coral">{error}</p>}

      <button
        disabled={loading}
        className="w-full rounded-lg bg-marker-blue py-2.5 text-sm font-semibold text-white transition hover:bg-marker-blue/90 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}