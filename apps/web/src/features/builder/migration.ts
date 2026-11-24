import { apiBlocksToEditorBlocks } from "@/lib/cms-schema";
import type { PageContentPayload } from "@/types/api-cms-ai";
import type { Block } from "@/types/editor";
import { createElementId } from "./operations";
import type { ElementNode, PageDocumentV2, StyleValues } from "./types";

export function isV2Content(
  content?: PageContentPayload | null
): content is PageContentPayload & { version: 2; nodes: ElementNode[] } {
  return Boolean(
    content &&
      (content.version === 2 || Array.isArray(content.nodes)) &&
      Array.isArray(content.nodes)
  );
}

function tonePalette(tone: Block["tone"]): { bg: string; color: string; muted: string } {
  if (tone === "forest") {
    return {
      bg: "#0F291E",
      color: "#FFFFFF",
      muted: "rgba(255,255,255,0.82)",
    };
  }
  if (tone === "ink") {
    return {
      bg: "#111318",
      color: "#FFFFFF",
      muted: "rgba(255,255,255,0.78)",
    };
  }
  return {
    bg: "#FFFFFF",
    color: "var(--store-text, #111318)",
    muted: "var(--store-muted, #5C6270)",
  };
}

function spacingPadY(spacing?: Block["spacing"]): string {
  if (spacing === "compact") return "40px";
  if (spacing === "spacious") return "96px";
  return "64px";
}

function baseNode(
  partial: Partial<ElementNode> & Pick<ElementNode, "id" | "type" | "label">
): ElementNode {
  return {
    version: 2,
    visible: true,
    locked: false,
    props: {},
    styles: { base: {} },
    ...partial,
  };
}

function responsiveSectionStyles(base: StyleValues): ElementNode["styles"] {
  return {
    base,
    tablet: { paddingLeft: "36px", paddingRight: "36px" },
    mobile: { paddingLeft: "24px", paddingRight: "24px" },
  };
}

