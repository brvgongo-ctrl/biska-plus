import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { formatDateTime, getCategory, pt, type KycDocumentStatus, type KycStatus } from "@biska/shared";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Painel admin · Biska+" };

const FILTERS: Record<keyof typeof pt.admin.filters, KycStatus[]> = {
  pending: ["submitted", "in_review"],
  needs_fix: ["needs_fix"],
  approved: ["approved"],
  rejected: ["rejected"],
  draft: ["draft"],
};

type Filter = keyof typeof FILTERS;

interface QueueRow {
  user_id: string;
  category_slug: string;
  kyc_status: KycStatus;
  kyc_submitted_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; phone: string | null } | null;
  kyc_documents: { status: KycDocumentStatus }[];
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{pt.admin.title}</h1>
        <Suspense fallback={<p className="text-muted">A carregar…</p>}>
          <Queue searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { supabase } = await requireAdmin("/admin");
  const { estado } = await searchParams;
  const filter: Filter = typeof estado === "string" && estado in FILTERS ? (estado as Filter) : "pending";

  const { data, error } = await supabase
    .from("professional_profiles")
    .select(
      "user_id, category_slug, kyc_status, kyc_submitted_at, created_at, profiles(full_name, phone), kyc_documents(status)",
    )
    .in("kyc_status", FILTERS[filter])
    // Primeiro quem espera há mais tempo.
    .order("kyc_submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(200)
    .overrideTypes<QueueRow[], { merge: false }>();

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={pt.admin.queue} className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={f === "pending" ? "/admin" : `/admin?estado=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className="flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold aria-[current=page]:border-navy aria-[current=page]:bg-navy aria-[current=page]:text-white"
          >
            {pt.admin.filters[f]}
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDECEA] p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      {data && data.length === 0 && <p className="text-muted">{pt.admin.empty}</p>}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((row) => {
            const pending = row.kyc_documents.filter((d) => d.status === "pending").length;
            return (
              <li key={row.user_id}>
                <Link
                  href={`/admin/profissionais/${row.user_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 hover:border-navy"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{row.profiles?.full_name || "—"}</span>
                    <span className="text-sm text-muted">
                      {getCategory(row.category_slug)?.name ?? row.category_slug}
                      {row.kyc_submitted_at && ` · ${pt.admin.submittedAt} ${formatDateTime(row.kyc_submitted_at)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-ground px-3 py-1">
                      {pt.admin.documents}: {row.kyc_documents.length}
                      {pending > 0 && ` (${pending} ${pt.kyc.documentStatus.pending.toLowerCase()})`}
                    </span>
                    <span className="rounded-full bg-amber-soft px-3 py-1 text-amber-text">
                      {pt.kyc.status[row.kyc_status]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

