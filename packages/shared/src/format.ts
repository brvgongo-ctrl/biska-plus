/**
 * Normaliza um número de telemóvel angolano para E.164 (+2449XXXXXXXX).
 * Aceita "923 456 789", "+244923456789", "00244 923456789".
 * Devolve null se não for um número móvel angolano válido.
 */
export function normalizeAngolanPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00244')) digits = digits.slice(5);
  else if (digits.startsWith('244')) digits = digits.slice(3);
  return /^9\d{8}$/.test(digits) ? `+244${digits}` : null;
}

/** Formata para leitura: "+244 923 456 789". */
export function formatAngolanPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^244/, '');
  return `+244 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Formata kwanzas sem casas decimais: 12000 → "12.000 Kz". */
export function formatKz(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped} Kz`;
}
