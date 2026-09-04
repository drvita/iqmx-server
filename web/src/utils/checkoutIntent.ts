export interface CheckoutIntent {
  plan_id: number;
  plan_name: string;
  price_mxn: number;
  product_slug: string;
  timestamp: number;
}

const COOKIE_NAME = 'iqmx_pending_checkout';

export function saveCheckoutIntent(intent: Omit<CheckoutIntent, 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  const data: CheckoutIntent = {
    ...intent,
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(data);

  // Guardar en cookie (duración 7 días)
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(jsonStr)}; path=/; max-age=${maxAge}; SameSite=Lax`;

  // Guardar en localStorage como respaldo
  try {
    localStorage.setItem(COOKIE_NAME, jsonStr);
  } catch {
    // ignore
  }
}

export function getCheckoutIntent(): CheckoutIntent | null {
  if (typeof window === 'undefined') return null;

  // Intentar leer de cookie
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${COOKIE_NAME})=([^;]*)`));
  if (match && match[3]) {
    try {
      return JSON.parse(decodeURIComponent(match[3]));
    } catch {
      // fallback a localStorage
    }
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return null;
}

export function clearCheckoutIntent(): void {
  if (typeof window === 'undefined') return;

  // Borrar cookie
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;

  // Borrar localStorage
  try {
    localStorage.removeItem(COOKIE_NAME);
  } catch {
    // ignore
  }
}
