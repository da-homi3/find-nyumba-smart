import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { listSavedProperties, toggleSavedProperty } from "@/lib/api/nyumba.functions";
import { PropertyCard } from "@/components/PropertyCard";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { isDemoListingId } from "@/data/mockListings";
import { SiteNav } from "@/components/SiteNav";
import { isPreviewListing, mergeListingsForDisplay } from "@/lib/listings-preview";
import { buildPageHead } from "@/lib/seo/head";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import type { Property } from "@/lib/properties";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/tenant/saved")({
  head: () =>
    buildPageHead({
      title: "Saved homes — NyumbaSearch",
      description:
        "Your shortlist of saved rental listings on NyumbaSearch. Compare and book viewings in one place.",
      path: "/tenant/saved",
      noIndex: true,
    }),
  component: SavedPage,
});

function SavedPage() {
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const location = useLocation();
  const qc = useQueryClient();

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["saved-properties", user?.id],
    enabled: !!user,
    queryFn: () => listSavedProperties(),
  });

  const toggleSave = useMutation({
    mutationFn: async ({ propertyId, saved }: { propertyId: string; saved: boolean }) => {
      await toggleSavedProperty({ data: { propertyId, saved: !saved } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-properties"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const displaySaved = useMemo(() => mergeListingsForDisplay(saved), [saved]);

  if (!user) {
    return (
      <div>
        <SiteNav variant="light" />
        <div className="mx-auto max-w-md px-6 pt-16 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Saved homes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to keep track of listings you love.
          </p>
          <Link
            to="/auth"
            search={{ redirect: location.pathname }}
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SiteNav variant="light" />
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-8">
        <h1 className="font-display text-2xl font-semibold">Saved homes</h1>
        <p className="text-sm text-muted-foreground">{saved.length} saved</p>

        {!isPlus && saved.length > 0 && (
          <div className="mt-4">
            <PlusUpsellBanner
              dismissKey="saved-after-first"
              title="Get alerts when prices drop"
              body="Plus members get unlimited search alerts and early access to new listings."
            />
          </div>
        )}

        <div className="mt-4" data-tour="tenant-saved-list">
          <SavedListingsBody
            isLoading={isLoading}
            isEmpty={saved.length === 0}
            displaySaved={displaySaved}
            isPlus={isPlus}
            onToggleSave={(propertyId) => {
              void toggleSave.mutateAsync({ propertyId, saved: true });
            }}
          />
        </div>
        <OnboardingTourHost tourId="tenant-saved" />
      </div>
    </div>
  );
}

function SavedListingsBody({
  isLoading,
  isEmpty,
  displaySaved,
  isPlus,
  onToggleSave,
}: Readonly<{
  isLoading: boolean;
  isEmpty: boolean;
  displaySaved: Property[];
  isPlus: boolean;
  onToggleSave: (propertyId: string) => void;
}>) {
  if (isLoading) {
    return <div className="mt-8 h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  if (isEmpty) {
    return <EmptyState type="no_saved" className="mt-10" />;
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {displaySaved.map((p) => (
        <PropertyCard
          key={p.id}
          p={p}
          preview={isPreviewListing(p)}
          saved
          plusMember={isPlus}
          onToggleSave={(e) => {
            e.preventDefault();
            if (isDemoListingId(p.id)) {
              toast.info("Demo listings cannot be saved.");
              return;
            }
            onToggleSave(p.id);
          }}
        />
      ))}
    </div>
  );
}
