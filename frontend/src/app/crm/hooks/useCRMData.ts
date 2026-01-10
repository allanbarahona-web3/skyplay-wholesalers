'use client';

import { useEffect, useState } from 'react';
import { CRMClient, Service, UserSubscription } from '../types';

interface UseCRMDataReturn {
  clients: CRMClient[];
  purchasedServices: Service[];
  subscription: UserSubscription | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCRMData = (): UseCRMDataReturn => {
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [purchasedServices, setPurchasedServices] = useState<Service[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch overview data
      const overviewRes = await fetch('/api/me/overview');
      if (!overviewRes.ok) throw new Error('Failed to fetch overview');
      const overviewData = await overviewRes.json();

      setSubscription(overviewData.subscription);
      setPurchasedServices(overviewData.subscription?.active_services || []);

      // Fetch CRM clients
      const clientsRes = await fetch('/api/crm/clients');
      if (!clientsRes.ok) throw new Error('Failed to fetch CRM clients');
      const clientsData = await clientsRes.json();

      setClients(clientsData.clients || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching CRM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    clients,
    purchasedServices,
    subscription,
    loading,
    error,
    refetch: fetchData,
  };
};
