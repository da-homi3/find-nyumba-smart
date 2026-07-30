import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  confirmPayoutPhoneOtp,
  createPayoutDestination,
  deactivatePayoutDestination,
  listKenyaBanks,
  listPayoutBatches,
  listPayoutDestinations,
  sendPayoutPhoneOtp,
} from "@/lib/api/pm-payout.functions";
import { listPmProperties } from "@/lib/api/pm.functions";
import { formatKes } from "@/lib/properties";
import { calculatePlatformFee } from "@/lib/pm/platform-fee";

type DestType = "bank_account" | "mpesa_phone" | "mpesa_paybill" | "mpesa_till";

type SavedDestination = {
  id: string;
  destination_type: string;
  verified: boolean;
  is_active: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  mpesa_phone: string | null;
  mpesa_paybill_number: string | null;
  mpesa_till_number: string | null;
  property_id: string | null;
};

type PayoutBatch = {
  id: string;
  total_net_payout: number;
  total_gross: number;
  total_platform_fee: number;
  status: string;
  completed_at: string | null;
  created_at: string;
};

const TYPE_OPTIONS: Array<{ id: DestType; label: string }> = [
  { id: "bank_account", label: "Bank account" },
  { id: "mpesa_phone", label: "M-Pesa phone" },
  { id: "mpesa_paybill", label: "Paybill" },
  { id: "mpesa_till", label: "Till number" },
];

function destinationDetails(destination: SavedDestination): string {
  if (destination.bank_name) {
    return `${destination.bank_name} · ${destination.bank_account_number}`;
  }
  if (destination.mpesa_phone) return destination.mpesa_phone;
  if (destination.mpesa_paybill_number) {
    return `Paybill ${destination.mpesa_paybill_number}`;
  }
  if (destination.mpesa_till_number) {
    return `Till ${destination.mpesa_till_number}`;
  }
  return "—";
}

function payoutDateLabel(batch: PayoutBatch): string {
  if (batch.completed_at) {
    return `Paid out ${new Date(batch.completed_at).toLocaleDateString("en-KE")}`;
  }
  return `Created ${new Date(batch.created_at).toLocaleDateString("en-KE")}`;
}

function payoutDestinationPayload(state: {
  type: DestType;
  propertyId: string;
  bankCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  mpesaPhone: string;
  mpesaPaybill: string;
  mpesaAccount: string;
  mpesaTill: string;
  otpVerified: boolean;
}) {
  return {
    destinationType: state.type,
    propertyId: state.propertyId || null,
    bankCode: state.bankCode || null,
    bankName: state.bankName || null,
    bankAccountNumber: state.bankAccountNumber || null,
    bankAccountName: state.bankAccountName || null,
    mpesaPhone: state.mpesaPhone || null,
    mpesaPaybillNumber: state.mpesaPaybill || null,
    mpesaAccountNumber: state.mpesaAccount || null,
    mpesaTillNumber: state.mpesaTill || null,
    otpVerified:
      state.type === "mpesa_phone" || state.type === "mpesa_till" ? state.otpVerified : undefined,
  };
}

