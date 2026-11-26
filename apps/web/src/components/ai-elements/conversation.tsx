"use client";

import { ArrowDown } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/format";

type ConversationCtx = {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
};

const ConversationContext = createContext<ConversationCtx>({
  isAtBottom: true,
  scrollToBottom: () => {},
});

export function Conversation({
  className,
  children,
  stickToBottomKey,
  ...props
}: ComponentProps<"div"> & {
  stickToBottomKey?: string | number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const checkBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= 56;
    pinnedRef.current = near;
    setIsAtBottom(near);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    pinnedRef.current = true;
    setIsAtBottom(true);
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      scrollToBottom("auto");
    }
  }, [stickToBottomKey, scrollToBottom]);

  const contextValue = useMemo(
    () => ({ isAtBottom, scrollToBottom }),
    [isAtBottom, scrollToBottom]
  );

  return (
    <ConversationContext.Provider value={contextValue}>
      <div className={cn("ai-el-conversation", className)} {...props}>
        <div
          ref={scrollerRef}
          className="ai-el-conversation-scroll"
          role="log"
          aria-live="polite"
          onScroll={checkBottom}
        >
          {children}
        </div>
      </div>
    </ConversationContext.Provider>
  );
}

export function ConversationContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("ai-el-conversation-content", className)} {...props} />;
}

export function ConversationEmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ai-el-empty", className)}>
      {icon ? <div className="ai-el-empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  );
}

export function ConversationScrollButton({
  className,
}: {
  className?: string;
}) {
  const { isAtBottom, scrollToBottom } = useContext(ConversationContext);
  if (isAtBottom) return null;
  return (
    <button
      type="button"
      className={cn("ai-el-scroll-btn", className)}
      aria-label="Scroll to latest message"
      onClick={() => scrollToBottom("smooth")}
    >
      <ArrowDown size={14} />
    </button>
  );
}
