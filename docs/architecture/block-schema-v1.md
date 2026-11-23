# Block Schema v1 & Theme Tokens v1 — Dat Commerce

## 1. Design Principles

- **Schema-driven, zero arbitrary code:** Storefront pages are composed strictly from registered block definitions (`version: 1`). Neither AI nor admin editors can inject raw HTML, `<script>`, inline `<style>`, or `javascript:` URLs.
- **Shared Validation:** Both Next.js (`zod` in `apps/web`) and Spring Boot (`BlockSchemaValidator` / `ThemeTokenValidator` in `services/api`) validate against this exact contract before saving a `page_versions` or `theme_configs` row.
- **Safe Fallback:** If an unrecognized or legacy field is encountered while rendering, the frontend renders a safe fallback container without crashing the storefront.

---

## 2. PageBlock Contract (`version: 1`)

### Common Envelope
```ts
type BlockTone = "forest" | "ink" | "light";
type BlockLayout = "overlay" | "split" | "centered";
type BlockScale = "regular" | "large";
type BlockSpacing = "compact" | "comfortable" | "spacious";

interface BaseBlock {
  id: string;        // unique stable identifier within page_version
  type: BlockType;   // allowlisted discriminator
  version: 1;
  label: string;     // display name in Structure Panel (1..80 chars)
  visible: boolean;
}
```

### Allowlisted Block Types (14 Types from Visual Editor)

| `type` (Schema v1) | Visual Editor Label | Key `props` |
|---|---|---|
| `hero` | Hero | `kicker?`, `heading`, `copy`, `action`, `actionUrl`, `image`, `mediaId?`, `tone`, `layout` (`overlay\|split\|centered`), `scale` |
| `image_with_text` | Image with Text | `kicker?`, `heading`, `copy`, `action`, `actionUrl`, `image`, `mediaId?`, `tone`, `layout` (`split\|centered`), `scale` |
| `product_grid` | Product Grid | `kicker?`, `heading`, `copy`, `source` (`manual\|best_sellers\|new_arrivals\|category`), `categorySlug?`, `productIds?`, `limit` (`2..12`), `columns` (`2\|3\|4`), `tone`, `spacing` |
| `featured_categories` | Featured Categories | `kicker?`, `heading`, `copy`, `columns` (`2\|3\|4`), `categorySlugs?`, `tone`, `spacing` |
| `best_sellers` | Best Sellers | `kicker?`, `heading`, `copy`, `limit` (`2..12`), `columns` (`2\|3\|4`), `action?`, `actionUrl?`, `tone`, `spacing` |
| `collection_banner` | Collection Banner | `kicker?`, `heading`, `copy`, `action`, `actionUrl`, `image`, `mediaId?`, `tone`, `layout` |
| `promotional_banner` | Promotional Banner | `kicker?`, `heading`, `copy`, `action`, `actionUrl`, `promoCode?`, `tone`, `layout` |
| `testimonials` | Testimonials | `kicker?`, `heading`, `columns` (`2\|3`), `items[]` (`id`, `title`, `subtitle?`, `body`), `tone` |
| `newsletter` | Newsletter | `kicker?`, `heading`, `copy`, `action`, `tone`, `layout` (`centered\|split`) |
| `rich_text` | Rich Text | `kicker?`, `heading`, `copy`, `tone`, `layout` (`centered\|split`), `spacing` |
| `image_gallery` | Image Gallery | `kicker?`, `heading`, `columns` (`2\|3\|4`), `items[]` (`id`, `title`, `body`, `image`, `mediaId?`), `tone` |
| `faq` | FAQ | `kicker?`, `heading`, `copy`, `items[]` (`id`, `title`, `body`), `tone` |
| `logo_cloud` | Logo Cloud | `kicker?`, `heading`, `items[]` (`id`, `title`, `subtitle?`), `tone` |
| `video_section` | Video Section | `kicker?`, `heading`, `copy`, `action`, `image`, `videoUrl?`, `tone`, `layout` |

### URL & Media Validation Rules
- Internal paths must start with `/` (and not `//`), e.g. `/store/shop`, `/store/collections`.
- External URLs must use `https://` only. `javascript:`, `data:`, and `vbscript:` schemes are strictly rejected.
- `image` must reference either a validated `media_assets` URL (`/storage/...`) or a built-in relative `/media/...` asset.

---

## 3. Page Operations (`PageChangeSet`)

Supported operations on `page_versions` (with optimistic locking `expectedVersion`):
- `add_block`: `{ op, pageId, expectedVersion, afterBlockId?, block }`
- `update_block`: `{ op, pageId, expectedVersion, blockId, patchProps }`
- `remove_block`: `{ op, pageId, expectedVersion, blockId }`
- `move_block`: `{ op, pageId, expectedVersion, blockId, targetIndex }`
- `update_page_metadata`: `{ op, pageId, expectedVersion, title?, seoTitle?, seoDescription? }`

---

## 4. Theme Tokens v1 (`theme_configs.tokens_json`)

Allowlisted token structure — no arbitrary CSS rules allowed:

```json
{
  "version": 1,
  "colors": {
    "primary": "#5B46E8",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "text": "#111318",
    "muted": "#5C6270",
    "accent": "#18794E"
  },
  "typography": {
    "headingFont": "Georgia",
    "bodyFont": "Inter"
  },
  "radius": {
    "card": "10px",
    "button": "8px"
  },
  "container": {
    "maxWidth": "1280px"
  }
}
```

### Allowlist Constraints
- **Colors**: strict 6-digit hex (`^#[0-9A-Fa-f]{6}$`).
- **Fonts**: allowlisted set `["Inter", "Georgia", "Plus Jakarta Sans", "DM Sans", "Merriweather", "JetBrains Mono"]`.
- **Radius**: `card` (`0px..24px`), `button` (`0px..999px`).
- **Container**: `maxWidth` (`1024px..1536px`).