function DestinationsSection(props: Readonly<{
  isLoading: boolean;
  destinations: SavedDestination[];
  onRemove: (id: string) => void;
}>) {
  const { isLoading, destinations, onRemove } = props;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Saved destinations
      </h2>
      {isLoading ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : null}
      {!isLoading && destinations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
      ) : null}
      {!isLoading && destinations.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {destinations.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {d.destination_type.replaceAll("_", " ")}
                  {d.property_id ? " · property override" : " · account default"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {destinationDetails(d)} · {d.verified ? "verified" : "unverified"}
                </div>
              </div>
              {d.is_active ? (
                <button
                  type="button"
                  className="text-xs text-destructive"
                  onClick={() => onRemove(d.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PayoutHistorySection(props: Readonly<{ isLoading: boolean; payoutBatches: PayoutBatch[] }>) {
  const { isLoading, payoutBatches } = props;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Payout history
      </h2>
      {isLoading ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : null}
      {!isLoading && payoutBatches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No payouts yet.</p>
      ) : null}
      {!isLoading && payoutBatches.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {payoutBatches.map((b) => (
            <li key={b.id} className="rounded-xl border border-border px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{formatKes(b.total_net_payout)}</strong>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {b.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Gross {formatKes(b.total_gross)} · Platform fee (1%) {formatKes(b.total_platform_fee)}
              </p>
              <p className="text-xs text-muted-foreground">{payoutDateLabel(b)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PortalPayoutSettingsPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<DestType>("bank_account");
  const [propertyId, setPropertyId] = useState<string>("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaPaybill, setMpesaPaybill] = useState("");
  const [mpesaAccount, setMpesaAccount] = useState("");
  const [mpesaTill, setMpesaTill] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  const destQ = useQuery({
    queryKey: ["pm-payout-destinations"],
    queryFn: () => listPayoutDestinations(),
  });
  const batchesQ = useQuery({
    queryKey: ["pm-payout-batches"],
    queryFn: () => listPayoutBatches(),
  });
  const banksQ = useQuery({
    queryKey: ["kenya-banks"],
    queryFn: () => listKenyaBanks(),
  });
  const propsQ = useQuery({
    queryKey: ["pm-properties", "payout"],
    queryFn: () => listPmProperties(),
  });

  const save = useMutation({
    mutationFn: () =>
      createPayoutDestination({
        data: payoutDestinationPayload({
          type,
          propertyId,
          bankCode,
          bankName,
          bankAccountNumber,
          bankAccountName,
          mpesaPhone,
          mpesaPaybill,
          mpesaAccount,
          mpesaTill,
          otpVerified,
        }),
      }),
    onSuccess: (res) => {
      if (res.verified) toast.success("Payout destination saved and verified");
      else toast.warning(res.warning || "Saved, but not verified yet");
      if (res.warning && res.verified) toast.message(res.warning);
      qc.invalidateQueries({ queryKey: ["pm-payout-destinations"] });
      setOtpVerified(false);
      setOtp("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendOtp = useMutation({
    mutationFn: () => sendPayoutPhoneOtp({ data: { phone: mpesaPhone } }),
    onSuccess: () => toast.success("Confirmation code sent to your email"),
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmOtp = useMutation({
    mutationFn: () => confirmPayoutPhoneOtp({ data: { phone: mpesaPhone, code: otp } }),
    onSuccess: () => {
      setOtpVerified(true);
      toast.success("Number confirmed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (destinationId: string) =>
      deactivatePayoutDestination({ data: { destinationId } }),
    onSuccess: () => {
      toast.success("Destination removed");
      qc.invalidateQueries({ queryKey: ["pm-payout-destinations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exampleFee = calculatePlatformFee(15_000);
  const destinations = (destQ.data ?? []) as SavedDestination[];
  const payoutBatches = (batchesQ.data ?? []) as PayoutBatch[];
  const handleTypeChange = (nextType: DestType) => {
    setType(nextType);
    setOtpVerified(false);
  };
  const handleBankSelect = (code: string) => {
    setBankCode(code);
    const bank = (banksQ.data ?? []).find((item) => item.code === code);
    setBankName(bank?.name ?? "");
  };
  const handleMpesaPhoneChange = (value: string) => {
    setMpesaPhone(value);
    setOtpVerified(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">Rent payouts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add the bank account, M-Pesa number, paybill, or till where rent should land. When a tenant
        pays through NyumbaSearch, we deduct 1% and send the rest to your destination within minutes.
        Example: KES 15,000 rent → you receive {formatKes(exampleFee.netPayoutAmount)} (fee{" "}
        {formatKes(exampleFee.platformFee)}).
      </p>

      <section className="mt-8 rounded-2xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add destination
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleTypeChange(opt.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                type === opt.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs">
          <span className="font-medium">Scope</span>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Default for all my properties</option>
            {(propsQ.data ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                Override: {p.name}
              </option>
            ))}
          </select>
        </label>

        {type === "bank_account" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs">
              <span className="font-medium">Bank</span>
              <select
                value={bankCode}
                onChange={(e) => handleBankSelect(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">Select bank</option>
                {(banksQ.data ?? []).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-medium">Account number</span>
              <input
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium">Account name (must match bank records)</span>
              <input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        {type === "mpesa_phone" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs">
              <span className="font-medium">M-Pesa phone</span>
              <input
                value={mpesaPhone}
                onChange={(e) => handleMpesaPhoneChange(e.target.value)}
                placeholder="07XXXXXXXX"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sendOtp.isPending}
                onClick={() => sendOtp.mutate()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              >
                Send code
              </button>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-28 rounded-lg border border-border px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={confirmOtp.isPending}
                onClick={() => confirmOtp.mutate()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              >
                Confirm
              </button>
              {otpVerified ? (
                <span className="self-center text-xs font-medium text-emerald-600">Verified</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {type === "mpesa_paybill" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs">
              <span className="font-medium">Paybill number</span>
              <input
                value={mpesaPaybill}
                onChange={(e) => setMpesaPaybill(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium">Account number to quote</span>
              <input
                value={mpesaAccount}
                onChange={(e) => setMpesaAccount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        {type === "mpesa_till" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs">
              <span className="font-medium">Till number</span>
              <input
                value={mpesaTill}
                onChange={(e) => setMpesaTill(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="mt-5 inline-flex rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save payout destination"}
        </button>
      </section>

      <DestinationsSection
        isLoading={destQ.isLoading}
        destinations={destinations}
        onRemove={(id) => deactivate.mutate(id)}
      />

      <PayoutHistorySection isLoading={batchesQ.isLoading} payoutBatches={payoutBatches} />
    </div>
  );
}
