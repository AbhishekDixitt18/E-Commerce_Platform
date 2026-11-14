-- =============================================================================
-- E-Commerce Platform Seed Data
-- =============================================================================

-- Clear existing seed data if needed (idempotent seeding)
TRUNCATE TABLE order_items, orders, products, audit_logs CASCADE;

-- Insert realistic sample products
INSERT INTO products (sku, name, description, price, currency, inventory_count, category, status)
VALUES
    (
        'PROD-LAPTOP-001',
        'Developer Pro 16-Inch Laptop',
        '32GB RAM, 1TB NVMe SSD, 12-core processor with high-resolution Retina-grade display.',
        1899.99,
        'USD',
        45,
        'Computers & Laptops',
        'ACTIVE'
    ),
    (
        'PROD-AUDIO-002',
        'Active Noise-Cancelling Wireless Headphones',
        'Premium over-ear headphones with 40h battery life, multi-point Bluetooth, and hybrid ANC.',
        279.50,
        'USD',
        120,
        'Audio',
        'ACTIVE'
    ),
    (
        'PROD-KEYBRD-003',
        'Tactile Mechanical Keyboard',
        'Custom hot-swappable mechanical switches, RGB backlighting, aluminum frame, and PBT keycaps.',
        129.99,
        'USD',
        85,
        'Peripherals',
        'ACTIVE'
    ),
    (
        'PROD-MOUSE-004',
        'Ergonomic Wireless Precision Mouse',
        'High-precision optical sensor with 8K polling rate, thumb rest, and hyper-fast scroll wheel.',
        79.99,
        'USD',
        150,
        'Peripherals',
        'ACTIVE'
    ),
    (
        'PROD-MONITR-005',
        'UltraWide 34-Inch Curved Monitor',
        '3440x1440 WQHD resolution, 144Hz refresh rate, HDR400, and 90W USB-C power delivery.',
        649.00,
        'USD',
        30,
        'Displays',
        'ACTIVE'
    ),
    (
        'PROD-CHAIR-006',
        'Ergonomic Mesh Office Task Chair',
        'Adjustable 4D armrests, dynamic lumbar support, breathable mesh, and pneumatic height adjustment.',
        399.00,
        'USD',
        25,
        'Furniture',
        'ACTIVE'
    ),
    (
        'PROD-DESK-007',
        'Dual-Motor Height Adjustable Standing Desk',
        'Solid bamboo desktop (60x30 inch), programmable presets, anti-collision sensor, and cable tray.',
        529.95,
        'USD',
        18,
        'Furniture',
        'ACTIVE'
    ),
    (
        'PROD-DOCK-008',
        'Thunderbolt 4 Multi-Port Docking Station',
        'Supports dual 4K @ 60Hz displays, 100W laptop charging, Gigabit Ethernet, and SD card reader.',
        199.99,
        'USD',
        65,
        'Accessories',
        'ACTIVE'
    ),
    (
        'PROD-WEBCAM-009',
        'Ultra HD 4K Conference Webcam',
        'Autofocus, dual noise-reducing microphones, privacy shutter, and low-light enhancement.',
        149.99,
        'USD',
        90,
        'Accessories',
        'ACTIVE'
    ),
    (
        'PROD-SSD-010',
        '2TB Rugged External Portable NVMe SSD',
        'Transfer speeds up to 1050MB/s, IP65 water and dust resistance, and drop protection up to 3 meters.',
        189.95,
        'USD',
        110,
        'Storage',
        'ACTIVE'
    );

-- Record seed execution in audit_logs for traceability
INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload)
VALUES
    (
        'DATABASE',
        'SYSTEM_SEED',
        'SEED_DATA_INITIALIZED',
        'MIGRATION_RUNNER',
        jsonb_build_object(
            'message', 'Initial catalog products seeded successfully',
            'product_count', 10,
            'timestamp', CURRENT_TIMESTAMP
        )
    );
