
"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";
import { getOrderCredentials } from "@/lib/api";
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
    <div className="modal modal-flex">
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
  const [subscription, setSubscription] = useState<Subscription>({ status: "active", current_period_end: new Date(Date.now() + 30*24*60*60*1000).toISOString() });
  const [filter, setFilter] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [modalSubscriptionOpen, setModalSubscriptionOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastOk, setToastOk] = useState<boolean>(false);
  
  // Estados para modal de credenciales (callback de pago)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);
  
  // Estado para ver credenciales de servicios existentes
  const [viewingService, setViewingService] = useState<Service | null>(null);

  // Detectar callback de PayPal/Stripe
  useEffect(() => {
    const payment = searchParams?.get('payment');
    const orderNumber = searchParams?.get('order');
    const provider = searchParams?.get('provider');

    if (payment === 'success' && orderNumber && (provider === 'paypal' || provider === 'stripe')) {
      // Esperar un momento para que el webhook procese
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
        const mappedServices = data.active_services.map((s: any) => ({
          id: s.id,
          product_name: s.product_name || s.product_code,
          product_code: s.product_code,
          status: s.status,
          expires_at: s.expires_at,
          created_at: s.created_at,
          credential_email: s.credential_email,
          credential_password: s.credential_password,
          profile_name: s.profile_name,
          pin: s.pin
        }));
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
  const { openPayment } = usePayment();

  const handleRenew = (service: Service) => {
    // Usar el modal global de pagos
    openPayment({
      service: service.product_name,
      plan: 'Renovación 1 mes',
      price: 7.95, // Precio con descuento
      productCode: service.product_code
    });
  };

  const handleViewCredentials = (service: Service) => {
    setViewingService(service);
  };

  const handleSubscription = () => {
    setModalSubscriptionOpen(true);
  };
  const handleCloseSubscription = () => {
    setModalSubscriptionOpen(false);
    setSelectedPlan(null);
    setSelectedAmount(0);
  };

  const handleSelectPlan = (plan: string, amount: number) => {
    setSelectedPlan(plan);
    setSelectedAmount(amount);
  };

  const handleProcessPayment = (method: string) => {
    if (!selectedPlan) {
      setToastMsg("Selecciona un plan primero");
      setToastOk(false);
      return;
    }
    if (method === "card") {
      setToastMsg("Redirigiendo a Stripe...");
      setToastOk(true);
      setTimeout(() => {
        handleCloseSubscription();
      }, 1000);
    } else {
      setToastMsg(`Método ${method.toUpperCase()} en desarrollo`);
      setToastOk(false);
      handleCloseSubscription();
    }
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
          <div className="apple-header-right">
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
        <div className="status-badge status-active">
          <span className="status-icon">✓</span>
          <span>Suscripción Activa</span>
        </div>
        <div className="status-badge status-inactive">
          <span className="status-icon">○</span>
          <span>Tienda: No activa</span>
        </div>
        <div className="status-badge status-active">
          <span className="status-icon">✓</span>
          <span>Estado: Activo</span>
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
      <div className="panel-action-cards">
        <div className="action-card">
          {subscription.status === "active" ? (
            <>
              <div className="action-card-icon active">✓</div>
              <h3 className="action-card-title">Suscripción Activa</h3>
              <p className="action-card-desc">Precios preferenciales hasta:</p>
              <p className="action-card-date">
                {new Date(subscription.current_period_end || "").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button className="btn-secondary-full" onClick={() => alert("Cancelar suscripción")}>
                Cancelar Suscripción
              </button>
            </>
          ) : (
            <>
              <div className="action-card-icon">🎯</div>
              <h3 className="action-card-title">Suscripción Preferencial</h3>
              <p className="action-card-desc">Obtén descuentos automáticos en todos los productos del catálogo.</p>
              <button className="btn-primary-full" onClick={handleSubscription}>
                Activar Suscripción
              </button>
              <p className="action-card-note">Desde $7.96/mes con plan semestral</p>
            </>
          )}
        </div>
        <div className="action-card">
          <div className="action-card-icon purple">🛍️</div>
          <h3 className="action-card-title">Tienda Personalizada</h3>
          <p className="action-card-desc">Vende a tus clientes con tu propia marca y dominio personalizado.</p>
          <button className="btn-purple-full" onClick={() => alert("Próximamente disponible")}>
            Activar Mi Tienda
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
          <div className="table-container">
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
                      <td className="td-price">$9.95</td>
                      <td className="td-price discount">$7.95</td>
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
          
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Origen</th>
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
                    <td className="td-muted">Catálogo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal Suscripción Preferencial */}
      <Modal open={modalSubscriptionOpen} onClose={handleCloseSubscription}>
        <h2>🎯 Activar Suscripción Preferencial</h2>
        <p className="muted">Elige tu plan y obtén descuentos en todos los productos del catálogo.</p>
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
        <h3 className="sub-pay-title">Selecciona método de pago:</h3>
        <div className="sub-paygrid">
          <button className="btn" onClick={() => handleProcessPayment("card")}>💳 Tarjetas</button>
          <button className="btn pay-binance" onClick={() => handleProcessPayment("binance")}>Binance Pay</button>
          <button className="btn pay-paypal" onClick={() => handleProcessPayment("paypal")}>PayPal</button>
          <button className="btn pay-sinpe" onClick={() => handleProcessPayment("sinpe")}>SINPE Móvil</button>
        </div>
      </Modal>

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
