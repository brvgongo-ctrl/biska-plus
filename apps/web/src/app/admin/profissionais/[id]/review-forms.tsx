"use client";

import { useActionState } from "react";
import { pt, type KycStatus } from "@biska/shared";
import { reviewDocument, reviewKyc } from "../../actions";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

/** Aceitar ou rejeitar (com motivo) um documento. */
export function DocumentReview({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(reviewDocument, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="document_id" value={documentId} />
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {pt.admin.rejectReason}
        <input
          name="note"
          maxLength={300}
          className="h-11 rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-navy"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="accepted"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-ok px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {pt.admin.accept}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-danger px-4 text-sm font-bold text-danger disabled:opacity-60"
        >
          {pt.admin.reject}
        </button>
      </div>
      <ErrorText message={state?.error} />
    </form>
  );
}

/** Decisão sobre o cadastro; os botões dependem do estado actual. */
export function KycDecision({ professionalId, status }: { professionalId: string; status: KycStatus }) {
  const [state, action, pending] = useActionState(reviewKyc, null);

  const buttons: { decision: KycStatus; label: string; className: string }[] = [];
  if (status === "submitted") {
    buttons.push({ decision: "in_review", label: pt.admin.startReview, className: "border border-line text-navy" });
  }
  if (status === "submitted" || status === "in_review") {
    buttons.push(
      { decision: "approved", label: pt.admin.approve, className: "bg-ok text-white" },
      { decision: "needs_fix", label: pt.admin.askFix, className: "bg-amber text-navy" },
      { decision: "rejected", label: pt.admin.rejectAll, className: "border border-danger text-danger" },
    );
  }
  if (status === "approved") {
    buttons.push({ decision: "rejected", label: pt.admin.suspend, className: "border border-danger text-danger" });
  }
  if (buttons.length === 0) return null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="professional_id" value={professionalId} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {pt.admin.note}
        <textarea
          name="note"
          rows={3}
          maxLength={600}
          placeholder={pt.admin.notePlaceholder}
          className="rounded-xl border border-line bg-white px-3 py-2 font-normal outline-none focus:border-navy"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.decision}
            type="submit"
            name="decision"
            value={b.decision}
            disabled={pending}
            className={`h-12 rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${b.className}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <ErrorText message={state?.error} />
    </form>
  );
}
