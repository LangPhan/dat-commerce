export type BlockKind =
  | "Hero"
  | "Image with Text"
  | "Product Grid"
  | "Featured Categories"
  | "Best Sellers"
  | "Collection Banner"
  | "Promotional Banner"
  | "Testimonials"
  | "Newsletter"
  | "Rich Text"
  | "Image Gallery"
  | "FAQ"
  | "Logo Cloud"
  | "Video Section";

export type BlockItem = {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  image?: string;
};

export type BlockTone = "forest" | "ink" | "light";
export type BlockLayout = "overlay" | "split" | "centered";
export type BlockScale = "regular" | "large";
export type BlockSpacing = "compact" | "comfortable" | "spacious";

export type Block = {
  id: string;
  type: BlockKind;
  label: string;
  kicker?: string;
  heading: string;
  copy: string;
  action: string;
  actionUrl?: string;
  image: string;
  tone: BlockTone;
  layout: BlockLayout;
  scale: BlockScale;
  spacing?: BlockSpacing;
  columns?: 2 | 3 | 4;
  visible: boolean;
  items?: BlockItem[];
};

export type ViewportMode = "desktop" | "tablet" | "mobile";
export type PublishState = "saved" | "unsaved" | "draft" | "preview" | "published";

export type ProposalDiff = {
  field: string;
  before: string;
  after: string;
};

export type Proposal = {
  before: Block[];
  after: Block[];
  title: string;
  changes: string[];
  diffs: ProposalDiff[];
  target: string;
};

export type EditorMessage = {
  id?: string;
  prompt: string;
  reply?: string;
  title?: string;
  status?: "error" | "accepted" | "rejected";
  attachment?: string;
  model?: string;
};
