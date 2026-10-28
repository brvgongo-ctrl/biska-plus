import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  getCategory,
  parseSearchQuery,
  pt,
  type CategorySlug,
  type PublicProfessional,
  type Zone,
} from "@biska/shared";
import { ProCard } from "@/components/pro-card";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Encontrar profissional · Biska+" };

type SearchParams = PageProps<"/pesquisa">["searchParams"];

export default function SearchPage({ searchParams }: PageProps<"/pesquisa">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{pt.search.title}</h1>
        <Suspense fallback={<p className="text-muted">A carregar…</p>}>
          <Results searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params.q).slice(0, 200);
  const supabase = await createClient();
  const { data: zoneRows } = await supabase.from("zones").select("*").order("name").overrideTypes<Zone[], { merge: false }>();
  const zones = zoneRows ?? [];

  // Os filtros escolhidos ganham ao que se percebeu da frase.
  const parsed = parseSearchQuery(q, zones.map((z) => z.name));
  const categorySlug = (getCategory(param(params.categoria))?.slug ?? parsed.category) as CategorySlug | undefined;
  const zoneName = zones.find((z) => z.name === param(params.zona))?.name ?? parsed.zone;
  const zone = zones.find((z) => z.name === zoneName);

  let query = supabase.from("public_professionals").select("*");
  if (categorySlug) query = query.eq("category_slug", categorySlug);
  if (zone) query = query.contains("zone_ids", [zone.id]);
  // Sem categoria nem zona na frase: procura as palavras na descrição.
  const freeText = q.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  if (!categorySlug && !zone && freeText) query = query.ilike("bio", `%${freeText}%`);

  const { data, error } = await query
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false })
    .order("verified_at", { ascending: false })
    .limit(60)
    .overrideTypes<PublicProfessional[], { merge: false }>();
  const pros = data ?? [];

  const understood = q && (parsed.category || parsed.zone);
  const field = "h-12 rounded-xl border border-line bg-white px-3 outline-none focus:border-navy";

  return (
    <div className="flex flex-col gap-6">
      <form action="/pesquisa" className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-[1fr_200px_180px_auto]">
        <label className="sr-only" htmlFor="q">
          {pt.search.title}
        </label>
        <input id="q" name="q" defaultValue={q} placeholder={pt.search.placeholder} className={field} />
        <label className="sr-only" htmlFor="categoria">
          {pt.search.category}
        </label>
        <select id="categoria" name="categoria" defaultValue={categorySlug ?? ""} className={field}>
          <option value="">{pt.search.allCategories}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="zona">
          {pt.search.zone}
        </label>
        <select id="zona" name="zona" defaultValue={zoneName ?? ""} className={field}>
          <option value="">{pt.search.allZones}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.name}>
              {z.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-12 rounded-xl bg-amber px-5 font-bold text-navy">
          {pt.search.submit}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{pt.search.results(pros.length)}</span>
        {understood && (
          <span className="text-muted">
            {pt.search.understood} {[parsed.category && getCategory(parsed.category)?.name, parsed.zone].filter(Boolean).join(" · ")}
          </span>
        )}
        {(q || categorySlug || zone) && (
          <Link href="/pesquisa" className="text-muted underline">
            {pt.search.clear}
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDECEA] p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      {pros.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">{pt.search.empty}</p>
          <p className="text-sm text-muted">{pt.search.emptyHint}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pros.map((pro) => (
            <li key={pro.id}>
              <ProCard pro={pro} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
