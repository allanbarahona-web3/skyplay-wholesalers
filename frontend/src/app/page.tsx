"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";

// PRICE object - Todos los precios del catálogo
const PRICE: Record<string, number> = {
  // Créditos (1 crédito = $1, aplica bono al depositar en billetera)
  'Recarga de Créditos (Billetera)|10 Créditos (+10%)': 10,
  'Recarga de Créditos (Billetera)|25 Créditos (+20%)': 25,
  'Recarga de Créditos (Billetera)|50 Créditos (+30%)': 50,
  'Recarga de Créditos (Billetera)|100 Créditos (+40%)': 100,
  'Disney|Básico': 3.5, 
  'Disney|Estándar': 5,
  'VIX|1 Mes': 4, 
  'VIX|Anual': 35, 
  'VIX|Perfil 30': 2,
  'Crunchyroll|1 Mes': 5, 
  'Crunchyroll|Anual': 48, 
  'Crunchyroll|Perfil 30': 2.5,
  'MAX|Basic': 4, 
  'MAX|Standard': 6, 
  'MAX|Perfil 30': 2.5,
  'Netflix|Basic': 5, 
  'Netflix|Standard': 7, 
  'Netflix|Premium': 9,
  'Paramount|1 Mes': 4, 
  'Paramount|Perfil 30': 2,
  'FlujoTV|1 Mes (3 Dispositivos)': 9.5, 
  'FlujoTV|3 Meses (3 Dispositivos)': 25, 
  'FlujoTV|6 + 1 Meses (3 Dispositivos)': 49, 
  'FlujoTV|12 + 2 Meses (3 Dispositivos)': 89,
  'MagisTV PRO 3 Disp|1 Mes (3 Dispositivos)': 8.5, 
  'MagisTV PRO 3 Disp|3 Meses (3 Dispositivos)': 23, 
  'MagisTV PRO 3 Disp|6 + 1 Meses (3 Dispositivos)': 44, 
  'MagisTV PRO 3 Disp|12 + 2 Meses (3 Dispositivos)': 79,
  'MagisTV PRO 1 Disp|1 Mes (1 Dispositivo)': 6, 
  'MagisTV PRO 1 Disp|3 Meses (1 Dispositivo)': 16, 
  'MagisTV PRO 1 Disp|6 + 1 Meses (1 Dispositivo)': 30, 
  'MagisTV PRO 1 Disp|12 + 2 Meses (1 Dispositivo)': 55,
  'Tele Latino PRO 3 Disp|1 Mes (3 Dispositivos)': 8, 
  'Tele Latino PRO 3 Disp|3 Meses (3 Dispositivos)': 21, 
  'Tele Latino PRO 3 Disp|6 + 1 Meses (3 Dispositivos)': 39, 
  'Tele Latino PRO 3 Disp|12 + 2 Meses (3 Dispositivos)': 72,
  'Tele Latino PRO 1 Disp|1 Mes (1 Dispositivo)': 5.5, 
  'Tele Latino PRO 1 Disp|3 Meses (1 Dispositivo)': 14, 
  'Tele Latino PRO 1 Disp|6 + 1 Meses (1 Dispositivo)': 26, 
  'Tele Latino PRO 1 Disp|12 + 2 Meses (1 Dispositivo)': 48
};

const BRAND: Record<string, string> = {
  Disney: "#113CCF",
  VIX: "#FF5C00",
  Crunchyroll: "#F47521",
  MAX: "#7c3aed",
  Netflix: "#E50914",
  Paramount: "#0057B8",
  FlujoTV: "#00ADEF",
  "MagisTV PRO 3 Disp": "#FF9500",
  "MagisTV PRO 1 Disp": "#FF9500",
  "Tele Latino PRO 3 Disp": "#DC2626",
  "Tele Latino PRO 1 Disp": "#DC2626",
  "Recarga de Créditos (Billetera)": "#22c55e",
};

const DATA = [
  { svc: "Recarga de Créditos (Billetera)", note: "Compra paquetes y recibe bono automático", plans: ["10 Créditos (+10%)", "25 Créditos (+20%)", "50 Créditos (+30%)", "100 Créditos (+40%)"] },
  { svc: "Disney", plans: ["Básico", "Estándar"] },
  { svc: "VIX", plans: ["1 Mes", "Anual", "Perfil 30"] },
  { svc: "Crunchyroll", plans: ["1 Mes", "Anual", "Perfil 30"] },
  { svc: "MAX", plans: ["Basic", "Standard", "Perfil 30"] },
  { svc: "Netflix", plans: ["Basic", "Standard", "Premium"] },
  { svc: "Paramount", plans: ["1 Mes", "Perfil 30"] },
  { svc: "FlujoTV", note: "Hasta 3 dispositivos", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)"] },
  { svc: "MagisTV PRO 3 Disp", note: "Hasta 3 dispositivos", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)"] },
  { svc: "MagisTV PRO 1 Disp", note: "1 dispositivo", plans: ["1 Mes (1 Dispositivo)", "3 Meses (1 Dispositivo)", "6 + 1 Meses (1 Dispositivo)", "12 + 2 Meses (1 Dispositivo)"] },
  { svc: "Tele Latino PRO 3 Disp", note: "Hasta 3 dispositivos", plans: ["1 Mes (3 Dispositivos)", "3 Meses (3 Dispositivos)", "6 + 1 Meses (3 Dispositivos)", "12 + 2 Meses (3 Dispositivos)"] },
  { svc: "Tele Latino PRO 1 Disp", note: "1 dispositivo", plans: ["1 Mes (1 Dispositivo)", "3 Meses (1 Dispositivo)", "6 + 1 Meses (1 Dispositivo)", "12 + 2 Meses (1 Dispositivo)"] },
];

