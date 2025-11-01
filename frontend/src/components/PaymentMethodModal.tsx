'use client';
import React, { useState } from 'react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: string;
  plan: string;
  price: number;
  walletBalance: number;
  onPayment: (method: string) => void;
  onWalletRecharge: (amount: number, method: string) => void;
}

export default function PaymentMethodModal({
  isOpen,
  onClose,
  service,
  plan,
  price,
  walletBalance,
  onPayment,
  onWalletRecharge
}: PaymentMethodModalProps) {
  const [selectedTab, setSelectedTab] = useState<'pay' | 'wallet'>('pay');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [rechargeMethod, setRechargeMethod] = useState<string | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>('');

  if (!isOpen) return null;

  const handlePayment = () => {
    if (!selectedMethod) {
      alert('Elige un método de pago');
      return;
    }
    onPayment(selectedMethod);
    setSelectedMethod(null);
  };

  const handleRecharge = () => {
    if (!rechargeMethod || !rechargeAmount) {
      alert('Ingresa monto y método de recarga');
      return;
    }
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount < 1) {
      alert('Monto inválido');
      return;
    }
    onWalletRecharge(amount, rechargeMethod);
    setRechargeAmount('');
    setRechargeMethod(null);
  };

  return (
    <div className="modal open">
      <div className="modal-content">
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Comprar</h2>
            <p className="modal-subtitle">{service} · {plan}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`modal-tab${selectedTab === 'pay' ? ' active' : ''}`} 
            onClick={() => setSelectedTab('pay')}
          >
            Pagar ahora
          </button>
          <button 
            className={`modal-tab${selectedTab === 'wallet' ? ' active' : ''}`} 
            onClick={() => setSelectedTab('wallet')}
          >
            Billetera
          </button>
        </div>

        {selectedTab === 'pay' && (
          <div id="tab-pay" className="modal-tab-content">
            <h3 className="modal-section-title">Método de pago</h3>
            <div className="payment-grid">
              <div 
                className={`payment-option${selectedMethod === 'SINPE' ? ' selected' : ''}`}
                onClick={() => setSelectedMethod('SINPE')}
              >
                <div className="payment-icon">📱</div>
                <div className="payment-name">Sinpe Móvil</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'CARD' ? ' selected' : ''}`}
                onClick={() => setSelectedMethod('CARD')}
              >
                <div className="payment-icon">💳</div>
                <div className="payment-name">Tarjetas</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'BINANCE' ? ' selected' : ''}`}
                onClick={() => setSelectedMethod('BINANCE')}
              >
                <div className="payment-icon">🟡</div>
                <div className="payment-name">Binance Pay</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'PAYPAL' ? ' selected' : ''}`}
                onClick={() => setSelectedMethod('PAYPAL')}
              >
                <div className="payment-icon">🅿️</div>
                <div className="payment-name">PayPal</div>
              </div>
              <div 
                className={`payment-option payment-wallet${selectedMethod === 'WALLET' ? ' selected' : ''}`}
                onClick={() => setSelectedMethod('WALLET')}
              >
                <div className="payment-icon">💰</div>
                <div className="payment-name">Billetera</div>
                <div className="payment-balance">${walletBalance.toFixed(2)}</div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="price-display">
                <span className="price-label">Total</span>
                <span className="price-amount">${price.toFixed(2)}</span>
              </div>
              <button className="btn-pay" onClick={handlePayment}>Pagar</button>
            </div>
          </div>
        )}

        {selectedTab === 'wallet' && (
          <div id="tab-wallet" className="modal-tab-content">
            <div className="wallet-balance-card">
              <div className="wallet-label">Saldo disponible</div>
              <div className="wallet-amount">${walletBalance.toFixed(2)}</div>
            </div>
            
            <div className="wallet-section">
              <h3 className="modal-section-title">Recargar billetera</h3>
              <input 
                type="number" 
                className="modal-input" 
                placeholder="Monto en USD" 
                min="1"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
              />
              <div className="payment-grid compact">
                <div 
                  className={`payment-option-compact${rechargeMethod === 'SINPE' ? ' selected' : ''}`}
                  onClick={() => setRechargeMethod('SINPE')}
                >
                  📱 SINPE
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'CARD' ? ' selected' : ''}`}
                  onClick={() => setRechargeMethod('CARD')}
                >
                  💳 Tarjetas
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'BINANCE' ? ' selected' : ''}`}
                  onClick={() => setRechargeMethod('BINANCE')}
                >
                  🟡 Binance
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'PAYPAL' ? ' selected' : ''}`}
                  onClick={() => setRechargeMethod('PAYPAL')}
                >
                  🅿️ PayPal
                </div>
              </div>
              <button 
                className={`btn-secondary-full${rechargeMethod ? ' active' : ''}`}
                onClick={handleRecharge}
              >
                Recargar
              </button>
            </div>
            
            <div className="wallet-section">
              <h3 className="modal-section-title">Pagar con saldo</h3>
              <div className="modal-footer">
                <div className="price-display">
                  <span className="price-label">Total</span>
                  <span className="price-amount">${price.toFixed(2)}</span>
                </div>
                <button className="btn-pay" onClick={handlePayment}>Pagar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
