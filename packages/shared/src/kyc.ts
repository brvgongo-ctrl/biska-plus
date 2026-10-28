import { getCategory, type Category } from './categories';
import { pt } from './i18n/pt';
import type { KycDocumentType, KycStatus } from './types';

/** Igual ao bucket "kyc-documents" (supabase/migrations). */
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const KYC_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Ordem em que os documentos aparecem no cadastro. */
export const KYC_DOCUMENT_ORDER: readonly KycDocumentType[] = [
  'id_front',
  'id_back',
  'selfie',
  'criminal_record',
  'driver_license',
  'residence_certificate',
  'certificate',
];

/**
 * Documentos obrigatórios para submeter (espelha required_kyc_documents()
 * na base de dados, que é quem decide de facto).
 */
export function requiredDocuments(category: Category | undefined): KycDocumentType[] {
  const docs: KycDocumentType[] = ['id_front', 'id_back', 'selfie'];
  if (category?.requiresCriminalRecord) docs.push('criminal_record');
  if (category?.requiresDriverLicense) docs.push('driver_license');
  return docs;
}

/** O profissional só altera dados e documentos nestes estados. */
export function canEditKyc(status: KycStatus | null | undefined): boolean {
  return !status || status === 'draft' || status === 'needs_fix';
}

/** Caminho no bucket: "<user_id>/<tipo>-<timestamp>.<ext>" (a RLS exige a pasta do próprio). */
export function kycStoragePath(userId: string, type: KycDocumentType, mimeType: string): string {
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  return `${userId}/${type}-${Date.now()}.${ext}`;
}

export interface ProfessionalInput {
  fullName: string;
  categorySlug: string;
  yearsExperience: number | null;
  dailyRateKz: number | null;
  bio: string;
  zoneIds: number[];
}

/** Valida os dados do cadastro; devolve a mensagem de erro ou null. A BD volta a validar. */
export function validateProfessionalInput(input: ProfessionalInput): string | null {
  const name = input.fullName.trim();
  if (name.length < 3 || name.length > 120) return 'Escreve o teu nome completo.';
  if (!getCategory(input.categorySlug)) return 'Escolhe uma categoria.';
  const years = input.yearsExperience;
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) return 'Anos de experiência inválidos.';
  const rate = input.dailyRateKz;
  if (rate !== null && (!Number.isSafeInteger(rate) || rate <= 0)) return 'Preço por dia inválido.';
  if (input.bio.trim().length > 1200) return 'O texto sobre ti tem de ter no máximo 1200 caracteres.';
  if (input.zoneIds.length === 0) return 'Escolhe pelo menos uma zona.';
  return null;
}

/** "923 456" → 923456; vazio → null; texto inválido → NaN (a validação apanha). */
export function parseOptionalInt(text: string): number | null {
  const clean = text.replace(/[\s.]/g, '');
  if (!clean) return null;
  return /^\d+$/.test(clean) ? Number(clean) : NaN;
}

/** Argumentos da função save_professional_profile() no Supabase. */
export function toSaveArgs(input: ProfessionalInput) {
  return {
    name: input.fullName.trim(),
    category: input.categorySlug,
    years: input.yearsExperience,
    daily_rate: input.dailyRateKz,
    about: input.bio.trim(),
    zones: input.zoneIds,
  };
}

/** "Documentos em falta: id_front, selfie" → "Documentos em falta: BI – frente, Selfie com o BI". */
export function describeKycError(message: string): string {
  if (!message) return pt.pro.error;
  return message.replace(/\b[a-z]+(?:_[a-z]+)+\b|\bselfie\b/g, (code) =>
    code in pt.kyc.documents ? pt.kyc.documents[code as KycDocumentType].label : code,
  );
}
