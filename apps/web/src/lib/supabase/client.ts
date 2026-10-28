import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/** Cliente Supabase para Client Components. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
