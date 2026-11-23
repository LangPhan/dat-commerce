export type BlockTypeSlug =
  | "hero"
  | "image_with_text"
  | "product_grid"
  | "featured_categories"
  | "best_sellers"
  | "collection_banner"
  | "promotional_banner"
  | "testimonials"
  | "newsletter"
  | "rich_text"
  | "image_gallery"
  | "faq"
  | "logo_cloud"
  | "video_section";

export type ApiPageBlock = {
  id: string;
  type: BlockTypeSlug | string;
  version: number;
  label: string;
  visible: boolean;
  props: Record<string, unknown>;
};

export type PageContentPayload = {
  version?: number;
  blocks: ApiPageBlock[];
};

export type PageVersionDto = {
  id: string;
  versionNumber: number;
  content: PageContentPayload;
  changeSummary?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type PageSummaryDto = {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedVersionId?: string | null;
  latestVersionNumber: number;
  blockCount: number;
  hasUnpublishedChanges: boolean;
  version: number;
  updatedAt: string;
};

export type PageDetailDto = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedVersionId?: string | null;
  latestVersionNumber: number;
  version: number;
  publishedVersion?: PageVersionDto | null;
  latestVersion?: PageVersionDto | null;
  versions: PageVersionDto[];
  updatedAt: string;
};

export type StorePageResponse = {
  id: string;
  slug: string;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  versionNumber: number;
  content: PageContentPayload;
  publishedAt: string;
};

export type ThemeTokens = {
  version: number;
  colors: {
    primary: string;
    background: string;
    surface?: string;
    text: string;
    muted?: string;
    accent?: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  radius: {
    card: string;
    button: string;
  };
  container: {
    maxWidth: string;
  };
};

export type ThemeVersionDto = {
  id: string;
  versionNumber: number;
  status: string;
  tokens: ThemeTokens;
  note?: string | null;
  publishedAt?: string | null;
  createdAt: string;
};

export type AdminThemeResponse = {
  published?: ThemeVersionDto | null;
  latest?: ThemeVersionDto | null;
  versions: ThemeVersionDto[];
};

export type NavigationItemDto = {
  id: string;
  label: string;
  url: string;
};

export type NavigationMenuDto = {
  id: string;
  menuKey: string;
  items: NavigationItemDto[];
  updatedAt: string;
};

export type AiConversationSummaryDto = {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageDto = {
  id: string;
  role: string;
  content: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  latencyMs?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiToolCallDto = {
  id: string;
  messageId?: string | null;
  toolName: string;
  arguments: Record<string, unknown>;
  resultSummary: Record<string, unknown>;
  status: string;
  durationMs: number;
  errorMessage?: string | null;
  createdAt: string;
};

export type AiChangePlanPreviewRow = {
  name: string;
  before: string;
  after: string;
};

export type AiChangePlanDto = {
  id: string;
  conversationId: string;
  messageId?: string | null;
  createdBy: string;
  planType: string;
  riskLevel: string;
  requestSummary: string;
  status:
    | "PENDING_APPROVAL"
    | "APPLIED"
    | "REJECTED"
    | "EXPIRED"
    | "FAILED"
    | "ROLLED_BACK"
    | string;
  operations: Record<string, unknown>;
  preview: AiChangePlanPreviewRow[];
  affectedResources: Record<string, unknown>[];
  reversible: boolean;
  expiresAt: string;
  approvedBy?: string | null;
  appliedAt?: string | null;
  rolledBackAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationDetailDto = {
  conversation: AiConversationSummaryDto;
  messages: AiMessageDto[];
  toolCalls: AiToolCallDto[];
  changePlans: AiChangePlanDto[];
};

export type AiChatTurnResultDto = {
  conversationId: string;
  assistantMessage: AiMessageDto;
  toolCalls: AiToolCallDto[];
  changePlans: AiChangePlanDto[];
};

export type AiActivityDto = {
  conversations: AiConversationSummaryDto[];
  changePlans: AiChangePlanDto[];
};
