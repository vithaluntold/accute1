# Multi-Gateway Payment Architecture

## Overview

FinACEverse implements a **unified multi-gateway payment system** that supports multiple payment providers through a factory pattern architecture. This enables organizations to configure and use their preferred payment gateways while maintaining a consistent API interface.

## Supported Payment Gateways

### ✅ Fully Implemented
1. **Razorpay** - Full implementation with order creation, verification, and webhooks
2. **Stripe** - Full implementation with payment intents, checkout sessions, and webhooks

### 🚧 Stub Implementation (Installation Required)
3. **Cashfree** - Gateway interface ready, requires `cashfree-pg` package
4. **PayU** - Gateway interface ready, requires implementation
5. **Payoneer** - Gateway interface ready, requires implementation

---

## Architecture

### Core Components

#### 1. PaymentGateway Abstract Class (`server/payment-gateways/base-gateway.ts`)
```typescript
export abstract class PaymentGateway {
  abstract createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  abstract verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerification>;
  abstract createCustomer?(params: CreateCustomerParams): Promise<CustomerInfo>;
  abstract getPaymentDetails?(paymentId: string): Promise<PaymentDetails>;
  abstract refundPayment?(params: RefundParams): Promise<RefundResult>;
  abstract createCheckoutSession?(params: CheckoutSessionParams): Promise<CheckoutSession>;
}
```

#### 2. PaymentGatewayFactory (`server/payment-gateways/gateway-factory.ts`)
```typescript
export class PaymentGatewayFactory {
  static createGateway(config: GatewayConfig): PaymentGateway {
    switch (config.gateway) {
      case 'razorpay': return new RazorpayGateway(config);
      case 'stripe': return new StripeGateway(config);
      case 'cashfree': return new CashfreeGateway(config);
      default: throw new Error(`Unsupported gateway: ${config.gateway}`);
    }
  }
}
```

#### 3. Gateway Implementations
- **RazorpayGateway** (`server/payment-gateways/razorpay-gateway.ts`) - Wraps existing `razorpay-service.ts`
- **StripeGateway** (`server/payment-gateways/stripe-gateway.ts`) - Stripe payment processing
- **CashfreeGateway** (`server/payment-gateways/cashfree-gateway.ts`) - Stub with installation instructions

#### 4. Unified API Routes (`server/unified-payment-routes.ts`)
```
POST   /api/payments/unified/create-order      - Create payment order
POST   /api/payments/unified/verify-payment    - Verify payment completion
POST   /api/payments/unified/webhooks/:gateway - Handle webhooks
GET    /api/payment/gateways                   - List supported gateways
GET    /api/payment-gateway-configs            - Get organization configs
POST   /api/payment-gateway-configs            - Configure new gateway
PATCH  /api/payment-gateway-configs/:id        - Update gateway config
DELETE /api/payment-gateway-configs/:id        - Remove gateway config
```

---

## Database Schema

### `paymentGatewayConfigs` Table
```typescript
{
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  gateway: varchar("gateway").notNull(),          // 'razorpay', 'stripe', etc.
  apiKey: text("api_key").notNull(),              // Encrypted
  apiSecret: text("api_secret").notNull(),        // Encrypted
  webhookSecret: text("webhook_secret"),          // Encrypted
  publicKey: text("public_key"),                  // For Stripe
  environment: varchar("environment"),            // 'sandbox' or 'production'
  isDefault: boolean("is_default"),               // Default gateway for org
  isActive: boolean("is_active"),                 // Enable/disable gateway
  metadata: jsonb("metadata"),                    // Additional config
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
}
```

**Security**: All sensitive credentials (`apiKey`, `apiSecret`, `webhookSecret`) are **AES-256 encrypted** using `EncryptionService.encrypt()` before storage.

---

## Configuration Management

### Admin UI: `/admin/payment-gateways`

**Features:**
- ✅ View all configured gateways for organization
- ✅ Add new gateway configuration with API credentials
- ✅ Set default gateway for automatic selection
- ✅ Enable/disable gateways without deleting credentials
- ✅ Support for sandbox and production environments
- ✅ Secure credential storage (encrypted at rest)

