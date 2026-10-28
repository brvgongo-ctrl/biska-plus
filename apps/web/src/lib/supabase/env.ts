export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Falso até as chaves do Supabase estarem em .env.local. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
