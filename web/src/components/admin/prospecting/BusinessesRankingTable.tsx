'use client';

import React from 'react';
import {
  BuildingOffice2Icon,
  PhoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { ProspectingBusinessItem } from './types';

interface BusinessesRankingTableProps {
  businesses: ProspectingBusinessItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onSelectBusiness: (business: ProspectingBusinessItem) => void;
  loading: boolean;
  viewMode: string;
  onViewModeChange: (val: string) => void;
  municipalityFilter: string;
  onMunicipalityFilterChange: (val: string) => void;
  channelFilter: string;
  onChannelFilterChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
}

export const BusinessesRankingTable: React.FC<BusinessesRankingTableProps> = ({
  businesses,
  total,
  page,
  pageSize,
  onPageChange,
  onSelectBusiness,
  loading,
  viewMode,
  onViewModeChange,
  municipalityFilter,
  onMunicipalityFilterChange,
  channelFilter,
  onChannelFilterChange,
  searchQuery,
  onSearchQueryChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
      {/* Pestañas de Vista Rápida */}
      <div className="border-b border-gray-200 bg-gray-50/80 px-4 pt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('qualified')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'qualified'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-gray-200'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SparklesIcon className="h-4 w-4 text-emerald-600" />
            <span>🎯 Calificados con Oportunidades</span>
          </button>

          <button
            onClick={() => onViewModeChange('all')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              viewMode === 'all'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-gray-200 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>Ver Todos</span>
          </button>

          <button
            onClick={() => onViewModeChange('disqualified')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              viewMode === 'disqualified'
                ? 'border-red-600 text-red-700 bg-white rounded-t-lg border-t border-x border-gray-200 font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>Descartados / Sin Contacto</span>
          </button>
        </div>

        <div className="text-[11px] text-gray-500 pb-2">
          Ordenados por <strong>Total Score (DENUE + Digital)</strong>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-3.5 border-b border-gray-200 bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre, colonia, teléfono..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full max-w-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />

          <select
            value={channelFilter}
            onChange={(e) => onChannelFilterChange(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="todos">Todos los canales</option>
            <option value="whatsapp">Canal: WhatsApp</option>
            <option value="email">Canal: Correo</option>
            <option value="physical_visit">Canal: Visita Física</option>
          </select>

          <select
            value={municipalityFilter}
            onChange={(e) => onMunicipalityFilterChange(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="todos">Todos los municipios</option>
            <option value="Colima">Colima</option>
            <option value="Villa de Álvarez">Villa de Álvarez</option>
            <option value="Manzanillo">Manzanillo</option>
            <option value="Tecomán">Tecomán</option>
            <option value="Armería">Armería</option>
            <option value="Comala">Comala</option>
            <option value="Coquimatlán">Coquimatlán</option>
            <option value="Cuauhtémoc">Cuauhtémoc</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 self-center">
          Mostrando <strong>{businesses.length}</strong> registros
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[850px]">
          <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <tr>
              <th className="px-5 py-3.5">Score Total</th>
              <th className="px-5 py-3.5">Establecimiento y Domicilio</th>
              <th className="px-4 py-3.5">Canal de Contacto</th>
              <th className="px-4 py-3.5">Oportunidades Comerciales</th>
              <th className="px-4 py-3.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && businesses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span>Cargando prospectos…</span>
                  </div>
                </td>
              </tr>
            ) : businesses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  {viewMode === 'qualified' ? (
                    <div>
                      <p className="font-semibold text-gray-700">Aún no hay negocios evaluados en esta vista.</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Los prospectos evaluados por el sistema aparecerán aquí automáticamente para iniciar contacto.
                      </p>
                    </div>
                  ) : (
                    'No se encontraron negocios con los filtros actuales.'
                  )}
                </td>
              </tr>
            ) : (
              businesses.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                  {/* Score Bimodal Computado */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-xs font-bold border ${
                            b.total_score >= 70
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : b.total_score >= 40
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {b.total_score}
                          <span className="text-[10px] font-normal text-gray-400">/100</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        DENUE: <strong>{b.denue_score}</strong> | Digital: <strong>{b.digital_score}</strong>
                      </div>
                    </div>
                  </td>

                  {/* Establecimiento y Ubicación Limpia */}
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/70 mt-0.5">
                        <BuildingOffice2Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <p className="font-semibold text-gray-900 text-xs truncate" title={b.name}>
                          {b.name}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate" title={b.scian_activity || ''}>
                          {b.scian_activity || 'Servicios locales'}
                        </p>
                        {/* Domicilio Real Limpio */}
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPinIcon className="h-3 w-3 text-gray-400 shrink-0" />
                          <span>
                            {b.municipality && b.municipality.toLowerCase() !== 'todo el estado' ? `${b.municipality}, Col.` : 'Colima, Col.'}
                            {b.stratum ? ` • ${b.stratum}` : ''}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Canales de Contacto Detectados */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {b.phone ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                          <span>WhatsApp Disponible</span>
                        </span>
                        <p className="text-xs text-gray-700 font-mono mt-1 flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>{b.phone}</span>
                        </p>
                      </div>
                    ) : b.email ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                          <EnvelopeIcon className="h-3.5 w-3.5" />
                          <span>Correo Disponible</span>
                        </span>
                        <p className="text-[11px] text-gray-600 truncate max-w-[150px] mt-1 font-mono">
                          {b.email}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        <span>Visita Física (Campo)</span>
                      </span>
                    )}
                  </td>

                  {/* Oportunidades Identificadas */}
                  <td className="px-4 py-4">
                    {b.status === 'qualified' && b.llm_analysis ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {b.llm_analysis.opportunities?.website_development?.applicable && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            <span>Web / Landing</span>
                          </span>
                        )}
                        {b.llm_analysis.opportunities?.crm_whatsapp?.applicable && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <span>CRM WhatsApp</span>
                          </span>
                        )}
                        {b.llm_analysis.opportunities?.automated_booking?.applicable && (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                            <span>Agenda Citas</span>
                          </span>
                        )}
                      </div>
                    ) : b.status === 'disqualified' ? (
                      <span className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-medium">
                        {b.disqualification_reason || 'Descartado'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">
                        En espera de evaluación
                      </span>
                    )}
                  </td>

                  {/* Botón Ver Ficha / Análisis Comercial */}
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => onSelectBusiness(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors cursor-pointer shadow-2xs"
                    >
                      <SparklesIcon className="h-3.5 w-3.5 text-blue-500" />
                      <span>{b.llm_analysis ? 'Ver Análisis' : 'Ver Ficha'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      <div className="p-3.5 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Página <strong>{page}</strong> de <strong>{totalPages}</strong>
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
