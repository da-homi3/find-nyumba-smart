import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PublicPageShell } from "@/components/SiteNav";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import {
  getAdvertiseInquiryCheckout,
  initiateAdvertisePayment,
  verifyAdvertisePayment,
} from "@/lib/api/payment.functions";
import { ADVERTISE_PACKAGES, advertisePackagePrice } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";
import type { InitiatePaymentInput } from "@/lib/payments/initiate-payment-core";

const packageEnum = z.enum([
  "listing_banner",
  "homepage_hero",
  "neighbourhood",
  "email_newsletter",
  "category_sponsor",
  "whatsapp_blast",
  "custom",
]);

const searchSchema = z.object({
  package: packageEnum.default("listing_banner"),
  ref: z.string().uuid().optional(),
  t: z.string().uuid().optional(),
});

export const Route = createFileRoute("/advertise/pay")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Pay for advertising — NyumbaSearch" }] }),
  component: AdvertisePayPage,
});

function AdvertisePayPage() {
  const { user } = useAuth();
  const { package: packageId, ref: inquiryId, t: checkoutToken } = Route.useSearch();
  const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId) ?? ADVERTISE_PACKAGES[0];
  const amountKes = advertisePackagePrice(packageId);
  const refQuery = inquiryId ? `&ref=${inquiryId}` : "";
  const tokenQuery = checkoutToken ? `&t=${checkoutToken}` : "";
  const checkoutPath = `/advertise/pay?package=${packageId}${refQuery}${tokenQuery}`;

  const { data: inquiry } = useQuery({
    queryKey: ["advertise-inquiry-checkout", inquiryId, checkoutToken],
    enabled: !!inquiryId,
    queryFn: () =>
      getAdvertiseInquiryCheckout({
        data: { inquiryId: inquiryId!, checkoutToken },
      }),
  });

  const defaultEmail = inquiry?.email ?? user?.email ?? "";
  const defaultPhone =
    inquiry?.phone ?? (user?.user_metadata?.phone as string | undefined) ?? user?.phone ?? "";
  const requesterName =
    inquiry?.contactName ?? (user?.user_metadata?.full_name as string | undefined) ?? undefined;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-12">
        <Link to="/advertise" className="text-sm text-primary">
          ← Advertising packages
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">Complete your campaign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pkg.name} · {pkg.placement} · {formatKes(amountKes)}/month
        </p>
        {inquiry?.company ? (
          <p className="mt-1 text-xs text-muted-foreground">For {inquiry.company}</p>
        ) : null}
        {inquiryId && inquiry && !inquiry.unlocked ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            Open the full payment link from your approval email to unlock saved contact details. You
            can still pay by entering the same email used on the enquiry.
          </p>
        ) : null}
        {inquiry?.status === "paid" ? (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            This enquiry is already paid. Our team will activate your ads within 48 hours.
          </p>
        ) : (
          <div className="mt-8">
            <CheckoutFlow
              checkoutPath={checkoutPath}
              lineItem={{
                title: `NyumbaSearch — ${pkg.name}`,
                subtitle: pkg.placement,
                amountKes,
              }}
              metadata={{
                paymentType: "invoice",
                advertisePackage: packageId,
                inquiryId,
                plan: packageId,
                requesterName,
                requesterEmail: defaultEmail || undefined,
                requesterPhone: defaultPhone || undefined,
              }}
              defaultPhone={defaultPhone}
              defaultEmail={defaultEmail}
              requireEmail
              allowQuarterly={false}
              initiateFn={async (data: InitiatePaymentInput) => {
                const email = (data.email ?? defaultEmail).trim();
                if (!email.includes("@")) throw new Error("Email is required");
                return initiateAdvertisePayment({
                  data: {
                    ...data,
                    paymentType: "invoice",
                    advertisePackage: data.advertisePackage ?? packageId,
                    inquiryId: data.inquiryId ?? inquiryId,
                    checkoutToken,
                    email,
                    name: data.name ?? requesterName,
                  },
                });
              }}
              verifyFn={async (paymentId) => {
                const status = await verifyAdvertisePayment({
                  data: { paymentId, inquiryId },
                });
                return {
                  status: status.status,
                  receipt: status.receipt,
                  message: status.message,
                };
              }}
              onSuccess={() => {}}
            />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pay with M-Pesa STK Push or card via Pesapal — same checkout as the rest of NyumbaSearch.
          No account sign-in required; we email your receipt to the address above.
        </p>
      </main>
    </PublicPageShell>
  );
}
