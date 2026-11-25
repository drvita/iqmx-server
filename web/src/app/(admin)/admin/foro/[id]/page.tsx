'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type ForumPost = {
  id: number;
  parent_post_id: number | null;
  body: string;
  author_user_id: number;
  author_name: string;
  author_is_bot: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
};

type ForumThreadDetail = {
  id: number;
  customer_id: number;
  company_name: string;
  title: string;
  body: string;
  status: string;
  period_label: string | null;
  due_at: string | null;
  author_user_id: number;
  author_name: string;
  author_is_bot: boolean;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
  posts: ForumPost[];
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'done', label: 'Terminado' },
  { value: 'archived', label: 'Archivado' },
];

export default function AdminForoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params?.id as string;

  const [thread, setThread] = useState<ForumThreadDetail | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Composer principal / respuesta
  const [replyTo, setReplyTo] = useState<ForumPost | null>(null);
  const [newPostBody, setNewPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Edición de mensaje propio
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');
  const [savingPostEdit, setSavingPostEdit] = useState(false);

  // Modal Editar Tema
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const editTitleId = useId();
  const [isEditThreadOpen, setIsEditThreadOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [savingThread, setSavingThread] = useState(false);

  // Modal Confirmar Eliminación (Tema o Mensaje)
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteTitleId = useId();
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'thread' } | { kind: 'post'; postId: number } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (isEditThreadOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isEditThreadOpen]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [deleteTarget]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const [threadRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/forum/threads/${threadId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setCurrentAdminId(me.id);
      }

      if (!threadRes.ok) {
        const data = await threadRes.json().catch(() => null);
        setErrorMsg(data?.detail || 'No se pudo cargar el tema.');
      } else {
        setThread(await threadRes.json());
      }
    } catch {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (threadId) fetchDetail();
  }, [threadId, fetchDetail]);

  const handleStatusChange = async (newStatus: string) => {
    if (!thread) return;
    setActionError(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/forum/threads/${thread.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setThread(await res.json());
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.detail || 'No se pudo actualizar el estado del tema.');
      }
    } catch {
      setActionError('Error de conexión al actualizar el estado.');
    }
  };

  const openEditThread = () => {
    if (!thread) return;
    setEditTitle(thread.title);
    setEditBody(thread.body);
    setEditPeriod(thread.period_label || '');
    setActionError(null);
    setIsEditThreadOpen(true);
  };

  const handleSaveThreadEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread) return;
    setSavingThread(true);
    setActionError(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/forum/threads/${thread.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim(),
          period_label: editPeriod.trim() || null,
        }),
      });
      if (res.ok) {
        setThread(await res.json());
        setIsEditThreadOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.detail || 'No se pudo actualizar el tema.');
      }
    } catch {
      setActionError('Error de conexión al guardar cambios.');
    } finally {
      setSavingThread(false);
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !newPostBody.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/forum/threads/${thread.id}/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: newPostBody.trim(),
          parent_post_id: replyTo ? replyTo.id : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPostError(data?.detail || 'No se pudo publicar el mensaje.');
      } else {
        setNewPostBody('');
        setReplyTo(null);
        fetchDetail();
      }
    } catch {
      setPostError('Error de conexión al publicar el mensaje.');
    } finally {
      setPosting(false);
    }
  };

  const handleSavePostEdit = async (postId: number) => {
    if (!editingPostBody.trim()) return;
    setSavingPostEdit(true);
    setActionError(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/forum/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: editingPostBody.trim() }),
      });
      if (res.ok) {
        setEditingPostId(null);
        setEditingPostBody('');
        fetchDetail();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.detail || 'No se pudo editar el mensaje.');
      }
    } catch {
      setActionError('Error de conexión al editar el mensaje.');
    } finally {
      setSavingPostEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !thread) return;
    setDeleting(true);
    setActionError(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      if (deleteTarget.kind === 'thread') {
        const res = await fetch(`${apiUrl}/api/admin/forum/threads/${thread.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setDeleteTarget(null);
          router.push('/admin/foro');
        } else {
          const data = await res.json().catch(() => null);
          setActionError(data?.detail || 'No se pudo eliminar el tema.');
        }
      } else {
        const res = await fetch(`${apiUrl}/api/admin/forum/posts/${deleteTarget.postId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setDeleteTarget(null);
          fetchDetail();
        } else {
          const data = await res.json().catch(() => null);
          setActionError(data?.detail || 'No se pudo borrar el mensaje.');
        }
      }
    } catch {
      setActionError('Error de conexión al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-gray-500">
        Cargando conversación…
      </div>
    );
  }

  if (errorMsg || !thread) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/foro"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          <span>Volver al Foro</span>
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMsg || 'Tema no encontrado.'}
        </div>
      </div>
    );
  }

  const rootPosts = thread.posts.filter((p) => p.parent_post_id === null);
  const repliesByParent = new Map<number, ForumPost[]>();
  for (const p of thread.posts) {
    if (p.parent_post_id !== null) {
      const existing = repliesByParent.get(p.parent_post_id) || [];
      existing.push(p);
      repliesByParent.set(p.parent_post_id, existing);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/admin/foro"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          <span>Volver al Foro</span>
        </Link>
      </div>

      {/* Cabecera del tema */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              {thread.company_name}
            </span>
            {thread.period_label && (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
                {thread.period_label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="thread-status-select" className="sr-only">
              Estado del tema
            </label>
            <select
              id="thread-status-select"
              value={thread.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={openEditThread}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => setDeleteTarget({ kind: 'thread' })}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {thread.title}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Creado por <strong className="text-gray-700">{thread.author_name}</strong> ·{' '}
            {formatDateTime(thread.created_at)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {thread.body}
        </div>
      </div>

      {/* Hilo de mensajes */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-900">
          Mensajes y aportes ({thread.posts.filter((p) => !p.deleted).length})
        </h2>

        {rootPosts.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-xs text-gray-500">
            Aún no hay mensajes en este tema. Publica la primera idea o espera la participación de un bot.
          </div>
        )}

        <div className="space-y-3">
          {rootPosts.map((post) => {
            const replies = repliesByParent.get(post.id) || [];
            const canEdit = !post.deleted && !post.author_is_bot && post.author_user_id === currentAdminId;

            return (
              <div key={post.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{post.author_name}</span>
                    {post.author_is_bot && (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                        <CpuChipIcon className="h-3 w-3" aria-hidden="true" />
                        Bot
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">{formatDateTime(post.created_at)}</span>
                  </div>

                  {!post.deleted && (
                    <div className="flex items-center gap-1.5">
                      {thread.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => setReplyTo(post)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                        >
                          <ArrowUturnLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Responder</span>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(post.id);
                            setEditingPostBody(post.body);
                          }}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: 'post', postId: post.id })}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>

                {editingPostId === post.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      maxLength={10000}
                      value={editingPostBody}
                      onChange={(e) => setEditingPostBody(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPostId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingPostEdit}
                        onClick={() => handleSavePostEdit(post.id)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={`text-sm whitespace-pre-wrap leading-relaxed ${
                      post.deleted ? 'italic text-gray-400' : 'text-gray-800'
                    }`}
                  >
                    {post.body}
                  </p>
                )}

                {/* Respuestas anidadas (1 nivel) */}
                {replies.length > 0 && (
                  <div className="mt-3 space-y-2.5 border-l-2 border-blue-100 pl-4">
                    {replies.map((reply) => {
                      const canEditReply =
                        !reply.deleted && !reply.author_is_bot && reply.author_user_id === currentAdminId;
                      return (
                        <div key={reply.id} className="rounded-lg bg-gray-50 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">{reply.author_name}</span>
                              {reply.author_is_bot && (
                                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                  <CpuChipIcon className="h-3 w-3" aria-hidden="true" />
                                  Bot
                                </span>
                              )}
                              <span className="text-[11px] text-gray-400">{formatDateTime(reply.created_at)}</span>
                            </div>

                            {!reply.deleted && (
                              <div className="flex items-center gap-1.5">
                                {canEditReply && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPostId(reply.id);
                                      setEditingPostBody(reply.body);
                                    }}
                                    className="rounded px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200 cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ kind: 'post', postId: reply.id })}
                                  className="rounded px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 cursor-pointer"
                                >
                                  Borrar
                                </button>
                              </div>
                            )}
                          </div>

                          {editingPostId === reply.id ? (
                            <div className="space-y-2">
                              <textarea
                                rows={2}
                                maxLength={10000}
                                value={editingPostBody}
                                onChange={(e) => setEditingPostBody(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPostId(null)}
                                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={savingPostEdit}
                                  onClick={() => handleSavePostEdit(reply.id)}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {reply.body}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compositor */}
      {thread.status === 'archived' ? (
        <div className="rounded-xl border border-gray-200 bg-gray-100 p-4 text-center text-xs text-gray-600">
          Este tema está archivado. Cambia su estado si deseas volver a publicar mensajes.
        </div>
      ) : (
        <form
          onSubmit={handlePublishPost}
          className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <label htmlFor="new-post-body" className="text-xs font-bold text-gray-900">
              {replyTo ? `Respondiendo a ${replyTo.author_name}` : 'Agregar mensaje'}
            </label>
            <span className="text-[11px] text-gray-400">{newPostBody.length} / 10,000</span>
          </div>

          {replyTo && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <span className="truncate">
                En respuesta a: <em>&ldquo;{replyTo.body}&rdquo;</em>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-semibold text-blue-700 hover:underline shrink-0 cursor-pointer"
              >
                Cancelar respuesta
              </button>
            </div>
          )}

          {postError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {postError}
            </div>
          )}

          <textarea
            id="new-post-body"
            rows={4}
            required
            maxLength={10000}
            value={newPostBody}
            onChange={(e) => setNewPostBody(e.target.value)}
            placeholder="Escribe una idea, comentario o conclusión…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !newPostBody.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {posting ? 'Publicando…' : 'Publicar mensaje'}
            </button>
          </div>
        </form>
      )}

      {/* Modal Editar Tema */}
      <dialog
        ref={editDialogRef}
        aria-labelledby={editTitleId}
        onClose={(e) => {
          e.currentTarget.returnValue = '';
          setIsEditThreadOpen(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h1 id={editTitleId} className="text-base font-bold text-gray-900">
            Editar tema
          </h1>
          <button
            type="button"
            onClick={() => setIsEditThreadOpen(false)}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSaveThreadEdit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-thread-title" className="block text-xs font-semibold text-gray-700">
              Título
            </label>
            <input
              id="edit-thread-title"
              type="text"
              required
              minLength={3}
              maxLength={200}
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="edit-thread-period" className="block text-xs font-semibold text-gray-700">
              Periodo (opcional)
            </label>
            <input
              id="edit-thread-period"
              type="text"
              maxLength={50}
              value={editPeriod}
              onChange={(e) => setEditPeriod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="edit-thread-body" className="block text-xs font-semibold text-gray-700">
              Descripción
            </label>
            <textarea
              id="edit-thread-body"
              rows={5}
              required
              maxLength={10000}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsEditThreadOpen(false)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingThread}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {savingThread ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Confirmar Eliminación */}
      <dialog
        ref={deleteDialogRef}
        aria-labelledby={deleteTitleId}
        onClose={(e) => {
          e.currentTarget.returnValue = '';
          setDeleteTarget(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl"
      >
        <h1 id={deleteTitleId} className="flex items-center gap-2 text-base font-bold text-gray-900">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
          <span>{deleteTarget?.kind === 'thread' ? 'Eliminar tema' : 'Borrar mensaje'}</span>
        </h1>
        <p className="mt-3 text-xs text-gray-600 leading-relaxed">
          {deleteTarget?.kind === 'thread'
            ? 'Este tema dejará de mostrarse en el foro y para los bots conectados.'
            : 'El mensaje dejará de estar visible en el historial del tema.'}
        </p>

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            autoFocus
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirmDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
