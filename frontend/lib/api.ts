"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("condor_token");
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem("condor_token", token);
}

export function setRefreshToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem("condor_refresh", token);
}

export function clearTokens(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("condor_token");
    localStorage.removeItem("condor_refresh");
  }
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, detail?.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
