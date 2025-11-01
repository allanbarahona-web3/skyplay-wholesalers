"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";
import CredentialsModal from "@/components/CredentialsModal";
import { getAllProducts, logout } from "@/lib/api";
import { groupProductsByService, createPriceMap, createProductCodeMap, getBrandColors, type CatalogService, type PriceMap, type ProductCodeMap } from "@/lib/catalog-utils";

export default function Home() {
  const [query, setQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<string[]>(["Recarga de Créditos (Billetera)"]);
  const [loading, setLoading] = useState(true);
  const [catalogData, setCatalogData] = useState<CatalogService[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});
  const [productCodeMap, setProductCodeMap] = useState<ProductCodeMap>({});
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [purchasedServices, setPurchasedServices] = useState<any[]>([]);
  const router = useRouter();
  const { openPayment, walletBalance, refreshWallet } = usePayment();

  useEffect(() => {
    loadCatalog();
    refreshWallet();
    
    // Detectar retorno desde Stripe y refrescar saldo
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      const orderType = urlParams.get('type');
      
      // Dar tiempo al webhook para procesar
      setTimeout(async () => {
        refreshWallet();
        
        if (orderType === 'recharge') {
          alert('✅ ¡Recarga exitosa! Tu saldo ha sido actualizado.');
        } else if (orderType === 'purchase') {
          // Cargar servicios para mostrar credenciales
          try {
            const response = await fetch('http://localhost:3000/api/me/overview', {
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              if (data.active_services && data.active_services.length > 0) {
                // Mostrar el servicio más reciente (último comprado)
                const latestService = data.active_services[0];
                setPurchasedServices([{
                  id: latestService.id,
                  product_name: latestService.product_name,
                  product_code: latestService.product_code,
                  expires_at: latestService.expires_at,
                  credentials: {
                    email: latestService.credential_email,
                    password: latestService.credential_password,
                    profile_name: latestService.profile_name,
                    pin: latestService.pin
                  }
                }]);
                setShowCredentialsModal(true);
              }
            }
          } catch (error) {
            console.error('Error loading credentials:', error);
            alert('✅ ¡Compra exitosa! Revisa tus credenciales en el Panel Mayorista.');
          }
        }
        
        // Limpiar URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const productsResult = await getAllProducts();
      
      if (productsResult.ok && productsResult.data) {
        const services = groupProductsByService(productsResult.data);
        const prices = createPriceMap(productsResult.data);
        const codes = createProductCodeMap(productsResult.data);
        console.log(`✅ Catálogo cargado: ${services.length} servicios, ${productsResult.data.length} productos`);
        setCatalogData(services);
        setPriceMap(prices);
        setProductCodeMap(codes);
      } else {
        console.error('❌ Error cargando catálogo:', productsResult);
      }
    } catch (error) {
      console.error('❌ Error cargando catálogo:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (svc: string) => {
    setExpandedRows(prev =>
      prev.includes(svc) ? [] : [svc]
    );
  };

  const handleBuy = (svc: string, plan: string) => {
    const key = `${svc}|${plan}`;
    const price = priceMap[key] || 0;
    const productCode = productCodeMap[key];
    if (!productCode) {
      console.error('❌ Product code not found for:', key);
      return;
    }
    openPayment({ service: svc, plan, price, productCode });
  };

  const filtered = catalogData.filter((svc) =>
    svc.svc.toLowerCase().includes(query.toLowerCase()) ||
    svc.plans.some((p: string) => p.toLowerCase().includes(query.toLowerCase()))
  );

  const goToPanel = () => {
    router.push("/panel");
  };

  const handleLogout = async () => {
    await logout();
    // No necesitamos router.push porque logout() ya hace window.location.href
  };

  const brandColors = getBrandColors();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: '#6b7280' }}>Cargando catálogo...</p>
      </div>
    );
  }

  return (
    <div>
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

      <div className="hero-section">
        <h1 className="hero-title">Planes de Streaming & IPTV</h1>
        <p className="hero-subtitle">Catálogo completo para distribución mayorista</p>
        <div className="hero-stats">
          <span className="stat-badge">{filtered.length} servicios</span>
          <span className="stat-badge">{filtered.reduce((acc, svc) => acc + svc.plans.length, 0)} planes</span>
        </div>
      </div>

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
            const serviceLogo = `/logos/${item.svc.toLowerCase().replace(/\s+/g, '-')}.png`;
            
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
                  <div className="badge" style={{ background: brandColors[item.svc] || '#334155' }}>
                    <img 
                      src={serviceLogo} 
                      alt={item.svc}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.textContent = item.svc[0];
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
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
                        const price = priceMap[key];
                        const stock = item.stockByPlan?.[plan] || 0;
                        
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
                              Stock: {stock}
                            </p>
                            {price && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                <div className="price" style={{ display: 'block', margin: 0, flex: 1 }}>
                                  ${Number(price).toFixed(2)}
                                </div>
                                <button className="btn small" onClick={() => handleBuy(item.svc, plan)} style={{ background: 'var(--primary)', padding: '6px 14px', fontSize: '0.85rem' }}>
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

      {/* Modal de credenciales para compras exitosas */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        services={purchasedServices}
      />
    </div>
  );
}
