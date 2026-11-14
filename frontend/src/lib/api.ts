import { sim } from "../sim/client";
import { BROWSER_RUNTIME } from "./runtime";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (BROWSER_RUNTIME) return sim().request<T>(method, url, body);
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body: unknown = {}) => request<T>("POST", url, body),
};
