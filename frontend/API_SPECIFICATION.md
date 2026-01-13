# 📋 ESPECIFICACIÓN DE API ESPERADA - FE Planes Mayorista

## Resumen
Este documento define la API esperada del Backend para que el Frontend funcione correctamente. El BE debe ser independiente y tener RLS bien implementado.

---

## 🔐 AUTENTICACIÓN

### 1. POST `/api/auth/login` (LOGIN OTP)
**Descripción:** Inicia sesión con email, contraseña y código TOTP  
**Requiere:** No (público)  
**Método:** POST

**Request Body:**
```json
{
  "email": "mayorista@empresa.com",
  "password": "contraseña123",
  "otp": "123456"
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "mayorista@empresa.com",
    "tenant_id": 10,
    "role": "reseller"
  }
}
```

**Response Error (401/400):**
```json
{
  "ok": false,
  "error": "Credenciales inválidas"
}
```

**Cookies:** DEBE setear cookie `sky_sid` con JWT (HttpOnly, Secure, SameSite=Lax, MaxAge=24h)

---

### 2. POST `/api/auth/register` (CREAR CUENTA)
**Descripción:** Registra nuevo mayorista  
**Requiere:** No (público)  
**Método:** POST

**Request Body:**
```json
{
  "email": "nuevo@empresa.com",
  "password": "contraseña123",
  "company_name": "Mi Empresa SRL",
  "context": "catalog" // o "login"
}
```

**Response Success (201):**
```json
{
  "ok": true,
  "user": {
    "id": 5,
    "email": "nuevo@empresa.com",
    "tenant_id": 15,
    "role": "admin"  // primer usuario es admin del tenant
  }
}
```

**Validaciones:**
- Email único
- Contraseña ≥ 8 caracteres
- Company_name requerido

---

### 3. POST `/api/auth/logout` (LOGOUT)
**Descripción:** Cierra sesión y revoca token  
**Requiere:** AuthGuard  
**Método:** POST

**Response:**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

**Acciones:**
- Limpiar cookie `sky_sid`
- Insertar JWT en tabla `revoked_tokens` (para RLS)

---

## 📦 CATÁLOGO

### 4. GET `/api/services/catalog` (CATÁLOGO PÚBLICO)
**Descripción:** Obtiene lista de productos sin precios si no está autenticado  
**Requiere:** No (público, pero diferencia autenticado)  
**Método:** GET

**Response Success (200):**
```json
[
  {
    "code": "NETFLIX_BASIC",
    "name": "Netflix Basic",
    "category": "Streaming",
    "price": "3.99",
    "stock": 150
  },
  {
    "code": "IPTV_PLUS",
    "name": "IPTV Plus",
    "category": "IPTV",
    "price": "4.50",
    "stock": 200
  }
]
```

**Nota:** Si el cliente no tiene cookie `sky_sid`, el FE NO mostrará los precios (UX).

---

### 5. GET `/api/me/overview` (OBTENER INFO DEL USUARIO)
**Descripción:** Obtiene datos del usuario autenticado, suscripción y saldo de billetera  
**Requiere:** AuthGuard  
**Método:** GET

**Response Success (200):**
```json
{
  "user": {
    "id": 1,
    "email": "mayorista@empresa.com",
    "tenant_id": 10,
    "role": "reseller"
  },
  "subscription": {
    "id": 100,
    "product_type": "preferential",
    "status": "active",
    "current_period_end": "2026-02-11T23:59:59Z"
  },
  "wallet_balance": 150.50
}
```

---

## 💰 COMPRAS

### 6. POST `/api/services/purchase` (COMPRA DE PRODUCTO)
**Descripción:** Compra un producto del catálogo  
**Requiere:** AuthGuard  
**Método:** POST

**Request Body:**
```json
{
  "product_code": "NETFLIX_BASIC",
  "quantity": 1
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "session_id": "cs_test_abcd1234",
  "stripe_url": "https://checkout.stripe.com/pay/cs_test_abcd1234",
  "orderId": 999,
  "amount": 3.99
}
```

**Lógica Esperada:**
- Validar que el tenant_id del usuario sea el que compra (RLS)
- Verificar stock disponible
- Si tiene suscripción activa → aplicar descuento 20-25% (solo categorías Streaming, IPTV)
- Crear orden con status "pending"
- Retornar URL de checkout (Stripe/PayPal)

---

## 📊 PANEL USUARIO

### 7. GET `/api/me/services` (MIS SERVICIOS/CREDENCIALES)
**Descripción:** Obtiene servicios activos del usuario  
**Requiere:** AuthGuard  
**Método:** GET

