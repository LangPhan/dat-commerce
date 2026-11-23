"use client";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Film,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Mail,
  MessageSquareQuote,
  MoreHorizontal,
  Package,
  PanelTop,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { IconButton, Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/format";
import type { Block, BlockKind } from "@/types/editor";

const blockIcons: Record<BlockKind, LucideIcon> = {
  Hero: ImageIcon,
  "Image with Text": FileText,
  "Product Grid": LayoutGrid,
  "Featured Categories": Layers,
  "Best Sellers": Package,
  "Collection Banner": PanelTop,
  "Promotional Banner": Tag,
  Testimonials: MessageSquareQuote,
  Newsletter: Mail,
  "Rich Text": FileText,
  "Image Gallery": ImageIcon,
  FAQ: HelpCircle,
  "Logo Cloud": Sparkles,
  "Video Section": Film,
};

export function SectionIcon({
  kind,
  size = 15,
}: {
  kind: BlockKind;
  size?: number;
}) {
  const Icon = blockIcons[kind] || Layers;
  return <Icon size={size} />;
}

export function StructurePanel({
  blocks,
  selectedId,
  select,
  add,
  duplicate,
  remove,
  move,
  reorder,
  toggleVisibility,
  pages,
  currentPage,
  setPage,
}: {
  blocks: Block[];
  selectedId: string;
  select: (id: string) => void;
  add: () => void;
  duplicate: () => void;
  remove: () => void;
  move: (offset: number) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  toggleVisibility: () => void;
  pages: string[];
  currentPage: string;
  setPage: (page: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const pageItems = pages.map((p) => ({ value: p, label: p }));

  return (
    <aside className="structure" aria-label="Page structure">
      <div className="panel-heading">
        <h2>Page structure</h2>
        <IconButton label="Add section" onClick={add}>
          <Plus size={16} />
        </IconButton>
      </div>

      <div className="page-picker">
        <label htmlFor="edit-page">PAGE</label>
        <Select
          items={pageItems}
          value={currentPage}
          onValueChange={(next) => {
            if (next) {
              setPage(next);
              setMenuOpen(false);
            }
          }}
        >
          <SelectTrigger
            id="edit-page"
            size="sm"
            className="page-picker-trigger"
          >
            <span className="page-picker-trigger-label">
              <PanelTop size={14} aria-hidden="true" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {pages.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="structure-items">
        <button
          type="button"
          className="section-group"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Layers size={14} />
          <strong>Sections</strong>
          <span>{blocks.length}</span>
        </button>

        {expanded ? (
          <div className="section-tree">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => setDragIdx(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIdx(index);
                }}
                onDragLeave={() => setOverIdx(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== index) {
                    reorder(dragIdx, index);
                  }
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={cn(
                  "layer-row",
                  selectedId === block.id && "selected",
                  !block.visible && "hidden-layer",
                  overIdx === index && dragIdx !== index && "drag-over"
                )}
              >
                <button
                  type="button"
                  className="layer"
                  onClick={() => {
                    select(block.id);
                    setMenuOpen(false);
                  }}
                  aria-current={block.id === selectedId ? "true" : undefined}
                >
                  <span className="layer-grip" aria-hidden="true">
                    <GripVertical size={13} />
                  </span>
                  <SectionIcon kind={block.type} size={14} />
                  <span>{block.label}</span>
                </button>
                {!block.visible ? (
                  <EyeOff size={12} style={{ marginRight: 4, flex: "none" }} />
                ) : null}
                {selectedId === block.id ? (
                  <IconButton
                    label="Section actions"
                    className="layer-more"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal size={14} />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {menuOpen ? (
          <div className="layer-actions">
            <button
              type="button"
              onClick={() => {
                move(-1);
                setMenuOpen(false);
              }}
            >
              <ArrowUp size={13} /> Move up
            </button>
            <button
              type="button"
              onClick={() => {
                move(1);
                setMenuOpen(false);
              }}
            >
              <ArrowDown size={13} /> Move down
            </button>
            <button
              type="button"
              onClick={() => {
                duplicate();
                setMenuOpen(false);
              }}
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                toggleVisibility();
                setMenuOpen(false);
              }}
            >
              <Eye size={13} /> Toggle visibility
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                remove();
                setMenuOpen(false);
              }}
            >
              <Trash2 size={13} /> Delete section
            </button>
          </div>
        ) : null}

        <Button className="add-section" onClick={add}>
          <Plus size={14} /> Add section
        </Button>
      </div>

      <div className="structure-footer">
        <span className="mini-shortcut">Ctrl K</span>
        <span>Command palette</span>
      </div>
    </aside>
  );
}
