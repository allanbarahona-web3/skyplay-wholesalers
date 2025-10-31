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
  <div className="sinpe-bg">
  <div className="card sinpe-card">
  <h1 className="sinpe-title">💰 Pago por SINPE Móvil</h1>
  <div className="amount sinpe-amount">${amount}</div>
  <div className="info sinpe-info">
          <strong className="sinpe-green">Número para Sinpe Movil CR:</strong> 7006-7572<br />
          <strong className="sinpe-green">A nombre de:</strong> Barmentech SRL
        </div>
  <h3 className="sinpe-steps-title">Pasos a seguir:</h3>
        <div className="step sinpe-step" data-step="1">Abre la app de tu banco en tu celular
          <span className="sinpe-step-num">1</span>
        </div>
        <div className="step sinpe-step" data-step="2">Selecciona "Transferencia SINPE Móvil"
          <span className="sinpe-step-num">2</span>
        </div>
        <div className="step sinpe-step" data-step="3">Ingresa el número: <strong className="sinpe-green">7006-7572</strong>
          <span className="sinpe-step-num">3</span>
        </div>
        <div className="step sinpe-step" data-step="4">Monto: <strong className="sinpe-green">${amount}</strong>
          <span className="sinpe-step-num">4</span>
        </div>
        <div className="step sinpe-step" data-step="5">Confirma el pago y envía el comprobante por whatsapp al <strong className="sinpe-green">+1 (786) 391-8722</strong>
          <span className="sinpe-step-num">5</span>
        </div>
  <button className="btn sinpe-btn" onClick={confirmPayment}>✅ Ya realicé el pago</button>
  <p className="muted sinpe-muted">Tu suscripción se activará o renovará en 5-15 minutos tras verificar el pago.</p>
      </div>
    </div>
  );
}
