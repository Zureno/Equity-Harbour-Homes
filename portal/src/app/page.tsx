"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import LoginPage from "../components/LoginPage";
import TenantPortal from "../components/TenantPortal";

export type TenantUser = {
  id: string;
  name: string | null;
  email: string;
  unit: string | null;
};

function mapTenantRowToUser(tenantRow: any, sessionUser: any): TenantUser {
  return {
    id: tenantRow.id,
    name:
      tenantRow.full_name ||
      sessionUser.user_metadata?.full_name ||
      "",
    email: tenantRow.email || sessionUser.email || "",
    unit: tenantRow.unit_label || "Your Unit",
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "unauth"; error?: string }
  | { status: "ready"; tenant: TenantUser };

export default function HomePage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      console.log("[HomePage] init start");
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log("[HomePage] getSession:", { data, error });

        if (error) throw error;

        const session = data?.session;

        if (!session) {
          if (!cancelled) setState({ status: "unauth" });
          return;
        }

        const { data: tenantRow, error: tenantError } = await supabase
          .from("tenants")
          .select("id, full_name, email, unit_label")
          .eq("user_id", session.user.id)
          .single();

        console.log("[HomePage] tenantRow:", { tenantRow, tenantError });

        if (tenantError) throw tenantError;

        if (!tenantRow) {
          if (!cancelled) {
            setState({
              status: "unauth",
              error:
                "We couldn't find a tenant record for this user. Please sign in again.",
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            tenant: mapTenantRowToUser(tenantRow, session.user),
          });
        }
      } catch (err: any) {
        console.error("[HomePage] init error:", err);

        if (!cancelled) {
          setState({
            status: "unauth",
            error:
              "We couldn't load your portal. Please sign in again to continue.",
          });
        }

        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[HomePage] signOut error:", e);
    }
    setState({ status: "unauth" });
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <span className="text-sm text-neutral-400">
          Loading your portal…
        </span>
      </div>
    );
  }

  if (state.status === "unauth") {
    return <LoginPage errorMessage={state.error} />;
  }

  return <TenantPortal user={state.tenant} onLogout={handleLogout} />;
}
