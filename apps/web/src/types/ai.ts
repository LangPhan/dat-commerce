import type { Attribute, Category, Discount, Product } from "./commerce";
import type { Block } from "./editor";

export type AIModelId =
  | "gpt-6-luna"
  | "cx/gpt-6-luna"
  | "claude-code";

export type AIModel = {
  id: AIModelId;
  label: string;
  provider: string;
  badge: string;
};

export const AI_MODELS: AIModel[] = [
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "9Router", badge: "Default" },
  { id: "cx/gpt-6-luna", label: "GPT-6 Luna (CX)", provider: "9Router · CX", badge: "Fast" },
  { id: "claude-code", label: "Claude Code", provider: "9Router · Combo", badge: "Combo" },
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
