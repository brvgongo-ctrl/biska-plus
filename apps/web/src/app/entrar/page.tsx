import type { Metadata } from "next";
import Link from "next/link";
import { pt } from "@biska/shared";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Biska+" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-navy px-4 py-12 text-white">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href="/" aria-label="Biska+ página inicial">
            <Logo className="text-5xl" />
          </Link>
          <p className="text-xl font-semibold">{pt.tagline}</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs leading-relaxed text-on-navy-muted">{pt.auth.legal}</p>
      </div>
    </main>
  );
}
