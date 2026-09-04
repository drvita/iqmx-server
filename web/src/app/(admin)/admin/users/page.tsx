'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  UserPlusIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type SystemUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  has_customer_role?: boolean;
  customer_id?: number | null;
  partner_id: number | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Crear Usuario Interno
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
  });
  const [savingCreate, setSavingCreate] = useState(false);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  // Modal Otorgar Rol de Cliente
  const [grantTargetUser, setGrantTargetUser] = useState<SystemUser | null>(null);
  const [grantFormData, setGrantFormData] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    tax_id: '',
  });
  const [savingGrant, setSavingGrant] = useState(false);
  const [grantErrorMsg, setGrantErrorMsg] = useState<string | null>(null);

  // Modal Confirmar Revocación de Rol de Cliente
  const [revokeTargetUser, setRevokeTargetUser] = useState<SystemUser | null>(null);
  const [savingRevoke, setSavingRevoke] = useState(false);
  const [revokeErrorMsg, setRevokeErrorMsg] = useState<string | null>(null);

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

  // Manejar creación de usuario interno
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    setCreateErrorMsg(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createFormData),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateErrorMsg(data?.detail || 'Error al crear usuario.');
      } else {
        setIsCreateModalOpen(false);
        setCreateFormData({ name: '', email: '', password: '', role: 'admin' });
        fetchUsers();
      }
    } catch {
      setCreateErrorMsg('Error de conexión.');
    } finally {
      setSavingCreate(false);
    }
  };

  // Abrir modal de asignación de cliente
  const openGrantModal = (user: SystemUser) => {
    setGrantTargetUser(user);
    setGrantFormData({
      company_name: user.name || '',
      contact_name: user.name || '',
      phone: '',
      tax_id: '',
    });
    setGrantErrorMsg(null);
  };

  // Ejecutar otorgar acceso de cliente
  const handleGrantCustomerRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantTargetUser) return;
    setSavingGrant(true);
    setGrantErrorMsg(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/users/${grantTargetUser.id}/customer-role`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grantFormData),
      });
      const data = await res.json();
      if (!res.ok) {
        setGrantErrorMsg(data?.detail || 'Error al habilitar acceso de cliente.');
      } else {
        setGrantTargetUser(null);
        fetchUsers();
      }
    } catch {
      setGrantErrorMsg('Error de conexión.');
    } finally {
      setSavingGrant(false);
    }
  };

  // Ejecutar revocación de cliente
  const handleRevokeCustomerRole = async () => {
    if (!revokeTargetUser) return;
    setSavingRevoke(true);
    setRevokeErrorMsg(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/users/${revokeTargetUser.id}/customer-role`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setRevokeErrorMsg(data?.detail || 'Error al revocar acceso de cliente.');
      } else {
        setRevokeTargetUser(null);
        fetchUsers();
      }
    } catch {
      setRevokeErrorMsg('Error de conexión.');
    } finally {
      setSavingRevoke(false);
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return (
          <span key={roleName} className="rounded-md bg-blue-50 px-2 py-0.5 font-bold uppercase tracking-wider text-blue-700 border border-blue-200 text-[10px]">
            Admin
          </span>
        );
      case 'partner':
        return (
          <span key={roleName} className="rounded-md bg-purple-50 px-2 py-0.5 font-bold uppercase tracking-wider text-purple-700 border border-purple-200 text-[10px]">
            Partner
          </span>
        );
      case 'contact':
        return (
          <span key={roleName} className="rounded-md bg-amber-50 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-700 border border-amber-200 text-[10px]">
            Contacto
          </span>
        );
      case 'customer':
        return (
          <span key={roleName} className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200 text-[10px]">
            Cliente
          </span>
        );
      default:
        return (
          <span key={roleName} className="rounded-md bg-gray-50 px-2 py-0.5 font-bold uppercase tracking-wider text-gray-700 border border-gray-200 text-[10px]">
            {roleName}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Usuarios del Sistema</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra los operadores internos y administradores. Puedes otorgar o revocar acceso al Portal de Clientes con las mismas credenciales.
          </p>
        </div>
        <button
          onClick={() => {
            setCreateErrorMsg(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors shrink-0 cursor-pointer"
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
              <th className="px-4 py-3">Roles Asignados</th>
              <th className="px-4 py-3 text-center">Acceso Portal Clientes</th>
              <th className="px-4 py-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const hasCustomer = u.has_customer_role || (u.roles && u.roles.includes('customer'));
              const displayRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];

              return (
                <tr key={u.id} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-gray-900">{u.name}</td>
                  <td className="px-4 py-3.5 font-mono text-gray-600">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {displayRoles.map((r) => getRoleBadge(r))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {hasCustomer ? (
                      <button
                        onClick={() => {
                          setRevokeErrorMsg(null);
                          setRevokeTargetUser(u);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Revocar acceso al portal de clientes"
                      >
                        <span>✕ Revocar Cliente</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openGrantModal(u)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Permite a este usuario ingresar al portal de clientes"
                      >
                        <span>+ Acceso Cliente</span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-gray-400">#{u.id}</td>
                </tr>
              );
            })}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  No hay usuarios de sistema registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Usuario Interno */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
              <span>Crear Usuario del Sistema</span>
            </h3>

            {createErrorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {createErrorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="Carlos López"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Correo</label>
                <input
                  type="email"
                  required
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder="carlos@iqissmexico.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Rol</label>
                <select
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
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
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingCreate ? 'Guardando…' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Otorgar Acceso de Cliente */}
      {grantTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-blue-600" />
              <span>Habilitar Acceso de Cliente</span>
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Registra los datos de la empresa para <strong>{grantTargetUser.name}</strong> ({grantTargetUser.email}).
              Podrá ingresar al portal de clientes con su misma contraseña.
            </p>

            {grantErrorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {grantErrorMsg}
              </div>
            )}

            <form onSubmit={handleGrantCustomerRole} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Razón Social o Nombre de Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={grantFormData.company_name}
                  onChange={(e) => setGrantFormData({ ...grantFormData, company_name: e.target.value })}
                  placeholder="Ej. Mi Empresa S.A. de C.V."
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Nombre del Contacto *
                </label>
                <input
                  type="text"
                  required
                  value={grantFormData.contact_name}
                  onChange={(e) => setGrantFormData({ ...grantFormData, contact_name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={grantFormData.phone}
                    onChange={(e) => setGrantFormData({ ...grantFormData, phone: e.target.value })}
                    placeholder="+52 314 123 4567"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    RFC / Tax ID (Opcional)
                  </label>
                  <input
                    type="text"
                    value={grantFormData.tax_id}
                    onChange={(e) => setGrantFormData({ ...grantFormData, tax_id: e.target.value })}
                    placeholder="XAXX010101000"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setGrantTargetUser(null)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGrant}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingGrant ? 'Habilitando…' : 'Habilitar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Revocación */}
      {revokeTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-rose-600" />
              <span>Revocar Acceso de Cliente</span>
            </h3>

            {revokeErrorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {revokeErrorMsg}
              </div>
            )}

            <p className="mt-3 text-xs text-gray-600 leading-relaxed">
              ¿Estás seguro de que deseas revocar el acceso de cliente a{' '}
              <strong>{revokeTargetUser.name}</strong> ({revokeTargetUser.email})?
            </p>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              El usuario ya no podrá ingresar al portal de clientes. Su perfil quedará inactivo para preservar el historial de compras y configuraciones sin perder datos. Su acceso interno al sistema no se verá afectado.
            </p>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setRevokeTargetUser(null)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingRevoke}
                onClick={handleRevokeCustomerRole}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingRevoke ? 'Revocando…' : 'Revocar Acceso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
