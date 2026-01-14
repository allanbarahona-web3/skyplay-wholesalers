'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

interface SuccessRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  onNavigate?: () => void;
}

export default function SuccessRegistrationModal({ 
  isOpen, 
  onClose, 
  email,
  onNavigate
}: SuccessRegistrationModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleGoToCatalog = () => {
    onClose();
    // Ejecutar callback si existe (para autenticación)
    if (onNavigate) {
      onNavigate();
    }
    // Redirigir al catálogo
    router.push('/');
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
      zIndex: 99999,
      padding: '20px',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        padding: '48px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        textAlign: 'center',
        animation: 'slideUp 0.4s ease-out',
      }}>
        {/* Ícono de éxito con animación */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px',
          animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CheckCircle size={48} color="#10b981" strokeWidth={2} />
          </div>
        </div>

        {/* Título */}
        <h2 style={{
          margin: '0 0 12px 0',
          fontSize: '28px',
          fontWeight: '700',
          color: '#1f2937',
          lineHeight: '1.3',
        }}>
          ¡Registro Exitoso!
        </h2>

        {/* Subtítulo */}
        <p style={{
          margin: '0 0 24px 0',
          fontSize: '16px',
          color: '#6b7280',
          lineHeight: '1.6',
        }}>
          Gracias por tu solicitud de mayorista
        </p>

        {/* Contenido */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderLeft: '4px solid #10b981',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '32px',
          textAlign: 'left',
        }}>
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#1f2937',
          }}>
            📧 Confirmación enviada
          </p>
          <p style={{
            margin: '0',
            fontSize: '13px',
            color: '#6b7280',
            wordBreak: 'break-all',
          }}>
            Se ha enviado un correo de confirmación a: <strong>{email}</strong>
          </p>
        </div>

        {/* Mensaje de seguimiento */}
        <div style={{
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '32px',
          border: '1px solid #fcd34d',
        }}>
          <p style={{
            margin: '0',
            fontSize: '13px',
            color: '#78350f',
            lineHeight: '1.6',
          }}>
            <strong>⏱️ Tiempo de respuesta:</strong> Nuestro equipo se contactará contigo en las próximas 24-48 horas para procesar tu solicitud de mayorista.
          </p>
        </div>

        {/* Botón principal */}
        <button
          onClick={handleGoToCatalog}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
            (e.target as HTMLButtonElement).style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.4)';
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
            (e.target as HTMLButtonElement).style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.3)';
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          Ir al Catálogo
        </button>

        {/* Estilos de animación */}
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
