export type ResetStep = "request" | "otp" | "password";

const TITLES: Record<ResetStep, string> = {
  request: "Reset your password",
  otp: "Enter the 6-digit code",
  password: "Set your new password",
};

export function resetStepTitle(step: ResetStep): string {
  return TITLES[step];
}

export function resetStepSubtitle(step: ResetStep, email: string): string {
  if (step === "request") {
    return "We'll email you a 6-digit code. Enter it here, then choose a new password.";
  }
  if (step === "otp") {
    return `Enter the 6-digit code we sent to ${email || "your email"}.`;
  }
  return "Choose a strong password you have not used before. You'll sign in with it next.";
}
