'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import PaymentMethodModal from './PaymentMethodModal';
import CredentialsModal from './CredentialsModal';
import { getOverview, purchaseProduct, createProductCheckout, createSinpeProductCheckout, createPayPalProductCheckout, rechargeWallet } from '@/lib/api';

interface PaymentData {
  service: string;
  plan: string;
  price: number;
  productCode: string;
}

interface PaymentContextType {
  openPayment: (data: PaymentData) => void;
  closePayment: () => void;
  walletBalance: number;
  refreshWallet: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showCredentials, setShowCredentials] = useState(false);
  const [purchasedServices, setPurchasedServices] = useState<any[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);

  useEffect(() => {
    refreshWallet();
  }, []);

  const openPayment = (data: PaymentData) => {
    setPaymentData(data);
    setIsOpen(true);
  };

  const closePayment = () => {
    setIsOpen(false);
    setPaymentData(null);
  };

  const refreshWallet = async () => {
    try {
      const result = await getOverview();
      if (result.ok && result.data) {
        setWalletBalance(result.data.wallet_balance || 0);
      }
    } catch (error) {
      console.error('Error refreshing wallet:', error);
    }
  };

  const handlePayment = async (method: string) => {
    if (!paymentData) return;

    // Detectar si es un producto de créditos (recarga de billetera)
    const isCreditProduct = paymentData.productCode.startsWith('CREDITS_');
    
    if (isCreditProduct) {
      // Si es un producto de créditos, usar el flujo de recarga de billetera
      const amount = paymentData.price;
      await handleWalletRecharge(amount, method);
      return;
    }

    if (method === 'WALLET') {
      try {
        // Comprar con billetera
        const result = await purchaseProduct({
          product_code: paymentData.productCode,
          quantity: 1
        });

        if (result.ok && result.data) {
          const { services, purchase } = result.data;
          
          // Actualizar balance
          setWalletBalance(purchase.new_balance);
          
          // Preparar datos para el modal de credenciales
          setPurchasedServices(services);
          setPurchaseDetails({
            product_name: purchase.product_name,
            total_price: purchase.total_price,
            discount_applied: purchase.discount_applied
          });
          
          // Cerrar modal de pago y mostrar modal de credenciales
          closePayment();
          setShowCredentials(true);
        } else {
          alert(`❌ Error: ${result.error || 'No se pudo procesar la compra'}`);
        }
      } catch (error) {
        console.error('Error purchasing:', error);
        alert('❌ Error al procesar la compra');
      }
    } else if (method === 'CARD') {
      try {
        // Crear checkout de Stripe
        const result = await createProductCheckout({
          product_code: paymentData.productCode,
          quantity: 1
        });

        if (result.ok && result.data) {
          // Redirigir a Stripe Checkout
          window.location.href = result.data.checkout_url;
        } else {
          alert(`❌ Error: ${result.error || 'No se pudo crear el checkout'}`);
        }
      } catch (error) {
        console.error('Error creating checkout:', error);
        alert('❌ Error al crear el checkout');
      }
    } else if (method === 'SINPE') {
      try {
        // Crear orden SINPE
        const result = await createSinpeProductCheckout({
          product_code: paymentData.productCode,
          quantity: 1
        });

        if (result.ok && result.data) {
          // Redirigir a página de instrucciones SINPE
          const params = new URLSearchParams({
            amount: result.data.amount?.toString() || paymentData.price.toString(),
            service: paymentData.service,
            plan: paymentData.plan,
            order: result.data.order_number,
            phone: result.data.instructions?.phone || '8888-8888',
            type: 'purchase'
          });
          window.location.href = `/sinpe-payment?${params.toString()}`;
          closePayment();
        } else {
          alert(`❌ Error: ${result.error || 'No se pudo crear la orden SINPE'}`);
        }
      } catch (error) {
        console.error('Error creating SINPE order:', error);
        alert('❌ Error al crear la orden SINPE');
      }
    } else if (method === 'PAYPAL') {
      try {
        // Crear orden PayPal
        const result = await createPayPalProductCheckout({
          product_code: paymentData.productCode,
          quantity: 1
        });

        if (result.ok && result.data) {
          // Redirigir a PayPal para aprobar el pago
          window.location.href = result.data.approval_url;
          closePayment();
        } else {
          alert(`❌ Error: ${result.error || 'No se pudo crear la orden PayPal'}`);
        }
      } catch (error) {
        console.error('Error creating PayPal order:', error);
        alert('❌ Error al crear la orden PayPal');
      }
    } else {
      // Otros métodos de pago (Binance)
      // TODO: Implementar redirección a procesadores externos
      alert(`Procesando pago ${method} por $${paymentData.price.toFixed(2)} de ${paymentData.service} · ${paymentData.plan}`);
      closePayment();
    }
  };

  const handleWalletRecharge = async (amount: number, method: string) => {
    if (!['CARD', 'SINPE', 'BINANCE'].includes(method)) {
      alert('Método de pago no soportado');
      return;
    }

    try {
      const result = await rechargeWallet({
        amount,
        method: method as 'CARD' | 'SINPE' | 'BINANCE'
      });

      if (result.ok && result.data) {
        if (method === 'SINPE') {
          // Redirigir a página de instrucciones SINPE
          const params = new URLSearchParams({
            amount: amount.toString(),
            service: 'Recarga de Billetera',
            plan: `$${amount} USD`,
            order: result.data.order_number,
            phone: result.data.instructions?.phone || '8888-8888'
          });
          window.location.href = `/sinpe-payment?${params.toString()}`;
        } else if (method === 'BINANCE') {
          alert('Binance Pay: Implementación pendiente');
        } else if (method === 'CARD' && result.data.checkout_url) {
          // Mostrar información del bono antes de redirigir
          const bonus = result.data.bonus_percentage || 0;
          const total = result.data.total_with_bonus || amount;
          if (bonus > 0) {
            alert(
              `🎉 ¡Bono del ${bonus}%!\n\n` +
              `Pagas: $${amount}\n` +
              `Recibes: $${total.toFixed(2)}\n\n` +
              `Procesaremos tu pago...`
            );
          }
          // Cerrar modal antes de redirigir
          closePayment();
          // Redirigir a Stripe
          window.location.href = result.data.checkout_url;
        }
      } else {
        alert(`❌ Error: ${result.error || 'No se pudo procesar la recarga'}`);
      }
    } catch (error) {
      console.error('Error recharging wallet:', error);
      alert('❌ Error al procesar la recarga');
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
      <CredentialsModal
        isOpen={showCredentials}
        onClose={() => setShowCredentials(false)}
        services={purchasedServices}
        purchaseInfo={purchaseDetails}
      />
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
