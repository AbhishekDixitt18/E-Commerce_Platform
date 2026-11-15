import api from './api';

export const productService = {
  /**
   * Fetch paginated product catalog with optional search & filters
   */
  async getProducts(params = {}) {
    const response = await api.get('/api/v1/products', { params });
    // Backend standard envelope: { success: true, data: [...], meta: {...} }
    return {
      products: response.data.data || [],
      meta: response.data.meta || { total: 0 },
    };
  },

  /**
   * Fetch single product details by UUID
   */
  async getProductById(id) {
    const response = await api.get(`/api/v1/products/${id}`);
    return response.data.data;
  },

  /**
   * Update product inventory stock through protected administrative endpoint
   * @param {string} id - Product UUID
   * @param {number} inventoryCount - New stock count
   * @param {string} [adminApiKey] - Optional custom admin key, defaults to dev key
   */
  async updateStock(id, inventoryCount, adminApiKey = 'algions-devops-admin-key-2026') {
    const headers = {
      'x-admin-api-key': adminApiKey,
    };
    const response = await api.patch(
      `/api/v1/admin/products/${id}/stock`,
      { inventory_count: Number(inventoryCount) },
      { headers }
    );
    return response.data.data;
  },
};
