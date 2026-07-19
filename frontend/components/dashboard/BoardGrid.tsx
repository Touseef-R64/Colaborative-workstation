"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BoardCard, { Board } from "./BoardCard";
import { createBoard, fetchBoards } from "@/lib/api";

export default function BoardGrid() {
  const queryClient = useQueryClient();

  const { data: boards, isLoading, error } = useQuery<Board[]>({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  const createBoardMutation = useMutation({
    mutationFn: createBoard,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards"],
      });
    },
  });

  function handleCreateBoard() {
    const name = window.prompt("Board name");

    if (!name?.trim()) return;

    createBoardMutation.mutate(name);
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        Loading boards...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center text-red-600">
        Failed to load boards.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-10 flex items-center justify-between">

        <h1 className="text-3xl font-bold">
          My Boards
        </h1>

        <button
          onClick={handleCreateBoard}
          disabled={createBoardMutation.isPending}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {createBoardMutation.isPending
            ? "Creating..."
            : "+ New Board"}
        </button>

      </div>

      {boards?.length === 0 ? (
        <div className="rounded-xl border border-dashed p-16 text-center">

          <h2 className="text-xl font-semibold">
            No boards yet
          </h2>

          <p className="mt-2 text-gray-500">
            Create your first collaborative whiteboard.
          </p>

        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards?.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
            />
          ))}
        </div>
      )}
    </div>
  );
}