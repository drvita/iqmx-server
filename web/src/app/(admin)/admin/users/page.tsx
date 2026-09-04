'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { UserPlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

type SystemUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  partner_id: number | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.detail || 'Error al crear usuario.');
      } else {
        setIsModalOpen(false);
        setFormData({ name: '', email: '', password: '', role: 'admin' });
        fetchUsers();
      }
    } catch {
      setErrorMsg('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Usuarios del Sistema</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra los operadores internos y administradores con acceso a este panel central (excluye clientes).
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors shrink-0"
        >
          <UserPlusIcon className="h-4 w-4" />
          <span>Nuevo Usuario Interno</span>
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo Electrónico</th>
              <th className="px-4 py-3">Rol del Sistema</th>
              <th className="px-4 py-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/75 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-gray-900">{u.name}</td>
                <td className="px-4 py-3.5 font-mono text-gray-600">{u.email}</td>
                <td className="px-4 py-3.5">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-bold uppercase tracking-wider text-blue-700 border border-blue-200 text-[10px]">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-gray-400">#{u.id}</td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400">
                  No hay usuarios de sistema registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Claro Nuevo Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
              <span>Crear Usuario del Sistema</span>
            </h3>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Carlos López"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Correo</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="carlos@iqissmexico.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Contraseña</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Rol</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="admin">Administrador (Acceso Total)</option>
                  <option value="partner">Socio / Partner</option>
                  <option value="contact">Contacto Operativo</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
