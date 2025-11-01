'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import PaymentMethodModal from './PaymentMethodModal';

interface PaymentData {
  service: string;
  plan: string;
  price: number;
}

interface PaymentContextType {
  openPayment: (data: PaymentData) => void;
  closePayment: () => void;
  walletBalance: number;
  refreshWallet: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

// Billetera localStorage helper
const wallet = {
  key: 'sky_wallet',
  get(): number {
    if (typeof window === 'undefined') return 0;
    return parseFloat(localStorage.getItem(this.key) || '0');
  },
  set(v: number) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.key, String(v));
  }
};

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    setWalletBalance(wallet.get());
  }, []);

  const openPayment = (data: PaymentData) => {
    setPaymentData(data);
    setIsOpen(true);
  };

  const closePayment = () => {
    setIsOpen(false);
    setPaymentData(null);
  };

  const refreshWallet = () => {
    setWalletBalance(wallet.get());
  };

  const handlePayment = (method: string) => {
    if (!paymentData) return;

    if (method === 'WALLET') {
      const bal = wallet.get();
      if (bal < paymentData.price) {
        alert('Saldo insuficiente en billetera');
        return;
      }
      wallet.set(bal - paymentData.price);
      setWalletBalance(wallet.get());
      alert(`Pago con saldo realizado: $${paymentData.price.toFixed(2)}`);
      closePayment();
    } else if (method === 'SINPE') {
      // Redirigir a página de instrucciones SINPE con los datos del pago
      const params = new URLSearchParams({
        amount: paymentData.price.toString(),
        service: paymentData.service,
        plan: paymentData.plan
      });
      window.location.href = `/sinpe-payment?${params.toString()}`;
      closePayment();
    } else {
      // Otros métodos de pago (Stripe, PayPal, Binance)
      // TODO: Implementar redirección a procesadores externos
      alert(`Procesando pago ${method} por $${paymentData.price.toFixed(2)} de ${paymentData.service} · ${paymentData.plan}`);
      closePayment();
    }
  };

  const handleWalletRecharge = (amount: number, method: string) => {
    if (method === 'SINPE') {
      // Redirigir a página SINPE para recarga de billetera
      const params = new URLSearchParams({
        amount: amount.toString(),
        service: 'Recarga de Billetera',
        plan: `$${amount} USD`
      });
      window.location.href = `/sinpe-payment?${params.toString()}`;
    } else {
      // Otros métodos de recarga
      // TODO: Implementar redirección a procesadores externos
      alert(`Procesando recarga de $${amount} vía ${method}`);
    }
  };

  return (
    <PaymentContext.Provider value={{ openPayment, closePayment, walletBalance, refreshWallet }}>
      {children}
      {paymentData && (
        <PaymentMethodModal
          isOpen={isOpen}
          onClose={closePayment}
          service={paymentData.service}
          plan={paymentData.plan}
          price={paymentData.price}
          walletBalance={walletBalance}
          onPayment={handlePayment}
          onWalletRecharge={handleWalletRecharge}
        />
      )}
    </PaymentContext.Provider>
  );
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment debe usarse dentro de PaymentProvider');
  }
  return context;
}
