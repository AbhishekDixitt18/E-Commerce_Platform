/**
 * Enterprise Formatting Utilities
 * Standardizes Indian Rupee (INR) currency formatting, Indian number grouping,
 * and localized human-readable timestamps.
 */

// Official en-IN currency formatter adhering to the Indian numbering system
export const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format any numeric or string financial value as Indian Rupees (INR)
 * @example formatINR(1500) => "₹1,500.00"
 * @example formatINR(1250000) => "₹12,50,000.00"
 * @param {number|string} amount
 * @returns {string} Formatted INR currency string
 */
export const formatINR = (amount) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0.00';
  }
  return inrFormatter.format(Number(amount));
};

/**
 * Format integer quantities according to the Indian numbering system
 * @example formatIndianNumber(125000) => "1,25,000"
 * @param {number|string} val
 * @returns {string} Grouped integer string
 */
export const formatIndianNumber = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(Number(val));
};

/**
 * Format timestamp into standard readable business format
 * @param {string|Date} dateStr
 * @returns {string} e.g. "15 Nov 2026, 08:30 PM"
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateStr);
  }
};
