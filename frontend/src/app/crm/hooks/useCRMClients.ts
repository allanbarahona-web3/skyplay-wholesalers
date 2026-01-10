'use client';

import { useState, useCallback } from 'react';
import { CRMClient, FormData } from '../types';

interface UseCRMClientsReturn {
  addClient: (formData: FormData) => Promise<CRMClient | null>;
  updateClient: (clientId: string, formData: FormData) => Promise<CRMClient | null>;
  deleteClient: (clientId: string) => Promise<boolean>;
  operationError: string | null;
  operationLoading: boolean;
}

export const useCRMClients = (onSuccess: () => void): UseCRMClientsReturn => {
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

  const addClient = useCallback(
    async (formData: FormData): Promise<CRMClient | null> => {
      try {
        setOperationError(null);
        setOperationLoading(true);

        const res = await fetch('/api/crm/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          setOperationError(data.message || 'Failed to create client');
          return null;
        }

        onSuccess();
        return data.client;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setOperationError(errorMessage);
        console.error('Error adding client:', err);
        return null;
      } finally {
        setOperationLoading(false);
      }
    },
    [onSuccess]
  );

  const updateClient = useCallback(
    async (clientId: string, formData: FormData): Promise<CRMClient | null> => {
      try {
        setOperationError(null);
        setOperationLoading(true);

        const res = await fetch(`/api/crm/clients/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          setOperationError(data.message || 'Failed to update client');
          return null;
        }

        onSuccess();
        return data.client;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setOperationError(errorMessage);
        console.error('Error updating client:', err);
        return null;
      } finally {
        setOperationLoading(false);
      }
    },
    [onSuccess]
  );

  const deleteClient = useCallback(
    async (clientId: string): Promise<boolean> => {
      try {
        setOperationError(null);
        setOperationLoading(true);

        const res = await fetch(`/api/crm/clients/${clientId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json();
          setOperationError(data.message || 'Failed to delete client');
          return false;
        }

        onSuccess();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setOperationError(errorMessage);
        console.error('Error deleting client:', err);
        return false;
      } finally {
        setOperationLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    addClient,
    updateClient,
    deleteClient,
    operationError,
    operationLoading,
  };
};
