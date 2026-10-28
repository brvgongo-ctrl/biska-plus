import { Suspense } from "react";
import Link from "next/link";
import { CATEGORIES, pt } from "@biska/shared";
import { CategoryIcon } from "@/components/category-icon";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

export default function Home() {
  return (
    <>
      <header className="rounded-b-[28px] bg-navy px-4 pb-8 pt-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <nav className="flex items-center justify-between gap-4">
            <Logo className="text-2xl" />
            <Suspense fallback={<div className="h-11 w-24" />}>
              <UserMenu />
            </Suspense>
          </nav>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold sm:text-4xl">{pt.home.whoDoYouNeed}</h1>
            <p className="max-w-xl text-on-navy-muted">{pt.intro}</p>
          </div>

          <form action="/entrar" className="flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 pl-4">
            <label htmlFor="pedido" className="sr-only">
              {pt.home.searchPlaceholder}
            </label>
            <input
              id="pedido"
              name="q"
              placeholder={pt.home.searchPlaceholder}
              className="h-11 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            />
            <button type="submit" className="h-11 rounded-xl bg-amber px-5 font-bold text-navy">
              Pedir
            </button>
          </form>
          <p className="text-xs text-on-navy-muted">
            Ex.: “Canalizador amanhã no Kilamba, a torneira da cozinha está a pingar”
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-8 sm:px-8">
        <section aria-labelledby="categorias" className="flex flex-col gap-4">
          <h2 id="categorias" className="text-lg font-bold">
            {pt.home.categories}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/entrar?categoria=${c.slug}`}
                  className="flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold"
                >
                  <CategoryIcon slug={c.slug} />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col items-start gap-3 rounded-3xl bg-navy p-6 text-white">
          <h2 className="text-lg font-bold">{pt.home.becomePro}</h2>
          <p className="max-w-xl text-on-navy-muted">{pt.home.becomeProText}</p>
          <Link href="/profissional" className="rounded-xl bg-amber px-5 py-3 font-bold text-navy">
            {pt.home.becomeProCta}
          </Link>
        </section>
      </main>

      <footer className="border-t border-line bg-white px-4 py-6 text-center text-xs text-muted sm:px-8">
        © Biska+ · Dados pessoais tratados nos termos da Lei n.º 22/11.
      </footer>
    </>
  );
}
