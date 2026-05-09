"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuestionType = "short_text" | "long_text" | "rating" | "single_choice";

type FeedbackQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

type WidgetPublic = {
  publicKey: string;
  name: string;
  triggerLabel: string;
  accent: string;
  questions: FeedbackQuestion[];
  collectName: boolean;
  nameRequired: boolean;
};

type AnswerValue = string | number | null;

interface FeedbackFormProps {
  widget: WidgetPublic;
}

export function FeedbackForm({ widget }: FeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitterName, setSubmitterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--marcko-accent", widget.accent);
    return () => {
      document.documentElement.style.removeProperty("--marcko-accent");
    };
  }, [widget.accent]);

  const updateAnswer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (widget.collectName && widget.nameRequired && !submitterName.trim()) {
      setError("Please share your name.");
      return;
    }

    for (const q of widget.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim().length === 0)
      ) {
        setError(`"${q.label}" is required.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const cleanedAnswers: Record<string, AnswerValue> = {};
      for (const [k, v] of Object.entries(answers)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && v.trim().length === 0) continue;
        cleanedAnswers[k] = typeof v === "string" ? v.trim() : v;
      }

      const res = await fetch(
        `/api/feedback/public/${encodeURIComponent(widget.publicKey)}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answers: cleanedAnswers,
            submitterName: widget.collectName ? submitterName.trim() : undefined,
            pageUrl:
              typeof window !== "undefined" ? window.location.href : undefined,
          }),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(data?.message ?? "Could not submit");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
        <span
          className="inline-flex size-10 items-center justify-center rounded-full"
          style={{
            background: `${widget.accent}1a`,
            color: widget.accent,
          }}
        >
          <Check className="size-5" />
        </span>
        <h1 className="font-display text-[44px] italic leading-[0.95] text-foreground">
          Thank you.
        </h1>
        <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
          Your feedback was recorded. The team behind {widget.name} appreciates
          you taking the time.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Marcko
          <span className="opacity-50">·</span>
          built with care
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col px-6 py-12 sm:py-16">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Marcko
        </Link>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: widget.accent }}
            aria-hidden
          />
          Feedback form
        </span>
      </header>

      <div className="mb-8">
        <h1 className="font-display text-[40px] italic leading-[0.95] text-foreground sm:text-[48px]">
          {widget.name}
        </h1>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Take a minute to share what you think. Every reply lands in the
          author&rsquo;s inbox.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-7">
        {widget.collectName ? (
          <FieldShell label="Your name" required={widget.nameRequired}>
            <Input
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder="Optional — first name is fine"
              className="h-10 rounded-md border-border/60 bg-background text-[14px] focus-visible:border-foreground/40"
              maxLength={120}
            />
          </FieldShell>
        ) : null}

        {widget.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id] ?? null}
            onChange={(v) => updateAnswer(question.id, v)}
          />
        ))}

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Powered by Marcko
          </span>
          <Button
            type="submit"
            disabled={submitting}
            className="h-9 gap-1.5 rounded-md px-4 text-[12px] font-medium"
            style={{
              background: widget.accent,
              color: "#fff",
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Sending
              </>
            ) : (
              <>
                Send feedback
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {required ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Required
          </span>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">
            Optional
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: FeedbackQuestion;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  if (question.type === "short_text") {
    return (
      <FieldShell label={question.label} required={question.required}>
        <Input
          value={typeof value === "string" ? value : ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 rounded-md border-border/60 bg-background text-[14px] focus-visible:border-foreground/40"
          maxLength={500}
        />
      </FieldShell>
    );
  }

  if (question.type === "long_text") {
    return (
      <FieldShell label={question.label} required={question.required}>
        <textarea
          value={typeof value === "string" ? value : ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:border-foreground/40 focus-visible:outline-none"
          maxLength={4000}
        />
      </FieldShell>
    );
  }

  if (question.type === "rating") {
    const rating = typeof value === "number" ? value : 0;
    return (
      <FieldShell label={question.label} required={question.required}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= rating;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(rating === n ? null : n)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-foreground/[0.04]",
                  active && "text-foreground",
                )}
                aria-label={`Rate ${n} of 5`}
                aria-pressed={active}
              >
                <Star
                  className={cn("size-5", active && "fill-current")}
                />
              </button>
            );
          })}
          {rating > 0 ? (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              {rating} / 5
            </span>
          ) : null}
        </div>
      </FieldShell>
    );
  }

  if (question.type === "single_choice") {
    const options = question.options ?? [];
    return (
      <FieldShell label={question.label} required={question.required}>
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected ? null : opt)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                  selected
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-3 items-center justify-center rounded-full border transition-colors",
                    selected
                      ? "border-foreground"
                      : "border-border/70",
                  )}
                  aria-hidden
                >
                  {selected ? (
                    <span className="size-1.5 rounded-full bg-foreground" />
                  ) : null}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      </FieldShell>
    );
  }

  return null;
}
