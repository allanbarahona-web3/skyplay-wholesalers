"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

const TABS = [
  { key: "dashboard", label: "📊 Dashboard", icon: "📊" },
  { key: "mayoristas", label: "👥 Mayoristas", icon: "👥" },
  { key: "inventario", label: "📦 Inventario", icon: "📦" },
  { key: "servicios", label: "⚙️ Servicios", icon: "⚙️" },
  { key: "pagos", label: "💰 Pagos", icon: "💰" },
  { key: "garantia", label: "🛡️ Garantía", icon: "🛡️" },
  { key: "logs", label: "📋 Logs", icon: "📋" },
  { key: "solicitudes", label: "📝 Solicitudes", icon: "📝" },
];

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div id="admin-root">
      {/* Apple-style sticky header */}
      <header className="apple-header">
        <div className="apple-header-content">
          <div className="apple-header-left">
            <img src="/White on Transparent.png" alt="Logo" className="apple-logo" />
            <div className="apple-divider"></div>
            <span className="apple-header-title">Panel Admin</span>
          </div>
          <div className="apple-header-right">
            <button className="apple-btn-link" onClick={() => router.push("/")}>
              <span>🏪</span> Tienda
            </button>
            <button className="apple-btn-link" onClick={() => router.push("/panel")}>
              <span>📊</span> Panel
            </button>
            <button className="apple-btn-link" onClick={() => router.push("/login")}>
              <span>👤</span> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="admin-container">
        {/* Tabs navigation */}
        <nav className="admin-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`admin-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label.split(' ')[1]}</span>
            </button>
          ))}
        </nav>
        <SectionDashboard active={activeTab === "dashboard"} />
        <SectionMayoristas active={activeTab === "mayoristas"} />
        <SectionInventario active={activeTab === "inventario"} />
        <SectionServicios active={activeTab === "servicios"} />
        <SectionPagos active={activeTab === "pagos"} />
        <SectionGarantia active={activeTab === "garantia"} />
        <SectionLogs active={activeTab === "logs"} />
        <SectionSolicitudes active={activeTab === "solicitudes"} />
      </div>
    </div>
  );
}

function SectionDashboard({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">📊 Resumen y Alertas</h2>
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Servicios por vencer</div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Pagos pendientes</div>
          </div>
        </div>
        <div className="stat-card alert">
          <div className="stat-icon">🛡️</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Reportes garantía</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionMayoristas({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">👥 Gestión de Mayoristas</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Credenciales</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay mayoristas registrados
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionInventario({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">📦 Inventario de Credenciales</h2>
      <div className="admin-card">
        <div className="upload-area">
          <input type="file" id="csv-upload" className="file-input" accept=".csv" />
          <label htmlFor="csv-upload" className="file-label">
            <span className="file-icon">📄</span>
            <span>Seleccionar archivo CSV</span>
          </label>
          <button className="btn-table">Subir CSV</button>
        </div>
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Credencial</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay credenciales en inventario
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionServicios({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">⚙️ Servicios y Suscripciones</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Mayorista</th>
                <th>Producto</th>
                <th>Credencial</th>
                <th>Estado</th>
                <th>Vence</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay servicios activos
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionPagos({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">💰 Pagos Manuales</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Mayorista</th>
                <th>Método</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay pagos pendientes
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionGarantia({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">🛡️ Reportes de Garantía</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Mayorista</th>
                <th>Credencial</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay reportes de garantía
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionLogs({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">📋 Historial y Auditoría</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay registros en el log
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionSolicitudes({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="admin-section">
      <h2 className="section-title">📝 Solicitudes de Mayorista</h2>
      <div className="admin-card">
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>País</th>
                <th>Teléfono</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="td-muted" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay solicitudes pendientes
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
