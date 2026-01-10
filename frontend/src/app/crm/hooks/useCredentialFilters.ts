'use client';

import { useState, useMemo } from 'react';
import { CRMClient, Service, CredentialsFilter } from '../types';
import { getFilteredCredentials } from '../utils/helpers';

interface UseCredentialFiltersReturn {
  filter: CredentialsFilter;
  setFilter: (filter: CredentialsFilter) => void;
  filteredCredentials: Service[];
  counts: {
    all: number;
    unassigned: number;
    assigned: number;
  };
}

export const useCredentialFilters = (
  services: Service[],
  clients: CRMClient[]
): UseCredentialFiltersReturn => {
  const [filter, setFilter] = useState<CredentialsFilter>('all');

  const filteredCredentials = useMemo(
    () => getFilteredCredentials(services, filter, clients),
    [services, filter, clients]
  );

  const counts = useMemo(() => {
    const all = getFilteredCredentials(services, 'all', clients).length;
    const unassigned = getFilteredCredentials(services, 'unassigned', clients).length;
    const assigned = getFilteredCredentials(services, 'assigned', clients).length;

    return { all, unassigned, assigned };
  }, [services, clients]);

  return {
    filter,
    setFilter,
    filteredCredentials,
    counts,
  };
};
