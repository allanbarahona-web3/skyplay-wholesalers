# Lógica de Descuentos - Suscripciones Preferencial, CRM PRO y Tienda

## Resumen
Los descuentos aplican **SOLO a productos de categoría IPTV y Streaming**.  
**IMPORTANTE**: Se aplica el MÁXIMO descuento, NUNCA se acumulan.

## Categorías de Productos

| Categoría | Descuentos Aplicables | Estado |
|-----------|-----|--------|
| **IPTV** | Suscripción, CRM, Tienda | ✅ Activo |
| **Streaming** | Suscripción, CRM, Tienda | ✅ Activo |
| **Créditos** | Ninguno | ✅ Activo |
| **GiftCards** | Ninguno | ⏳ Futuro |
| **Software** | Ninguno | ⏳ Futuro |

## Descuentos por Producto

| Producto | Descuento | Aplica a | Notas |
|----------|-----------|----------|-------|
| **Suscripción Preferencial** | 20% | IPTV, Streaming | Máximo básico |
| **CRM PRO** | 25% | IPTV, Streaming | Intermedio |
| **Tienda Personalizada** | 30% | IPTV, Streaming | Máximo disponible |

## Lógica de Máximo Descuento (NO SE ACUMULAN)

**Ejemplo 1**: Usuario con Suscripción + CRM PRO activos
```
- Suscripción: 20%
- CRM PRO: 25%
- Se aplica: MÁXIMO = 25% (NO 45%)
```

**Ejemplo 2**: Usuario con todos activos (Suscripción + CRM PRO + Tienda)
```
- Suscripción: 20%
- CRM PRO: 25%
- Tienda: 30%
- Se aplica: MÁXIMO = 30% (NO 75%)
```

**Ejemplo 3**: Usuario sin suscripciones activas
```
- Se aplica: 0% (sin descuento)
```

## Implementación en Backend

### Endpoints que Aplican Descuentos (4 Métodos de Pago)

1. **POST `/services/purchase`** - Billetera (Wallet)
   - Verifica todas las suscripciones activas
   - Calcula máximo descuento
   - Solo aplica si categoría es IPTV o Streaming

2. **POST `/services/create-stripe-checkout`** - Stripe
   - Verifica todas las suscripciones activas
   - Calcula máximo descuento
   - Solo aplica si categoría es IPTV o Streaming

3. **POST `/services/create-sinpe-checkout`** - SINPE
   - Verifica todas las suscripciones activas
   - Calcula máximo descuento
   - Solo aplica si categoría es IPTV o Streaming

4. **POST `/services/create-paypal-checkout`** - PayPal
   - Verifica todas las suscripciones activas
   - Calcula máximo descuento
   - Solo aplica si categoría es IPTV o Streaming

### Código de Validación (En todos los métodos)

```typescript
// Obtener TODAS las suscripciones activas del usuario
const allSubs = await client.query(
  `SELECT product_type FROM subscriptions 
   WHERE tenant_id = $1 AND current_period_end > NOW()`,
  [tenant_id]
);

// Mapeo de descuentos
const discounts: { [key: string]: number } = {
  'subscription-pref': 0.20,    // 20% - Suscripción Preferencial
  'crm-pro': 0.25,              // 25% - CRM PRO
  'tienda': 0.30                // 30% - Tienda
};

// Obtener el MÁXIMO (no acumula)
discount = Math.max(...allSubs.rows.map(s => discounts[s.product_type] || 0), 0);

// Aplicar al precio
const totalPrice = unitPrice * quantity * (1 - discount);
```

### Cambios Realizados (v2)

✅ Normalizado "streaming" → "Streaming" en BD
✅ Actualizado `/services/purchase` - Billetera
✅ Actualizado `/services/create-stripe-checkout` - Stripe  
✅ Actualizado `/services/create-sinpe-checkout` - SINPE
✅ Actualizado `/services/create-paypal-checkout` - PayPal
✅ Implementada lógica de MÁXIMO descuento (no acumula)
✅ Descuentos para Pref (20%), CRM PRO (25%), Tienda (30%)

## Cálculo de Precio - Ejemplos

**Producto Netflix 1 Mes ($10 USD)**

Con Suscripción Preferencial (20%):
```
$10.00 × (1 - 0.20) = $8.00
```

Con Suscripción + CRM PRO (máximo 25%):
```
$10.00 × (1 - 0.25) = $7.50  ← Máximo, no 30%
```

Con Suscripción + CRM PRO + Tienda (máximo 30%):
```
$10.00 × (1 - 0.30) = $7.00  ← Máximo absoluto
```

## Próximos Pasos

1. ⏳ Crear categoría "GiftCards" en BD
2. ⏳ Crear categoría "Software" en BD
3. ⏳ Validación en frontend para mostrar descuentos dinámicos
4. ⏳ Webhook de PayPal/Stripe para procesar pagos con descuentos
5. ⏳ Dashboard de análisis de descuentos aplicados

## Notas Importantes

- ⚠️ El descuento se aplica **DURANTE LA COMPRA**, no después
- ⚠️ La suscripción debe estar activa (`current_period_end > NOW()`)
- ⚠️ **NUNCA se acumulan descuentos** - siempre es el máximo
- ⚠️ Los descuentos se registran en `billing_events` para auditoría
- ⚠️ Productos de créditos (CREDITS_*) NO reciben descuentos
- ✅ Válido para los 4 métodos de pago (Billetera, Stripe, SINPE, PayPal)
