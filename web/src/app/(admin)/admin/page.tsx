'use client';

import { AuthRedirect } from '@/components/AuthGuard';

export default function AdminRootPage() {
  return <AuthRedirect role="admin" loadingMessage="Cargando administración..." />;
}

