-- Sandboxed 2-hour Demo Owner & Owner-only AI settings permission

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stores_demo_expires_at
    ON stores (demo_expires_at)
    WHERE is_demo = TRUE;

INSERT INTO permissions (id, code, description)
VALUES (gen_random_uuid(), 'ai:settings:write', 'Configure AI model priorities and storefront AI daily token limits')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'ai:settings:write'
WHERE r.code = 'OWNER'
ON CONFLICT DO NOTHING;

INSERT INTO roles (id, code, name, description)
VALUES (
    '20000000-0000-0000-0000-000000000007',
    'DEMO_OWNER',
    'Demo Owner',
    'Sandboxed 2-hour demo owner with full admin access except design publish and AI settings'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'DEMO_OWNER'
  AND p.code NOT IN ('content:publish', 'ai:settings:write')
ON CONFLICT DO NOTHING;
