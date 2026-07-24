/**
 * Normalize credentials before Supabase auth.
 * Mobile keyboards / autofill often inject leading/trailing spaces that make
 * a correct password return "Invalid login credentials".
 */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAuthPassword(password: string): string {
  // Only trim edges — intentional spaces inside a password are preserved.
  return password.trim();
}

export function normalizeAuthCredentials(input: { email: string; password: string }): {
  email: string;
  password: string;
} {
  return {
    email: normalizeAuthEmail(input.email),
    password: normalizeAuthPassword(input.password),
  };
}
