// portal/src/components/TenantPortal.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import type { TenantUser } from "../app/page";

/* ------------------------------------------------------------------------- */
/* Types                                                                     */
/* ------------------------------------------------------------------------- */

type Props = {
  user: TenantUser;
  onLogout: () => void;
};

type Section8Case = {
  hap_amount: number | null;
  tenant_portion: number | null;
  next_inspection_date: string | null;
  next_recertification_date: string | null;
  housing_authority_name: string | null;
  caseworker_name: string | null;
  caseworker_email: string | null;
};

type OnboardingStatus = "pending" | "in_progress" | "completed";

type OnboardingItem = {
  id: string;
  step_id: string;
  code: string;
  title: string;
  status: OnboardingStatus;
  sort_order: number;
  data?: any | null;
};

type TenantDoc = {
  id: string;
  tenant_id: string;
  doc_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  created_at: string | null;
};

type PaymentRow = {
  id: string;
  tenant_id: string;
  amount: number;
  method: string | null;
  note: string | null;
  status?: "pending" | "posted" | "rejected" | null;
  source?: "stripe" | "owner_recorded" | "tenant_reported" | string | null;
  created_at: string | null;
  posted_at?: string | null;
};

type CurrentCharge = {
  id: string;
  amount: number;
  description: string | null;
  due_date: string;
};

type MainSection =
  | "Home"
  | "Payments"
  | "Messages & Alerts"
  | "Inspections & Recertifications"
  | "Lease & Documents"
  | "Contact Landlord"
  | "Unit Info"
  | "Important Links";

type TopTab = "Quick Links" | "Announcements" | "Inspections" | "Documents";

/* ------------------------------------------------------------------------- */

const menuItems: MainSection[] = [
  "Home",
  "Payments",
  "Messages & Alerts",
  "Inspections & Recertifications",
  "Lease & Documents",
  "Contact Landlord",
  "Unit Info",
  "Important Links",
];

const quickLinks = [
  {
    label: "Request Maintenance",
    icon: "🛠️",
    target: "Inspections & Recertifications" as MainSection,
    note: "Open a maintenance request for your unit.",
    opensMaintenanceForm: true,
  },
  {
    label: "View Lease & Docs",
    icon: "📄",
    target: "Lease & Documents" as MainSection,
    note: "See your lease, HAP letters and other documents.",
  },
  {
    label: "Payment History",
    icon: "💳",
    target: "Payments" as MainSection,
    note: "Review your past payments and receipts.",
  },
  {
    label: "Next Inspection",
    icon: "📅",
    target: "Inspections & Recertifications" as MainSection,
    note: "See upcoming inspections and recertification dates.",
  },
  {
    label: "Section 8 Details",
    icon: "🏛️",
    target: "Unit Info" as MainSection,
    note: "View your Section 8 case details and housing authority info.",
  },
  {
    label: "Contact Caseworker",
    icon: "📞",
    target: "Contact Landlord" as MainSection,
    note: "Find contact info for your caseworker or property manager.",
  },
  {
    label: "Update Contact Info",
    icon: "✏️",
    target: "Unit Info" as MainSection,
    note: "Update your phone, email or mailing address.",
  },
];

// Onboarding codes that require a file upload
const FILE_UPLOAD_CODES = new Set([
  "upload_voucher",
  "upload_id_docs",
  "sign_lease",
]);

// Human labels for doc types
const DOC_LABELS: Record<string, string> = {
  upload_voucher: "Section 8 voucher / approval",
  upload_id_docs: "ID & required documents",
  sign_lease: "Signed lease",
};

// Human labels for payment methods
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  money_order: "Money order",
  cash: "Cash",
  cashier_check: "Cashier’s check",
  zelle: "Zelle",
  venmo: "Venmo",
  other: "Other",
};

/* ------------------------------------------------------------------------- */
/* Component                                                                 */
/* ------------------------------------------------------------------------- */

