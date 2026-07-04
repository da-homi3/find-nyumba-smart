import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PasswordResetFlow } from "@/components/auth/PasswordResetFlow";
import { BrandLogoLink } from "@/components/BrandLogo";

const resetSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = resetSearchSchema.safeParse(search);
    const raw = parsed.success ? parsed.data.email?.trim() : undefined;
    if (!raw?.includes("@")) return { email: undefined };
    return { email: raw };
  },
  head: () => ({ meta: [{ title: "Reset password — NyumbaSearch" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email: emailFromUrl } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <BrandLogoLink className="mt-6" logoClassName="h-10" />
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
          <PasswordResetFlow initialEmail={emailFromUrl ?? ""} />
        </div>
      </div>
    </div>
  );
}
