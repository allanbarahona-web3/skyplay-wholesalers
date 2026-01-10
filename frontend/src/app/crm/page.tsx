'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePayment } from '@/components/PaymentContext';

import { useCRMData, useCRMClients, useCredentialFilters } from './hooks';
import {
  ClientsTable,
  CredentialsSection,
  ClientModals,
  AccessDenied,
  LoadingState,
} from './components';
import { FormData, Service } from './types';
import {
  validateClientForm,
  validateCredentialNotAssigned,
} from './utils/validation';

export default function CRMPage() {
  const router = useRouter();
  const { openPayment } = usePayment();

  // Data loading hooks
  const { clients, purchasedServices, subscription, loading, error, refetch } = useCRMData();

  // Filtering hooks
  const { filter, setFilter, filteredCredentials, counts } = useCredentialFilters(
    purchasedServices,
    clients
  );

  // Client CRUD operations
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { addClient, updateClient, deleteClient, operationError, operationLoading } =
    useCRMClients(handleRefresh);

  // UI State
  const [searchText, setSearchText] = useState('');
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOk, setToastOk] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    credential_id: '',
    notes: '',
  });

  // Form handlers
  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validation = validateClientForm(formData);
    if (!validation.valid) {
      setToastMsg(`❌ ${validation.error}`);
      setToastOk(false);
      return;
    }

    // Validate credential not assigned
    const credentialValidation = validateCredentialNotAssigned(
      formData.credential_id,
      clients
    );
    if (!credentialValidation.valid) {
      setToastMsg(`❌ ${credentialValidation.error}`);
      setToastOk(false);
      return;
    }

    const result = await addClient(formData);
    if (result) {
      setToastMsg('✅ Cliente agregado correctamente');
      setToastOk(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        credential_id: '',
        notes: '',
      });
      setSelectedService(null);
      setShowAddClientModal(false);
    } else {
      setToastMsg(`❌ ${operationError || 'Error al agregar cliente'}`);
      setToastOk(false);
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingClient) return;

    // Validate form
    const validation = validateClientForm(formData);
    if (!validation.valid) {
      setToastMsg(`❌ ${validation.error}`);
      setToastOk(false);
      return;
    }

    // Validate credential not assigned (except for current client)
    const credentialValidation = validateCredentialNotAssigned(
      formData.credential_id,
      clients,
      editingClient.id
    );
    if (!credentialValidation.valid) {
      setToastMsg(`❌ ${credentialValidation.error}`);
      setToastOk(false);
      return;
    }

    const result = await updateClient(editingClient.id, formData);
    if (result) {
      setToastMsg('✅ Cliente actualizado correctamente');
      setToastOk(true);
      setEditingClient(null);
      setShowEditClientModal(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        credential_id: '',
        notes: '',
      });
      setSelectedService(null);
    } else {
      setToastMsg(`❌ ${operationError || 'Error al actualizar cliente'}`);
      setToastOk(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;

    const result = await deleteClient(clientId);
    if (result) {
      setToastMsg('✅ Cliente eliminado');
      setToastOk(true);
    } else {
      setToastMsg(`❌ ${operationError || 'Error al eliminar cliente'}`);
      setToastOk(false);
    }
  };

  const openAddModal = (service?: Service) => {
    if (service) {
      setSelectedService(service);
      setFormData((prev) => ({
        ...prev,
        credential_id: service.credential_id || '',
      }));
    } else {
      setSelectedService(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        credential_id: '',
        notes: '',
      });
    }
    setShowAddClientModal(true);
  };

  const openEditModal = (client: any) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      credential_id: client.credential_id || '',
      notes: client.notes || '',
    });

    if (client.credential_id) {
      const matchingService = purchasedServices.find(
        (s) => s.credential_id === client.credential_id
      );
      setSelectedService(matchingService || null);
    } else {
      setSelectedService(null);
    }

    setShowEditClientModal(true);
  };

  const handleUpgradeToPRO = () => {
    setShowUpgradeModal(false);
    openPayment({
      service: 'CRM PRO',
      plan: 'Mensual',
      price: 24.95,
      productCode: 'crm-pro',
      isRenewal: false,
    });
  };

  // Toast effect
  React.useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(''), 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Access control
  if (loading) {
    return <LoadingState />;
  }

  const hasPreferentialSubscription = subscription?.subscription?.status === 'active';
  const hasCRMBasic = subscription?.crm_basic?.status === 'active';
  const hasCRMPro = subscription?.crm_pro?.status === 'active';
  const hasAccess = hasPreferentialSubscription || hasCRMBasic || hasCRMPro;
  const isCRMPro = hasCRMPro;

  if (!subscription || !hasAccess) {
    return <AccessDenied subscription={subscription} />;
  }

  return (
    <div style={{ paddingTop: '80px', paddingBottom: '40px' }}>
      <main
        style={{
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: '20px',
          paddingRight: '20px',
        }}
      >
        {/* Clientes Section */}
        <section className="panel-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Gestión de Clientes</h2>
              <p className="section-desc">
                Administra tu base de clientes y asigna credenciales de tus servicios.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => openAddModal()}
              style={{ marginTop: 0 }}
            >
              ➕ Nuevo Cliente
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, email o teléfono..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          {/* Clients Table */}
          <ClientsTable
            clients={clients}
            services={purchasedServices}
            searchText={searchText}
            onEdit={openEditModal}
            onDelete={handleDeleteClient}
            onAddNew={() => openAddModal()}
          />
        </section>

        {/* Credentials Section */}
        <CredentialsSection
          services={purchasedServices}
          clients={clients}
          filter={filter}
          onFilterChange={setFilter}
          filteredCredentials={filteredCredentials}
          counts={counts}
          onAssignClick={() => {
            const service = filteredCredentials[0];
            if (service) {
              openAddModal(service);
            }
          }}
        />

        {/* PRO Features Section */}
        {isCRMPro && (
          <section className="panel-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Características PRO</h2>
                <p className="section-desc">
                  Funcionalidades premium disponibles en tu plan.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#065f46',
                    fontWeight: '600',
                  }}
                >
                  ✅ Recordatorios Automáticos
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    color: '#047857',
                    fontSize: '14px',
                  }}
                >
                  Envía SMS y emails automáticos a tus clientes antes de que
                  venza su servicio
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#1e40af',
                    fontWeight: '600',
                  }}
                >
                  📊 Analytics
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    color: '#1e3a8a',
                    fontSize: '14px',
                  }}
                >
                  Visualiza estadísticas de tus clientes y servicios activos
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#fdf2f8',
                  border: '1px solid #fbcfe8',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#831843',
                    fontWeight: '600',
                  }}
                >
                  🎯 Automatización
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    color: '#be185d',
                    fontSize: '14px',
                  }}
                >
                  Automatiza procesos de renovación y notificaciones sin
                  intervención
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#92400e',
                    fontWeight: '600',
                  }}
                >
                  📞 Soporte Prioritario
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    color: '#b45309',
                    fontSize: '14px',
                  }}
                >
                  Acceso a soporte prioritario para tu negocio mayorista
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modals */}
      <ClientModals
        showAddModal={showAddClientModal}
        showEditModal={showEditClientModal}
        editingClient={editingClient}
        selectedService={selectedService}
        formData={formData}
        services={purchasedServices}
        clients={clients}
        operationLoading={operationLoading}
        operationError={operationError}
        onFormChange={handleFormChange}
        onAddClose={() => {
          setShowAddClientModal(false);
          setSelectedService(null);
          setFormData({
            name: '',
            email: '',
            phone: '',
            credential_id: '',
            notes: '',
          });
        }}
        onEditClose={() => {
          setShowEditClientModal(false);
          setEditingClient(null);
          setSelectedService(null);
          setFormData({
            name: '',
            email: '',
            phone: '',
            credential_id: '',
            notes: '',
          });
        }}
        onServiceSelect={setSelectedService}
        onAddSubmit={handleAddClient}
        onEditSubmit={handleEditClient}
      />

      {/* Toast */}
      {toastMsg && (
        <div className={`toast${toastOk ? ' ok' : ' err'}`}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
