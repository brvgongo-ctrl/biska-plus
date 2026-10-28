/**
 * Zonas de Luanda usadas para filtros e áreas de atendimento no lançamento.
 * Lista editável: a tabela `zones` no Supabase é a fonte de verdade.
 */
export const LUANDA_ZONES = [
  'Alvalade',
  'Benfica',
  'Cacuaco',
  'Camama',
  'Cazenga',
  'Golfe',
  'Ingombota',
  'Kilamba',
  'Maianga',
  'Maculusso',
  'Morro Bento',
  'Nova Vida',
  'Patriota',
  'Prenda',
  'Rangel',
  'Samba',
  'Sambizanga',
  'Talatona',
  'Viana',
  'Zango',
] as const;

export type LuandaZone = (typeof LUANDA_ZONES)[number];
