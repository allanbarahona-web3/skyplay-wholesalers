# Uso del Modal Genérico de Cancelación

El componente `CancelSubscriptionModal` ha sido refactorizado para ser reutilizable con cualquier tipo de suscripción en el Panel Mayorista.

## Props del Componente

```typescript
interface CancelSubscriptionModalProps {
  // Props obligatorias
  isOpen: boolean;
  onClose: () => void;
  onPause: () => void;
  onCancelAtEnd: () => void;
  onCancelNow: () => void;
  
  // Props opcionales con valores por defecto
  subscriptionEndDate?: string;
  remainingDays?: number;
  subscriptionType?: 'preferential' | 'crm-basic' | 'crm-pro' | 'tienda';
  subscriptionName?: string;
  benefitDescription?: string;
  discountPercent?: number;
}
```

## Ejemplos de Uso

### 1. Suscripción Preferencial (20% descuento)

```tsx
<CancelSubscriptionModal
  isOpen={showCancelModal}
  onClose={() => setShowCancelModal(false)}
  onPause={handlePauseSubscription}
  onCancelAtEnd={handleCancelAtEnd}
  onCancelNow={handleCancelNow}
  subscriptionEndDate={subscription.current_period_end}
  remainingDays={calculateRemainingDays(subscription.current_period_end)}
  subscriptionType="preferential"
  subscriptionName="Suscripción Preferencial"
  benefitDescription="descuento del 20%"
  discountPercent={20}
/>
```

### 2. CRM BASIC (Gestión de clientes)

```tsx
<CancelSubscriptionModal
  isOpen={showCRMCancelModal}
  onClose={() => setShowCRMCancelModal(false)}
  onPause={handlePauseCRM}
  onCancelAtEnd={handleCancelCRMAtEnd}
  onCancelNow={handleCancelCRMNow}
  subscriptionEndDate={crmBasic.current_period_end}
  remainingDays={calculateRemainingDays(crmBasic.current_period_end)}
  subscriptionType="crm-basic"
  subscriptionName="CRM BASIC"
  benefitDescription="acceso al CRM y herramientas de gestión"
  discountPercent={0}
/>
```

### 3. CRM PRO (25% descuento + Automatización)

```tsx
<CancelSubscriptionModal
  isOpen={showCRMProCancelModal}
  onClose={() => setShowCRMProCancelModal(false)}
  onPause={handlePauseCRMPro}
  onCancelAtEnd={handleCancelCRMProAtEnd}
  onCancelNow={handleCancelCRMProNow}
  subscriptionEndDate={crmPro.current_period_end}
  remainingDays={calculateRemainingDays(crmPro.current_period_end)}
  subscriptionType="crm-pro"
  subscriptionName="CRM PRO"
  benefitDescription="descuento del 25%, CRM avanzado y automatización"
  discountPercent={25}
/>
```

### 4. Tienda Personalizada (30% descuento)

```tsx
<CancelSubscriptionModal
  isOpen={showTiendaCancelModal}
  onClose={() => setShowTiendaCancelModal(false)}
  onPause={handlePauseTienda}
  onCancelAtEnd={handleCancelTiendaAtEnd}
  onCancelNow={handleCancelTiendaNow}
  subscriptionEndDate={tienda.current_period_end}
  remainingDays={calculateRemainingDays(tienda.current_period_end)}
  subscriptionType="tienda"
  subscriptionName="Tienda Personalizada"
  benefitDescription="descuento del 30%, tienda propia y marca personalizada"
  discountPercent={30}
/>
```

## Función Helper para Calcular Días Restantes

```typescript
const calculateRemainingDays = (endDate?: string): number | undefined => {
  if (!endDate) return undefined;
  const end = new Date(endDate).getTime();
  const now = new Date().getTime();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};
```

## Beneficios de la Refactorización

✅ **Reutilizable** - Un solo componente para todos los tipos de suscripciones
✅ **Mantenible** - Cambios visuales se aplican a todos los modales
✅ **Consistente** - Misma UX en toda la plataforma
✅ **Escalable** - Fácil agregar nuevos tipos de suscripciones
✅ **DRY** - No duplicar código para cada tipo de suscripción

## Estructura del Modal

El modal muestra 3 opciones:

1. **⏸️ Pausar Suscripción** (Azul #3b82f6)
   - Guarda días restantes
   - Reversible
   - Sin cargos durante pausa

2. **⏰ Cancelar al Final del Período** (Naranja #f59e0b)
   - Mantiene beneficios hasta expiración
   - No renueva automáticamente
   - Aprovecha tiempo pagado

3. **❌ Cancelar Inmediatamente** (Rojo #ef4444)
   - Pérdida inmediata de beneficios
   - Pérdida de tiempo restante
   - Sin reembolso

## Customización Futura

Para agregar más tipos de suscripciones, simplemente:

1. Actualiza el tipo `subscriptionType` en la interfaz
2. Usa el modal con los nuevos valores de props
3. No requiere cambios en el componente del modal
