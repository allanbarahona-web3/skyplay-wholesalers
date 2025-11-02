# PayPal Integration Guide

## Overview
This system integrates PayPal payments using direct REST API v2 calls (no SDK dependencies).

## Features
- ✅ Catalog product purchases via PayPal
- ✅ Webhook handling for payment confirmations
- ✅ Automatic credential assignment
- ✅ Email notifications with credentials
- ✅ Idempotency protection
- ✅ Webhook signature verification
- ✅ OAuth 2.0 token caching

## Configuration

### Environment Variables
Add to `.env`:
```bash
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_ENVIRONMENT=sandbox  # or 'live' for production
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id_here
```

### Get PayPal Credentials
1. Go to https://developer.paypal.com/dashboard/
2. Create an app in the "My Apps & Credentials" section
3. Copy the Client ID and Secret
4. For webhooks, create a webhook listener and copy the Webhook ID

## API Endpoints

### 1. Create PayPal Checkout
**POST** `/api/services/checkout/paypal`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "product_code": "NETFLIX_4K_1M",
  "quantity": 1
}
```

**Response:**
```json
{
  "method": "PAYPAL",
  "order_id": 123,
  "order_number": "ORD-1234567890",
  "paypal_order_id": "8HU12345ABC67890",
  "approval_url": "https://www.paypal.com/checkoutnow?token=...",
  "amount": 12.99,
  "product": {
    "name": "Netflix 4K (1 Mes)",
    "code": "NETFLIX_4K_1M",
    "quantity": 1
  }
}
```

**Frontend Flow:**
1. Call the endpoint to create PayPal order
2. Redirect user to `approval_url`
3. User completes payment on PayPal
4. PayPal redirects back to your `return_url`
5. Webhook processes payment and assigns credentials
6. Show credentials in modal

### 2. PayPal Webhook Handler
**POST** `/api/auth/webhook/paypal`

This endpoint is called by PayPal automatically. Configure it in PayPal Developer Dashboard:
- URL: `https://your-domain.com/api/auth/webhook/paypal`
- Events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`

## Payment Flow

### 1. User initiates checkout
```
Frontend → POST /api/services/checkout/paypal
         → Creates billing_event with status 'purchase_pending'
         → Creates PayPal order via REST API
         → Returns approval_url
```

### 2. User pays on PayPal
```
User → Redirected to PayPal
    → Completes payment
    → PayPal sends webhook: CHECKOUT.ORDER.APPROVED
    → System captures payment automatically
    → PayPal sends webhook: PAYMENT.CAPTURE.COMPLETED
```

### 3. System processes payment
```
Webhook → Verifies signature
        → Checks idempotency (prevent duplicate processing)
        → Assigns credentials from pool
        → Reduces stock
        → Updates billing_event to 'purchase_completed'
        → Sends email with credentials
```

## Security Features

### 1. Webhook Signature Verification
All webhooks are verified using PayPal's signature:
```typescript
const isValid = await paypalService.verifyWebhookSignature(
  webhookId,
  headers,
  body
);
```

### 2. Idempotency Protection
Prevents duplicate processing if webhook is received multiple times:
```typescript
if (checkResult.rows[0].event_type === 'purchase_completed') {
  console.warn('Order already completed (idempotency)');
  return;
}
```

### 3. OAuth Token Caching
Access tokens are cached and reused until expiration:
```typescript
if (this.accessToken && Date.now() < this.tokenExpiry) {
  return this.accessToken;
}
```

## Testing

### 1. Sandbox Testing
Use sandbox environment for testing:
```bash
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=<sandbox_client_id>
PAYPAL_CLIENT_SECRET=<sandbox_secret>
```

### 2. Test PayPal Accounts
Create test accounts at: https://developer.paypal.com/dashboard/accounts

### 3. Webhook Testing
Use PayPal Webhook Simulator in Developer Dashboard to test events.

### 4. ngrok for Local Testing
To receive webhooks locally:
```bash
ngrok http 3000
# Use ngrok URL in PayPal webhook configuration
# Example: https://abc123.ngrok.io/api/auth/webhook/paypal
```

## Troubleshooting

### Webhook Not Received
- Check webhook URL in PayPal Dashboard
- Verify webhook events are enabled: `PAYMENT.CAPTURE.COMPLETED`
- Check server logs for webhook errors
- Use PayPal Webhook Simulator to test

### Payment Not Completing
- Check if `PAYMENT.CAPTURE.COMPLETED` event is being sent
- Verify webhook signature is valid
- Check server logs for processing errors
- Verify database transaction didn't rollback

### Email Not Sent
- Check SMTP configuration
- Verify user email exists in database
- Check email service logs

### Insufficient Stock
- Verify product stock > 0 in database
- Check if credentials are available (status = 'available')

## Production Checklist
- [ ] Change `PAYPAL_ENVIRONMENT=live`
- [ ] Use production PayPal credentials
- [ ] Configure production webhook URL (HTTPS required)
- [ ] Test with small transactions first
- [ ] Monitor webhook logs for errors
- [ ] Set up email alerts for failed webhooks
- [ ] Implement webhook retry logic if needed

## Related Files
- `api/src/modules/paypal/paypal.service.ts` - PayPal REST API integration
- `api/src/modules/paypal/paypal.module.ts` - NestJS module
- `api/src/modules/auth/auth.controller.ts` - Webhook handler (`/webhook/paypal`)
- `api/src/modules/services/services.controller.ts` - Checkout endpoint (`/checkout/paypal`)

## Support
- PayPal Developer Docs: https://developer.paypal.com/docs/api/orders/v2/
- PayPal REST API Reference: https://developer.paypal.com/api/rest/
- PayPal Webhooks Guide: https://developer.paypal.com/docs/api-basics/notifications/webhooks/
