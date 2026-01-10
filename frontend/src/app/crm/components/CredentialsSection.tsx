'use client';

import React from 'react';
import { CRMClient, Service, CredentialsFilter } from '../types';
import {
  fmtDate,
  isServiceActive,
  getClientByCredentialId,
} from '../utils/helpers';

interface CredentialsSectionProps {
  services: Service[];
  clients: CRMClient[];
  filter: CredentialsFilter;
  onFilterChange: (filter: CredentialsFilter) => void;
  filteredCredentials: Service[];
  counts: {
    all: number;
    unassigned: number;
    assigned: number;
  };
  onAssignClick: (service: Service) => void;
}

export const CredentialsSection: React.FC<CredentialsSectionProps> = ({
  services,
  clients,
  filter,
  onFilterChange,
  filteredCredentials,
  counts,
  onAssignClick,
}) => {
  const hasActiveCredentials = services.filter((s) => isServiceActive(s)).length > 0;

  if (!hasActiveCredentials) {
    return (
      <section
        className="panel-section"
        style={{
          backgroundColor: '#f9fafb',
          borderColor: '#e5e7eb',
        }}
      >
        <div className="section-header">
          <div>
            <h2 className="section-title">🎫 Mis Credenciales Compradas</h2>
            <p className="section-desc">
              Tus servicios activos disponibles para asignar a clientes
            </p>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#86868b',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
          <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
            No tienes credenciales activas
          </p>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Ve al <strong>Catálogo</strong> para comprar Netflix, Spotify, Disney+ y más
          </p>
          <button
            className="btn btn-primary"
            onClick={() => (window.location.href = '/')}
            style={{ marginTop: '16px' }}
          >
            Ir al Catálogo
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="panel-section"
      style={{
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
      }}
    >
      <div className="section-header">
        <div>
          <h2 className="section-title">🎫 Mis Credenciales Compradas</h2>
          <p className="section-desc">
            Tus servicios activos disponibles para asignar a clientes
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => onFilterChange('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: filter === 'all' ? '2px solid #0066cc' : '1px solid #d1d5db',
            backgroundColor: filter === 'all' ? '#0066cc' : '#ffffff',
            color: filter === 'all' ? '#ffffff' : '#1d1d1f',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          📋 Todas ({counts.all})
        </button>
        <button
          onClick={() => onFilterChange('unassigned')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border:
              filter === 'unassigned'
                ? '2px solid #10b981'
                : '1px solid #d1d5db',
            backgroundColor:
              filter === 'unassigned' ? '#10b981' : '#ffffff',
            color: filter === 'unassigned' ? '#ffffff' : '#1d1d1f',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ✓ Por Asignar ({counts.unassigned})
        </button>
        <button
          onClick={() => onFilterChange('assigned')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border:
              filter === 'assigned'
                ? '2px solid #f59e0b'
                : '1px solid #d1d5db',
            backgroundColor:
              filter === 'assigned' ? '#f59e0b' : '#ffffff',
            color: filter === 'assigned' ? '#ffffff' : '#1d1d1f',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          📌 Asignadas ({counts.assigned})
        </button>
      </div>

      {/* Credenciales */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {filteredCredentials.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 20px',
              color: '#86868b',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            {filter === 'unassigned' && (
              <>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>✓</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Todas tus credenciales están asignadas
                </p>
              </>
            )}
            {filter === 'assigned' && (
              <>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  No tienes credenciales asignadas
                </p>
              </>
            )}
          </div>
        ) : (
          filteredCredentials.map((service) => {
            const assignedClient = getClientByCredentialId(
              service.credential_id,
              clients
            );
            const isAssigned = !!assignedClient;

            return (
              <div
                key={service.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1d1d1f',
                      }}
                    >
                      {service.product_name || service.product_code}
                    </h3>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#6b7280',
                    }}
                  >
                    {service.credential_email && (
                      <div>
                        <span style={{ fontWeight: '500' }}>📧 </span>
                        {service.credential_email}
                      </div>
                    )}
                    {service.profile_name && (
                      <div>
                        <span style={{ fontWeight: '500' }}>👤 </span>
                        {service.profile_name}
                      </div>
                    )}
                    {service.expires_at && (
                      <div>
                        <span style={{ fontWeight: '500' }}>📅 </span>
                        Vence: {fmtDate(service.expires_at)}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    {isAssigned ? (
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        ✓ Asignada a <strong>{assignedClient.name}</strong>
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        ✓ Activo
                      </span>
                    )}
                  </div>
                </div>

                {isAssigned ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      marginLeft: '16px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#92400e',
                      }}
                    >
                      📌 Asignada a {assignedClient.name}
                    </span>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => onAssignClick(service)}
                    style={{
                      marginLeft: '16px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Asignar a Cliente
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
