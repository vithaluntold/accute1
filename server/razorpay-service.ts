import Razorpay from 'razorpay';
import crypto from 'crypto';

export interface RazorpayPlanConfig {
  planId: string;
  name: string;
  description: string;
  amount: number; // Amount in paise (100 paise = 1 INR)
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export interface RazorpaySubscriptionConfig {
  planId: string;
  totalCount?: number;
  quantity?: number;
  customerId?: string;
  startAt?: number; // Unix timestamp
  notes?: Record<string, string>;
  notify?: 0 | 1;
}

export class RazorpayService {
  private razorpay: Razorpay | null = null;

  private getRazorpayInstance(): Razorpay {
    if (!this.razorpay) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
      }

      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }

    return this.razorpay;
  }
  /**
   * Create a Razorpay Plan
   */
  async createPlan(config: RazorpayPlanConfig): Promise<any> {
    try {
      const razorpay = this.getRazorpayInstance();
      const plan = await this.getRazorpayInstance().plans.create({
        period: config.period,
        interval: config.interval,
        item: {
          name: config.name,
          description: config.description,
          amount: config.amount,
          currency: config.currency,
        },
      });
      return plan;
    } catch (error: any) {
      console.error('Error creating Razorpay plan:', error);
      throw new Error(`Failed to create plan: ${error.message}`);
    }
  }

  /**
   * Fetch all plans
   */
  async fetchPlans(): Promise<any> {
    try {
      const plans = await this.getRazorpayInstance().plans.all();
      return plans;
    } catch (error: any) {
      console.error('Error fetching Razorpay plans:', error);
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }
  }

  /**
   * Fetch a specific plan by ID
   */
  async fetchPlan(planId: string): Promise<any> {
    try {
      const plan = await this.getRazorpayInstance().plans.fetch(planId);
      return plan;
    } catch (error: any) {
      console.error('Error fetching Razorpay plan:', error);
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }
  }

  /**
   * Create a Razorpay Customer
   */
  async createCustomer(data: {
    name: string;
    email: string;
    contact?: string;
    notes?: Record<string, string>;
  }): Promise<any> {
    try {
      const customer = await this.getRazorpayInstance().customers.create({
        name: data.name,
        email: data.email,
        contact: data.contact,
        notes: data.notes,
      });
      return customer;
    } catch (error: any) {
      console.error('Error creating Razorpay customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Create a Razorpay Subscription
   */
  async createSubscription(config: RazorpaySubscriptionConfig): Promise<any> {
    try {
      const subscription = await this.getRazorpayInstance().subscriptions.create({
        plan_id: config.planId,
        total_count: config.totalCount,
        quantity: config.quantity,
        customer_id: config.customerId,
        start_at: config.startAt,
        notes: config.notes,
        notify: config.notify ?? 1,
      });
      return subscription;
    } catch (error: any) {
      console.error('Error creating Razorpay subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Fetch a subscription by ID
   */
  async fetchSubscription(subscriptionId: string): Promise<any> {
    try {
      const subscription = await this.getRazorpayInstance().subscriptions.fetch(subscriptionId);
      return subscription;
    } catch (error: any) {
      console.error('Error fetching Razorpay subscription:', error);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = false): Promise<any> {
    try {
      const subscription = await this.getRazorpayInstance().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
      return subscription;
    } catch (error: any) {
      console.error('Error canceling Razorpay subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<any> {
    try {
      const subscription = await this.getRazorpayInstance().subscriptions.pause(subscriptionId);
      return subscription;
    } catch (error: any) {
      console.error('Error pausing Razorpay subscription:', error);
      throw new Error(`Failed to pause subscription: ${error.message}`);
    }
  }

  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<any> {
    try {
      const subscription = await this.getRazorpayInstance().subscriptions.resume(subscriptionId);
      return subscription;
    } catch (error: any) {
      console.error('Error resuming Razorpay subscription:', error);
      throw new Error(`Failed to resume subscription: ${error.message}`);
    }
  }

  /**
   * Fetch all subscriptions
   */
  async fetchSubscriptions(options?: { count?: number; skip?: number }): Promise<any> {
    try {
      const subscriptions = await this.getRazorpayInstance().subscriptions.all(options);
      return subscriptions;
    } catch (error: any) {
      console.error('Error fetching Razorpay subscriptions:', error);
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }
  }

  /**
   * Create a Razorpay Order (for one-time payments)
   */
  async createOrder(data: {
    amount: number; // Amount in paise
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
  }): Promise<any> {
    try {
      const order = await this.getRazorpayInstance().orders.create({
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        notes: data.notes,
      });
      return order;
    } catch (error: any) {
      console.error('Error creating Razorpay order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Fetch an order by ID
   */
  async fetchOrder(orderId: string): Promise<any> {
    try {
      const order = await this.getRazorpayInstance().orders.fetch(orderId);
      return order;
    } catch (error: any) {
      console.error('Error fetching Razorpay order:', error);
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }

  /**
   * Fetch all payments for an order
   */
  async fetchOrderPayments(orderId: string): Promise<any> {
    try {
      const payments = await this.getRazorpayInstance().orders.fetchPayments(orderId);
      return payments;
    } catch (error: any) {
      console.error('Error fetching order payments:', error);
      throw new Error(`Failed to fetch order payments: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    webhookBody: string,
    webhookSignature: string,
    webhookSecret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(webhookBody)
        .digest('hex');
      
      return expectedSignature === webhookSignature;
    } catch (error: any) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Verify payment signature (for checkout)
   */
  verifyPaymentSignature(data: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    try {
      const text = `${data.orderId}|${data.paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest('hex');
      
      return expectedSignature === data.signature;
    } catch (error: any) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Verify subscription payment signature
   */
  verifySubscriptionSignature(data: {
    subscriptionId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    try {
      const text = `${data.subscriptionId}|${data.paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest('hex');
      
      return expectedSignature === data.signature;
    } catch (error: any) {
      console.error('Error verifying subscription signature:', error);
      return false;
    }
  }

  /**
   * Fetch payment by ID
   */
  async fetchPayment(paymentId: string): Promise<any> {
    try {
      const payment = await this.getRazorpayInstance().payments.fetch(paymentId);
      return payment;
    } catch (error: any) {
      console.error('Error fetching Razorpay payment:', error);
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Capture a payment (for authorized payments)
   */
  async capturePayment(paymentId: string, amount: number, currency: string): Promise<any> {
    try {
      const payment = await this.getRazorpayInstance().payments.capture(paymentId, amount, currency);
      return payment;
    } catch (error: any) {
      console.error('Error capturing Razorpay payment:', error);
      throw new Error(`Failed to capture payment: ${error.message}`);
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string, amount?: number, notes?: Record<string, string>): Promise<any> {
    try {
      const refund = await this.getRazorpayInstance().payments.refund(paymentId, {
        amount,
        notes,
      });
      return refund;
    } catch (error: any) {
      console.error('Error refunding Razorpay payment:', error);
      throw new Error(`Failed to refund payment: ${error.message}`);
    }
  }

  /**
   * Fetch all invoices
   */
  async fetchInvoices(options?: { count?: number; skip?: number }): Promise<any> {
    try {
      const invoices = await this.getRazorpayInstance().invoices.all(options);
      return invoices;
    } catch (error: any) {
      console.error('Error fetching Razorpay invoices:', error);
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }
  }

  /**
   * Create an invoice
   */
  async createInvoice(data: {
    type: 'invoice' | 'link';
    description?: string;
    customer: {
      name: string;
      email: string;
      contact?: string;
    };
    lineItems: Array<{
      name: string;
      description?: string;
      amount: number;
      currency: string;
      quantity?: number;
    }>;
    currency: string;
    notes?: Record<string, string>;
  }): Promise<any> {
    try {
      const invoice = await this.getRazorpayInstance().invoices.create({
        type: data.type,
        description: data.description,
        customer: data.customer,
        line_items: data.lineItems,
        currency: data.currency,
        notes: data.notes,
      });
      return invoice;
    } catch (error: any) {
      console.error('Error creating Razorpay invoice:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const razorpayService = new RazorpayService();
