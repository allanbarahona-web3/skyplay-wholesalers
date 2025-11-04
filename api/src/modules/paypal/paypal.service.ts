import { Injectable, HttpException } from '@nestjs/common';

interface CreateOrderParams {
  amount: number;
  currency?: string;
  description: string;
  orderNumber: string;
  metadata: {
    order_id: string;
    tenant_id: string;
    product_code?: string;
    quantity?: string;
    amount?: string;
    bonus_percentage?: string;
    total_with_bonus?: string;
    service_id?: string;
    order_type: 'catalog_purchase' | 'wallet_recharge' | 'renewal';
  };
}

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class PayPalService {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ PayPal credentials not configured');
      this.baseUrl = '';
      return;
    }

    // URLs de PayPal
    this.baseUrl =
      environment === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    console.log(`💰 PayPal initialized (${environment} mode)`);
  }

  /**
   * Obtener access token de PayPal (con cache)
   */
  private async getAccessToken(): Promise<string> {
    // Si el token es válido, retornarlo
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ PayPal auth failed:', {
          status: response.status,
          error: errorData
        });
        throw new Error(`PayPal auth failed: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data: PayPalAccessToken = await response.json();
      this.accessToken = data.access_token;
      // Expirar 5 minutos antes por seguridad
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      console.log('✅ PayPal access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting PayPal access token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`PayPal authentication failed: ${errorMessage}`, 500);
    }
  }

  /**
   * Crear orden de PayPal
   */
  async createOrder(params: CreateOrderParams) {
    const { amount, currency = 'USD', description, orderNumber, metadata } = params;

    try {
      const accessToken = await this.getAccessToken();

      // Determinar el tipo de orden para la URL de retorno
      const orderType = metadata.order_type === 'wallet_recharge' ? 'recharge' : 
                        metadata.order_type === 'renewal' ? 'renewal' : 'purchase';
      
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderNumber,
            description,
            custom_id: metadata.order_id, // Para identificar en webhook
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'Skyplay Mayoristas',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/panel?payment=success&type=${orderType}&order=${orderNumber}&provider=paypal`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/panel?payment=cancel`,
        },
      };

      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ PayPal order creation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`PayPal API Error ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const order: any = await response.json();
      console.log('✅ PayPal order created:', order.id);

      // Obtener URL de aprobación
      const approveLink = order.links?.find((link: any) => link.rel === 'approve');

      return {
        orderId: order.id,
        approvalUrl: approveLink?.href || '',
        status: order.status,
      };
    } catch (error) {
      console.error('❌ Error creating PayPal order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to create PayPal order: ${errorMessage}`, 500);
    }
  }

  /**
   * Capturar pago de orden aprobada
   */
  async captureOrder(paypalOrderId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('PayPal capture failed:', errorData);
        throw new Error(`PayPal capture failed: ${response.statusText}`);
      }

      const captureData: any = await response.json();
      return captureData;
    } catch (error) {
      console.error('Error capturing PayPal order:', error);
      throw new HttpException('Failed to capture PayPal payment', 500);
    }
  }

  /**
   * Obtener detalles de orden
   */
  async getOrder(paypalOrderId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PayPal get order failed: ${response.statusText}`);
      }

      const orderData: any = await response.json();
      return orderData;
    } catch (error) {
      console.error('Error getting PayPal order:', error);
      throw new HttpException('Failed to get PayPal order', 500);
    }
  }

  /**
   * Verificar webhook signature de PayPal
   */
  async verifyWebhookSignature(webhookId: string, headers: any, body: any): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: body,
      };

      const response = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationData),
      });

      if (!response.ok) {
        console.error('PayPal webhook verification failed');
        return false;
      }

      const result: any = await response.json();
      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Error verifying PayPal webhook:', error);
      // En sandbox, permitir sin verificación
      return process.env.PAYPAL_ENVIRONMENT !== 'live';
    }
  }
}
