# 🎯 CRM Modularización - Cómo Funciona

## 📊 Resumen Ejecutivo

Se refactorizó el módulo CRM de **1.429 líneas en un solo archivo** a una **arquitectura modular con 495 líneas** distribuidas en:
- **5 componentes reutilizables**
- **3 custom hooks**
- **2 archivos de utilidades**

**Reducción: 65.4% menos código en page.tsx** ✨

---

## 🏗️ Arquitectura

### Page.tsx (495 líneas) - Orquestador Principal
```
page.tsx es solo el "director de orquesta"
  ↓
Importa hooks para lógica de datos y operaciones
  ↓
Importa componentes para renderizado
  ↓
Define handlers para eventos del usuario
  ↓
Renderiza todo coordinadamente
```

**Responsabilidades:**
- ✅ Orquestar hooks y componentes
- ✅ Manejar estado local de UI (modales, toasts, búsqueda)
- ✅ Definir handlers que conectan acciones del usuario con hooks
- ✅ Verificar acceso y renderizar estado correcto

---

## 🧩 Componentes (5 archivos)

### 1. **ClientsTable.tsx** (~150 líneas)
Tabla de clientes con todas sus acciones.

**Props recibe:**
```typescript
{
  clients: CRMClient[]              // Lista de clientes
  services: Service[]               // Servicios para lookup
  searchText: string                // Texto de búsqueda
  onEdit: (client: CRMClient)      // Callback para editar
  onDelete: (clientId: string)     // Callback para eliminar
  onAddNew: () => void             // Callback para nuevo cliente
}
```

**Lo que hace:**
- Filtra clientes según searchText
- Muestra tabla con: nombre, email, teléfono, servicio, vencimiento, estado
- Calcula días hasta vencimiento y muestra badge (activo/pronto/vencido)
- Botones: Editar y Eliminar

---

### 2. **CredentialsSection.tsx** (~250 líneas)
Sección de credenciales disponibles con filtros.

**Props recibe:**
```typescript
{
  services: Service[]
  clients: CRMClient[]
  filter: 'all' | 'unassigned' | 'assigned'
  onFilterChange: (filter) => void
  filteredCredentials: Service[]         // Ya filtradas
  counts: {all, unassigned, assigned}
  onAssignClick: (service: Service) => void
}
```

**Lo que hace:**
- Muestra 3 botones de filtro (Todas, Por Asignar, Asignadas)
- Renderiza tarjetas de credenciales
- Muestra estado: "Asignada a [cliente]" o "Activo"
- Botón "Asignar a Cliente" o badge de asignación

---

### 3. **ClientModals.tsx** (~350 líneas)
Modales para crear y editar clientes (2 modales en 1 componente).

**Props recibe:**
```typescript
{
  showAddModal: boolean
  showEditModal: boolean
  editingClient: CRMClient | null
  selectedService: Service | null
  formData: FormData
  services: Service[]
  clients: CRMClient[]
  operationLoading: boolean
  operationError: string | null
  onFormChange: (field, value) => void
  onAddClose: () => void
  onEditClose: () => void
  onServiceSelect: (service) => void
  onAddSubmit: (e) => void
  onEditSubmit: (e) => void
}
```

**Lo que hace:**
- Modal "Nuevo Cliente": formulario para crear cliente
- Modal "Editar Cliente": formulario para actualizar cliente
- Ambos con los mismos campos: nombre, email, teléfono, credencial, notas
- Dropdown de credenciales deshabilita las ya asignadas
- Muestra errores si hay

---

### 4. **AccessDenied.tsx** (~50 líneas)
Pantalla cuando usuario no tiene acceso a CRM.

**Props recibe:**
```typescript
{
  subscription: UserSubscription | null
}
```

**Lo que hace:**
- Muestra mensaje: "Acceso no autorizado"
- Explica qué suscripciones dan acceso
- Botones: "Adquirir CRM PLUS" y "Volver al inicio"

---

