import { fireAlert } from "@/lib/alerts/fire-alert";

export const Monitors = {
  mpesaStkFailed: (paymentId: string, phone: string, error: string) =>
    fireAlert("warning", "payment", "M-Pesa STK push failed", {
      paymentId,
      phone: phone.slice(-4).padStart(phone.length, "*"),
      error,
    }),

  paymentFulfillFailed: (paymentId: string, purpose: string, error: string) =>
    fireAlert(
      "critical",
      "payment",
      "Payment fulfilment failed — user may have paid without access",
      {
        paymentId,
        purpose,
        error,
      },
    ),

  cronJobFailed: (cronName: string, error: string) =>
    fireAlert("critical", "cron", `Cron job failed: ${cronName}`, { cronName, error }),

  highLatency: (path: string, ms: number) =>
    fireAlert("warning", "api", `High latency: ${path} → ${ms}ms`, { path, ms }),

  emailSendFailed: (templateId: string, toEmail: string, error: string) =>
    fireAlert("warning", "email", `Email send failed: ${templateId}`, {
      templateId,
      toEmail: toEmail.replace(/(.{2}).+(@.+)/, "$1***$2"),
      error,
    }),

  healthCheckFailed: (checks: unknown[]) =>
    fireAlert("critical", "worker", "Health check FAILED", { checks }),
};
