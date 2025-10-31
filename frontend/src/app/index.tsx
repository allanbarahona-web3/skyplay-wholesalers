"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

const BRAND: Record<string, string> = {
  Disney: "#113CCF",
  VIX: "#FF5C00",
  Crunchyroll: "#F47521",
  MAX: "#7c3aed",
  Netflix: "#E50914",
  Paramount: "#0057B8",
  FlujoTV: "#00ADEF",
  MagisTV: "#22c55e",
  "Tele Latino": "#14b8a6",
  "Créditos": "#22c55e",
};

const DATA = [
  { svc: "Créditos", note: "Recarga con bono automático", plans: ["10 Créditos (+10%)", "25 Créditos (+20%)", "50 Créditos (+30%)", "100 Créditos (+40%)"] },
  { svc: "Disney", plans: ["Básico", "Estándar"] },
  { svc: "VIX", plans: ["1 Mes", "Anual", "Perfil 30"] },
  { svc: "Crunchyroll", plans: ["1 Mes", "Anual", "Perfil 30"] },
  { svc: "MAX", plans: ["Basic", "Standard", "Perfil 30"] },
  { svc: "Netflix", plans: ["Basic", "Standard", "Premium"] },
  { svc: "Paramount", plans: ["1 Mes", "Perfil 30"] },
  { svc: "FlujoTV", note: "Hasta 3 dispositivos", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)"] },
  { svc: "MagisTV", note: "3 dispositivos o 1 dispositivo", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)", "1 Mes (1 Dispositivo)", "3 Meses (1 Dispositivo)", "6 + 1 Meses (1 Dispositivo)", "12 + 2 Meses (1 Dispositivo)"] },
  { svc: "Tele Latino", note: "3 dispositivos o 1 dispositivo", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)", "1 Mes (1 Dispositivo)", "3 Meses (1 Dispositivo)", "6 + 1 Meses (1 Dispositivo)", "12 + 2 Meses (1 Dispositivo)"] },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Validación básica de input
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length > 100) {
      setError("La búsqueda es demasiado larga.");
      return;
    }
    setError("");
    setQuery(value);
  };

  const filtered = DATA.filter((svc) =>
    svc.svc.toLowerCase().includes(query.toLowerCase()) ||
    svc.plans.some((p) => p.toLowerCase().includes(query.toLowerCase()))
  );

  // Reemplazar navegación directa por useRouter
  const goToPanel = () => {
    router.push("/panel");
  };

  // Simulación de logout seguro (frontend)
  const handleLogout = () => {
    // Elimina cookies locales si existieran (solo frontend)
    if (typeof window !== "undefined") {
      document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    router.push("/login");
  };

  return (
    <div>
      <header className="hero container">
        <div className="logo-center">
          <img src="/White on Transparent.png" alt="Skyplay" className="logo-img" />
        </div>
        <span className="kicker">📦 Mayoristas · Catálogo Estructurado</span>
        <h1>Planes de <span className="gradient-title">Streaming & IPTV</span></h1>
        <p className="sub">Lista de servicios y planes disponibles para distribución mayorista. Incluye buscador, fichas, precios y pagos.</p>
        <div className="actions actions-right">
          <button className="btn" onClick={goToPanel}>← Volver al Panel</button>
          <button className="btn secondary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
        <div className="toolbar container">
          <input
            id="q"
            className="search"
            placeholder="Buscar servicio o plan (ej. Netflix Premium, Perfil 30, 3 dispositivos)…"
            value={query}
            onChange={handleQueryChange}
            maxLength={100}
            autoComplete="off"
          />
          <span className="tag" id="countServices">{filtered.length} servicios</span>
          <span className="tag" id="countPlans">{filtered.reduce((acc, svc) => acc + svc.plans.length, 0)} planes</span>
        </div>
  {error && <div className="error-msg">{error}</div>}
      </header>

      <main className="container">
        <section className="list" id="list">
          {filtered.map((svc, i) => (
            <div className="row" key={svc.svc + i}>
              <div className={`badge badge-${svc.svc.toLowerCase()}`}>{svc.svc[0]}</div>
              <div>
                <div className="name">{svc.svc}</div>
                {svc.note && <div className="meta">{svc.note}</div>}
                <div className="plans">
                  {svc.plans.map((plan, j) => (
                    <div className="plan" key={plan + j}>
                      <h4>{plan}</h4>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="summary">
          <div className="tile"><strong id="tServices">{filtered.length}</strong>Servicios</div>
          <div className="tile"><strong id="tPlans">{filtered.reduce((acc, svc) => acc + svc.plans.length, 0)}</strong>Planes totales</div>
          <div className="tile"><strong id="tReady">✔</strong>Estructura lista</div>
        </section>
      </main>

      <footer className="container">
  <div className="tile tile-center">
          <p>© {new Date().getFullYear()} Skyplay · Catálogo Mayorista. Soporte por WhatsApp y panel B2B bajo solicitud.</p>
        </div>
      </footer>

      <section className="container mb-24">
        <h2 className="credit-title">Recarga de Créditos (Billetera)</h2>
        <p className="sub credit-sub">Compra paquetes y recibe bono automático: 10%, 20%, 30% y 40%.</p>
        <div className="plans credit-plans" id="creditCards">
          {DATA[0].plans.map((plan, i) => (
            <div className="plan" key={plan + i}>
              <h4>{plan}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* Modal de Pago / Billetera */}
      <PaymentModal />
    </div>
  );
}

function PaymentModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pay' | 'wallet'>('pay');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [topupAmount, setTopupAmount] = useState("");

  // Simular abrir modal al seleccionar un plan de créditos
  React.useEffect(() => {
    const creditCards = document.getElementById("creditCards");
    if (creditCards) {
      creditCards.querySelectorAll(".plan").forEach((el, i) => {
        el.addEventListener("click", () => {
          setSelectedPlan(DATA[0].plans[i]);
          setOpen(true);
          setTab('pay');
        });
      });
    }
    // Limpieza
    return () => {
      if (creditCards) {
        creditCards.querySelectorAll(".plan").forEach((el) => {
          el.replaceWith(el.cloneNode(true));
        });
      }
    };
  }, []);

  if (!open) return null;

  return (
    <div className={`modal${open ? ' open' : ''}`}>
      <div className="modal-content">
        <div className="modal-head">
          <div>
            <strong id="modalTitle">Comprar</strong>
      <div className="muted modal-sub">{selectedPlan}</div>
          </div>
          <button className="btn" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="tabs">
          <button className={`tab${tab === 'pay' ? ' active' : ''}`} onClick={() => setTab('pay')}>Pagar ahora</button>
          <button className={`tab${tab === 'wallet' ? ' active' : ''}`} onClick={() => setTab('wallet')}>Billetera</button>
        </div>
        {tab === 'pay' && (
          <div id="tab-pay">
            <div className="paygrid">
              <div className="payopt">Sinpe Móvil</div>
              <div className="payopt">Tarjetas</div>
              <div className="payopt">Binance Pay</div>
              <div className="payopt">PayPal</div>
              <div className="payopt">Billetera (saldo: <span id="optWalletBalance">${walletBalance.toFixed(2)}</span>)</div>
            </div>
            <div className="rowflex pay-row">
              <div>Precio: <strong id="modalPrice">—</strong></div>
              <button className="btn primary" id="btnPayNow">Pagar</button>
            </div>
          </div>
        )}
        {tab === 'wallet' && (
          <div id="tab-wallet">
            <div className="wallet">
              <div>Saldo disponible</div>
              <strong><span id="walletBalance">${walletBalance.toFixed(2)}</span></strong>
              <div className="rowflex wallet-row"><small className="muted">Elige un método para recargar tu billetera:</small></div>
              <div className="paygrid wallet-paygrid" id="topupMethods">
                <div className="payopt" onClick={() => setWalletBalance(walletBalance + Number(topupAmount))}>Sinpe Móvil</div>
                <div className="payopt" onClick={() => setWalletBalance(walletBalance + Number(topupAmount))}>Tarjetas</div>
                <div className="payopt" onClick={() => setWalletBalance(walletBalance + Number(topupAmount))}>Binance Pay</div>
                <div className="payopt" onClick={() => setWalletBalance(walletBalance + Number(topupAmount))}>PayPal</div>
              </div>
              <div className="rowflex">
                <input className="input" id="topupAmount" type="number" placeholder="Monto a recargar" min="1" step="0.5" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                <button className="btn primary" id="btnTopup" onClick={() => setWalletBalance(walletBalance + Number(topupAmount))}>Recargar</button>
              </div>
              <div className="rowflex wallet-payrow">
                <small className="muted">Usa tu saldo para pagar al instante.</small>
                <button className="btn" id="btnPayWallet">Pagar con saldo</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
