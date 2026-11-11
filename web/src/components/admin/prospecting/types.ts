export type ProspectingStats = {
  total_businesses: number;
  qualified: number;
  disqualified: number;
  ready_for_llm: number;
  pending_scraping: number;
  whatsapp_channel: number;
  mailtrap_template_configured?: boolean;
};

export type ProspectingCampaign = {
  id: number;
  name: string;
  description: string | null;
  state_code: string;
  state_name: string;
  municipality_code: string;
  municipality_name: string;
  scian_codes: string;
  search_keywords: string;
  stratum_filter: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  businesses_count: number;
  qualified_count: number;
};

export type ProspectingBusinessItem = {
  id: number;
  denue_id: string;
  name: string;
  scian_activity: string | null;
  stratum: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  municipality: string | null;
  state: string | null;
  status: 'discovered' | 'ready_for_llm' | 'qualified' | 'disqualified' | 'contacted';
  disqualification_reason: string | null;
  contact_channel: 'whatsapp' | 'email' | 'physical_visit' | 'none' | null;
  denue_score: number;
  digital_score: number;
  total_score: number;
  has_working_website: boolean | null;
  has_whatsapp_link: boolean | null;
  has_online_booking: boolean | null;
  booking_provider: string | null;
  llm_analysis: {
    internal_diagnosis?: string;
    sales_action_recommendation?: string;
    suggested_template?: string;
    recommended_channel?: string;
    opportunities?: {
      website_development?: {
        applicable: boolean;
        reason_for_sales_team: string;
      };
      crm_whatsapp?: {
        applicable: boolean;
        reason_for_sales_team: string;
      };
      automated_booking?: {
        applicable: boolean;
        reason_for_sales_team: string;
      };
    };
    evaluated_at?: string;
  } | null;
  email_sent_at?: string | null;
  email_message_id?: string | null;
  email_delivery_status?: 'none' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | null;
  email_delivered_at?: string | null;
  email_opened_at?: string | null;
  email_clicked_at?: string | null;
  last_discovered_at: string;
  last_evaluated_at: string | null;
};

export type ProspectingSource = {
  id: number;
  source_type: string;
  source_url: string | null;
  confidence_level: 'confirmed' | 'inferred' | 'not_found';
  http_status: number | null;
  summary: string | null;
  extracted_data: any;
  fetched_at: string | null;
};

export type ProspectingBusinessDetail = ProspectingBusinessItem & {
  clee: string | null;
  razon_social: string | null;
  street: string | null;
  ext_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  has_ssl: boolean | null;
  social_links: any | null;
  digital_signals: any | null;
  sources: ProspectingSource[];
};
