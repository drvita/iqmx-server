export interface CustomerProfile {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  tax_id?: string | null;
  origin?: string;
  is_active: boolean;
}

export interface WhatsAppNumber {
  id: number;
  phone_number_id: string;
  waba_id: string;
  display_phone_number?: string;
  verified_name?: string;
  status: string;
  created_at: string;
}

export interface CustomerWebhookConfig {
  url: string | null;
  secret_token: string;
  is_active: boolean;
  last_delivery_status: string | null;
  last_delivery_code: number | null;
  last_delivery_at: string | null;
}

export interface FeedbackMessage {
  type: 'success' | 'error';
  text: string;
}

export interface PingResult {
  success: boolean;
  status_code?: number;
  latency_ms: number;
  message: string;
}
