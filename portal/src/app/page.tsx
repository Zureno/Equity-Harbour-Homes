"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LoginPage from "@/components/LoginPage";
import TenantPortal from "@/components/TenantPortal";

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
      null,
    email: tenantRow.email || sessionUser.email || "",
    unit: tenantRow.unit_label || null,
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
      try {
        const { data: sessionRes, error: sessionErr } =
          await supabase.auth.getSession();

        if (sessionErr || !sessionRes?.session?.user) {
          if (!cancelled) setState({ status: "unauth" });
          return;
        }

        const user = sessionRes.session.user;

        if (!user.email) {
          if (!cancelled) {
            setState({
              status: "unauth",
              error:
                "Your account is missing an email address. Please contact your landlord.",
            });
          }
          return;
        }

        // Look up tenant by email only
        const { data: tenantRow, error: tenantError } = await supabase
          .from("tenants")
          .select("id, full_name, email, unit_label")
          .eq("email", user.email)
          .maybeSingle();

        if (tenantError) {
          console.error("[HomePage] tenant lookup error:", tenantError);
          if (!cancelled) {
            setState({
              status: "unauth",
              error:
                "We couldn't load your portal. Please try signing in again.",
            });
          }
          return;
        }

        if (!tenantRow) {
          if (!cancelled) {
            setState({
              status: "unauth",
              error:
                "We couldn't find your resident profile. Ask your landlord to connect your login.",
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            tenant: mapTenantRowToUser(tenantRow, user),
          });
        }
      } catch (err) {
        console.error("[HomePage] init error:", err);
        if (!cancelled) {
          setState({
            status: "unauth",
            error:
              "We couldn't load your portal. Please sign in again to continue.",
          });
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
