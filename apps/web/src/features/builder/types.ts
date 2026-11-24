import type { CSSProperties } from "react";
import type { ThemeTokens } from "@/types/api-cms-ai";
import type { TypographyAiOperation, TypographyHistoryMeta } from "@/features/typography/types";

export type ViewportMode = "desktop" | "tablet" | "mobile";

export type ElementCategory = "layout" | "basic" | "ecommerce" | "advanced";

export type ElementType =
  // Layout
  | "section"
  | "container"
  | "grid"
  | "flex"
  | "columns"
  | "column"
  | "spacer"
  // Basic
  | "heading"
  | "text_editor"
  | "image"
  | "video"
  | "button"
  | "icon"
  | "divider"
  | "icon_list"
  | "image_gallery"
  // Ecommerce
  | "product_card"
  | "product_grid"
  | "product_carousel"
  | "category_grid"
  | "featured_product"
  | "price"
  | "add_to_cart"
  | "product_info"
  | "promotion_banner"
  // Advanced
  | "tabs"
  | "accordion"
  | "carousel"
  | "countdown"
  | "form"
  | "custom_html";

export const CONTAINER_ELEMENT_TYPES: ReadonlySet<ElementType> = new Set([
  "section",
  "container",
  "grid",
  "flex",
  "columns",
  "column",
]);

export type StylePropertyKey =
  | "display"
  | "flexDirection"
  | "justifyContent"
  | "alignItems"
  | "alignSelf"
  | "flexWrap"
  | "flexGrow"
  | "flexShrink"
  | "gap"
  | "rowGap"
  | "columnGap"
  | "gridTemplateColumns"
  | "gridTemplateRows"
  | "gridColumn"
  | "gridRow"
  | "width"
  | "minWidth"
  | "maxWidth"
  | "height"
  | "minHeight"
  | "maxHeight"
  | "margin"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "padding"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "position"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "zIndex"
  | "overflow"
  | "textAlign"
  | "color"
  | "backgroundColor"
  | "backgroundImage"
  | "backgroundSize"
  | "backgroundPosition"
  | "backgroundRepeat"
  | "backgroundAttachment"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "fontStretch"
  | "lineHeight"
  | "letterSpacing"
  | "wordSpacing"
  | "textTransform"
  | "textDecoration"
  | "textShadow"
  | "textIndent"
  | "textWrap"
  | "textOverflow"
  | "borderWidth"
  | "borderStyle"
  | "borderColor"
  | "borderRadius"
  | "boxShadow"
  | "opacity"
  | "aspectRatio"
  | "objectFit"
  | "objectPosition"
  | "cursor";

export type StyleValues = Partial<Record<StylePropertyKey, string>>;

export type ResponsiveStyles = {
  base: StyleValues;
  tablet?: StyleValues;
  mobile?: StyleValues;
  hover?: StyleValues;
};

export type ResponsiveVisibility = {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
};

export type ElementItemData = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  image?: string;
  url?: string;
  icon?: string;
};

export type FormFieldData = {
  id: string;
  label: string;
  type: "text" | "email" | "textarea";
  placeholder?: string;
  required?: boolean;
};

export type ElementNode = {
  id: string;
  type: ElementType;
  version: 2;
  label: string;
  visible: boolean;
  locked: boolean;
  props: Record<string, unknown>;
  styles: ResponsiveStyles;
  partStyles?: Record<string, ResponsiveStyles>;
  visibility?: ResponsiveVisibility;
  children?: ElementNode[];
  customCssClasses?: string[];
  htmlAttributes?: Record<string, string>;
};

export type PageDocumentV2 = {
  version: 2;
  nodes: ElementNode[];
  meta?: Record<string, unknown>;
};

