"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KYC_ACCEPTED_MIME_TYPES,
  KYC_DOCUMENT_ORDER,
  KYC_MAX_FILE_BYTES,
  kycStoragePath,
  pt,
  type KycDocument,
  type KycDocumentType,
} from "@biska/shared";
import { createClient } from "@/lib/supabase/client";

const OPTIONAL: readonly KycDocumentType[] = ["residence_certificate", "certificate"];
const BUCKET = "kyc-documents";

const statusStyle = {
  pending: "bg-amber-soft text-amber-text",
  accepted: "bg-ok-soft text-ok-text",
  rejected: "bg-[#FDECEA] text-danger",
} as const;

/**
 * Envio dos documentos directamente para o Storage (bucket privado), na
 * pasta do próprio utilizador; depois regista o documento na tabela.
 */
export function Documents({
  userId,
  documents,
  required,
  editable,
}: {
  userId: string;
  documents: KycDocument[];
  required: KycDocumentType[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<KycDocumentType | null>(null);
  const [errors, setErrors] = useState<Partial<Record<KycDocumentType, string>>>({});

  const types = KYC_DOCUMENT_ORDER.filter((t) => required.includes(t) || OPTIONAL.includes(t));
  // O mais recente de cada tipo.
  const latest = new Map<KycDocumentType, KycDocument>();
  for (const d of [...documents].sort((a, b) => a.created_at.localeCompare(b.created_at))) latest.set(d.type, d);

  function setError(type: KycDocumentType, message?: string) {
    setErrors((prev) => ({ ...prev, [type]: message }));
  }

  async function removeDocument(doc: KycDocument) {
    const supabase = createClient();
    const { data, error } = await supabase.from("kyc_documents").delete().eq("id", doc.id).select("id");
    if (error || !data?.length) return false;
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    return true;
  }

  async function upload(type: KycDocumentType, file: File) {
    if (!(KYC_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return setError(type, pt.pro.fileType);
    if (file.size > KYC_MAX_FILE_BYTES) return setError(type, pt.pro.fileTooBig);

    setError(type);
    setBusyType(type);
    const supabase = createClient();
    const path = kycStoragePath(userId, type, file.type);
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase
        .from("kyc_documents")
        .insert({ user_id: userId, type, storage_path: path });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
      const previous = latest.get(type);
      if (previous && previous.status !== "accepted") await removeDocument(previous);
      router.refresh();
    } catch {
      setError(type, pt.pro.uploadError);
    } finally {
      setBusyType(null);
    }
  }

  async function remove(type: KycDocumentType, doc: KycDocument) {
    setBusyType(type);
    const ok = await removeDocument(doc);
    setBusyType(null);
    if (!ok) return setError(type, pt.pro.error);
    router.refresh();
  }

  return (
    <ul className="flex flex-col gap-3">
      {types.map((type) => {
        const doc = latest.get(type);
        const text = pt.kyc.documents[type];
        const isRequired = required.includes(type);
        const canChange = editable && doc?.status !== "accepted";
        const busy = busyType === type;
        const inputId = `doc-${type}`;

        return (
          <li key={type} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  {text.label}{" "}
                  <span className="text-xs font-normal text-muted">
                    · {isRequired ? pt.pro.required : pt.pro.optional}
                  </span>
                </span>
                <span className="text-sm text-muted">{text.hint}</span>
              </div>
              {doc && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[doc.status]}`}>
                  {pt.kyc.documentStatus[doc.status]}
                </span>
              )}
            </div>

            {doc?.status === "rejected" && doc.reviewer_note && (
              <p className="rounded-xl bg-[#FDECEA] p-3 text-sm text-danger">{doc.reviewer_note}</p>
            )}

            {canChange && (
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={inputId}
                  className={`flex h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-bold ${
                    doc ? "border border-line text-navy" : "bg-amber text-navy"
                  } ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  {busy ? pt.pro.uploading : doc ? pt.pro.replace : pt.pro.upload}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept={KYC_ACCEPTED_MIME_TYPES.join(",")}
                  capture={type === "selfie" ? "user" : undefined}
                  disabled={busy}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) upload(type, file);
                  }}
                />
                {doc && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(type, doc)}
                    className="h-11 px-3 text-sm text-muted underline disabled:opacity-60"
                  >
                    {pt.pro.remove}
                  </button>
                )}
              </div>
            )}

            {errors[type] && (
              <p role="alert" className="text-sm text-danger">
                {errors[type]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
