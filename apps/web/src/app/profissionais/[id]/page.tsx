import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatKz, formatRating, getCategory, pt, type PublicProfessional } from "@biska/shared";
import { Avatar } from "@/components/avatar";
import { SiteHeader } from "@/components/site-header";
import { VerifiedBadge } from "@/components/verified-badge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profissional verificado · Biska+" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicProfilePage({ params }: PageProps<"/profissionais/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <Link href="/pesquisa" className="text-sm font-semibold text-muted underline">
          ← {pt.profile.back}
        </Link>
        <Suspense fallback={<p className="text-muted">A carregar…</p>}>
          <Profile params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Profile({ params }: { params: PageProps<"/profissionais/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // A vista só devolve profissionais aprovados: suspensos ou em análise dão 404.
  const supabase = await createClient();
  const { data: pro } = await supabase
    .from("public_professionals")
    .select("*")
    .eq("id", id)
    .maybeSingle<PublicProfessional>();
  if (!pro) notFound();

  const category = getCategory(pro.category_slug);
  const rating = formatRating(pro.rating_avg, pro.rating_count);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-3xl bg-navy p-6 text-white sm:flex-row sm:items-center">
        <Avatar name={pro.display_name} url={pro.avatar_url} size={88} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{pro.display_name}</h1>
          <p className="text-on-navy-muted">
            {category?.name}
            {pro.years_experience ? ` · ${pt.search.yearsExperience(pro.years_experience)}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <VerifiedBadge />
            <span className="text-sm text-on-navy-muted">
              {rating ? `★ ${rating} · ${pt.search.reviews(pro.rating_count)}` : pt.search.new}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm text-muted">{pt.profile.price}</h2>
          <p className="text-lg font-bold">
            {pro.daily_rate_kz ? (
              <>
                {pt.search.from} {formatKz(pro.daily_rate_kz)}
                <span className="text-sm font-normal text-muted">{pt.search.perDay}</span>
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm text-muted">{pt.profile.zones}</h2>
          <ul className="flex flex-wrap gap-2">
            {pro.zone_names.map((z) => (
              <li key={z}>
                <Link
                  href={`/pesquisa?categoria=${pro.category_slug}&zona=${encodeURIComponent(z)}`}
                  className="flex min-h-9 items-center rounded-full bg-ground px-3 text-sm font-semibold"
                >
                  {z}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {pro.bio && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <h2 className="text-lg font-bold">{pt.profile.about}</h2>
          <p className="whitespace-pre-line text-muted">{pro.bio}</p>
        </section>
      )}

      {pro.verified_at && (
        <p className="text-sm text-muted">
          {pt.profile.verifiedSince}{" "}
          {new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(
            new Date(pro.verified_at),
          )}
          .
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="h-13 rounded-2xl bg-amber px-6 font-bold text-navy disabled:opacity-60"
        >
          {pt.profile.request}
        </button>
        <p className="text-center text-sm text-muted">{pt.profile.requestSoon}</p>
      </div>

      <Link href={`/pesquisa?categoria=${pro.category_slug}`} className="text-center font-semibold underline">
        {pt.profile.more}: {category?.name}
      </Link>
    </article>
  );
}
