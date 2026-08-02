"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/useAuth";
import { updateUsername, requestEmailChange, changePassword } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Prefill once the current-user query resolves.
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  const usernameMutation = useMutation({
    mutationFn: () => updateUsername(username),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      setUsernameMsg({ type: "ok", text: "Username updated." });
    },
    onError: (err: Error) => setUsernameMsg({ type: "error", text: err.message }),
  });

  const emailMutation = useMutation({
    mutationFn: () => requestEmailChange(email),
    onSuccess: () =>
      setEmailMsg({
        type: "ok",
        text: `Check ${email} for a confirmation link. Your email won't change until you confirm it.`,
      }),
    onError: (err: Error) => setEmailMsg({ type: "error", text: err.message }),
  });

  function handleSignOut() {
    clearTokens();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-ink">Account settings</h1>

        {/* Username */}
        <section className="mt-8 rounded-xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-ink">Username</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUsernameMsg(null);
              usernameMutation.mutate();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-marker-blue focus:ring-2 focus:ring-marker-blue/20"
            />
            <button
              disabled={usernameMutation.isPending}
              className="rounded-lg bg-marker-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </form>
          {usernameMsg && (
            <p className={`mt-2 text-sm ${usernameMsg.type === "ok" ? "text-green-600" : "text-marker-coral"}`}>
              {usernameMsg.text}
            </p>
          )}
        </section>

        {/* Email */}
        <section className="mt-6 rounded-xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-ink">Email</h2>
          <p className="mt-1 text-xs text-ink/50">
            Current: {user?.email || "—"}. Changing this requires confirming the new address.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEmailMsg(null);
              emailMutation.mutate();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-marker-blue focus:ring-2 focus:ring-marker-blue/20"
            />
            <button
              disabled={emailMutation.isPending}
              className="rounded-lg bg-marker-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Send verification
            </button>
          </form>
          {emailMsg && (
            <p className={`mt-2 text-sm ${emailMsg.type === "ok" ? "text-green-600" : "text-marker-coral"}`}>
              {emailMsg.text}
            </p>
          )}
        </section>

        {/* Password */}
        <section className="mt-6 rounded-xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-ink">Password</h2>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="mt-3 rounded-lg border border-ink/10 px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            Change password
          </button>
        </section>

        <button onClick={handleSignOut} className="mt-8 text-sm font-medium text-marker-coral hover:underline">
          Sign out
        </button>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onChanged={handleSignOut}
        />
      )}
    </div>
  );
}

function ChangePasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    // Force a fresh login after a password change — standard security
    // practice, and matches the backend's "please log in again" response.
    onSuccess: onChanged,
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink/70">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-marker-blue focus:ring-2 focus:ring-marker-blue/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-marker-blue focus:ring-2 focus:ring-marker-blue/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-marker-blue focus:ring-2 focus:ring-marker-blue/20"
            />
          </div>

          {error && <p className="text-sm text-marker-coral">{error}</p>}

          <button
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-marker-blue py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}