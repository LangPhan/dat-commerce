INSERT INTO stores (id, code, name, default_currency, locale, timezone, contact_email, public_domain, status, settings_json)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'terrain-supply',
    'Terrain Supply',
    'USD',
    'en-US',
    'America/Los_Angeles',
    'hello@terrain.example',
    'terrain.example',
    'ACTIVE',
    '{"unitSystem":"Imperial","shippingFee":"12","freeShippingThreshold":"100","dispatchEstimate":"2 business days"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, code, name, description) VALUES
    ('20000000-0000-0000-0000-000000000001', 'OWNER', 'Owner', 'Full access to store, operations, users, and security'),
    ('20000000-0000-0000-0000-000000000002', 'ADMIN', 'Admin', 'Broad operational administration across catalog, orders, CMS, and AI'),
    ('20000000-0000-0000-0000-000000000003', 'CATALOG_MANAGER', 'Catalog Manager', 'Manages products, product types, attributes, pricing, inventory, and promotions'),
    ('20000000-0000-0000-0000-000000000004', 'CONTENT_EDITOR', 'Content Editor', 'Manages CMS pages, blocks, themes, navigation, and media'),
    ('20000000-0000-0000-0000-000000000005', 'ORDER_MANAGER', 'Order Manager', 'Views and processes orders, fulfillments, and cancellations'),
    ('20000000-0000-0000-0000-000000000006', 'VIEWER', 'Viewer', 'Read-only access to business dashboards and records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (id, code, description) VALUES
    (gen_random_uuid(), 'dashboard:read', 'View analytics dashboard and KPIs'),
    (gen_random_uuid(), 'catalog:read', 'Read products, categories, product types, and attributes'),
    (gen_random_uuid(), 'catalog:write', 'Create and update products, categories, product types, and attributes'),
    (gen_random_uuid(), 'pricing:write', 'Update product/variant prices and bulk pricing'),
    (gen_random_uuid(), 'inventory:read', 'View stock levels and inventory history'),
    (gen_random_uuid(), 'inventory:write', 'Adjust stock quantities'),
    (gen_random_uuid(), 'order:read', 'View customer orders'),
    (gen_random_uuid(), 'order:write', 'Update fulfillment and order statuses'),
    (gen_random_uuid(), 'order:cancel', 'Cancel orders and release inventory'),
    (gen_random_uuid(), 'promotion:read', 'View discounts and promotions'),
    (gen_random_uuid(), 'promotion:write', 'Create and manage discounts and promotions'),
    (gen_random_uuid(), 'content:read', 'Read CMS pages, blocks, themes, and navigation'),
    (gen_random_uuid(), 'content:write', 'Create and edit draft CMS pages, themes, and navigation'),
    (gen_random_uuid(), 'content:publish', 'Publish draft CMS pages and themes to live storefront'),
    (gen_random_uuid(), 'media:write', 'Upload and delete media assets'),
    (gen_random_uuid(), 'ai:use', 'Use AI Assistant and submit change plan proposals'),
    (gen_random_uuid(), 'audit:read', 'Read append-only audit logs'),
    (gen_random_uuid(), 'store:read', 'Read store configuration'),
    (gen_random_uuid(), 'store:write', 'Update store configuration'),
    (gen_random_uuid(), 'users:read', 'View workspace admin users'),
    (gen_random_uuid(), 'users:write', 'Invite and update admin users and roles')
ON CONFLICT (code) DO NOTHING;

-- OWNER gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'OWNER'
ON CONFLICT DO NOTHING;

-- ADMIN gets everything except users:write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code <> 'users:write'
ON CONFLICT DO NOTHING;

-- CATALOG_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'CATALOG_MANAGER'
  AND p.code IN (
    'dashboard:read', 'catalog:read', 'catalog:write', 'pricing:write',
    'inventory:read', 'inventory:write', 'promotion:read', 'promotion:write',
    'media:write', 'store:read', 'ai:use'
  )
ON CONFLICT DO NOTHING;

-- CONTENT_EDITOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'CONTENT_EDITOR'
  AND p.code IN (
    'dashboard:read', 'catalog:read', 'content:read', 'content:write',
    'content:publish', 'media:write', 'store:read', 'ai:use'
  )
ON CONFLICT DO NOTHING;

-- ORDER_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ORDER_MANAGER'
  AND p.code IN (
    'dashboard:read', 'catalog:read', 'inventory:read', 'order:read',
    'order:write', 'order:cancel', 'promotion:read', 'store:read', 'ai:use'
  )
ON CONFLICT DO NOTHING;

-- VIEWER (strictly read-only; no ai:use, no write, no audit:read/users:read)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'VIEWER'
  AND p.code IN (
    'dashboard:read', 'catalog:read', 'inventory:read', 'order:read',
    'promotion:read', 'content:read', 'store:read'
  )
ON CONFLICT DO NOTHING;
