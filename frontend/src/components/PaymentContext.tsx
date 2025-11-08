'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import PaymentMethodModal from './PaymentMethodModal';
import CredentialsModal from './CredentialsModal';
import { getOverview, purchaseProduct, createProductCheckout, createSinpeProductCheckout, createPayPalProductCheckout, rechargeWallet, rechargeWalletPayPal, renewFromWallet, createRenewalCheckout, initiateRenewal, createSubscriptionCheckout, createSubscriptionPayPalCheckout, createSubscriptionSinpeCheckout, createSubscriptionWalletCheckout } from '@/lib/api';

interface PaymentData {
  service: string;
  plan: string;
  price: number;
  productCode: string;
  isRenewal?: boolean; // Para identificar renovaciones
  serviceId?: string; // ID del servicio a renovar
  isSubscription?: boolean; // Para identificar suscripciones
  subscriptionType?: string; // 'subscription-pref', 'crm-basic', 'crm-pro', 'tienda'
  billingCycle?: string; // 'monthly', 'quarterly', 'semiannual'
  originalPrice?: number; // Precio sin descuento
  discount?: number; // Descuento aplicado
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
  const [userSubscription, setUserSubscription] = useState<any>(null); // Suscripción del usuario

  useEffect(() => {
    refreshWallet();
  }, []);

