'use client';

import React from 'react';
import {
  BuildingOffice2Icon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ProspectingStats } from './types';

interface ProspectingKpiCardsProps {
  stats: ProspectingStats | null;
  loading: boolean;
}

export const ProspectingKpiCards: React.FC<ProspectingKpiCardsProps> = ({ stats, loading }) => {
  const cards = [
    {
      name: 'Prospectos Calificados',
      value: stats?.qualified ?? 0,
      subtext: 'Listos con propuesta y canal',
      icon: CheckBadgeIcon,
      color: 'emerald',
    },
    {
      name: 'Canal WhatsApp Prioritario',
      value: stats?.whatsapp_channel ?? 0,
      subtext: 'Contacto directo móvil',
      icon: ChatBubbleLeftRightIcon,
      color: 'blue',
    },
    {
      name: 'Listos para Evaluar LLM',
      value: stats?.ready_for_llm ?? 0,
      subtext: 'Con scraping web listo',
      icon: ClockIcon,
      color: 'indigo',
    },
    {
      name: 'Total Universo DENUE',
      value: stats?.total_businesses ?? 0,
      subtext: `${stats?.disqualified ?? 0} no aptos / cerrados`,
      icon: BuildingOffice2Icon,
      color: 'amber',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.name}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-gray-500">{c.name}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '…' : c.value.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{c.subtext}</p>
            </div>
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                c.color === 'emerald'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : c.color === 'blue'
                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                  : c.color === 'indigo'
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
