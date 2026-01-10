# CRM - Arquitectura de Datos

## 1. FLUJO DE DATOS: Panel Mayorista → CRM

### Panel Mayorista (panel/page.tsx)
- Muestra **servicios activos** del tenant
- Obtiene datos de `/api/me/overview` 
- Respuesta incluye: `active_services[]` con estructura:
```
{
  id: UUID,
  product_code: string,     // ej: "NETFLIX", "IPTV-PREM"
  product_name: string,     // ej: "Netflix Premium"
  status: string,           // "active", "expired", "suspended"
  created_at: timestamp,
  expires_at: timestamp,
  credential_email?: string,
  credential_password?: string,
  profile_name?: string,
  pin?: string
}
```

### Estructura Base de Datos

#### Tabla: `credentials`
- Almacena las credenciales de acceso
- Campos principales:
  - `id` (UUID) - Identificador único
  - `product_code` (text) - Código del producto (ej: "NETFLIX")
  - `email` (text) - Email/usuario de la credencial
  - `password` (text) - Contraseña
  - `profile_name` (text) - Nombre del perfil
  - `pin` (text) - PIN si aplica
  - `status` (text) - "available", "assigned", "canceled"
  - `assigned_to` (UUID FK) - Referencia a qué servicio está asignada
  - `tenant_id` (int) - Propietario de la credencial
  - `created_at` (timestamp)

#### Tabla: `services`
- Almacena los servicios comprados/activos
- Campos principales:
  - `id` (UUID) - Identificador único
  - `tenant_id` (bigint) - Propietario del servicio
  - `product_code` (text) - Código del producto
  - `status` (text) - "active", "expired", "suspended", "replaced"
  - `credential_id` (UUID FK) - Credencial asignada
  - `starts_at` (timestamp)
  - `expires_at` (timestamp)
  - `created_at` (timestamp)

#### Tabla: `crm_clients`
- Almacena clientes del CRM
- Campos principales:
  - `id` (UUID)
  - `tenant_id` (int) - Propietario del cliente
  - `name` (text) - Nombre del cliente
  - `email` (text) - Email del cliente
  - `phone` (text)
  - `credential_id` (UUID FK) - Credencial asignada a este cliente
  - `expires_at` (timestamp) - Cuando vence el acceso para este cliente
  - `notes` (text)
  - `created_at` (timestamp)

## 2. PROBLEMA ACTUAL

El endpoint `/api/crm/available-credentials` está buscando:
```sql
SELECT c.* FROM credentials c
INNER JOIN services s ON c.id = s.credential_id
WHERE s.tenant_id = $1
  AND c.created_at >= (CURRENT_TIMESTAMP - INTERVAL '15 minutes')
```

**Problemas:**
1. **INNER JOIN services**: Busca solo credenciales que están ASIGNADAS a un servicio
2. **Última 15 minutos**: Solo muestra credenciales compradas hace menos de 15 minutos
3. **Lógica invertida**: Las credenciales NO tienen un campo `assigned_to` que apunte a servicios
   - Es al revés: `services.credential_id` → `credentials.id`

## 3. SOLUCIÓN PROPUESTA

### Opción A: Mostrar TODAS las credenciales disponibles del tenant
```sql
SELECT 
  c.id,
  c.product_code,
  c.email,
  c.status,
  c.created_at,
  (SELECT COUNT(*) FROM crm_clients WHERE credential_id = c.id) as clients_assigned
FROM credentials c
WHERE c.tenant_id = $1
  AND c.status IN ('available', 'assigned')  -- O solo 'available' si prefieres no reasignar
ORDER BY c.created_at DESC;
```

### Opción B: Mostrar credenciales con información del servicio
```sql
SELECT 
  c.id,
  c.product_code,
  c.email,
  c.profile_name,
  c.pin,
  c.status,
  c.created_at,
  s.expires_at as service_expires_at,
  (SELECT COUNT(*) FROM crm_clients WHERE credential_id = c.id) as clients_assigned
FROM credentials c
LEFT JOIN services s ON c.id = s.credential_id
WHERE c.tenant_id = $1
  AND c.status IN ('available', 'assigned')
ORDER BY c.created_at DESC;
```

## 4. FLUJO DE DATOS CORRECTO

### 1️⃣ Usuario compra un servicio en el Panel Mayorista
   - Se crea registro en `services` tabla
   - Se asigna/crea registro en `credentials` tabla
   - Se guarda `credentials.id` en `services.credential_id`

### 2️⃣ Usuario accede al CRM
   - Solicita `/api/crm/available-credentials`
   - Backend retorna lista de credenciales del tenant
   - Frontend muestra opciones disponibles

### 3️⃣ Usuario agrega un cliente en CRM
   - Selecciona credencial de la lista
   - Frontend POST a `/api/crm/clients` con `credential_id`
   - Backend crea registro en `crm_clients` tabla
   - Cliente ahora tiene acceso a esa credencial

## 5. DATOS QUE SE GUARDAN

### En `crm_clients` tabla:
```
{
  id: UUID,                    // Auto-generado
  tenant_id: int,              // Del usuario autenticado
  name: string,                // Entrada del usuario
  email: string,               // Entrada del usuario
  phone: string,               // Entrada del usuario (opcional)
  credential_id: UUID,         // Seleccionado del dropdown
  expires_at: timestamp,       // Entrada del usuario (opcional)
  notes: string,               // Entrada del usuario (opcional)
  created_at: timestamp,       // Auto-generado
  updated_at: timestamp        // Auto-generado
}
```

## 6. IMPLEMENTACIÓN NECESARIA

### Backend Fix (crm.service.ts):
- Arreglar la query `getAvailableCredentials()`
- Cambiar INNER JOIN a búsqueda directa en tabla `credentials`
- Remover el filtro de "últimas 15 minutos"

### Frontend (crm/page.tsx):
- El dropdown ya está listo, solo necesita recibir datos del backend
- Los datos se guardan automáticamente cuando se selecciona una credencial

