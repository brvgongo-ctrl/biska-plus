import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

/** Cabeçalho das páginas interiores (cadastro, admin). */
export function SiteHeader() {
  return (
    <header className="bg-navy px-4 py-4 text-white sm:px-8">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/" aria-label="Biska+ página inicial">
          <Logo className="text-2xl" />
        </Link>
        <Suspense fallback={<div className="h-11 w-24" />}>
          <UserMenu />
        </Suspense>
      </nav>
    </header>
  );
}
