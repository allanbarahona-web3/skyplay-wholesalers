
"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";
import { getOrderCredentials } from "@/lib/api";
import { cancelSubscription } from "@/lib/api";
import CredentialsModal from "@/components/CredentialsModal";

// Tipos básicos
type Service = {
  id: string;
  product_name: string;
  product_code: string;
  status: string;
  expires_at?: string;
  created_at?: string;
  credential_email?: string;
  credential_password?: string;
  profile_name?: string;
  pin?: string;
  price?: number; // Precio del producto
  discounted_price?: number; // Precio con descuento aplicado
};

type Order = {
  id: string;
  order_number?: string;
  created_at?: string;
  received_at?: string;
  total_amount?: number;
  currency?: string;
  status?: string;
  product_name?: string;
  credential_email?: string;
};

type Subscription = {
  status: string;
  current_period_end?: string;
  stripe_subscription_id?: string;
};

// Helpers
const fmtDate = (s?: string) => {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
};

function getServiceStatus(s: Service) {
  const status = (s.status || "").toLowerCase();
  const expires = s.expires_at ? new Date(s.expires_at) : null;
  const now = Date.now();
  const hoursLeft = expires ? (expires.getTime() - now) / (1000 * 3600) : 0;
  if (status === "canceled") return "canceled";
  if (status === "expired" || (expires && expires.getTime() < now)) return "expired";
  if (hoursLeft <= 48) return "soon";
  return "active";
}

function isNewService(s: Service): boolean {
  if (!s.created_at) return false;
  const created = new Date(s.created_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
  return diffMinutes <= 30; // Nuevo si fue creado hace menos de 30 minutos
}

// Modales
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className={`modal modal-flex${open ? ' open' : ''}`}>
      <div className="card modal-card">
        <button className="btn secondary modal-close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
}

