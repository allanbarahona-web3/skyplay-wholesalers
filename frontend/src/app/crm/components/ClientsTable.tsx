'use client';

import React from 'react';
import { CRMClient, Service } from '../types';
import {
  fmtDate,
  isServiceActive,
  getDaysUntilExpiry,
  getServiceByCredentialId,
} from '../utils/helpers';

interface ClientsTableProps {
  clients: CRMClient[];
  services: Service[];
  searchText: string;
  onEdit: (client: CRMClient) => void;
  onDelete: (clientId: string) => void;
  onAddNew: () => void;
}

export const ClientsTable: React.FC<ClientsTableProps> = ({
  clients,
  services,
  searchText,
  onEdit,
  onDelete,
  onAddNew,
}) => {
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.email.toLowerCase().includes(searchText.toLowerCase()) ||
      (c.phone && c.phone.includes(searchText))
  );

  if (filteredClients.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f5f5f7',
          borderRadius: '12px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#1d1d1f' }}>
          Sin clientes aún
        </h3>
        <p style={{ color: '#86868b', marginBottom: '20px' }}>
          {searchText
            ? 'No se encontraron resultados'
            : 'Comienza agregando tu primer cliente'}
        </p>
        {!searchText && (
          <button className="btn btn-primary" onClick={onAddNew}>
            ➕ Agregar Cliente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="table-container" style={{ maxHeight: '700px', overflowY: 'auto' }}>
      <table className="premium-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Servicio</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredClients.map((client, idx) => {
            const assignedService = getServiceByCredentialId(
              client.credential_id,
              services
            );
            const daysLeft = getDaysUntilExpiry(assignedService?.expires_at);
            let expiryStatus = 'active';
            if (daysLeft !== null && daysLeft <= 0) expiryStatus = 'expired';
            else if (daysLeft !== null && daysLeft <= 5) expiryStatus = 'soon';

            return (
              <tr key={client.id}>
                <td className="td-number">{idx + 1}</td>
                <td className="td-product" title={client.notes}>
                  {client.name}
                </td>
                <td className="td-muted">{client.email}</td>
                <td className="td-muted">{client.phone || '—'}</td>
                <td className="td-date">
                  {assignedService ? (
                    <div>
                      <div style={{ fontWeight: '500' }}>
                        {assignedService.product_name}
                      </div>
                      {assignedService.profile_name && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {assignedService.profile_name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  )}
                </td>
                <td className="td-date">
                  {assignedService?.expires_at
                    ? fmtDate(assignedService.expires_at)
                    : '—'}
                </td>
                <td>
                  {assignedService?.expires_at && (
                    <span className={`badge badge-${expiryStatus}`}>
                      {expiryStatus === 'expired'
                        ? '⏰ Vencido'
                        : expiryStatus === 'soon'
                          ? `⚠️ ${daysLeft}d`
                          : `✓ ${daysLeft}d`}
                    </span>
                  )}
                </td>
                <td className="td-action">
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      className="btn-table"
                      onClick={() => onEdit(client)}
                      title="Editar cliente"
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn-table"
                      onClick={() => onDelete(client.id)}
                      style={{
                        backgroundColor: '#ff3b30',
                        color: 'white',
                        padding: '4px 10px',
                        fontSize: '12px',
                      }}
                      title="Eliminar cliente"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
