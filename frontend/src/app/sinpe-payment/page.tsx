"use client";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SinpeInstructionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const amount = params.get("amount") || "0.00";
  const service = params.get("service") || "Servicio";
  const plan = params.get("plan") || "Plan";
  const [showSteps, setShowSteps] = React.useState(false);

  const confirmPayment = () => {
    // TODO: Enviar notificación al backend
    alert("¡Gracias! Verificaremos tu pago y activaremos tu suscripción pronto.");
    router.push("/panel");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("¡Copiado al portapapeles!");
  };

  return (
    <div className="sinpe-container">
      <div className="sinpe-content">
        {/* Card principal */}
        <div className="sinpe-card">
          <button className="sinpe-back-btn" onClick={() => router.back()}>
            ← Volver
          </button>
          
          <div className="sinpe-header-content">
            <img src="/OriginalTransparent.png" alt="Skyplay" className="sinpe-logo" />
            <div className="sinpe-icon">📱</div>
            <h1 className="sinpe-title">Pago por SINPE Móvil</h1>
            <p className="sinpe-subtitle">Sigue estos pasos para completar tu pago</p>
          </div>

          {/* Producto/Servicio */}
          <div className="sinpe-product-info">
            <div className="product-name">{service}</div>
            <div className="product-plan">{plan}</div>
          </div>

          {/* Amount destacado */}
          <div className="sinpe-amount-card">
            <span className="amount-label">Monto a transferir</span>
            <div className="amount-value">${amount}</div>
            <span className="amount-currency">USD</span>
          </div>

          {/* Info de destinatario */}
          <div className="sinpe-recipient">
            <h3 className="recipient-title">Información del destinatario</h3>
            <div className="recipient-info">
              <div className="info-row">
                <span className="info-label">Número SINPE</span>
                <div className="info-value-group">
                  <span className="info-value">7006-7572</span>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard("70067572")}
                    title="Copiar número"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="info-row">
                <span className="info-label">Beneficiario</span>
                <span className="info-value">Barmentech SRL</span>
              </div>
            </div>
          </div>

          {/* Pasos colapsables */}
          <div className="sinpe-steps">
            <button 
              className="steps-toggle" 
              onClick={() => setShowSteps(!showSteps)}
            >
              <span className="steps-toggle-title">📋 Instrucciones detalladas</span>
              <span className="steps-toggle-icon">{showSteps ? "−" : "+"}</span>
            </button>
            
            {showSteps && (
              <div className="steps-content">
                <div className="step-item">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4 className="step-title">Abre tu app bancaria</h4>
                    <p className="step-desc">Accede a la aplicación de tu banco en tu celular</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4 className="step-title">Selecciona SINPE Móvil</h4>
                    <p className="step-desc">Busca la opción "Transferencia SINPE Móvil"</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4 className="step-title">Ingresa el número</h4>
                    <p className="step-desc">Escribe <strong>7006-7572</strong> como destinatario</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4 className="step-title">Confirma el monto</h4>
                    <p className="step-desc">Verifica que sea <strong>${amount}</strong> y confirma</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">5</div>
                  <div className="step-content">
                    <h4 className="step-title">Envía el comprobante</h4>
                    <p className="step-desc">
                      Envía captura por WhatsApp al{" "}
                      <a 
                        href="https://wa.me/17863918722" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="whatsapp-link"
                      >
                        +1 (786) 391-8722
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="sinpe-actions">
            <button className="btn-sinpe-primary" onClick={confirmPayment}>
              ✓ Ya realicé el pago
            </button>
            <a 
              href="https://wa.me/17863918722" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-sinpe-whatsapp"
            >
              💬 Contactar por WhatsApp
            </a>
          </div>

          <p className="sinpe-note">
            ⏱️ Tu suscripción se activará en 5-15 minutos tras verificar el pago
          </p>
        </div>
      </div>
    </div>
  );
}
