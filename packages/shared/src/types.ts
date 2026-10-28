/**
 * Tipos das tabelas principais (espelham supabase/migrations).
 * Quando o projecto Supabase existir, estes tipos passam a ser gerados com
 * `supabase gen types typescript`.
 */
export type UserRole = 'client' | 'professional' | 'admin';

export type KycStatus = 'draft' | 'submitted' | 'in_review' | 'needs_fix' | 'approved' | 'rejected';

export type KycDocumentType =
  | 'id_front'
  | 'id_back'
  | 'selfie'
  | 'criminal_record'
  | 'residence_certificate'
  | 'driver_license'
  | 'certificate';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  avatar_url: string | null;
  roles: UserRole[];
  locale: string;
  created_at: string;
}

export interface ProfessionalProfile {
  user_id: string;
  category_slug: string;
  bio: string | null;
  years_experience: number | null;
  daily_rate_kz: number | null;
  kyc_status: KycStatus;
  is_public: boolean;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
}

export interface KycDocument {
  id: string;
  user_id: string;
  type: KycDocumentType;
  storage_path: string;
  issued_at: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  reviewer_note: string | null;
  created_at: string;
}
