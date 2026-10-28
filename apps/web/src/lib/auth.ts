import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Utilizador com sessão; senão manda para /entrar e volta a `next` depois. */
export async function requireUser(next: string) {
  if (!isSupabaseConfigured) redirect("/entrar");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

/**
 * Só administradores. Para os outros a página "não existe" (404), para não
 * revelar o painel. A base de dados volta a verificar em cada função (RLS).
 */
export async function requireAdmin(next: string) {
  const { supabase, userId } = await requireUser(next);
  const { data: profile } = await supabase.from("profiles").select("roles").eq("id", userId).maybeSingle();
  if (!profile?.roles?.includes("admin")) notFound();
  return { supabase, userId };
}
