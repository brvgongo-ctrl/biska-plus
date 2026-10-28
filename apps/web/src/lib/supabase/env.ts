import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@biska/shared";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

/** Falso só se alguém apagar a configuração. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
