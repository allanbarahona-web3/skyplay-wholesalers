'use client';

import React from 'react';
import { CRMClient, Service, FormData } from '../types';
import { isServiceActive, getClientByCredentialId } from '../utils/helpers';

interface ClientModalsProps {
  showAddModal: boolean;
  showEditModal: boolean;
  editingClient: CRMClient | null;
  selectedService: Service | null;
  formData: FormData;
  services: Service[];
  clients: CRMClient[];
  operationLoading: boolean;
  operationError: string | null;
  onFormChange: (field: string, value: any) => void;
  onAddClose: () => void;
  onEditClose: () => void;
  onServiceSelect: (service: Service | null) => void;
  onAddSubmit: (e: React.FormEvent) => void;
  onEditSubmit: (e: React.FormEvent) => void;
}

const Modal = ({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className={`modal modal-flex${open ? ' open' : ''}`}>
      <div className="card modal-card">
        <button className="btn secondary modal-close" onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export const ClientModals: React.FC<ClientModalsProps> = ({
  showAddModal,
  showEditModal,
  editingClient,
  selectedService,
  formData,
  services,
  clients,
  operationLoading,
  operationError,
  onFormChange,
  onAddClose,
  onEditClose,
  onServiceSelect,
  onAddSubmit,
  onEditSubmit,
}) => {
  return (
    <>
      {/* Modal: Agregar Cliente */}
      <Modal open={showAddModal} onClose={onAddClose}>
        <div style={{ marginBottom: '20px' }}>
          <h2
            style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              color: '#1d1d1f',
            }}
          >
            ➕ Nuevo Cliente{' '}
            {selectedService && `- ${selectedService.product_name}`}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#86868b' }}>
            {selectedService
              ? 'Crea un nuevo cliente y asigna esta credencial'
              : 'Agrega un nuevo cliente a tu CRM'}
          </p>
        </div>

        {operationError && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '14px',
            }}
          >
            {operationError}
          </div>
        )}

        {selectedService && (
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13px', color: '#1e40af' }}>
              <strong>📌 Credencial seleccionada:</strong>{' '}
              {selectedService.product_name}
            </p>
            {selectedService.credential_email && (
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#1e3a8a',
                }}
              >
                {selectedService.credential_email}
              </p>
            )}
          </div>
        )}

        <form onSubmit={onAddSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Nombre completo *
            </label>
            <input
              type="text"
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Email *
            </label>
            <input
              type="email"
              placeholder="juan@example.com"
              value={formData.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Teléfono
            </label>
            <input
              type="tel"
              placeholder="+506 8765-4321"
              value={formData.phone}
              onChange={(e) => onFormChange('phone', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Credencial a asignar {selectedService ? '(seleccionada)' : '*'}
            </label>
            {selectedService ? (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  color: '#1d1d1f',
                }}
              >
                <strong>{selectedService.product_name}</strong>
                {selectedService.credential_email && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginTop: '4px',
                    }}
                  >
                    {selectedService.credential_email}
                  </div>
                )}
              </div>
            ) : (
              <select
                value={formData.credential_id}
                onChange={(e) => {
                  const credentialId = e.target.value;
                  const service = services.find(
                    (s) =>
                      s.credential_id === credentialId &&
                      isServiceActive(s)
                  );
                  if (service) {
                    onServiceSelect(service);
                    onFormChange('credential_id', credentialId);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">
                  Selecciona una credencial de tus compras
                </option>
                {services
                  .filter((s) => isServiceActive(s))
                  .map((service: Service) => {
                    const assignedClient = getClientByCredentialId(
                      service.credential_id,
                      clients
                    );
                    const isAssigned = !!assignedClient;
                    return (
                      <option
                        key={service.id}
                        value={service.credential_id || ''}
                        disabled={isAssigned}
                      >
                        {service.product_name}{' '}
                        {service.profile_name
                          ? `(${service.profile_name})`
                          : ''}{' '}
                        {service.credential_email
                          ? `- ${service.credential_email}`
                          : ''}
                        {isAssigned
                          ? ` [Asignada a ${assignedClient?.name}]`
                          : ''}
                      </option>
                    );
                  })}
              </select>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Notas
            </label>
            <textarea
              placeholder="Agrega notas sobre este cliente..."
              value={formData.notes}
              onChange={(e) => onFormChange('notes', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minHeight: '100px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onAddClose}
              style={{ flex: 1 }}
              disabled={operationLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={operationLoading}
            >
              {operationLoading ? '⏳ Guardando...' : 'Agregar Cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Cliente */}
      <Modal open={showEditModal} onClose={onEditClose}>
        <div style={{ marginBottom: '20px' }}>
          <h2
            style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              color: '#1d1d1f',
            }}
          >
            ✏️ Editar Cliente
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#86868b' }}>
            Actualiza la información del cliente
          </p>
        </div>

        {operationError && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '14px',
            }}
          >
            {operationError}
          </div>
        )}

        <form onSubmit={onEditSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Nombre completo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => onFormChange('phone', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Credencial asignada
            </label>
            <select
              value={selectedService?.credential_id || ''}
              onChange={(e) => {
                const credentialId = e.target.value;
                const service = services.find(
                  (s) => s.credential_id === credentialId
                );
                onServiceSelect(service || null);
                if (service?.credential_id) {
                  onFormChange('credential_id', service.credential_id);
                } else {
                  onFormChange('credential_id', '');
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Sin credencial asignada</option>
              <optgroup label="Activas">
                {services
                  .filter((s) => isServiceActive(s))
                  .map((service: Service) => {
                    const assignedClient = getClientByCredentialId(
                      service.credential_id,
                      clients
                    );
                    const isAssigned =
                      !!assignedClient &&
                      assignedClient.id !== editingClient?.id;
                    return (
                      <option
                        key={service.id}
                        value={service.credential_id || ''}
                        disabled={isAssigned}
                      >
                        {service.product_name}{' '}
                        {service.profile_name
                          ? `(${service.profile_name})`
                          : ''}{' '}
                        {service.credential_email
                          ? `- ${service.credential_email}`
                          : ''}
                        {isAssigned
                          ? ` [Asignada a ${assignedClient?.name}]`
                          : ''}
                      </option>
                    );
                  })}
              </optgroup>
              {services.filter((s) => !isServiceActive(s)).length > 0 && (
                <optgroup label="Vencidas">
                  {services
                    .filter((s) => !isServiceActive(s))
                    .map((service: Service) => {
                      const assignedClient = getClientByCredentialId(
                        service.credential_id,
                        clients
                      );
                      const isAssigned =
                        !!assignedClient &&
                        assignedClient.id !== editingClient?.id;
                      return (
                        <option
                          key={service.id}
                          value={service.credential_id || ''}
                          disabled={isAssigned}
                        >
                          {service.product_name}{' '}
                          {service.profile_name
                            ? `(${service.profile_name})`
                            : ''}{' '}
                          {service.credential_email
                            ? `- ${service.credential_email}`
                            : ''}{' '}
                          [Vencida]
                          {isAssigned
                            ? ` [Asignada a ${assignedClient?.name}]`
                            : ''}
                        </option>
                      );
                    })}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => onFormChange('notes', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minHeight: '100px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onEditClose}
              style={{ flex: 1 }}
              disabled={operationLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={operationLoading}
            >
              {operationLoading ? '⏳ Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
