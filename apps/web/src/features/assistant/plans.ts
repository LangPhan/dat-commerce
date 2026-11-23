import { newId, usd } from "@/lib/format";
import { categorySalesBreakdown, revenueSeries } from "@/mocks/operations";
import { blockKinds, makeBlock } from "@/mocks/pages";
import type { PlanResult, Snapshot, ToolStep } from "@/types/ai";
import type { Attribute, Category, Discount } from "@/types/commerce";

const clean = (value: string) =>
  value
    .trim()
    .replace(/^["“]|["”.!?]+$/g, "")
    .trim();

const step = (
  tool: string,
  label: string,
  detail: string,
  records: number,
  durationMs = 110
): ToolStep => ({
  id: newId(),
  tool,
  label,
  detail,
  records,
  durationMs,
  status: "completed",
});

const reject = (text: string): PlanResult => ({ text, error: true });

export function prepare(prompt: string, state: Snapshot): PlanResult {
  const query = prompt.toLowerCase();
  const nike = state.catalog.filter(
    (product) => product.brand.toLowerCase() === "nike"
  );

  // 1. Revenue analysis
  if (/revenue|analy[sz]e.*sales|best[- ]performing/.test(query)) {
    const total30 = revenueSeries["Last 30 days"].reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const top = categorySalesBreakdown[0];
    const second = categorySalesBreakdown[1];
    return {
      text: `Last 30 days gross revenue reached ${usd(total30)} (+16.4% MoM). ${top.category} led revenue share at ${top.share}% (${usd(top.revenue)}), followed by ${second.category} at ${second.share}% (${usd(second.revenue)}). Most recent week closed at ${usd(revenueSeries["Last 30 days"].at(-1)?.amount || 0)}.`,
    };
  }

  // 2. Promotion suggestion
  if (/suggest.*promotion|low sales/.test(query)) {
    const slow = [...state.catalog]
      .sort((a, b) => (a.salesCount || 0) - (b.salesCount || 0))
      .slice(0, 2);
    return {
      text: `Recommend a 15% 7-day promotion on ${slow.map((s) => s.name).join(" and ")} (Accessories & Electronics) paired with Footwear bundles. Use "Create a 15% discount for Accessories" to draft it immediately.`,
    };
  }

  // 3. Homepage / Storefront section additions via AI Operator
  const requestedBlock = blockKinds.find((kind) =>
    query.includes(kind.toLowerCase())
  );
  if (/\b(add|insert|create)\b/.test(query) && requestedBlock && state.draftBlocks) {
    const newBlock = makeBlock(requestedBlock, newId());
    const heroIdx = state.draftBlocks.findIndex((b) => b.type === "Hero");
    const insertAt = heroIdx >= 0 ? heroIdx + 1 : state.draftBlocks.length;
    const nextDraft = [
      ...state.draftBlocks.slice(0, insertAt),
      newBlock,
      ...state.draftBlocks.slice(insertAt),
    ];
    return {
      text: `Prepared a draft update inserting a "${newBlock.label}" section to your homepage.`,
      link: true,
      plan: {
        summary: `Add ${newBlock.label} section to homepage`,
        category: "storefront",
        sensitive: true,
        editorLink: true,
        steps: [
          step("cms.read_page", "Inspecting homepage layout", `Loaded ${state.draftBlocks.length} existing sections`, state.draftBlocks.length, 85),
          step("cms.insert_block", `Inserting ${newBlock.type} block`, `Placed below Hero section in draft`, 1, 120),
          step("cms.validate_schema", "Validating section configuration", "Verified responsive schema & defaults", 1, 70),
        ],
        changes: [
          {
            name: "Home page draft",
            before: `${state.draftBlocks.length} sections`,
            after: `${nextDraft.length} sections (+${newBlock.label})`,
          },
        ],
        updates: { draftBlocks: nextDraft },
      },
    };
  }

  // 4. Hero theme / design update via AI Operator
  if (/(hero|banner)/.test(query) && /(dark|premium|light|two-column|split|update|change)/.test(query) && state.draftBlocks) {
    const hero = state.draftBlocks.find((b) => b.type === "Hero");
    if (hero) {
      const nextHero = {
        ...hero,
        tone: /light/.test(query) ? ("light" as const) : ("ink" as const),
        layout: /split|two/.test(query) ? ("split" as const) : hero.layout,
        scale: /premium|large|bold/.test(query) ? ("large" as const) : hero.scale,
      };
      const nextDraft = state.draftBlocks.map((b) =>
        b.id === hero.id ? nextHero : b
      );
      return {
        text: "Prepared a visual update for your homepage hero banner. Review the changes and open the Visual Editor to preview live.",
        link: true,
        plan: {
          summary: "Update homepage hero banner design",
          category: "storefront",
          sensitive: true,
          editorLink: true,
          steps: [
            step("cms.select_block", "Locating Hero section", `Matched block #${hero.id}`, 1, 75),
            step("cms.patch_styles", "Applying visual tokens", `Tone: ${nextHero.tone}, Scale: ${nextHero.scale}`, 1, 115),
            step("cms.stage_draft", "Staging draft revision", "Ready for visual preview & publish", 1, 65),
          ],
          changes: [
            {
              name: hero.label,
              before: `${hero.tone} · ${hero.layout} · ${hero.scale}`,
              after: `${nextHero.tone} · ${nextHero.layout} · ${nextHero.scale}`,
            },
          ],
          updates: { draftBlocks: nextDraft },
        },
      };
    }
  }

  // 5. Fallback for explicit visual editor requests
  if (/homepage|hero|theme|banner|publish/.test(query)) {
    return {
      text: "Open the AI Visual Store Editor to select any storefront section and preview layout or style changes live.",
      link: true,
    };
  }

  // 6. Bulk / Targeted Price Updates
  if (/price/.test(query) && /\d+(?:\.\d+)?\s*%/.test(query)) {
    const amount = Number(query.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
    const isDecrease = query.includes("decrease") || query.includes("lower") || query.includes("reduce");
    const multiplier = 1 + (isDecrease ? -amount : amount) / 100;

    const categoryMatch = state.categories.find((c) =>
      query.includes(c.name.toLowerCase())
    );
    const matched = query.includes("nike")
      ? nike
      : categoryMatch
        ? state.catalog.filter((p) => p.category === categoryMatch.name)
        : /all (products|prices)/.test(query)
          ? state.catalog
          : state.catalog.filter((p) => query.includes(p.name.toLowerCase()));

    if (!matched.length) {
      return reject(
        "No matching products found for that price update. Specify a brand (e.g. Nike), category, product name, or 'all products'."
      );
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return reject("This change would produce a non-positive price. Enter a smaller percentage.");
    }

    const hits = new Set(matched.map((item) => item.id));
    const next = state.catalog.map((item) =>
      hits.has(item.id)
        ? { ...item, price: Math.round(item.price * multiplier * 100) / 100 }
        : item
    );
    const changes = matched.map((item) => ({
      name: item.name,
      before: usd(item.price),
      after: usd(next.find((p) => p.id === item.id)?.price || 0),
    }));

    return {
      text: `Found ${hits.size} matching products. Review the proposed price adjustments before committing.`,
      plan: {
        summary: `${isDecrease ? "Decrease" : "Increase"} prices by ${amount}% for ${hits.size} products`,
        category: "pricing",
        sensitive: true,
        steps: [
          step("catalog.search_products", "Searching catalog", `Matched ${hits.size} SKUs`, hits.size, 95),
          step("pricing.compute_delta", "Calculating new prices", `Applying ${isDecrease ? "-" : "+"}${amount}% multiplier`, hits.size, 110),
          step("catalog.verify_prices", "Verifying catalog constraints", "All prices positive and formatted in USD", hits.size, 80),
        ],
        changes,
        updates: { catalog: next },
      },
    };
  }

  // 7. Bulk product deletion
  if (/\bdelete\b/.test(query) && /product/.test(query)) {
    const matched = query.includes("nike")
      ? nike
      : state.catalog.filter((product) =>
          query.includes(product.name.toLowerCase())
        );
    if (!matched.length) {
      return reject("No matching products found. Specify a brand or exact product title.");
    }
    const ids = new Set(matched.map((m) => m.id));
    return {
      text: "This is a destructive catalog operation. Review the records to be deleted before confirming.",
      plan: {
        summary: `Delete ${matched.length} products`,
        category: "catalog",
        sensitive: true,
        steps: [
          step("catalog.search_products", "Locating target SKUs", `Found ${matched.length} products`, matched.length, 90),
          step("catalog.delete_products", "Preparing removal batch", "Staging catalog deletions", matched.length, 105),
        ],
        changes: matched.map((item) => ({
          name: item.name,
          before: `${item.category} · ${item.stock} in stock`,
          after: "Removed from catalog",
        })),
        updates: {
          catalog: state.catalog.filter((item) => !ids.has(item.id)),
        },
      },
    };
  }

  // 8. Discount creation
  if (/\bdiscount\b/.test(query) && /\d+(?:\.\d+)?\s*%/.test(query)) {
    const rate = Number(query.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
    if (!(rate > 0 && rate <= 100)) {
      return reject("A percentage discount must be between 1% and 100%.");
    }
    const target = state.categories.find((item) =>
      query.includes(item.name.toLowerCase())
    );
    const named = query.match(/(?:for|on)\s+(?:the\s+)?(.+?)\s+category/);
    if (named && !target) {
      return reject(
        `Category "${clean(named[1])}" does not exist yet. Create the category first or choose an existing one.`
      );
    }
    const eligible = target?.name || "All products";
    const name = eligible === "All products" ? "Storewide offer" : `${eligible} offer`;
    const baseCode =
      (eligible === "All products"
        ? "TRAIL"
        : eligible.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10)) +
      rate.toString().replace(".", "");
    const code = state.discounts.some((d) => d.code === baseCode)
      ? `${baseCode}B`
      : baseCode;

    const start = new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 14);
    const offer: Discount = {
      id: newId(),
      name,
      code,
      eligible,
      type: "Percentage",
      value: rate,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      limit: 150,
      used: 0,
      status: "Active",
    };
    const eligibleCount = state.catalog.filter(
      (item) => !target || item.category === eligible
    ).length;

    return {
      text: `Staged a ${rate}% promotion (${code}) scoped to ${eligible}. Review and approve to publish.`,
      plan: {
        summary: `Create ${rate}% discount for ${eligible}`,
        category: "promotion",
        sensitive: true,
        steps: [
          step("catalog.resolve_eligibility", "Resolving eligible SKUs", `${eligibleCount} matching products in ${eligible}`, eligibleCount, 85),
          step("promotions.create_discount", "Configuring discount rule", `Generated code ${code} (${rate}% off)`, 1, 115),
          step("promotions.verify_dates", "Validating schedule & caps", "14-day window · 150 redemptions", 1, 70),
        ],
        changes: [
          {
            name: code,
            before: "No discount",
            after: `${rate}% off · ${eligible} · Active`,
          },
        ],
        updates: { discounts: [...state.discounts, offer] },
      },
    };
  }

  // 9. Create Product Type with Attributes
  if (/product type/.test(query) && /(create|add)/.test(query)) {
    const parsed = prompt.match(
      /product type\s+(?:called\s+|named\s+)?(.+?)(?:\s+with\s+(.+))?$/i
    );
    const name = clean(parsed?.[1] || "");
    if (!name) return reject("Include a name for the new product type.");

    const rawFields = (parsed?.[2] || "")
      .replace(/\battributes?[.!]?$/i, "")
      .replace(/\s+and\s+/gi, ",")
      .split(",")
      .map(clean)
      .filter(Boolean);

    const existingCat = state.categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    const addedAttrs: Attribute[] = rawFields.map((field, index) => ({
      id: newId(),
      name: field,
      code: `${name}_${field}`.toLowerCase().replace(/\W+/g, "_"),
      type: "Select",
      productType: name,
      required: false,
      filterable: true,
      searchable: true,
      order: index + 1,
      validation: "",
      options: "",
    }));

    const nextCategories = existingCat
      ? state.categories
      : [
          ...state.categories,
          { id: newId(), name, parent: "", description: `${name} catalog`, image: "" },
        ];

    return {
      text: `Prepared ${name} schema with ${addedAttrs.length} filterable attributes.`,
      plan: {
        summary: `Create ${name} product type with ${addedAttrs.length} attributes`,
        category: "schema",
        sensitive: true,
        steps: [
          step("schema.create_product_type", "Registering product type", existingCat ? `Reusing ${name}` : `Created ${name}`, 1, 90),
          step("schema.create_attributes", "Defining dynamic attributes", rawFields.join(", ") || "Base schema", addedAttrs.length, 120),
          step("schema.index_filters", "Enabling storefront facets", "Marked all new attributes filterable", addedAttrs.length, 70),
        ],
        changes: [
          {
            name,
            before: existingCat ? "Existing category" : "No product type",
            after: rawFields.join(", ") || "New product type",
          },
        ],
        updates: {
          categories: nextCategories,
          attributes: [...state.attributes, ...addedAttrs],
        },
      },
    };
  }

  // 10. Create Category & optionally assign Nike running products
  if (/\bcategory\b/.test(query) && /(create|add)/.test(query)) {
    const parsed = prompt.match(
      /category\s+(?:called\s+|named\s+)?(.+?)(?:\s+and\s+(?:add|assign)\s+.*)?$/i
    );
    const name = clean(parsed?.[1] || "");
    if (!name) return reject('Include the category name after "called".');
    if (
      state.categories.some(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return reject(`A category named "${name}" already exists.`);
    }

    const shouldAssignNike =
      /and\s+(add|assign)/.test(query) && query.includes("nike");
    const assigned = shouldAssignNike ? nike : [];
    const nextCatalog = state.catalog.map((item) =>
      assigned.some((a) => a.id === item.id)
        ? { ...item, category: name }
        : item
    );

    const newCat: Category = {
      id: newId(),
      name,
      parent: "",
      description: `Curated ${name} gear and essentials.`,
      image: assigned[0]?.image || "/media/shoe-red.jpg",
    };

    const steps: ToolStep[] = [
      ...(assigned.length
        ? [
            step(
              "catalog.search_products",
              "Searching for Nike running products",
              `Found ${assigned.length} matching Nike SKUs`,
              assigned.length,
              95
            ),
          ]
        : []),
      step(
        "catalog.create_category",
        `Creating ${name} category`,
        "Added top-level category record",
        1,
        105
      ),
      ...(assigned.length
        ? [
            step(
              "catalog.assign_products",
              "Assigning matching products",
              `Moved ${assigned.length} products into ${name}`,
              assigned.length,
              115
            ),
          ]
        : []),
      step(
        "catalog.verify_tree",
        "Verifying catalog integrity",
        "Category tree & storefront filters synced",
        assigned.length + 1,
        70
      ),
    ];

    return {
      text: `Ready to create "${name}"${assigned.length ? ` and assign ${assigned.length} Nike products` : ""}. Review the plan before confirming.`,
      plan: {
        summary: `Create ${name}${assigned.length ? ` & assign ${assigned.length} products` : ""}`,
        category: "catalog",
        sensitive: true,
        steps,
        changes: [
          { name, before: "No category", after: "Top-level category" },
          ...assigned.map((item) => ({
            name: item.name,
            before: item.category,
            after: name,
          })),
        ],
        updates: {
          categories: [...state.categories, newCat],
          ...(assigned.length ? { catalog: nextCatalog } : {}),
        },
      },
    };
  }

  return reject(
    "I couldn't map that command to a store operation. Try creating a category, adjusting product prices, creating a discount, adding a homepage section, or analyzing sales."
  );
}
