import type { Metadata } from "next";
import { Suspense } from "react";
import {
  canEditKyc,
  getCategory,
  pt,
  requiredDocuments,
  type KycDocument,
  type KycStatus,
  type ProfessionalProfile,
  type Zone,
} from "@biska/shared";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { Documents } from "./documents";
import { ProfileForm } from "./profile-form";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Cadastro de profissional · Biska+" };

export default function ProfessionalPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">{pt.pro.title}</h1>
          <p className="text-muted">{pt.pro.intro}</p>
        </div>
        <Suspense fallback={<p className="text-muted">A carregar…</p>}>
          <Onboarding />
        </Suspense>
      </main>
    </>
  );
}

async function Onboarding() {
  const { supabase, userId } = await requireUser("/profissional");

  const [profile, pro, zones, myZones, documents] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("professional_profiles").select("*").eq("user_id", userId).maybeSingle<ProfessionalProfile>(),
    supabase.from("zones").select("*").order("name").overrideTypes<Zone[], { merge: false }>(),
    supabase.from("professional_zones").select("zone_id").eq("user_id", userId),
    supabase.from("kyc_documents").select("*").eq("user_id", userId).overrideTypes<KycDocument[], { merge: false }>(),
  ]);

  const p = pro.data;
  const status = p?.kyc_status ?? null;
  const editable = canEditKyc(status);
  const docs = documents.data ?? [];
  const required = requiredDocuments(getCategory(p?.category_slug ?? ""));
  const missing = required
    .filter((t) => !docs.some((d) => d.type === t && d.status !== "rejected"))
    .map((t) => pt.kyc.documents[t].label);

  return (
    <>
      {status && <StatusBanner status={status} note={p?.kyc_review_note ?? null} />}

      <section aria-labelledby="dados" className="flex flex-col gap-4">
        <h2 id="dados" className="text-lg font-bold">
          {pt.pro.stepProfile}
        </h2>
        <ProfileForm
          defaults={{
            fullName: profile.data?.full_name ?? "",
            category: p?.category_slug ?? "",
            years: p?.years_experience ?? null,
            dailyRate: p?.daily_rate_kz ?? null,
            bio: p?.bio ?? "",
            zoneIds: (myZones.data ?? []).map((z) => z.zone_id as number),
          }}
          zones={zones.data ?? []}
          categoryLocked={!editable}
          nameLocked={status === "approved"}
          readOnly={!editable && status !== "approved"}
        />
      </section>

      <section aria-labelledby="documentos" className="flex flex-col gap-4">
        <h2 id="documentos" className="text-lg font-bold">
          {pt.pro.stepDocuments}
        </h2>
        {p ? (
          <Documents userId={userId} documents={docs} required={required} editable={editable} />
        ) : (
          <p className="rounded-xl bg-amber-soft p-3 text-sm text-amber-text">{pt.pro.saveFirst}</p>
        )}
      </section>

      {p && editable && (
        <section aria-labelledby="enviar" className="flex flex-col gap-4">
          <h2 id="enviar" className="text-lg font-bold">
            {pt.pro.stepSubmit}
          </h2>
          <SubmitForm missing={missing} consented={Boolean(p.data_consent_at)} />
        </section>
      )}
    </>
  );
}

const bannerStyle: Record<KycStatus, string> = {
  draft: "bg-white border border-line text-ink",
  submitted: "bg-amber-soft text-amber-text",
  in_review: "bg-amber-soft text-amber-text",
  needs_fix: "bg-amber-soft text-amber-text",
  approved: "bg-ok-soft text-ok-text",
  rejected: "bg-[#FDECEA] text-danger",
};

function StatusBanner({ status, note }: { status: KycStatus; note: string | null }) {
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-2xl p-4 ${bannerStyle[status]}`}>
      <span className="text-xs font-bold uppercase tracking-wide">{pt.kyc.status[status]}</span>
      <p>{pt.pro.banner[status]}</p>
      {note && <p className="font-semibold">{note}</p>}
    </div>
  );
}
