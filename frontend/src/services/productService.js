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
};
