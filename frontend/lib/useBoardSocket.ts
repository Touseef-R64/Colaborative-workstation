import { useEffect, useRef } from "react";
import { useBoardStore } from "./store";
import { ElementDTO } from "./api";
import { getAccessToken } from "./auth";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8001/ws";

type NewElement = Omit<ElementDTO, "board" | "id"> & { id?: string };

type OutgoingMessage =
  | { action: "element.create"; element: NewElement }
  | { action: "element.update"; id: string; props: Record<string, unknown> }
  | { action: "element.delete"; id: string }
  | { action: "element.lock"; id: string }
  | { action: "element.unlock"; id: string }
  | { action: "cursor.move"; x: number; y: number };

export function useBoardSocket(boardId: string) {
  const accessToken = getAccessToken();
  const socketRef = useRef<WebSocket | null>(null);
  const { upsertElement, removeElement, setCursor, lockElement, unlockElement } =
    useBoardStore();

  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}/boards/${boardId}/?token=${accessToken}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.action) {
        case "element.create":
        case "element.update":
          upsertElement(msg.element ?? { id: msg.id, ...msg });
          break;
        case "element.delete":
          removeElement(msg.id);
          break;
        case "cursor.move":
          setCursor(msg.user, msg.x, msg.y);
          break;
        case "element.lock":
          lockElement(msg.id, msg.user);
          break;
        case "element.unlock":
          unlockElement(msg.id);
          break;
      }
    };

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const send = (message: OutgoingMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return { send };
}
