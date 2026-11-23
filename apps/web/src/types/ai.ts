import type { Attribute, Category, Discount, Product } from "./commerce";
import type { Block } from "./editor";

export type AIModelId =
  | "claude-sonnet-4"
  | "gpt-4.1"
  | "gemini-2.5-pro"
  | "forma-fast";

export type AIModel = {
  id: AIModelId;
  label: string;
  provider: string;
  badge: string;
};

export const AI_MODELS: AIModel[] = [
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "9Router · Anthropic", badge: "Balanced" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "9Router · OpenAI", badge: "Precise" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "9Router · Google", badge: "Reasoning" },
  { id: "forma-fast", label: "Forma Fast", provider: "9Router · Edge", badge: "Low latency" },
];

export type RecordChange = {
  name: string;
  before: string;
  after: string;
};

export type StepStatus = "pending" | "running" | "completed" | "failed";

export type ToolStep = {
  id: string;
  tool: string;
  label: string;
  detail: string;
  records: number;
  durationMs: number;
  status?: StepStatus;
};

export type Snapshot = {
  catalog: Product[];
  categories: Category[];
  discounts: Discount[];
  attributes: Attribute[];
  draftBlocks?: Block[];
};

export type Plan = {
  summary: string;
  category: "catalog" | "pricing" | "promotion" | "storefront" | "schema";
  sensitive: boolean;
  steps: ToolStep[];
  changes: RecordChange[];
  updates: Partial<Snapshot>;
  editorLink?: boolean;
};

export type PlanResult = {
  text: string;
  plan?: Plan;
  link?: boolean;
  error?: boolean;
};

export type TurnStatus = "Pending" | "Completed" | "Canceled" | "Failed";

export type ConversationTurn = {
  id: string;
  prompt: string;
  attachment?: string;
  model?: AIModelId;
  timestamp?: string;
  result?: PlanResult;
  status?: TurnStatus;
};

export type ConversationThread = {
  id: string;
  title: string;
  updatedAt?: string;
  turns: ConversationTurn[];
};

export type AIActivityEntry = {
  id: string;
  title: string;
  category?: string;
  timestamp: string;
  status: "Completed" | "Canceled" | "Failed";
  records: number;
  model?: string;
  steps?: ToolStep[];
  changes?: RecordChange[];
};
