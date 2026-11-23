"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUpRight,
  Box,
  ChevronRight,
  CircleHelp,
  Cloud,
  Command as CommandIcon,
  Eye,
  Layers,
  LayoutDashboard,
  Moon,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { newId } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialProducts } from "@/mocks/catalog";
import {
  blockKinds,
  blockMeta,
  initialBlocks,
  makeBlock,
  pageTemplates,
} from "@/mocks/pages";
import type { AIModelId } from "@/types/ai";
import type { Product } from "@/types/commerce";
import type {
  Block,
  EditorMessage,
  Proposal,
  ViewportMode,
} from "@/types/editor";
import { EditorCanvas } from "./canvas";
import { InspectorPanel } from "./inspector-panel";
import { propose } from "./proposals";
import { SectionIcon, StructurePanel } from "./structure-panel";

const pages = Object.keys(pageTemplates);
const openingPrompt = "Make the hero feel more premium and outdoorsy.";
const openingReply =
  "I prepared a dark ink hero direction with larger display typography and updated trail-first copy. Preview it on the canvas or apply it to your draft.";

export function Editor() {
  const router = useRouter();
  const [draft, setDraft, ready] = useStored<Block[]>("draft", initialBlocks);
  const [otherDrafts, setOtherDrafts] = useStored<Record<string, Block[]>>(
    "page-drafts",
    pageTemplates
  );
  const [published, setPublished] = useStored<Block[]>("published", initialBlocks);
  const [publishedPages, setPublishedPages] = useStored<Record<string, Block[]>>(
    "published-pages",
    pageTemplates
  );
  const [catalog] = useStored<Product[]>("catalog", initialProducts);
  const [theme, setTheme] = useStored("theme", "light");

  const [page, setPage] = useState(pages[0]);
  const stored = page === pages[0] ? draft : otherDrafts[page] || pageTemplates[page];
  const [working, setWorking] = useState<Block[] | null>(null);
  const blocks = working || stored;

  const [past, setPast] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const [selection, setSelection] = useState("hero");
  const [mode, setMode] = useState<ViewportMode>("desktop");
  const [tab, setTab] = useState<"ai" | "properties">("ai");
  const [panel, setPanel] = useState<"structure" | "inspector" | null>(null);
  const [preview, setPreview] = useState<"page" | "proposal" | null>(null);
  const [dialog, setDialog] = useState<
    "library" | "publish" | "discard" | "command" | "delete" | "switch" | null
  >(null);
  const [nextPage, setNextPage] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [toast, setToast] = useState("");

  const [model, setModel] = useState<AIModelId>("claude-sonnet-4");
  const [messages, setMessages] = useState<EditorMessage[]>([
    { id: "init", prompt: openingPrompt, reply: openingReply },
  ]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedBlock = blocks.find((item) => item.id === selection) || blocks[0];
  const dirty =
    working !== null && JSON.stringify(working) !== JSON.stringify(stored);
  const live =
    page === pages[0]
      ? published
      : publishedPages[page] || pageTemplates[page];
  const isPublished = JSON.stringify(blocks) === JSON.stringify(live);

  const activeProposal = started
    ? proposal
    : page === pages[0] && selectedBlock
      ? propose(
          openingPrompt,
          blocks,
          blocks.find((item) => item.id === "hero") || selectedBlock
        )
      : null;

  const showBlocks =
    preview === "proposal" && activeProposal ? activeProposal.after : blocks;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const clock = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(clock);
  }, [toast]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("page");
    if (requested && requested !== pages[0] && requested in pageTemplates) {
      setPage(requested);
      setSelection(pageTemplates[requested][0].id);
      setStarted(true);
      setMessages([]);
    }
    return () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function commit(next: Block[]) {
    setPast((p) => [...p, blocks]);
    setWorking(next);
    setFuture([]);
    setPreview(null);
  }

  function persistDraft(next: Block[]) {
    if (page === pages[0]) setDraft(next);
    else setOtherDrafts({ ...otherDrafts, [page]: next });
    setWorking(null);
  }

  function undo() {
    if (!past.length) return;
    setFuture((f) => [blocks, ...f]);
    setWorking(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setPreview(null);
  }

  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, blocks]);
    setWorking(future[0]);
    setFuture((f) => f.slice(1));
    setPreview(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog("command");
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "Escape") {
        setPreview(null);
        setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function switchPage(name: string) {
    if (promptTimer.current) clearTimeout(promptTimer.current);
    setBusy(false);
    setPage(name);
    setWorking(null);
    setPast([]);
    setFuture([]);
    const targetBlocks =
      name === pages[0] ? draft : otherDrafts[name] || pageTemplates[name];
    setSelection(targetBlocks?.[0]?.id || "");
    setStarted(true);
    setProposal(null);
    setPreview(null);
    setMessages([]);
    setDialog(null);
    setPanel(null);
  }

  function updateSelected(change: Partial<Block>) {
    if (!selectedBlock) return;
    commit(
      blocks.map((item) =>
        item.id === selectedBlock.id ? { ...item, ...change } : item
      )
    );
  }

  function moveSelected(offset: number) {
    if (!selectedBlock) return;
    const index = blocks.findIndex((item) => item.id === selectedBlock.id);
    const next = [...blocks];
    if (index < 0 || !next[index + offset]) return;
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    commit(next);
  }

  function reorderBlocks(fromIndex: number, toIndex: number) {
    const next = [...blocks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commit(next);
  }

  function duplicateSelected() {
    if (!selectedBlock) return;
    const clone: Block = {
      ...selectedBlock,
      id: newId(),
      label: selectedBlock.label + " copy",
    };
    const next = [...blocks];
    next.splice(blocks.indexOf(selectedBlock) + 1, 0, clone);
    commit(next);
    setSelection(clone.id);
  }

  function send(prompt: string) {
    if (!selectedBlock) return;
    setStarted(true);
    setProposal(null);
    setPreview(null);
    setMessages((curr) => [...curr, { id: newId(), prompt }]);
    setBusy(true);

    promptTimer.current = setTimeout(() => {
      const result = propose(prompt, blocks, selectedBlock);
      setProposal(result);
      setBusy(false);
      setMessages((curr) =>
        curr.map((m, idx) =>
          idx === curr.length - 1
            ? {
                ...m,
                reply: result
                  ? "Prepared a structured update for this section. Preview the changes on the canvas before applying to your draft."
                  : "I couldn't match that instruction to a section change. Try specifying a layout (two-column, centered), palette (dark, light), headline scale, or adding a named section.",
                status: result ? undefined : "error",
              }
            : m
        )
      );
    }, 550);
  }

  function resolveProposal(accept: boolean) {
    if (!activeProposal) return;
    if (accept) {
      commit(activeProposal.after);
      setSelection(activeProposal.target);
      setToast("AI changes applied to draft");
    }
    setStarted(true);
    setProposal(null);
    setPreview(null);
    setMessages((curr) =>
      curr.map((m, idx) =>
        idx === curr.length - 1
          ? { ...m, status: accept ? "accepted" : "rejected" }
          : m
      )
    );
  }

  const commands: CommandItem[] = [
    {
      id: "cmd-add",
      label: "Add section to page",
      group: "Editor",
      run: () => {
        setLibraryQuery("");
        setDialog("library");
      },
    },
    {
      id: "cmd-save",
      label: "Save draft",
      group: "Publishing",
      run: () => {
        persistDraft(blocks);
        setToast("Draft saved");
      },
    },
    {
      id: "cmd-preview",
      label: "Toggle clean storefront preview",
      group: "Publishing",
      run: () => setPreview(preview === "page" ? null : "page"),
    },
    {
      id: "cmd-publish",
      label: "Publish changes live",
      group: "Publishing",
      run: () => setDialog("publish"),
    },
    {
      id: "cmd-discard",
      label: "Discard unsaved changes",
      group: "Publishing",
      run: () => setDialog("discard"),
    },
    {
      id: "cmd-theme",
      label: theme === "light" ? "Switch to dark theme" : "Switch to light theme",
      group: "Preferences",
      icon: theme === "light" ? <Moon size={14} /> : <Sun size={14} />,
      run: () => setTheme(theme === "light" ? "dark" : "light"),
    },
    {
      id: "cmd-admin",
      label: "Go to Merchant Admin Dashboard",
      group: "Navigation",
      icon: <LayoutDashboard size={14} />,
      run: () => router.push("/admin"),
    },
    {
      id: "cmd-store",
      label: "Open Storefront",
      group: "Navigation",
      icon: <ArrowUpRight size={14} />,
      run: () => router.push("/store"),
    },
  ];

  const categoriesOrder = [
    "Hero & Editorial",
    "Commerce",
    "Social & Trust",
    "Utility",
  ] as const;

  return (
    <div
      className="editor-app"
      onClickCapture={(event) => {
        if (
          !dirty ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as HTMLElement).closest?.("a");
        if (
          anchor &&
          anchor.target !== "_blank" &&
          anchor.origin === window.location.origin &&
          !window.confirm("Leave the Visual Editor and discard unsaved changes?")
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <header className="editor-top">
        <Link className="forma-mark" href="/admin" aria-label="Forma dashboard">
          <Box size={20} strokeWidth={2.1} />
        </Link>

        <div className="editor-breadcrumb">
          <Link href="/admin">Terrain Supply</Link>
          <ChevronRight size={14} />
          <strong>Visual Store Editor</strong>
          <span className="editor-beta">Studio</span>
        </div>

        <div className="top-actions">
          <span className="save-status">
            <Cloud size={15} />
            {dirty
              ? "Unsaved changes"
              : isPublished
                ? "Published"
                : "Draft saved"}
          </span>
          {dirty ? (
            <Button size="sm" variant="ghost" onClick={() => setDialog("discard")}>
              <RotateCcw size={13} /> Discard
            </Button>
          ) : null}
          <span className="top-divider" />
          <div className="history-controls">
            <IconButton label="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}>
              <Undo2 size={16} />
            </IconButton>
            <IconButton
              label="Redo (Ctrl+Shift+Z)"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={16} />
            </IconButton>
          </div>
          <Button
            onClick={() => setPreview(preview === "page" ? null : "page")}
          >
            <Eye size={15} />
            <span>{preview === "page" ? "Exit preview" : "Preview changes"}</span>
          </Button>
          <Button
            variant="primary"
            className="publish-button"
            onClick={() => setDialog("publish")}
          >
            <span>Publish</span>
            <ArrowUpRight size={15} />
          </Button>
        </div>
      </header>

      <div className="editor-body" data-panel={panel || ""}>
        {preview !== "page" ? (
          <nav className="editor-rail" aria-label="Workspace navigation">
            <Link href="/admin" title="Merchant Overview" aria-label="Overview">
              <LayoutDashboard size={18} />
            </Link>
            <Link href="/admin/products" title="Products" aria-label="Products">
              <Box size={18} />
            </Link>
            <IconButton
              label="Page structure"
              className="rail-selected"
              onClick={() =>
                setPanel(panel === "structure" ? null : "structure")
              }
            >
              <Layers size={18} />
            </IconButton>
            <Link
              href="/admin/assistant"
              title="AI Operator"
              aria-label="AI Workspace"
            >
              <Sparkles size={18} />
            </Link>

            <div className="rail-bottom">
              <IconButton
                label="Command palette"
                onClick={() => setDialog("command")}
              >
                <CommandIcon size={17} />
              </IconButton>
              <IconButton
                label="Toggle theme"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </IconButton>
              <Link
                href="/admin/general"
                title="Settings"
                aria-label="Workspace settings"
              >
                <CircleHelp size={18} />
              </Link>
              <Link
                className="avatar"
                href="/admin/users"
                title="Team members"
                aria-label="Team members"
              >
                AM
              </Link>
            </div>
          </nav>
        ) : null}

        {preview !== "page" ? (
          <StructurePanel
            blocks={blocks}
            currentPage={page}
            pages={pages}
            setPage={(name) => {
              if (dirty) {
                setNextPage(name);
                setDialog("switch");
              } else {
                switchPage(name);
              }
            }}
            selectedId={selectedBlock?.id || ""}
            select={(id) => {
              setSelection(id);
              setPanel("inspector");
            }}
            add={() => {
              setLibraryQuery("");
              setDialog("library");
            }}
            move={moveSelected}
            reorder={reorderBlocks}
            duplicate={duplicateSelected}
            remove={() => setDialog("delete")}
            toggleVisibility={() =>
              selectedBlock &&
              updateSelected({ visible: !selectedBlock.visible })
            }
          />
        ) : null}

        <EditorCanvas
          page={page}
          mode={mode}
          setMode={setMode}
          preview={preview}
          setPreview={setPreview}
          showBlocks={showBlocks}
          selectedBlock={selectedBlock}
          activeProposal={activeProposal}
          isPublished={isPublished}
          dirty={dirty}
          ready={ready}
          catalog={catalog}
          select={(id) => {
            setSelection(id);
            setPanel("inspector");
          }}
          move={moveSelected}
          duplicate={duplicateSelected}
          toggleVisibility={() =>
            selectedBlock && updateSelected({ visible: !selectedBlock.visible })
          }
          requestDelete={() => setDialog("delete")}
          focusAI={() => {
            setTab("ai");
            setPanel("inspector");
          }}
          saveDraft={() => {
            persistDraft(blocks);
            setToast("Draft saved");
          }}
          openPanel={(p) => setPanel(panel === p ? null : p)}
          openCommand={() => setDialog("command")}
          acceptProposal={() => resolveProposal(true)}
          rejectProposal={() => resolveProposal(false)}
        />

        {preview !== "page" ? (
          <InspectorPanel
            tab={tab}
            setTab={setTab}
            block={selectedBlock || null}
            update={updateSelected}
            proposal={activeProposal}
            previewing={preview === "proposal"}
            messages={messages}
            busy={busy}
            send={send}
            togglePreview={() =>
              setPreview(preview === "proposal" ? null : "proposal")
            }
            accept={() => resolveProposal(true)}
            reject={() => resolveProposal(false)}
            closeMobile={() => setPanel(null)}
            model={model}
            setModel={setModel}
          />
        ) : null}
      </div>

      {dialog === "library" ? (
        <Modal
          wide
          title="Section Library"
          description="Add a CMS-driven storefront section below your current selection."
          close={() => setDialog(null)}
        >
          <label className="search-field">
            <Search size={15} />
            <input
              autoFocus
              aria-label="Search sections"
              placeholder="Find a section (Hero, Testimonials, FAQ, Product Grid…)"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
            />
          </label>
          <div className="library-categories">
            {categoriesOrder.map((cat) => {
              const matching = blockKinds.filter(
                (kind) =>
                  blockMeta[kind].category === cat &&
                  (kind.toLowerCase().includes(libraryQuery.toLowerCase()) ||
                    blockMeta[kind].description
                      .toLowerCase()
                      .includes(libraryQuery.toLowerCase()))
              );
              if (!matching.length) return null;
              return (
                <div key={cat} className="library-group">
                  <h3>{cat}</h3>
                  <div className="library-grid">
                    {matching.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className="library-card"
                        onClick={() => {
                          const item = makeBlock(kind, newId());
                          const idx = selectedBlock
                            ? blocks.indexOf(selectedBlock) + 1
                            : 0;
                          commit([
                            ...blocks.slice(0, idx),
                            item,
                            ...blocks.slice(idx),
                          ]);
                          setSelection(item.id);
                          setTab("properties");
                          setDialog(null);
                          setToast(`Added ${kind}`);
                        }}
                      >
                        <span className="proposal-icon">
                          <SectionIcon kind={kind} size={15} />
                        </span>
                        <div>
                          <strong>{kind}</strong>
                          <small>{blockMeta[kind].description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {dialog === "command" ? (
        <CommandPalette commands={commands} close={() => setDialog(null)} />
      ) : null}

      {dialog === "publish" ? (
        <ConfirmDialog
          title={`Publish "${page}"?`}
          description="Publishing replaces the live storefront version of this page with your current draft."
          confirmLabel="Confirm publish"
          summary={
            <div>
              <span>{live.filter((i) => i.visible).length} live visible sections</span>
              <ArrowDown size={14} style={{ margin: "4px 0" }} />
              <strong>
                {blocks.filter((i) => i.visible).length} visible sections after publishing
              </strong>
              <small>
                {
                  blocks.filter(
                    (i) =>
                      JSON.stringify(i) !==
                      JSON.stringify(live.find((o) => o.id === i.id))
                  ).length
                }{" "}
                added or updated ·{" "}
                {live.filter((i) => !blocks.some((n) => n.id === i.id)).length}{" "}
                removed
              </small>
            </div>
          }
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            persistDraft(blocks);
            if (page === pages[0]) setPublished(blocks);
            else setPublishedPages({ ...publishedPages, [page]: blocks });
            setDialog(null);
            setToast("Storefront published");
          }}
        />
      ) : null}

      {dialog === "discard" || dialog === "switch" || dialog === "delete" ? (
        <ConfirmDialog
          title={
            dialog === "delete"
              ? `Delete "${selectedBlock?.label || "section"}"?`
              : "Discard unsaved changes?"
          }
          description={
            dialog === "delete"
              ? "This section will be removed from the current working draft."
              : "Your unsaved edits will be reverted to the last saved draft."
          }
          confirmLabel={dialog === "delete" ? "Delete section" : "Discard changes"}
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (dialog === "delete") {
              commit(blocks.filter((item) => item.id !== selectedBlock?.id));
              setToast("Section removed");
            } else if (dialog === "switch") {
              switchPage(nextPage);
              setToast("Switched page");
            } else {
              setWorking(null);
              setPast([]);
              setFuture([]);
              setPreview(null);
              setToast("Unsaved changes discarded");
            }
            setDialog(null);
          }}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
