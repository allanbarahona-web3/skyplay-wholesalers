function SectionServicios({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="servicios">
      <div className="card">
        <h2>Servicios y Suscripciones</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán los servicios desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import React, { useState } from "react";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "mayoristas", label: "Mayoristas" },
  { key: "inventario", label: "Inventario" },
  { key: "servicios", label: "Servicios" },
  { key: "pagos", label: "Pagos Manuales" },
  { key: "garantia", label: "Garantía" },
  { key: "logs", label: "Logs" },
  { key: "solicitudes", label: "Solicitudes Mayorista" },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="container">
  <h1 className="admin-title">Panel de Administración</h1>
  <nav className="admin-nav">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
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
  );
}

function SectionDashboard({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="dashboard">
      <div className="card">
        <h2>Resumen y Alertas</h2>
        <ul>
          <li>Servicios por vencer: <span id="alertVencidos">0</span></li>
          <li>Pagos manuales pendientes: <span id="alertPagos">0</span></li>
          <li>Reportes de garantía: <span id="alertGarantia">0</span></li>
        </ul>
      </div>
    </div>
  );
}

function SectionMayoristas({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="mayoristas">
      <div className="card">
        <h2>Gestión de Mayoristas</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán los mayoristas desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionInventario({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="inventario">
      <div className="card">
        <h2>Inventario de Credenciales</h2>
        <input type="file" className="input-csv" accept=".csv" />
        <button className="btn">Subir CSV</button>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Credencial</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Aquí se cargarán las credenciales desde backend */}
          </tbody>
        </table>
        <h2>Servicios y Suscripciones</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán los servicios desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionPagos({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="pagos">
      <div className="card">
        <h2>Pagos Manuales (SINPE, Transferencias)</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán los pagos manuales desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionGarantia({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="garantia">
      <div className="card">
        <h2>Reportes de Garantía</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán los reportes de garantía desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionLogs({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="logs">
      <div className="card">
        <h2>Historial y Auditoría</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {/* Aquí se cargarán los logs desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionSolicitudes({ active }: { active: boolean }) {
  return (
    <div className={`section${active ? " active" : ""}`} id="solicitudes">
      <div className="card">
        <h2>Solicitudes de Mayorista</h2>
        <table className="admin-table">
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
            {/* Aquí se cargarán las solicitudes desde backend */}
          </tbody>
        </table>
      </div>
    </div>
  );
}