**Access Control:**
- Requires authentication
- Organization-scoped (users only see their organization's configs)
- Admin-level permission recommended

### API Configuration
```typescript
// Create gateway configuration
POST /api/payment-gateway-configs
{
  "gateway": "razorpay",
  "apiKey": "rzp_test_...",
  "apiSecret": "secret_key...",
  "webhookSecret": "webhook_secret...",
  "environment": "production",
  "isDefault": true
}

// Response
{
  "id": "config_123",
  "gateway": "razorpay",
  "environment": "production",
  "isDefault": true,
  "isActive": true,
  "createdAt": "2025-11-22T..."
}
```

---

## Usage Guide

### 1. Configure Payment Gateway (Admin)

**Via UI:**
1. Navigate to `/admin/payment-gateways`
2. Click "Add Gateway"
3. Select gateway (Razorpay, Stripe, etc.)
4. Enter API credentials
5. Set environment (Sandbox/Production)
6. Toggle "Set as Default Gateway"
7. Click "Configure Gateway"

**Via API:**
```bash
curl -X POST https://your-domain.com/api/payment-gateway-configs \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "stripe",
    "apiKey": "sk_test_...",
    "apiSecret": "secret_...",
    "publicKey": "pk_test_...",
    "webhookSecret": "whsec_...",
    "environment": "production",
    "isDefault": true
  }'
```

### 2. Create Payment Order

```typescript
// Frontend
const response = await apiRequest('/api/payments/unified/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 50000,              // Amount in smallest currency unit (paise for INR)
    currency: 'INR',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '+919876543210',
    notes: {
      invoiceId: 'INV-001',
      customerId: 'CUST-123'
    },
    // Optional: Specify gateway (uses default if not provided)
    gatewayId: 'config_123'
  })
});

// Response
{
  "success": true,
  "order": {
    "orderId": "order_abc123",
    "amount": 50000,
    "currency": "INR",
    "gateway": "razorpay",
    "publicKey": "rzp_test_..."  // For frontend SDK initialization
  }
}
```

### 3. Frontend Integration

#### Razorpay
```typescript
const options = {
  key: response.order.publicKey,
  amount: response.order.amount,
  currency: response.order.currency,
  order_id: response.order.orderId,
  name: 'Your Company',
  description: 'Payment for services',
  handler: async (response) => {
    // Verify payment
    const verification = await apiRequest('/api/payments/unified/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature
      })
    });
    
    if (verification.success) {
      console.log('Payment verified!');
    }
  }
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

#### Stripe
```typescript
const stripe = await loadStripe(response.order.publicKey);
const { error } = await stripe.redirectToCheckout({
  sessionId: response.order.sessionId
});
```

### 4. Webhook Configuration

**Webhook Endpoints:**
```
POST /api/payments/unified/webhooks/razorpay
POST /api/payments/unified/webhooks/stripe
POST /api/payments/unified/webhooks/cashfree
```

**Setup in Gateway Dashboard:**
1. **Razorpay**: Dashboard → Settings → Webhooks → Add webhook URL
2. **Stripe**: Dashboard → Developers → Webhooks → Add endpoint
3. **Cashfree**: Dashboard → Developers → Webhook

**Webhook URL Format:**
```
https://your-domain.com/api/payments/unified/webhooks/{gateway}
```

**Signature Verification:**
All webhooks are automatically verified using the `webhookSecret` from gateway configuration. Invalid signatures are rejected with 400 Bad Request.

---

## Security Features

### 1. Credential Encryption
- **Algorithm**: AES-256-GCM
- **Key Management**: Environment variable `ENCRYPTION_KEY`
- **Encrypted Fields**: `apiKey`, `apiSecret`, `webhookSecret`
- **Service**: `EncryptionService` with `safeDecrypt()` error detection

### 2. Organization Isolation
- All gateway configs are organization-scoped
- Middleware enforces organization access control
- Users can only access their organization's gateways

### 3. Webhook Signature Verification
- All gateway implementations verify webhook signatures
- Prevents webhook spoofing and replay attacks
- Automatic rejection of invalid signatures

### 4. Environment Separation
- Sandbox and production environments isolated
- Test credentials never mixed with live credentials

---

## Adding New Payment Gateways

### Step 1: Implement Gateway Class
```typescript
// server/payment-gateways/new-gateway.ts
import { PaymentGateway, CreateOrderParams, PaymentOrder } from './base-gateway';

export class NewGateway extends PaymentGateway {
  private apiKey: string;
  private apiSecret: string;
  
  constructor(config: GatewayConfig) {
    super();
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }
  
  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    // Implementation
  }
  
  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerification> {
    // Implementation
  }
}
```

### Step 2: Register in Factory
```typescript
// server/payment-gateways/gateway-factory.ts
case 'newgateway': return new NewGateway(config);
```

### Step 3: Add Webhook Route
```typescript
// server/unified-payment-routes.ts
app.post('/api/payments/unified/webhooks/newgateway', async (req, res) => {
  // Handle webhook
});
```

### Step 4: Update Frontend
```typescript
// client/src/pages/admin/payment-gateway-config.tsx
// Add gateway to supportedGateways list
```

---

## Migration Guide

### From Single Gateway to Multi-Gateway

If you have existing Razorpay integration:

1. **Keep existing code** - Old Razorpay routes still work
2. **Add gateway config** - Configure Razorpay via admin UI
3. **Update frontend** - Use unified endpoints (`/api/payments/unified/*`)
4. **Test thoroughly** - Verify both old and new flows work
5. **Deprecate old routes** - Remove after migration complete

### Environment Variables

**Required:**
```bash
ENCRYPTION_KEY=your-32-character-encryption-key
```

**Gateway-Specific (if using environment variables instead of DB config):**
```bash
# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=secret_...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

**Note:** Database configuration is preferred over environment variables for multi-organization deployments.

---

## Error Handling

### Common Errors

#### 1. No Default Gateway Configured
```json
{
  "error": "No default payment gateway configured for this organization"
}
```
**Solution:** Configure a gateway and set `isDefault: true`

#### 2. Decryption Failure
```json
{
  "error": "Failed to decrypt gateway credentials. ENCRYPTION_KEY may have changed."
}
```
**Solution:** Ensure `ENCRYPTION_KEY` is stable across deployments

#### 3. Unsupported Gateway
```json
{
  "error": "Unsupported gateway: payu"
}
```
**Solution:** Install required package or implement gateway class

#### 4. Webhook Signature Invalid
```json
{
  "error": "Invalid webhook signature"
}
```
**Solution:** Verify `webhookSecret` matches gateway dashboard configuration

---

## Testing

### 1. Sandbox Environment
All gateways support sandbox/test mode:
- **Razorpay**: Use test API keys (`rzp_test_...`)
- **Stripe**: Use test API keys (`sk_test_...`)
- **Cashfree**: Use sandbox credentials

### 2. Test Payment Flow
1. Configure gateway with sandbox credentials
2. Create test order via API
3. Complete payment using test card numbers
4. Verify webhook delivery and signature
5. Check payment verification response

### 3. Test Cards
- **Razorpay**: `4111 1111 1111 1111` (success)
- **Stripe**: `4242 4242 4242 4242` (success)

---

## Monitoring & Observability

### Logs
```typescript
console.log('[Payment] Creating order via', gateway);
console.log('[Payment] Order created:', orderId);
console.log('[Payment] Webhook received from', gateway);
console.log('[Payment] Payment verified:', paymentId);
```

### Metrics to Track
- Orders created per gateway
- Payment success rate by gateway
- Webhook delivery success rate
- Average transaction amount
- Failed payment reasons

### Database Queries
```sql
-- Gateway usage statistics
SELECT gateway, COUNT(*) as order_count
FROM payment_gateway_configs
WHERE is_active = true
GROUP BY gateway;

-- Failed decryption attempts (indicates ENCRYPTION_KEY issues)
SELECT * FROM payment_gateway_configs
WHERE updated_at > NOW() - INTERVAL '24 hours';
```

---

## Best Practices

### 1. Credential Management
✅ **DO:**
- Store credentials in database (encrypted)
- Use `ENCRYPTION_KEY` environment variable
- Rotate keys periodically
- Keep production and sandbox credentials separate

❌ **DON'T:**
- Commit credentials to version control
- Share `ENCRYPTION_KEY` across environments
- Use production keys in development

### 2. Gateway Selection
✅ **DO:**
- Set one gateway as default
- Enable only gateways your organization uses
- Test thoroughly in sandbox before production

❌ **DON'T:**
- Configure multiple gateways as default
- Leave test credentials in production

### 3. Error Handling
✅ **DO:**
- Log all payment errors
- Show user-friendly error messages
- Implement retry logic for transient failures
- Monitor webhook delivery

❌ **DON'T:**
- Expose raw API errors to users
- Silently fail payment operations
- Ignore webhook signature verification

---

## Roadmap

### Planned Features
- [ ] **PayU Integration** - Popular Indian payment gateway
- [ ] **Payoneer Integration** - International payments
- [ ] **Automatic Gateway Failover** - Switch to backup gateway on failure
- [ ] **Multi-Currency Support** - Handle currency conversion
- [ ] **Subscription Payments** - Recurring payment support
- [ ] **Payment Analytics Dashboard** - Gateway performance comparison
- [ ] **Refund Management UI** - Unified refund processing
- [ ] **Payment Links** - Generate shareable payment links

### Community Contributions Welcome
- Additional gateway implementations
- Enhanced error handling
- Performance optimizations
- Documentation improvements

---

## Support

### Documentation
- **Architecture**: This file
- **API Reference**: `/api/payments/unified/*` endpoints
- **Admin UI**: `/admin/payment-gateways`

### Troubleshooting
1. Check logs for detailed error messages
2. Verify `ENCRYPTION_KEY` is set correctly
3. Ensure gateway credentials are valid
4. Test webhook delivery with gateway test mode
5. Check organization access permissions

### Contact
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: `MULTI_GATEWAY_PAYMENT_ARCHITECTURE.md`
- **Code**: `server/payment-gateways/`, `server/unified-payment-routes.ts`

---

## License
Part of FinACEverse - AI-native practice management platform for accounting firms.

**Last Updated:** November 22, 2025
**Version:** 1.0.0
**Status:** Production Ready (Razorpay, Stripe)
