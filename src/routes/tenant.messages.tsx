import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { listTenantInquiries } from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/tenant/messages")({
  component: Messages,
});

function Messages() {
  const { user } = useAuth();
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["tenant-inquiries", user?.id],
    enabled: !!user,
    queryFn: () => listTenantInquiries(),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Message landlords</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to keep all your property conversations in one place.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      <p className="text-sm text-muted-foreground">{inquiries.length} conversations</p>

      {isLoading ? (
        <div className="mt-8 grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No conversations yet. Message a landlord from a property page to start.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {inquiries.map((inquiry) => (
            <article key={inquiry.id} className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                {inquiry.properties?.images?.[0] && (
                  <img
                    src={inquiry.properties.images[0]}
                    alt={inquiry.properties.title}
                    className="h-16 w-20 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="line-clamp-1 font-display font-semibold">
                      {inquiry.properties?.title ?? "Listing"}
                    </h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                      {inquiry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inquiry.properties?.neighborhood ?? "Nairobi"}
                    {inquiry.properties ? ` - ${formatKes(inquiry.properties.rent_kes)}` : ""}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm">{inquiry.message}</p>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {inquiry.profiles?.full_name ?? "Landlord"} -{" "}
                    {new Date(inquiry.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
