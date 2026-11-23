import { newId } from "@/lib/format";
import { blockKinds, makeBlock } from "@/mocks/pages";
import type { Block, Proposal, ProposalDiff } from "@/types/editor";

export function propose(
  prompt: string,
  blocks: Block[],
  selected: Block
): Proposal | null {
  const lower = prompt.toLowerCase();
  const requested = blockKinds.find((kind) =>
    lower.includes(kind.toLowerCase())
  );

  // 1. Add / insert a new section below the selected block
  if (/\b(add|insert|create)\b/.test(lower) && requested) {
    const newBlock = makeBlock(requested, newId());
    const index = blocks.findIndex((item) => item.id === selected.id) + 1;
    const after = [
      ...blocks.slice(0, index),
      newBlock,
      ...blocks.slice(index),
    ];
    return {
      before: blocks,
      after,
      title: `Add ${newBlock.label}`,
      changes: [`Insert ${newBlock.type} section below ${selected.label}`],
      diffs: [
        {
          field: "Page sections",
          before: `${blocks.length} sections`,
          after: `${after.length} sections (+${newBlock.label})`,
        },
      ],
      target: newBlock.id,
    };
  }

  // 2. Modify the currently selected block
  const next: Block = { ...selected };
  const changes: string[] = [];
  const diffs: ProposalDiff[] = [];
  const quoted = prompt.match(/["“]([^"”]+)["”]/);

  if (/dark|premium|ink/.test(lower) && next.tone !== "ink") {
    diffs.push({ field: "Theme", before: next.tone, after: "ink" });
    next.tone = "ink";
    changes.push("Apply high-contrast dark ink palette");
  }
  if (/light|bright/.test(lower) && next.tone !== "light") {
    diffs.push({ field: "Theme", before: next.tone, after: "light" });
    next.tone = "light";
    changes.push("Switch to light neutral surface");
  }
  if (/forest|green/.test(lower) && next.tone !== "forest") {
    diffs.push({ field: "Theme", before: next.tone, after: "forest" });
    next.tone = "forest";
    changes.push("Apply forest terrain palette");
  }

  if (/two[- ]column|split/.test(lower) && next.layout !== "split") {
    diffs.push({ field: "Layout", before: next.layout, after: "split" });
    next.layout = "split";
    changes.push("Switch to a balanced two-column split layout");
  }
  if (/center/.test(lower) && next.layout !== "centered") {
    diffs.push({ field: "Layout", before: next.layout, after: "centered" });
    next.layout = "centered";
    changes.push("Center-align headline, copy, and primary CTA");
  }
  if (/overlay|full[- ]bleed/.test(lower) && next.layout !== "overlay") {
    diffs.push({ field: "Layout", before: next.layout, after: "overlay" });
    next.layout = "overlay";
    changes.push("Switch to full-bleed image overlay layout");
  }

  if (/larger|bigger|bold|premium/.test(lower) && next.scale !== "large") {
    diffs.push({ field: "Headline scale", before: next.scale, after: "large" });
    next.scale = "large";
    changes.push("Increase display headline scale");
  }
  if (/smaller|regular|compact/.test(lower) && next.scale !== "regular") {
    diffs.push({ field: "Headline scale", before: next.scale, after: "regular" });
    next.scale = "regular";
    changes.push("Set headline scale to regular");
  }

  const colMatch = lower.match(/\b([234])\s*col/);
  if (colMatch) {
    const cols = Number(colMatch[1]) as 2 | 3 | 4;
    if (next.columns !== cols) {
      diffs.push({
        field: "Columns",
        before: String(next.columns || 4),
        after: String(cols),
      });
      next.columns = cols;
      changes.push(`Arrange grid into ${cols} columns`);
    }
  }

  if (/\bhide\b/.test(lower) && next.visible) {
    diffs.push({ field: "Visibility", before: "Visible", after: "Hidden" });
    next.visible = false;
    changes.push("Hide section from live storefront");
  }
  if (/\b(show|unhide)\b/.test(lower) && !next.visible) {
    diffs.push({ field: "Visibility", before: "Hidden", after: "Visible" });
    next.visible = true;
    changes.push("Make section visible on storefront");
  }

  if (quoted && /description|body|copy|subtitle/.test(lower)) {
    diffs.push({ field: "Description", before: next.copy, after: quoted[1] });
    next.copy = quoted[1];
    changes.push("Update supporting description copy");
  } else if (quoted && /button|cta/.test(lower)) {
    diffs.push({ field: "Button CTA", before: next.action, after: quoted[1] });
    next.action = quoted[1];
    changes.push("Update call-to-action label");
  } else if (quoted) {
    diffs.push({ field: "Headline", before: next.heading, after: quoted[1] });
    next.heading = quoted[1];
    changes.push("Replace section headline");
  }

  if (/premium|outdoorsy/.test(lower) && !quoted && selected.type === "Hero") {
    const newHeading = "Go where the paved road ends.";
    const newCopy =
      "Trail-tested essentials and portable studio tools built for the miles less traveled.";
    if (next.heading !== newHeading) {
      diffs.push({ field: "Headline", before: next.heading, after: newHeading });
      next.heading = newHeading;
    }
    if (next.copy !== newCopy) {
      diffs.push({ field: "Copy", before: next.copy, after: newCopy });
      next.copy = newCopy;
    }
    changes.push("Elevate hero typography and editorial positioning");
  }

  if (!changes.length) return null;

  return {
    before: blocks,
    after: blocks.map((b) => (b.id === selected.id ? next : b)),
    title: `Update ${selected.label}`,
    changes,
    diffs,
    target: selected.id,
  };
}
