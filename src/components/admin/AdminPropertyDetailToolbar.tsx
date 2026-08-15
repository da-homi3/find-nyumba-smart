import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getAdminPropertyMediaDownloads } from "@/lib/api/admin.functions";
import { saveMediaToGallery, saveResultToast } from "@/lib/media/save-media-to-gallery";
import { videoMimeFromUrl } from "@/lib/media/video-embed";
import { errorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";

const AdminPropertyVerifyButton = lazy(() =>
  import("@/components/admin/AdminPropertyVerifyButton").then((m) => ({
    default: m.AdminPropertyVerifyButton,
  })),
);
const AdminPropertyDeleteButton = lazy(() =>
  import("@/components/admin/AdminPropertyDeleteButton").then((m) => ({
    default: m.AdminPropertyDeleteButton,
  })),
);
const AdminPropertyAuthenticityPanel = lazy(() =>
  import("@/components/admin/AdminPropertyAuthenticityPanel").then((m) => ({
    default: m.AdminPropertyAuthenticityPanel,
  })),
);

async function downloadMediaBlob(url: string, filename: string) {
  return saveMediaToGallery({
    url,
    filename,
    mimeType: videoMimeFromUrl(url),
  });
}

/** Admin action strip on public property detail — matches Admin → Properties row actions. */
export function AdminPropertyDetailToolbar({ property }: Readonly<{ property: Property }>) {
  const { isAdmin } = useAuth();
  const [downloading, setDownloading] = useState(false);

  if (!isAdmin) return null;

  async function downloadMedia() {
    setDownloading(true);
    try {
      const pack = await getAdminPropertyMediaDownloads({ data: { propertyId: property.id } });
      if (pack.items.length === 0) {
        toast.info("No photos or videos on this listing");
        return;
      }
      toast.message(`Downloading ${pack.items.length} file(s)…`);
      let lastResult: Awaited<ReturnType<typeof downloadMediaBlob>> = "download";
      for (const item of pack.items) {
        lastResult = await downloadMediaBlob(item.url, item.filename);
      }
      if (pack.items.length === 1) {
        const kindLabel = pack.items[0]?.kind === "video" ? "Walkthrough" : "Media";
        toast.success(saveResultToast(lastResult, kindLabel));
      } else {
        toast.success("Media download started");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Suspense fallback={null}>
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Admin controls
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/listings/$id/edit"
              params={{ id: property.id }}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit listing
            </Link>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void downloadMedia()}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden />
              )}
              Download media
            </button>
            <AdminPropertyVerifyButton property={property} />
            <AdminPropertyDeleteButton property={property} />
          </div>
        </div>
        <AdminPropertyAuthenticityPanel property={property} />
      </div>
    </Suspense>
  );
}