### 5. **LoadingState.tsx** (~30 líneas)
Pantalla mientras se cargan datos.

**Lo que hace:**
- Muestra spinner/icono ⏳
- Mensaje: "Cargando CRM..."

---

## 🪝 Custom Hooks (3 archivos)

### 1. **useCRMData.ts** (~60 líneas)
Hook para cargar datos de suscripción y clientes.

**Lo que hace:**
```typescript
const {
  clients,           // Array de CRMClient
  purchasedServices, // Array de Service (credenciales)
  subscription,      // UserSubscription
  loading,           // boolean
  error,            // string | null
  refetch            // () => Promise<void> - para recargar manualmente
} = useCRMData();
```

**Cómo funciona:**
1. En montaje (`useEffect`), llama a 2 endpoints:
   - `GET /api/me/overview` → obtiene subscription y active_services
   - `GET /api/crm/clients` → obtiene clientes
2. Maneja errores gracefully
3. Devuelve `refetch()` para que los componentes puedan recargar datos

---

### 2. **useCRMClients.ts** (~100 líneas)
Hook para operaciones CRUD (crear, actualizar, eliminar clientes).

**Lo que hace:**
```typescript
const {
  addClient,       // (formData) => Promise<CRMClient | null>
  updateClient,    // (clientId, formData) => Promise<CRMClient | null>
  deleteClient,    // (clientId) => Promise<boolean>
  operationError,  // string | null - último error
  operationLoading // boolean - mientras está haciendo request
} = useCRMClients(onSuccess);  // onSuccess = callback cuando termina bien
```

**Cómo funciona:**
1. Recibe `onSuccess` callback (generalmente es `refetch` de useCRMData)
2. `addClient(formData)` → POST /api/crm/clients
3. `updateClient(id, formData)` → PUT /api/crm/clients/{id}
4. `deleteClient(id)` → DELETE /api/crm/clients/{id}
5. Cuando funciona → llama `onSuccess()` para recargar datos
6. Si hay error → guarda en `operationError`

---

### 3. **useCredentialFilters.ts** (~35 líneas)
Hook para estado de filtros de credenciales.

**Lo que hace:**
```typescript
const {
  filter,              // 'all' | 'unassigned' | 'assigned'
  setFilter,           // (filter) => void
  filteredCredentials, // Service[] ya filtrada
  counts: {
    all,         // total de credenciales activas
    unassigned,  // sin asignar
    assigned     // asignadas a clientes
  }
} = useCredentialFilters(purchasedServices, clients);
```

**Cómo funciona:**
1. Usa `useMemo` para no recalcular si los datos no cambian
2. Cuando cambia `filter`, recalcula `filteredCredentials`
3. Calcula counts siempre (para los badges)

---

## 📁 Utilities (2 archivos)

### 1. **helpers.ts** (~70 líneas)
Funciones puras y reutilizables.

```typescript
// Formatting
fmtDate(dateString?) → "01/01/25"

// Service checks
isServiceActive(service: Service) → boolean
getDaysUntilExpiry(expiryDate?) → number | null
getExpiryStatus(daysLeft?) → 'active' | 'soon' | 'expired' | 'none'

// Lookups
getServiceByCredentialId(credentialId, services) → Service | undefined
getClientByCredentialId(credentialId, clients) → CRMClient | undefined

// Filtering
getFilteredCredentials(services, filter, clients) → Service[]
```

**Características:**
- Sin dependencias de hooks o componentes
- Fácil de testear
- Reutilizable en cualquier lugar

---

### 2. **validation.ts** (~30 líneas)
Funciones de validación.

```typescript
// Validar formulario de cliente
validateClientForm(formData) → { valid: boolean, error?: string }
// Revisa: nombre y email no vacíos

// Validar credential no ya asignada
validateCredentialNotAssigned(credentialId, clients, excludeClientId?) 
  → { valid: boolean, error?: string }
// Revisa: credential no esté asignada a otro cliente
// (salvo si es el mismo cliente que se está editando)
```

