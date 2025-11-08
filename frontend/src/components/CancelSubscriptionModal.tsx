"use client";
import React from 'react';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPause: () => void;
  onCancelAtEnd: () => void;
  onCancelNow: () => void;
  subscriptionEndDate?: string;
  remainingDays?: number;
  // Props genéricos para cualquier tipo de suscripción
  subscriptionType?: 'preferential' | 'crm-basic' | 'crm-pro' | 'tienda';
  subscriptionName?: string;
  benefitDescription?: string;
  discountPercent?: number;
}

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  onPause,
  onCancelAtEnd,
  onCancelNow,
  subscriptionEndDate,
  remainingDays,
  subscriptionType = 'preferential',
  subscriptionName = 'Suscripción Preferencial',
  benefitDescription = 'descuento del 20%',
  discountPercent = 20
}: CancelSubscriptionModalProps) {
  if (!isOpen) return null;

  const endDate = subscriptionEndDate 
    ? new Date(subscriptionEndDate).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : 'la fecha de renovación';

  return (
    <div 
      style={{
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
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 1
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: '700',
            color: '#111827'
          }}>
            Opciones de Cancelación - {subscriptionName}
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            color: '#6b7280',
            fontSize: '0.95rem'
          }}>
            Elige cómo deseas proceder con tu {subscriptionName.toLowerCase()}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          
          {/* Opción 1: PAUSAR */}
          <div style={{
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: '#eff6ff'
          }}
          onClick={onPause}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '2rem' }}>⏸️</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#1e40af'
                }}>
                  Pausar Suscripción
                </h3>
                <p style={{ margin: '0 0 8px 0', color: '#374151', lineHeight: '1.5' }}>
                  Congela tu suscripción sin perder el tiempo restante. Podrás reactivarla cuando quieras.
                </p>
                <div style={{
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  <p style={{ margin: '0 0 6px 0', color: '#059669', fontWeight: '500' }}>✅ Ventajas:</p>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280' }}>
                    <li>Guardamos tus {remainingDays || '~'} días restantes</li>
                    <li>Puedes reactivar en cualquier momento</li>
                    <li>No se te cobra mientras esté pausada</li>
                  </ul>
                  <p style={{ margin: '0 0 6px 0', color: '#dc2626', fontWeight: '500' }}>❌ Desventajas:</p>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280' }}>
                    <li>Pierdes el {benefitDescription} inmediatamente</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Opción 2: CANCELAR AL FINAL */}
          <div style={{
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: '#fffbeb'
          }}
          onClick={onCancelAtEnd}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '2rem' }}>⏰</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#d97706'
                }}>
                  Cancelar al Final del Período
                </h3>
                <p style={{ margin: '0 0 8px 0', color: '#374151', lineHeight: '1.5' }}>
                  Tu suscripción se cancelará el <strong>{endDate}</strong>. Seguirás disfrutando los beneficios hasta entonces.
                </p>
                <div style={{
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  <p style={{ margin: '0 0 6px 0', color: '#059669', fontWeight: '500' }}>✅ Ventajas:</p>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280' }}>
                    <li>Mantienes el {benefitDescription} hasta {endDate}</li>
                    <li>Aprovechas lo que pagaste</li>
                    <li>No se renueva automáticamente</li>
                  </ul>
                  <p style={{ margin: '12px 0 6px 0', color: '#dc2626', fontWeight: '500' }}>❌ Desventajas:</p>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280' }}>
                    <li>Al expirar pierdes acceso</li>
                    <li>Tendrás que suscribirte de nuevo si quieres reactivar</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Opción 3: CANCELAR AHORA */}
          <div style={{
            border: '2px solid #ef4444',
            borderRadius: '8px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: '#fef2f2'
          }}
          onClick={onCancelNow}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '2rem' }}>❌</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#dc2626'
                }}>
                  Cancelar Inmediatamente
                </h3>
                <p style={{ margin: '0 0 8px 0', color: '#374151', lineHeight: '1.5' }}>
                  Cancela tu suscripción ahora mismo y pierde acceso a todos los beneficios de inmediato.
                </p>
                <div style={{
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  <p style={{ margin: '0 0 6px 0', color: '#dc2626', fontWeight: '500' }}>⚠️ Advertencia:</p>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#6b7280' }}>
                    <li>Pierdes el {benefitDescription} inmediatamente</li>
                    <li>Pierdes los {remainingDays || '~'} días restantes que pagaste</li>
                    <li>No hay reembolso por el tiempo no utilizado</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'white'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
