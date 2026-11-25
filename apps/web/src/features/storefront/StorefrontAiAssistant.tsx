"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  Lock,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  Suggestions,
} from "@/components/ai-elements";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOptionalAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { storefrontAiApi } from "@/lib/cms-ai-api";
import { storeApi } from "@/lib/commerce-api";
import { cn, usdExact } from "@/lib/format";
import type {
  CheckoutPrefillDto,
  CustomerAiQuotaDto,
  StorefrontProductRecommendationDto,
} from "@/types/api-cms-ai";
import { useCheckoutPrefillStore } from "./checkout-prefill-store";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendedProducts?: StorefrontProductRecommendationDto[];
  checkoutPrefill?: CheckoutPrefillDto | null;
  cartUpdatedCount?: number;
};

export function StorefrontAiAssistant({
  preview = false,
  currentPath = "/",
  productSlug,
  onNotify,
}: {
  preview?: boolean;
  currentPath?: string;
  productSlug?: string;
  onNotify?: (msg: string) => void;
}) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const setCheckoutPrefill = useCheckoutPrefillStore((s) => s.setPrefill);

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [quotaOverride, setQuotaOverride] = useState<CustomerAiQuotaDto | null>(
    null
  );
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);

  const quotaQuery = useQuery({
    queryKey: ["storefront-ai-quota", user?.id || "guest"],
    queryFn: () => storefrontAiApi.getQuota(),
    enabled: Boolean(user) && open && !preview,
    retry: false,
    staleTime: 15_000,
  });

  const conversationsQuery = useQuery({
    queryKey: ["storefront-ai-conversations", user?.id || "guest"],
    queryFn: () => storefrontAiApi.listConversations(),
    enabled: Boolean(user) && open && !preview,
    retry: false,
    staleTime: 15_000,
  });

  const activeQuota = quotaOverride || quotaQuery.data || null;
  const quotaPct = useMemo(() => {
    if (!activeQuota || activeQuota.dailyLimit <= 0) return 0;
    return Math.min(
      100,
      Math.round((activeQuota.usedTokens / activeQuota.dailyLimit) * 100)
    );
  }, [activeQuota]);

  const isQuotaBlocked = Boolean(
    activeQuota && (!activeQuota.enabled || activeQuota.remainingTokens <= 0)
  );

  const starterSuggestions = useMemo(() => {
    if (productSlug) {
      return [
        `Key specs & availability for ${productSlug}`,
        "Add this product to my cart",
        "Any active promotion codes?",
        "Prefill my checkout details",
      ];
    }
    return [
      "Recommend trail shoes under $160",
      "Show active promotion codes",
      "Compare waterproof backpacks",
      "Prefill my checkout details",
    ];
  }, [productSlug]);

  const loadConversationMutation = useMutation({
    mutationFn: (id: string) => storefrontAiApi.getConversation(id),
    onSuccess: (detail) => {
      setConversationId(detail.conversation.id);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          recommendedProducts: m.recommendedProducts || [],
          checkoutPrefill: m.checkoutPrefill || null,
        }))
      );
      setQuotaOverride(detail.quota);
      setErrorMsg("");
      setHistoryOpen(false);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Could not load conversation"
      );
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => storefrontAiApi.deleteConversation(id),
    onSuccess: (_void, deletedId) => {
      if (conversationId === deletedId) {
        setConversationId(null);
        setMessages([]);
      }
      queryClient.invalidateQueries({
        queryKey: ["storefront-ai-conversations", user?.id || "guest"],
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: (text: string) =>
      storefrontAiApi.chat({
        conversationId,
        message: text,
        currentPath,
        productSlug,
      }),
    onMutate: (text) => {
      setErrorMsg("");
      const optimisticUser: ChatEntry = {
        id: `local-u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, optimisticUser]);
    },
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setQuotaOverride(res.quota);
      queryClient.setQueryData(
        ["storefront-ai-quota", user?.id || "guest"],
        res.quota
      );
      queryClient.invalidateQueries({
        queryKey: ["storefront-ai-conversations", user?.id || "guest"],
      });

      if (res.updatedCart) {
        queryClient.setQueryData(["store-cart"], res.updatedCart);
        onNotify?.("Shopping AI updated your cart");
      }
      if (res.checkoutPrefill && !res.checkoutAutoSubmit) {
        setCheckoutPrefill(res.checkoutPrefill);
      }

      const cartItemCount = res.updatedCart
        ? res.updatedCart.items.reduce((sum, i) => sum + i.quantity, 0)
        : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          recommendedProducts: res.recommendedProducts || [],
          checkoutPrefill: res.checkoutPrefill || null,
          cartUpdatedCount: cartItemCount,
        },
      ]);
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.status === 429 || err.code === "RATE_LIMITED")) {
        queryClient.invalidateQueries({
          queryKey: ["storefront-ai-quota", user?.id || "guest"],
        });
      }
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "Shopping AI could not complete your request."
      );
    },
  });

  const handleQuickAddCard = async (rec: StorefrontProductRecommendationDto) => {
    if (!rec.defaultVariantId) {
      router.push(`/store/product/${encodeURIComponent(rec.slug)}`);
      return;
    }
    setAddingVariantId(rec.defaultVariantId);
    try {
      const nextCart = await storeApi.addCartItem(rec.defaultVariantId, 1);
      queryClient.setQueryData(["store-cart"], nextCart);
      onNotify?.(`Added ${rec.name} to cart`);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Could not add item to cart"
      );
    } finally {
      setAddingVariantId(null);
    }
  };

  const handleSend = (rawText?: string) => {
    const text = (rawText ?? draft).trim();
    if (!text || chatMutation.isPending || isQuotaBlocked || !user) return;
    if (!rawText) setDraft("");
    chatMutation.mutate(text);
  };

  if (preview) {
    return null;
  }

  const loginUrl = `/login?next=${encodeURIComponent(currentPath || "/")}`;
  const registerUrl = `/login?tab=register&next=${encodeURIComponent(
    currentPath || "/"
  )}`;

  return (
    <div className="store-ai-float-root" data-testid="storefront-ai-root">
      {open ? (
        <section
          className="store-ai-drawer"
          aria-label="Shopping AI Assistant"
        >
          <header className="store-ai-drawer-head">
            <div className="store-ai-drawer-title">
              <span className="store-ai-drawer-icon">
                <Sparkles size={15} />
              </span>
              <div>
                <strong>Shopping AI</strong>
                <span className="store-ai-drawer-sub">
                  {user ? (
                    <span className="store-ai-user-chip">{user.fullName || user.email}</span>
                  ) : (
                    <span className="store-ai-user-chip is-guest">Sign in required</span>
                  )}
                </span>
              </div>
            </div>

            <div className="store-ai-drawer-actions">
              {user ? (
                <>
                  <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                    <PopoverTrigger
                      type="button"
                      className="icon-btn"
                      aria-label="Shopping AI history"
                      title="Conversation history"
                    >
                      <History size={14} />
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-[260px]">
                      <PopoverHeader>
                        <PopoverTitle>Shopping Chats</PopoverTitle>
                        <PopoverDescription>
                          Resume or start a new shopping conversation.
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="admin-ai-thread-menu">
                        <button
                          type="button"
                          className="admin-ai-thread-menu-item is-new"
                          onClick={() => {
                            setConversationId(null);
                            setMessages([]);
                            setErrorMsg("");
                            setHistoryOpen(false);
                          }}
                        >
                          <Plus size={13} />
                          <span>New chat</span>
                        </button>
                        {(conversationsQuery.data || []).slice(0, 10).map((c) => (
                          <div key={c.id} className="store-ai-thread-row">
                            <button
                              type="button"
                              className={cn(
                                "admin-ai-thread-menu-item",
                                c.id === conversationId && "is-active"
                              )}
                              onClick={() => loadConversationMutation.mutate(c.id)}
                            >
                              <span className="store-ai-thread-title">{c.title}</span>
                            </button>
                            <IconButton
                              label={`Delete ${c.title}`}
                              aria-label={`Delete ${c.title}`}
                              onClick={() => deleteConversationMutation.mutate(c.id)}
                            >
                              <Trash2 size={12} />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <IconButton
                    label="Start new chat"
                    aria-label="Start new chat"
                    title="New chat"
                    onClick={() => {
                      setConversationId(null);
                      setMessages([]);
                      setErrorMsg("");
                    }}
                  >
                    <Plus size={14} />
                  </IconButton>
                </>
              ) : null}

              <IconButton
                label="Close Shopping AI"
                aria-label="Close Shopping AI"
                title="Close"
                onClick={() => setOpen(false)}
              >
                <X size={15} />
              </IconButton>
            </div>
          </header>

          {!user ? (
            <div className="store-ai-auth-gate" data-testid="storefront-ai-auth-gate">
              <div className="store-ai-auth-icon">
                <Lock size={20} />
              </div>
              <h3>Sign in to use Shopping AI</h3>
              <p className="muted">
                Ask detailed product questions, get tailored gear picks, add
                items directly to your bag, and prefill checkout details faster.
              </p>
              <div className="store-ai-auth-actions">
                <Link className="btn primary" href={loginUrl}>
                  Sign In
                </Link>
                <Link className="btn ghost" href={registerUrl}>
                  <UserPlus size={14} /> Create Account
                </Link>
              </div>
              <p className="store-ai-guest-note">
                You can still browse all products, manage your cart, and place
                orders as a guest without signing in.
              </p>
            </div>
          ) : (
            <>
              {activeQuota ? (
                <div
                  className={cn(
                    "store-ai-quota-bar",
                    quotaPct >= 80 && "is-warn",
                    isQuotaBlocked && "is-exhausted"
                  )}
                  data-testid="storefront-ai-quota-bar"
                >
                  <div className="store-ai-quota-meta">
                    <span>
                      Daily tokens:{" "}
                      <strong>
                        {activeQuota.usedTokens.toLocaleString()} /{" "}
                        {activeQuota.dailyLimit.toLocaleString()}
                      </strong>
                    </span>
                    <span className="muted">
                      {activeQuota.enabled
                        ? `${activeQuota.remainingTokens.toLocaleString()} left`
                        : "Disabled"}
                    </span>
                  </div>
                  <div className="store-ai-quota-track" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="store-ai-quota-fill"
                      style={{ width: `${quotaPct}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="store-ai-body">
                <Conversation stickToBottomKey={`${messages.length}:${chatMutation.isPending}`}>
                  <ConversationContent>
                    {messages.length === 0 ? (
                      <ConversationEmptyState
                        icon={<Sparkles size={20} />}
                        title="Ask Dat Shopping AI"
                        description="Search live stock & specs, compare gear, add items to your cart, or prefill checkout details."
                      >
                        <Suggestions
                          compact
                          items={starterSuggestions}
                          onSelect={(text) => handleSend(text)}
                        />
                      </ConversationEmptyState>
                    ) : (
                      messages.map((m) => (
                        <Message key={m.id} from={m.role}>
                          <MessageContent>
                            <MessageResponse>{m.content}</MessageResponse>

                            {m.role === "assistant" &&
                            m.recommendedProducts &&
                            m.recommendedProducts.length > 0 ? (
                              <div className="store-ai-recs">
                                {m.recommendedProducts.map((rec) => (
                                  <div key={rec.productId} className="store-ai-rec-card">
                                    {rec.imageUrl ? (
                                      <img
                                        src={rec.imageUrl}
                                        alt={rec.name}
                                        className="store-ai-rec-thumb"
                                      />
                                    ) : (
                                      <div className="store-ai-rec-thumb store-ai-rec-placeholder">
                                        <ShoppingBag size={14} />
                                      </div>
                                    )}
                                    <div className="store-ai-rec-info">
                                      <Link
                                        href={`/store/product/${encodeURIComponent(rec.slug)}`}
                                        className="store-ai-rec-name"
                                      >
                                        {rec.name}
                                      </Link>
                                      <div className="store-ai-rec-meta">
                                        <strong>{usdExact(Number(rec.price || 0))}</strong>
                                        <span>· {rec.variantTitle || rec.brand}</span>
                                        <span
                                          className={
                                            rec.availableStock > 0
                                              ? "store-ai-stock-ok"
                                              : "store-ai-stock-out"
                                          }
                                        >
                                          {rec.availableStock > 0
                                            ? `${rec.availableStock} in stock`
                                            : "Out of stock"}
                                        </span>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      disabled={
                                        !rec.defaultVariantId ||
                                        rec.availableStock <= 0 ||
                                        addingVariantId === rec.defaultVariantId
                                      }
                                      onClick={() => void handleQuickAddCard(rec)}
                                    >
                                      {addingVariantId === rec.defaultVariantId
                                        ? "Adding…"
                                        : "Add"}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {m.role === "assistant" &&
                            typeof m.cartUpdatedCount === "number" ? (
                              <div className="store-ai-cart-pill">
                                <CheckCircle2 size={14} />
                                <span>
                                  Cart synced ({m.cartUpdatedCount} item
                                  {m.cartUpdatedCount === 1 ? "" : "s"})
                                </span>
                                <Link href="/store/cart">View cart</Link>
                              </div>
                            ) : null}

                            {m.role === "assistant" && m.checkoutPrefill ? (
                              <div
                                className="store-ai-prefill-card"
                                data-testid="ai-checkout-prefill-card"
                              >
                                <div className="store-ai-prefill-head">
                                  <strong>Checkout Details Ready</strong>
                                  <Badge tone="accent">
                                    {m.checkoutPrefill.shippingMethod || "standard"}
                                  </Badge>
                                </div>
                                <dl className="store-ai-prefill-dl">
                                  {m.checkoutPrefill.customerName ? (
                                    <div>
                                      <dt>Name</dt>
                                      <dd>{m.checkoutPrefill.customerName}</dd>
                                    </div>
                                  ) : null}
                                  {m.checkoutPrefill.customerEmail ? (
                                    <div>
                                      <dt>Email</dt>
                                      <dd>{m.checkoutPrefill.customerEmail}</dd>
                                    </div>
                                  ) : null}
                                  {m.checkoutPrefill.line1 ? (
                                    <div>
                                      <dt>Address</dt>
                                      <dd>
                                        {m.checkoutPrefill.line1}
                                        {m.checkoutPrefill.city
                                          ? `, ${m.checkoutPrefill.city}`
                                          : ""}
                                        {m.checkoutPrefill.postalCode
                                          ? ` ${m.checkoutPrefill.postalCode}`
                                          : ""}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {m.checkoutPrefill.promotionCode ? (
                                    <div>
                                      <dt>Promo</dt>
                                      <dd>
                                        <code>{m.checkoutPrefill.promotionCode}</code>
                                      </dd>
                                    </div>
                                  ) : null}
                                </dl>
                                <p className="store-ai-prefill-disclaimer">
                                  Order is NOT placed automatically — please review
                                  and confirm before clicking Place order.
                                </p>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setCheckoutPrefill(m.checkoutPrefill!);
                                    setOpen(false);
                                    router.push("/store/checkout");
                                  }}
                                >
                                  Review &amp; Place Order <ArrowRight size={13} />
                                </Button>
                              </div>
                            ) : null}
                          </MessageContent>
                        </Message>
                      ))
                    )}
                    <ConversationScrollButton />
                  </ConversationContent>
                </Conversation>
              </div>

              {errorMsg ? (
                <div className="ai-el-error-banner" role="alert">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              {isQuotaBlocked ? (
                <div className="store-ai-limit-banner" role="alert">
                  <AlertTriangle size={14} />
                  <span>
                    {activeQuota?.enabled === false
                      ? "Storefront Shopping AI is currently disabled by admin."
                      : `Daily limit reached (${activeQuota?.usedTokens.toLocaleString()} / ${activeQuota?.dailyLimit.toLocaleString()} tokens). Resets at midnight UTC.`}
                  </span>
                </div>
              ) : null}

              <div className="store-ai-composer">
                <PromptInput
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <PromptInputTextarea
                    ariaLabel="Ask Shopping AI"
                    value={draft}
                    onChange={setDraft}
                    onSubmitEnter={() => handleSend()}
                    disabled={chatMutation.isPending || isQuotaBlocked}
                    placeholder={
                      isQuotaBlocked
                        ? "Daily AI limit reached…"
                        : "Ask about products, add to cart, or prefill checkout…"
                    }
                  />
                  <PromptInputToolbar
                    left={
                      <span className="muted" style={{ fontSize: 11 }}>
                        AI assists &amp; prefills — you confirm orders
                      </span>
                    }
                    right={
                      <PromptInputSubmit
                        busy={chatMutation.isPending}
                        disabled={!draft.trim() || isQuotaBlocked}
                      />
                    }
                  />
                </PromptInput>
              </div>
            </>
          )}
        </section>
      ) : (
        <button
          type="button"
          className="store-ai-fab"
          aria-label="Open Shopping AI"
          onClick={() => setOpen(true)}
        >
          <span className="store-ai-fab-icon">
            <Sparkles size={14} />
          </span>
          <span>Shopping AI</span>
        </button>
      )}
    </div>
  );
}
