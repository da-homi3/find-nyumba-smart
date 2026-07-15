import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ContactRevealAnimation } from "@/components/ContactRevealAnimation";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatKes } from "@/lib/properties";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";
import { getListingUnlockState, unlockListingContact } from "@/lib/api/contact-unlock.functions";
import { pollPaymentUntilComplete } from "@/lib/payments/poll-payment-client";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { errorMessage } from "@/lib/utils";
import type { Property } from "@/lib/properties";

type Props = Readonly<{
  listing: Property;
  onUnlocked?: (phone: string, phones?: string[]) => void;
}>;

function unlockPriceHint(
  trialActive: boolean | undefined,
  freeUnlocksLeft: number,
  isPlus: boolean,
  fee: number,
) {
  if (trialActive && freeUnlocksLeft > 0) {
    const suffix = freeUnlocksLeft === 1 ? "" : "s";
    return (
      <p className="mt-1 text-sm text-emerald-600">
        Free — {freeUnlocksLeft} trial unlock{suffix} remaining
      </p>
    );
  }
  if (isPlus) {
    return <p className="mt-1 text-sm text-emerald-600">Included with your Plus subscription</p>;
  }
  return <p className="mt-1 text-sm text-muted-foreground">{formatKes(fee)} via M-Pesa</p>;
}

function unlockButtonText(
  unlocking: boolean,
  trialActive: boolean | undefined,
  freeUnlocksLeft: number,
) {
  if (unlocking) return null;
  if (trialActive && freeUnlocksLeft > 0) return "Unlock free";
  return "Unlock contact";
}

export function ContactUnlockCard({ listing, onUnlocked }: Props) {
  const { user } = useAuth();
  const { entitlements, isPlus } = useEntitlements();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ["contact-unlock", listing.id, user?.id],
    enabled: !!user,
    queryFn: () => getListingUnlockState({ data: { listingId: listing.id } }),
  });

  const fee = unlockFeeForRent(listing.rent_kes);
  const trialActive = state?.trialActive ?? entitlements.trialActive;
  const freeUnlocksLeft = state?.trialUnlocksRemaining ?? entitlements.trialUnlocksRemaining ?? 0;
  const contactPhone = state?.contactPhone ?? null;
  const contactPhones = state?.contactPhones ?? (contactPhone ? [contactPhone] : []);
  const contactPhonesKey = contactPhones.join("|");
  const unlocked = state?.unlocked ?? false;
  const monthlySpend = state?.monthlyUnlockSpend ?? entitlements.monthlyUnlockSpend ?? 0;

  useEffect(() => {
    if (contactPhone && onUnlocked) onUnlocked(contactPhone, contactPhones);
    // contactPhonesKey avoids unstable array identity re-firing the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phones via key
  }, [contactPhone, contactPhonesKey, onUnlocked]);

  async function applyUnlockedPhone(phone: string, phones?: string[]) {
    void qc.invalidateQueries({ queryKey: ["contact-unlock", listing.id] });
    void qc.invalidateQueries({ queryKey: ["entitlements"] });
    onUnlocked?.(phone, phones?.length ? phones : [phone]);
  }

  async function pollPayment(paymentId: string) {
    await pollPaymentUntilComplete(paymentId);
    const refreshed = await getListingUnlockState({ data: { listingId: listing.id } });
    if (refreshed.unlocked && refreshed.contactPhone) {
      await applyUnlockedPhone(refreshed.contactPhone, refreshed.contactPhones);
      return;
    }
    throw new Error("Payment confirmed but contact unlock is still processing. Refresh the page.");
  }

  async function unlock(method?: "mpesa" | "card") {
    if (!user) {
      toast.error("Sign in to unlock contact details");
      return;
    }
    setUnlocking(true);
    try {
      const res = await unlockListingContact({
        data: {
          listingId: listing.id,
          method,
          phoneNumber: phone || undefined,
        },
      });

      if (res.unlocked && res.contactPhone) {
        await applyUnlockedPhone(
          res.contactPhone,
          "contactPhones" in res ? res.contactPhones : undefined,
        );
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
    } finally {
      setUnlocking(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="font-semibold">Get this landlord&apos;s number</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to unlock contact — {formatKes(fee)} per listing, or free with your trial.
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
      />
    );
  }

  const needsPayment = !isPlus && !(trialActive && freeUnlocksLeft > 0);
  const buttonText = unlockButtonText(unlocking, trialActive, freeUnlocksLeft);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold">Get this landlord&apos;s number</p>
      {unlockPriceHint(trialActive, freeUnlocksLeft, isPlus, fee)}

      {needsPayment && monthlySpend > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          You&apos;ve spent {formatKes(monthlySpend)} on unlocks this month
          {monthlySpend >= 500
            ? " — Plus at KES 500/mo includes unlimited unlocks + messaging."
            : ""}
        </p>
      )}

      {needsPayment && (
        <input
          type="tel"
          placeholder="0712 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-3 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none"
        />
      )}

      <button
        type="button"
        disabled={unlocking}
        onClick={() => void unlock(needsPayment ? "mpesa" : undefined)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {unlocking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Check your phone…
          </>
        ) : (
          buttonText
        )}
      </button>
    </div>
  );
}
