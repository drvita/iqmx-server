'use client';

import { AuthRedirect } from '@/components/AuthGuard';

export default function PortalRootPage() {
  return <AuthRedirect role="customer" loadingMessage="Cargando portal de clientes..." />;
}

