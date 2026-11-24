import { createElementId } from "../operations";
import type { ElementDefinition, ElementNode, ElementType } from "../types";

export const ELEMENT_DEFINITIONS: Record<ElementType, ElementDefinition> = {
  // ---- LAYOUT ----
  section: {
    type: "section",
    label: "Section",
    category: "layout",
    description: "Full-width structural band with padding and background controls.",
    isContainer: true,
    iconName: "SquareStack",
    defaultProps: { tag: "section" },
    defaultStyles: {
      base: {
        width: "100%",
        paddingTop: "56px",
        paddingBottom: "56px",
        paddingLeft: "24px",
        paddingRight: "24px",
        backgroundColor: "#FFFFFF",
      },
    },
    inspectorFields: [
      {
        key: "tag",
        label: "Semantic Tag",
        type: "select",
        options: [
          { value: "section", label: "<section>" },
          { value: "div", label: "<div>" },
          { value: "article", label: "<article>" },
          { value: "aside", label: "<aside>" },
        ],
      },
    ],
  },
  container: {
    type: "container",
    label: "Container",
    category: "layout",
    description: "Centered max-width wrapper for organizing nested elements.",
    isContainer: true,
    iconName: "Box",
    defaultProps: {},
    defaultStyles: {
      base: {
        width: "100%",
        maxWidth: "1200px",
        marginLeft: "auto",
        marginRight: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        paddingTop: "12px",
        paddingBottom: "12px",
      },
    },
    inspectorFields: [],
  },
  grid: {
    type: "grid",
    label: "Grid",
    category: "layout",
    description: "Responsive multi-column CSS grid layout container.",
    isContainer: true,
    iconName: "LayoutGrid",
    defaultProps: {},
    defaultStyles: {
      base: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "20px",
        width: "100%",
      },
      tablet: {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      },
      mobile: {
        gridTemplateColumns: "1fr",
      },
    },
    inspectorFields: [],
  },
  flex: {
    type: "flex",
    label: "Flex Container",
    category: "layout",
    description: "Flexible row or column stack with alignment controls.",
    isContainer: true,
    iconName: "Columns2",
    defaultProps: {},
    defaultStyles: {
      base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
        width: "100%",
      },
      mobile: {
        flexDirection: "column",
        alignItems: "stretch",
      },
    },
    inspectorFields: [],
  },
  columns: {
    type: "columns",
    label: "Columns",
    category: "layout",
    description: "Pre-built two-column responsive split container.",
    isContainer: true,
    iconName: "Columns3",
    defaultProps: { ratio: "equal" },
    defaultStyles: {
      base: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        width: "100%",
        alignItems: "start",
      },
      mobile: {
        gridTemplateColumns: "1fr",
      },
    },
    inspectorFields: [
      {
        key: "ratio",
        label: "Preset Split",
        type: "select",
        options: [
          { value: "equal", label: "50 / 50" },
          { value: "sidebar-left", label: "33 / 67" },
          { value: "sidebar-right", label: "67 / 33" },
        ],
      },
    ],
    createDefaultChildren: (idFactory) => [
      {
        id: idFactory(),
        type: "column",
        version: 2,
        label: "Left Column",
        visible: true,
        locked: false,
        props: {},
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px",
            backgroundColor: "#F8FAFC",
            borderRadius: "10px",
          },
        },
        children: [
          {
            id: idFactory(),
            type: "heading",
            version: 2,
            label: "Column Heading",
            visible: true,
            locked: false,
            props: { text: "Engineered for trails", tag: "h3" },
            styles: { base: { fontSize: "22px", fontWeight: "700" } },
          },
          {
            id: idFactory(),
            type: "text_editor",
            version: 2,
            label: "Column Copy",
            visible: true,
            locked: false,
            props: {
              text: "Edit this text or drag elements directly into this column.",
            },
            styles: { base: { fontSize: "14px", color: "#5C6270" } },
          },
        ],
      },
      {
        id: idFactory(),
        type: "column",
        version: 2,
        label: "Right Column",
        visible: true,
        locked: false,
        props: {},
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px",
            backgroundColor: "#F8FAFC",
            borderRadius: "10px",
          },
        },
        children: [
          {
            id: idFactory(),
            type: "image",
            version: 2,
            label: "Column Image",
            visible: true,
            locked: false,
            props: {
              src: "/media/terrain-fallback.jpg",
              alt: "Editorial terrain preview",
            },
            styles: {
              base: {
                width: "100%",
                aspectRatio: "16 / 10",
                objectFit: "cover",
                borderRadius: "8px",
              },
            },
          },
        ],
      },
    ],
  },
  column: {
    type: "column",
    label: "Column",
    category: "layout",
    description: "Child column slot inside a Columns container.",
    isContainer: true,
    iconName: "PanelTop",
    defaultProps: {},
    defaultStyles: {
      base: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "12px",
      },
    },
    inspectorFields: [],
  },
  spacer: {
    type: "spacer",
    label: "Spacer",
    category: "layout",
    description: "Vertical breathing space with responsive height.",
    isContainer: false,
    iconName: "MoveVertical",
    defaultProps: {},
    defaultStyles: {
      base: {
        height: "40px",
        width: "100%",
      },
      mobile: {
        height: "24px",
      },
    },
    inspectorFields: [],
  },

  // ---- BASIC ----
  heading: {
    type: "heading",
    label: "Heading",
    category: "basic",
    description: "Editorial heading (H1–H6, P) with full typography styling.",
    isContainer: false,
    iconName: "Heading",
    defaultProps: {
      text: "Crafted for alpine terrain",
      tag: "h2",
      href: "",
    },
    defaultStyles: {
      base: {
        fontSize: "34px",
        fontWeight: "700",
        lineHeight: "1.18",
        color: "#111318",
      },
      mobile: {
        fontSize: "26px",
      },
    },
    inspectorFields: [
      { key: "text", label: "Heading Text", type: "textarea" },
      {
        key: "tag",
        label: "HTML Tag",
        type: "select",
        options: [
          { value: "h1", label: "H1" },
          { value: "h2", label: "H2" },
          { value: "h3", label: "H3" },
          { value: "h4", label: "H4" },
          { value: "p", label: "Paragraph" },
        ],
      },
      { key: "href", label: "Link URL (optional)", type: "url", placeholder: "/store/shop" },
    ],
  },
  text_editor: {
    type: "text_editor",
    label: "Text Editor",
    category: "basic",
    description: "Rich paragraph copy for stories, descriptions, and specs.",
    isContainer: false,
    iconName: "Type",
    defaultProps: {
      text: "Field-tested materials, balanced weight distribution, and repairable hardware built to last multiple seasons.",
    },
    defaultStyles: {
      base: {
        fontSize: "15px",
        lineHeight: "1.65",
        color: "#5C6270",
      },
    },
    inspectorFields: [{ key: "text", label: "Paragraph Text", type: "textarea" }],
  },
  image: {
    type: "image",
    label: "Image",
    category: "basic",
    description: "Responsive image frame with alt text and aspect controls.",
    isContainer: false,
    iconName: "Image",
    defaultProps: {
      src: "/media/terrain-fallback.jpg",
      alt: "Terrain product scene",
      caption: "",
      href: "",
    },
    defaultStyles: {
      base: {
        width: "100%",
        borderRadius: "10px",
        objectFit: "cover",
        aspectRatio: "16 / 10",
      },
    },
    inspectorFields: [
      { key: "src", label: "Image URL", type: "media" },
      { key: "alt", label: "Alt Text", type: "text" },
      { key: "caption", label: "Caption (optional)", type: "text" },
      { key: "href", label: "Link URL (optional)", type: "url" },
    ],
  },
  video: {
    type: "video",
    label: "Video",
    category: "basic",
    description: "Interactive video showcase card or lightbox trigger.",
    isContainer: false,
    iconName: "PlayCircle",
    defaultProps: {
      title: "Studio Prototyping Film",
      caption: "Inside our anodizing and waterproofing test bench.",
      posterUrl: "/media/terrain-fallback.jpg",
      videoUrl: "",
      actionLabel: "Play film",
    },
    defaultStyles: {
      base: {
        width: "100%",
        borderRadius: "12px",
      },
    },
    inspectorFields: [
      { key: "title", label: "Film Title", type: "text" },
      { key: "caption", label: "Caption", type: "textarea" },
      { key: "posterUrl", label: "Poster Image URL", type: "media" },
      { key: "videoUrl", label: "MP4 / Embed HTTPS URL", type: "url" },
      { key: "actionLabel", label: "Button Text", type: "text" },
    ],
  },
  button: {
    type: "button",
    label: "Button",
    category: "basic",
    description: "Call-to-action button linked to any store route or external URL.",
    isContainer: false,
    iconName: "MousePointerClick",
    defaultProps: {
      label: "Explore collection",
      href: "/store/shop",
      variant: "primary",
      icon: "arrow-right",
    },
    defaultStyles: {
      base: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        paddingTop: "11px",
        paddingBottom: "11px",
        paddingLeft: "20px",
        paddingRight: "20px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        backgroundColor: "#5B46E8",
        color: "#FFFFFF",
      },
    },
    inspectorFields: [
      { key: "label", label: "Button Label", type: "text" },
      { key: "href", label: "Destination URL", type: "url" },
      {
        key: "variant",
        label: "Preset Tone",
        type: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "outline", label: "Outline" },
          { value: "ghost", label: "Ghost" },
        ],
      },
      {
        key: "icon",
        label: "Trailing Icon",
        type: "icon",
      },
    ],
  },
  icon: {
    type: "icon",
    label: "Icon",
    category: "basic",
    description: "Scalable vector icon with optional label and badge frame.",
    isContainer: false,
    iconName: "Sparkles",
    defaultProps: {
      icon: "compass",
      caption: "",
      size: 28,
    },
    defaultStyles: {
      base: {
        color: "#5B46E8",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
      },
    },
    inspectorFields: [
      { key: "icon", label: "Icon", type: "icon" },
      { key: "caption", label: "Label (optional)", type: "text" },
      { key: "size", label: "Icon Size (px)", type: "number", min: 14, max: 72 },
    ],
  },
  divider: {
    type: "divider",
    label: "Divider",
    category: "basic",
    description: "Subtle horizontal rule separating sections or paragraphs.",
    isContainer: false,
    iconName: "Minus",
    defaultProps: { thickness: "1px", style: "solid" },
    defaultStyles: {
      base: {
        width: "100%",
        marginTop: "12px",
        marginBottom: "12px",
        borderColor: "#E5E7EB",
      },
    },
    inspectorFields: [
      {
        key: "style",
        label: "Line Style",
        type: "select",
        options: [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ],
      },
    ],
  },
  icon_list: {
    type: "icon_list",
    label: "Icon List",
    category: "basic",
    description: "Structured feature bullets, specs, or testimonials.",
    isContainer: false,
    iconName: "ListChecks",
    defaultProps: {
      layout: "list",
      columns: 3,
      items: [
        {
          id: "il-1",
          title: "Anodized 7075 Alloy",
          body: "CNC milled joints tested down to -20C.",
          icon: "shield",
        },
        {
          id: "il-2",
          title: "Express Dispatch",
          body: "Ships within 24 hours from regional hubs.",
          icon: "truck",
        },
        {
          id: "il-3",
          title: "Lifetime Hardware Repair",
          body: "Free spare buckles, seals, and toggles.",
          icon: "check",
        },
      ],
    },
    defaultStyles: {
      base: {
        width: "100%",
      },
    },
    inspectorFields: [
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "list", label: "Vertical List" },
          { value: "grid", label: "Card Grid" },
        ],
      },
      { key: "columns", label: "Grid Columns", type: "number", min: 2, max: 4 },
      { key: "items", label: "Items", type: "items" },
    ],
  },
  image_gallery: {
    type: "image_gallery",
    label: "Image Gallery",
    category: "basic",
    description: "Multi-column editorial lookbook grid.",
    isContainer: false,
    iconName: "Images",
    defaultProps: {
      columns: 3,
      items: [
        {
          id: "g-1",
          title: "Ridge Camp",
          body: "Morning mist setup",
          image: "/media/terrain-fallback.jpg",
        },
        {
          id: "g-2",
          title: "Timber Pack",
          body: "Waterproof seams",
          image: "/media/terrain-fallback.jpg",
        },
        {
          id: "g-3",
          title: "Field Desk",
          body: "Precision anodized cases",
          image: "/media/terrain-fallback.jpg",
        },
      ],
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "columns", label: "Columns", type: "number", min: 2, max: 4 },
      { key: "items", label: "Gallery Images", type: "items" },
    ],
  },

  // ---- ECOMMERCE ----
  product_card: {
    type: "product_card",
    label: "Product Card",
    category: "ecommerce",
    description: "Single live catalog product card with badge and pricing.",
    isContainer: false,
    iconName: "Package",
    defaultProps: {
      productSlug: "",
      showRating: true,
      showBadge: true,
    },
    defaultStyles: { base: { width: "100%", maxWidth: "340px" } },
    inspectorFields: [
      { key: "productSlug", label: "Featured Product", type: "product_select" },
      { key: "showRating", label: "Show Rating", type: "toggle" },
      { key: "showBadge", label: "Show Sale / Stock Badge", type: "toggle" },
    ],
  },
  product_grid: {
    type: "product_grid",
    label: "Product Grid",
    category: "ecommerce",
    description: "Filterable live catalog grid synced from your storefront inventory.",
    isContainer: false,
    iconName: "Grid3X3",
    defaultProps: {
      columns: 4,
      limit: 8,
      categorySlug: "",
      sortBy: "newest",
      actionLabel: "Shop all products",
      actionUrl: "/store/shop",
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "columns", label: "Columns", type: "number", min: 2, max: 4 },
      { key: "limit", label: "Max Products", type: "number", min: 2, max: 12 },
      { key: "categorySlug", label: "Category Filter", type: "category_select" },
      {
        key: "sortBy",
        label: "Sort Order",
        type: "select",
        options: [
          { value: "newest", label: "Newest" },
          { value: "best_sellers", label: "Best Sellers" },
          { value: "price_asc", label: "Price: Low to High" },
        ],
      },
      { key: "actionLabel", label: "Footer Link Text", type: "text" },
      { key: "actionUrl", label: "Footer Link URL", type: "url" },
    ],
  },
  product_carousel: {
    type: "product_carousel",
    label: "Product Carousel",
    category: "ecommerce",
    description: "Horizontal scrollable product showcase with previous/next controls.",
    isContainer: false,
    iconName: "GalleryHorizontalEnd",
    defaultProps: { limit: 6, categorySlug: "" },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "limit", label: "Products Shown", type: "number", min: 3, max: 12 },
      { key: "categorySlug", label: "Category Filter", type: "category_select" },
    ],
  },
  category_grid: {
    type: "category_grid",
    label: "Category Grid",
    category: "ecommerce",
    description: "Live store category cards linking directly to filtered shop pages.",
    isContainer: false,
    iconName: "FolderTree",
    defaultProps: { columns: 3, limit: 6 },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "columns", label: "Columns", type: "number", min: 2, max: 4 },
      { key: "limit", label: "Max Categories", type: "number", min: 2, max: 12 },
    ],
  },
  featured_product: {
    type: "featured_product",
    label: "Featured Product",
    category: "ecommerce",
    description: "Hero-sized product highlight with media, specs, price, and add-to-cart.",
    isContainer: false,
    iconName: "Star",
    defaultProps: {
      productSlug: "",
      kicker: "FLAGSHIP RELEASE",
      ctaLabel: "Add to cart",
    },
    defaultStyles: {
      base: {
        width: "100%",
        padding: "24px",
        borderRadius: "12px",
        backgroundColor: "#F8FAFC",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#E5E7EB",
      },
    },
    inspectorFields: [
      { key: "productSlug", label: "Product", type: "product_select" },
      { key: "kicker", label: "Badge Kicker", type: "text" },
      { key: "ctaLabel", label: "Button Label", type: "text" },
    ],
  },
  price: {
    type: "price",
    label: "Price",
    category: "ecommerce",
    description: "Live product pricing display with optional compare-at strikethrough.",
    isContainer: false,
    iconName: "BadgeDollarSign",
    defaultProps: {
      productSlug: "",
      amount: "189.00",
      compareAt: "220.00",
    },
    defaultStyles: {
      base: {
        fontSize: "24px",
        fontWeight: "700",
        color: "#111318",
      },
    },
    inspectorFields: [
      { key: "productSlug", label: "Bind Product Price", type: "product_select" },
      { key: "amount", label: "Fallback Price ($)", type: "text" },
      { key: "compareAt", label: "Compare-at Price ($)", type: "text" },
    ],
  },
  add_to_cart: {
    type: "add_to_cart",
    label: "Add to Cart",
    category: "ecommerce",
    description: "Direct add-to-cart button bound to a live SKU.",
    isContainer: false,
    iconName: "ShoppingBag",
    defaultProps: {
      productSlug: "",
      label: "Add to cart",
    },
    defaultStyles: {
      base: {
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
      },
    },
    inspectorFields: [
      { key: "productSlug", label: "Target Product", type: "product_select" },
      { key: "label", label: "Button Label", type: "text" },
    ],
  },
  product_info: {
    type: "product_info",
    label: "Product Information",
    category: "ecommerce",
    description: "Structured summary of product brand, category, stock, and rating.",
    isContainer: false,
    iconName: "Info",
    defaultProps: {
      productSlug: "",
      showDescription: true,
      showStock: true,
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "productSlug", label: "Product", type: "product_select" },
      { key: "showDescription", label: "Show Summary", type: "toggle" },
      { key: "showStock", label: "Show Inventory Status", type: "toggle" },
    ],
  },
  promotion_banner: {
    type: "promotion_banner",
    label: "Promotion Banner",
    category: "ecommerce",
    description: "High-contrast seasonal offer strip with CTA link.",
    isContainer: false,
    iconName: "Megaphone",
    defaultProps: {
      kicker: "LIMITED DROP",
      heading: "Complimentary express shipping on orders over $150",
      copy: "Applies automatically at checkout for all expedition essentials.",
      actionLabel: "Shop offer",
      actionUrl: "/store/shop",
    },
    defaultStyles: {
      base: {
        width: "100%",
        padding: "28px",
        borderRadius: "12px",
        backgroundColor: "#0F291E",
        color: "#FFFFFF",
      },
    },
    inspectorFields: [
      { key: "kicker", label: "Kicker", type: "text" },
      { key: "heading", label: "Headline", type: "text" },
      { key: "copy", label: "Supporting Copy", type: "textarea" },
      { key: "actionLabel", label: "Action Label", type: "text" },
      { key: "actionUrl", label: "Action URL", type: "url" },
    ],
  },

  // ---- ADVANCED ----
  tabs: {
    type: "tabs",
    label: "Tabs",
    category: "advanced",
    description: "Interactive tabbed panel switcher for specs, care, and sizing.",
    isContainer: false,
    iconName: "AppWindow",
    defaultProps: {
      items: [
        {
          id: "tab-1",
          title: "Specifications",
          body: "500D Cordura shell, anodized YKK AquaGuard hardware, 420g total weight.",
        },
        {
          id: "tab-2",
          title: "Field Care",
          body: "Rinse grit with cold water and reproof DWR coating annually.",
        },
        {
          id: "tab-3",
          title: "Shipping & Warranty",
          body: "Backed by our 5-year modular component replacement guarantee.",
        },
      ],
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [{ key: "items", label: "Tab Panels", type: "items" }],
  },
  accordion: {
    type: "accordion",
    label: "Accordion",
    category: "advanced",
    description: "Collapsible FAQ and specification disclosures.",
    isContainer: false,
    iconName: "ChevronsUpDown",
    defaultProps: {
      items: [
        {
          id: "acc-1",
          title: "What makes this shell waterproof?",
          body: "Seam-taped 3-layer laminate rated to 20,000mm hydrostatic head.",
        },
        {
          id: "acc-2",
          title: "Do replacement buckles ship worldwide?",
          body: "Yes, spare anodized hardware ships free under warranty.",
        },
      ],
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [{ key: "items", label: "Accordion Items", type: "items" }],
  },
  carousel: {
    type: "carousel",
    label: "Carousel",
    category: "advanced",
    description: "Interactive multi-slide media and story carousel.",
    isContainer: false,
    iconName: "GalleryHorizontal",
    defaultProps: {
      slides: [
        {
          id: "s-1",
          title: "Alpine Ridge Line",
          body: "Tested across wet granite and sub-zero ridgelines.",
          image: "/media/terrain-fallback.jpg",
          url: "/store/shop",
        },
        {
          id: "s-2",
          title: "Modular Timber Series",
          body: "Precision milled desk instruments built to age gracefully.",
          image: "/media/terrain-fallback.jpg",
          url: "/store/collections",
        },
      ],
    },
    defaultStyles: { base: { width: "100%", borderRadius: "12px" } },
    inspectorFields: [{ key: "slides", label: "Slides", type: "items" }],
  },
  countdown: {
    type: "countdown",
    label: "Countdown",
    category: "advanced",
    description: "Live countdown timer for drops and seasonal events.",
    isContainer: false,
    iconName: "Timer",
    defaultProps: {
      heading: "Autumn Capsule Launches In",
      targetIso: "2027-01-01T00:00:00Z",
    },
    defaultStyles: {
      base: {
        width: "100%",
        padding: "20px",
        borderRadius: "10px",
        backgroundColor: "#111318",
        color: "#FFFFFF",
        textAlign: "center",
      },
    },
    inspectorFields: [
      { key: "heading", label: "Title", type: "text" },
      { key: "targetIso", label: "Target ISO Date", type: "text" },
    ],
  },
  form: {
    type: "form",
    label: "Form",
    category: "advanced",
    description: "Sanitized lead capture or contact form with instant feedback.",
    isContainer: false,
    iconName: "ClipboardList",
    defaultProps: {
      heading: "Join our field dispatch",
      submitLabel: "Submit",
      successMessage: "Thanks — your message has been recorded.",
      fields: [
        {
          id: "f-email",
          label: "Email address",
          type: "email",
          placeholder: "you@domain.com",
          required: true,
        },
      ],
    },
    defaultStyles: { base: { width: "100%" } },
    inspectorFields: [
      { key: "heading", label: "Form Heading", type: "text" },
      { key: "submitLabel", label: "Submit Button Text", type: "text" },
      { key: "successMessage", label: "Success Message", type: "text" },
      { key: "fields", label: "Fields", type: "form_fields" },
    ],
  },
  custom_html: {
    type: "custom_html",
    label: "Custom HTML",
    category: "advanced",
    description: "Strictly sanitized HTML snippet (scripts and event handlers stripped).",
    isContainer: false,
    iconName: "Code2",
    defaultProps: {
      html: '<div class="custom-callout"><strong>Studio Note:</strong> Small-batch anodized runs ship Thursdays.</div>',
    },
    defaultStyles: {
      base: {
        width: "100%",
        padding: "14px",
        borderRadius: "8px",
        backgroundColor: "#F8FAFC",
      },
    },
    inspectorFields: [
      {
        key: "html",
        label: "Sanitized HTML",
        type: "html",
        help: "Scripts, iframes, styles, and inline event handlers are stripped automatically.",
      },
    ],
  },
};

export const PALETTE_ELEMENT_TYPES: ElementType[] = [
  // Layout (6 palette types; column is child inside columns)
  "section",
  "container",
  "grid",
  "flex",
  "columns",
  "spacer",
  // Basic (9)
  "heading",
  "text_editor",
  "image",
  "video",
  "button",
  "icon",
  "divider",
  "icon_list",
  "image_gallery",
  // Ecommerce (9)
  "product_card",
  "product_grid",
  "product_carousel",
  "category_grid",
  "featured_product",
  "price",
  "add_to_cart",
  "product_info",
  "promotion_banner",
  // Advanced (6)
  "tabs",
  "accordion",
  "carousel",
  "countdown",
  "form",
  "custom_html",
];

export function createElementNode(type: ElementType): ElementNode {
  const def = ELEMENT_DEFINITIONS[type];
  const node: ElementNode = {
    id: createElementId(type),
    type,
    version: 2,
    label: def.label,
    visible: true,
    locked: false,
    props: structuredClone(def.defaultProps),
    styles: structuredClone(def.defaultStyles),
  };
  if (def.isContainer) {
    node.children = def.createDefaultChildren
      ? def.createDefaultChildren(() => createElementId("el"))
      : [];
  }
  return node;
}
