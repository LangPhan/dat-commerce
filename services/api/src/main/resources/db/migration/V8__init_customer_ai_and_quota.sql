CREATE TABLE IF NOT EXISTS customer_ai_conversations (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    model VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_ai_conv_user
    ON customer_ai_conversations (store_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS customer_ai_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES customer_ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL,
    content TEXT NOT NULL,
    products_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    model VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_ai_msg_conv
    ON customer_ai_messages (conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_user_daily_token_usage (
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    prompt_tokens BIGINT NOT NULL DEFAULT 0,
    completion_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    request_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (store_id, user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_date
    ON ai_user_daily_token_usage (store_id, usage_date DESC, total_tokens DESC);
