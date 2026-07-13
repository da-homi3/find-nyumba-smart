import type { ReactNode } from "react";
import type { PropertyType, PricingMode, PricePeriod } from "@/lib/property-types";
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
import { cn } from "@/lib/utils";

export type PricingFormSlice = {
  property_type: PropertyType;
  pricing_mode: PricingMode;
  price_period: PricePeriod | "";
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

export function PropertyPricingFields({
  form,
  update,
  inputCls,
}: Readonly<{
  form: PricingFormSlice;
  update: <K extends keyof PricingFormSlice>(key: K, value: PricingFormSlice[K]) => void;
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
  const amountLabel = listingPriceAmountLabel({
    property_type: form.property_type,
    pricing_mode: form.pricing_mode,
    price_period: form.price_period || null,
  });

  return (
    <div className="space-y-4">
      {showPricingMode ? (
        <Field label="Listing purpose" full>
          <select
            required
            value={form.pricing_mode}
            onChange={(e) => {
              const nextMode = e.target.value as PricingMode;
              update("pricing_mode", nextMode);
              if (nextMode === "sale") {
                update("price_period", "");
                update("minimum_rent_period_months", "");
                update("deposit_kes", "");
              } else if (nextMode === "rent") {
                update("price_period", "month");
                update("minimum_rent_period_months", "");
              } else {
                update("price_period", "night");
                update("minimum_rent_period_months", "");
              }
            }}
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

      {isCommercial ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${amountLabel} (from)`}>
            <input
              required
              type="number"
              min={1}
              value={form.rent_kes}
              onChange={(e) => update("rent_kes", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={`${amountLabel} (to, optional)`}>
            <input
              type="number"
              min={1}
              value={form.rent_kes_max}
              onChange={(e) => update("rent_kes_max", e.target.value)}
              placeholder="Same as from if one price"
              className={inputCls}
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={amountLabel}>
            <input
              required
              type="number"
              min={1}
              value={form.rent_kes}
              onChange={(e) => update("rent_kes", e.target.value)}
              className={inputCls}
            />
          </Field>
          {showDeposit ? (
            <Field label="Deposit (KES)">
              <input
                type="number"
                min={0}
                value={form.deposit_kes}
                onChange={(e) => update("deposit_kes", e.target.value)}
                className={inputCls}
              />
            </Field>
          ) : null}
        </div>
      )}

      {isCommercial && showDeposit ? (
        <Field label="Deposit (KES)">
          <input
            type="number"
            min={0}
            value={form.deposit_kes}
            onChange={(e) => update("deposit_kes", e.target.value)}
            className={inputCls}
          />
        </Field>
      ) : null}

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
