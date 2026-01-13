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

      console.log('🔄 Fetching CRM data...');

      // Fetch overview data
      const overviewRes = await fetch('http://localhost:3000/api/me/overview', {
        credentials: 'include',
      });
      
      if (!overviewRes.ok) {
        console.error('❌ Overview fetch failed:', overviewRes.status);
        throw new Error(`Failed to fetch overview: ${overviewRes.status}`);
      }
      
      const overviewData = await overviewRes.json();
      console.log('📊 Overview data:', overviewData);

      setSubscription(overviewData.subscription);
      setPurchasedServices(overviewData.subscription?.active_services || []);

      // Fetch CRM clients
      const clientsRes = await fetch('http://localhost:3000/api/crm/clients', {
        credentials: 'include',
      });
      
      if (!clientsRes.ok) {
        console.error('❌ Clients fetch failed:', clientsRes.status);
        throw new Error(`Failed to fetch CRM clients: ${clientsRes.status}`);
      }
      
      const clientsData = await clientsRes.json();
      console.log('👥 Clients data:', clientsData);

      setClients(clientsData.clients || clientsData || []);
      console.log('✅ CRM data loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching CRM data:', err);
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
