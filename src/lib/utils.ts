import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return formatAuthErrorMessage(err.message);
  if (typeof err === "string") return formatAuthErrorMessage(err);
  if (err != null && typeof err === "object" && "message" in err) {
    const message = Reflect.get(err, "message");
    if (typeof message === "string" && message.trim()) return formatAuthErrorMessage(message);
  }
  return "Something went wrong";
}

function formatAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email rate limit exceeded")) {
    return "Too many verification emails were sent. Try signing in — your account may already exist — or wait about an hour before signing up again.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  return message;
}

export function authSubmitLabel(loading: boolean, mode: "signin" | "signup"): string {
  if (loading) return "Please wait…";
  return mode === "signin" ? "Sign in" : "Create account";
}

export function viewingStatusTone(status: string): string {
  if (status === "confirmed") return "bg-emerald-500/10 text-emerald-600";
  if (status === "completed") return "bg-blue-500/10 text-blue-600";
  if (status === "cancelled") return "bg-red-500/10 text-red-600";
  return "bg-amber-500/10 text-amber-600";
}
