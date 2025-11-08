/**
 * Cliente API centralizado para comunicarse con el backend NestJS
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Importante para enviar/recibir cookies
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

export interface LoginData {
  email: string;
  password: string;
  otp: string;
}

export interface LoginResponse {
  ok: boolean;
  user: {
    id: number;
    email: string;
    tenant_id: number | null;
    role: string;
  };
}

export interface SetupTotpResponse {
  qrcode: string;
  secret: string;
}

export interface ResetPasswordData {
  email: string;
  totp: string;
  newPassword: string;
}

/**
 * Login con email, password y código OTP
 */
export async function loginWithOtp(data: LoginData): Promise<ApiResponse<LoginResponse>> {
  return apiFetch('/auth/login-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Configurar TOTP (Google Authenticator)
 */
export async function setupTotp(email: string): Promise<ApiResponse<SetupTotpResponse>> {
  return apiFetch('/auth/setup-totp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Resetear contraseña con TOTP
 */
export async function resetPasswordWithTotp(data: ResetPasswordData): Promise<ApiResponse<{ message: string }>> {
  return apiFetch('/auth/reset-password-totp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Logout - Elimina cookie de sesión
 */
export async function logout(): Promise<ApiResponse<{ message: string }>> {
  // Eliminar todas las variantes de la cookie
  if (typeof window !== 'undefined') {
    // Eliminar para localhost
    document.cookie = 'sky_sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'sky_sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;';
    document.cookie = 'sky_sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.localhost;';
    
    // Eliminar para 127.0.0.1
    document.cookie = 'sky_sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=127.0.0.1;';
    
    // Forzar recarga para limpiar estado
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  }
  
  // Intentar llamar al backend si existe el endpoint
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.log('Backend logout endpoint no disponible');
  }
  
  return { ok: true, data: { message: 'Sesión cerrada' } };
}

// ============================================================================
// CATALOG ENDPOINTS (Público - no requiere autenticación)
// ============================================================================

export async function getAllProducts(): Promise<ApiResponse<Array<{ 
  code: string; 
  name: string; 
  category: string; 
  price: string; 
  stock: number 
}>>> {
  return apiFetch('/services/catalog', {
    method: 'GET',
  });
}

// ============================================================================
// ME ENDPOINTS (Requieren autenticación)
// ============================================================================

export async function getOverview(): Promise<ApiResponse<any>> {
  return apiFetch('/me/overview', {
    method: 'GET',
  });
}

export async function getMyServices(): Promise<ApiResponse<any[]>> {
  return apiFetch('/me/services', {
    method: 'GET',
  });
}

export async function getProductPrice(productCode: string): Promise<ApiResponse<{ code: string; name: string; price: number }>> {
  return apiFetch(`/me/products/${productCode}/price`, {
    method: 'GET',
  });
}

export async function getOrderCredentials(orderNumber: string): Promise<ApiResponse<any>> {
  return apiFetch(`/me/orders/${orderNumber}/credentials`, {
    method: 'GET',
  });
}

export async function getMySubscriptions(): Promise<ApiResponse<any[]>> {
  return apiFetch('/subscriptions', {
    method: 'GET',
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<ApiResponse<any>> {
  return apiFetch('/subscriptions/cancel', {
    method: 'POST',
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });
}

export async function createSubscriptionCheckout(data: {
  subscriptionType: string;
  billingCycle: string;
  price: number;
}): Promise<ApiResponse<any>> {
  return apiFetch('/subscriptions/create-checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createSubscriptionPayPalCheckout(data: {
  subscriptionType: string;
  billingCycle: string;
  price: number;
}): Promise<ApiResponse<any>> {
  return apiFetch('/subscriptions/create-paypal-checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createSubscriptionSinpeCheckout(data: {
  subscriptionType: string;
  billingCycle: string;
  price: number;
}): Promise<ApiResponse<any>> {
  return apiFetch('/subscriptions/create-sinpe-checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

export async function getAdminStats(): Promise<ApiResponse<any>> {
  return apiFetch('/admin/stats', {
    method: 'GET',
  });
}

export async function getAllUsers(): Promise<ApiResponse<any[]>> {
  return apiFetch('/admin/users', {
    method: 'GET',
  });
}

// ============================================================================
// PURCHASE ENDPOINTS
// ============================================================================

export interface PurchaseRequest {
  product_code: string;
  quantity?: number;
}

export interface PurchaseResponse {
  success: boolean;
  services: Array<{
    id: string;
    product_code: string;
    credentials: {
      email: string;
      password: string;
    };
    status: string;
    expires_at: string;
    created_at: string;
  }>;
  purchase: {
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    discount_applied: number;
    new_balance: number;
  };
}

/**
 * Comprar un producto del catálogo con saldo de billetera
 */
export async function purchaseProduct(data: PurchaseRequest): Promise<ApiResponse<PurchaseResponse>> {
  return apiFetch('/services/purchase', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface CheckoutResponse {
  checkout_url: string;
  order_number: string;
  order_id: number;
}

/**
 * Crear checkout de Stripe para comprar producto del catálogo
 */
export async function createProductCheckout(data: PurchaseRequest): Promise<ApiResponse<CheckoutResponse>> {
  return apiFetch('/services/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface WalletRechargeRequest {
  amount: number;
  method: 'CARD' | 'SINPE' | 'BINANCE';
}

export interface PayPalRechargeRequest {
  amount: number;
}

export interface WalletRechargeResponse {
  method: string;
  order_number: string;
  order_id: number;
  checkout_url?: string;
  amount?: number;
  bonus_percentage?: number;
  total_with_bonus?: number;
  instructions?: {
    phone?: string;
    amount?: number;
    message?: string;
  };
}

export interface PayPalRechargeResponse {
  order_number: string;
  paypal_order_id: string;
  approval_url: string;
  amount: number;
  bonus_percentage?: number;
  total_with_bonus?: number;
}

/**
 * Crear orden SINPE para compra de producto del catálogo
 */
export async function createSinpeProductCheckout(data: PurchaseRequest): Promise<ApiResponse<WalletRechargeResponse>> {
  return apiFetch('/services/checkout/sinpe', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Crear orden PayPal para compra de producto del catálogo
 */
export async function createPayPalProductCheckout(data: PurchaseRequest): Promise<ApiResponse<{
  method: string;
  order_id: number;
  order_number: string;
  paypal_order_id: string;
  approval_url: string;
  amount: number;
  product: {
    name: string;
    code: string;
    quantity: number;
  };
}>> {
  return apiFetch('/services/checkout/paypal', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Recargar billetera con Stripe, SINPE o Binance
 */
export async function rechargeWallet(data: WalletRechargeRequest): Promise<ApiResponse<WalletRechargeResponse>> {
  return apiFetch('/services/wallet/recharge', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Recargar billetera con PayPal
 */
export async function rechargeWalletPayPal(data: PayPalRechargeRequest): Promise<ApiResponse<PayPalRechargeResponse>> {
  return apiFetch('/services/checkout/paypal/recharge', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// RENEWAL ENDPOINTS
// ============================================================================

/**
 * Iniciar renovación de un servicio (crea billing_event renewal_pending)
 */
export async function initiateRenewal(serviceId: string): Promise<ApiResponse<{
  order_id: number;
  service_id: string;
  amount: number;
  original_amount: number;
  discount_applied: number;
  currency: string;
}>> {
  return apiFetch(`/services/${serviceId}/renew`, {
    method: 'POST',
  });
}

/**
 * Renovar servicio desde billetera (pago directo sin checkout)
 */
export async function renewFromWallet(serviceId: string): Promise<ApiResponse<{
  ok: boolean;
  service_id: string;
  new_expires_at: string;
  message: string;
}>> {
  return apiFetch(`/services/${serviceId}/renew/wallet`, {
    method: 'POST',
  });
}

/**
 * Crear checkout de Stripe para renovación
 */
export async function createRenewalCheckout(serviceId: string, method: 'stripe' | 'paypal' = 'stripe'): Promise<ApiResponse<{
  method: string;
  checkout_url?: string;
  paypal_order_id?: string;
  approval_url?: string;
  order_number: string;
}>> {
  return apiFetch(`/services/${serviceId}/checkout?method=${method}`, {
    method: 'POST',
  });
}