**Response Success (200):**
```json
{
  "ok": true,
  "services": [
    {
      "id": 500,
      "product_code": "NETFLIX_BASIC",
      "product_name": "Netflix Basic",
      "credential": {
        "email": "user123@netflix.com",
        "password": "encrypted_pass",
        "profile_name": "Perfil 1",
        "pin": null
      },
      "status": "active",
      "expires_at": "2026-02-11",
      "created_at": "2026-01-11"
    }
  ]
}
```

---

### 8. GET `/api/me/orders` (HISTORIAL DE COMPRAS)
**Descripción:** Obtiene historial de compras/ordenes  
**Requiere:** AuthGuard  
**Método:** GET

**Response Success (200):**
```json
{
  "ok": true,
  "orders": [
    {
      "id": 999,
      "product_code": "NETFLIX_BASIC",
      "product_name": "Netflix Basic",
      "quantity": 1,
      "original_price": 3.99,
      "final_price": 3.19,
      "discount": 0.20,
      "status": "completed",
      "payment_method": "stripe",
      "created_at": "2026-01-11T10:30:00Z"
    }
  ]
}
```

---

## 💳 BILLETERA VIRTUAL

### 9. POST `/api/wallet/recharge` (CARGAR BILLETERA)
**Descripción:** Recarga de billetera virtual  
**Requiere:** AuthGuard  
**Método:** POST

**Request Body:**
```json
{
  "amount": 50.00
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "session_id": "cs_test_wallet_1234",
  "stripe_url": "https://checkout.stripe.com/pay/cs_test_wallet_1234",
  "amount": 50.00
}
```

---

### 10. GET `/api/wallet/balance` (SALDO BILLETERA)
**Descripción:** Obtiene saldo actual  
**Requiere:** AuthGuard  
**Método:** GET

**Response Success (200):**
```json
{
  "ok": true,
  "balance": 150.50
}
```

---

## 🔑 JWT Y SEGURIDAD

### Cookie `sky_sid`
- **HttpOnly:** true (no accesible desde JS)
- **Secure:** true en producción
- **SameSite:** Lax
- **MaxAge:** 86400000 (24 horas)

### JWT Payload
```json
{
  "id": 1,
  "tenant_id": 10,
  "role": "reseller",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1673270000,
  "exp": 1673356400
}
```

### RLS (Row-Level Security) Esperado
- **Tabla:** users, services, crm_clients, subscriptions, billing_events
- **Filtro:** `tenant_id = current_tenant_id()`
- **Admin bypass:** Usuarios con role='admin' pueden ver otros tenants

---

## 📊 ESTRUCTURA DE TABLAS ESPERADA

```sql
-- Usuarios
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR DEFAULT 'reseller',
  is_active BOOLEAN DEFAULT true,
  totp_secret VARCHAR,
  totp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants/Mayoristas
CREATE TABLE tenants (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE,
  status VARCHAR DEFAULT 'active',
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servicios/Credenciales compradas
CREATE TABLE services (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  product_code VARCHAR NOT NULL,
  credential_id BIGINT,
  status VARCHAR DEFAULT 'active',
  expires_at DATE,
  paid_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos catálogo
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suscripciones
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  product_type VARCHAR,
  status VARCHAR DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens revocados (para logout/RLS)
CREATE TABLE revoked_tokens (
  id BIGSERIAL PRIMARY KEY,
  jti UUID UNIQUE NOT NULL,
  user_id BIGINT,
  expires_at TIMESTAMPTZ,
  reason VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Órdenes/Eventos de billing
CREATE TABLE billing_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  order_number VARCHAR,
  event_type VARCHAR,
  payload JSONB,
  source VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ✅ REQUISITOS DE SEGURIDAD

1. ✅ **RLS Activado:** Todas las tablas principales con RLS
2. ✅ **JWT Validation:** Validar firma en cada request
3. ✅ **JTI Check:** Validar que JTI no esté en revoked_tokens
4. ✅ **Tenant Isolation:** Nunca retornar datos de otros tenants
5. ✅ **Rate Limiting:** Recomendado en login y registro
6. ✅ **HTTPS Solo:** En producción

---

## 🚀 MIGRACION DEL BE ACTUAL AL NUEVO

### Pasos:
1. Verificar que el nuevo BE tiene todas estas tablas
2. Exportar datos del BE actual:
   - users, tenants, services, products, subscriptions, credentials
3. Importar en el nuevo BE
4. Cambiar `NEXT_PUBLIC_API_URL` en `.env.local` FE
5. Testear flujo completo

---

## 📝 NOTAS

- El FE NO realiza validaciones de negocio (es responsabilidad del BE)
- El FE SOLO cuida UX: mostrar/ocultar precios según autenticación
- El BE DEBE garantizar RLS y aislamiento de tenants
- Todo error HTTP ≥ 400 es tratado como error en el FE

