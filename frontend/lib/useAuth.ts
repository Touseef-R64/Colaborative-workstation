// lib/useAuth.ts
import { useQuery } from "@tanstack/react-query";
import { authFetch, isLoggedIn } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export interface UserDTO {
  id: number;
  username: string;
  email: string;
}

async function fetchCurrentUser(): Promise<UserDTO | null> {
  if (!isLoggedIn()) return null;
  const res = await authFetch(`${API_URL}/users/auth/me/`);
  if (!res.ok) return null;
  return res.json();
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });
}