"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Phone,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APP_MODULES,
  MODULE_METADATA,
  type AppModule,
} from "@/lib/auth/permissions-constants";

type Member = {
  id: string;
  userId: string;
  role: "owner" | "admin" | "agent";
  name: string;
  email: string;
  createdAt: string;
  assignedLines: string[];
};

type LineOption = {
  phoneNumberId: string;
  label: string;
  displayPhoneNumber: string | null;
  isDefault: boolean;
};

type RolePermissions = Record<"admin" | "agent", Record<AppModule, boolean>>;

export function TeamClient() {
  const [activeTab, setActiveTab] = useState<"members" | "permissions">(
    "members",
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [lines, setLines] = useState<LineOption[]>([]);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [maxTeamMembers, setMaxTeamMembers] = useState<number>(2);
  const [canAddMember, setCanAddMember] = useState<boolean>(true);

  // Formulario nuevo miembro
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [permSavedMsg, setPermSavedMsg] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/settings/team").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const mems = data.members || [];
    setMembers(mems);
    setLines(data.lines || []);
    setPermissions(data.permissions || null);
    const maxMems = data.maxTeamMembers ?? 2;
    setMaxTeamMembers(maxMems);
    setCanAddMember(data.canAddMember ?? (mems.length < maxMems));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function generatePassword() {
    const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    setTempPassword(
      Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(""),
    );
  }

  async function createMember() {
    setSaving(true);
    setError(null);
    setCreated(null);
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password: tempPassword,
        role,
        assignedLines: role === "agent" ? selectedLines : undefined,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error?.message ?? "No se pudo crear la cuenta");
      return;
    }
    setCreated({ email, password: tempPassword });
    setName("");
    setEmail("");
    setTempPassword("");
    setSelectedLines([]);
    void refetch();
  }

  async function updateMemberRole(
    memberId: string,
    newRole: "admin" | "agent",
  ) {
    await fetch("/api/settings/team", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    void refetch();
  }

  async function updateMemberLines(memberId: string, lineIds: string[]) {
    await fetch("/api/settings/team", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, assignedLines: lineIds }),
    });
    void refetch();
  }

  async function deleteMember(memberId: string) {
    if (!confirm("¿Seguro que deseas eliminar este miembro del equipo?"))
      return;
    await fetch(`/api/settings/team?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
    void refetch();
  }

  async function togglePermission(
    roleKey: "admin" | "agent",
    moduleKey: AppModule,
  ) {
    if (!permissions) return;
    const current = permissions[roleKey]?.[moduleKey] ?? false;
    const next = !current;

    setPermissions({
      ...permissions,
      [roleKey]: {
        ...permissions[roleKey],
        [moduleKey]: next,
      },
    });

    await fetch("/api/settings/team/permissions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: roleKey,
        module: moduleKey,
        allowed: next,
      }),
    });

    setPermSavedMsg(true);
    setTimeout(() => setPermSavedMsg(false), 2000);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Selector de pestañas */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={activeTab === "members" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("members")}
          className="flex items-center gap-1.5"
        >
          <Users className="h-4 w-4" />
          Miembros y Líneas
        </Button>
        <Button
          variant={activeTab === "permissions" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("permissions")}
          className="flex items-center gap-1.5"
        >
          <Shield className="h-4 w-4" />
          Matriz de Permisos por Rol
        </Button>
        {permSavedMsg && (
          <span className="text-xs text-primary ml-auto">
            Permisos actualizados ✓
          </span>
        )}
      </div>

      {activeTab === "members" && (
        <>
          {/* Formulario para agregar miembro */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">
                  Crear cuenta de equipo
                </CardTitle>
                <CardDescription className="text-xs">
                  Asigna un rol y define qué líneas de WhatsApp podrá ver y
                  responder. Comparte tú mismo la contraseña temporal.
                </CardDescription>
              </div>
              <Badge variant={canAddMember ? "outline" : "secondary"} className="shrink-0 text-xs">
                {members.length} / {maxTeamMembers} miembros
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canAddMember && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Límite de equipo alcanzado ({members.length}/{maxTeamMembers})</span>
                    <p className="mt-0.5 opacity-90">
                      Has alcanzado el número máximo de integrantes de equipo permitidos por tu membresía actual. Para sumar más operadores o administradores, actualiza tu plan en el portal central.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="team-name">Nombre</Label>
                  <Input
                    id="team-name"
                    value={name}
                    placeholder="p. ej. Carlos Martínez"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-email">Correo</Label>
                  <Input
                    id="team-email"
                    type="email"
                    placeholder="carlos@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="team-role">Rol en el negocio</Label>
                  <select
                    id="team-role"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "admin" | "agent")
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="agent">
                      Operador / Agente (Solo líneas asignadas)
                    </option>
                    <option value="admin">
                      Administrador (Acceso a todas las líneas)
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="team-password">Contraseña temporal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="team-password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generatePassword}
                    >
                      Generar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Selector de Líneas si es rol Operador / Agente */}
              {role === "agent" && lines.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs font-semibold">
                    Líneas de WhatsApp asignadas a este operador:
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lines.map((line) => {
                      const checked = selectedLines.includes(
                        line.phoneNumberId,
                      );
                      return (
                        <label
                          key={line.phoneNumberId}
                          className="flex items-center gap-2 text-xs cursor-pointer rounded p-1 hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLines([
                                  ...selectedLines,
                                  line.phoneNumberId,
                                ]);
                              } else {
                                setSelectedLines(
                                  selectedLines.filter(
                                    (id) => id !== line.phoneNumberId,
                                  ),
                                );
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">{line.label}</span>
                          {line.isDefault && (
                            <span className="text-[10px] text-muted-foreground">
                              (Predeterminada)
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {created && (
                <div className="rounded-md border border-success-soft bg-success-tint p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium text-success-text">
                    <CheckCircle2 className="h-4 w-4" /> Cuenta creada
                    exitosamente
                  </div>
                  <p className="mt-1 text-xs text-success-text">
                    Correo: <strong>{created.email}</strong> · Contraseña:{" "}
                    <code className="rounded bg-background px-1 py-0.5">
                      {created.password}
                    </code>
                  </p>
                </div>
              )}

              <Button
                onClick={() => void createMember()}
                disabled={!canAddMember || !name || !email || tempPassword.length < 8 || saving}
                title={
                  !canAddMember
                    ? `Has alcanzado el límite de ${maxTeamMembers} miembros permitidos por tu membresía.`
                    : undefined
                }
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                {saving ? "Creando…" : "Crear cuenta"}
              </Button>
            </CardContent>
          </Card>

          {/* Lista de miembros del equipo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Miembros del equipo ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {members.map((m) => (
                <div key={m.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ContactAvatar name={m.name} seed={m.email} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{m.name}</p>
                          <Badge
                            variant={
                              m.role === "owner"
                                ? "default"
                                : m.role === "admin"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {m.role === "owner"
                              ? "Propietario"
                              : m.role === "admin"
                                ? "Administrador"
                                : "Operador"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.email}
                        </p>
                      </div>
                    </div>

                    {m.role !== "owner" && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            void updateMemberRole(
                              m.id,
                              e.target.value as "admin" | "agent",
                            )
                          }
                          className="rounded-md border bg-background px-2.5 py-1 text-xs shadow-sm font-medium"
                        >
                          <option value="agent">Operador</option>
                          <option value="admin">Administrador</option>
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void deleteMember(m.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Eliminar miembro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Asignación de líneas para rol Operador / Agente */}
                  {m.role === "agent" && lines.length > 0 && (
                    <div className="rounded-md bg-muted/40 p-2.5 text-xs">
                      <p className="font-semibold text-muted-foreground mb-1.5">
                        Líneas asignadas para ver y responder:
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {lines.map((line) => {
                          const hasLine = m.assignedLines?.includes(
                            line.phoneNumberId,
                          );
                          return (
                            <label
                              key={line.phoneNumberId}
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={hasLine}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [
                                        ...(m.assignedLines || []),
                                        line.phoneNumberId,
                                      ]
                                    : (m.assignedLines || []).filter(
                                        (id) => id !== line.phoneNumberId,
                                      );
                                  void updateMemberLines(m.id, next);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span>{line.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Pestaña: Matriz de Permisos por Rol */}
      {activeTab === "permissions" && permissions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Matriz de Permisos por Rol (RBAC)
            </CardTitle>
            <CardDescription className="text-xs">
              Activa o desactiva qué módulos de la aplicación puede utilizar
              cada rol. El Propietario siempre tiene acceso al 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-muted/50 font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Módulo del CRM</th>
                    <th className="px-4 py-3 text-center">
                      Rol: Administrador
                    </th>
                    <th className="px-4 py-3 text-center">
                      Rol: Operador / Agente
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {APP_MODULES.map((mod) => {
                    const meta = MODULE_METADATA[mod];
                    const adminAllowed = permissions.admin[mod] ?? true;
                    const agentAllowed = permissions.agent[mod] ?? false;

                    return (
                      <tr key={mod} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground text-sm">
                            {meta.label}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {meta.description}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            role="switch"
                            aria-checked={adminAllowed}
                            onClick={() => void togglePermission("admin", mod)}
                            className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                              adminAllowed ? "bg-primary" : "bg-secondary"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-knob transition-transform ${
                                adminAllowed
                                  ? "translate-x-4"
                                  : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            role="switch"
                            aria-checked={agentAllowed}
                            onClick={() => void togglePermission("agent", mod)}
                            className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                              agentAllowed ? "bg-primary" : "bg-secondary"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-knob transition-transform ${
                                agentAllowed
                                  ? "translate-x-4"
                                  : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
