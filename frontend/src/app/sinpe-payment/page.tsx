"use client";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SinpeInstructionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const amount = params.get("amount") || "0.00";
  const plan = params.get("plan") || "monthly";

  const confirmPayment = () => {
    // TODO: Enviar notificación al backend
    alert("¡Gracias! Verificaremos tu pago y activaremos tu suscripción pronto.");
    router.push("/panel");
  };

  return (
    <div className="sinpe-page">
      <div className="card">
        <h1>💰 Pago por SINPE Móvil</h1>
        <div className="amount">${amount}</div>
        
        <div className="info">
          <strong>Número para Sinpe Movil CR:</strong> 7006-7572<br />
          <strong>A nombre de:</strong> Barmentech SRL
        </div>

        <h3 style={{ margin: '24px 0 16px', fontSize: '1.1rem' }}>Pasos a seguir:</h3>
        
        <div className="step" data-step="1">
          Abre la app de tu banco en tu celular
        </div>
        
        <div className="step" data-step="2">
          Selecciona "Transferencia SINPE Móvil"
        </div>
        
        <div className="step" data-step="3">
          Ingresa el número: <strong style={{ color: '#22c55e' }}>7006-7572</strong>
        </div>
        
        <div className="step" data-step="4">
          Monto: <strong style={{ color: '#22c55e' }}>${amount}</strong>
        </div>
        
        <div className="step" data-step="5">
          Confirma el pago y envía el comprobante por whatsapp al <strong style={{ color: '#22c55e' }}>+1 (786) 391-8722</strong>
        </div>

        <button className="btn" onClick={confirmPayment}>✅ Ya realicé el pago</button>

        <p className="muted">Tu suscripción se activará o renovará en 5-15 minutos tras verificar el pago.</p>
      </div>
    </div>
  );
}
