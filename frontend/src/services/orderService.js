import api from './api';

const SESSION_ORDERS_KEY = 'ecommerce_admin_session_orders';

export const orderService = {
  /**
   * Submit new order through the backend checkout API
   * Enforces Idempotency-Key header for duplicate suppression
   */
  async createOrder(payload, idempotencyKey) {
    const response = await api.post('/api/v1/orders', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });

    const result = response.data;
    const orderData = result.data?.order || result.data;
    const items = result.data?.items || [];

    // Save to local session registry for easy dashboard reference
    if (orderData && orderData.id) {
      orderService.saveSessionOrder({
        ...orderData,
        items,
        isIdempotentReplay: result.meta?.idempotentReplay || false,
      });
    }

    return {
      order: orderData,
      items,
      isIdempotentReplay: result.meta?.idempotentReplay || false,
      message: result.message,
    };
  },

  /**
   * Fetch single order details by UUID
   */
  async getOrderById(id) {
    const response = await api.get(`/api/v1/orders/${id}`);
    return {
      order: response.data.data?.order || response.data.data,
      items: response.data.data?.items || [],
    };
  },

  /**
   * Retrieve session-tracked orders created in this browser
   */
  getSessionOrders() {
    try {
      const data = localStorage.getItem(SESSION_ORDERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Append newly placed order to local session storage
   */
  saveSessionOrder(order) {
    try {
      const existing = orderService.getSessionOrders();
      // Avoid duplicate entries if replayed
      const filtered = existing.filter((o) => o.id !== order.id);
      const updated = [order, ...filtered].slice(0, 50); // Keep last 50
      localStorage.setItem(SESSION_ORDERS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  },
};