  const openPayment = (data: PaymentData) => {
    // Si ya viene originalPrice y discount precalculado (ej: renovaciones), usarlos
    if (data.originalPrice !== undefined && data.discount !== undefined) {
      setPaymentData({
        ...data,
        originalPrice: data.originalPrice,
        price: data.price,
        discount: data.discount
      });
      setIsOpen(true);
      return;
    }
    
    // Calcular descuento si el usuario tiene suscripción activa
    let finalPrice = data.price;
    let discountApplied = 0;
    
    if (userSubscription && userSubscription.status === 'active' && userSubscription.current_period_end) {
      const endDate = new Date(userSubscription.current_period_end);
      if (endDate > new Date()) {
        // Suscripción activa, verificar si es categoría IPTV o Streaming
        // Por ahora, asumimos que es Netflix/Streaming y aplicamos 20% descuento
        discountApplied = 0.20;
        finalPrice = data.price * (1 - discountApplied);
      }
    }
    
    setPaymentData({
      ...data,
      originalPrice: data.price,
      price: finalPrice,
      discount: discountApplied
    });
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
        // También cargar la suscripción del usuario
        if (result.data.subscription) {
          setUserSubscription(result.data.subscription);
        }
      }
    } catch (error) {
      console.error('Error refreshing wallet:', error);
    }
  };

  const handlePayment = async (method: string) => {
    if (!paymentData) return;

    // Detectar si es una suscripción
    const isSubscription = paymentData.isSubscription;
    if (isSubscription && paymentData.subscriptionType && paymentData.billingCycle) {
      await handleSubscriptionPayment(method, paymentData);
      return;
    }

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
        // Si es renovación, usar endpoint específico de renovación
        if (paymentData.isRenewal && paymentData.serviceId) {
          const result = await renewFromWallet(paymentData.serviceId);
          
          if (result.ok && result.data) {
            // Actualizar balance (renovación consume del balance)
            await refreshWallet();
            
            closePayment();
            // Redirigir al panel con parámetros para mostrar modal de renovación
            const orderNumber = `WALLET-RENEW-${Date.now()}`;
            window.location.href = `/panel?payment=success&type=renewal&order=${orderNumber}&provider=wallet&service_id=${paymentData.serviceId}`;
            return;
          } else {
            alert(`❌ Error: ${result.error || 'No se pudo procesar la renovación'}`);
            return;
          }
        }
        
        // Compra normal con billetera
        const result = await purchaseProduct({
          product_code: paymentData.productCode,
          quantity: 1
        });

        if (result.ok && result.data) {
          const { services, purchase } = result.data;
          
          // Actualizar balance
          setWalletBalance(purchase.new_balance);
          
          // Preparar datos para el modal de credenciales (compra normal)
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
        // Si es renovación, primero iniciar renovación y luego crear checkout
        if (paymentData.isRenewal && paymentData.serviceId) {
          // Paso 1: Crear billing_event de renovación
          const renewResult = await initiateRenewal(paymentData.serviceId);
          
          if (!renewResult.ok || !renewResult.data) {
            alert(`❌ Error: ${renewResult.error || 'No se pudo iniciar la renovación'}`);
            return;
          }
          
          // Paso 2: Crear checkout de Stripe
          const checkoutResult = await createRenewalCheckout(paymentData.serviceId, 'stripe');
          
          if (checkoutResult.ok && checkoutResult.data) {
            window.location.href = checkoutResult.data.checkout_url!;
          } else {
            alert(`❌ Error: ${checkoutResult.error || 'No se pudo crear el checkout de renovación'}`);
          }
          return;
        }
        
        // Compra normal
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
        // Si es renovación, primero iniciar renovación y luego crear checkout
        if (paymentData.isRenewal && paymentData.serviceId) {
          // Paso 1: Crear billing_event de renovación
          const renewResult = await initiateRenewal(paymentData.serviceId);
          
          if (!renewResult.ok || !renewResult.data) {
            alert(`❌ Error: ${renewResult.error || 'No se pudo iniciar la renovación'}`);
            return;
          }
          
          // Paso 2: Crear orden de PayPal
          const result = await createRenewalCheckout(paymentData.serviceId, 'paypal');
          
          if (result.ok && result.data) {
            window.location.href = result.data.approval_url!;
            closePayment();
          } else {
            alert(`❌ Error: ${result.error || 'No se pudo crear la orden de renovación'}`);
          }
          return;
        }
        
        // Compra normal
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

  const handleSubscriptionPayment = async (method: string, data: PaymentData) => {
    if (!data.subscriptionType || !data.billingCycle) {
      alert('Datos de suscripción incompletos');
      return;
    }

    try {
      let result;

      if (method === 'WALLET') {
        // Billetera: procesar de inmediato
        const checkoutData = {
          subscriptionType: data.subscriptionType,
          billingCycle: data.billingCycle,
          price: data.price
        };
        result = await createSubscriptionWalletCheckout(checkoutData);
        
        if (result.ok && result.data?.order_number) {
          alert(`✅ ${result.data.message}`);
          closePayment();
          // Recargar datos después de 2 segundos
          setTimeout(() => {
            window.location.href = '/panel?payment=success&type=subscription&provider=wallet';
          }, 1500);
          return;
        }
      } else if (method === 'CARD') {
        // Stripe
        const checkoutData = {
          subscriptionType: data.subscriptionType,
          billingCycle: data.billingCycle,
          price: data.price
        };
        result = await createSubscriptionCheckout(checkoutData);
        
        if (result.ok && result.data?.checkout_url) {
          closePayment();
          window.location.href = result.data.checkout_url;
          return;
        }
      } else if (method === 'PAYPAL') {
        // PayPal
        const checkoutData = {
          subscriptionType: data.subscriptionType,
          billingCycle: data.billingCycle,
          price: data.price
        };
        result = await createSubscriptionPayPalCheckout(checkoutData);
        
        if (result.ok && result.data?.approval_url) {
          closePayment();
          window.location.href = result.data.approval_url;
          return;
        }
      } else if (method === 'SINPE') {
        // SINPE
        const checkoutData = {
          subscriptionType: data.subscriptionType,
          billingCycle: data.billingCycle,
          price: data.price
        };
        result = await createSubscriptionSinpeCheckout(checkoutData);
        
        if (result.ok && result.data?.order_number) {
          const params = new URLSearchParams({
            amount: data.price.toString(),
            service: data.service,
            plan: data.plan,
            order: result.data.order_number,
            phone: result.data.instructions?.phone || '8888-8888',
            type: 'subscription'
          });
          closePayment();
          window.location.href = `/sinpe-payment?${params.toString()}`;
          return;
        }
      }

      // Si llegamos aquí, hubo un error
      alert(`❌ Error: ${result?.error || 'No se pudo procesar la suscripción'}`);
    } catch (error) {
      console.error('Error en handleSubscriptionPayment:', error);
      alert('❌ Error al procesar el pago de suscripción');
    }
  };

  const handleWalletRecharge = async (amount: number, method: string) => {
    if (!['CARD', 'SINPE', 'BINANCE', 'PAYPAL'].includes(method)) {
      alert('Método de pago no soportado');
      return;
    }

    try {
      // Si es PayPal, usar endpoint específico
      if (method === 'PAYPAL') {
        const result = await rechargeWalletPayPal({ amount });
        
        if (result.ok && result.data) {
          // Mostrar información del bono antes de redirigir
          const bonus = result.data.bonus_percentage || 0;
          const total = result.data.total_with_bonus || amount;
          if (bonus > 0) {
            alert(
              `🎉 ¡Bono del ${bonus}%!\n\n` +
              `Pagas: $${amount}\n` +
              `Recibes: $${total.toFixed(2)}\n\n` +
              `Redirigiendo a PayPal...`
            );
          }
          // Cerrar modal antes de redirigir
          closePayment();
          // Redirigir a PayPal
          window.location.href = result.data.approval_url;
        } else {
          alert(`❌ Error: ${result.error || 'No se pudo procesar la recarga con PayPal'}`);
        }
        return;
      }

      // Para otros métodos (CARD, SINPE, BINANCE)
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
            phone: result.data.instructions?.phone || '8888-8888',
            type: 'recharge'
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
          originalPrice={paymentData.originalPrice}
          discount={paymentData.discount}
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
