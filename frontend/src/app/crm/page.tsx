"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePayment } from "@/components/PaymentContext";

type CRMClient = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  credential_id?: string; // UUID de la credencial asignada
  expires_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
};

type UserSubscription = {
  subscription?: { status: string };
  crm_basic?: { status: string };
  crm_pro?: { status: string };
};

type Service = {
  id: string;
  product_name: string;
  product_code: string;
  credential_id?: string;
  credential_email?: string;
  credential_password?: string;
  profile_name?: string;
  pin?: string;
  status: string;
  expires_at?: string;
  created_at?: string;
};

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

export default function CRMPage() {
  const router = useRouter();
  const { openPayment } = usePayment();

  // Estados
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [availableCredentials, setAvailableCredentials] = useState<any[]>([]);
  const [purchasedServices, setPurchasedServices] = useState<Service[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastOk, setToastOk] = useState(false);
  const [credentialsFilter, setCredentialsFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  
  // Modal estados
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedServiceForClient, setSelectedServiceForClient] = useState<Service | null>(null);
  
  // Form estados
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    credential_id: "",
    notes: ""
  });

  // Cargar datos
  useEffect(() => {
    loadCRMData();
  }, []);

  const loadCRMData = async () => {
    setIsLoading(true);
    try {
      // Cargar datos de suscripción y servicios del usuario
      const overviewResponse = await fetch('http://localhost:3000/api/me/overview', {
        credentials: 'include',
      });

      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json();
        console.log('📊 Overview data loaded:', overviewData);
        
        // Extract subscription
        setSubscription(overviewData.subscription);
        
        // Extract purchased services (credenciales compradas)
        if (overviewData.active_services && Array.isArray(overviewData.active_services)) {
          console.log('🎫 Purchased services loaded:', overviewData.active_services.length);
          console.log('🎫 First service status:', overviewData.active_services[0]?.status);
          console.log('🎫 All services:', overviewData.active_services);
          setPurchasedServices(overviewData.active_services);
        }
      } else {
        console.error('❌ Failed to load overview:', overviewResponse.status);
      }

      // Cargar clientes del CRM (sin bloquear si falla)
      try {
        const clientsResponse = await fetch('http://localhost:3000/api/crm/clients', {
          credentials: 'include',
        });

        if (!clientsResponse.ok) {
          if (clientsResponse.status === 401) {
            return;
          }
          throw new Error('Error loading clients');
        }

        const clientsData = await clientsResponse.json();
        setClients(Array.isArray(clientsData) ? clientsData : []);
      } catch (clientsError) {
        console.warn('⚠️ Could not load clients (CRM endpoint may not exist):', clientsError);
      }
    } catch (error) {
      console.error('Error loading CRM data:', error);
      setToastMsg('Error cargando datos del CRM');
      setToastOk(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      setToastMsg('Nombre y email son requeridos');
      setToastOk(false);
      return;
    }

    try {
      // Si hay un servicio seleccionado, usar su credential_id
      const credentialIdToSend = selectedServiceForClient 
        ? selectedServiceForClient.credential_id || formData.credential_id
        : formData.credential_id;

      console.log('📝 Enviando cliente:', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        credential_id: credentialIdToSend,
        service_id_original: selectedServiceForClient?.id,
        notes: formData.notes
      });

      const response = await fetch('http://localhost:3000/api/crm/clients', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          credential_id: credentialIdToSend || undefined,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Backend error response:', { status: response.status, error });
        throw new Error(error.message || 'Error al crear cliente');
      }

      const newClient = await response.json();
      console.log('✅ New client response:', newClient);
      setClients([newClient, ...clients]);
      setFormData({ name: "", email: "", phone: "", credential_id: "", notes: "" });
      setSelectedServiceForClient(null);
      setShowAddClientModal(false);
      setToastMsg('✅ Cliente agregado correctamente');
      setToastOk(true);
    } catch (error) {
      console.error('Error adding client:', error);
      setToastMsg(`❌ ${error instanceof Error ? error.message : 'Error al agregar cliente'}`);
      setToastOk(false);
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingClient) return;
    if (!formData.name.trim() || !formData.email.trim()) {
      setToastMsg('Nombre y email son requeridos');
      setToastOk(false);
      return;
    }

    try {
      // Si hay un servicio seleccionado, usar su credential_id
      const credentialIdToSend = selectedServiceForClient 
        ? selectedServiceForClient.credential_id || formData.credential_id
        : formData.credential_id;

      console.log('📝 Actualizando cliente:', {
        id: editingClient.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        credential_id: credentialIdToSend,
        service_id_original: selectedServiceForClient?.id,
        notes: formData.notes
      });

      const response = await fetch(`http://localhost:3000/api/crm/clients/${editingClient.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          credential_id: credentialIdToSend || undefined,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Backend error response:', { 
          status: response.status, 
          error,
          errorDetail: error?.detail || error?.message || 'No details'
        });
        throw new Error(error.message || 'Error al actualizar cliente');
      }

      const updatedClient = await response.json();
      console.log('✅ Updated client response:', updatedClient);
      setClients(clients.map(c => c.id === editingClient.id ? updatedClient : c));
      
      setEditingClient(null);
      setShowEditClientModal(false);
      setFormData({ name: "", email: "", phone: "", credential_id: "", notes: "" });
      setSelectedServiceForClient(null);
      setSelectedServiceForClient(null);
      setToastMsg('✅ Cliente actualizado correctamente');
      setToastOk(true);
    } catch (error) {
      console.error('Error updating client:', error);
      setToastMsg(`❌ ${error instanceof Error ? error.message : 'Error al actualizar cliente'}`);
      setToastOk(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/api/crm/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar cliente');
      }

      setClients(clients.filter(c => c.id !== clientId));
      setToastMsg('✅ Cliente eliminado');
      setToastOk(true);
    } catch (error) {
      console.error('Error deleting client:', error);
      setToastMsg(`❌ ${error instanceof Error ? error.message : 'Error al eliminar cliente'}`);
      setToastOk(false);
    }
  };

  const openEditModal = (client: CRMClient) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      credential_id: client.credential_id || "",
      notes: client.notes || ""
    });
    
    // Si el cliente tiene credential_id, buscar el servicio correspondiente
    if (client.credential_id) {
      const matchingService = purchasedServices.find(s => s.credential_id === client.credential_id);
      setSelectedServiceForClient(matchingService || null);
    } else {
      setSelectedServiceForClient(null);
    }
    
    setShowEditClientModal(true);
  };

  const openAddModal = () => {
    setFormData({ name: "", email: "", phone: "", credential_id: "", notes: "" });
    setSelectedServiceForClient(null);
    setShowAddClientModal(true);
  };

  const handleUpgradeToPRO = () => {
    setShowUpgradeModal(false);
    openPayment({
      service: 'CRM PRO',
      plan: 'Mensual',
      price: 24.95,
      productCode: 'crm-pro',
      isRenewal: false
    });
  };

  // Helpers
  const fmtDate = (s?: string) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return s;
    }
  };

  // Determinar si un servicio está activo (no vencido)
  const isServiceActive = (service: Service): boolean => {
    if (!service.expires_at) return true;
    const expiryDate = new Date(service.expires_at);
    const now = new Date();
    return expiryDate.getTime() > now.getTime();
  };

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getServiceByCredentialId = (credentialId: string | undefined): Service | undefined => {
    if (!credentialId) return undefined;
    return purchasedServices.find(s => s.credential_id === credentialId);
  };

  const getClientByCredentialId = (credentialId: string | undefined): CRMClient | undefined => {
    if (!credentialId) return undefined;
    return clients.find(c => c.credential_id === credentialId);
  };

  const getFilteredCredentials = () => {
    const activeCredentials = purchasedServices.filter(s => isServiceActive(s));
    
    if (credentialsFilter === 'unassigned') {
      return activeCredentials.filter(s => !getClientByCredentialId(s.credential_id));
    }
    if (credentialsFilter === 'assigned') {
      return activeCredentials.filter(s => !!getClientByCredentialId(s.credential_id));
    }
    return activeCredentials;
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchText.toLowerCase()) ||
    c.email.toLowerCase().includes(searchText.toLowerCase()) ||
    (c.phone && c.phone.includes(searchText))
  );

  const clientsExpiringSoon = clients.filter(c => {
    const days = getDaysUntilExpiry(c.expires_at);
    return days !== null && days <= 5 && days > 0;
  });

  const clientsExpired = clients.filter(c => {
    const days = getDaysUntilExpiry(c.expires_at);
    return days !== null && days <= 0;
  });

  // Toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(""), 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Verificar acceso
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p>Cargando CRM...</p>
        </div>
      </div>
    );
  }

  // Verificar acceso: Suscripción Preferencial, CRM PLUS o CRM PRO
  const hasPreferentialSubscription = subscription?.subscription?.status === 'active';
  const hasCRMBasic = subscription?.crm_basic?.status === 'active';
  const hasCRMPro = subscription?.crm_pro?.status === 'active';
  const hasAccess = hasPreferentialSubscription || hasCRMBasic || hasCRMPro;

  console.log('🔍 CRM Access Check:', {
    subscriptionStatus: subscription?.subscription?.status,
    hasPreferentialSubscription,
    crm_basic: subscription?.crm_basic,
    hasCRMBasic,
    crm_pro: subscription?.crm_pro,
    hasCRMPro,
    hasAccess,
    fullSubscription: subscription
  });

  if (!subscription || !hasAccess) {
    return (
      <div style={{ paddingTop: '80px', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#1d1d1f' }}>Acceso no autorizado</h2>
          <p style={{ color: '#86868b', marginBottom: '20px' }}>
            Para acceder al CRM necesitas tener activo:
          </p>
          <ul style={{ textAlign: 'left', color: '#86868b', marginBottom: '20px', lineHeight: '1.8' }}>
            <li>✅ Suscripción Preferencial (incluye CRM PLUS gratis), o</li>
            <li>✅ CRM PLUS individual, o</li>
            <li>✅ CRM PRO</li>
          </ul>
          <p style={{ color: '#999', fontSize: '12px', marginBottom: '15px' }}>
            {subscription ? `Estado actual: ${JSON.stringify({subscription: subscription.subscription?.status, crm_basic: subscription.crm_basic?.status, crm_pro: subscription.crm_pro?.status})}` : 'Cargando datos...'}
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => router.push('/panel')}
            style={{ width: '100%' }}
          >
            Ir al Panel para Suscribirte
          </button>
        </div>
      </div>
    );
  }

  const isCRMPro = hasCRMPro;

  return (
    <div id="crm-page">
      {/* Header */}
      <header className="apple-header">
        <div className="apple-header-content">
          <div className="apple-header-left">
            <img src="/White on Transparent.png" alt="Logo" className="apple-logo" />
            <div className="apple-divider"></div>
            <span className="apple-header-title">CRM {isCRMPro ? 'PRO' : 'PLUS'}</span>
          </div>
          
          <div className="apple-header-center">
            <input
              id="q"
              className="apple-search"
              placeholder="Buscar clientes..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </div>

          <div className="apple-header-right">
            <button className="apple-btn-link" onClick={() => router.push("/panel")} title="Panel Mayorista">
              <span>📊</span> Panel Mayorista
            </button>
            <button className="apple-btn-link" onClick={() => router.push("/")} title="Catálogo">
              <span>🏪</span> Catálogo
            </button>
            <button className="apple-btn-link" onClick={() => router.push("/login")}>
              <span>👤</span> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '80px' }}>
        {/* Status y Stats */}
        <div className="panel-status-bar" style={{ marginBottom: '30px' }}>
          <div className={`status-badge status-active`}>
            <span className="status-icon">✓</span>
            <span>CRM {isCRMPro ? 'PRO' : 'PLUS'} Activo</span>
          </div>
          <div className={`status-badge ${clientsExpiringSoon.length > 0 ? 'status-warning' : 'status-inactive'}`} style={{
            backgroundColor: clientsExpiringSoon.length > 0 ? '#fff8e6' : undefined,
            borderColor: clientsExpiringSoon.length > 0 ? '#fbbf24' : undefined
          }}>
            <span className="status-icon" style={{ color: clientsExpiringSoon.length > 0 ? '#f59e0b' : undefined }}>
              {clientsExpiringSoon.length > 0 ? '⚠️' : '✓'}
            </span>
            <span>Por vencer: {clientsExpiringSoon.length}</span>
          </div>
          <div className={`status-badge ${clientsExpired.length > 0 ? 'status-inactive' : 'status-active'}`}>
            <span className="status-icon">✓</span>
            <span>Total clientes: {clients.length}</span>
          </div>
        </div>

        {/* Upgrade Banner (solo para CRM PLUS) */}
        {!isCRMPro && (
          <div style={{
            background: 'linear-gradient(135deg, #af52de 0%, #7c3aed 100%)',
            color: 'white',
            padding: '20px 24px',
            borderRadius: '12px',
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                ⭐ Actualiza a CRM PRO - Obtén 25% Descuento en Streaming
              </h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.95 }}>
                Sube de 20% a 25% descuento en productos streaming/IPTV + recordatorios automáticos por email y SMS + analytics completos
              </p>
            </div>
            <button 
              onClick={() => setShowUpgradeModal(true)}
              style={{
                backgroundColor: 'white',
                color: '#af52de',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                marginLeft: '20px'
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Upgrade →
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="panel-grid">
          {/* Clientes Section */}
          <section className="panel-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Gestión de Clientes</h2>
                <p className="section-desc">Administra tu base de clientes y asigna credenciales de tus servicios.</p>
              </div>
              <button 
                className="btn btn-primary"
                onClick={openAddModal}
                style={{ marginTop: 0 }}
              >
                ➕ Nuevo Cliente
              </button>
            </div>

            {/* Tabla de Clientes */}
            <div className="table-container" style={{ maxHeight: '700px', overflowY: 'auto' }}>
              {filteredClients.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  backgroundColor: '#f5f5f7',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#1d1d1f' }}>
                    Sin clientes aún
                  </h3>
                  <p style={{ color: '#86868b', marginBottom: '20px' }}>
                    {searchText ? 'No se encontraron resultados' : 'Comienza agregando tu primer cliente'}
                  </p>
                  {!searchText && (
                    <button 
                      className="btn btn-primary"
                      onClick={openAddModal}
                    >
                      ➕ Agregar Cliente
                    </button>
                  )}
                </div>
              ) : (
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Servicio</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client, idx) => {
                      const assignedService = getServiceByCredentialId(client.credential_id);
                      const daysLeft = getDaysUntilExpiry(assignedService?.expires_at);
                      let expiryStatus = 'active';
                      if (daysLeft !== null && daysLeft <= 0) expiryStatus = 'expired';
                      else if (daysLeft !== null && daysLeft <= 5) expiryStatus = 'soon';

                      return (
                        <tr key={client.id}>
                          <td className="td-number">{idx + 1}</td>
                          <td className="td-product" title={client.notes}>{client.name}</td>
                          <td className="td-muted">{client.email}</td>
                          <td className="td-muted">{client.phone || '—'}</td>
                          <td className="td-date">
                            {assignedService ? (
                              <div>
                                <div style={{ fontWeight: '500' }}>{assignedService.product_name}</div>
                                {assignedService.profile_name && (
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{assignedService.profile_name}</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>—</span>
                            )}
                          </td>
                          <td className="td-date">
                            {assignedService?.expires_at ? fmtDate(assignedService.expires_at) : '—'}
                          </td>
                          <td>
                            {assignedService?.expires_at && (
                              <span className={`badge badge-${expiryStatus}`}>
                                {expiryStatus === 'expired' ? '⏰ Vencido' : 
                                 expiryStatus === 'soon' ? `⚠️ ${daysLeft}d` : 
                                 `✓ ${daysLeft}d`}
                              </span>
                            )}
                          </td>
                          <td className="td-action">
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn-table"
                                onClick={() => openEditModal(client)}
                                title="Editar cliente"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '12px'
                                }}
                              >
                                ✏️ Editar
                              </button>
                              <button 
                                className="btn-table"
                                onClick={() => handleDeleteClient(client.id)}
                                style={{ 
                                  backgroundColor: '#ff3b30', 
                                  color: 'white',
                                  padding: '4px 10px',
                                  fontSize: '12px'
                                }}
                                title="Eliminar cliente"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Credenciales Section - NUEVA */}
          <section className="panel-section" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
            <div className="section-header">
              <div>
                <h2 className="section-title">🎫 Mis Credenciales Compradas</h2>
                <p className="section-desc">Tus servicios activos disponibles para asignar a clientes</p>
              </div>
            </div>

            {purchasedServices.filter(s => isServiceActive(s)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#86868b' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>No tienes credenciales activas</p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Ve al <strong>Catálogo</strong> para comprar Netflix, Spotify, Disney+ y más
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.href = '/'}
                  style={{ marginTop: '16px' }}
                >
                  Ir al Catálogo
                </button>
              </div>
            ) : (
              <>
                {/* Filtros */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCredentialsFilter('all')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: credentialsFilter === 'all' ? '2px solid #0066cc' : '1px solid #d1d5db',
                      backgroundColor: credentialsFilter === 'all' ? '#0066cc' : '#ffffff',
                      color: credentialsFilter === 'all' ? '#ffffff' : '#1d1d1f',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📋 Todas ({purchasedServices.filter(s => isServiceActive(s)).length})
                  </button>
                  <button
                    onClick={() => setCredentialsFilter('unassigned')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: credentialsFilter === 'unassigned' ? '2px solid #10b981' : '1px solid #d1d5db',
                      backgroundColor: credentialsFilter === 'unassigned' ? '#10b981' : '#ffffff',
                      color: credentialsFilter === 'unassigned' ? '#ffffff' : '#1d1d1f',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ✓ Por Asignar ({purchasedServices.filter(s => isServiceActive(s) && !getClientByCredentialId(s.credential_id)).length})
                  </button>
                  <button
                    onClick={() => setCredentialsFilter('assigned')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: credentialsFilter === 'assigned' ? '2px solid #f59e0b' : '1px solid #d1d5db',
                      backgroundColor: credentialsFilter === 'assigned' ? '#f59e0b' : '#ffffff',
                      color: credentialsFilter === 'assigned' ? '#ffffff' : '#1d1d1f',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📌 Asignadas ({purchasedServices.filter(s => isServiceActive(s) && getClientByCredentialId(s.credential_id)).length})
                  </button>
                </div>

                {/* Credenciales */}
                <div style={{ display: 'grid', gap: '16px' }}>
                  {getFilteredCredentials().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: '#86868b', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      {credentialsFilter === 'unassigned' && (
                        <>
                          <div style={{ fontSize: '36px', marginBottom: '8px' }}>✓</div>
                          <p style={{ margin: 0, fontSize: '14px' }}>Todas tus credenciales están asignadas</p>
                        </>
                      )}
                      {credentialsFilter === 'assigned' && (
                        <>
                          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
                          <p style={{ margin: 0, fontSize: '14px' }}>No tienes credenciales asignadas</p>
                        </>
                      )}
                    </div>
                  ) : (
                    getFilteredCredentials().map((service) => (
                  <div
                    key={service.id}
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1d1d1f' }}>
                          {service.product_name || service.product_code}
                        </h3>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                        {service.credential_email && (
                          <div>
                            <span style={{ fontWeight: '500' }}>📧 </span>
                            {service.credential_email}
                          </div>
                        )}
                        {service.profile_name && (
                          <div>
                            <span style={{ fontWeight: '500' }}>👤 </span>
                            {service.profile_name}
                          </div>
                        )}
                        {service.expires_at && (
                          <div>
                            <span style={{ fontWeight: '500' }}>📅 </span>
                            Vence: {fmtDate(service.expires_at)}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        {(() => {
                          const assignedClient = getClientByCredentialId(service.credential_id);
                          return assignedClient ? (
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              ✓ Asignada a <strong>{assignedClient.name}</strong>
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              ✓ Activo
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const assignedClient = getClientByCredentialId(service.credential_id);
                      return assignedClient ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: '#fef3c7',
                          borderRadius: '8px',
                          marginLeft: '16px'
                        }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#92400e' }}>
                            📌 Asignada a {assignedClient.name}
                          </span>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setSelectedServiceForClient(service);
                            openAddModal();
                          }}
                          style={{ marginLeft: '16px', whiteSpace: 'nowrap' }}
                        >
                          + Asignar a Cliente
                        </button>
                      );
                    })()}
                  </div>
                )))}
              </div>
            </>
          )}
        </section>

          {/* Notas o Info Section */}
          {isCRMPro && (
            <section className="panel-section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Características PRO</h2>
                  <p className="section-desc">Funcionalidades premium disponibles en tu plan.</p>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gap: '12px'
              }}>
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <p style={{ margin: 0, color: '#065f46', fontWeight: '600' }}>
                    ✅ Recordatorios Automáticos
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#047857', fontSize: '14px' }}>
                    Envía SMS y emails automáticos a tus clientes antes de que venza su servicio
                  </p>
                </div>

                <div style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <p style={{ margin: 0, color: '#1e40af', fontWeight: '600' }}>
                    📊 Analytics
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#1e3a8a', fontSize: '14px' }}>
                    Visualiza estadísticas de tus clientes y servicios activos
                  </p>
                </div>

                <div style={{
                  backgroundColor: '#fdf2f8',
                  border: '1px solid #fbcfe8',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <p style={{ margin: 0, color: '#831843', fontWeight: '600' }}>
                    🎯 Automatización
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#be185d', fontSize: '14px' }}>
                    Automatiza procesos de renovación y notificaciones sin intervención
                  </p>
                </div>

                <div style={{
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <p style={{ margin: 0, color: '#92400e', fontWeight: '600' }}>
                    📞 Soporte Prioritario
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#b45309', fontSize: '14px' }}>
                    Acceso a soporte prioritario para tu negocio mayorista
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Modal: Agregar Cliente */}
      <Modal open={showAddClientModal} onClose={() => setShowAddClientModal(false)}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1d1d1f' }}>
            ➕ Nuevo Cliente {selectedServiceForClient && `- ${selectedServiceForClient.product_name}`}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#86868b' }}>
            {selectedServiceForClient ? 'Crea un nuevo cliente y asigna esta credencial' : 'Agrega un nuevo cliente a tu CRM'}
          </p>
        </div>

        {selectedServiceForClient && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#1e40af' }}>
              <strong>📌 Credencial seleccionada:</strong> {selectedServiceForClient.product_name}
            </p>
            {selectedServiceForClient.credential_email && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#1e3a8a' }}>
                {selectedServiceForClient.credential_email}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleAddClient}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Nombre completo *
            </label>
            <input 
              type="text"
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Email *
            </label>
            <input 
              type="email"
              placeholder="juan@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Teléfono
            </label>
            <input 
              type="tel"
              placeholder="+506 8765-4321"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Credencial a asignar {selectedServiceForClient ? '(seleccionada)' : '*'}
            </label>
            {selectedServiceForClient ? (
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                color: '#1d1d1f'
              }}>
                <strong>{selectedServiceForClient.product_name}</strong>
                {selectedServiceForClient.credential_email && (
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {selectedServiceForClient.credential_email}
                  </div>
                )}
              </div>
            ) : (
              <select 
                value={formData.credential_id}
                onChange={(e) => {
                  const credentialId = e.target.value;
                  const service = purchasedServices.find(s => s.credential_id === credentialId && isServiceActive(s));
                  if (service) {
                    setSelectedServiceForClient(service);
                    setFormData({ ...formData, credential_id: credentialId });
                  }
                }}
                style={{ 
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="">Selecciona una credencial de tus compras</option>
                {purchasedServices.filter(s => isServiceActive(s)).map((service: Service) => {
                  const assignedClient = getClientByCredentialId(service.credential_id);
                  const isAssigned = !!assignedClient;
                  return (
                    <option 
                      key={service.id} 
                      value={service.credential_id || ""}
                      disabled={isAssigned}
                      style={{
                        color: isAssigned ? '#999' : '#000'
                      }}
                    >
                      {service.product_name} {service.profile_name ? `(${service.profile_name})` : ''} {service.credential_email ? `- ${service.credential_email}` : ''}{isAssigned ? ` [Asignada a ${assignedClient?.name}]` : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Notas
            </label>
            <textarea 
              placeholder="Agrega notas sobre este cliente..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minHeight: '100px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddClientModal(false)}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Agregar Cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Cliente */}
      <Modal open={showEditClientModal} onClose={() => setShowEditClientModal(false)}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1d1d1f' }}>
            ✏️ Editar Cliente
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#86868b' }}>
            Actualiza la información del cliente
          </p>
        </div>

        <form onSubmit={handleEditClient}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Nombre completo *
            </label>
            <input 
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Email *
            </label>
            <input 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Teléfono
            </label>
            <input 
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Credencial asignada
            </label>
            <select 
              value={selectedServiceForClient?.credential_id || ""}
              onChange={(e) => {
                const credentialId = e.target.value;
                const service = purchasedServices.find(s => s.credential_id === credentialId);
                setSelectedServiceForClient(service || null);
                if (service?.credential_id) {
                  setFormData({ ...formData, credential_id: service.credential_id });
                } else {
                  setFormData({ ...formData, credential_id: "" });
                }
              }}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none'
              }}
            >
              <option value="">Sin credencial asignada</option>
              <optgroup label="Activas">
                {purchasedServices.filter(s => isServiceActive(s)).map((service: Service) => {
                  const assignedClient = getClientByCredentialId(service.credential_id);
                  const isAssigned = !!assignedClient && assignedClient.id !== editingClient?.id;
                  return (
                    <option 
                      key={service.id} 
                      value={service.credential_id || ""}
                      disabled={isAssigned}
                      style={{
                        color: isAssigned ? '#999' : '#000'
                      }}
                    >
                      {service.product_name} {service.profile_name ? `(${service.profile_name})` : ''} {service.credential_email ? `- ${service.credential_email}` : ''}{isAssigned ? ` [Asignada a ${assignedClient?.name}]` : ''}
                    </option>
                  );
                })}
              </optgroup>
              {purchasedServices.filter(s => !isServiceActive(s)).length > 0 && (
                <optgroup label="Vencidas">
                  {purchasedServices.filter(s => !isServiceActive(s)).map((service: Service) => {
                    const assignedClient = getClientByCredentialId(service.credential_id);
                    const isAssigned = !!assignedClient && assignedClient.id !== editingClient?.id;
                    return (
                      <option 
                        key={service.id} 
                        value={service.credential_id || ""}
                        disabled={isAssigned}
                        style={{
                          color: isAssigned ? '#999' : '#000'
                        }}
                      >
                        {service.product_name} {service.profile_name ? `(${service.profile_name})` : ''} {service.credential_email ? `- ${service.credential_email}` : ''} [Vencida]{isAssigned ? ` [Asignada a ${assignedClient?.name}]` : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#1d1d1f' }}>
              Notas
            </label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ 
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minHeight: '100px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowEditClientModal(false)}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Upgrade a PRO */}
      <Modal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⭐</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1d1d1f' }}>
            Actualiza a CRM PRO
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#86868b' }}>
            Desbloquea funcionalidades premium para tu negocio
          </p>
        </div>

        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          border: '2px solid #10b981'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <p style={{ margin: '0 0 4px 0', color: '#065f46', fontSize: '16px', fontWeight: '700' }}>
              💰 Sube tu descuento de 20% a 25%
            </p>
            <p style={{ margin: 0, color: '#047857', fontSize: '13px' }}>
              En todos los productos streaming e IPTV
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#f5f5f7',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 6px 0', color: '#1d1d1f', fontSize: '14px', fontWeight: '500' }}>
              ✅ Recordatorios Automáticos
            </p>
            <p style={{ margin: 0, color: '#86868b', fontSize: '13px' }}>
              Envía SMS y email automáticos a tus clientes antes de que venza su servicio
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 6px 0', color: '#1d1d1f', fontSize: '14px', fontWeight: '500' }}>
              ✅ Analytics Completos
            </p>
            <p style={{ margin: 0, color: '#86868b', fontSize: '13px' }}>
              Visualiza estadísticas completas de tus clientes y servicios
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          border: '1px solid #86efac'
        }}>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: '600', color: '#10b981' }}>
            $24.95 / mes
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowUpgradeModal(false)}
            style={{ flex: 1 }}
          >
            Ahora no
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleUpgradeToPRO}
            style={{ flex: 1 }}
          >
            Actualizar a PRO
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toastMsg && (
        <div className={`toast${toastOk ? " ok" : " err"}`}>{toastMsg}</div>
      )}
    </div>
  );
}