export type EditorOperation =
  | { type: "update_props"; nodeId: string; props: Record<string, unknown> }
  | {
      type: "update_styles";
      nodeId: string;
      breakpoint?: "base" | "tablet" | "mobile" | "hover";
      styles: StyleValues;
    }
  | {
      type: "reset_style_keys";
      nodeId: string;
      breakpoint: "base" | "tablet" | "mobile" | "hover";
      keys: StylePropertyKey[];
    }
  | {
      type: "update_part_styles";
      nodeId: string;
      part: string;
      breakpoint?: "base" | "tablet" | "mobile" | "hover";
      styles: StyleValues;
    }
  | {
      type: "reset_part_style_keys";
      nodeId: string;
      part: string;
      breakpoint: "base" | "tablet" | "mobile" | "hover";
      keys: StylePropertyKey[];
    }
  | {
      type: "update_visibility";
      nodeId: string;
      visible?: boolean;
      visibility?: ResponsiveVisibility;
    }
  | { type: "update_meta"; nodeId: string; label?: string; locked?: boolean }
  | {
      type: "update_advanced";
      nodeId: string;
      customCssClasses?: string[];
      htmlAttributes?: Record<string, string>;
    }
  | { type: "insert_node"; parentId: string | null; index?: number; node: ElementNode }
  | { type: "move_node"; nodeId: string; targetParentId: string | null; index: number }
  | { type: "duplicate_node"; nodeId: string; newNodeId?: string }
  | { type: "delete_node"; nodeId: string }
  | { type: "replace_subtree"; nodeId: string; node: ElementNode }
  | { type: "wrap_nodes"; nodeIds: string[]; wrapper: ElementNode }
  | { type: "batch"; operations: EditorOperation[] };

export type HistoryEntry = {
  id: string;
  timestamp: string;
  source: "manual" | "ai" | "system";
  summary: string;
  model?: string;
  beforeNodes: ElementNode[];
  afterNodes: ElementNode[];
  beforeSelectedIds: string[];
  afterSelectedIds: string[];
  beforeThemeTokens?: ThemeTokens | null;
  afterThemeTokens?: ThemeTokens | null;
  typographyMeta?: TypographyHistoryMeta;
};

export type DiffRow = {
  nodeId: string;
  nodeLabel: string;
  field: string;
  before: string;
  after: string;
};

export type AiChatTurnStatus = "previewing" | "applied" | "reverted" | "error";

export type AiScopeMode = "element" | "section" | "page" | "typography";

export type AiChatTurn = {
  id: string;
  timestamp: string;
  prompt: string;
  summary?: string;
  explanation?: string;
  model: string;
  scope: AiScopeMode;
  targetLabel: string;
  targetNodeIds: string[];
  status: AiChatTurnStatus;
  diffCount: number;
  error?: string;
};

export type AiPreviewSession = {
  turnId?: string;
  prompt: string;
  summary: string;
  explanation: string;
  model: string;
  scope: AiScopeMode;
  targetNodeIds: string[];
  operations: EditorOperation[];
  diffs: DiffRow[];
  previewNodes: ElementNode[];
  beforeNodes: ElementNode[];
  beforeThemeTokens?: ThemeTokens | null;
  previewThemeTokens?: ThemeTokens | null;
  affectedPresets?: string[];
  typographyOperations?: TypographyAiOperation[];
  viewMode?: "after" | "before";
};

export type LastAppliedAiCompare = {
  historyEntryId: string;
  summary: string;
  model?: string;
  beforeNodes: ElementNode[];
  afterNodes: ElementNode[];
  beforeThemeTokens?: ThemeTokens | null;
  afterThemeTokens?: ThemeTokens | null;
  affectedPresets?: string[];
  viewingBefore: boolean;
};

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export type InspectorFieldType =
  | "text"
  | "textarea"
  | "url"
  | "media"
  | "select"
  | "number"
  | "toggle"
  | "icon"
  | "product_select"
  | "category_select"
  | "items"
  | "form_fields"
  | "html";

export type InspectorFieldSpec = {
  key: string;
  label: string;
  type: InspectorFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  help?: string;
};

export type ElementDefinition = {
  type: ElementType;
  label: string;
  category: ElementCategory;
  description: string;
  isContainer: boolean;
  iconName: string;
  defaultProps: Record<string, unknown>;
  defaultStyles: ResponsiveStyles;
  inspectorFields: InspectorFieldSpec[];
  createDefaultChildren?: (idFactory: () => string) => ElementNode[];
};

export type CompiledNodeStyles = {
  inline: CSSProperties;
  overriddenKeys: Set<StylePropertyKey>;
  hasViewportOverride: boolean;
};
