import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { fetchProperty } from "@/lib/properties";
import { PropertyReviewsSection } from "@/components/PropertyReviewsSection";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/tenant/review/$propertyId")({
  loader: async ({ params }) => {
    const property = await fetchProperty(params.propertyId);
    return { property };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Review ${loaderData?.property?.title ?? "property"} — NyumbaSearch` }],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { propertyId } = Route.useParams();
  const { property } = Route.useLoaderData();
  const { user } = useAuth();
  const location = useLocation();
  const returnPath = location.pathname;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to review</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share your experience after a completed viewing.
        </p>
        <Link
          to="/auth"
          search={{ redirect: returnPath }}
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center text-sm text-muted-foreground">
        Property not found.
        <Link to="/tenant" className="mt-4 block font-semibold text-primary">
          Back to browse
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-10">
      <Link
        to="/tenant/property/$id"
        params={{ id: propertyId }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to listing
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">Review your stay</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {property.title} · {property.neighborhood}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Reviews are only accepted after a completed viewing or active tenancy.
      </p>
      <div className="mt-8">
        <PropertyReviewsSection
          propertyId={propertyId}
          userId={user.id}
          isTenant
          showFormInitially
        />
      </div>
    </div>
  );
}
