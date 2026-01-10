import { Service, CRMClient } from '../types';

export const fmtDate = (s?: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
};

export const isServiceActive = (service: Service): boolean => {
  if (!service.expires_at) return true;
  const expiryDate = new Date(service.expires_at);
  const now = new Date();
  return expiryDate.getTime() > now.getTime();
};

export const getDaysUntilExpiry = (expiryDate?: string) => {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days;
};

export const getServiceByCredentialId = (credentialId: string | undefined, services: Service[]): Service | undefined => {
  if (!credentialId) return undefined;
  return services.find(s => s.credential_id === credentialId);
};

export const getClientByCredentialId = (credentialId: string | undefined, clients: CRMClient[]): CRMClient | undefined => {
  if (!credentialId) return undefined;
  return clients.find(c => c.credential_id === credentialId);
};

export const getFilteredCredentials = (
  services: Service[],
  filter: 'all' | 'unassigned' | 'assigned',
  clients: CRMClient[]
) => {
  const activeCredentials = services.filter(s => isServiceActive(s));

  if (filter === 'unassigned') {
    return activeCredentials.filter(s => !getClientByCredentialId(s.credential_id, clients));
  }
  if (filter === 'assigned') {
    return activeCredentials.filter(s => !!getClientByCredentialId(s.credential_id, clients));
  }
  return activeCredentials;
};

export const getExpiryStatus = (expiryDate?: string) => {
  const daysLeft = getDaysUntilExpiry(expiryDate);
  if (daysLeft === null) return 'none';
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 5) return 'soon';
  return 'active';
};