const TenantPortal: React.FC<Props> = ({ user, onLogout }) => {
  const router = useRouter();

  // Navigation
  const [activeSection, setActiveSection] = useState<MainSection>("Home");
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopTab>("Quick Links");
  const [lastQuickLink, setLastQuickLink] = useState<string | null>(
    null
  );

  // Top card / Section 8 / charges
  const [amountDue, setAmountDue] = useState<number>(0);
  const [currentCharge, setCurrentCharge] = useState<CurrentCharge | null>(null);
  const [section8, setSection8] = useState<Section8Case | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Overall ledger balance (live from charges & payments)
  const [overallBalance, setOverallBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [resolvedUnitLabel, setResolvedUnitLabel] = useState<string | null>(null);

  // Onboarding
  const [onboardingItems, setOnboardingItems] = useState<
    OnboardingItem[]
  >([]);
  const [onboardingStatus, setOnboardingStatus] =
    useState<string | null>(null);

  // Docs
  const [docs, setDocs] = useState<TenantDoc[]>([]);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Maintenance form
  const [showMaintenanceForm, setShowMaintenanceForm] =
    useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] =
    useState("");
  const [maintenancePriority, setMaintenancePriority] =
    useState("normal");
  const [maintenanceSubmitting, setMaintenanceSubmitting] =
    useState(false);
  const [maintenanceMessage, setMaintenanceMessage] =
    useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] =
    useState<string | null>(null);

  // Confirm move-in dialog
  const [editingOnboardingItem, setEditingOnboardingItem] =
    useState<OnboardingItem | null>(null);
  const [moveInDateInput, setMoveInDateInput] = useState("");
  const [onboardingSaving, setOnboardingSaving] =
    useState<boolean>(false);
  const [onboardingError, setOnboardingError] =
    useState<string | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStep, setUploadStep] = useState<OnboardingItem | null>(
    null
  );
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] =
    useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Payments (Tenant can REPORT only)
  const [showReportPaymentForm, setShowReportPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("money_order");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // Banner for payment success / cancel
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const autoPayEnabled = false; // reserved for future

  /* --------------------------------------------------------------------- */
  /* Load dashboard data                                                   */
  /* --------------------------------------------------------------------- */

  const loadDashboard = useCallback(async () => {
  setLoading(true);
  setBalanceError(null);

  try {
    // 1) Resolve tenant.id using email (AUTH ID ≠ BUSINESS ID)
    const { data: tenantRow, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, unit_label")
      .eq("email", user.email)
      .maybeSingle();

    if (tenantErr) {
      console.error("[TenantPortal] tenant lookup error", tenantErr);
      throw tenantErr;
    }

    if (!tenantRow?.id) {
      console.error("[TenantPortal] tenant record not found for email", user.email);
      throw new Error("Tenant record not found");
    }

    // IMPORTANT: tenantRow.id is the correct business tenant id
    const tenantId = tenantRow.id;
    setResolvedTenantId(tenantId);
    setResolvedUnitLabel(tenantRow.unit_label ?? null);

    console.log("[TenantPortal] resolved tenantId =", tenantId);

    // 2) BALANCE (VIEW) - source of truth (should already be posted-only)
    const { data: balanceRow, error: balanceErr } = await supabase
      .from("tenant_balances_view")
      .select("current_balance, total_charges, total_payments")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (balanceErr) {
      console.error("[TenantPortal] balance view error", balanceErr);
      throw balanceErr;
    }

    const currentBalance = Number(balanceRow?.current_balance ?? 0);
    setOverallBalance(currentBalance);
    setAmountDue(Math.max(currentBalance, 0));

    // 3) SECTION 8
    const { data: s8, error: s8Err } = await supabase
      .from("section8_cases")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (s8Err) console.error("[TenantPortal] section8_cases error", s8Err);
    setSection8(s8 ?? null);

    // 4) UNPAID CHARGE (earliest due unpaid)
    const { data: unpaid, error: unpaidErr } = await supabase
      .from("charges")
      .select("id, amount, description, due_date, is_paid")
      .eq("tenant_id", tenantId)
      .or("is_paid.is.null,is_paid.eq.false")
      .order("due_date", { ascending: true })
      .limit(1);

    if (unpaidErr) console.error("[TenantPortal] unpaid charge error", unpaidErr);

    setCurrentCharge(
      unpaid?.[0]
        ? {
            id: unpaid[0].id,
            amount: Number(unpaid[0].amount || 0),
            description: unpaid[0].description ?? null,
            due_date: unpaid[0].due_date,
          }
        : null
    );

    // 5) ONBOARDING
    const { data: onboardingRows, error: onboardingErr } = await supabase
      .from("tenant_onboarding")
      .select(
        `id, step_id, status, data,
         onboarding_steps(id, code, title, sort_order)`
      )
      .eq("tenant_id", tenantId);

    if (onboardingErr) console.error("[TenantPortal] onboarding error", onboardingErr);

    setOnboardingItems(
      (onboardingRows ?? [])
        .map((r: any) => ({
          id: r.id,
          step_id: r.step_id,
          code: r.onboarding_steps?.code,
          title: r.onboarding_steps?.title,
          status: r.status ?? "unknown",
          sort_order: r.onboarding_steps?.sort_order ?? 999,
          data: r.data,
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    // 6) DOCS
    const { data: docs, error: docsErr } = await supabase
      .from("tenant_docs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (docsErr) console.error("[TenantPortal] docs error", docsErr);
    setDocs(docs ?? []);

    // 7) PAYMENTS (normalize status so NULL doesn't break logic/UI)
    const { data: paymentsRaw, error: payErr } = await supabase
      .from("payments")
      .select("id, amount, method, note, status, source, created_at, posted_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (payErr) console.error("[TenantPortal] payments error", payErr);

    const normalizedPayments =
      (paymentsRaw ?? []).map((p: any) => ({
        ...p,
        // If you previously had NULL status rows, treat them as "posted" (legacy behavior)
        status: p.status ?? "posted",
      })) ?? [];

    setPayments(normalizedPayments);
  } catch (err) {
    console.error("[TenantPortal] loadDashboard failed", err);
    setBalanceError("Unable to load dashboard.");
  } finally {
    setLoading(false);
  }
}, [user.email, user.id]);


  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* --------------------------------------------------------------------- */
  /* Handle Stripe redirect params                                         */
  /* --------------------------------------------------------------------- */

// Handle Stripe redirect params (safe parsing)
useEffect(() => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  const tab = url.searchParams.get("tab");
  const paymentStatus = url.searchParams.get("paymentStatus");

  // ✅ tab is a MainSection (Payments, Home, etc)
  if (tab && (menuItems as string[]).includes(tab)) {
    setActiveSection(tab as MainSection);
  }

  if (paymentStatus === "success") {
    setBanner({
      type: "success",
      message:
        "Payment received. It may take a few seconds for your balance and history to update.",
    });

    loadDashboard();

    window.setTimeout(() => setBanner(null), 4000);
  }

  if (paymentStatus === "cancel") {
    setBanner({ type: "error", message: "Payment canceled." });
    window.setTimeout(() => setBanner(null), 4000);
  }

  // Clean up URL
  if (tab || paymentStatus) {
    url.searchParams.delete("tab");
    url.searchParams.delete("paymentStatus");
    window.history.replaceState({}, "", url.toString());
  }
}, [loadDashboard]);

  /* --------------------------------------------------------------------- */
  /* Maintenance                                                           */
  /* --------------------------------------------------------------------- */

  const handleSubmitMaintenance = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setMaintenanceError(null);
    setMaintenanceMessage(null);

    if (!maintenanceTitle.trim()) {
      setMaintenanceError("Please add a short title for the issue.");
      return;
    }

    setMaintenanceSubmitting(true);

    try {
      const { error } = await supabase
        .from("maintenance_requests")
        .insert({
          tenant_id: resolvedTenantId!,
          title: maintenanceTitle.trim(),
          description: maintenanceDescription.trim(),
          priority: maintenancePriority,
        });

      if (error) throw error;

      setMaintenanceMessage(
        "Maintenance request submitted. We’ll review it shortly."
      );
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setMaintenancePriority("normal");
      setShowMaintenanceForm(false);
    } catch (err: any) {
      setMaintenanceError(
        err.message ||
        "Something went wrong submitting your request."
      );
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Onboarding interactions                                               */
  /* --------------------------------------------------------------------- */

  const toggleOnboardingStatus = async (item: OnboardingItem) => {
    const previousStatus = item.status;
    const nextStatus: OnboardingStatus =
      item.status === "completed" ? "pending" : "completed";

    setOnboardingItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: nextStatus } : i
      )
    );

    const { error } = await supabase
      .from("tenant_onboarding")
      .update({ status: nextStatus })
      .eq("id", item.id)
      .eq("tenant_id", resolvedTenantId ?? user.id);

    if (error) {
      console.error("toggle onboarding error", error);
      setOnboardingItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: previousStatus } : i
        )
      );
      alert(
        "Could not save this step yet. Please try again in a moment."
      );
    } else {
      loadDashboard();
    }
  };

  const handleOnboardingItemClick = (item: OnboardingItem) => {
    if (uploading) return;

    if (FILE_UPLOAD_CODES.has(item.code)) {
      if (item.status === "completed") {
        const shouldReplace = window.confirm(
          "You already uploaded a document for this step. Do you want to upload a new version?"
        );
        if (!shouldReplace) return;
      }

      setUploadError(null);
      setUploadStep(item);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
      return;
    }

    if (item.code === "confirm_move_in") {
      setEditingOnboardingItem(item);
      setOnboardingError(null);
      setMoveInDateInput("");
      return;
    }

    toggleOnboardingStatus(item);
  };

  const handleSaveMoveInDate = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setOnboardingError(null);

    if (!editingOnboardingItem) return;

    if (!moveInDateInput) {
      setOnboardingError("Please choose a move-in date.");
      return;
    }

    setOnboardingSaving(true);

    try {
      const payload = {
        status: "completed" as OnboardingStatus,
        data: {
          move_in_date: moveInDateInput,
        },
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("tenant_onboarding")
        .update(payload)
        .eq("id", editingOnboardingItem.id)
        .eq("tenant_id", resolvedTenantId!);

      if (error) throw error;

      setOnboardingItems((prev) =>
        prev.map((i) =>
          i.id === editingOnboardingItem.id
            ? { ...i, status: "completed", data: payload.data }
            : i
        )
      );

      setEditingOnboardingItem(null);
      setMoveInDateInput("");
    } catch (err: any) {
      setOnboardingError(
        err.message ||
        "Could not save move-in date. Please try again."
      );
    } finally {
      setOnboardingSaving(false);
    }
  };

  /* --------------------------------------------------------------------- */
  /* File upload                                                           */
  /* --------------------------------------------------------------------- */

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !uploadStep) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];
    const maxBytes = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type) || file.size > maxBytes) {
      setUploadError(
        "Please upload a PDF or image (PDF / JPG / PNG) under 10 MB."
      );
      return;
    }

    setUploading(true);
    setUploadingId(uploadStep.id);
    setUploadError(null);

    try {
      const randomId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const ext = file.name.includes(".")
        ? file.name.split(".").pop()
        : "";
      const safeExt = ext ? `.${ext}` : "";

      const path = `${user.id}/${uploadStep.code}/${randomId}${safeExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("tenant-docs")
        .upload(path, file, { upsert: true });

      if (uploadErr) {
        console.error("storage upload error", uploadErr);
        setUploadError(
          "Could not upload file. Please try again in a moment."
        );
        return;
      }

      const onboardingPayload: any = {
        status: "completed" as OnboardingStatus,
        data: {
          storage_path: path,
          file_name: file.name,
        },
        completed_at: new Date().toISOString(),
      };

      const [
        { data: insertedDoc, error: insertErr },
        { error: onboardingErr },
      ] = await Promise.all([
        supabase
          .from("tenant_docs")
          .insert({
            tenant_id: resolvedTenantId!,
            doc_type: uploadStep.code,
            file_name: file.name,
            storage_path: path,
          })
          .select()
          .single(),
        supabase
          .from("tenant_onboarding")
          .update(onboardingPayload)
          .eq("id", uploadStep.id)
          .eq("tenant_id", user.id),
      ]);

      if (insertErr) {
        console.error("tenant_docs insert error", insertErr);
        setUploadError(
          "File stored, but we could not save document info."
        );
      } else if (insertedDoc) {
        setDocs((prev) => [insertedDoc as TenantDoc, ...prev]);
      }

      if (onboardingErr) {
        console.error(
          "tenant_onboarding update error",
          onboardingErr
        );
        setUploadError(
          "File uploaded, but we could not mark the step complete."
        );
      } else {
        setOnboardingItems((prev) =>
          prev.map((i) =>
            i.id === uploadStep.id
              ? {
                ...i,
                status: "completed",
                data: onboardingPayload.data,
              }
              : i
          )
        );
      }

      setUploadStep(null);
    } catch (err) {
      console.error("file upload unexpected error", err);
      setUploadError("Unexpected error uploading file.");
    } finally {
      setUploading(false);
      setUploadingId(null);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Payments                                                              */
  /* --------------------------------------------------------------------- */

  const handleSubmitReportedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentMessage(null);

    const amount = parseFloat(paymentAmount);
    if (!amount || !isFinite(amount) || amount <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }

    setPaymentSaving(true);

    try {
      const effectiveTenantId = user.id;

      // TENANT RULE: tenant can only REPORT payments, never POST ledger entries.
      const { error } = await supabase.from("payments").insert({
        tenant_id: effectiveTenantId,
        amount,
        method: paymentMethod,
        note: paymentNote || null,
        status: "pending",
        source: "tenant_reported",
      });

      if (error) throw error;

      setPaymentMessage(
        "Payment reported. It will be applied once the owner verifies and posts it."
      );
      setPaymentAmount("");
      setPaymentNote("");
      setShowReportPaymentForm(false);

      await loadDashboard();
    } catch (err: any) {
      setPaymentError(
        err.message || "Could not submit payment report. Please try again."
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleStripeCheckout = async () => {
  setStripeError(null);

  // Always pay the live ledger balance
  const amountToPay = Math.max(overallBalance ?? 0, 0);

  if (!amountToPay || amountToPay <= 0) {
    setStripeError("There is no outstanding balance to pay right now.");
    return;
  }

  setStripeLoading(true);

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: resolvedTenantId,           // IMPORTANT: business tenant id
        email: user.email,                    // for Stripe receipt
        amountCents: Math.round(amountToPay * 100),
        returnTab: "Payments"                 // 👈 tells backend where to send user back
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Unable to start checkout.");
    }

    const data = await res.json();
    if (!data?.url) throw new Error("Stripe did not return a checkout URL.");

    // Redirect to Stripe
    window.location.href = data.url;
  } catch (err: any) {
    console.error("Stripe checkout error", err);
    setStripeError(err.message || "Could not start card payment.");
  } finally {
    setStripeLoading(false);
  }
};

  /* --------------------------------------------------------------------- */
  /* Section renderer                                                      */
  /* --------------------------------------------------------------------- */

  const renderSectionContent = () => {
    if (activeSection === "Home") {
      return (
        <>
          {/* Tabs row */}
          <section className="flex items-center gap-4 text-xs border-b border-neutral-800 pb-2">
            {(
              [
                "Quick Links",
                "Announcements",
                "Inspections",
                "Documents",
              ] as TopTab[]
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-full ${activeTab === tab
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-100"
                  }`}
              >
                {tab}
              </button>
            ))}
          </section>

          {/* Banner */}
          <section className="bg-gradient-to-r from-sky-600 to-emerald-500 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm font-semibold text-white mt-4">
            <div className="text-base md:text-lg">
              Keep your Section 8 home in good standing.
            </div>
            <div className="flex flex-wrap gap-4 text-xs md:text-sm">
              <span>✔ Track HAP & tenant portions</span>
              <span>✔ Never miss an inspection</span>
              <span>✔ Submit maintenance requests online</span>
            </div>
          </section>

          {/* Quick Links */}
          {activeTab === "Quick Links" && (
            <section className="mt-5">
              <h2 className="text-sm font-semibold mb-3">
                Quick Links
              </h2>
              <div className="flex flex-wrap gap-5">
                {quickLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => {
                      setActiveSection(link.target);
                      setLastQuickLink(link.label);

                      if ((link as any).opensMaintenanceForm) {
                        setShowMaintenanceForm(true);
                      }
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl">
                      {link.icon}
                    </div>
                    <span className="text-[11px] text-center text-neutral-300 max-w-[90px] leading-tight">
                      {link.label}
                    </span>
                  </button>
                ))}
              </div>

              {lastQuickLink && (
                <div className="mt-4 text-[11px] text-neutral-400">
                  Opened from{" "}
                  <span className="font-semibold">
                    {lastQuickLink}
                  </span>
                  . You&apos;re now viewing the{" "}
                  <span className="font-semibold">
                    {activeSection}
                  </span>{" "}
                  section.
                </div>
              )}
            </section>
          )}

          {activeTab === "Announcements" && (
            <section className="mt-5 text-xs text-neutral-300">
              <h2 className="text-sm font-semibold mb-2">
                Announcements
              </h2>
              <p>
                No announcements yet. This is where property / Section
                8 notices will appear.
              </p>
            </section>
          )}

          {activeTab === "Inspections" && (
            <section className="mt-5 text-xs text-neutral-300">
              <h2 className="text-sm font-semibold mb-2">
                Inspections
              </h2>
              {section8?.next_inspection_date ? (
                <p>
                  Your next inspection is scheduled for{" "}
                  <span className="font-semibold">
                    {section8.next_inspection_date}
                  </span>
                  .
                </p>
              ) : (
                <p>No inspections scheduled yet.</p>
              )}
            </section>
          )}

          {activeTab === "Documents" && (
            <section className="mt-5 text-xs text-neutral-300">
              <h2 className="text-sm font-semibold mb-2">
                Documents
              </h2>
              <p>
                This section will show links to your lease, HAP
                letters and other documents once document storage is
                enabled.
              </p>
            </section>
          )}

          {/* Onboarding checklist */}
          {onboardingItems.length > 0 && (
            <section className="mt-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3 text-xs">
                <div>
                  <div className="font-semibold text-neutral-100">
                    Move-in &amp; Section 8 onboarding
                  </div>
                  <div className="text-neutral-400">
                    {
                      onboardingItems.filter(
                        (i) => i.status === "completed"
                      ).length
                    }{" "}
                    of {onboardingItems.length} items completed.
                  </div>
                </div>
                <div className="text-[11px] text-emerald-400">
                  {onboardingStatus || ""}
                </div>
              </div>

              {uploadError && (
                <div className="mb-3 text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                  {uploadError}
                </div>
              )}

              <div className="divide-y divide-neutral-800 text-xs">
                {onboardingItems.map((item) => {
                  const isCompleted = item.status === "completed";
                  const isPending = item.status === "pending";

                  const badgeClasses = isCompleted
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : isPending
                      ? "bg-neutral-800 text-neutral-300 border-neutral-700"
                      : "bg-sky-500/20 text-sky-300 border-sky-500/40";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleOnboardingItemClick(item)
                      }
                      className="w-full flex items-center justify-between py-2 px-2 hover:bg-neutral-800/60 text-left cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-neutral-200">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {item.code}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClasses}`}
                      >
                        {uploadingId === item.id
                          ? "uploading..."
                          : item.status}
                      </span>
                    </button>
                  );
                })}
              </div>

              {uploading && (
                <div className="mt-2 text-[11px] text-neutral-400">
                  Uploading file...
                </div>
              )}
            </section>
          )}
        </>
      );
    }

    /* ---------------------- Other sections ---------------------- */

    if (activeSection === "Payments") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-4">
          <h2 className="text-sm font-semibold">Payments</h2>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-400">
                  Current balance due
                </div>
                <div className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : `$${(overallBalance ?? 0).toFixed(2)}`}
                </div>

                <div className="mt-3 text-xs text-neutral-300 space-y-1">
                  <div>
                    Section 8 pays:{" "}
                    <span className="font-semibold text-emerald-400">
                      $
                      {section8?.hap_amount
                        ? section8.hap_amount.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div>
                    Your portion (unpaid):{" "}
                    <span className="font-semibold text-neutral-100">
                      ${amountDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Housing Authority pays their portion directly.
                    Your balance is based on all recorded charges and
                    payments.
                  </div>
                  {overallBalance !== null && (
                    <div className="text-[11px] text-neutral-500">
                      Current balance (all months):{" "}
                      <span className="font-semibold text-neutral-100">
                        ${overallBalance.toFixed(2)}
                      </span>{" "}
                      (matches owner ledger)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold"
                    onClick={() => setShowReportPaymentForm((v) => !v)}
                  >
                    Report a payment
                  </button>
                  <button
                    className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold disabled:opacity-60"
                    disabled={stripeLoading}
                    onClick={handleStripeCheckout}
                  >
                    {stripeLoading ? "Opening..." : "Pay with card"}
                  </button>
                </div>
                <span className="text-[11px] text-neutral-400">
                  Autopay coming soon.
                </span>
              </div>
            </div>

            {stripeError && (
              <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                {stripeError}
              </div>
            )}
          </div>

          {/* Manual payment form */}
          {showReportPaymentForm && (
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-w-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Report a payment (pending)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setShowReportPaymentForm(false)
                  }
                  className="text-[11px] text-neutral-400 hover:text-neutral-200"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleSubmitReportedPayment}
                className="space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <label className="text-neutral-300">
                    Amount paid
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Example: 350.00"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300">
                    Payment method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="money_order">Money order</option>
                    <option value="cash">Cash</option>
                    <option value="cashier_check">Cashier’s check</option>
                    <option value="zelle">Zelle</option>
                    <option value="venmo">Venmo</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300">
                    Note (optional)
                  </label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) =>
                      setPaymentNote(e.target.value)
                    }
                    className="w-full min-h-[80px] rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Example: Money order #1234 dropped at office on Jan 5."
                  />
                </div>

                {paymentError && (
                  <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                    {paymentError}
                  </div>
                )}

                {paymentMessage && (
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 rounded-md px-3 py-2">
                    {paymentMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {paymentSaving ? "Submitting..." : "Submit report (pending)"}
                </button>
              </form>
            </section>
          )}

          {/* Payment history */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold mb-2">
              Payment history
            </h3>

            {payments.length === 0 ? (
              <p className="text-[11px] text-neutral-400">
                No payments recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-neutral-800 text-[11px]">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <div className="font-medium text-neutral-100">
                        ${p.amount.toFixed(2)}
                      </div>
                      <div className="text-neutral-500">
                        {(p.status === "pending" && p.source === "tenant_reported")
                          ? "Reported (pending)"
                          : p.status === "posted"
                            ? "Posted"
                            : p.status === "rejected"
                              ? "Rejected"
                              : "Payment"}
                        {p.method ? ` • ${PAYMENT_METHOD_LABELS[p.method] ?? p.method}` : ""}
                        {p.note ? ` – ${p.note}` : ""}
                      </div>

                    </div>
                    <div className="text-neutral-500">
                      {p.status === "posted" && p.posted_at
                        ? `Posted: ${new Date(p.posted_at).toLocaleDateString()}`
                        : p.created_at
                          ? new Date(p.created_at).toLocaleDateString()
                          : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      );
    }

    if (activeSection === "Messages & Alerts") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">
            Messages &amp; Alerts
          </h2>
          <p>
            Property messages, inspection reminders, and payment
            alerts will appear here.
          </p>
        </section>
      );
    }

    if (activeSection === "Inspections & Recertifications") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">
            Inspections &amp; Recertifications
          </h2>
          <p>
            Next inspection:{" "}
            <span className="font-semibold">
              {section8?.next_inspection_date || "not scheduled"}
            </span>
          </p>
          <p>
            Next recertification:{" "}
            <span className="font-semibold">
              {section8?.next_recertification_date ||
                "not scheduled"}
            </span>
          </p>
        </section>
      );
    }

    if (activeSection === "Lease & Documents") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">
            Lease &amp; Documents
          </h2>

          {docsError && (
            <p className="text-red-400 text-[11px]">
              {docsError}
            </p>
          )}

          {!docsError && docs.length === 0 && (
            <p>No documents uploaded yet.</p>
          )}

          {docs.length > 0 && (
            <div className="mt-3 border border-neutral-800 rounded-xl divide-y divide-neutral-800">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-neutral-100">
                      {DOC_LABELS[doc.doc_type ?? ""] ??
                        doc.doc_type ??
                        "Document"}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {doc.file_name}
                      {doc.created_at && (
                        <>
                          {" • "}
                          {new Date(
                            doc.created_at
                          ).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                  {doc.storage_path && (
                    <button
                      className="text-[11px] px-3 py-1 rounded-full border border-neutral-600 hover:bg-neutral-800"
                      onClick={async () => {
                        const { data, error } =
                          await supabase.storage
                            .from("tenant-docs")
                            .createSignedUrl(
                              doc.storage_path as string,
                              600
                            );
                        if (error || !data?.signedUrl) {
                          alert(
                            "Could not open file yet. Please try again."
                          );
                          return;
                        }
                        window.location.href = data.signedUrl;
                      }}
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (activeSection === "Contact Landlord") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">
            Contact Landlord / Caseworker
          </h2>
          <p>
            Landlord email / phone:{" "}
            <span className="font-semibold">coming soon</span>
          </p>
          <p>
            Caseworker:{" "}
            <span className="font-semibold">
              {section8?.caseworker_name || "Not set"}
            </span>{" "}
            {section8?.caseworker_email &&
              `(${section8.caseworker_email})`}
          </p>
        </section>
      );
    }

    if (activeSection === "Unit Info") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">
            Unit &amp; Section 8 Info
          </h2>
          <p>
            Unit:{" "}
            <span className="font-semibold">{user.unit}</span>
          </p>
          <p>
            Housing Authority:{" "}
            <span className="font-semibold">
              {section8?.housing_authority_name || "Not set"}
            </span>
          </p>
          <p>
            Your email:{" "}
            <span className="font-semibold">{user.email}</span>
          </p>
        </section>
      );
    }

    if (activeSection === "Important Links") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-2">
          <h2 className="text-sm font-semibold">Important Links</h2>
          <p>
            This is where you can add links to your local housing
            authority portal, FAQ, maintenance phone number, etc.
          </p>
        </section>
      );
    }

    return null;
  };

  /* --------------------------------------------------------------------- */
  /* Render                                                                */
  /* --------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="EquityHarbor Homes"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-100">
              EquityHarbor Homes
            </div>
            <div className="text-[11px] text-neutral-500">
              Resident &amp; Section 8 Portal
            </div>
            <div className="text-[11px] text-neutral-500">
              {user.unit || "Your Unit"}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          {menuItems.map((item) => (
            <button
              key={item}
              onClick={() => {
                if (item === "Lease & Documents") {
                  const encodedName = encodeURIComponent(
                    user.name ?? ""
                  );
                  router.push(
                    `/documents?tenantId=${user.id}&tenantName=${encodedName}`
                  );
                  return;
                }

                setActiveSection(item);
                setShowMaintenanceForm(false);
                setEditingOnboardingItem(null);
                if (item !== "Home") {
                  setActiveTab("Quick Links");
                  setLastQuickLink(null);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${activeSection === item
                ? "bg-neutral-800 text-white"
                : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={async () => {
            try {
              await supabase.auth.signOut();
            } catch {
              // ignore
            }
            onLogout();
          }}
          className="m-4 mt-0 mb-5 text-xs text-neutral-400 hover:text-neutral-200 text-left"
        >
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Top bar */}
        <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold">
              {activeSection}
            </h1>
            <p className="text-xs text-neutral-400">
              Overview of your rent, Section 8 payments, and
              maintenance.
            </p>
          </div>
          <div className="flex items-center gap-4 text-neutral-400 text-sm">
            <span className="text-neutral-300">
              Hi, {user.name || "Resident"}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Payment status banner */}
          {banner && (
            <div
              className={`text-[11px] px-3 py-2 rounded-lg border ${banner.type === "success"
                ? "bg-emerald-950/40 border-emerald-600 text-emerald-300"
                : "bg-red-950/40 border-red-600 text-red-300"
                }`}
            >
              {banner.message}
            </div>
          )}

          {/* Top balance card */}
          <section className="bg-gradient-to-r from-neutral-900 to-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-400">
                  Current balance due
                </div>
                <div className="text-3xl font-bold">
                  {loading
                    ? "..."
                    : `$${(overallBalance ?? 0).toFixed(2)}`}
                </div>

                <div className="mt-3 text-xs text-neutral-300 space-y-1">
                  <div>
                    Section 8 pays:{" "}
                    <span className="font-semibold text-emerald-400">
                      $
                      {section8?.hap_amount
                        ? section8.hap_amount.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div>
                    Your portion (unpaid):{" "}
                    <span className="font-semibold text-neutral-100">
                      ${amountDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Housing Authority pays their portion directly.
                    This amount is what you owe based on all recorded
                    charges and payments.
                  </div>
                  {overallBalance !== null && (
                    <div className="text-[11px] text-neutral-500">
                      Current balance (all months):{" "}
                      <span className="font-semibold text-neutral-100">
                        ${overallBalance.toFixed(2)}
                      </span>{" "}
                      (matches owner ledger)
                    </div>
                  )}
                </div>

                {balanceError && (
                  <div className="mt-2 text-[11px] text-red-400">
                    {balanceError}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  className="px-5 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold"
                  onClick={() => setActiveSection("Payments")}
                >
                  {overallBalance && overallBalance > 0
                    ? "Pay or report payment"
                    : "View Payment History"}
                </button>
                <button className="text-[11px] text-neutral-400 underline underline-offset-2">
                  Set up autopay (coming soon)
                </button>
              </div>
            </div>
          </section>

          {/* Section-specific content */}
          {renderSectionContent()}

          {/* Maintenance request form */}
          {showMaintenanceForm && (
            <section className="mt-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-w-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">
                  New Maintenance Request
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMaintenanceForm(false)}
                  className="text-[11px] text-neutral-400 hover:text-neutral-200"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleSubmitMaintenance}
                className="space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <label className="text-neutral-300">Title</label>
                  <input
                    type="text"
                    value={maintenanceTitle}
                    onChange={(e) =>
                      setMaintenanceTitle(e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Example: Kitchen sink leaking"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300">
                    Description
                  </label>
                  <textarea
                    value={maintenanceDescription}
                    onChange={(e) =>
                      setMaintenanceDescription(e.target.value)
                    }
                    className="w-full min-h-[80px] rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Explain what’s wrong, and when maintenance can enter."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300">Priority</label>
                  <select
                    value={maintenancePriority}
                    onChange={(e) =>
                      setMaintenancePriority(e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low – not urgent</option>
                    <option value="normal">Normal</option>
                    <option value="high">
                      High – needs quick attention
                    </option>
                  </select>
                </div>

                {maintenanceError && (
                  <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                    {maintenanceError}
                  </div>
                )}

                {maintenanceMessage && (
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 rounded-md px-3 py-2">
                    {maintenanceMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={maintenanceSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {maintenanceSubmitting
                    ? "Submitting..."
                    : "Submit Request"}
                </button>
              </form>
            </section>
          )}

          {/* Confirm move-in date dialog */}
          {editingOnboardingItem &&
            editingOnboardingItem.code === "confirm_move_in" && (
              <section className="mt-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-w-md">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">
                    Confirm move-in date
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingOnboardingItem(null)
                    }
                    className="text-[11px] text-neutral-400 hover:text-neutral-200"
                  >
                    Close
                  </button>
                </div>

                <form
                  onSubmit={handleSaveMoveInDate}
                  className="space-y-3 text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-neutral-300">
                      Move-in date
                    </label>
                    <input
                      type="date"
                      value={moveInDateInput}
                      onChange={(e) =>
                        setMoveInDateInput(e.target.value)
                      }
                      className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {onboardingError && (
                    <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                      {onboardingError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={onboardingSaving}
                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {onboardingSaving ? "Saving..." : "Save move-in date"}
                  </button>
                </form>
              </section>
            )}
        </div>
      </main>
    </div>
  );
};

export default TenantPortal;