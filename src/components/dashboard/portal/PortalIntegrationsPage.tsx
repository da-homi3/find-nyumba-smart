import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createIntegrationApiKey,
  listIntegrationApiKeys,
  revokeIntegrationApiKey,
} from "@/lib/api/integration.functions";
import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import { getSiteUrl } from "@/lib/site";
import { errorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

export function PortalIntegrationsPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const paths = PORTAL_PATHS[portal];
  const qc = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["integration-api-keys", portal],
    queryFn: () => listIntegrationApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createIntegrationApiKey({ data: { name } }),
    onSuccess: (row) => {
      setNewKey(row.apiKey);
      setKeyName("");
      void qc.invalidateQueries({ queryKey: ["integration-api-keys"] });
      toast.success("API key created — copy it now; it won't be shown again");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => revokeIntegrationApiKey({ data: { keyId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integration-api-keys"] });
      toast.success("API key revoked");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const baseUrl = getSiteUrl();

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">API & integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your CRM or property management system via the REST API. Also try{" "}
          <Link to="/whatsapp" className="font-semibold text-primary">
            WhatsApp listing agent
          </Link>{" "}
          or{" "}
          <Link to={paths.import} className="font-semibold text-primary">
            bulk CSV import
          </Link>
          .
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Key className="h-4 w-4 text-primary" /> API keys
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Prefix <code className="rounded bg-muted px-1">nsk_</code> · 100 requests/min per key
        </p>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyName.trim().length < 2) {
              toast.error("Enter a key name (e.g. CRM sync)");
              return;
            }
            createMutation.mutate(keyName.trim());
          }}
        >
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name (e.g. PropertyPro sync)"
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </button>
        </form>

        {newKey && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Copy your new key</p>
            <code className="mt-2 block break-all text-sm">{newKey}</code>
            <button
              type="button"
              onClick={() => void copyKey()}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
        ) : keys.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.key_prefix}… · {new Date(k.created_at).toLocaleDateString()}
                    {k.revoked_at && " · revoked"}
                  </p>
                </div>
                {!k.revoked_at && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!globalThis.confirm(`Revoke "${k.name}"?`)) return;
                      revokeMutation.mutate(k.id);
                    }}
                    className="text-destructive"
                    aria-label={`Revoke ${k.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-6 text-sm">
        <h2 className="font-semibold">REST API reference</h2>
        <p className="mt-2 text-muted-foreground">
          Base URL: <code className="rounded bg-muted px-1">{baseUrl}/api/v1</code>
        </p>
        <ul className="mt-4 space-y-2 font-mono text-xs">
          <li>GET /listings — list your listings</li>
          <li>POST /listings — create draft listing</li>
          <li>GET /listings/:id — get one listing</li>
          <li>PATCH /listings/:id — update listing</li>
          <li>DELETE /listings/:id — deactivate listing</li>
          <li>GET /sync/status — import/sync health</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Send <code className="rounded bg-muted px-1">Authorization: Bearer nsk_…</code> on every
          request. Responses are JSON.
        </p>
      </section>
    </div>
  );
}
