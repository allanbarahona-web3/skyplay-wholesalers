'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { usePayment } from '@/components/PaymentContext';
import { UserSubscription } from '../types';

interface AccessDeniedProps {
  subscription: UserSubscription | null;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ subscription }) => {
  const { openPayment } = usePayment();
  const router = useRouter();

  return (
    <div
      style={{
        paddingTop: '80px',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '500px',
          textAlign: 'center',
          padding: '40px',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#1d1d1f' }}>
          Acceso no autorizado
        </h2>
        <p style={{ color: '#86868b', marginBottom: '20px' }}>
          Para acceder al CRM necesitas tener activo:
        </p>
        <ul
          style={{
            textAlign: 'left',
            color: '#86868b',
            marginBottom: '20px',
            lineHeight: '1.8',
          }}
        >
          <li>✅ Suscripción Preferencial (incluye CRM PLUS gratis), o</li>
          <li>✅ CRM PLUS individual, o</li>
          <li>✅ CRM PRO</li>
        </ul>
        <p style={{ color: '#999', fontSize: '12px', marginBottom: '15px' }}>
          {subscription
            ? `Estado actual: ${JSON.stringify({
                subscription: subscription.subscription?.status,
                crm_basic: subscription.crm_basic?.status,
                crm_pro: subscription.crm_pro?.status,
              })}`
            : 'Cargando datos...'}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => openPayment()}
          style={{ marginRight: '8px' }}
        >
          💳 Adquirir CRM PLUS
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => router.push('/')}
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
};
