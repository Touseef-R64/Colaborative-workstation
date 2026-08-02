"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmEmailChange } from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    confirmEmailChange(token)
      .then((res) => {
        setStatus("ok");
        setMessage(res.detail);
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-white p-8 text-center shadow-sm">
        <p className="font-display text-lg font-semibold text-ink">
          {status === "loading" ? "Confirming..." : status === "ok" ? "Email confirmed" : "Something went wrong"}
        </p>
        <p className="mt-2 text-sm text-ink/60">{message}</p>
        <Link href="/settings" className="mt-6 inline-block text-sm font-medium text-marker-blue hover:underline">
          Back to settings
        </Link>
      </div>
    </div>
  );
}