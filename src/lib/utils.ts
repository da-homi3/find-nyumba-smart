import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong";
}

export function authSubmitLabel(loading: boolean, mode: "signin" | "signup"): string {
  if (loading) return "Please wait…";
  return mode === "signin" ? "Sign in" : "Create account";
}

export function landlordSubmitLabel(loading: boolean, mode: "signin" | "signup"): string {
  if (loading) return "Please wait…";
  return mode === "signup" ? "Create account" : "Sign in";
}

export function viewingStatusTone(status: string): string {
  if (status === "confirmed") return "bg-emerald-500/10 text-emerald-600";
  if (status === "completed") return "bg-blue-500/10 text-blue-600";
  if (status === "cancelled") return "bg-red-500/10 text-red-600";
  return "bg-amber-500/10 text-amber-600";
}
