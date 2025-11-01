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
    } else {
      // Aquí se redirigirá al procesador de pagos (Stripe, PayPal, SINPE, etc.)
      alert(`Procesando pago ${method} por $${paymentData.price.toFixed(2)} de ${paymentData.service} · ${paymentData.plan}`);
      closePayment();
    }
  };

  const handleWalletRecharge = (amount: number, method: string) => {
    // Aquí se procesará la recarga (redirección a procesador)
    alert(`Procesando recarga de $${amount} vía ${method}`);
    // Simulación: agregar saldo (en producción esto vendrá del backend después del pago)
    // wallet.set(wallet.get() + amount);
    // setWalletBalance(wallet.get());
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
