/**
 * Projecto Supabase da Biska+. A chave "publishable" é pública por natureza
 * (vai dentro do site e da app); quem protege os dados são as regras RLS.
 * Nunca pôr aqui a chave secreta nem a service_role.
 * Um .env.local pode sobrepor estes valores (ex.: outro projecto de testes).
 */
export const SUPABASE_URL = 'https://yndrslvoisbqimdnbttn.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mHmqqaID8eoLUb51b7ATDw_YiSFSx4b';
