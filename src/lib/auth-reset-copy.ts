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
  if (step === "request") return "We'll email you a secure code and reset link.";
  if (step === "otp") {
    return `We sent instructions to ${email || "your email"}. You can also use the link in the email.`;
  }
  return "Choose a strong password you have not used before.";
}
