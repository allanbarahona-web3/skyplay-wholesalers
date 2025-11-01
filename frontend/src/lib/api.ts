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

export async function getMySubscriptions(): Promise<ApiResponse<any[]>> {
  return apiFetch('/subscriptions', {
    method: 'GET',
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
