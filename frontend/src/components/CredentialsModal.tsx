'use client';
import React, { useState } from 'react';

interface Credential {
  email: string;
  password: string;
  profile_name?: string;
  pin?: string;
}

interface Service {
  id: string;
  product_name: string;
  product_code: string;
  expires_at: string;
  credentials: Credential;
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  purchaseInfo?: {
    product_name: string;
    total_price: number;
    discount_applied?: number;
  };
}

export default function CredentialsModal({ isOpen, onClose, services, purchaseInfo }: CredentialsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || services.length === 0) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const service = services[0]; // Por ahora solo mostramos el primero
  const creds = service.credentials;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        padding: '30px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
            ¡Compra Exitosa!
          </h2>
          {purchaseInfo && (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              {purchaseInfo.product_name} • ${purchaseInfo.total_price.toFixed(2)}
              {purchaseInfo.discount_applied && purchaseInfo.discount_applied > 0 && (
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                  {' '}({purchaseInfo.discount_applied}% descuento)
                </span>
              )}
            </p>
          )}
        </div>

        {/* Credenciales */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
            Tus Credenciales
          </h3>

          {/* Email */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
              Email / Usuario
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={creds.email}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  backgroundColor: 'white'
                }}
              />
              <button
                onClick={() => copyToClipboard(creds.email, 'email')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: copiedField === 'email' ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                {copiedField === 'email' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
              Contraseña
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={creds.password}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  backgroundColor: 'white'
                }}
              />
              <button
                onClick={() => copyToClipboard(creds.password, 'password')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: copiedField === 'password' ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                {copiedField === 'password' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Profile Name (si existe) */}
          {creds.profile_name && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                Perfil
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={creds.profile_name}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: 'white'
                  }}
                />
                <button
                  onClick={() => copyToClipboard(creds.profile_name!, 'profile')}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: copiedField === 'profile' ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {copiedField === 'profile' ? '✓' : '📋'}
                </button>
              </div>
            </div>
          )}

          {/* PIN (si existe) */}
          {creds.pin && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                PIN
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={creds.pin}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: 'white'
                  }}
                />
                <button
                  onClick={() => copyToClipboard(creds.pin!, 'pin')}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: copiedField === 'pin' ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {copiedField === 'pin' ? '✓' : '📋'}
                </button>
              </div>
            </div>
          )}

          {/* Expira */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              ⏰ Expira el: <strong>{new Date(service.expires_at).toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}</strong>
            </p>
          </div>
        </div>

        {/* Info adicional */}
        <div style={{
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#1e40af'
        }}>
          💡 <strong>Tip:</strong> Guarda estas credenciales en un lugar seguro. También las puedes ver en cualquier momento en tu Panel Mayorista.
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              window.location.href = '/panel';
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Ver Panel Mayorista
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
