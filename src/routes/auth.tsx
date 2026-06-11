import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useState, type FormEvent } from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

import { ArrowLeft } from "lucide-react";

import { z } from "zod";

import { resolvePostLoginPath, type AppRole, type PortalId } from "@/lib/portal-guard";

import { listMyPortalApplications, getMyProfilePortal } from "@/lib/api/portal.functions";

import { notifyOpsNewApplication } from "@/lib/api/notify";



const authSearchSchema = z.object({

  redirect: z.string().optional(),

});



export const Route = createFileRoute("/auth")({

  validateSearch: authSearchSchema,

  component: TenantAuth,

});



type AccountRole = "tenant" | "landlord" | "manager" | "agency";

const PRIVILEGED: AccountRole[] = ["landlord", "manager", "agency"];



function TenantAuth() {

  const { redirect } = Route.useSearch();

  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");

  const [phone, setPhone] = useState("");

  const [organizationName, setOrganizationName] = useState("");

  const [role, setRole] = useState<AccountRole>("tenant");

  const [loading, setLoading] = useState(false);



  async function resolveRoles(user: User): Promise<string[]> {

    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

    return (data ?? []).map((r) => r.role as string);

  }



  async function onSubmit(e: FormEvent) {

    e.preventDefault();

    setLoading(true);

    try {

      if (mode === "signup") {

        if ((role === "agency" || role === "manager") && !organizationName.trim()) {

          throw new Error("Organization name is required for this account type");

        }

        const { data: signUpData, error } = await supabase.auth.signUp({

          email,

          password,

          options: {

            emailRedirectTo: `${window.location.origin}/tenant`,

            data: {

              full_name: fullName,

              phone,

              role,

              organization_name: organizationName.trim() || undefined,

            },

          },

        });

        if (error) throw error;

        if (PRIVILEGED.includes(role)) {

          await notifyOpsNewApplication({

            applicantName: fullName || email,

            applicantEmail: email,

            role,

            orgName: organizationName,

            reviewUrl: `${window.location.origin}/admin?tab=applications`,

          });

          toast.success("Application submitted — we'll email you when approved.");

          navigate({ to: "/auth/pending" });

          return;

        }

        toast.success("Welcome to NyumbaSearch!");

        window.location.href = "/tenant";

        return;

      }



      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      if (!data.user) throw new Error("Sign in failed");



      const roles = await resolveRoles(data.user);

      const apps = await listMyPortalApplications();

      const hasPendingOnly =

        apps.some((a) => a.status === "pending") &&

        !roles.some((r) => ["landlord", "manager", "agency", "admin"].includes(r));



      if (hasPendingOnly) {

        navigate({ to: "/auth/pending" });

        return;

      }



      let activePortal: PortalId = "tenant";

      try {

        const profile = await getMyProfilePortal();

        activePortal = (profile?.active_portal as PortalId) ?? "tenant";

      } catch {

        /* profile may not be ready */

      }



      const target = resolvePostLoginPath(roles as AppRole[], activePortal, redirect);

      window.location.href = target;

    } catch (err) {

      toast.error((err as Error).message);

    } finally {

      setLoading(false);

    }

  }



  return (

    <div className="min-h-screen bg-background">

      <div className="mx-auto max-w-md px-6 pt-10">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">

          <ArrowLeft className="h-4 w-4" /> Back

        </Link>

        <h1 className="mt-6 font-display text-3xl font-semibold">

          {mode === "signin" ? "Welcome back" : "Create your account"}

        </h1>

        <p className="mt-2 text-sm text-muted-foreground">

          {mode === "signin"

            ? "Sign in to save homes and contact landlords — no agents."

            : "Join thousands finding verified homes in Nairobi."}

        </p>



        <div className="mt-6 flex rounded-xl border bg-secondary p-1">

          {(["signin", "signup"] as const).map((m) => (

            <button

              key={m}

              type="button"

              onClick={() => setMode(m)}

              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${

                mode === m ? "bg-background shadow-sm" : "text-muted-foreground"

              }`}

            >

              {m === "signin" ? "Sign in" : "Sign up"}

            </button>

          ))}

        </div>



        <form onSubmit={onSubmit} className="mt-6 space-y-4">

          {mode === "signup" && (

            <>

              <Field label="Full name">

                <input

                  value={fullName}

                  onChange={(e) => setFullName(e.target.value)}

                  required

                  className={inputCls}

                />

              </Field>

              <Field label="Phone (M-Pesa number)">

                <input

                  value={phone}

                  onChange={(e) => setPhone(e.target.value)}

                  placeholder="07XX XXX XXX"

                  required

                  className={inputCls}

                />

              </Field>

              <Field label="Account type">

                <select

                  value={role}

                  onChange={(e) => setRole(e.target.value as AccountRole)}

                  className={inputCls}

                >

                  <option value="tenant">Tenant</option>

                  <option value="landlord">Landlord</option>

                  <option value="manager">Property manager</option>

                  <option value="agency">Real estate agency</option>

                </select>

              </Field>

              {(role === "agency" || role === "manager") && (

                <Field label="Organization name">

                  <input

                    value={organizationName}

                    onChange={(e) => setOrganizationName(e.target.value)}

                    required

                    placeholder="e.g. Nairobi Homes Ltd"

                    className={inputCls}

                  />

                </Field>

              )}

              {PRIVILEGED.includes(role) && (

                <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">

                  Landlord, property manager, and agency accounts are reviewed by NyumbaSearch operations

                  before dashboard access is granted.

                </p>

              )}

            </>

          )}

          <Field label="Email">

            <input

              type="email"

              value={email}

              onChange={(e) => setEmail(e.target.value)}

              required

              className={inputCls}

            />

          </Field>

          <Field label="Password">

            <input

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              required

              minLength={6}

              className={inputCls}

            />

          </Field>

          {mode === "signin" && (

            <Link to="/auth/reset" className="block text-right text-xs font-semibold text-primary">

              Forgot password?

            </Link>

          )}

          <button

            type="submit"

            disabled={loading}

            className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"

          >

            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}

          </button>

        </form>



        <p className="mt-6 text-center text-xs text-muted-foreground">

          <Link to="/settings" className="font-semibold text-foreground">

            Settings & portals

          </Link>

          {" · "}

          <Link to="/caretaker" className="font-semibold text-foreground">

            Caretaker PIN sign in

          </Link>

        </p>

      </div>

    </div>

  );

}



const inputCls =

  "w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";



function Field({ label, children }: { label: string; children: React.ReactNode }) {

  return (

    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>

      {children}

    </label>

  );

}

