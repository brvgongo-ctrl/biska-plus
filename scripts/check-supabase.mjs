// Verifica a ligação ao projecto Supabase e se as migrações estão aplicadas.
// Uso: pnpm check:supabase   (lê apps/web/.env.local)
// Só usa a chave pública (publishable/anon): não altera nada.
import { readFileSync } from "node:fs";

function readEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnv("apps/web/.env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("✗ Falta NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em apps/web/.env.local");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`✓ ${name}${detail ? ` · ${detail}` : ""}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name} · ${e.message}`);
  }
}

async function get(path) {
  const res = await fetch(`${url}${path}`, { headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${body?.message ?? body?.msg ?? ""}`.trim());
  return body;
}

// Uma função existe se o anónimo recebe "permission denied" (e não "não encontrada").
async function rpcExists(fn, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  const body = await res.json().catch(() => null);
  if (body?.code === "PGRST202") throw new Error("função não existe: falta correr a migração");
  if (body?.code === "42501") return "existe (bloqueada a anónimos)";
  if (body?.code === "P0001") return "existe";
  throw new Error(`resposta inesperada ${res.status} ${body?.message ?? ""}`);
}

console.log(`Supabase: ${url}\n`);
await check("Ligação e autenticação", async () => {
  await get("/auth/v1/health");
  const settings = await get("/auth/v1/settings");
  const on = Object.entries(settings.external ?? {})
    .filter(([p, v]) => v && ["google", "apple", "facebook", "phone"].includes(p))
    .map(([p]) => p);
  return `fornecedores activos: ${on.join(", ") || "nenhum"}`;
});
if (failed) {
  console.log("\nSem ligação: confirma o URL e a chave pública (Project Settings → API).");
  process.exit(1);
}
await check("Sprint 1 · categorias (seed)", async () => `${(await get("/rest/v1/categories?select=slug")).length} de 7`);
await check("Sprint 1 · zonas de Luanda (seed)", async () => `${(await get("/rest/v1/zones?select=id")).length} de 20`);
await check("Sprint 1 · vista pública", async () => `${(await get("/rest/v1/public_professionals?select=id")).length} aprovados`);
await check("Sprint 1 · submit_kyc()", () => rpcExists("submit_kyc", {}));
await check("Sprint 2 · save_professional_profile()", () =>
  rpcExists("save_professional_profile", { name: "", category: "", years: null, daily_rate: null, about: "", zones: [] }),
);
await check("Sprint 2 · review_kyc_document()", () =>
  rpcExists("review_kyc_document", { document_id: "00000000-0000-0000-0000-000000000000", decision: "accepted", note: null }),
);
await check("Sprint 2 · log_kyc_view()", () => rpcExists("log_kyc_view", { professional_id: "00000000-0000-0000-0000-000000000000" }));

console.log(failed ? `\n${failed} verificação(ões) falharam.` : "\nTudo pronto.");
process.exit(failed ? 1 : 0);
