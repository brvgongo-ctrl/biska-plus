"use server";

import { refresh } from "next/cache";
import { pt } from "@biska/shared";
import { requireAdmin } from "@/lib/auth";

export type ActionState = { ok?: boolean; error?: string } | null;

const DOCUMENT_DECISIONS = ["accepted", "rejected"];
const KYC_DECISIONS = ["in_review", "needs_fix", "approved", "rejected"];

/** Aceita ou rejeita um documento. As regras ficam em review_kyc_document(). */
export async function reviewDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin("/admin");
  const decision = String(form.get("decision") ?? "");
  if (!DOCUMENT_DECISIONS.includes(decision)) return { error: pt.pro.error };

  const { error } = await supabase.rpc("review_kyc_document", {
    document_id: String(form.get("document_id") ?? ""),
    decision,
    note: String(form.get("note") ?? "").trim() || null,
  });
  if (error) return { error: error.message || pt.pro.error };

  refresh();
  return { ok: true };
}

/** Decide o cadastro (análise, correcção, aprovação, rejeição). Regras em review_kyc(). */
export async function reviewKyc(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin("/admin");
  const decision = String(form.get("decision") ?? "");
  if (!KYC_DECISIONS.includes(decision)) return { error: pt.pro.error };

  const { error } = await supabase.rpc("review_kyc", {
    professional_id: String(form.get("professional_id") ?? ""),
    decision,
    note: String(form.get("note") ?? "").trim() || null,
  });
  if (error) return { error: error.message || pt.pro.error };

  refresh();
  return { ok: true };
}
