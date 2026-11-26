"use client";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "./dialog";

export type CommandItem = {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  icon?: ReactNode;
  run: () => void;
};

export function CommandPalette({
  title = "Command palette",
  description = "Run a workspace command or jump directly to a page.",
  commands,
  close,
}: {
  title?: string;
  description?: string;
  commands: CommandItem[];
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of commands) {
      if (
        q &&
        !item.label.toLowerCase().includes(q) &&
        !(item.group && item.group.toLowerCase().includes(q))
      ) {
        continue;
      }
      const group = item.group || "Actions";
      let bucket = map.get(group);
      if (!bucket) {
        bucket = [];
        map.set(group, bucket);
      }
      bucket.push(item);
    }
    return Array.from(map.entries());
  }, [commands, q]);

  return (
    <Modal title={title} description={description} close={close}>
      <label className="search-field">
        <Search size={16} />
        <input
          autoFocus
          aria-label="Search commands"
          placeholder="Type a command or page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="command-palette-list">
        {grouped.length ? (
          grouped.map(([group, items]) => (
            <div key={group} className="command-group">
              <div className="command-group-title">{group}</div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="command-item"
                  onClick={() => {
                    close();
                    item.run();
                  }}
                >
                  <span className="inline-label">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  <span className="command-right">
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                    <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          ))
        ) : (
          <p className="muted" style={{ padding: "14px 4px" }}>
            No matching commands found.
          </p>
        )}
      </div>
    </Modal>
  );
}
