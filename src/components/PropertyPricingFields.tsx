import type { ReactNode } from "react";
import type { PropertyType, PricingMode, PricePeriod } from "@/lib/property-types";
/* eslint-disable react-refresh/only-export-components -- pricing helpers share this module with form UI */
import {
  COMMERCIAL_MIN_RENT_PERIODS,
  defaultPricePeriod,
  defaultPricingMode,
  isCommercialType,
  isNightlyRentType,
  listingPriceAmountLabel,
  PRICE_PERIODS,
  pricingModeOptionsForPropertyType,
  supportsBookingPricing,
  supportsRentSaleChoice,
} from "@/lib/property-types";
import { USD_TO_KES_RATE, type ListingPriceCurrency } from "@/lib/currency/usd-kes";
import { cn } from "@/lib/utils";

export type PricingFormSlice = {
  property_type: PropertyType;
  pricing_mode: PricingMode;
  price_period: PricePeriod | "";
  price_currency: ListingPriceCurrency;
  rent_kes: number | string;
  rent_kes_max: number | string;
  deposit_kes: number | string;
  minimum_rent_period_months: number | "";
};

type FieldProps = Readonly<{
  label: ReactNode;
  children: React.ReactNode;
  full?: boolean;
}>;

type PricingUpdate = <K extends keyof PricingFormSlice>(key: K, value: PricingFormSlice[K]) => void;

function Field({ label, children, full }: FieldProps) {
  return (
    <label className={cn("block", full && "col-span-full")}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function applyPropertyTypePricingDefaults(
  propertyType: PropertyType,
): Pick<
  PricingFormSlice,
  "pricing_mode" | "price_period" | "minimum_rent_period_months" | "rent_kes_max"
> {
  const pricing_mode = defaultPricingMode(propertyType);
  const price_period = defaultPricePeriod(propertyType, pricing_mode) ?? "";
  return {
    pricing_mode,
    price_period,
    minimum_rent_period_months: "",
    rent_kes_max: "",
  };
}

function applyPricingModeChange(
  nextMode: PricingMode,
  isCommercial: boolean,
  update: PricingUpdate,
) {
  update("pricing_mode", nextMode);
  if (nextMode === "sale") {
    update("price_period", "");
    update("minimum_rent_period_months", "");
    update("deposit_kes", "");
    return;
  }
  if (nextMode === "rent") {
    update("price_period", "month");
    update("minimum_rent_period_months", "");
    if (!isCommercial) update("rent_kes_max", "");
    return;
  }
  update("price_period", "night");
  update("minimum_rent_period_months", "");
  if (!isCommercial) update("rent_kes_max", "");
}

function CurrencyToggle({
  currency,
  update,
}: Readonly<{ currency: ListingPriceCurrency; update: PricingUpdate }>) {
  return (
    <Field label="Price currency" full>
      <div className="flex gap-2">
        {(["KES", "USD"] as const).map((option) => {
          const selected = currency === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => update("price_currency", option)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {currency === "USD" ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Stored in USD for display. Unlock fees and filters still use the KES equivalent (~
          {USD_TO_KES_RATE} KES / USD).
        </p>
      ) : null}
    </Field>
  );
}

function AmountInputs({
  form,
  update,
  inputCls,
  amountLabel,
  depositLabel,
  currency,
  showPriceRange,
  showDeposit,
}: Readonly<{
  form: PricingFormSlice;
  update: PricingUpdate;
  inputCls: string;
  amountLabel: string;
  depositLabel: string;
  currency: ListingPriceCurrency;
  showPriceRange: boolean;
  showDeposit: boolean;
}>) {
  const step = currency === "USD" ? "0.01" : "1";

  if (showPriceRange) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${amountLabel} (from)`}>
            <input
              required
              type="number"
              min={1}
              step={step}
              value={form.rent_kes}
              onChange={(e) => update("rent_kes", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={`${amountLabel} (to, optional)`}>
            <input
              type="number"
              min={1}
              step={step}
              value={form.rent_kes_max}
              onChange={(e) => update("rent_kes_max", e.target.value)}
              placeholder="Leave blank for a fixed price"
              className={inputCls}
            />
          </Field>
        </div>
        {showDeposit ? (
          <Field label={depositLabel}>
            <input
              type="number"
              min={0}
              step={step}
              value={form.deposit_kes}
              onChange={(e) => update("deposit_kes", e.target.value)}
              className={inputCls}
            />
          </Field>
        ) : null}
      </>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={amountLabel}>
        <input
          required
          type="number"
          min={1}
          step={step}
          value={form.rent_kes}
          onChange={(e) => update("rent_kes", e.target.value)}
          className={inputCls}
        />
      </Field>
      {showDeposit ? (
        <Field label={depositLabel}>
          <input
            type="number"
            min={0}
            step={step}
            value={form.deposit_kes}
            onChange={(e) => update("deposit_kes", e.target.value)}
            className={inputCls}
          />
        </Field>
      ) : null}
    </div>
  );
}

export function PropertyPricingFields({
  form,
  update,
  inputCls,
}: Readonly<{
  form: PricingFormSlice;
  update: PricingUpdate;
  inputCls: string;
}>) {
  const isCommercial = isCommercialType(form.property_type);
  const pricingModeOptions = pricingModeOptionsForPropertyType(form.property_type);
  const showPricingMode = supportsRentSaleChoice(form.property_type);
  const showBookingPeriod =
    supportsBookingPricing(form.property_type) &&
    (isNightlyRentType(form.property_type) || form.pricing_mode === "booking");
  const showMinLease = isCommercial && form.pricing_mode === "rent";
  const showDeposit = form.pricing_mode !== "sale";
  const showPriceRange = isCommercial || form.pricing_mode === "sale";
  const currency: ListingPriceCurrency = form.price_currency === "USD" ? "USD" : "KES";
  const amountLabel = listingPriceAmountLabel({
    property_type: form.property_type,
    pricing_mode: form.pricing_mode,
    price_period: form.price_period || null,
    price_currency: currency,
  });
  const depositLabel = currency === "USD" ? "Deposit (USD)" : "Deposit (KES)";

  return (
    <div className="space-y-4">
      {showPricingMode ? (
        <Field label="Listing purpose" full>
          <select
            required
            value={form.pricing_mode}
            onChange={(e) =>
              applyPricingModeChange(e.target.value as PricingMode, isCommercial, update)
            }
            className={inputCls}
          >
            {pricingModeOptions.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <CurrencyToggle currency={currency} update={update} />

      {showBookingPeriod ? (
        <Field label="Booking period" full>
          <select
            required
            value={form.price_period}
            onChange={(e) => update("price_period", e.target.value as PricePeriod)}
            className={inputCls}
          >
            {PRICE_PERIODS.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <AmountInputs
        form={form}
        update={update}
        inputCls={inputCls}
        amountLabel={amountLabel}
        depositLabel={depositLabel}
        currency={currency}
        showPriceRange={showPriceRange}
        showDeposit={showDeposit}
      />

      {showMinLease ? (
        <Field label="Minimum rent period" full>
          <select
            required
            value={form.minimum_rent_period_months}
            onChange={(e) =>
              update("minimum_rent_period_months", e.target.value ? Number(e.target.value) : "")
            }
            className={inputCls}
          >
            <option value="">Select minimum lease term</option>
            {COMMERCIAL_MIN_RENT_PERIODS.map((period) => (
              <option key={period.months} value={period.months}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}
