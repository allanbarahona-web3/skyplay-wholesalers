# Endpoints Admin - Órdenes SINPE

## Endpoints disponibles

### 1. Listar órdenes SINPE pendientes
```
GET /api/admin/orders/sinpe-pending
```

**Requiere:** Auth + Role Admin

**Respuesta:**
```json
[
  {
    "id": 123,
    "order_number": "A7G3K2P",
    "tenant_id": 5,
    "tenant_name": "Distribuidora XYZ",
    "tenant_email": "admin@xyz.com",
    "created_at": "2025-11-01T10:30:00Z",
    "payload": {
      "product_code": "NETFLIX_PREMIUM",
      "product_name": "Netflix Premium",
      "quantity": 1,
      "total_price": 6.30,
      "status": "pending"
    }
  }
]
```

### 2. Confirmar pago SINPE
```
POST /api/admin/orders/:orderId/confirm-sinpe
```

**Requiere:** Auth + Role Admin

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/admin/orders/123/confirm-sinpe \
  -H "Cookie: sky_sid=..." \
  -H "Content-Type: application/json"
```

**Qué hace:**
1. Verifica que la orden existe y está pendiente
2. Busca credencial disponible del producto
3. Crea el servicio y asigna la credencial
4. Actualiza stock del producto
5. Marca la orden como `purchase_completed`

**Respuesta exitosa:**
```json
{
  "success": true,
  "order_id": 123,
  "services": [
    {
      "id": "uuid-del-servicio",
      "credential": {
        "email": "netflix_premium_001@test.com",
        "password": "SecurePass123",
        "profile_name": "Profile 1",
        "pin": "1234"
      }
    }
  ],
  "message": "Order confirmed and credentials assigned"
}
```

**Errores posibles:**
- `404`: Order not found or already processed
- `400`: No available credentials for product

## Uso en Panel Admin (futuro)

Cuando implementes el panel admin, puedes:

1. Mostrar tabla con órdenes pendientes (usando GET endpoint)
2. Botón "Confirmar Pago" por cada orden (llama POST endpoint)
3. Después de confirmar, enviar email/WhatsApp con credenciales

## Notas importantes

- ⚠️ El endpoint NO envía emails automáticamente (por implementar en Fase 2)
- ✅ Las credenciales quedan asignadas y visibles en Panel Mayorista del usuario
- ✅ La orden cambia de `purchase_pending` a `purchase_completed`
- ✅ El stock del producto se reduce automáticamente
