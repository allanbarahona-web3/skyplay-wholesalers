export type CRMClient = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  credential_id?: string;
  expires_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
};

export type UserSubscription = {
  status?: string;
  product_type?: string;
  stripe_subscription_id?: string;
  current_period_end?: string;
  billing_cycle?: string;
  cancel_at_period_end?: boolean;
  remaining_days?: number | null;
  paused_at?: string | null;
  // Legacy nested structure (for compatibility)
  subscription?: { status: string };
  crm_basic?: { status: string };
  crm_pro?: { status: string };
};

export type Service = {
  id: string;
  product_name: string;
  product_code: string;
  credential_id?: string;
  credential_email?: string;
  credential_password?: string;
  profile_name?: string;
  pin?: string;
  status: string;
  expires_at?: string;
  created_at?: string;
};

export type FormData = {
  name: string;
  email: string;
  phone: string;
  credential_id: string;
  notes: string;
};

export type CredentialsFilter = 'all' | 'unassigned' | 'assigned';
