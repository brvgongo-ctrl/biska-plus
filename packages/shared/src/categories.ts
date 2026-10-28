/**
 * Categorias do MVP. A fonte de verdade em produção é a tabela `categories`
 * no Supabase (ver supabase/seed.sql); esta lista serve de fallback offline
 * e para tipar os slugs.
 */
export type CategorySlug =
  | 'pintor'
  | 'canalizador'
  | 'electricista'
  | 'empregada-domestica'
  | 'baba'
  | 'explicador'
  | 'motorista';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Trabalha dentro de casas ou com crianças: registo criminal obrigatório. */
  requiresCriminalRecord: boolean;
  /** Exige carta de condução válida. */
  requiresDriverLicense: boolean;
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'pintor', name: 'Pintor', requiresCriminalRecord: false, requiresDriverLicense: false },
  { slug: 'canalizador', name: 'Canalizador', requiresCriminalRecord: false, requiresDriverLicense: false },
  { slug: 'electricista', name: 'Electricista', requiresCriminalRecord: false, requiresDriverLicense: false },
  { slug: 'empregada-domestica', name: 'Empregada doméstica', requiresCriminalRecord: true, requiresDriverLicense: false },
  { slug: 'baba', name: 'Babá profissional', requiresCriminalRecord: true, requiresDriverLicense: false },
  { slug: 'explicador', name: 'Explicador', requiresCriminalRecord: true, requiresDriverLicense: false },
  { slug: 'motorista', name: 'Motorista', requiresCriminalRecord: true, requiresDriverLicense: true },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
