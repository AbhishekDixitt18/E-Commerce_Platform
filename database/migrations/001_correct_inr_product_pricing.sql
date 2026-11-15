-- =============================================================================
-- Migration: 001_correct_inr_product_pricing.sql
-- Description: Updates catalog products with realistic Indian retail prices (INR)
-- Preserves: IDs, SKUs, product descriptions, categories, and stock quantities.
-- Idempotent: Tracks execution in schema_migrations table.
-- =============================================================================

BEGIN;

-- Create schema migrations tracking table if not present
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_correct_inr_product_pricing') THEN

        -- 1. Developer Pro 16-Inch Laptop: ₹1,29,999
        UPDATE products 
        SET price = 129999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-LAPTOP-001';

        -- 2. Active Noise-Cancelling Wireless Headphones: ₹8,999
        UPDATE products 
        SET price = 8999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-AUDIO-002';

        -- 3. Tactile Mechanical Keyboard: ₹5,499
        UPDATE products 
        SET price = 5499.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-KEYBRD-003';

        -- 4. Ergonomic Wireless Precision Mouse: ₹4,999
        UPDATE products 
        SET price = 4999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-MOUSE-004';

        -- 5. UltraWide 34-Inch Curved Monitor: ₹34,999
        UPDATE products 
        SET price = 34999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-MONITR-005';

        -- 6. Ergonomic Mesh Office Task Chair: ₹12,999
        UPDATE products 
        SET price = 12999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-CHAIR-006';

        -- 7. Dual-Motor Height Adjustable Standing Desk: ₹29,999
        UPDATE products 
        SET price = 29999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-DESK-007';

        -- 8. Thunderbolt 4 Multi-Port Docking Station: ₹7,999
        UPDATE products 
        SET price = 7999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-DOCK-008';

        -- 9. Ultra HD 4K Conference Webcam: ₹5,999
        UPDATE products 
        SET price = 5999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-WEBCAM-009';

        -- 10. 2TB Rugged External Portable NVMe SSD: ₹18,999
        UPDATE products 
        SET price = 18999.00, currency = 'INR', updated_at = CURRENT_TIMESTAMP 
        WHERE sku = 'PROD-SSD-010';

        -- Record audit log entries
        INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload)
        SELECT 'PRODUCT', id::text, 'PRICE_UPDATE_INR', 'SYSTEM_MIGRATION_001',
               jsonb_build_object('sku', sku, 'new_price', price, 'currency', 'INR')
        FROM products;

        -- Record successful migration execution
        INSERT INTO schema_migrations (version, description)
        VALUES ('001_correct_inr_product_pricing', 'Update product catalog to realistic Indian retail pricing in INR');

        RAISE NOTICE 'Migration 001_correct_inr_product_pricing applied successfully.';
    ELSE
        RAISE NOTICE 'Migration 001_correct_inr_product_pricing has already been applied. Skipping.';
    END IF;
END $$;

COMMIT;
