import type { CategorySlug } from './categories';
import { LUANDA_ZONES } from './locations';

/** Linha da vista public_professionals (só aprovados, só campos públicos). */
export interface PublicProfessional {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  category_slug: CategorySlug;
  bio: string | null;
  years_experience: number | null;
  daily_rate_kz: number | null;
  rating_avg: number | null;
  rating_count: number;
  zone_ids: number[];
  zone_names: string[];
  verified_at: string | null;
}

/** "Babá" → "baba"; para comparar sem acentos nem maiúsculas. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Palavras que as pessoas usam para cada categoria (sem acentos). */
const CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  pintor: ['pintor', 'pintura', 'pintar'],
  canalizador: ['canalizador', 'canalizacao', 'picheleiro', 'torneira', 'cano', 'esgoto', 'fuga de agua'],
  electricista: ['electricista', 'eletricista', 'electricidade', 'eletricidade', 'tomada', 'luz', 'curto-circuito'],
  'empregada-domestica': ['empregada', 'domestica', 'limpeza', 'limpar', 'arrumar', 'passar a ferro'],
  baba: ['baba', 'ama', 'cuidar de crianca', 'cuidar das criancas', 'bebe'],
  explicador: ['explicador', 'explicadora', 'explicacao', 'explicacoes', 'aulas', 'professor', 'trabalhos de casa'],
  motorista: ['motorista', 'condutor', 'boleia', 'levar', 'transporte'],
};

function containsWord(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z])${phrase.replace(/[-]/g, '\\-')}([^a-z]|$)`).test(text);
}

export interface ParsedSearch {
  category?: CategorySlug;
  zone?: string;
}

/**
 * Lê uma frase livre e tira a categoria e a zona, se lá estiverem.
 * "Canalizador amanhã no Kilamba, a torneira pinga" → { canalizador, Kilamba }.
 * (A leitura com IA chega no Sprint 5; isto é a versão por palavras-chave.)
 */
export function parseSearchQuery(query: string, zones: readonly string[] = LUANDA_ZONES): ParsedSearch {
  const text = normalizeText(query);
  const result: ParsedSearch = {};
  for (const [slug, words] of Object.entries(CATEGORY_KEYWORDS) as [CategorySlug, string[]][]) {
    if (words.some((w) => containsWord(text, w))) {
      result.category = slug;
      break;
    }
  }
  // As zonas com nomes mais compridos primeiro ("Morro Bento" antes de "Bento").
  const zone = [...zones].sort((a, b) => b.length - a.length).find((z) => containsWord(text, normalizeText(z)));
  if (zone) result.zone = zone;
  return result;
}

/** "4.5" → "4,5"; sem avaliações → null. */
export function formatRating(avg: number | null, count: number): string | null {
  if (!avg || count === 0) return null;
  return avg.toFixed(1).replace('.', ',');
}

/** Iniciais para o avatar quando não há fotografia: "Joaquim S." → "JS". */
export function initials(name: string | null): string {
  return (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
