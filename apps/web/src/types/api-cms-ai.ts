import type {
  ElementMotionConfig,
  GlobalMotionSettings,
  MotionCategory,
} from "@/features/motion/types";
import type { GlobalTypographyTokens } from "@/features/typography/types";

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

export type EditorNodePayload = {
  id: string;
  type: string;
  version: number;
  label: string;
  visible: boolean;
  locked: boolean;
  props: Record<string, unknown>;
  styles: Record<string, Record<string, string | undefined> | undefined>;
  visibility?: Record<string, boolean | undefined>;
  children?: EditorNodePayload[];
  motion?: ElementMotionConfig;
  customCssClasses?: string[];
  htmlAttributes?: Record<string, string>;
};

export type PageContentPayload = {
  version?: number;
  blocks?: ApiPageBlock[];
  nodes?: EditorNodePayload[];
  meta?: Record<string, unknown>;
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

export type BrandPaletteColor = {
  id: string;
  name: string;
  hex: string;
};

export type ThemeTokens = {
  version: number;
  colors: {
    primary: string;
    secondary?: string;
    background: string;
    surface?: string;
    text: string;
    muted?: string;
    accent?: string;
    border?: string;
  };
  customPalette?: BrandPaletteColor[];
  typography: GlobalTypographyTokens;
  radius: {
    card: string;
    button: string;
  };
  container: {
    maxWidth: string;
  };
  spacing?: {
    sectionY?: string;
    blockGap?: string;
  };
  shadows?: {
    card?: string;
    elevated?: string;
  };
  motion?: GlobalMotionSettings;
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


export type AvailableModelDto = {
  id: string;
  label: string;
  ownedBy: string;
  contextLength?: number | null;
  maxOutputTokens?: number | null;
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
};

export type AiModelSettingsDto = {
  enabledModelIds: string[];
  availableModelIds: string[];
  availableModels: AvailableModelDto[];
  defaultModelId: string;
  gatewayReachable: boolean;
  gatewayError?: string | null;
  customerAiEnabled?: boolean;
  dailyTokenLimitPerUser?: number;
  customerAiModelId?: string;
};

export type UpdateAiModelSettingsRequest = {
  enabledModelIds: string[];
  customerAiEnabled?: boolean;
  dailyTokenLimitPerUser?: number;
  customerAiModelId?: string;
};

export type AdminCustomerUsageRowDto = {
  userId: string;
  fullName: string;
  email: string;
  accountType: "CUSTOMER" | "STAFF" | string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  dailyLimit: number;
  requestCount: number;
  updatedAt: string;
};


export type EditorChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
  targetLabel?: string;
};

export type AiInspirationMode =
  | "ask"
  | "vibe_keep_tokens"
  | "clone_faithful"
  | "visual_style_only";

export type ReferenceImageInput = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type UrlSafetyReport = {
  url: string;
  normalizedUrl: string;
  verdict: "SAFE" | "CAUTION" | "BLOCKED" | string;
  riskScore: number;
  reasons: string[];
};

export type WebsiteDesignDna = {
  url: string;
  title: string;
  description: string;
  ogImage?: string;
  paletteColors: string[];
  fontFamilies: string[];
  sectionOutline: Array<Record<string, unknown>>;
  layoutHints: string[];
};

export type UrlInspectionResult = {
  safety: UrlSafetyReport;
  designDna: WebsiteDesignDna | null;
};

export type AiClarificationOption = {
  id: AiInspirationMode;
  label: string;
  description: string;
  recommended: boolean;
};

export type EditorSuggestRequest = {
  pageId?: string;
  pageSlug?: string;
  viewport?: "desktop" | "tablet" | "mobile";
  scope?: "element" | "section" | "page" | "typography" | "motion";
  selectedNodeIds?: string[];
  prompt: string;
  model?: string;
  targetSubtree?: unknown;
  pageOutline?: Array<Record<string, unknown>>;
  themeTokens?: unknown;
  history?: EditorChatHistoryItem[];
  selectedPart?: string;
  editableParts?: Record<string, string[]>;
  referenceImages?: ReferenceImageInput[];
  referenceUrls?: string[];
  inspirationMode?: AiInspirationMode;
};

export type EditorSuggestResponse = {
  model: string;
  summary: string;
  explanation: string;
  scope: string;
  targetNodeIds: string[];
  operations: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  usedDataSources?: string[];
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
  clarificationOptions?: AiClarificationOption[];
  referenceUrlReports?: UrlSafetyReport[];
};

export type FontUploadResponse = {
  url: string;
  originalFilename: string;
  mimeType: string;
  format: "woff2" | "woff" | "truetype" | string;
  sizeBytes: number;
};


export type AnimationPresetDto = {
  id: string;
  presetKey: string;
  name: string;
  category: MotionCategory | string;
  description?: string | null;
  config: ElementMotionConfig;
  isSystem: boolean;
  isFavorite: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAnimationPresetRequest = {
  presetKey?: string;
  name: string;
  category: MotionCategory;
  description?: string;
  config: ElementMotionConfig;
  favorite?: boolean;
};

export type UpdateAnimationPresetRequest = {
  name?: string;
  category?: MotionCategory;
  description?: string;
  config?: ElementMotionConfig;
  favorite?: boolean;
  expectedVersion?: number;
};

export type PageAnimationsResponse = {
  pageId: string;
  pageVersion: number;
  latestVersionNumber: number;
  animations: Record<string, ElementMotionConfig>;
};

export type GlobalMotionResponse = {
  themeVersionId?: string | null;
  versionNumber: number;
  motion: GlobalMotionSettings;
};
