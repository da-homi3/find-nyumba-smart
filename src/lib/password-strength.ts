export type PasswordStrength = {
  score: number;
  label: string;
  barClass: string;
};

export function scorePassword(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "Enter a password", barClass: "bg-muted" };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak", barClass: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", barClass: "bg-amber-500" };
  return { score, label: "Strong", barClass: "bg-emerald-500" };
}