export function migrateBlockToV2Node(block: Block): ElementNode {
  const palette = tonePalette(block.tone);
  const padY = spacingPadY(block.spacing);
  const sid = block.id || createElementId("sec");

  const sectionStyle: StyleValues = {
    paddingTop: padY,
    paddingBottom: padY,
    paddingLeft: "64px",
    paddingRight: "64px",
    backgroundColor: palette.bg,
    color: palette.color,
  };

  if (block.type === "Hero" || block.type === "Collection Banner") {
    const isHero = block.type === "Hero";
    const isCentered = block.layout === "centered";
    const bgOverlay: StyleValues =
      block.layout === "overlay" && block.image
        ? {
            backgroundImage: `linear-gradient(125deg, rgba(17,19,24,0.72), rgba(15,41,30,0.52)), url(${block.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "#FFFFFF",
            minHeight: block.scale === "large" ? "520px" : "420px",
            display: "flex",
            alignItems: "center",
            justifyContent: isCentered ? "center" : "flex-start",
          }
        : {
            ...sectionStyle,
          };

    const contentChildren: ElementNode[] = [];
    if (block.kicker) {
      contentChildren.push(
        baseNode({
          id: `${sid}-kicker`,
          type: "heading",
          label: "Kicker",
          props: { text: block.kicker, tag: "p" },
          styles: {
            base: {
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: block.layout === "overlay" ? "rgba(255,255,255,0.82)" : palette.muted,
              marginBottom: "8px",
            },
          },
        })
      );
    }
    contentChildren.push(
      baseNode({
        id: `${sid}-heading`,
        type: "heading",
        label: isHero ? "Hero Heading" : "Banner Heading",
        props: { text: block.heading || block.label, tag: isHero ? "h1" : "h2" },
        styles: {
          base: {
            fontSize: block.scale === "large" ? "48px" : "36px",
            fontWeight: "700",
            lineHeight: "1.12",
            marginBottom: "14px",
            color: block.layout === "overlay" ? "#FFFFFF" : palette.color,
          },
          mobile: {
            fontSize: "30px",
          },
        },
      })
    );
    if (block.copy) {
      contentChildren.push(
        baseNode({
          id: `${sid}-copy`,
          type: "text_editor",
          label: "Description",
          props: { text: block.copy },
          styles: {
            base: {
              fontSize: "16px",
              lineHeight: "1.6",
              maxWidth: "600px",
              marginBottom: "24px",
              color: block.layout === "overlay" ? "rgba(255,255,255,0.88)" : palette.muted,
            },
          },
        })
      );
    }
    if (block.action) {
      const darkHero = block.layout === "overlay" || block.tone !== "light";
      contentChildren.push(
        baseNode({
          id: `${sid}-cta`,
          type: "button",
          label: "CTA Button",
          props: {
            label: block.action,
            href: block.actionUrl || "/store/shop",
            variant: "primary",
            icon: "arrow-right",
          },
          styles: {
            base: darkHero
              ? {
                  backgroundColor: "#FFFFFF",
                  color: "#111318",
                  borderRadius: "8px",
                  paddingTop: "11px",
                  paddingBottom: "11px",
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  fontWeight: "600",
                }
              : {
                  backgroundColor: "#5B46E8",
                  color: "#FFFFFF",
                  borderRadius: "8px",
                  paddingTop: "11px",
                  paddingBottom: "11px",
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  fontWeight: "600",
                },
          },
        })
      );
    }

    const innerChildren: ElementNode[] =
      block.layout === "split"
        ? [
            baseNode({
              id: `${sid}-grid`,
              type: "grid",
              label: "Split Grid",
              props: { columns: 2 },
              styles: {
                base: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "32px",
                  alignItems: "center",
                },
                mobile: {
                  gridTemplateColumns: "1fr",
                },
              },
              children: [
                baseNode({
                  id: `${sid}-left`,
                  type: "container",
                  label: "Text Column",
                  props: {},
                  children: contentChildren,
                }),
                baseNode({
                  id: `${sid}-img`,
                  type: "image",
                  label: "Hero Image",
                  props: {
                    src: block.image || "/media/terrain-fallback.jpg",
                    alt: block.heading || "Hero media",
                  },
                  styles: {
                    base: {
                      borderRadius: "12px",
                      width: "100%",
                      objectFit: "cover",
                      aspectRatio: "4 / 3",
                    },
                  },
                }),
              ],
            }),
          ]
        : [
            baseNode({
              id: `${sid}-wrap`,
              type: "container",
              label: "Hero Container",
              props: {},
              styles: {
                base: {
                  width: "100%",
                  margin: isCentered ? "0 auto" : "0",
                  ...(isCentered ? { maxWidth: "1280px" } : {}),
                  textAlign: isCentered ? "center" : "left",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isCentered ? "center" : "flex-start",
                },
              },
              children: contentChildren,
            }),
          ];

    const heroBaseStyle: StyleValues = {
      ...sectionStyle,
      ...(isCentered ? {} : { paddingLeft: "64px", paddingRight: "64px" }),
      ...bgOverlay,
    };

    return baseNode({
      id: sid,
      type: "section",
      label: block.label || (isHero ? "Hero Section" : "Collection Banner"),
      visible: block.visible,
      props: {},
      styles: isCentered
        ? { base: heroBaseStyle }
        : {
            base: heroBaseStyle,
            tablet: { paddingLeft: "36px", paddingRight: "36px" },
            mobile: { paddingLeft: "24px", paddingRight: "24px" },
          },
      children: innerChildren,
    });
  }

  if (block.type === "Image with Text") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Image with Text",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-grid`,
          type: "grid",
          label: "Two-Column Split",
          props: { columns: 2 },
          styles: {
            base: {
              width: "100%",
              margin: "0",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "32px",
              alignItems: "center",
            },
            mobile: { gridTemplateColumns: "1fr" },
          },
          children: [
            baseNode({
              id: `${sid}-img`,
              type: "image",
              label: "Feature Image",
              props: {
                src: block.image || "/media/terrain-fallback.jpg",
                alt: block.heading || "Feature image",
              },
              styles: {
                base: {
                  width: "100%",
                  borderRadius: "12px",
                  aspectRatio: "4 / 3",
                  objectFit: "cover",
                },
              },
            }),
            baseNode({
              id: `${sid}-content`,
              type: "flex",
              label: "Text Stack",
              props: {},
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  alignItems: "flex-start",
                },
              },
              children: [
                baseNode({
                  id: `${sid}-h2`,
                  type: "heading",
                  label: "Heading",
                  props: { text: block.heading || block.label, tag: "h2" },
                  styles: { base: { fontSize: "30px", fontWeight: "700" } },
                }),
                baseNode({
                  id: `${sid}-copy`,
                  type: "text_editor",
                  label: "Body Copy",
                  props: { text: block.copy || "" },
                  styles: { base: { fontSize: "15px", color: palette.muted, lineHeight: "1.6" } },
                }),
                ...(block.action
                  ? [
                      baseNode({
                        id: `${sid}-btn`,
                        type: "button",
                        label: "Action Button",
                        props: {
                          label: block.action,
                          href: block.actionUrl || "/store/shop",
                          variant: "primary",
                        },
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Product Grid" || block.type === "Best Sellers") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || block.type,
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "Section Container",
          props: {},
          styles: { base: { width: "100%", margin: "0", display: "flex", flexDirection: "column", gap: "20px" } },
          children: [
            baseNode({
              id: `${sid}-title`,
              type: "heading",
              label: "Section Heading",
              props: { text: block.heading || block.type, tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-grid`,
              type: "product_grid",
              label: block.type,
              props: {
                columns: block.columns || 4,
                limit: 8,
                sortBy: block.type === "Best Sellers" ? "best_sellers" : "newest",
                actionLabel: block.action || "View all",
                actionUrl: block.actionUrl || "/store/shop",
              },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Featured Categories") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Featured Categories",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "Categories Container",
          props: {},
          styles: { base: { width: "100%", margin: "0", display: "flex", flexDirection: "column", gap: "20px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "Section Heading",
              props: { text: block.heading || "Shop by category", tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-cats`,
              type: "category_grid",
              label: "Category Grid",
              props: { columns: block.columns || 3, limit: 6 },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Promotional Banner") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Promotional Banner",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles({ ...sectionStyle, paddingTop: "32px", paddingBottom: "32px" }),
      children: [
        baseNode({
          id: `${sid}-promo`,
          type: "promotion_banner",
          label: "Promotion Banner",
          props: {
            kicker: block.kicker || "SEASONAL OFFER",
            heading: block.heading || "Free express shipping over $150",
            copy: block.copy || "",
            actionLabel: block.action || "Shop offer",
            actionUrl: block.actionUrl || "/store/shop",
          },
        }),
      ],
    });
  }

  if (block.type === "FAQ") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "FAQ",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "FAQ Container",
          props: {},
          styles: { base: { maxWidth: "880px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "FAQ Title",
              props: { text: block.heading || "Frequently asked questions", tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-acc`,
              type: "accordion",
              label: "FAQ Items",
              props: {
                items: (block.items || []).map((it) => ({
                  id: it.id,
                  title: it.title,
                  body: it.body,
                })),
              },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Image Gallery") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Image Gallery",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "Gallery Container",
          props: {},
          styles: { base: { width: "100%", margin: "0", display: "flex", flexDirection: "column", gap: "18px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "Gallery Title",
              props: { text: block.heading || "Lookbook", tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-gallery`,
              type: "image_gallery",
              label: "Image Gallery",
              props: {
                columns: block.columns || 3,
                items: (block.items || []).map((it) => ({
                  id: it.id,
                  title: it.title,
                  body: it.body,
                  image: it.image || block.image || "/media/terrain-fallback.jpg",
                })),
              },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Video Section") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Video Section",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "Video Container",
          props: {},
          styles: { base: { maxWidth: "1024px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "Video Title",
              props: { text: block.heading || "Workshop Film", tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-vid`,
              type: "video",
              label: "Video Player",
              props: {
                posterUrl: block.image || "/media/terrain-fallback.jpg",
                title: block.heading || "Product Film",
                caption: block.copy || "",
                actionLabel: block.action || "Play video",
              },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Newsletter") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || "Newsletter",
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: "Newsletter Container",
          props: {},
          styles: { base: { maxWidth: "680px", margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "Newsletter Heading",
              props: { text: block.heading || "Stay in the loop", tag: "h2" },
              styles: { base: { fontSize: "28px", fontWeight: "700" } },
            }),
            baseNode({
              id: `${sid}-copy`,
              type: "text_editor",
              label: "Newsletter Subtext",
              props: { text: block.copy || "Get new drops and trail stories." },
              styles: { base: { fontSize: "15px", color: palette.muted } },
            }),
            baseNode({
              id: `${sid}-form`,
              type: "form",
              label: "Newsletter Form",
              props: {
                submitLabel: block.action || "Subscribe",
                successMessage: "Subscribed! Watch your inbox for our next field dispatch.",
                fields: [
                  {
                    id: "email",
                    label: "Email address",
                    type: "email",
                    placeholder: "you@domain.com",
                    required: true,
                  },
                ],
              },
            }),
          ],
        }),
      ],
    });
  }

  if (block.type === "Testimonials" || block.type === "Logo Cloud") {
    return baseNode({
      id: sid,
      type: "section",
      label: block.label || block.type,
      visible: block.visible,
      props: {},
      styles: responsiveSectionStyles(sectionStyle),
      children: [
        baseNode({
          id: `${sid}-wrap`,
          type: "container",
          label: `${block.type} Container`,
          props: {},
          styles: { base: { width: "100%", margin: "0", display: "flex", flexDirection: "column", gap: "20px" } },
          children: [
            baseNode({
              id: `${sid}-h2`,
              type: "heading",
              label: "Heading",
              props: { text: block.heading || block.type, tag: "h2" },
              styles: { base: { fontSize: "26px", fontWeight: "700", textAlign: "center" } },
            }),
            baseNode({
              id: `${sid}-list`,
              type: "icon_list",
              label: block.type === "Testimonials" ? "Customer Quotes" : "Press Mentions",
              props: {
                layout: "grid",
                columns: Math.min(4, Math.max(2, block.columns || 3)),
                items: (block.items || []).map((it) => ({
                  id: it.id,
                  title: it.title,
                  subtitle: it.subtitle,
                  body: it.body,
                  icon: block.type === "Testimonials" ? "quote" : "award",
                })),
              },
            }),
          ],
        }),
      ],
    });
  }

  // Rich Text or default fallback
  return baseNode({
    id: sid,
    type: "section",
    label: block.label || "Rich Text",
    visible: block.visible,
    props: {},
    styles: responsiveSectionStyles(sectionStyle),
    children: [
      baseNode({
        id: `${sid}-wrap`,
        type: "container",
        label: "Content Container",
        props: {},
        styles: { base: { maxWidth: "780px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" } },
        children: [
          baseNode({
            id: `${sid}-h2`,
            type: "heading",
            label: "Heading",
            props: { text: block.heading || block.label, tag: "h2" },
            styles: { base: { fontSize: "30px", fontWeight: "700" } },
          }),
          baseNode({
            id: `${sid}-body`,
            type: "text_editor",
            label: "Editorial Copy",
            props: { text: block.copy || "" },
            styles: { base: { fontSize: "16px", lineHeight: "1.7", color: palette.muted } },
          }),
        ],
      }),
    ],
  });
}

export function migrateV1ToV2(content?: PageContentPayload | null): PageDocumentV2 {
  const blocks = apiBlocksToEditorBlocks(content);
  return {
    version: 2,
    nodes: blocks.map((b) => migrateBlockToV2Node(b)),
  };
}

export function extractPageDocumentV2(
  content?: PageContentPayload | null
): PageDocumentV2 {
  if (isV2Content(content)) {
    return {
      version: 2,
      nodes: content.nodes as ElementNode[],
      ...(content.meta ? { meta: content.meta } : {}),
    };
  }
  return migrateV1ToV2(content);
}
