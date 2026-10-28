import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  KYC_DOCUMENT_ORDER,
  formatAngolanPhone,
  formatDateTime,
  formatKz,
  getCategory,
  pt,
  type KycDocument,
  type ProfessionalProfile,
} from "@biska/shared";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth";
import { DocumentReview, KycDecision } from "./review-forms";

export const metadata: Metadata = { title: "Verificar profissional · Biska+" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 10 * 60;

type Detail = ProfessionalProfile & {
  profiles: { full_name: string | null; phone: string | null; phone_verified_at: string | null } | null;
  professional_zones: { zones: { name: string } | null }[];
};

interface AuditRow {
  id: number;
  action: string;
  meta: { decision?: string; note?: string | null };
  created_at: string;
}

const AUDIT_LABELS: Record<string, string> = {
  "kyc.submit": "Cadastro enviado",
  "kyc.view": "Documentos consultados",
  "kyc.review": "Decisão",
  "kyc.document_review": "Documento revisto",
};

export default function ProfessionalReviewPage({ params }: PageProps<"/admin/profissionais/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <Link href="/admin" className="text-sm font-semibold text-muted underline">
          ← {pt.admin.back}
        </Link>
        <Suspense fallback={<p className="text-muted">A carregar…</p>}>
          <Review params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Review({ params }: { params: PageProps<"/admin/profissionais/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin(`/admin/profissionais/${id}`);

  const [{ data: pro }, { data: documents }, { data: history }] = await Promise.all([
    supabase
      .from("professional_profiles")
      .select("*, profiles(full_name, phone, phone_verified_at), professional_zones(zones(name))")
      .eq("user_id", id)
      .maybeSingle<Detail>(),
    supabase.from("kyc_documents")
      .select("*")
      .eq("user_id", id)
      .order("created_at")
      .overrideTypes<KycDocument[], { merge: false }>(),
    supabase
      .from("audit_log")
      .select("id, action, meta, created_at")
      .or(`target_id.eq.${id},meta->>professional_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(30)
      .overrideTypes<AuditRow[], { merge: false }>(),
  ]);
  if (!pro) notFound();

  const docs = [...(documents ?? [])].sort(
    (a, b) => KYC_DOCUMENT_ORDER.indexOf(a.type) - KYC_DOCUMENT_ORDER.indexOf(b.type),
  );

  // Abrir os documentos de alguém fica registado (Lei n.º 22/11).
  await supabase.rpc("log_kyc_view", { professional_id: id });
  const { data: signed } = docs.length
    ? await supabase.storage.from("kyc-documents").createSignedUrls(
        docs.map((d) => d.storage_path),
        SIGNED_URL_SECONDS,
      )
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const reviewing = pro.kyc_status === "submitted" || pro.kyc_status === "in_review";
  const zones = pro.professional_zones.map((z) => z.zones?.name).filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">{pro.profiles?.full_name || "—"}</h1>
            <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-text">
              {pt.kyc.status[pro.kyc_status]}
            </span>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item term={pt.pro.category} value={getCategory(pro.category_slug)?.name ?? pro.category_slug} />
            <Item
              term="Telefone"
              value={
                pro.profiles?.phone
                  ? `${formatAngolanPhone(pro.profiles.phone)}${pro.profiles.phone_verified_at ? " ✓" : ""}`
                  : "—"
              }
            />
            <Item term={pt.pro.years} value={pro.years_experience?.toString() ?? "—"} />
            <Item term={pt.pro.dailyRate} value={pro.daily_rate_kz ? formatKz(pro.daily_rate_kz) : "—"} />
            <Item term={pt.pro.zones} value={zones.join(", ") || "—"} />
            <Item
              term="Consentimento (Lei n.º 22/11)"
              value={pro.data_consent_at ? formatDateTime(pro.data_consent_at) : "—"}
            />
          </dl>
          {pro.bio && <p className="whitespace-pre-line text-sm text-muted">{pro.bio}</p>}
        </section>

        <section aria-labelledby="docs" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="docs" className="text-lg font-bold">
              {pt.admin.documents}
            </h2>
            <p className="text-xs text-muted">{pt.admin.viewLogged}</p>
          </div>
          {docs.length === 0 && <p className="text-muted">{pt.admin.empty}</p>}
          <ul className="grid gap-4 sm:grid-cols-2">
            {docs.map((doc) => {
              const url = urlByPath.get(doc.storage_path);
              const isPdf = doc.storage_path.endsWith(".pdf");
              return (
                <li key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{pt.kyc.documents[doc.type].label}</span>
                    <span className="text-xs font-semibold text-muted">{pt.kyc.documentStatus[doc.status]}</span>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-ground">
                      {isPdf ? (
                        <span className="flex h-40 items-center justify-center text-sm font-semibold underline">
                          PDF · {pt.admin.open}
                        </span>
                      ) : (
                        // Endereço assinado e temporário: não passa pelo optimizador de imagens.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={pt.kyc.documents[doc.type].label} className="h-48 w-full object-contain" />
                      )}
                    </a>
                  ) : (
                    <p className="text-sm text-danger">{pt.admin.noFile}</p>
                  )}
                  {doc.reviewer_note && <p className="text-sm text-danger">{doc.reviewer_note}</p>}
                  {reviewing && doc.status === "pending" && <DocumentReview documentId={doc.id} />}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">{pt.admin.decision}</h2>
          {pro.kyc_review_note && <p className="text-sm text-muted">{pro.kyc_review_note}</p>}
          <KycDecision professionalId={id} status={pro.kyc_status} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{pt.admin.history}</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex flex-col rounded-xl bg-white p-3">
                <span className="font-semibold">
                  {AUDIT_LABELS[h.action] ?? h.action}
                  {h.meta.decision &&
                    ` · ${
                      h.meta.decision in pt.kyc.status
                        ? pt.kyc.status[h.meta.decision as keyof typeof pt.kyc.status]
                        : h.meta.decision in pt.kyc.documentStatus
                          ? pt.kyc.documentStatus[h.meta.decision as keyof typeof pt.kyc.documentStatus]
                          : h.meta.decision
                    }`}
                </span>
                {h.meta.note && <span className="text-muted">{h.meta.note}</span>}
                <span className="text-xs text-muted">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function Item({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