// Simulación de stock (reemplazar con API)
function getStock(svc: string, plan: string): number {
  return Math.floor(Math.random() * 50 + 1);
}

// Billetera localStorage
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

export default function Home() {
  const [query, setQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<string[]>(["Recarga de Créditos (Billetera)"]); // Créditos expandido por defecto
  const router = useRouter();
  const { openPayment, walletBalance, refreshWallet } = usePayment();

  useEffect(() => {
    refreshWallet();
  }, []);

  const toggleRow = (svc: string) => {
    setExpandedRows(prev =>
      prev.includes(svc) ? [] : [svc]  // Solo una tarjeta abierta a la vez
    );
  };

  const openModalFor = (svc: string, plan: string) => {
    const key = `${svc}|${plan}`;
    const price = PRICE[key] || 0;
    openPayment({ service: svc, plan, price });
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
      {/* Header estilo Apple - sticky con backdrop blur */}
      <header className="apple-header">
        <div className="apple-header-content">
          <div className="apple-header-left">
            <img src="/White on Transparent.png" alt="Skyplay" className="apple-logo" />
            <span className="apple-divider"></span>
            <span className="apple-badge">Mayoristas</span>
          </div>
          
          <div className="apple-header-center">
            <input
              id="q"
              className="apple-search"
              placeholder="Buscar servicio o plan..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </div>

          <div className="apple-header-right">
            <div className="apple-wallet">
              💰 ${walletBalance.toFixed(2)}
            </div>
            <button className="apple-btn-secondary" onClick={goToPanel}>Panel</button>
            <button className="apple-btn-secondary" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </header>

      {/* Hero section debajo del header */}
      <div className="hero-section">
        <h1 className="hero-title">Planes de Streaming & IPTV</h1>
        <p className="hero-subtitle">Catálogo completo para distribución mayorista</p>
        <div className="hero-stats">
          <span className="stat-badge">{filtered.length} servicios</span>
          <span className="stat-badge">{filtered.reduce((acc, svc) => acc + svc.plans.length, 0)} planes</span>
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

      <main className="container">
        <section className="list" id="list">
          {filtered.map((item) => {
            const isExpanded = expandedRows.includes(item.svc);
            return (
              <div className="row" key={item.svc}>
                <div 
                  className="row-header"
                  onClick={() => toggleRow(item.svc)}
                  style={{ 
                    display: 'contents',
                    cursor: 'pointer'
                  }}
                >
                  <div className="badge" style={{ background: BRAND[item.svc] || '#334155' }}>
                    {item.svc[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="name">{item.svc}</div>
                    <div className="meta">
                      {item.plans.length} planes disponibles
                      {item.note && ` · ${item.note}`}
                    </div>
                  </div>
                  <div className="chev-button">
                    <span className="chev-icon">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="details" style={{ display: 'block' }}>
                    <div className="plans">
                      {item.plans.map((plan) => {
                        const key = `${item.svc}|${plan}`;
                        const price = PRICE[key];
                        const stock = getStock(item.svc, plan);
                        
                        // Simplificar el nombre del plan (quitar paréntesis y "Dispositivos")
                        let cleanPlan = plan;
                        if (plan.includes('Mes')) {
                          cleanPlan = plan
                            .replace('(3 Dispositivos)', '')
                            .replace('(1 Dispositivo)', '')
                            .replace('+ 1 Meses', '+1 Meses')
                            .replace('+ 2 Meses', '+2 Meses')
                            .trim();
                        }
                        
                        return (
                          <div className="plan" key={plan}>
                            <h4>{cleanPlan}</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px' }}>
                              Stock {stock}
                            </p>
                            {price && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                <div className="price" style={{ display: 'block', margin: 0, flex: 1 }}>
                                  ${price.toFixed(2)}
                                </div>
                                <button className="btn small" onClick={() => openModalFor(item.svc, plan)} style={{ background: 'var(--primary)', padding: '6px 14px', fontSize: '0.85rem' }}>
                                  Comprar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      <footer className="container">
  <div className="tile tile-center">
          <p>© {new Date().getFullYear()} Skyplay · Catálogo Mayorista. Soporte por WhatsApp y panel B2B bajo solicitud.</p>
        </div>
      </footer>
    </div>
  );
}


