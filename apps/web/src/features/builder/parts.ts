import type { ElementNode, ElementType } from "./types";

export type ElementPartDefinition = {
  key: string;
  label: string;
  repeating?: boolean;
  description?: string;
};

const SAFE_PART_KEY_RE = /^[a-z0-9_-]{1,40}$/;

const PRODUCT_CARD_PARTS: ElementPartDefinition[] = [
  { key: "card", label: "Product Card", repeating: true },
  { key: "image_wrap", label: "Image Frame", repeating: true },
  { key: "image", label: "Product Image", repeating: true },
  { key: "badge", label: "Sale / Stock Badge", repeating: true },
  { key: "title", label: "Product Title", repeating: true },
  { key: "price", label: "Price", repeating: true },
  { key: "subtitle", label: "Brand & Category", repeating: true },
  { key: "rating", label: "Rating", repeating: true },
];

export const ELEMENT_PARTS_BY_TYPE: Partial<
  Record<ElementType, ElementPartDefinition[]>
> = {
  product_grid: [
    ...PRODUCT_CARD_PARTS,
    { key: "action", label: "View All Link", repeating: false },
  ],
  product_carousel: [...PRODUCT_CARD_PARTS],
  product_card: PRODUCT_CARD_PARTS.map((p) => ({ ...p, repeating: false })),
  category_grid: [
    { key: "card", label: "Category Card", repeating: true },
    { key: "image", label: "Category Image", repeating: true },
    { key: "title", label: "Category Title", repeating: true },
    { key: "count", label: "Item Count", repeating: true },
  ],
  form: [
    { key: "heading", label: "Form Heading", repeating: false },
    { key: "field", label: "Field Group", repeating: true },
    { key: "label", label: "Field Label", repeating: true },
    { key: "input", label: "Text Input", repeating: true },
    { key: "submit", label: "Submit Button", repeating: false },
  ],
  promotion_banner: [
    { key: "kicker", label: "Kicker", repeating: false },
    { key: "heading", label: "Heading", repeating: false },
    { key: "copy", label: "Description", repeating: false },
    { key: "action", label: "Action Button", repeating: false },
  ],
  featured_product: [
    { key: "image", label: "Product Image", repeating: false },
    { key: "kicker", label: "Kicker", repeating: false },
    { key: "title", label: "Product Title", repeating: false },
    { key: "description", label: "Description", repeating: false },
    { key: "price", label: "Price", repeating: false },
    { key: "button", label: "Action Button", repeating: false },
  ],
  icon_list: [
    { key: "item", label: "Item Card", repeating: true },
    { key: "badge", label: "Icon Badge", repeating: true },
    { key: "title", label: "Item Title", repeating: true },
    { key: "subtitle", label: "Item Subtitle", repeating: true },
    { key: "body", label: "Item Body", repeating: true },
  ],
  image_gallery: [
    { key: "card", label: "Gallery Tile", repeating: true },
    { key: "image", label: "Tile Image", repeating: true },
    { key: "title", label: "Tile Title", repeating: true },
    { key: "body", label: "Tile Caption", repeating: true },
  ],
  tabs: [
    { key: "tab", label: "Tab Button", repeating: true },
    { key: "tab_active", label: "Active Tab", repeating: false },
    { key: "panel", label: "Tab Panel", repeating: false },
  ],
  accordion: [
    { key: "item", label: "Accordion Item", repeating: true },
    { key: "trigger", label: "Header Trigger", repeating: true },
    { key: "body", label: "Accordion Body", repeating: true },
  ],
  carousel: [
    { key: "media", label: "Slide Frame", repeating: false },
    { key: "image", label: "Slide Image", repeating: false },
    { key: "caption", label: "Caption Bar", repeating: false },
    { key: "title", label: "Slide Title", repeating: false },
    { key: "body", label: "Slide Description", repeating: false },
    { key: "nav_btn", label: "Navigation Button", repeating: true },
  ],
  countdown: [
    { key: "heading", label: "Heading", repeating: false },
    { key: "cell", label: "Timer Cell", repeating: true },
    { key: "value", label: "Timer Value", repeating: true },
    { key: "label", label: "Timer Label", repeating: true },
  ],
  product_info: [
    { key: "meta", label: "Brand & Category", repeating: false },
    { key: "rating", label: "Rating", repeating: false },
    { key: "description", label: "Description", repeating: false },
    { key: "stock", label: "Stock Status", repeating: false },
  ],
  add_to_cart: [
    { key: "button", label: "Button Label", repeating: false },
  ],
};

const ELEMENT_PARTS_INDEX: Partial<
  Record<ElementType, Map<string, ElementPartDefinition>>
> = {};
for (const [typeKey, defs] of Object.entries(ELEMENT_PARTS_BY_TYPE)) {
  if (!defs) continue;
  ELEMENT_PARTS_INDEX[typeKey as ElementType] = new Map(
    defs.map((p) => [p.key, p])
  );
}

export function getElementParts(type: ElementType): ElementPartDefinition[] {
  return ELEMENT_PARTS_BY_TYPE[type] || [];
}

export function getElementPart(
  type: ElementType,
  key: string | null | undefined
): ElementPartDefinition | null {
  if (!key) return null;
  return ELEMENT_PARTS_INDEX[type]?.get(key) ?? null;
}

export function isValidPartKey(key: string): boolean {
  return SAFE_PART_KEY_RE.test(key);
}

export function collectEditablePartsMap(
  nodes: ElementNode[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const visit = (list: ElementNode[]) => {
    for (const node of list) {
      const parts = getElementParts(node.type);
      if (parts.length) {
        out[node.id] = parts.map((p) => p.key);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(nodes);
  return out;
}
