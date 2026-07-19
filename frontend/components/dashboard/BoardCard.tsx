"use client";

import Link from "next/link";
import InviteMembers from "./InviteMembers";

export interface Board {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface BoardCardProps {
  board: Board;
}

export default function BoardCard({ board }: BoardCardProps) {
  return (
    <Link className="relative" href={`/board/${board.id}`}>
      {board && (
          <div className="absolute right-4 top-4 z-10"
          onClick={(e) => e.preventDefault()}>
            <InviteMembers boardId={String(board.id)} />
          </div>
        )}
      <div className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          {board.name}
        </h2>

        <div className="space-y-1 text-sm text-gray-500">
          <p>
            Created{" "}
            {new Date(board.created_at).toLocaleDateString()}
          </p>

          <p>
            Updated{" "}
            {new Date(board.updated_at).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-5 text-sm font-medium text-blue-600">
          Open Board →
        </div>
      </div>
    </Link>
  );
}