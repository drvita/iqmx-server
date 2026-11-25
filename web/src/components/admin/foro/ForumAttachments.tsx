'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  PaperClipIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type ForumAttachmentItem = {
  id: number;
  thread_id: number;
  post_id: number | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export const FORUM_ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.csv,.txt,.md';
export const FORUM_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const FORUM_MAX_ATTACHMENTS = 5;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

async function fetchAttachmentBlob(attachmentId: number, inline = false): Promise<Blob> {
  const token = localStorage.getItem('iqmx_admin_token');
  const query = inline ? '?inline=true' : '';
  const res = await fetch(
    `${getApiBase()}/api/admin/forum/attachments/${attachmentId}/download${query}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error('No se pudo obtener el archivo.');
  }
  return res.blob();
}

export async function uploadForumAttachments(
  threadId: number,
  files: File[],
  postId?: number
): Promise<void> {
  if (files.length === 0) return;
  const token = localStorage.getItem('iqmx_admin_token');
  const apiUrl = getApiBase();

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    if (postId !== undefined) {
      formData.append('post_id', String(postId));
    }

    const res = await fetch(`${apiUrl}/api/admin/forum/threads/${threadId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `No se pudo subir "${file.name}".`);
    }
  }
}

function ImagePreview({ attachment }: { attachment: ForumAttachmentItem }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    fetchAttachmentBlob(attachment.id, true)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment.id]);

  if (failed) {
    return (
      <div className="flex h-20 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-400">
        <PhotoIcon className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="h-20 w-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={attachment.filename}
      className="h-20 w-24 rounded-lg border border-gray-200 object-cover bg-white"
    />
  );
}

type ForumAttachmentListProps = {
  attachments: ForumAttachmentItem[];
  onDelete?: (attachmentId: number) => void;
  deletingId?: number | null;
};

export function ForumAttachmentList({
  attachments,
  onDelete,
  deletingId = null,
}: ForumAttachmentListProps) {
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const handleOpenOrDownload = async (att: ForumAttachmentItem, inline: boolean) => {
    setOpeningId(att.id);
    setActionError(null);
    try {
      const blob = await fetchAttachmentBlob(att.id, inline);
      const url = URL.createObjectURL(blob);
      if (inline) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al descargar el archivo.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      {actionError && (
        <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] text-red-700">
          {actionError}
        </div>
      )}
      <div className="flex flex-wrap gap-2.5">
        {attachments.map((att) => {
          const isImg = isImageMime(att.content_type);
          const canPreviewInline = isImg || att.content_type === 'application/pdf';
          const isBusy = openingId === att.id || deletingId === att.id;

          return (
            <div
              key={att.id}
              className="group flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50/80 p-2 max-w-xs"
            >
              {isImg ? (
                <button
                  type="button"
                  onClick={() => handleOpenOrDownload(att, true)}
                  disabled={isBusy}
                  title={`Ver ${att.filename}`}
                  className="shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                >
                  <ImagePreview attachment={att} />
                </button>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-600">
                  <DocumentTextIcon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-xs font-semibold text-gray-800" title={att.filename}>
                  {att.filename}
                </p>
                <p className="text-[11px] text-gray-500">{formatFileSize(att.size_bytes)}</p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {canPreviewInline && (
                    <button
                      type="button"
                      onClick={() => handleOpenOrDownload(att, true)}
                      disabled={isBusy}
                      className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {openingId === att.id ? 'Abriendo…' : 'Ver'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenOrDownload(att, false)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" aria-hidden="true" />
                    <span>Descargar</span>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(att.id)}
                      disabled={isBusy}
                      title="Eliminar adjunto"
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer"
                    >
                      <TrashIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AttachmentPickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  existingCount?: number;
  disabled?: boolean;
  label?: string;
};

export function AttachmentPicker({
  files,
  onChange,
  existingCount = 0,
  disabled = false,
  label = 'Adjuntar archivos',
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;

    const remaining = Math.max(0, FORUM_MAX_ATTACHMENTS - existingCount - files.length);
    if (remaining === 0) {
      setError(`Máximo ${FORUM_MAX_ATTACHMENTS} archivos por elemento.`);
      return;
    }

    const accepted: File[] = [];
    for (const file of selected) {
      if (file.size > FORUM_MAX_FILE_SIZE_BYTES) {
        setError(`"${file.name}" excede el máximo de 10 MB.`);
        continue;
      }
      if (accepted.length >= remaining) {
        setError(`Solo se permiten hasta ${FORUM_MAX_ATTACHMENTS} archivos.`);
        break;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FORUM_ACCEPTED_EXTENSIONS}
          onChange={handleFilesSelected}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || existingCount + files.length >= FORUM_MAX_ATTACHMENTS}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          <PaperClipIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
          <span>{label}</span>
        </button>
        <span className="text-[11px] text-gray-400">
          PNG, JPG, WebP, PDF, DOCX, XLSX, CSV, TXT, MD (máx. 10 MB, hasta 5)
        </span>
      </div>

      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, idx) => (
            <span
              key={`${file.name}-${file.size}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-800"
            >
              <span className="max-w-[180px] truncate">{file.name}</span>
              <span className="text-blue-600/80">({formatFileSize(file.size)})</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== idx))}
                aria-label={`Quitar ${file.name}`}
                className="rounded-full p-0.5 text-blue-700 hover:bg-blue-100 cursor-pointer"
              >
                <XMarkIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
