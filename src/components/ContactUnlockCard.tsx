import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ContactRevealAnimation } from "@/components/ContactRevealAnimation";
import { MpesaPhonePicker } from "@/components/checkout/MpesaPhonePicker";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatKes } from "@/lib/properties";
import { contactAccessLabel, unlockFeeExplanation, unlockFeeForRent } from "@/lib/payments/unlock-pricing";
import { getListingUnlockState, unlockListingContact } from "@/lib/api/contact-unlock.functions";
import { pollPaymentUntilComplete } from "@/lib/payments/poll-payment-client";
import { useAuth } from "@/hooks/use-auth";
import { useProfilePhone } from "@/hooks/use-profile-phone";
import { useEntitlements } from "@/hooks/use-entitlements";
import { isKenyanPhone } from "@/lib/phone";
import { errorMessage } from "@/lib/utils";
import { randomUuid } from "@/lib/random-uuid";
import { TENANT_FREE_UNLOCK_ALLOWANCE } from "@/lib/payments/tenant-trial";
import { TENANT_PLUS_CONFIG } from "@/lib/revenue/tenant-plus-config";
import type { Property } from "@/lib/properties";

type Props = Readonly<{
  listing: Property;
  onUnlocked?: (phone: string, phones?: string[]) => void;
}>;

function unlockPriceHint(opts: {
  trialActive: boolean | undefined;
  freeUnlocksLeft: number;
  isPlus: boolean;
  fee: number;
  plusCredits: number;
  creditsRequired: number;
}) {
  if (opts.isPlus && opts.plusCredits >= opts.creditsRequired) {
    return (
      <p className="mt-1 text-sm text-emerald-600">
        Included with Tenant Plus — {opts.plusCredits} credit
        {opts.plusCredits === 1 ? "" : "s"} remaining ({opts.creditsRequired} for this listing)
      </p>
    );
  }
  if (opts.isPlus) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ve used your included contact credits. Pay {formatKes(opts.fee)} for this listing,
        or wait until your next Plus period.
      </p>
    );
  }
  if (opts.trialActive && opts.freeUnlocksLeft > 0) {
    const suffix = opts.freeUnlocksLeft === 1 ? "" : "s";
    return (
      <p className="mt-1 text-sm text-emerald-600">
        Free — {opts.freeUnlocksLeft} of {TENANT_FREE_UNLOCK_ALLOWANCE} unlock{suffix} remaining
      </p>
    );
  }
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {contactAccessLabel(opts.fee)} — {formatKes(opts.fee)}. One-time access to this landlord&apos;s
      contact details.
    </p>
  );
}

function unlockButtonLabel(opts: {
  unlocking: boolean;
  needsPayment: boolean;
  isPlus: boolean;
  fee: number;
}): string {
  if (opts.unlocking) {
    return opts.needsPayment ? "Check your phone…" : "Unlocking…";
  }
  if (opts.needsPayment) return `Pay ${formatKes(opts.fee)} with M-Pesa`;
  if (opts.isPlus) return "Unlock contact";
  return "Unlock free";
}

function SignInUnlockCard() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold">Get this landlord&apos;s number</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in for 1 free unlock, then KES 50–500 via M-Pesa per listing — or Plus for monthly
        contact credits.
      </p>
      <Link
        to="/auth"
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
      >
        Sign in to unlock
      </Link>
    </div>
  );
}

function NoContactOnFileCard() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold">Contact not on file yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This listing is unlocked for you, but the landlord has not added a phone number. Check back
        soon or message support if this persists.
      </p>
    </div>
  );
}

