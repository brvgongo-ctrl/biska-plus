"use server";

import { refresh } from "next/cache";
import {
  describeKycError,
  parseOptionalInt,
  pt,
  toSaveArgs,
  validateProfessionalInput,
  type ProfessionalInput,
} from "@biska/shared";
import { requireUser } from "@/lib/auth";

export type ActionState = { ok?: boolean; error?: string } | null;

/** Cria ou actualiza o perfil profissional, o nome e as zonas (save_professional_profile). */
export async function saveProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireUser("/profissional");

  const input: ProfessionalInput = {
    fullName: String(form.get("full_name") ?? "").trim().replace(/\s+/g, " "),
    categorySlug: String(form.get("category") ?? ""),
    yearsExperience: parseOptionalInt(String(form.get("years_experience") ?? "")),
    dailyRateKz: parseOptionalInt(String(form.get("daily_rate_kz") ?? "")),
    bio: String(form.get("bio") ?? "").trim(),
    zoneIds: [...new Set(form.getAll("zones").map(Number))].filter(Number.isInteger),
  };

  const invalid = validateProfessionalInput(input);
  if (invalid) return { error: invalid };

  const { error } = await supabase.rpc("save_professional_profile", toSaveArgs(input));
  if (error) return { error: error.message || pt.pro.error };

  refresh();
  return { ok: true };
}

/** Regista o consentimento (Lei n.º 22/11) e submete o cadastro. */
export async function submitKyc(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireUser("/profissional");

  if (form.get("consent") === "on") {
    const { error } = await supabase
      .from("professional_profiles")
      .update({ data_consent_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("data_consent_at", null);
    if (error) return { error: pt.pro.error };
  }

  const { error } = await supabase.rpc("submit_kyc");
  if (error) return { error: describeKycError(error.message) };

  refresh();
  return { ok: true };
}
