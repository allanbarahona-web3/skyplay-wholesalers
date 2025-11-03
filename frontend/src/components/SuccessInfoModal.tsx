'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

interface SuccessInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: string;
}

export default function SuccessInfoModal({ isOpen, onClose, provider }: SuccessInfoModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleGoToPanel = () => {
    onClose();
    router.push('/panel');
  };

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
        padding: '40px 30px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        textAlign: 'center'
      }}>
        {/* Icono de éxito */}
        <div style={{ fontSize: '64px', marginBottom: '20px', animation: 'bounce 0.6s ease-in-out' }}>
          ✅
        </div>

        {/* Título */}
        <h2 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '28px', 
          fontWeight: 'bold', 
          color: '#059669',
          lineHeight: '1.2'
        }}>
          ¡Pago Exitoso!
        </h2>

        {/* Mensaje principal */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px', marginRight: '12px' }}>📧</span>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: '#166534' }}>
                Email en camino
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534', lineHeight: '1.5' }}>
                Tus credenciales serán enviadas a tu correo en los próximos <strong>2 minutos</strong>.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '24px', marginRight: '12px' }}>📊</span>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: '#166534' }}>
                Panel Mayorista
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534', lineHeight: '1.5' }}>
                También puedes verlas en tu panel con un badge <span style={{
                  backgroundColor: '#22c55e',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginLeft: '4px'
                }}>🆕 NUEVO</span>
              </p>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        <p style={{ 
          fontSize: '13px', 
          color: '#6b7280', 
          margin: '0 0 24px 0',
          fontStyle: 'italic'
        }}>
          {provider === 'paypal' ? 'Procesado con PayPal' : provider === 'stripe' ? 'Procesado con Stripe' : 'Pago procesado'}
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={handleGoToPanel}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.2)';
            }}
          >
            Ir al Panel →
          </button>

          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#6b7280',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            Seguir Comprando
          </button>
        </div>

        <style jsx>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    </div>
  );
}
