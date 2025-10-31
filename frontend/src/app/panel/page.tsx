
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Tipos básicos
type Service = {
  id: string;
  product_name: string;
  product_code: string;
  status: string;
  expires_at?: string;
  credential_email?: string;
  credential_password?: string;
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
  // Estados principales
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscription, setSubscription] = useState<Subscription>({ status: "active", current_period_end: new Date(Date.now() + 30*24*60*60*1000).toISOString() });
  const [filter, setFilter] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [modalRenewOpen, setModalRenewOpen] = useState(false);
  const [modalSubscriptionOpen, setModalSubscriptionOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastOk, setToastOk] = useState<boolean>(false);

  // Simulación de carga inicial (reemplazar con fetch real)
  useEffect(() => {
    // Aquí iría la carga de datos desde el backend
    setServices([
      {
        id: "1",
        product_name: "Netflix Premium",
        product_code: "NETFLIX",
        status: "active",
        expires_at: "2025-11-14T21:36:00Z",
        credential_email: "demo@netflix.com",
        credential_password: "pass1234",
      },
      {
        id: "2",
        product_name: "Disney+",
        product_code: "DISNEY",
        status: "soon",
        expires_at: "2025-11-01T21:36:00Z",
        credential_email: "demo@disney.com",
        credential_password: "pass5678",
      },
      {
        id: "3",
        product_name: "HBO Max",
        product_code: "HBO",
        status: "expired",
        expires_at: "2025-10-25T21:36:00Z",
        credential_email: "demo@hbo.com",
        credential_password: "pass9999",
      },
    ]);
    setOrders([
      {
        id: "o1",
        order_number: "ORD-001",
        created_at: "2025-10-28T21:36:00Z",
        total_amount: 0.00,
        currency: "USD",
        status: "completed",
        product_name: "Netflix Premium",
        credential_email: "demo@netflix.com",
      },
      {
        id: "o2",
        order_number: "ORD-002",
        created_at: "2025-10-20T21:36:00Z",
        total_amount: 0.00,
        currency: "USD",
        status: "completed",
        product_name: "Disney+",
        credential_email: "demo@disney.com",
      },
    ]);
  }, []);

  // Toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(""), 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Acciones
  const handleRenew = (service: Service) => {
    setSelectedService(service);
    setModalRenewOpen(true);
  };

  const handleCloseRenew = () => {
    setModalRenewOpen(false);
    setSelectedService(null);
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
      <main className="container">
        <header>
        <div className="brand">
          <div className="logoBox">
            <img src="/logo.png" alt="Logo" />
          </div>
          <div>
            <h1 id="tenantName">Panel Mayorista - DEMO</h1>
            <div className="right">
              <span className="tag green">Suscripción: Activa</span>
              <span className="tag">Tienda: No activa</span>
              <span className="tag green">Estado: Activo</span>
            </div>
          </div>
        </div>
        <div className="actions">
          <a className="btn secondary" href="/">Ir a la Tienda</a>
          <button className="btn secondary" onClick={() => router.push("/login")}>Cerrar sesión</button>
        </div>
      </header>

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

      <section id="banners"></section>

      {/* Botones de activación */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "16px 0" }}>
        <div className="card" style={{ textAlign: "center", padding: "24px" }}>
          {subscription.status === "active" ? (
            <>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>✅ Suscripción Activa</h3>
              <p className="muted" style={{ margin: "0 0 8px" }}>Disfrutas de precios preferenciales hasta:</p>
              <p style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#86efac", fontWeight: "600" }}>
                {new Date(subscription.current_period_end || "").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button className="btn secondary" onClick={() => alert("Cancelar suscripción")} style={{ width: "100%" }}>Cancelar Suscripción</button>
            </>
          ) : (
            <>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>🎯 Suscripción Preferencial</h3>
              <p className="muted" style={{ margin: "0 0 16px" }}>Obtén descuentos automáticos en todos los productos del catálogo.</p>
              <button className="btn" onClick={handleSubscription} style={{ width: "100%" }}>Activar Suscripción</button>
              <small className="muted" style={{ display: "block", marginTop: "8px" }}>Desde $7.96/mes con plan semestral</small>
            </>
          )}
        </div>
        <div className="card" style={{ textAlign: "center", padding: "24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>🛍️ Tienda Personalizada</h3>
          <p className="muted" style={{ margin: "0 0 16px" }}>Vende a tus clientes con tu propia marca y dominio personalizado.</p>
          <button className="btn" onClick={() => alert("Próximamente disponible")} style={{ width: "100%", background: "#7c3aed" }}>Activar Mi Tienda</button>
          <small className="muted" style={{ display: "block", marginTop: "8px" }}>Próximamente disponible</small>
        </div>
      </div>

      <div className="grid">
        {/* Servicios */}
        <section className="card">
          <h2>Mis servicios</h2>
          <p className="muted">Gestiona tus cuentas y credenciales activas.</p>
          {/* Buscador */}
          <input type="text" className="search-box" placeholder="🔍 Buscar por cuenta, producto o credencial..." value={search} onChange={handleSearchChange} />
          {searchError && <div className="muted search-error">{searchError}</div>}
          {/* Filtros */}
          <div className="filters">
            <button className={`filter-btn${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>Todos <span className="count">{services.length}</span></button>
            <button className={`filter-btn${filter === "active" ? " active" : ""}`} onClick={() => setFilter("active")}>Activos <span className="count">{services.filter(s => getServiceStatus(s) === "active").length}</span></button>
            <button className={`filter-btn${filter === "soon" ? " active" : ""}`} onClick={() => setFilter("soon")}>Por vencer <span className="count">{services.filter(s => getServiceStatus(s) === "soon").length}</span></button>
            <button className={`filter-btn${filter === "expired" ? " active" : ""}`} onClick={() => setFilter("expired")}>Vencidos <span className="count">{services.filter(s => getServiceStatus(s) === "expired").length}</span></button>
          </div>
          <div className="overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Normal</th>
                  <th>Descuento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {services.filter(s => {
                  const matchSearch = !search || s.product_name.toLowerCase().includes(search.toLowerCase());
                  const sStatus = getServiceStatus(s);
                  const matchFilter = filter === "all" || sStatus === filter;
                  return matchSearch && matchFilter;
                }).map((s, index) => (
                  <tr key={s.id}>
                    <td>{index + 1}</td>
                    <td>{s.product_name}</td>
                    <td><span className={`status ${getServiceStatus(s)}`}>{getServiceStatus(s) === "active" ? "Activo" : getServiceStatus(s) === "soon" ? "Por vencer" : getServiceStatus(s) === "expired" ? "Vencido" : "Cancelado"}</span></td>
                    <td>{fmtDate(s.expires_at)}</td>
                    <td>--</td>
                    <td>--</td>
                    <td>
                      <button className="btn small" onClick={() => handleRenew(s)}>Renovar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Órdenes */}
        <section className="card">
          <h2>Mis órdenes recientes</h2>
          <p className="muted">Historial de compras y renovaciones.</p>
          {/* Filtros de fecha */}
          <div className="filters">
            <button className={`filter-btn${period === "all" ? " active" : ""}`} onClick={() => setPeriod("all")}>Todo</button>
            <button className={`filter-btn${period === "7" ? " active" : ""}`} onClick={() => setPeriod("7")}>7 días</button>
            <button className={`filter-btn${period === "30" ? " active" : ""}`} onClick={() => setPeriod("30")}>30 días</button>
            <button className={`filter-btn${period === "90" ? " active" : ""}`} onClick={() => setPeriod("90")}>3 meses</button>
          </div>
          <div className="overflow-auto">
            <table>
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
                    <td>{o.order_number || o.id}</td>
                    <td>{fmtDate(o.created_at || o.received_at)}</td>
                    <td>{o.currency || "USD"} {o.total_amount?.toFixed(2)}</td>
                    <td><span className="status active">{o.status?.toUpperCase()}</span></td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal Renovación */}
      <Modal open={modalRenewOpen} onClose={handleCloseRenew}>
        {selectedService && (
          <>
            <h2>Renovar Servicio</h2>
            <p className="muted">{selectedService.product_name}</p>
            <div className="renew-box">
              <span>Precio de renovación:</span>
              <span className="renew-price">$9.95</span>
            </div>
            <h3 className="renew-title">Selecciona método de pago:</h3>
            <div className="renew-paygrid">
              <button className="btn" onClick={() => setToastMsg("Redirigiendo a Stripe...")}>💳 Tarjetas</button>
              <button className="btn pay-binance" onClick={() => setToastMsg("Binance Pay en desarrollo")}>Binance Pay</button>
              <button className="btn pay-sinpe" onClick={() => setToastMsg("SINPE en desarrollo")}>SINPE</button>
              <button className="btn pay-wallet" onClick={() => setToastMsg("Billetera en desarrollo")}>Billetera</button>
            </div>
          </>
        )}
      </Modal>

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

        {/* Toast */}
        {toastMsg && (
          <div className={`toast${toastOk ? " ok" : " err"}`}>{toastMsg}</div>
        )}
      </main>
    </div>
  );
}
