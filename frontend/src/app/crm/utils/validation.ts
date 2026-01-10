import { CRMClient, FormData, Service } from '../types';

export const validateClientForm = (formData: FormData): { valid: boolean; error?: string } => {
  if (!formData.name.trim()) {
    return { valid: false, error: 'Nombre es requerido' };
  }
  if (!formData.email.trim()) {
    return { valid: false, error: 'Email es requerido' };
  }
  return { valid: true };
};

export const validateCredentialNotAssigned = (
  credentialId: string | undefined,
  clients: CRMClient[],
  currentClientId?: string
): { valid: boolean; error?: string } => {
  if (!credentialId) {
    return { valid: true };
  }

  const assignedClient = clients.find(c => c.credential_id === credentialId);
  if (assignedClient && (!currentClientId || assignedClient.id !== currentClientId)) {
    return { 
      valid: false, 
      error: `Esta credencial ya está asignada a ${assignedClient.name}` 
    };
  }

  return { valid: true };
};
