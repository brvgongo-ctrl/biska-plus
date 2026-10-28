import Link from "next/link";
import { pt } from "@biska/shared";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Lê a sessão no pedido; deve ficar dentro de um <Suspense>. */
export async function UserMenu() {
  if (!isSupabaseConfigured) return <SignInLink />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return <SignInLink />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roles")
    .eq("id", userId)
    .maybeSingle();
  const firstName = profile?.full_name?.split(" ")[0];

  const roles = profile?.roles ?? [];

  return (
    <div className="flex items-center gap-3">
      {roles.includes("admin") && (
        <Link href="/admin" className="text-sm font-semibold underline-offset-4 hover:underline">
          {pt.home.adminArea}
        </Link>
      )}
      {roles.includes("professional") && (
        <Link href="/profissional" className="text-sm font-semibold underline-offset-4 hover:underline">
          {pt.home.proArea}
        </Link>
      )}
      <span className="hidden text-sm text-on-navy-muted sm:inline">
        {pt.home.hello}
        {firstName ? `, ${firstName}` : ""}
      </span>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          className="h-11 rounded-xl border border-navy-border bg-navy-2 px-4 text-sm font-semibold text-white"
        >
          {pt.auth.signOut}
        </button>
      </form>
    </div>
  );
}

function SignInLink() {
  return (
    <Link
      href="/entrar"
      className="flex h-11 items-center rounded-xl bg-amber px-4 text-sm font-bold text-navy"
    >
      Entrar
    </Link>
  );
}