---

## 🔄 Flujo Completo: Crear Cliente

```
Usuario hace click en "+ Nuevo Cliente"
        ↓
showAddClientModal = true (state en page.tsx)
        ↓
<ClientModals showAddModal={true} /> renderiza
        ↓
Usuario llena formulario y hace click en "Agregar Cliente"
        ↓
onAddSubmit() se dispara:
  1. validateClientForm() - verifica nombre/email
  2. validateCredentialNotAssigned() - verifica credencial libre
  3. useCRMClients.addClient(formData)
        ↓
Hook llama: POST /api/crm/clients con formData
        ↓
Backend valida y crea cliente
        ↓
Si OK:
  - onSuccess() se ejecuta
  - onSuccess === handleRefresh
  - handleRefresh() llama useCRMData.refetch()
  - refetch() hace 2 llamadas GET para actualizar datos
  - page.tsx re-renderiza con nuevos datos
  - ClientsTable muestra nuevo cliente
  - Toast muestra: "✅ Cliente agregado correctamente"
  - Modal se cierra
        ↓
Si error:
  - operationError se actualiza
  - ClientModals muestra error en rojo
  - Usuario puede reintentar
```

---

## 💾 Flujo de Datos en el Componente

```
page.tsx (1 instancia)
    ↓
    ├── useCRMData()
    │   ├── clients ────────→ ClientsTable
    │   ├── purchasedServices → CredentialsSection, ClientModals
    │   ├── subscription ─→ AccessDenied (si no tiene acceso)
    │   └── refetch() ──→ onSuccess en useCRMClients
    │
    ├── useCRMClients(handleRefresh)
    │   ├── addClient ──→ ClientModals.onAddSubmit
    │   ├── updateClient → ClientModals.onEditSubmit
    │   ├── deleteClient → ClientsTable.onDelete
    │   └── operationError → ClientModals (mostrar error)
    │
    ├── useCredentialFilters(purchasedServices, clients)
    │   ├── filter ──→ CredentialsSection (botones)
    │   ├── filteredCredentials → CredentialsSection (renderizar)
    │   └── counts → CredentialsSection (badges)
    │
    └── Renderiza:
        ├── ClientsTable (props: clients, services, handlers)
        ├── CredentialsSection (props: services, clients, filter, handlers)
        ├── ClientModals (props: formData, handlers, state)
        ├── LoadingState (si loading === true)
        ├── AccessDenied (si sin acceso)
        └── Toast (feedback)
```

---

## ✅ Ventajas de Esta Arquitectura

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Tamaño de page.tsx** | 1.429 líneas | 495 líneas |
| **Complejidad** | Monolítica | Modular |
| **Testeable** | Difícil | Fácil (cada componente/hook independiente) |
| **Reutilizable** | No | Sí (hooks y componentes) |
| **Mantenible** | Difícil (mucho código) | Fácil (código separado por responsabilidad) |
| **Performance** | Básica | Mejor (memoización en hooks) |
| **Legibilidad** | Confusa | Clara (flujo unidireccional) |

---

## 🚀 Próximos Pasos (si necesario)

1. **Lazy load componentes**: Usar `React.lazy()` en ClientModals
2. **Unit tests**: Testear cada hook y componente por separado
3. **Error boundary**: Envolver componentes en ErrorBoundary
4. **Suspense**: Agregar Suspense para carga de componentes lazy
5. **Storybook**: Documentar componentes interactivamente
6. **Analytics**: Trackear eventos (crear cliente, editar, etc)

---

## 📝 Notas

- **Todos los componentes aún usan inline styles** - podrían moverse a CSS/Tailwind
- **Toast es básico** - podrías usar una librería como `react-toastify`
- **Validación es básica** - considera usar `zod` o `react-hook-form` para validación más robusta
- **Backend es single-tenant** (por tenant_id) - ver que las queries filtren por usuario actual

---

Generated: Enero 9, 2026
