"use client";

import {
  ArrowLeft,
  CalendarClock,
  Eye,
  GitCompare,
  History,
  Laptop,
  Pause,
  Play,
  Power,
  Redo2,
  Rocket,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  Accessibility,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import type { ExperienceDetailDto, RecurrenceRule } from "../types";
import {
  useExperienceStudioStore,
  type StudioPreviewRoute,
  type StudioViewport,
} from "./experience-store";

function toLocalDatetimeInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExperienceTopBar({
  detail,
  canWrite,
  canPublish,
  saving,
  activating,
  scheduling,
  rollingBack,
  onSaveVersion,
  onActivate,
  onDeactivate,
  onSchedule,
  onRollback,
}: {
  detail?: ExperienceDetailDto;
  canWrite: boolean;
  canPublish: boolean;
  saving: boolean;
  activating: boolean;
  scheduling: boolean;
  rollingBack: boolean;
  onSaveVersion: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onSchedule: (body: {
    startsAt: string;
    endsAt?: string | null;
    timezone: string;
    recurrenceRule: RecurrenceRule;
  }) => void;
  onRollback: (versionId: string) => void;
}) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const meta = useExperienceStudioStore((s) => s.meta);
  const schedule = useExperienceStudioStore((s) => s.schedule);
  const dirty = useExperienceStudioStore((s) => s.dirty);
  const metaDirty = useExperienceStudioStore((s) => s.metaDirty);
  const latestVersionNumber = useExperienceStudioStore((s) => s.latestVersionNumber);
  const viewport = useExperienceStudioStore((s) => s.viewport);
  const previewRoute = useExperienceStudioStore((s) => s.previewRoute);
  const compareBase = useExperienceStudioStore((s) => s.compareBase);
  const effectsPaused = useExperienceStudioStore((s) => s.effectsPaused);
  const simulateReducedMotion = useExperienceStudioStore((s) => s.simulateReducedMotion);
  const aiBarOpen = useExperienceStudioStore((s) => s.aiBarOpen);
  const historyIndex = useExperienceStudioStore((s) => s.historyIndex);
  const history = useExperienceStudioStore((s) => s.history);

  const updateMeta = useExperienceStudioStore((s) => s.updateMeta);
  const setViewport = useExperienceStudioStore((s) => s.setViewport);
  const setPreviewRoute = useExperienceStudioStore((s) => s.setPreviewRoute);
  const setCompareBase = useExperienceStudioStore((s) => s.setCompareBase);
  const setEffectsPaused = useExperienceStudioStore((s) => s.setEffectsPaused);
  const setSimulateReducedMotion = useExperienceStudioStore((s) => s.setSimulateReducedMotion);
  const toggleAiBar = useExperienceStudioStore((s) => s.toggleAiBar);
  const undo = useExperienceStudioStore((s) => s.undo);
  const redo = useExperienceStudioStore((s) => s.redo);

  const [startLocal, setStartLocal] = useState(() => toLocalDatetimeInput(schedule.startsAt));
  const [endLocal, setEndLocal] = useState(() => toLocalDatetimeInput(schedule.endsAt));
  const [tzDraft, setTzDraft] = useState(schedule.timezone || "UTC");
  const [recDraft, setRecDraft] = useState<RecurrenceRule>(schedule.recurrenceRule || "NONE");

  const isActive = meta.status === "ACTIVE";
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <header className="ed-topbar exp-topbar">
      <div className="ed-topbar-left">
        <Link href="/admin/experiences" className="ed-back-link">
          <ArrowLeft size={14} />
          <span>Experiences</span>
        </Link>

        <input
          type="text"
          className="exp-title-input"
          value={meta.name}
          disabled={!canWrite}
          onChange={(e) => updateMeta({ name: e.target.value })}
          aria-label="Experience name"
        />

        <StatusBadge status={meta.status} />
        <span className="exp-ver-pill">v{latestVersionNumber}</span>
        {dirty || metaDirty ? (
          <span className="exp-unsaved-dot" title="Unsaved changes">
            Unsaved
          </span>
        ) : null}
      </div>

      <div className="ed-topbar-center">
        <div className="ed-btn-group">
          <IconButton label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
            <Undo2 size={14} />
          </IconButton>
          <IconButton label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
            <Redo2 size={14} />
          </IconButton>
        </div>

        <div className="ed-viewport-seg" role="group" aria-label="Preview page">
          {(["home", "shop", "product"] as StudioPreviewRoute[]).map((routeKey) => (
            <button
              key={routeKey}
              type="button"
              className={`exp-route-btn${previewRoute === routeKey ? " active" : ""}`}
              onClick={() => setPreviewRoute(routeKey)}
            >
              {routeKey === "home" ? "Home" : routeKey === "shop" ? "Shop" : "Product"}
            </button>
          ))}
        </div>

        <div className="ed-viewport-seg" role="group" aria-label="Viewport mode">
          {(
            [
              { key: "desktop", icon: Laptop, label: "Desktop" },
              { key: "tablet", icon: Tablet, label: "Tablet" },
              { key: "mobile", icon: Smartphone, label: "Mobile" },
            ] as { key: StudioViewport; icon: typeof Laptop; label: string }[]
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className={`ed-seg-btn${viewport === key ? " active" : ""}`}
              title={label}
              aria-label={label}
              onClick={() => setViewport(key)}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="ed-btn-group">
          <IconButton
            label={effectsPaused ? "Play effects" : "Pause effects"}
            title={effectsPaused ? "Play effects" : "Pause effects"}
            className={effectsPaused ? "ed-tool-active" : ""}
            onClick={() => setEffectsPaused(!effectsPaused)}
          >
            {effectsPaused ? <Play size={14} /> : <Pause size={14} />}
          </IconButton>
          <IconButton
            label="Simulate reduced motion"
            title="Simulate prefers-reduced-motion"
            className={simulateReducedMotion ? "ed-tool-active" : ""}
            onClick={() => setSimulateReducedMotion(!simulateReducedMotion)}
          >
            <Accessibility size={14} />
          </IconButton>
          <IconButton
            label="Compare with base storefront"
            title="Compare without seasonal effects"
            className={compareBase ? "ed-tool-active" : ""}
            onClick={() => setCompareBase(!compareBase)}
          >
            <GitCompare size={14} />
          </IconButton>
          <IconButton
            label="Toggle AI Creative Director"
            title="AI Creative Director"
            className={aiBarOpen ? "ed-tool-active" : ""}
            onClick={() => toggleAiBar()}
          >
            <Sparkles size={14} />
          </IconButton>
        </div>
      </div>

      <div className="ed-topbar-right">
        <Button size="sm" onClick={() => setVersionsOpen(true)}>
          <History size={13} />
          <span>Versions</span>
        </Button>

        <Popover
          open={scheduleOpen}
          onOpenChange={(open) => {
            setScheduleOpen(open);
            if (open) {
              setStartLocal(toLocalDatetimeInput(schedule.startsAt));
              setEndLocal(toLocalDatetimeInput(schedule.endsAt));
              setTzDraft(schedule.timezone || "UTC");
              setRecDraft(schedule.recurrenceRule || "NONE");
            }
          }}
        >
          <PopoverTrigger
            render={
              <Button size="sm">
                <CalendarClock size={13} />
                <span>Schedule</span>
              </Button>
            }
          />
          <PopoverContent align="end" style={{ width: 320 }}>
            <PopoverHeader>
              <PopoverTitle>Schedule Event Window</PopoverTitle>
              <PopoverDescription>
                Automatically activates at start time and reverts when it ends.
              </PopoverDescription>
            </PopoverHeader>
            <div className="exp-pop-form">
              <label>
                <span>Starts at</span>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </label>
              <label>
                <span>Ends at (optional)</span>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                />
              </label>
              <div className="exp-pop-row">
                <label>
                  <span>Timezone</span>
                  <select value={tzDraft} onChange={(e) => setTzDraft(e.target.value)}>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </label>
                <label>
                  <span>Recurrence</span>
                  <select
                    value={recDraft}
                    onChange={(e) => setRecDraft(e.target.value as RecurrenceRule)}
                  >
                    <option value="NONE">One-time</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </label>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!canPublish || scheduling || !startLocal}
                onClick={() => {
                  const startsIso = new Date(startLocal).toISOString();
                  const endsIso = endLocal ? new Date(endLocal).toISOString() : null;
                  onSchedule({
                    startsAt: startsIso,
                    endsAt: endsIso,
                    timezone: tzDraft,
                    recurrenceRule: recDraft,
                  });
                  setScheduleOpen(false);
                }}
              >
                <CalendarClock size={13} />
                {scheduling ? "Scheduling..." : "Arm Schedule"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {canWrite ? (
          <Button size="sm" onClick={onSaveVersion} disabled={saving}>
            <Save size={13} />
            <span>{saving ? "Saving..." : "Save Version"}</span>
          </Button>
        ) : null}

        {canPublish ? (
          isActive ? (
            <Button size="sm" onClick={onDeactivate} disabled={activating}>
              <Power size={13} />
              <span>{activating ? "Stopping..." : "Deactivate"}</span>
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onActivate} disabled={activating}>
              <Rocket size={13} />
              <span>{activating ? "Activating..." : "Activate Live"}</span>
            </Button>
          )
        ) : null}

        <Link
          href="/"
          target="_blank"
          className="btn btn-sm"
          title="Open live storefront in new tab"
        >
          <Eye size={13} />
          <span>Live Store</span>
        </Link>
      </div>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Experience Version History</DialogTitle>
            <DialogDescription>
              Restore any saved snapshot of {meta.name}. Restoring creates a fresh top version cleanly.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="exp-versions-list">
              {(detail?.versions || []).map((ver) => (
                <div key={ver.id} className="exp-version-row">
                  <div>
                    <strong>
                      v{ver.versionNumber}
                      {detail?.activeVersionId === ver.id ? " · Live" : ""}
                    </strong>
                    <p>{ver.changeSummary || "Saved snapshot"}</p>
                    <small>
                      {formatDate(ver.createdAt)} · {ver.config?.layers?.length || 0} layer(s)
                    </small>
                  </div>
                  {canPublish ? (
                    <Button
                      size="sm"
                      disabled={rollingBack}
                      onClick={() => {
                        onRollback(ver.id);
                        setVersionsOpen(false);
                      }}
                    >
                      <RotateCcw size={13} /> Restore
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </header>
  );
}
