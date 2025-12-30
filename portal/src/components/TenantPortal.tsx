"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import type { TenantUser } from "../app/page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  created_at: string | null;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TenantPortal: React.FC<Props> = ({ user, onLogout }) => {
  // Navigation
  const [activeSection, setActiveSection] =
    useState<MainSection>("Home");
  const [activeTab, setActiveTab] = useState<TopTab>("Quick Links");
  const [lastQuickLink, setLastQuickLink] = useState<string | null>(
    null
  );

  // Top card / Section 8 / charges
  const [amountDue, setAmountDue] = useState<number>(0);
  const [currentCharge, setCurrentCharge] =
    useState<CurrentCharge | null>(null);
  const [section8, setSection8] = useState<Section8Case | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // NEW: overall ledger balance + error (matches owner portal)
  const [overallBalance, setOverallBalance] =
    useState<number | null>(null);
  const [balanceError, setBalanceError] =
    useState<string | null>(null);

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

  // Payments
  const [showManualPaymentForm, setShowManualPaymentForm] =
    useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] =
    useState<string>("Online portal");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] =
    useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] =
    useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] =
    useState<string | null>(null);

  // Banner for payment success / cancel
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const autoPayEnabled = false; // reserved for future

  // -------------------------------------------------------------------------
  // Load dashboard data
  // -------------------------------------------------------------------------

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setBalanceError(null); // NEW: reset balance error each load

    try {
      // NEW: overall current balance from tenant_balances
      const { data: balanceRow, error: balanceErr } = await supabase
        .from("tenant_balances")
        .select("current_balance")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (balanceErr) {
        console.error(
          "[TenantPortal] tenant_balances error",
          balanceErr
        );
        setBalanceError(
          "We couldn't load your latest balance yet. Amounts may be slightly out of date."
        );
      }

      if (balanceRow && balanceRow.current_balance != null) {
        const numeric = Number(balanceRow.current_balance);
        setOverallBalance(
          Number.isFinite(numeric) ? numeric : 0
        );
      } else if (!balanceErr) {
        // no row yet = zero balance
        setOverallBalance(0);
      }

      // Section 8 info
      const { data: s8 } = await supabase
        .from("section8_cases")
        .select(
          "hap_amount, tenant_portion, next_inspection_date, next_recertification_date, housing_authority_name, caseworker_name, caseworker_email"
        )
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (s8) {
        setSection8({
          hap_amount: s8.hap_amount,
          tenant_portion: s8.tenant_portion,
          next_inspection_date: s8.next_inspection_date,
          next_recertification_date: s8.next_recertification_date,
          housing_authority_name: s8.housing_authority_name,
          caseworker_name: s8.caseworker_name,
          caseworker_email: s8.caseworker_email,
        });
      } else {
        setSection8(null);
      }

      // Current month charges (unpaid tenant portion)
      const today = new Date();
      const monthStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
        .toISOString()
        .slice(0, 10);
      const monthEnd = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      )
        .toISOString()
        .slice(0, 10);

      const { data: charges } = await supabase
        .from("charges")
        .select("id, amount, due_date, is_paid, description")
        .eq("tenant_id", user.id)
        .eq("is_paid", false)
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("due_date", { ascending: true });

      if (charges && charges.length > 0) {
        const total = charges.reduce(
          (sum: number, c: any) => sum + Number(c.amount || 0),
          0
        );
        setAmountDue(total);

        const first = charges[0] as any;
        setCurrentCharge({
          id: first.id,
          amount: Number(first.amount || 0),
          description: first.description ?? null,
          due_date: first.due_date,
        });
      } else {
        setAmountDue(0);
        setCurrentCharge(null);
      }

      // Onboarding items with join to onboarding_steps
      const { data: onboardingRows, error: onboardingErr } =
        await supabase
          .from("tenant_onboarding")
          .select(
            `
            id,
            tenant_id,
            step_id,
            status,
            data,
            onboarding_steps (
              id,
              code,
              title,
              sort_order
            )
          `
          )
          .eq("tenant_id", user.id);

      console.log("DEBUG tenant_onboarding raw", {
        rows: onboardingRows,
        onboardingErr,
      });

      let list: OnboardingItem[] = [];

      if (onboardingRows && onboardingRows.length > 0) {
        list = (onboardingRows as any[])
          .map((row) => {
            const step = row.onboarding_steps;
            if (!step) return null;

            const item: OnboardingItem = {
              id: row.id as string,
              step_id: row.step_id as string,
              code: step.code as string,
              title: step.title as string,
              status: (row.status || "pending") as OnboardingStatus,
              sort_order: (step.sort_order as number) ?? 0,
              data: row.data ?? null,
            };
            return item;
          })
          .filter(
            (x): x is OnboardingItem => x !== null
          )
          .sort((a, b) => a.sort_order - b.sort_order);
      }

      console.log("DEBUG onboardingList", list);
      setOnboardingItems(list);

      // Overall onboarding_status
      let derivedStatus: string | null = null;
      if (list.length === 0) {
        derivedStatus = null;
      } else if (list.every((i) => i.status === "completed")) {
        derivedStatus = "active";
      } else if (
        list.some(
          (i) =>
            i.status === "in_progress" || i.status === "completed"
        )
      ) {
        derivedStatus = "in_progress";
      } else {
        derivedStatus = "pending";
      }

      setOnboardingStatus(derivedStatus);

      if (derivedStatus !== null) {
        await supabase
          .from("tenants")
          .update({ onboarding_status: derivedStatus })
          .eq("id", user.id);
      }

      // Docs
      const { data: docRows, error: docErr } = await supabase
        .from("tenant_docs")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (docErr) {
        console.error("tenant_docs error", docErr);
        setDocsError("Could not load documents yet.");
        setDocs([]);
      } else if (docRows) {
        setDocs(docRows as TenantDoc[]);
        setDocsError(null);
      }

      // Payments history
      const { data: paymentRows, error: payErr } = await supabase
        .from("payments")
        .select("id, tenant_id, amount, method, note, created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (payErr) {
        console.error("payments error", payErr);
        setPayments([]);
      } else if (paymentRows) {
        setPayments(paymentRows as PaymentRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // -------------------------------------------------------------------------
  // Read payment status + tab from URL (after Stripe redirect)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    // 1) If tab=payments, show the Payments screen right away
    const tab = url.searchParams.get("tab");
    if (tab === "payments") {
      setActiveSection("Payments");
    }

    // 2) Normalize all the possible param names we might use
    const statusParam =
      url.searchParams.get("paymentStatus") ||      // current
      url.searchParams.get("payment_status") ||     // snake_case
      url.searchParams.get("status") ||
      url.searchParams.get("payment");

    if (!statusParam) return;

    if (statusParam === "success") {
      setBanner({
        type: "success",
        message:
          "Payment received. It may take a few seconds for your balance and history to update.",
      });

      // Refresh dashboard data (charges + payments)
      loadDashboard();
    } else if (statusParam === "cancelled") {
      setBanner({
        type: "error",
        message:
          "Card payment cancelled. No money was taken. You can try again anytime.",
      });
    }

    // 3) Clean *all* of those params so refresh doesn't keep showing the banner
    url.searchParams.delete("paymentStatus");
    url.searchParams.delete("payment_status");
    url.searchParams.delete("status");
    url.searchParams.delete("payment");
    window.history.replaceState({}, "", url.toString());
  }, [loadDashboard]);

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

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
          tenant_id: user.id,
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

  // ---------------------------------------------------------------------------
  // Onboarding interactions
  // ---------------------------------------------------------------------------

  const toggleOnboardingStatus = async (item: OnboardingItem) => {
    const previousStatus = item.status;
    const nextStatus: OnboardingStatus =
      item.status === "completed" ? "pending" : "completed";

    // Optimistic UI
    setOnboardingItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: nextStatus } : i
      )
    );

    const { error } = await supabase
      .from("tenant_onboarding")
      .update({ status: nextStatus })
      .eq("id", item.id)
      .eq("tenant_id", user.id);

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
      // Refresh status badge
      loadDashboard();
    }
  };

  const handleOnboardingItemClick = (item: OnboardingItem) => {
    // Avoid double actions while an upload is in progress
    if (uploading) {
      return;
    }

    // File-upload steps (allow replace)
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
        // allow re-selecting the same file
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
      return;
    }

    // Move-in date step
    if (item.code === "confirm_move_in") {
      setEditingOnboardingItem(item);
      setOnboardingError(null);
      setMoveInDateInput("");
      return;
    }

    // Other steps: simple toggle
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
        .eq("tenant_id", user.id);

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

  // ---------------------------------------------------------------------------
  // File upload handler
  // ---------------------------------------------------------------------------

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !uploadStep) {
      return;
    }

    // Basic client-side validation
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];
    const maxBytes = 10 * 1024 * 1024; // 10 MB

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
      // Generate a safe, opaque path (do not expose the full original filename)
      const randomId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const ext = file.name.includes(".")
        ? file.name.split(".").pop()
        : "";
      const safeExt = ext ? `.${ext}` : "";

      const path = `${user.id}/${uploadStep.code}/${randomId}${safeExt}`;

      // 1) Upload to Storage
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

      // Shared payload for onboarding step
      const onboardingPayload: any = {
        status: "completed" as OnboardingStatus,
        data: {
          storage_path: path,
          file_name: file.name,
        },
        completed_at: new Date().toISOString(),
      };

      // 2) Insert into tenant_docs AND 3) update onboarding step in parallel
      const [
        { data: insertedDoc, error: insertErr },
        { error: onboardingErr },
      ] = await Promise.all([
        supabase
          .from("tenant_docs")
          .insert({
            tenant_id: user.id,
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

  // ---------------------------------------------------------------------------
  // Payments – manual record + Stripe Checkout
  // ---------------------------------------------------------------------------

  const handleSaveManualPayment = async (
    e: React.FormEvent
  ) => {
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
      const { error } = await supabase
        .from("payments")
        .insert({
          tenant_id: user.id,
          amount,
          method: paymentMethod,
          note: paymentNote || null,
        });

      if (error) throw error;

      setPaymentMessage("Payment recorded.");
      setPaymentAmount("");
      setPaymentNote("");
      setShowManualPaymentForm(false);

      // Refresh payment list
      await loadDashboard();
    } catch (err: any) {
      setPaymentError(
        err.message || "Could not save payment. Please try again."
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleStripeCheckout = async () => {
    setStripeError(null);

    if (!currentCharge || currentCharge.amount <= 0) {
      setStripeError(
        "We couldn’t find a charge for this month. Please contact the property manager if this seems wrong."
      );
      return;
    }

    setStripeLoading(true);

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeId: currentCharge.id,
          tenantId: user.id,
          email: user.email,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Unable to start checkout.");
      }

      const data = await res.json();
      if (!data?.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Stripe checkout error", err);
      setStripeError(
        err.message ||
          "Could not start card payment. Please try again."
      );
    } finally {
      setStripeLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Section renderer
  // ---------------------------------------------------------------------------

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
                className={`px-3 py-1 rounded-full ${
                  activeTab === tab
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

          {/* Onboarding checklist – only show if there are steps */}
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

    // Other sections

    if (activeSection === "Payments") {
      return (
        <section className="mt-4 text-xs text-neutral-300 space-y-4">
          <h2 className="text-sm font-semibold">Payments</h2>

          {/* Current month summary + actions */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-400">
                  Tenant Portion Due (this month)
                </div>
                <div className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : amountDue === 0
                    ? "$0.00"
                    : `$${amountDue.toFixed(2)}`}
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
                    Your portion:{" "}
                    <span className="font-semibold text-neutral-100">
                      $
                      {section8?.tenant_portion
                        ? section8.tenant_portion.toFixed(2)
                        : amountDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Housing Authority pays their portion directly.
                    This amount is what you owe.
                  </div>
                  {currentCharge?.description && (
                    <div className="text-[11px] text-neutral-500">
                      {currentCharge.description}
                    </div>
                  )}
                  {/* NEW: show overall ledger balance */}
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
                    onClick={() =>
                      setShowManualPaymentForm((v) => !v)
                    }
                  >
                    Record a payment
                  </button>
                  <button
                    className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold disabled:opacity-60"
                    disabled={stripeLoading}
                    onClick={handleStripeCheckout}
                  >
                    {stripeLoading ? "Opening..." : "Pay with card"}
                  </button>
                </div>
                {autoPayEnabled ? (
                  <span className="text-[11px] text-emerald-400">
                    Autopay is enabled for your account.
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-400">
                    Autopay coming soon.
                  </span>
                )}
              </div>
            </div>

            {stripeError && (
              <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
                {stripeError}
              </div>
            )}
          </div>

          {/* Manual payment form */}
          {showManualPaymentForm && (
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-w-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Record a payment
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setShowManualPaymentForm(false)
                  }
                  className="text-[11px] text-neutral-400 hover:text-neutral-200"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleSaveManualPayment}
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
                    onChange={(e) =>
                      setPaymentMethod(e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Online portal</option>
                    <option>Card in office</option>
                    <option>Money order</option>
                    <option>Cash</option>
                    <option>Other</option>
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
                    placeholder="Example: Paid at office, money order #1234."
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
                  {paymentSaving ? "Saving..." : "Save payment"}
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
                        {p.method || "Payment"}
                        {p.note ? ` – ${p.note}` : ""}
                      </div>
                    </div>
                    <div className="text-neutral-500">
                      {p.created_at
                        ? new Date(
                            p.created_at
                          ).toLocaleDateString()
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
                      {DOC_LABELS[doc.doc_type ?? ""] ?? doc.doc_type ??
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
                              600 // 10 minutes
                            );
                        if (error || !data?.signedUrl) {
                          alert(
                            "Could not open file yet. Please try again."
                          );
                          return;
                        }
                        // Navigate in the same tab for reliability
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
                setActiveSection(item);
                setShowMaintenanceForm(false);
                setEditingOnboardingItem(null);
                if (item !== "Home") {
                  setActiveTab("Quick Links");
                  setLastQuickLink(null);
                }
              }}
              className={`w-full flex itemscenter gap-2 px-3 py-2 rounded-lg text-left ${
                activeSection === item
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
              <span>{item}</span>
              {item === "Messages & Alerts"
              }
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
        {/* Hidden file input for onboarding uploads */}
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
          {/* Optional banner (payment success / cancel) */}
          {banner && (
            <div
              className={`text-[11px] px-3 py-2 rounded-lg border ${
                banner.type === "success"
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
                  Tenant Portion Due (this month)
                </div>
                <div className="text-3xl font-bold">
                  {loading
                    ? "..."
                    : amountDue === 0
                    ? "$0.00"
                    : `$${amountDue.toFixed(2)}`}
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
                    Your portion:{" "}
                    <span className="font-semibold text-neutral-100">
                      $
                      {section8?.tenant_portion
                        ? section8.tenant_portion.toFixed(2)
                        : amountDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Housing Authority pays their portion directly.
                    This amount is what you owe.
                  </div>
                  {/* NEW: ledger balance callout */}
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

                {/* NEW: Optional error text if tenant_balances query failed */}
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
                  {amountDue === 0
                    ? "View Payment History"
                    : "Pay or record payment"}
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
