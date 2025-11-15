"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";
import CredentialsModal from "@/components/CredentialsModal";
import SuccessInfoModal from "@/components/SuccessInfoModal";
import { getAllProducts, logout, getOverview } from "@/lib/api";
import { groupProductsByService, createPriceMap, createProductCodeMap, createCategoryMap, getBrandColors, type CatalogService, type PriceMap, type ProductCodeMap, type CategoryMap } from "@/lib/catalog-utils";

export default function Home() {
  const [query, setQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<string[]>(["Recarga de Créditos (Billetera)"]);
  const [loading, setLoading] = useState(true);
  const [catalogData, setCatalogData] = useState<CatalogService[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});
  const [productCodeMap, setProductCodeMap] = useState<ProductCodeMap>({});
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showSuccessInfoModal, setShowSuccessInfoModal] = useState(false);
  const [successProvider, setSuccessProvider] = useState<string>('');
  const [purchasedServices, setPurchasedServices] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null); // Suscripción del usuario
  const router = useRouter();
  const { openPayment, walletBalance, refreshWallet } = usePayment();

  useEffect(() => {
    loadCatalog();
    refreshWallet();
    
    // Detectar retorno desde Stripe/PayPal/Wallet y refrescar saldo
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const provider = urlParams.get('provider');
    const orderNumber = urlParams.get('order');
    const orderType = urlParams.get('type');
    
    if (paymentStatus === 'success') {
      // Dar tiempo al webhook para procesar (PayPal/Stripe necesitan más tiempo)
      const waitTime = (provider === 'paypal' || provider === 'stripe') ? 5000 : 2000;
      
      setTimeout(async () => {
        refreshWallet();
        
        if (orderType === 'recharge') {
          alert('✅ ¡Recarga exitosa! Tu saldo ha sido actualizado.');
          window.history.replaceState({}, '', window.location.pathname);
        } else if (orderType === 'purchase') {
          // Mostrar modal de pago exitoso para TODOS los métodos (Stripe, PayPal, Wallet)
          setSuccessProvider(provider || 'wallet');
          setShowSuccessInfoModal(true);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, waitTime);
    }
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const productsResult = await getAllProducts();
      const overviewResult = await getOverview();
      
      if (productsResult.ok && productsResult.data) {
        const services = groupProductsByService(productsResult.data);
        const prices = createPriceMap(productsResult.data);
        const codes = createProductCodeMap(productsResult.data);
        const categories = createCategoryMap(productsResult.data);
        console.log(`✅ Catálogo cargado: ${services.length} servicios, ${productsResult.data.length} productos`);
        setCatalogData(services);
        setPriceMap(prices);
        setProductCodeMap(codes);
        setCategoryMap(categories);
      } else {
        console.error('❌ Error cargando catálogo:', productsResult);
      }

      // Cargar suscripción del usuario
      if (overviewResult.ok && overviewResult.data?.subscription) {
        setSubscription(overviewResult.data.subscription);
        console.log('✅ Suscripción cargada:', overviewResult.data.subscription);
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

  // Calcular precio con descuento si tiene suscripción activa
  const calculatePrice = (basePrice: number, category?: string) => {
    if (!subscription || subscription.status !== 'active') {
      return { price: basePrice, discount: 0, discounted: false };
    }

    // Verificar que la suscripción no haya expirado
    if (subscription.current_period_end) {
      const endDate = new Date(subscription.current_period_end);
      if (endDate <= new Date()) {
        return { price: basePrice, discount: 0, discounted: false };
      }
    }

    // Aplicar descuento SOLO a categorías Streaming e IPTV
    const eligibleCategories = ['Streaming', 'IPTV'];
    if (!category || !eligibleCategories.includes(category)) {
      return { price: basePrice, discount: 0, discounted: false };
    }

    // Aplicar 20% descuento
    const discount = 0.20;
    const discountedPrice = basePrice * (1 - discount);
    return { price: discountedPrice, discount, discounted: true };
  };

  const handleBuy = (svc: string, plan: string) => {
    const key = `${svc}|${plan}`;
    const basePrice = priceMap[key] || 0;
    const productCode = productCodeMap[key];
    const category = categoryMap[key];
    if (!productCode) {
      console.error('❌ Product code not found for:', key);
      return;
    }
    
    // Calcular precio con descuento si aplica (verificando categoría)
    const priceInfo = calculatePrice(basePrice, category);
    
    openPayment({ 
      service: svc, 
      plan, 
      price: priceInfo.price, // Precio con descuento aplicado
      productCode,
      originalPrice: priceInfo.discounted ? basePrice : undefined,
      discount: priceInfo.discounted ? priceInfo.discount : undefined
    });
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
            <div className="apple-divider"></div>
            <span className="apple-header-title">Catálogo Mayorista</span>
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
            <button className="apple-btn-link" onClick={goToPanel}>
              <span>📊</span> Panel Mayorista
            </button>
            <button className="apple-btn-link" onClick={handleLogout}>
              <span>👤</span> Salir
            </button>
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
            <div className="ticker-content">
              <span className="ticker-item">💰 Billetera Virtual: $10 recibe 10% • $25 recibe 20% • $50 recibe 30% • $100 recibe 40%</span>
              <span className="ticker-item">🛍️ ¡Obtén tu propia Tienda Virtual muy pronto en tu Panel Mayorista!</span>
              <span className="ticker-item">⭐ Adquiere tu Suscripción Basic y obtén 30% descuento en todas tus compras</span>
              <span className="ticker-item">🚀 Suscripción Plata: Adiciona un Sistema CRM para la administración de tus clientes Muy Pronto!!!</span>
            </div>
            <div className="ticker-content" aria-hidden="true">
              <span className="ticker-item">💰 Billetera Virtual: $10 recibe 10% • $25 recibe 20% • $50 recibe 30% • $100 recibe 40%</span>
              <span className="ticker-item">🛍️ ¡Obtén tu propia Tienda Virtual muy pronto en tu Panel Mayorista!</span>
              <span className="ticker-item">⭐ Adquiere tu Suscripción Basic y obtén 30% descuento en todas tus compras</span>
              <span className="ticker-item">🚀 Suscripción Plata: Adiciona un Sistema CRM para la administración de tus clientes Muy Pronto!!!</span>
            </div>
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
                        const basePrice = priceMap[key];
                        const category = categoryMap[key];
                        const stock = item.stockByPlan?.[plan] || 0;
                        const priceInfo = calculatePrice(basePrice, category);
                        
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
                            {basePrice && (
                              <div style={{ marginTop: '8px' }}>
                                {/* Precios */}
                                {priceInfo.discounted ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#ef4444', textDecoration: 'line-through', fontWeight: '500' }}>
                                      ${basePrice.toFixed(2)}
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: '#22c55e', fontSize: '1.15rem' }}>
                                      ${priceInfo.price.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', background: '#22c55e', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      -20%
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '6px' }}>
                                    ${basePrice.toFixed(2)}
                                  </div>
                                )}
                                {/* Botón Comprar */}
                                <button 
                                  className="btn small" 
                                  onClick={() => handleBuy(item.svc, plan)} 
                                  style={{ 
                                    background: 'var(--primary)', 
                                    padding: '8px 16px', 
                                    fontSize: '0.85rem',
                                    width: '100%'
                                  }}
                                >
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

      {/* Modal informativo para pagos con PayPal/Stripe */}
      <SuccessInfoModal
        isOpen={showSuccessInfoModal}
        onClose={() => setShowSuccessInfoModal(false)}
        provider={successProvider}
      />
    </div>
  );
}
