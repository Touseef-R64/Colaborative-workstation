"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchUsers, fetchBoardMembers, inviteMember, removeMember } from "@/lib/api";

export default function InviteMembers({ boardId }: { boardId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const { data: results = [] } = useQuery({
    queryKey: ["userSearch", debounced],
    queryFn: () => searchUsers(debounced),
    enabled: isOpen && debounced.length > 0,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["boardMembers", boardId],
    queryFn: () => fetchBoardMembers(boardId),
    enabled: isOpen,
  });

  const invite = useMutation({
    mutationFn: (username: string) => inviteMember(boardId, username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boardMembers", boardId] });
      setQuery("");
    },
  });

  const remove = useMutation({
    mutationFn: (memberId: number) => removeMember(boardId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boardMembers", boardId] }),
  });

  const memberUsernames = new Set(members.map((m) => m.user.username));

  return (
    <div ref={containerRef} onClick={(e) => e.preventDefault()} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        title="Invite people"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow hover:bg-gray-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round" />
          <line x1="16" y1="11" x2="22" y2="11" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-72 rounded-lg border bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Invite people</p>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name..."
            className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />

          {results.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto">
              {results.map((u) => {
                const alreadyMember = memberUsernames.has(u.username);
                return (
                  <li key={u.id} className="flex items-center justify-between py-1 text-sm">
                    <span>{u.username}</span>
                    <button
                      onClick={() => invite.mutate(u.username)}
                      disabled={alreadyMember || invite.isPending}
                      className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white disabled:bg-gray-300"
                    >
                      {alreadyMember ? "Added" : "Invite"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {invite.isError && (
            <p className="mt-1 text-xs text-red-600">{(invite.error as Error).message}</p>
          )}

          <div className="mt-3 border-t pt-2">
            <p className="mb-1 text-xs font-medium text-gray-500">People with access</p>
            <ul className="max-h-40 overflow-y-auto">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-1 text-sm">
                  <span>
                    {m.user.username} <span className="text-xs text-gray-400">({m.role})</span>
                  </span>
                  {m.role !== "owner" && (
                    <button
                      onClick={() => remove.mutate(m.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}