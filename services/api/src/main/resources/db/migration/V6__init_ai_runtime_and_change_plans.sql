-- Phases 5-7: AI Conversations, Messages, Tool Calls & Two-Phase Change Plans

CREATE TABLE ai_conversations (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    title                   VARCHAR(200) NOT NULL,
    model                   VARCHAR(100) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_messages (
    id                      UUID PRIMARY KEY,
    conversation_id         UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role                    VARCHAR(32) NOT NULL,
    content                 TEXT NOT NULL,
    model                   VARCHAR(100),
    prompt_tokens           INT,
    completion_tokens       INT,
    latency_ms              INT,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_tool_calls (
    id                      UUID PRIMARY KEY,
    conversation_id         UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    message_id              UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
    tool_name               VARCHAR(100) NOT NULL,
    arguments_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                  VARCHAR(32) NOT NULL,
    duration_ms             INT NOT NULL DEFAULT 0,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_change_plans (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    conversation_id         UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    message_id              UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
    created_by              UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    plan_type               VARCHAR(64) NOT NULL,
    risk_level              VARCHAR(16) NOT NULL,
    request_summary         TEXT NOT NULL,
    status                  VARCHAR(32) NOT NULL,
    operations_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    preview_json            JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_resources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    rollback_snapshot_json  JSONB,
    reversible              BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at              TIMESTAMPTZ NOT NULL,
    approved_by             UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    applied_at              TIMESTAMPTZ,
    rolled_back_at          TIMESTAMPTZ,
    idempotency_key         VARCHAR(128),
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, idempotency_key)
);

CREATE INDEX idx_ai_conversations_store_user ON ai_conversations(store_id, user_id, updated_at DESC);
CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, created_at ASC);
CREATE INDEX idx_ai_tool_calls_conv ON ai_tool_calls(conversation_id, created_at ASC);
CREATE INDEX idx_ai_change_plans_store ON ai_change_plans(store_id, created_at DESC);
CREATE INDEX idx_ai_change_plans_conv ON ai_change_plans(conversation_id, created_at DESC);
