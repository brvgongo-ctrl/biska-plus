import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  KYC_ACCEPTED_MIME_TYPES,
  KYC_MAX_FILE_BYTES,
  kycStoragePath,
  pt,
  type KycDocument,
  type KycDocumentType,
} from '@biska/shared';
import { supabase } from './supabase';

const BUCKET = 'kyc-documents';

export type PickSource = 'camera' | 'library' | 'pdf';

interface PickedFile {
  uri: string;
  mimeType: string;
  size?: number;
}

/** Abre a câmara, a galeria ou o selector de PDF. Devolve null se o utilizador cancelar. */
export async function pickFile(source: PickSource, type: KycDocumentType): Promise<PickedFile | null> {
  if (source === 'pdf') {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size };
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    cameraType: type === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Sem permissão para usar a câmara.');
  }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize };
}

/**
 * Envia o ficheiro para a pasta do utilizador no bucket privado e regista o
 * documento. Se havia um anterior do mesmo tipo (pendente ou rejeitado), apaga-o.
 */
export async function uploadKycDocument(
  userId: string,
  type: KycDocumentType,
  file: PickedFile,
  previous?: KycDocument,
): Promise<void> {
  if (!supabase) throw new Error(pt.pro.uploadError);
  if (!(KYC_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.mimeType)) throw new Error(pt.pro.fileType);

  const body = await (await fetch(file.uri)).arrayBuffer();
  if ((file.size ?? body.byteLength) > KYC_MAX_FILE_BYTES) throw new Error(pt.pro.fileTooBig);

  const path = kycStoragePath(userId, type, file.mimeType);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: file.mimeType });
  if (uploadError) throw new Error(pt.pro.uploadError);

  const { error: insertError } = await supabase.from('kyc_documents').insert({ user_id: userId, type, storage_path: path });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(pt.pro.uploadError);
  }

  if (previous && previous.status !== 'accepted') await removeKycDocument(previous);
}

export async function removeKycDocument(doc: KycDocument): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('kyc_documents').delete().eq('id', doc.id).select('id');
  if (error || !data?.length) return false;
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  return true;
}
