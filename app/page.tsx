"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { computeMaxPrice } from "@/lib/finance";
import type { ChatMessage, Listing } from "@/lib/types";

const SUGGESTIONS = [
  "Family car with low insurance",
  "Reliable first car under £8k",
  "Stylish hatchback in white",
  "Long-distance commuter, automatic",
];

export default function ChatPage() {
  const {
    postcode,
    setPostcode,
    monthly,
    apr,
    maxPrice,
    setAffordability,
    messages,
    appendMessage,
    saved,
    reset,
  } = useStore();
  const [view, setView] = useState<"chat" | "saved">("chat");
  const [input, setInput] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");
  const [aprInput, setAprInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const previewMaxPrice = useMemo(() => {
    const m = parseFloat(monthlyInput);
    const a = parseFloat(aprInput);
    if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(a) || a < 0) return null;
    return computeMaxPrice({ monthly: m, apr: a, termMonths: 60 });
  }, [monthlyInput, aprInput]);

  const gateReady = !!(
    postcodeInput.trim() &&
    parseFloat(monthlyInput) > 0 &&
    parseFloat(aprInput) >= 0 &&
    previewMaxPrice
  );

  const submitGate = () => {
    if (!gateReady || !previewMaxPrice) return;
    const m = parseFloat(monthlyInput);
    const a = parseFloat(aprInput);
    setPostcode(postcodeInput);
    setAffordability({ monthly: m, apr: a, maxPrice: previewMaxPrice });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    appendMessage(userMessage);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          postcode,
          monthly,
          apr,
          maxPrice,
        }),
      });
      const data = await res.json();
      if (data?.error) {
        setError(data.error);
        return;
      }
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data.text ?? "",
        listings: Array.isArray(data.listings)
          ? data.listings
          : data.listing
          ? [data.listing]
          : [],
        totalCount: data.totalCount,
      };
      appendMessage(assistantMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setPending(false);
    }
  };

  if (!postcode || !maxPrice) {
    return (
      <div className="flex flex-col h-screen w-full max-w-[440px] mx-auto bg-bg overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-6 py-8">
          <BrandHeader />
          <h1 className="font-display text-[26px] font-bold leading-tight mt-6 mb-1">
            Hi, I&apos;m Naya.
          </h1>
          <p className="text-muted text-[14px] mb-6">
            A couple of quick details and I&apos;ll find you a car.
          </p>

          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
            <Field
              label="Postcode"
              hint="So I can sort by distance to dealer."
            >
              <input
                value={postcodeInput}
                onChange={(e) => setPostcodeInput(e.target.value)}
                placeholder="e.g. M14 5RP"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-3 text-[14px] outline-none focus:border-primary uppercase placeholder:text-muted/80 placeholder:normal-case"
              />
            </Field>

            <Field
              label="Max monthly payment"
              hint="The most you can comfortably pay each month."
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[14px]">
                  £
                </span>
                <input
                  inputMode="decimal"
                  value={monthlyInput}
                  onChange={(e) =>
                    setMonthlyInput(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="e.g. 250"
                  className="w-full bg-bg border border-border rounded-xl pl-7 pr-3.5 py-3 text-[14px] outline-none focus:border-primary placeholder:text-muted/80"
                />
              </div>
            </Field>

            <Field
              label="APR"
              hint="The rate you were quoted (we assume a 60-month max term)."
            >
              <div className="relative">
                <input
                  inputMode="decimal"
                  value={aprInput}
                  onChange={(e) =>
                    setAprInput(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="e.g. 12.3"
                  className="w-full bg-bg border border-border rounded-xl px-3.5 pr-9 py-3 text-[14px] outline-none focus:border-primary placeholder:text-muted/80"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-[14px]">
                  %
                </span>
              </div>
            </Field>

            {previewMaxPrice && (
              <div className="rounded-xl bg-[rgba(17,168,80,0.08)] border border-[rgba(17,168,80,0.2)] px-3.5 py-2.5 text-[12.5px]">
                That gives you a target purchase price of around{" "}
                <span className="font-display font-bold">
                  £{previewMaxPrice.toLocaleString()}
                </span>{" "}
                over 60 months.
              </div>
            )}

            <button
              onClick={submitGate}
              disabled={!gateReady}
              className="bg-primary text-white font-display font-semibold text-[14px] rounded-xl py-3 disabled:opacity-50"
            >
              Start
            </button>
          </div>

          <p className="text-[11px] text-muted mt-4 text-center px-2 leading-relaxed">
            We&apos;ll show cars you can afford on your monthly. If you want
            something pricier, I&apos;ll flag it and you cover the gap up front.
          </p>
        </div>
      </div>
    );
  }

  const showSuggestions = messages.length === 0;

  return (
    <div className="flex flex-col h-screen w-full max-w-[440px] mx-auto bg-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/90 backdrop-blur z-10">
        <BrandHeader compact />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView((v) => (v === "saved" ? "chat" : "saved"))}
            className={
              "flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full border transition-colors " +
              (view === "saved"
                ? "bg-primary text-white border-primary"
                : "text-fg border-border hover:border-primary hover:text-primary")
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={view === "saved" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
            </svg>
            {view === "saved" ? "Back to chat" : `Saved${saved.length ? ` (${saved.length})` : ""}`}
          </button>
          {view === "chat" && (
            <button
              onClick={() => {
                if (confirm("Start a fresh conversation?")) reset();
              }}
              className="text-muted text-[12px] font-medium hover:text-fg"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
        {view === "saved" ? (
          <div className="flex flex-col gap-3">
            <div className="font-display text-[18px] font-bold mt-1 mb-1">
              Your saved cars
            </div>
            {saved.length === 0 ? (
              <p className="text-[13px] text-muted">
                Tap the heart on any car to save it here for later.
              </p>
            ) : (
              saved.map((l) => <ListingCard key={l.id} listing={l} />)
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          {showSuggestions && (
            <div className="self-start max-w-[92%] bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-[14px] leading-relaxed">
              <div className="font-display text-[13px] font-semibold mb-1">Naya</div>
              Got your budget covered — up to{" "}
              <span className="font-display font-bold">
                £{maxPrice?.toLocaleString()}
              </span>{" "}
              at <span className="font-display font-bold">
                £{monthly}/month
              </span>. What kind of car are you after?
            </div>
          )}

          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {pending && (
            <div className="self-start max-w-[82%] bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-[14px] text-muted">
              <ThinkingDots />
            </div>
          )}
          {error && (
            <div className="self-start text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="border-t border-border bg-bg/95 backdrop-blur px-3 py-3">
        {showSuggestions && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex-shrink-0 bg-card border border-border rounded-full px-3 py-1.5 text-[12px] text-muted hover:text-primary hover:border-primary whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              messages.length === 0
                ? "Tell me what you're looking for…"
                : "Reply…"
            }
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            className="flex-1 bg-card border border-border rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-primary resize-none max-h-[120px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            className="bg-primary text-white rounded-full w-11 h-11 flex items-center justify-center shadow-[0_4px_12px_rgba(17,168,80,0.25)] disabled:opacity-40 flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <div className="flex items-center justify-between mt-1.5 px-2 text-[10.5px] text-muted">
          <span>
            📍 {postcode}
            {maxPrice && (
              <span className="ml-2">
                · £{maxPrice.toLocaleString()} · £{monthly}/mo
              </span>
            )}
          </span>
          <button
            onClick={() => {
              setPostcode("");
              useStore.getState().setAffordability({
                monthly: 0,
                apr: 0,
                maxPrice: 0,
              });
            }}
            className="hover:text-fg"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-display text-[13px] font-semibold mb-0.5">
        {label}
      </div>
      {hint && <p className="text-[11.5px] text-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function BrandHeader({ compact }: { compact?: boolean }) {
  // Logo is 8869×2489, aspect ratio ~3.56:1
  const w = compact ? 64 : 88;
  const h = Math.round(w / 3.563);
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ayan-logo.png"
        alt="Ayan"
        width={w}
        height={h}
        style={{ width: w, height: h }}
      />
      {!compact && (
        <div className="text-[11px] text-muted border-l border-border pl-2.5 leading-none">
          Car&nbsp;finder
        </div>
      )}
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="self-end max-w-[82%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-snug whitespace-pre-wrap">
        {message.text}
      </div>
    );
  }
  const listings =
    message.listings ?? (message.listing ? [message.listing] : []);
  return (
    <div className="self-start max-w-[92%] flex flex-col gap-2">
      {message.text && (
        <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
      )}
      {listings.map((l, i) => (
        <ListingCard
          key={l.id ?? i}
          listing={l}
          totalCount={message.totalCount}
          indexLabel={
            listings.length > 1
              ? `${i + 1} of ${listings.length}`
              : message.totalCount && message.totalCount > 1
              ? `1 of ${message.totalCount.toLocaleString()}`
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ListingCard({
  listing,
  indexLabel,
}: {
  listing: Listing;
  totalCount?: number;
  indexLabel?: string;
}) {
  const photos = listing.photos;
  const saved = useStore((s) => s.saved.some((x) => x.id === listing.id));
  const toggleSave = useStore((s) => s.toggleSave);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const currentPhoto = photos[photoIdx];
  const handlePhotoError = () => {
    if (photoIdx < photos.length - 1) {
      // try the next photo in the dealer's set
      setPhotoIdx((i) => i + 1);
    } else {
      setPhotoFailed(true);
    }
  };
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="aspect-[16/10] bg-soft relative overflow-hidden">
        {currentPhoto && !photoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentPhoto}
            src={currentPhoto}
            alt={listing.heading}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handlePhotoError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted text-[12px] gap-1 px-3 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="1.5" />
              <path d="M3 17l5-5 4 4 3-3 6 6" />
            </svg>
            <span>Photo unavailable</span>
            {listing.vdpUrl && (
              <a
                href={listing.vdpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline text-[11.5px]"
              >
                See it on the dealer site
              </a>
            )}
          </div>
        )}
        {indexLabel && (
          <div className="absolute top-2 left-2 bg-black/65 text-white text-[10.5px] font-semibold px-2 py-1 rounded-full">
            {indexLabel}
          </div>
        )}
        <button
          onClick={() => toggleSave(listing)}
          aria-label={saved ? "Remove from saved" : "Save this car"}
          className={
            "absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur transition-colors " +
            (saved
              ? "bg-primary text-white shadow-[0_4px_12px_rgba(17,168,80,0.35)]"
              : "bg-white/90 text-fg hover:bg-white")
          }
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
          </svg>
        </button>
      </div>
      <div className="p-3">
        <div className="font-display text-[14px] font-bold leading-tight">
          {listing.heading}
        </div>
        <div className="flex items-baseline justify-between mt-1.5">
          <div className="font-display text-[18px] font-bold">
            £{listing.price.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted">
            {listing.year} · {listing.miles.toLocaleString()} mi
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {listing.transmission && <Tag>{listing.transmission}</Tag>}
          {listing.fuel && <Tag>{listing.fuel}</Tag>}
          {listing.insuranceGroup && (
            <Tag tone="green">Ins. group {listing.insuranceGroup}</Tag>
          )}
          {listing.colour && <Tag>{listing.colour}</Tag>}
          {listing.ownerCount === 1 && <Tag tone="green">1 owner</Tag>}
        </div>
        <div className="text-[11px] text-muted mt-2 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
            <circle cx="12" cy="9" r="2" />
          </svg>
          {listing.dealer.name}
          {listing.dealer.city ? ` · ${listing.dealer.city}` : ""}
        </div>

        {(listing.dealer.phone || listing.vdpUrl || listing.dealer.website) && (
          <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
            {listing.dealer.phone && (
              <a
                href={`tel:${listing.dealer.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-2 text-[12.5px] font-medium text-primary hover:underline"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call dealer · {listing.dealer.phone}
              </a>
            )}
            {(listing.vdpUrl || listing.dealer.website) && (
              <a
                href={listing.vdpUrl ?? listing.dealer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12.5px] font-medium text-fg hover:text-primary hover:underline"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {listing.vdpUrl ? "View on dealer site" : "Dealer website"}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "green" | "amber";
}) {
  const cls =
    tone === "green"
      ? "bg-[rgba(17,168,80,0.1)] text-[#0a7a3a]"
      : tone === "amber"
      ? "bg-[rgba(199,139,43,0.12)] text-[#7a5a1a]"
      : "bg-soft text-fg";
  return (
    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {children}
    </span>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1">
      <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}
