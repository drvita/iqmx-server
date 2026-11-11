'use client';

import React, { useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { ProspectingCampaign } from './types';

interface CampaignConfigPanelProps {
  campaign: ProspectingCampaign | null;
  onDiscoverDenue: (formData: any) => Promise<void>;
  discovering: boolean;
}

export const CampaignConfigPanel: React.FC<CampaignConfigPanelProps> = ({
  campaign,
  onDiscoverDenue,
  discovering,
}) => {
  const [formData, setFormData] = useState({
    name: campaign?.name || 'Estéticas y Barberías de Colima (0 a 30 emp.)',
    search_keywords: campaign?.search_keywords || 'estetica,barberia,salon de belleza,peluqueria',
    state_code: campaign?.state_code || '06',
    state_name: campaign?.state_name || 'Colima',
    municipality_name: campaign?.municipality_name || 'Todo el estado',
    scian_codes: campaign?.scian_codes || '812110',
    stratum_filter: campaign?.stratum_filter || '0 a 30 personas',
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="h-4 w-4 text-blue-600" />
            <span>Explorador de Mercado DENUE (INEGI)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Paso 1 y 2: Descarga ágil de establecimientos locales y cálculo inmediato de Score de Contactabilidad (0 a 50 pts).
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onDiscoverDenue(formData)}
            disabled={discovering}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Descarga ágil de establecimientos locales desde INEGI"
          >
            {discovering ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin text-white" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4 text-white" />
            )}
            <span>{discovering ? 'Consultando INEGI…' : 'Buscar y Actualizar DENUE'}</span>
          </button>
        </div>
      </div>

      {/* Formulario de parámetros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Giro / Palabras clave
          </label>
          <input
            type="text"
            value={formData.search_keywords}
            onChange={(e) => setFormData({ ...formData, search_keywords: e.target.value })}
            placeholder="estetica, barberia, salon"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
          <p className="text-[10px] text-gray-400 mt-1">Separadas por comas (DENUE)</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Estado (Entidad)
          </label>
          <select
            value={formData.state_code}
            onChange={(e) => {
              const code = e.target.value;
              const name = code === '06' ? 'Colima' : code === '14' ? 'Jalisco' : code === '16' ? 'Michoacán' : 'México';
              setFormData({ ...formData, state_code: code, state_name: name });
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="06">06 - Colima</option>
            <option value="14">14 - Jalisco</option>
            <option value="16">16 - Michoacán</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Clave INEGI de 2 dígitos</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Municipio
          </label>
          <select
            value={formData.municipality_name}
            onChange={(e) => setFormData({ ...formData, municipality_name: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="Todo el estado">Todo el estado</option>
            <option value="Colima">Colima</option>
            <option value="Villa de Álvarez">Villa de Álvarez</option>
            <option value="Manzanillo">Manzanillo</option>
            <option value="Tecomán">Tecomán</option>
            <option value="Armería">Armería</option>
            <option value="Comala">Comala</option>
            <option value="Coquimatlán">Coquimatlán</option>
            <option value="Cuauhtémoc">Cuauhtémoc</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Filtro territorial</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Estrato (Personal)
          </label>
          <select
            value={formData.stratum_filter}
            onChange={(e) => setFormData({ ...formData, stratum_filter: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="0 a 30 personas">0 a 30 personas (Micro/Pequeña)</option>
            <option value="0 a 5 personas">0 a 5 personas</option>
            <option value="6 a 10 personas">6 a 10 personas</option>
            <option value="11 a 30 personas">11 a 30 personas</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Tamaño del negocio</p>
        </div>
      </div>
    </div>
  );
};
