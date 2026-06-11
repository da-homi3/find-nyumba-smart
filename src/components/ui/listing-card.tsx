import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// Basic card styling using class-variance-authority for future customization
const cardStyles = cva(
  "rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-800 transition-transform transform hover:scale-[1.02] hover:shadow-xl",
  {
    variants: {},
    defaultVariants: {},
  },
);

type Listing = {
  id: string;
  title: string;
  price: number;
  address: string;
  image: string; // URL to thumbnail image
};

type ListingCardProps = { listing: Listing; className?: string } & VariantProps<typeof cardStyles>;

export function ListingCard({ listing, className }: ListingCardProps) {
  return (
    <Link
      to="/tenant/property/$id"
      params={{ id: listing.id }}
      className={cn(cardStyles({ className }))}
    >
      <img src={listing.image} alt={listing.title} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{listing.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{listing.address}</p>
        <p className="mt-2 text-primary-600 dark:text-primary-400 font-bold">
          ${listing.price.toLocaleString()}
        </p>
      </div>
    </Link>
  );
}