export function ContactUnlockCard({ listing, onUnlocked }: Props) {
  const { user } = useAuth();
  const { phone: linkedPhone } = useProfilePhone();
  const { entitlements, isPlus } = useEntitlements();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const idempotencyRef = useRef(randomUuid());

  useEffect(() => {
    if (linkedPhone && !phone) setPhone(linkedPhone);
  }, [linkedPhone, phone]);

  const { data: state, isLoading } = useQuery({
    queryKey: ["contact-unlock", listing.id, user?.id],
    enabled: !!user,
    queryFn: () => getListingUnlockState({ data: { listingId: listing.id } }),
  });

  const fee = state?.fee ?? unlockFeeForRent(listing.rent_kes);
  const trialActive = state?.trialActive ?? entitlements.trialActive;
  const freeUnlocksLeft = state?.trialUnlocksRemaining ?? entitlements.trialUnlocksRemaining ?? 0;
  const contactPhone = state?.contactPhone ?? null;
  const contactPhones = state?.contactPhones ?? (contactPhone ? [contactPhone] : []);
  const contactPhonesKey = contactPhones.join("|");
  const unlocked = state?.unlocked ?? false;
  const monthlySpend = state?.monthlyUnlockSpend ?? entitlements.monthlyUnlockSpend ?? 0;
  const hasFreeUnlock = Boolean(trialActive && freeUnlocksLeft > 0);
  const plusCredits = Number(state?.plusContactCredits ?? entitlements.plusContactCredits ?? 0);
  const creditsRequired = Number(state?.creditsRequired ?? 1);
  const plusCanCover = isPlus && plusCredits >= creditsRequired;
  const needsPayment = !plusCanCover && !hasFreeUnlock;

  useEffect(() => {
    if (contactPhone && onUnlocked) onUnlocked(contactPhone, contactPhones);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phones via key
  }, [contactPhone, contactPhonesKey, onUnlocked]);

  async function applyUnlockedPhone(phoneValue: string, phones?: string[]) {
    void qc.invalidateQueries({ queryKey: ["contact-unlock", listing.id] });
    void qc.invalidateQueries({ queryKey: ["entitlements"] });
    onUnlocked?.(phoneValue, phones?.length ? phones : [phoneValue]);
  }

  async function pollPayment(paymentId: string) {
    await pollPaymentUntilComplete(paymentId);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const refreshed = await getListingUnlockState({ data: { listingId: listing.id } });
      if (refreshed.unlocked && refreshed.contactPhone) {
        await applyUnlockedPhone(refreshed.contactPhone, refreshed.contactPhones);
        return;
      }
      if (refreshed.unlocked && !refreshed.contactPhone) {
        throw new Error("Payment confirmed but this listing has no phone number on file yet.");
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    throw new Error("Payment confirmed but contact unlock is still processing. Refresh the page.");
  }

  async function unlock(method?: "mpesa" | "card") {
    if (!user) {
      toast.error("Sign in to unlock contact details");
      return;
    }
    const payerPhone = phone.trim() || linkedPhone || "";
    if (method === "mpesa" && !isKenyanPhone(payerPhone)) {
      toast.error("Enter a valid M-Pesa phone number");
      return;
    }
    setUnlocking(true);
    try {
      const res = await unlockListingContact({
        data: {
          listingId: listing.id,
          method,
          phoneNumber: method === "mpesa" ? payerPhone : undefined,
          idempotencyKey: idempotencyRef.current,
        },
      });

      if (res.unlocked && res.contactPhone) {
        await applyUnlockedPhone(
          res.contactPhone,
          "contactPhones" in res ? res.contactPhones : undefined,
        );
        toast.success("Contact unlocked");
        return;
      }

      if ("error" in res && res.error === "no_contact") {
        toast.error(res.message ?? "Phone number is not available yet");
        return;
      }

      const pending = "paymentId" in res && res.paymentId && res.status === "pending";
      if (pending && res.paymentId) {
        toast.message(res.message ?? "Check your phone for the M-Pesa prompt");
        await pollPayment(res.paymentId);
        toast.success("Contact unlocked");
      }
    } catch (err) {
      toast.error(errorMessage(err));
      idempotencyRef.current = randomUuid();
    } finally {
      setUnlocking(false);
    }
  }

  if (!user) return <SignInUnlockCard />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading contact options…
      </div>
    );
  }

  if (unlocked && contactPhone) {
    return (
      <ContactRevealAnimation
        phone={contactPhone}
        phones={contactPhones}
        listingTitle={listing.title}
        neighborhood={listing.neighborhood}
        listingId={listing.id}
      />
    );
  }

  if (unlocked && !contactPhone) {
    return <NoContactOnFileCard />;
  }

  const buttonLabel = unlockButtonLabel({ unlocking, needsPayment, isPlus, fee });
  const spendHint =
    needsPayment && monthlySpend >= 500 ? " — Plus includes monthly contact credits." : "";

  return (
    <LockedContactPanel
      trialActive={trialActive}
      freeUnlocksLeft={freeUnlocksLeft}
      isPlus={isPlus}
      fee={fee}
      plusCredits={plusCredits}
      creditsRequired={creditsRequired}
      needsPayment={needsPayment}
      monthlySpend={monthlySpend}
      spendHint={spendHint}
      linkedPhone={linkedPhone}
      phone={phone}
      onPhoneChange={setPhone}
      unlocking={unlocking}
      buttonLabel={buttonLabel}
      onUnlock={() => void unlock(needsPayment ? "mpesa" : undefined)}
    />
  );
}

function LockedContactPanel({
  trialActive,
  freeUnlocksLeft,
  isPlus,
  fee,
  plusCredits,
  creditsRequired,
  needsPayment,
  monthlySpend,
  spendHint,
  linkedPhone,
  phone,
  onPhoneChange,
  unlocking,
  buttonLabel,
  onUnlock,
}: Readonly<{
  trialActive: boolean | undefined;
  freeUnlocksLeft: number;
  isPlus: boolean;
  fee: number;
  plusCredits: number;
  creditsRequired: number;
  needsPayment: boolean;
  monthlySpend: number;
  spendHint: string;
  linkedPhone: string | null;
  phone: string;
  onPhoneChange: (value: string) => void;
  unlocking: boolean;
  buttonLabel: string;
  onUnlock: () => void;
}>) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold">Get this landlord&apos;s number</p>
      {unlockPriceHint({
        trialActive,
        freeUnlocksLeft,
        isPlus,
        fee,
        plusCredits,
        creditsRequired,
      })}

      {needsPayment && monthlySpend > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          You&apos;ve spent {formatKes(monthlySpend)} unlocking property contacts this month
          {spendHint}
        </p>
      )}
      {needsPayment ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{unlockFeeExplanation()}</p>
      ) : null}

      {needsPayment && (
        <div className="mt-3">
          <MpesaPhonePicker
            linkedPhone={linkedPhone}
            value={phone}
            onChange={onPhoneChange}
            disabled={unlocking}
          />
        </div>
      )}

      <button
        type="button"
        disabled={unlocking}
        onClick={onUnlock}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {buttonLabel}
      </button>

      {needsPayment ? (
        <Link
          to="/tenant/checkout"
          search={{ plan: "plus" }}
          className="mt-2 flex w-full items-center justify-center rounded-xl border py-2.5 text-sm font-semibold text-primary"
        >
          Or get Tenant Plus — {TENANT_PLUS_CONFIG.contactCreditsPerMonth} credits / month
        </Link>
      ) : null}
    </div>
  );
}
