'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type CompanyOption = {
  id: number;
  company_name: string;
};

type ThreadSummary = {
  id: number;
  customer_id: number;
  company_name: string;
  title: string;
  status: string;
  period_label: string | null;
  due_at: string | null;
  author_name: string;
  author_is_bot: boolean;
  posts_count: number;
  last_post_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  open: {
    label: 'Abierto',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  in_progress: {
    label: 'En curso',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  done: {
    label: 'Terminado',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  archived: {
    label: 'Archivado',
    badgeClass: 'border-gray-200 bg-gray-100 text-gray-700',
  },
};

export default function AdminForoPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Nuevo Tema (<dialog>)
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogTitleId = useId();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPeriod, setFormPeriod] = useState('');
  const [formDueAt, setFormDueAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isCreateOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isCreateOpen]);

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/forum/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCompanies(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const params = new URLSearchParams();
      if (companyFilter) params.set('customer_id', companyFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      params.set('page', String(page));
      params.set('page_size', String(pageSize));

      const res = await fetch(`${apiUrl}/api/admin/forum/threads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.detail || 'No se pudieron cargar los temas del foro.');
      } else {
        const data = await res.json();
        setThreads(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [companyFilter, statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const openCreateModal = () => {
    setFormCustomerId(companyFilter || (companies[0]?.id ? String(companies[0].id) : ''));
    setFormTitle('');
    setFormBody('');
    setFormPeriod('');
    setFormDueAt('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      setCreateError('Selecciona una empresa.');
      return;
    }
    setCreating(true);
    setCreateError(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const payload = {
        customer_id: Number(formCustomerId),
        title: formTitle.trim(),
        body: formBody.trim(),
        period_label: formPeriod.trim() || null,
        due_at: formDueAt ? new Date(`${formDueAt}T23:59:59`).toISOString() : null,
      };
      const res = await fetch(`${apiUrl}/api/admin/forum/threads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateError(data?.detail || 'No se pudo crear el tema.');
      } else {
        setIsCreateOpen(false);
        setPage(1);
        fetchThreads();
      }
    } catch {
      setCreateError('Error de conexión al crear el tema.');
    } finally {
      setCreating(false);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'Sin actividad';
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Foro Colaborativo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Espacio de trabajo para requerimientos, ideas y campañas por empresa entre administradores y asistentes.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          <span>Nuevo tema</span>
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="filter-company" className="block text-[11px] font-semibold text-gray-500 mb-1">
              Empresa
            </label>
            <select
              id="filter-company"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="block text-[11px] font-semibold text-gray-500 mb-1">
              Estado
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Todos los estados</option>
              <option value="open">Abierto</option>
              <option value="in_progress">En curso</option>
              <option value="done">Terminado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="filter-search" className="block text-[11px] font-semibold text-gray-500 mb-1">
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="filter-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por título o contenido…"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Listado de temas */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs divide-y divide-gray-100 overflow-hidden">
        {loading && (
          <div className="p-10 text-center text-xs text-gray-400">
            Cargando temas del foro…
          </div>
        )}

        {!loading && threads.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <ChatBubbleLeftRightIcon className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">No hay temas para mostrar</p>
            <p className="text-xs text-gray-500">
              Ajusta los filtros o crea un nuevo tema para empezar a colaborar con tu equipo y bots.
            </p>
          </div>
        )}

        {!loading &&
          threads.map((t) => {
            const st = STATUS_LABELS[t.status] || {
              label: t.status,
              badgeClass: 'border-gray-200 bg-gray-100 text-gray-700',
            };
            return (
              <Link
                key={t.id}
                href={`/admin/foro/${t.id}`}
                className="block p-4 sm:p-5 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {t.company_name}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.badgeClass}`}
                      >
                        {st.label}
                      </span>
                      {t.period_label && (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                          {t.period_label}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                      {t.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-medium text-gray-700">{t.author_name}</span>
                      {t.author_is_bot && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                          <CpuChipIcon className="h-3 w-3" aria-hidden="true" />
                          Bot
                        </span>
                      )}
                      <span>·</span>
                      <span>
                        {t.posts_count} {t.posts_count === 1 ? 'mensaje' : 'mensajes'}
                      </span>
                      <span>·</span>
                      <span>Última actividad: {formatDateTime(t.last_post_at || t.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
      </div>

      {/* Paginación */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Página {page} de {totalPages} ({total} temas)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal Nuevo Tema */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={(e) => {
          e.currentTarget.returnValue = '';
          setIsCreateOpen(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h1 id={dialogTitleId} className="text-base font-bold text-gray-900">
            Nuevo tema en el foro
          </h1>
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {createError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateThread} className="mt-4 space-y-4">
          <div>
            <label htmlFor="thread-company" className="block text-xs font-semibold text-gray-700">
              Empresa
            </label>
            <select
              id="thread-company"
              required
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="" disabled>
                Selecciona una empresa…
              </option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="thread-title" className="block text-xs font-semibold text-gray-700">
              Título
            </label>
            <input
              id="thread-title"
              type="text"
              required
              minLength={3}
              maxLength={200}
              autoFocus
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ej. Campaña semana 48 — Promoción temporada"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="thread-period" className="block text-xs font-semibold text-gray-700">
                Periodo (opcional)
              </label>
              <input
                id="thread-period"
                type="text"
                maxLength={50}
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value)}
                placeholder="Ej. Semana 48 2026"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="thread-due" className="block text-xs font-semibold text-gray-700">
                Fecha límite (opcional)
              </label>
              <input
                id="thread-due"
                type="date"
                value={formDueAt}
                onChange={(e) => setFormDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="thread-body" className="block text-xs font-semibold text-gray-700">
                Descripción o requerimiento
              </label>
              <span className="text-[11px] text-gray-400">{formBody.length} / 10,000</span>
            </div>
            <textarea
              id="thread-body"
              rows={5}
              required
              maxLength={10000}
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Explica el objetivo, contexto o lo que necesitas que proponga el equipo y los bots…"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Publicando…' : 'Crear tema'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