export default function PanelMayoristaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Estados principales
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscription, setSubscription] = useState<Subscription>({ status: "active", current_period_end: new Date(Date.now() - 5*24*60*60*1000).toISOString() });
  const [crmBasic, setCrmBasic] = useState<any>({ status: "inactive" });
  const [crmPro, setCrmPro] = useState<any>({ status: "inactive" });
  const [filter, setFilter] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>(["subscription"]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [selectedCRMPlan, setSelectedCRMPlan] = useState<string | null>(null);
  const [selectedCRMAmount, setSelectedCRMAmount] = useState<number>(0);
  const [addCRMPlusUpsell, setAddCRMPlusUpsell] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastOk, setToastOk] = useState<boolean>(false);
  
  // Estados para modal de credenciales (callback de pago)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);
  
  // Estado para modal de confirmación de renovación
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalDetails, setRenewalDetails] = useState<any>(null);
  
  // Estado para ver credenciales de servicios existentes
  const [viewingService, setViewingService] = useState<Service | null>(null);

  // Detectar callback de PayPal/Stripe/Wallet
  useEffect(() => {
    const payment = searchParams?.get('payment');
    const orderNumber = searchParams?.get('order');
    const provider = searchParams?.get('provider');
    const orderType = searchParams?.get('type');

    if (payment === 'success' && orderNumber) {
      // Si es una recarga de billetera, solo mostrar toast y refrescar
      if (orderType === 'recharge' && (provider === 'paypal' || provider === 'stripe')) {
        setTimeout(() => {
          loadOverviewData(); // Recargar datos para actualizar el saldo
          setToastMsg('✅ ¡Recarga exitosa! Tu saldo ha sido actualizado.');
          setToastOk(true);
          window.history.replaceState({}, '', '/panel');
        }, 3000); // Esperar 3 segundos para que el webhook procese
        return;
      }

      // Si es una renovación, mostrar confirmación simple
      if (orderType === 'renewal') {
        const serviceId = searchParams?.get('service_id');
        
        // Si es renovación con billetera, es inmediata (sin esperar webhook)
        if (provider === 'wallet' && serviceId) {
          (async () => {
            try {
              // Obtener datos actualizados del servicio
              const response = await fetch('http://localhost:3000/api/me/overview', {
                credentials: 'include',
              });
              
              if (response.ok) {
                const data = await response.json();
                const renewedService = data.active_services?.find((s: any) => s.id === serviceId);
                
                if (renewedService) {
                  setRenewalDetails({
                    credentials: [{
                      email: renewedService.credential_email || '',
                      password: renewedService.credential_password || '',
                      profile_name: renewedService.profile_name || '',
                      pin: renewedService.pin || '',
                      expires_at: renewedService.expires_at || ''
                    }],
                    product_name: renewedService.product_name || renewedService.product_code,
                    message: 'Tu renovación fue exitosa'
                  });
                  setShowRenewalModal(true);
                  
                  // Actualizar estado global
                  loadOverviewData();
                }
              }
            } catch (error) {
              console.error('Error loading service data:', error);
            }
            window.history.replaceState({}, '', '/panel');
          })();
          return;
        }
        
        // Para Stripe/PayPal, esperar webhook
        setTimeout(async () => {
          try {
            // Obtener datos del servicio renovado
            const overviewData = await getOrderCredentials(orderNumber);
            if (overviewData.ok && overviewData.data) {
              setRenewalDetails({
                ...overviewData.data,
                message: 'Tu renovación fue exitosa'
              });
              setShowRenewalModal(true);
              // Recargar servicios
              loadOverviewData();
            }
            window.history.replaceState({}, '', '/panel');
          } catch (error) {
            console.error('Error fetching renewal details:', error);
            setToastMsg('✅ ¡Renovación exitosa!');
            setToastOk(true);
            loadOverviewData();
            window.history.replaceState({}, '', '/panel');
          }
        }, 3000); // Esperar 3 segundos para que el webhook procese
        return;
      }

      // Para compras de productos, mostrar credenciales
      setTimeout(async () => {
        try {
          const result = await getOrderCredentials(orderNumber);
          if (result.ok && result.data) {
            setPurchaseDetails(result.data);
            setShowCredentialsModal(true);
            // Limpiar URL sin recargar
            window.history.replaceState({}, '', '/panel');
          } else {
            setToastMsg('⏳ Tu pedido está siendo procesado. Revisa tu email.');
            setToastOk(false);
          }
        } catch (error) {
          console.error('Error fetching order credentials:', error);
          setToastMsg('⏳ Tu pedido está siendo procesado. Revisa tu email.');
          setToastOk(false);
        }
      }, 2000); // Esperar 2 segundos para que el webhook procese
    }
  }, [searchParams]);

  // Cargar datos reales desde el backend
  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/me/overview', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Error loading data');
      }

      const data = await response.json();
      
      // Cargar servicios activos
      if (data.active_services) {
        console.log('🔍 Frontend received active_services:', data.active_services.slice(0, 1));
        const mappedServices = data.active_services.map((s: any) => {
          const price = typeof s.price === 'string' ? parseFloat(s.price) : (typeof s.price === 'number' ? s.price : 0);
          const discounted_price = typeof s.discounted_price === 'string' ? parseFloat(s.discounted_price) : (typeof s.discounted_price === 'number' ? s.discounted_price : 0);
          console.log(`📦 Service ${s.product_name}: 
            Raw price: "${s.price}" (type: ${typeof s.price}) → Parsed: ${price}
            Raw discounted: "${s.discounted_price}" (type: ${typeof s.discounted_price}) → Parsed: ${discounted_price}`);
          return {
            id: s.id,
            product_name: s.product_name || s.product_code,
            product_code: s.product_code,
            status: s.status,
            expires_at: s.expires_at,
            created_at: s.created_at,
            credential_email: s.credential_email,
            credential_password: s.credential_password,
            profile_name: s.profile_name,
            pin: s.pin,
            price: price,
            discounted_price: discounted_price
          };
        });
        console.log('🔍 Mapped services (first):', mappedServices.slice(0, 1));
        setServices(mappedServices);
      }

      // Cargar órdenes recientes
      if (data.last_orders) {
        setOrders(data.last_orders);
      }

      // Cargar suscripción
      if (data.subscription) {
        setSubscription(data.subscription);
      }

      // Cargar CRM BASIC
      if (data.crm_basic) {
        setCrmBasic(data.crm_basic);
      } else {
        setCrmBasic({ status: "inactive" });
      }

      // Cargar CRM PRO
      if (data.crm_pro) {
        setCrmPro(data.crm_pro);
      } else {
        setCrmPro({ status: "inactive" });
      }
    } catch (error) {
      console.error('Error loading overview data:', error);
      setToastMsg('Error cargando datos');
      setToastOk(false);
    }
  };

  // Toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(""), 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Acciones
  const { openPayment, walletBalance, refreshWallet } = usePayment();

  const handleRenew = async (service: Service) => {
    // Obtener el precio REAL del catálogo para este producto
    try {
      const { getProductPrice } = await import('@/lib/api');
      const response = await getProductPrice(service.product_code);
      
      if (!response.ok || !response.data) {
        throw new Error('Error al obtener precio');
      }
      
      const catalogPrice = parseFloat(response.data.price.toString()) || 0;
      
      // Verificar si tiene suscripción activa para aplicar descuento
      let finalPrice = catalogPrice;
      let discountApplied = 0;
      
      if (subscription.status === 'active' && subscription.current_period_end) {
        const endDate = new Date(subscription.current_period_end);
        if (endDate > new Date()) {
          // Suscripción activa - aplicar 20% descuento
          discountApplied = 0.20;
          finalPrice = catalogPrice * (1 - discountApplied);
        }
      }
      
      console.log('📤 handleRenew sending to openPayment:', { catalogPrice, finalPrice, discountApplied });
      
      openPayment({
        service: service.product_name,
        plan: 'Renovación 1 mes',
        price: finalPrice,
        originalPrice: catalogPrice,
        discount: discountApplied,
        productCode: service.product_code,
        isRenewal: true,
        serviceId: service.id
      });
    } catch (error) {
      console.error('Error al renovar:', error);
      setToastMsg('Error al obtener precio del producto');
      setToastOk(false);
    }
  };

  const handleViewCredentials = (service: Service) => {
    setViewingService(service);
  };

  const toggleAccordion = (key: string) => {
    setExpandedAccordions(prev =>
      prev.includes(key) ? [] : [key]
    );
  };

  const handleSelectPlan = (plan: string, amount: number) => {
    setSelectedPlan(plan);
    setSelectedAmount(amount);
  };

  const handleSelectCRMPlan = (plan: string, amount: number) => {
    setSelectedCRMPlan(plan);
    setSelectedCRMAmount(amount);
  };

  // Validación de búsqueda
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (value.length > 0 && value.length < 3) {
      setSearchError("Ingresa al menos 3 caracteres para buscar");
    } else {
      setSearchError("");
    }
  };

  // Cerrar acordeones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Si el clic es fuera de las tarjetas de acción, cerrar acordeones
      if (!target.closest('.action-card') && expandedAccordions.length > 0) {
        setExpandedAccordions([]);
      }
    };

    // Solo agregar listener si hay acordeones expandidos
    if (expandedAccordions.length > 0) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [expandedAccordions]);

  const handleCancelSubscription = async () => {
    if (!subscription.stripe_subscription_id) {
      setToastMsg('No se encontró suscripción');
      setToastOk(false);
      return;
    }

    if (!confirm('¿Estás seguro de que deseas cancelar tu suscripción? Perderás los descuentos preferenciales.')) {
      return;
    }

    try {
      const result = await cancelSubscription(subscription.stripe_subscription_id);
      if (result.ok) {
        setToastMsg('✅ Suscripción cancelada exitosamente');
        setToastOk(true);
        setSubscription({ status: 'inactive' });
        // Recargar datos después de 2 segundos
        setTimeout(() => {
          loadOverviewData();
        }, 2000);
      } else {
        setToastMsg(`❌ Error: ${result.error}`);
        setToastOk(false);
      }
    } catch (error) {
      setToastMsg('❌ Error al cancelar suscripción');
      setToastOk(false);
    }
  };

  // Render

  return (
    <div id="panel-mayorista">
      {/* Apple-style sticky header */}
      <header className="apple-header">
        <div className="apple-header-content">
          <div className="apple-header-left">
            <img src="/White on Transparent.png" alt="Logo" className="apple-logo" />
            <div className="apple-divider"></div>
            <span className="apple-header-title">Panel Mayorista</span>
          </div>
          
          <div className="apple-header-center">
            <input
              id="q"
              className="apple-search"
              placeholder="Buscar por cuenta, producto o credencial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </div>

          <div className="apple-header-right">
            <div className="apple-wallet">
              💰 ${walletBalance.toFixed(2)}
            </div>
            <button className="apple-btn-link" onClick={() => router.push("/")}>
              <span>🏪</span> Catálogo Mayorista
            </button>
            <button className="apple-btn-link" onClick={() => router.push("/login")}>
              <span>👤</span> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '80px' }}>

      {/* Status badges */}
      <div className="panel-status-bar">
        <div className={`status-badge ${subscription.status === "active" ? "status-active" : "status-inactive"}`}>
          <span className="status-icon">{subscription.status === "active" ? "✓" : "○"}</span>
          <span>Suscripción {subscription.status === "active" ? "Activa" : "Inactiva"}</span>
        </div>
        <div className={`status-badge ${crmBasic.status === "active" ? "status-active" : "status-inactive"}`}>
          <span className="status-icon">{crmBasic.status === "active" ? "✓" : "○"}</span>
          <span>CRM BASIC {crmBasic.status === "active" ? "Activo" : "Inactivo"}</span>
        </div>
        <div className={`status-badge ${crmPro.status === "active" ? "status-active" : "status-inactive"}`}>
          <span className="status-icon">{crmPro.status === "active" ? "✓" : "○"}</span>
          <span>CRM PRO {crmPro.status === "active" ? "Activo" : "Inactivo"}</span>
        </div>
        <div className="status-badge status-inactive">
          <span className="status-icon">○</span>
          <span>Tienda: No activa</span>
        </div>
      </div>

      {/* Ticker animado de anuncios */}
      <div className="ticker-container">
        <div className="ticker-wrapper">
          <div className="ticker">
            <span className="ticker-item">💰 Billetera Virtual: $10 recibe 10% • $25 recibe 20% • $50 recibe 30% • $100 recibe 40%</span>
            <span className="ticker-item">🛍️ ¡Obtén tu propia Tienda Virtual muy pronto en tu Panel Mayorista!</span>
            <span className="ticker-item">⭐ Adquiere tu Suscripción Basic y obtén 30% descuento en todas tus compras</span>
            <span className="ticker-item">🚀 Suscripción Plata: Obtén un CRM para la administración de tus clientes</span>
            <span className="ticker-item">💰 Billetera Virtual: $10 recibe 10% • $25 recibe 20% • $50 recibe 30% • $100 recibe 40%</span>
            <span className="ticker-item">🛍️ ¡Obtén tu propia Tienda Virtual muy pronto en tu Panel Mayorista!</span>
            <span className="ticker-item">⭐ Adquiere tu Suscripción Basic y obtén 30% descuento en todas tus compras</span>
            <span className="ticker-item">🚀 Suscripción Plata: Obtén un CRM para la administración de tus clientes</span>
          </div>
        </div>
      </div>

      {/* Premium action cards */}
      {expandedAccordions.length > 0 && (
        <div 
          className="accordion-overlay"
          onClick={() => setExpandedAccordions([])}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 10,
            cursor: 'pointer'
          }}
        />
      )}
      <div className="panel-action-cards" style={{ position: 'relative', zIndex: expandedAccordions.length > 0 ? 11 : 'auto' }}>
        <div className="action-card">
          {subscription.status === "active" ? (
            <>
              <div className="action-card-icon active">✓</div>
              <h3 className="action-card-title">Suscripción Activa</h3>
              <p className="action-card-desc">Precios preferenciales hasta:</p>
              <p className="action-card-date">
                {new Date(subscription.current_period_end || "").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button className="btn-secondary-full" onClick={handleCancelSubscription}>
                Cancelar Suscripción
              </button>
            </>
          ) : (
            <>
              <div className="action-card-icon">🎯</div>
              <h3 className="action-card-title">Suscripción Preferencial</h3>
              <p className="action-card-desc">Obtén descuentos automáticos en todos los productos streaming.</p>
              <div className="discount-badge">📊 Obtén 20% descuento en Streaming</div>
              <button className="btn-primary-full" onClick={() => toggleAccordion("subscription")}>
                {expandedAccordions.includes("subscription") ? "Ocultar" : "Más información"} {expandedAccordions.includes("subscription") ? "▼" : "▶"}
              </button>
              <p className="action-card-note">Desde $7.96/mes con plan semestral</p>
              
              {expandedAccordions.includes("subscription") && (
                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
                  <h3 className="sub-pay-title">Elige tu plan</h3>
                  <div className="sub-paygrid">
                    <div className={`card sub-card${selectedPlan === "monthly" ? " selected" : ""}`} onClick={() => handleSelectPlan("monthly", 9.95)}>
                      <div className="sub-card-row">
                        <div>
                          <h3 className="sub-card-title">Mensual</h3>
                          <p className="muted sub-card-desc">Pago mes a mes, sin compromiso</p>
                        </div>
                        <div className="sub-card-right">
                          <div className="sub-card-price">$9.95</div>
                          <div className="muted sub-card-mes">/mes</div>
                        </div>
                      </div>
                    </div>
                    <div className={`card sub-card${selectedPlan === "quarterly" ? " selected" : ""}`} onClick={() => handleSelectPlan("quarterly", 26.87)}>
                      <div className="sub-card-row">
                        <div>
                          <h3 className="sub-card-title">3 Meses <span className="sub-card-badge">-10%</span></h3>
                          <p className="muted sub-card-desc">Ahorra $2.98 • $8.96/mes</p>
                        </div>
                        <div className="sub-card-right">
                          <div className="sub-card-price">$26.87</div>
                          <div className="muted sub-card-mes sub-card-old">$29.85</div>
                        </div>
                      </div>
                    </div>
                    <div className={`card sub-card${selectedPlan === "semiannual" ? " selected" : ""}`} onClick={() => handleSelectPlan("semiannual", 47.76)}>
                      <div className="sub-card-best">Mejor valor</div>
                      <div className="sub-card-row">
                        <div>
                          <h3 className="sub-card-title">6 Meses <span className="sub-card-badge">-20%</span></h3>
                          <p className="muted sub-card-desc">Ahorra $11.94 • $7.96/mes</p>
                        </div>
                        <div className="sub-card-right">
                          <div className="sub-card-price">$47.76</div>
                          <div className="muted sub-card-mes sub-card-old">$59.70</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!selectedPlan) {
                        setToastMsg("Selecciona un plan primero");
                        setToastOk(false);
                        return;
                      }
                      
                      // Si tiene checkbox de CRM PLUS marcado, enviar ambos productos
                      if (addCRMPlusUpsell) {
                        openPayment({
                          service: 'Suscripción Preferencial + CRM PLUS',
                          plan: (selectedPlan === 'monthly' ? 'Mensual' : selectedPlan === 'quarterly' ? '3 Meses' : '6 Meses') + ' (Ambos)',
                          price: selectedAmount + 7.50,
                          productCode: 'subscription-pref,crm-basic',
                          isRenewal: false,
                          isSubscription: true,
                          subscriptionType: 'subscription-pref',
                          billingCycle: selectedPlan === 'monthly' ? 'monthly' : selectedPlan === 'quarterly' ? 'quarterly' : 'semiannual'
                        });
                      } else {
                        openPayment({
                          service: 'Suscripción Preferencial',
                          plan: selectedPlan === 'monthly' ? 'Mensual' : selectedPlan === 'quarterly' ? '3 Meses' : '6 Meses',
                          price: selectedAmount,
                          productCode: 'subscription-pref',
                          isRenewal: false,
                          isSubscription: true,
                          subscriptionType: 'subscription-pref',
                          billingCycle: selectedPlan === 'monthly' ? 'monthly' : selectedPlan === 'quarterly' ? 'quarterly' : 'semiannual'
                        });
                      }
                    }}
                    style={{ width: '100%', marginTop: '20px' }}
                  >
                    Continuar al Pago {addCRMPlusUpsell ? `→ $${(selectedAmount + 7.50).toFixed(2)}` : '→'}
                  </button>

                  {selectedPlan && (
                    <div style={{ 
                      marginTop: '20px', 
                      padding: '15px', 
                      backgroundColor: '#f0f9ff', 
                      border: '2px solid #0ea5e9',
                      borderRadius: '8px'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '12px' }}>
                        <input
                          type="checkbox"
                          checked={addCRMPlusUpsell}
                          onChange={(e) => setAddCRMPlusUpsell(e.target.checked)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            accentColor: '#0ea5e9'
                          }}
                        />
                        <div>
                          <p style={{ fontSize: '14px', color: '#0369a1', margin: 0, fontWeight: 'bold' }}>
                            💡 Agregar CRM PLUS
                          </p>
                          <p style={{ fontSize: '12px', color: '#0c4a6e', margin: '4px 0 0 0' }}>
                            Gestiona a tus clientes con herramientas profesionales (+$7.50/mes)
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="action-card">
          <div className="action-card-icon blue">🤖</div>
          <h3 className="action-card-title">CRM</h3>
          <p className="action-card-desc">Gestiona tu base de clientes con herramientas CRM profesionales.</p>
          <div className="discount-badges-row">
            <div className="discount-badge">⭐ CRM PRO: Obtén 25% descuento</div>
          </div>
          <button className="btn-blue-full" onClick={() => toggleAccordion("crm")}>
            {expandedAccordions.includes("crm") ? "Ocultar" : "Más información"} {expandedAccordions.includes("crm") ? "▼" : "▶"}
          </button>
          <p className="action-card-note">Desde $7.50/mes con plan preferencial</p>
          
          {expandedAccordions.includes("crm") && (
            <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
              <div className="sub-paygrid">
                <div className={`card sub-card${selectedCRMPlan === "crm-basic-monthly" ? " selected" : ""}`} onClick={() => handleSelectCRMPlan("crm-basic-monthly", subscription.status === "active" ? 7.50 : 12.50)}>
                  <div className="sub-card-row">
                    <div>
                      <h3 className="sub-card-title">CRM PLUS</h3>
                      <p className="muted sub-card-desc">Historial de clientes + Control de Vencimientos + Notas</p>
                    </div>
                    <div className="sub-card-right">
                      <div className="sub-card-price">
                        {subscription.status === "active" ? "$7.50" : "$12.50"}
                      </div>
                      <div className="muted sub-card-mes">/mes</div>
                    </div>
                  </div>
                </div>
              </div>
              {subscription.status !== "active" && (
                <p className="muted" style={{ fontSize: '12px', marginTop: '12px', marginBottom: '15px', color: '#666', padding: '10px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                  💡 <strong>Promoción:</strong> Activa tu Suscripción Preferencial y Obtendrás CRM PLUS por solo <strong>$7.50/mes</strong>
                </p>
              )}

              <div className="sub-paygrid" style={{ marginTop: "20px" }}>
                <div className={`card sub-card${selectedCRMPlan === "crm-pro-monthly" ? " selected" : ""}`} onClick={() => handleSelectCRMPlan("crm-pro-monthly", 24.95)}>
                  <div className="sub-card-best">Recomendado</div>
                  <div className="sub-card-row">
                    <div>
                      <h3 className="sub-card-title">CRM PRO</h3>
                      <p className="muted sub-card-desc"> Todo lo de Basic + 25% Descuento Streaming + Recordatorios Automáticos SMS/Email + Analytics</p>
                    </div>
                    <div className="sub-card-right">
                      <div className="sub-card-price">$24.95</div>
                      <div className="muted sub-card-mes">/mes</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="muted" style={{ fontSize: '12px', marginTop: '10px', marginBottom: '15px', color: '#666' }}>
                ⭐ Incluye recordatorios automáticos de vencimiento por SMS y Email (no es marketing)
              </p>

              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (!selectedCRMPlan) {
                    setToastMsg("Selecciona un plan CRM primero");
                    setToastOk(false);
                    return;
                  }
                  
                  let crmType = '';
                  if (selectedCRMPlan === 'crm-basic-monthly') {
                    crmType = 'CRM BASIC';
                  } else {
                    crmType = 'CRM PRO';
                  }
                  
                  openPayment({
                    service: crmType,
                    plan: 'Mensual',
                    price: selectedCRMAmount,
                    productCode: selectedCRMPlan === 'crm-basic-monthly' ? 'crm-basic' : 'crm-pro',
                    isRenewal: false
                  });
                }}
                style={{ width: '100%', marginTop: '20px' }}
              >
                Continuar al Pago →
              </button>
            </div>
          )}
        </div>
        <div className="action-card">
          <div className="action-card-icon purple">🛍️</div>
          <h3 className="action-card-title">Tienda Personalizada</h3>
          <p className="action-card-desc">Vende a tus clientes con tu propia marca y dominio personalizado.</p>
          <div className="discount-badge">🏪 Obtén 30% descuento en productos</div>
          <button className="btn-purple-full" onClick={() => alert("Próximamente disponible")}>
            Más información
          </button>
          <p className="action-card-note">Próximamente disponible</p>
        </div>
      </div>

      <div className="panel-grid">
        {/* Servicios */}
        <section className="panel-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Mis servicios</h2>
              <p className="section-desc">Gestiona tus cuentas y credenciales activas.</p>
            </div>
          </div>
          
          {/* Buscador */}
          <div className="search-wrapper">
            <input 
              type="text" 
              className="apple-search" 
              placeholder="Buscar por cuenta, producto o credencial..." 
              value={search} 
              onChange={handleSearchChange} 
            />
          </div>
          {searchError && <div className="search-error-text">{searchError}</div>}
          
          {/* Filtros */}
          <div className="filter-pills">
            <button className={`pill${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
              Todos <span className="pill-count">{services.length}</span>
            </button>
            <button className={`pill${filter === "active" ? " active" : ""}`} onClick={() => setFilter("active")}>
              Activos <span className="pill-count">{services.filter(s => getServiceStatus(s) === "active").length}</span>
            </button>
            <button className={`pill${filter === "soon" ? " active" : ""}`} onClick={() => setFilter("soon")}>
              Por vencer <span className="pill-count">{services.filter(s => getServiceStatus(s) === "soon").length}</span>
            </button>
            <button className={`pill${filter === "expired" ? " active" : ""}`} onClick={() => setFilter("expired")}>
              Vencidos <span className="pill-count">{services.filter(s => getServiceStatus(s) === "expired").length}</span>
            </button>
          </div>
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Normal</th>
                  <th>Descuento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {services.filter(s => {
                  const matchSearch = !search || s.product_name.toLowerCase().includes(search.toLowerCase());
                  const sStatus = getServiceStatus(s);
                  const matchFilter = filter === "all" || sStatus === filter;
                  return matchSearch && matchFilter;
                }).map((s, index) => {
                  const status = getServiceStatus(s);
                  const isNew = isNewService(s);
                  return (
                    <tr key={s.id} style={isNew ? { backgroundColor: '#f0fdf4', animation: 'fadeIn 0.5s' } : {}}>
                      <td className="td-number">{index + 1}</td>
                      <td className="td-product">
                        {s.product_name}
                        {isNew && (
                          <span style={{
                            marginLeft: '8px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            verticalAlign: 'middle',
                            display: 'inline-block',
                            animation: 'pulse 2s infinite'
                          }}>
                            🆕 NUEVO
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${status}`}>
                          {status === "active" ? "Activo" : status === "soon" ? "Por vencer" : status === "expired" ? "Vencido" : "Cancelado"}
                        </span>
                      </td>
                      <td className="td-date">{fmtDate(s.expires_at)}</td>
                      <td className="td-price">${(typeof s.price === 'number' ? s.price : 0).toFixed(2)}</td>
                      <td className="td-price discount">${(typeof s.discounted_price === 'number' ? s.discounted_price : 0).toFixed(2)}</td>
                      <td className="td-action">
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-table" 
                            onClick={() => handleViewCredentials(s)}
                            style={{
                              backgroundColor: '#10b981',
                              border: 'none',
                              padding: '6px 12px',
                              fontSize: '13px'
                            }}
                            title="Ver credenciales"
                          >
                            👁️ Ver
                          </button>
                          <button className="btn-table" onClick={() => handleRenew(s)}>
                            Renovar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Órdenes */}
        <section className="panel-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Mis órdenes recientes</h2>
              <p className="section-desc">Historial de compras y renovaciones.</p>
            </div>
          </div>
          
          {/* Filtros de fecha */}
          <div className="filter-pills">
            <button className={`pill${period === "all" ? " active" : ""}`} onClick={() => setPeriod("all")}>Todo</button>
            <button className={`pill${period === "7" ? " active" : ""}`} onClick={() => setPeriod("7")}>7 días</button>
            <button className={`pill${period === "30" ? " active" : ""}`} onClick={() => setPeriod("30")}>30 días</button>
            <button className={`pill${period === "90" ? " active" : ""}`} onClick={() => setPeriod("90")}>3 meses</button>
          </div>
          
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th style={{ minWidth: '140px' }}>Estado</th>
                  <th>Producto</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => {
                  if (period === "all") return true;
                  const orderDate = new Date(o.created_at || o.received_at || "");
                  const now = Date.now();
                  const daysAgo = (now - orderDate.getTime()) / (1000 * 60 * 60 * 24);
                  return daysAgo <= parseInt(period);
                }).map(o => (
                  <tr key={o.id}>
                    <td className="td-order">{o.order_number || o.id}</td>
                    <td className="td-date">{fmtDate(o.created_at || o.received_at)}</td>
                    <td className="td-price">{o.currency || "USD"} {o.total_amount ? parseFloat(o.total_amount.toString()).toFixed(2) : '0.00'}</td>
                    <td>
                      <span className="badge badge-active">{o.status?.toUpperCase()}</span>
                    </td>
                    <td className="td-muted">{o.product_name || 'Catálogo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal de Credenciales (callback PayPal/Stripe) */}
      {showCredentialsModal && purchaseDetails && (
        <CredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false);
            setPurchaseDetails(null);
            loadOverviewData(); // Recargar datos
          }}
          services={purchaseDetails.credentials.map((cred: any, idx: number) => ({
            id: `temp-${idx}`,
            product_name: purchaseDetails.product_name,
            product_code: purchaseDetails.product_code,
            expires_at: cred.expires_at,
            credentials: {
              email: cred.email,
              password: cred.password,
              profile_name: cred.profile_name,
              pin: cred.pin,
            }
          }))}
          purchaseInfo={{
            product_name: purchaseDetails.product_name,
            total_price: purchaseDetails.total_price,
            discount_applied: purchaseDetails.discount_applied,
          }}
        />
      )}

      {/* Modal de Confirmación de Renovación */}
      {showRenewalModal && renewalDetails && (
        <div className="modal open">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-head">
              <h2 className="modal-title">✅ Renovación Exitosa</h2>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setShowRenewalModal(false);
                  setRenewalDetails(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '30px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✨</div>
              
              <h3 style={{ fontSize: '20px', marginBottom: '10px', color: '#333' }}>
                Tu renovación fue exitosa
              </h3>

              {renewalDetails.credentials && renewalDetails.credentials[0] && (
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: '20px', 
                  borderRadius: '8px',
                  marginTop: '20px',
                  marginBottom: '20px',
                  textAlign: 'left'
                }}>
                  <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                    <strong>Cuenta:</strong> {renewalDetails.credentials[0].email}
                  </p>
                  {renewalDetails.credentials[0].profile_name && (
                    <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                      <strong>Perfil:</strong> {renewalDetails.credentials[0].profile_name}
                    </p>
                  )}
                  <p style={{ marginBottom: '0', fontSize: '14px', color: '#666' }}>
                    <strong>Válido hasta:</strong> {
                      new Date(renewalDetails.credentials[0].expires_at || Date.now() + 30*24*60*60*1000)
                        .toLocaleDateString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric' 
                        })
                    }
                  </p>
                </div>
              )}

              <p style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
                📧 Revisa tu Panel para los detalles de la renovación
              </p>

              <button 
                className="btn-primary-full"
                onClick={() => {
                  setShowRenewalModal(false);
                  setRenewalDetails(null);
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver credenciales de servicios existentes */}
      {viewingService && (
        <CredentialsModal
          isOpen={true}
          onClose={() => setViewingService(null)}
          services={[{
            id: viewingService.id,
            product_name: viewingService.product_name,
            product_code: viewingService.product_code,
            expires_at: viewingService.expires_at || '',
            credentials: {
              email: viewingService.credential_email || '',
              password: viewingService.credential_password || '',
              profile_name: (viewingService as any).profile_name || '',
              pin: (viewingService as any).pin || '',
            }
          }]}
        />
      )}

        {/* Toast */}
        {toastMsg && (
          <div className={`toast${toastOk ? " ok" : " err"}`}>{toastMsg}</div>
        )}
      </main>

      {/* Animaciones para servicios nuevos */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
