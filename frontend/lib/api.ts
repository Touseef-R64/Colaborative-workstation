const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
import { authFetch } from "./auth";

export interface ElementDTO {
  id: string;
  board: string;
  type: "sticky" | "shape" | "text" | "image" | "stroke";
  props: Record<string, unknown>;
  z_index: number;
}

export interface BoardDTO {
  id: string;
  name: string;
  owner: number | null;
  created_at: string;
  updated_at: string;
}

export interface BoardMemberDTO {
  id: number;
  user: { id: number; username: string };
  role: "owner" | "editor" | "viewer";
  invited_at: string;
}

export async function fetchElements(boardId: string): Promise<ElementDTO[]> {
  const res = await authFetch(`${API_URL}/elements?board=${boardId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load elements: ${res.status}`);
  const data = await res.json();
  return data.results ?? data;
}

export async function searchUsers(query: string): Promise<{ id: number; username: string }[]> {
  if (!query.trim()) return [];
  const res = await authFetch(`${API_URL}/users/search/?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search users");
  return res.json();
}

export async function fetchBoardMembers(boardId: string): Promise<BoardMemberDTO[]> {
  const res = await authFetch(`${API_URL}/boards/${boardId}/members/`);
  if (!res.ok) throw new Error("Failed to fetch board members");
  return res.json();
}

export async function inviteMember(
  boardId: string,
  username: string,
  role: "editor" | "viewer" = "editor"
): Promise<BoardMemberDTO> {
  const res = await authFetch(`${API_URL}/boards/${boardId}/members/`, {
    method: "POST",
    body: JSON.stringify({ username, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "Failed to invite member");
  }
  return res.json();
}

export async function removeMember(boardId: string, memberId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/boards/${boardId}/members/${memberId}/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove member");
}

export async function login(username: string,password:string){

    const res=await fetch(

        `${API_URL}/users/auth/login/`,

        {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                username,
                password

            })

        }

    );

    return res.json();

}

export async function register(username: string,email: string,password:string){

    const res=await fetch(

        `${API_URL}/users/auth/register/`,

        {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                username,
                email,
                password

            })

        }

    );

    return res.json();

}

export async function fetchBoards(): Promise<BoardDTO[]> {
  const res = await authFetch(`${API_URL}/boards/`);

  if (!res.ok) {
    throw new Error("Failed to fetch boards");
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}



export async function createBoard(name: string): Promise<BoardDTO> {
  const res = await authFetch(`${API_URL}/boards/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw new Error("Failed to create board");
  }

  return res.json();
}