"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CpuChipIcon,
  KeyIcon,
  PencilSquareIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import BotFormModal, { type BotItem, type CompanyOption } from "./BotFormModal";
import BotTokensModal from "./BotTokensModal";
import CopyButton from "./CopyButton";

type BotsSectionProps = {
  openCreateTrigger?: number;
};

export default function BotsSection({
  openCreateTrigger = 0,
}: BotsSectionProps) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotItem | null>(null);
  const [tokensBot, setTokensBot] = useState<BotItem | null>(null);

  const [mcpUrl, setMcpUrl] = useState("https://mwh.iqissmexico.com/mcp");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const configured = process.env.NEXT_PUBLIC_MCP_URL;
      if (configured) {
        setMcpUrl(configured);
      } else if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        setMcpUrl("http://localhost:8000/mcp");
      } else {
        setMcpUrl(`https://mwh.${window.location.hostname}/mcp`);
      }
    }
  }, []);

  useEffect(() => {
    if (openCreateTrigger > 0) {
      setEditingBot(null);
      setIsFormOpen(true);
    }
  }, [openCreateTrigger]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const [botsRes, compRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/bots`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/admin/forum/companies`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!botsRes.ok) {
        setErrorMsg("No se pudieron cargar los bots registrados.");
      } else {
        setBots(await botsRes.json());
      }

      if (compRes.ok) {
        setCompanies(await compRes.json());
      }
    } catch {
      setErrorMsg("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async (bot: BotItem) => {
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !bot.is_active }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      {/* Banner Servidor MCP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700 shrink-0">
            <ServerStackIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-blue-950">
              Dirección del servidor para bots (MCP)
            </p>
            <p className="text-xs text-blue-900">
              Los asistentes externos se autentican únicamente en esta dirección
              usando su token de acceso. No tienen acceso al panel
              administrativo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <code className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs text-blue-950">
            {mcpUrl}
          </code>
          <CopyButton
            value={mcpUrl}
            label="Copiar URL"
            copiedLabel="URL copiada"
            ariaLabel="Copiar dirección del servidor MCP"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Tabla / Tarjetas de Bots */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-700">
            Bots registrados ({bots.length})
          </p>
        </div>

        {/* Vista Escritorio */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Nombre y descripción</th>
                <th className="px-4 py-3">Empresa asignada</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Tokens activos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    Cargando bots…
                  </td>
                </tr>
              )}
              {!loading && bots.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No hay bots creados todavía. Crea el primero con el botón
                    Nuevo Bot.
                  </td>
                </tr>
              )}
              {!loading &&
                bots.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-gray-50/75 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 shrink-0 mt-0.5">
                          <CpuChipIcon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {b.name}
                          </div>
                          {b.description && (
                            <div className="text-[11px] text-gray-500 line-clamp-2">
                              {b.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {b.company_name ? (
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          {b.company_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                          Todas las empresas
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {b.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                          Pausado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                        {b.tokens_active}{" "}
                        {b.tokens_active === 1 ? "token" : "tokens"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTokensBot(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <KeyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Tokens</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBot(b);
                            setIsFormOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <PencilSquareIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {b.is_active ? (
                            <>
                              <PauseCircleIcon
                                className="h-3.5 w-3.5 text-amber-600"
                                aria-hidden="true"
                              />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <PlayCircleIcon
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-hidden="true"
                              />
                              <span>Reanudar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Vista Móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading && (
            <div className="p-6 text-center text-xs text-gray-400">
              Cargando bots…
            </div>
          )}
          {!loading && bots.length === 0 && (
            <div className="p-6 text-center text-xs text-gray-500">
              No hay bots creados todavía.
            </div>
          )}
          {!loading &&
            bots.map((b) => (
              <div key={b.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {b.name}
                    </div>
                    {b.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                      b.is_active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-100 text-gray-700"
                    }`}
                  >
                    {b.is_active ? "Activo" : "Pausado"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
                    {b.company_name || "Todas las empresas"}
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                    {b.tokens_active}{" "}
                    {b.tokens_active === 1 ? "token" : "tokens"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTokensBot(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                  >
                    <KeyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tokens de acceso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBot(b);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    <PencilSquareIcon
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    <span>{b.is_active ? "Pausar" : "Reanudar"}</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <BotFormModal
        isOpen={isFormOpen}
        editingBot={editingBot}
        companies={companies}
        onClose={() => setIsFormOpen(false)}
        onSaved={fetchData}
      />

      <BotTokensModal
        bot={tokensBot}
        onClose={() => setTokensBot(null)}
        onTokensChanged={fetchData}
      />
    </div>
  );
}
