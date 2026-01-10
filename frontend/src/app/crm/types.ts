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
