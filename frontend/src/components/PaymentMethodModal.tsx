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
  originalPrice?: number;
  discount?: number;
}

export default function PaymentMethodModal({
  isOpen,
  onClose,
  service,
  plan,
  price,
  walletBalance,
  onPayment,
  onWalletRecharge,
  originalPrice,
  discount
}: PaymentMethodModalProps) {
  const [selectedTab, setSelectedTab] = useState<'pay' | 'wallet'>('pay');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [rechargeMethod, setRechargeMethod] = useState<string | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>('');

  // Debug y convertir a números por si acaso
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  const numOriginalPrice = originalPrice ? (typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice) : undefined;
  const numDiscount = typeof discount === 'string' ? parseFloat(discount) : discount;
  
  console.log('🎯 PaymentMethodModal received:', { price: numPrice, originalPrice: numOriginalPrice, discount: numDiscount });

  if (!isOpen) return null;

  const handlePayment = () => {
    if (!selectedMethod) {
      alert('Elige un método de pago');
      return;
    }
    onPayment(selectedMethod);
    setSelectedMethod(null);
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    // Para SINPE, redirigir automáticamente
    if (method === 'SINPE') {
      onPayment(method);
    }
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

  const handleRechargeMethodSelect = (method: string) => {
    setRechargeMethod(method);
    // Para SINPE, redirigir automáticamente si hay monto
    if (method === 'SINPE' && rechargeAmount) {
      const amount = parseFloat(rechargeAmount);
      if (!isNaN(amount) && amount >= 1) {
        onWalletRecharge(amount, method);
        setRechargeAmount('');
        setRechargeMethod(null);
      }
    }
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
                onClick={() => handleMethodSelect('SINPE')}
              >
                <div className="payment-icon">📱</div>
                <div className="payment-name">Sinpe Móvil</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'CARD' ? ' selected' : ''}`}
                onClick={() => handleMethodSelect('CARD')}
              >
                <div className="payment-icon">💳</div>
                <div className="payment-name">Tarjetas</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'BINANCE' ? ' selected' : ''}`}
                onClick={() => handleMethodSelect('BINANCE')}
              >
                <div className="payment-icon">🟡</div>
                <div className="payment-name">Binance Pay</div>
              </div>
              <div 
                className={`payment-option${selectedMethod === 'PAYPAL' ? ' selected' : ''}`}
                onClick={() => handleMethodSelect('PAYPAL')}
              >
                <div className="payment-icon">🅿️</div>
                <div className="payment-name">PayPal</div>
              </div>
              <div 
                className={`payment-option payment-wallet${selectedMethod === 'WALLET' ? ' selected' : ''}`}
                onClick={() => handleMethodSelect('WALLET')}
              >
                <div className="payment-icon">💰</div>
                <div className="payment-name">Billetera</div>
                <div className="payment-balance">${walletBalance.toFixed(2)}</div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="price-display">
                {numDiscount && numDiscount > 0 && numOriginalPrice && typeof numOriginalPrice === 'number' ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      <span className="price-label">Precio original:</span>
                      <span style={{ marginLeft: '8px', textDecoration: 'line-through', color: '#ef4444', fontWeight: 'bold' }}>${numOriginalPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="price-label">Total con descuento ({Math.round(numDiscount * 100)}%):</span>
                      <span className="price-amount" style={{ color: '#10b981', marginLeft: '8px' }}>${numPrice.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="price-label">Total</span>
                    <span className="price-amount">${numPrice.toFixed(2)}</span>
                  </div>
                )}
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
                  onClick={() => handleRechargeMethodSelect('SINPE')}
                >
                  📱 SINPE
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'CARD' ? ' selected' : ''}`}
                  onClick={() => handleRechargeMethodSelect('CARD')}
                >
                  💳 Tarjetas
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'BINANCE' ? ' selected' : ''}`}
                  onClick={() => handleRechargeMethodSelect('BINANCE')}
                >
                  🟡 Binance
                </div>
                <div 
                  className={`payment-option-compact${rechargeMethod === 'PAYPAL' ? ' selected' : ''}`}
                  onClick={() => handleRechargeMethodSelect('PAYPAL')}
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
                  {discount && discount > 0 && originalPrice && typeof originalPrice === 'number' ? (
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <span className="price-label">Precio original:</span>
                        <span style={{ marginLeft: '8px', textDecoration: 'line-through', color: '#ef4444', fontWeight: 'bold' }}>${originalPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="price-label">Total con descuento ({Math.round(discount * 100)}%):</span>
                        <span className="price-amount" style={{ color: '#10b981', marginLeft: '8px' }}>${price.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="price-label">Total</span>
                      <span className="price-amount">${price.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <button 
                  className="btn-pay" 
                  onClick={() => onPayment('WALLET')}
                  disabled={walletBalance < price}
                >
                  {walletBalance < price ? 'Saldo insuficiente' : 'Pagar con billetera'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
