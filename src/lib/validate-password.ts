const HAS_DIGIT = /\d/;

export function validatePasswordPair(password: string, confirmPassword: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!HAS_DIGIT.test(password)) return "Password must include at least one number";
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!HAS_DIGIT.test(password)) return "Password must include at least one number";
  return null;
}
