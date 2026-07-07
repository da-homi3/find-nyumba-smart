import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  executeListingImport,
  listMyImportBatches,
  previewListingImport,
  rollbackListingImport,
} from "@/lib/api/import.functions";
import { PORTAL_PATHS, PORTAL_PROPERTY_QUERY_KEY, type ListingPortal } from "@/lib/portal-paths";
import { formatKes } from "@/lib/properties";
import { errorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { FileDropZone } from "@/components/FileDropZone";

const CSV_TEMPLATE = `title,neighborhood,rent_kes,bedrooms,bathrooms,property_type,description,contact_phone
Sunny 1BR in Kilimani,Kilimani,35000,1,1,one_bedroom,Spacious unit near Yaya Centre,0712345678
Cozy bedsitter Westlands,Westlands,18000,0,1,bedsitter,Ground floor with parking,0722000000`;

type PreviewState = Awaited<ReturnType<typeof previewListingImport>>;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nyumba-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function csvDropProgress(
  uploadProgress: number | null,
  importPending: boolean,
  previewPending: boolean,
): number | null {
  if (uploadProgress != null) return uploadProgress;
  if (importPending) return 50;
  if (previewPending) return 25;
  return null;
}

function csvUploadLabel(importPending: boolean, previewPending: boolean): string {
  if (importPending) return "Importing listings…";
  if (previewPending) return "Parsing CSV…";
  return "Processing…";
}

function RecentImportsList({
  batchesLoading,
  batches,
  rollbackPending,
  onRollback,
}: Readonly<{
  batchesLoading: boolean;
  batches: Awaited<ReturnType<typeof listMyImportBatches>>;
  rollbackPending: boolean;
  onRollback: (batchId: string) => void;
}>) {
  if (batchesLoading) {
    return <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (batches.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No imports yet.</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {batches.map((b) => {
        const canRollback =
          b.status === "complete" &&
          Date.now() - new Date(b.created_at).getTime() < 24 * 60 * 60 * 1000;
        return (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{b.filename}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(b.created_at).toLocaleString()} · {b.imported_rows} imported · {b.status}
              </p>
            </div>
            {canRollback && (
              <button
                type="button"
                disabled={rollbackPending}
                onClick={() => {
                  if (!globalThis.confirm("Delete all listings from this import?")) return;
                  onRollback(b.id);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Rollback (24h)
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PortalImportPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const propertyKey = PORTAL_PROPERTY_QUERY_KEY[portal];
  const qc = useQueryClient();
  const [filename, setFilename] = useState("import.csv");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["import-batches", portal],
    queryFn: () => listMyImportBatches(),
  });

  const previewMutation = useMutation({
    mutationFn: (args: { csvText: string; filename: string }) =>
      previewListingImport({ data: args }),
    onSuccess: (data) => {
      setPreview(data);
      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} row(s) have errors — fix CSV or import valid rows only`);
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      setUploadProgress(8);
      const res = await executeListingImport({
        data: { filename: preview!.filename, rows: preview!.rows },
      });
      setUploadProgress(100);
      return res;
    },
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} listings (${res.duplicates} duplicates skipped)`);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["import-batches"] });
      void qc.invalidateQueries({ queryKey: [propertyKey] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      globalThis.setTimeout(() => setUploadProgress(null), 350);
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) => rollbackListingImport({ data: { batchId } }),
    onSuccess: (res) => {
      toast.success(`Rolled back ${res.rolledBack} listings`);
      void qc.invalidateQueries({ queryKey: ["import-batches"] });
      void qc.invalidateQueries({ queryKey: [propertyKey] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  async function processCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please choose a .csv file");
      return;
    }

    setUploadProgress(5);
    const text = await file.text();
    setUploadProgress(35);
    setFilename(file.name);
    try {
      await previewMutation.mutateAsync({ csvText: text, filename: file.name });
      setUploadProgress(100);
    } finally {
      globalThis.setTimeout(() => setUploadProgress(null), 350);
    }
  }

  const busy = previewMutation.isPending || importMutation.isPending;
  const dropProgress = csvDropProgress(
    uploadProgress,
    importMutation.isPending,
    previewMutation.isPending,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Bulk import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV to create draft listings. Review and publish each one from{" "}
          <Link to={paths.properties} className="font-semibold text-primary">
            Properties
          </Link>
          .
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">CSV upload</h2>
              <p className="text-xs text-muted-foreground">Max ~5 MB · UTF-8 comma-separated</p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> Template
          </button>
        </div>

        <FileDropZone
          className="mt-6"
          accept=".csv,text/csv"
          disabled={busy}
          uploadProgress={dropProgress}
          uploadLabel={csvUploadLabel(importMutation.isPending, previewMutation.isPending)}
          title="Drop your CSV here"
          hint={filename}
          icon={<FileSpreadsheet className="h-8 w-8 text-primary sm:h-9 sm:w-9" />}
          onFiles={(files) => {
            const file = files[0];
            if (file) void processCsvFile(file);
          }}
        />

        <p className="mt-4 text-xs text-muted-foreground">
          Columns: title, neighborhood, rent_kes, bedrooms, bathrooms, property_type (e.g.{" "}
          <code className="rounded bg-muted px-1">one_bedroom</code>
          {", "}
          <code className="rounded bg-muted px-1">bedsitter</code>
          ), description, contact_phone.
        </p>
      </section>

      {preview && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Preview — {preview.filename}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Total rows" value={preview.totalRows} />
            <Stat label="Valid" value={preview.validCount} />
            <Stat label="Errors" value={preview.errorCount} />
            <Stat label="Duplicates" value={preview.duplicateCount} />
          </div>

          {preview.preview.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Rent</th>
                    <th className="px-3 py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row) => (
                    <tr key={`${row.title}-${row.neighborhood}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.title}</td>
                      <td className="px-3 py-2">{row.neighborhood}</td>
                      <td className="px-3 py-2">{formatKes(row.rent_kes)}</td>
                      <td className="px-3 py-2">{row.property_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-destructive">
              {preview.errors.slice(0, 10).map((e) => (
                <li key={`${e.rowIndex}-${e.reason}`}>
                  Row {e.rowIndex}: {e.reason}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={preview.validCount === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {importMutation.isPending ? "Importing…" : `Import ${preview.validCount} listings`}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Recent imports</h2>
        <RecentImportsList
          batchesLoading={batchesLoading}
          batches={batches}
          rollbackPending={rollbackMutation.isPending}
          onRollback={(batchId) => rollbackMutation.mutate(batchId)}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
