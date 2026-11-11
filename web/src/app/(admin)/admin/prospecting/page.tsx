'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ProspectingStats,
  ProspectingCampaign,
  ProspectingBusinessItem,
  ProspectingBusinessDetail,
} from '@/components/admin/prospecting/types';
import { ProspectingKpiCards } from '@/components/admin/prospecting/ProspectingKpiCards';
import { CampaignConfigPanel } from '@/components/admin/prospecting/CampaignConfigPanel';
import { BusinessesRankingTable } from '@/components/admin/prospecting/BusinessesRankingTable';
import { BusinessScrapedDrawer } from '@/components/admin/prospecting/BusinessScrapedDrawer';

export default function AdminProspectingPage() {
  const [stats, setStats] = useState<ProspectingStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [campaigns, setCampaigns] = useState<ProspectingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<ProspectingCampaign | null>(null);

  const [discovering, setDiscovering] = useState(false);

  const [businesses, setBusinesses] = useState<ProspectingBusinessItem[]>([]);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  // Filtros de tabla
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [viewMode, setViewMode] = useState('qualified'); // 'qualified' por defecto
  const [municipalityFilter, setMunicipalityFilter] = useState('todos');
  const [channelFilter, setChannelFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer de inspección
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState<ProspectingBusinessDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Alertas / Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

  // 1. Cargar Estadísticas
  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/prospecting/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Ignorar error
    } finally {
      setLoadingStats(false);
    }
  }, [apiUrl]);

  // 2. Cargar Campañas
  const fetchCampaigns = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/prospecting/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ProspectingCampaign[] = await res.json();
        setCampaigns(data);
        if (data.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data[0]);
        }
      }
    } catch {
      // Ignorar error
    }
  }, [apiUrl, selectedCampaign]);

  // 3. Cargar Negocios Paginados
  const fetchBusinesses = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    setLoadingBusinesses(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(pageSize),
        view_mode: viewMode,
      });
      if (selectedCampaign) params.append('campaign_id', String(selectedCampaign.id));
      if (municipalityFilter !== 'todos') params.append('municipality', municipalityFilter);
      if (channelFilter !== 'todos') params.append('contact_channel', channelFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${apiUrl}/api/admin/prospecting/businesses?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.items || []);
        setTotalBusinesses(data.total || 0);
      }
    } catch {
      // Ignorar error
    } finally {
      setLoadingBusinesses(false);
    }
  }, [apiUrl, currentPage, pageSize, viewMode, selectedCampaign, municipalityFilter, channelFilter, searchQuery]);

  // Cargas iniciales
  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, [fetchStats, fetchCampaigns]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Búsqueda Rápida en DENUE (~4 segundos)
  const handleDiscoverDenue = async (formData: any) => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    setDiscovering(true);
    setFeedback(null);

    try {
      let campaignId = selectedCampaign?.id;

      // Si no existe campaña, crearla primero
      if (!campaignId) {
        const createRes = await fetch(`${apiUrl}/api/admin/prospecting/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
        if (!createRes.ok) throw new Error('Error al registrar la campaña');
        const newCamp: ProspectingCampaign = await createRes.json();
        campaignId = newCamp.id;
        setSelectedCampaign(newCamp);
      }

      // Llamar al endpoint ágil de DENUE
      const res = await fetch(`${apiUrl}/api/admin/prospecting/campaigns/${campaignId}/discover-denue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Fallo al consultar la API de DENUE');
      }

      const result = await res.json();
      setFeedback({
        type: 'success',
        message: result.message || 'Búsqueda en DENUE finalizada con éxito.',
      });
      fetchBusinesses();
      fetchStats();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al consultar la API de DENUE',
      });
    } finally {
      setDiscovering(false);
    }
  };

  // Ver Detalle de Negocio en Drawer
  const handleSelectBusiness = async (b: ProspectingBusinessItem) => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    setLoadingDetail(true);
    setSelectedBusinessDetail(null);
    try {
      const res = await fetch(`${apiUrl}/api/admin/prospecting/businesses/${b.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const detail: ProspectingBusinessDetail = await res.json();
        setSelectedBusinessDetail(detail);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Motor de Prospección Inteligente
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Pipeline bimodal: Descubrimiento DENUE (0-50 pts) + Presencia Digital y Evaluación LLM con LangChain y OpenRouter.
          </p>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas del Embudo */}
      <ProspectingKpiCards stats={stats} loading={loadingStats} />

      {/* Panel de Búsqueda Rápida en DENUE */}
      <CampaignConfigPanel
        campaign={selectedCampaign}
        onDiscoverDenue={handleDiscoverDenue}
        discovering={discovering}
      />

      {/* Tabla Principal: Calificados por defecto */}
      <BusinessesRankingTable
        businesses={businesses}
        total={totalBusinesses}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={(p) => setCurrentPage(p)}
        onSelectBusiness={handleSelectBusiness}
        loading={loadingBusinesses}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setCurrentPage(1);
        }}
        municipalityFilter={municipalityFilter}
        onMunicipalityFilterChange={(val) => {
          setMunicipalityFilter(val);
          setCurrentPage(1);
        }}
        channelFilter={channelFilter}
        onChannelFilterChange={(val) => {
          setChannelFilter(val);
          setCurrentPage(1);
        }}
        searchQuery={searchQuery}
        onSearchQueryChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
      />

      {/* Drawer Lateral de Propuesta y Ficha */}
      <BusinessScrapedDrawer
        business={selectedBusinessDetail}
        onClose={() => setSelectedBusinessDetail(null)}
        loading={loadingDetail}
        mailtrapConfigured={Boolean(stats?.mailtrap_template_configured)}
      />
    </div>
  );
}
