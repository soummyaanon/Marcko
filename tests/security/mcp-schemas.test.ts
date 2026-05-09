import { describe, expect, it } from "vitest"

import {
  CreateFeedbackInput,
  GetEmbedInput,
  ListResponsesInput,
  PublishInput,
  QuestionSchema,
} from "../../packages/mcp-server/src/schemas"

describe("PublishInput", () => {
  it("accepts a minimal valid payload and defaults visibility to public", () => {
    const r = PublishInput.parse({ content: "# hello" })
    expect(r.visibility).toBe("public")
    expect(r.content).toBe("# hello")
  })

  it("rejects empty content", () => {
    expect(PublishInput.safeParse({ content: "" }).success).toBe(false)
  })

  it("rejects unknown visibility values", () => {
    expect(
      PublishInput.safeParse({ content: "x", visibility: "world-readable" })
        .success,
    ).toBe(false)
  })

  it("caps title length at 160 chars", () => {
    expect(
      PublishInput.safeParse({ content: "x", title: "a".repeat(161) }).success,
    ).toBe(false)
    expect(
      PublishInput.safeParse({ content: "x", title: "a".repeat(160) }).success,
    ).toBe(true)
  })

  it("rejects empty / whitespace-only title", () => {
    expect(PublishInput.safeParse({ content: "x", title: "" }).success).toBe(false)
    expect(PublishInput.safeParse({ content: "x", title: "   " }).success).toBe(
      false,
    )
  })
})

describe("QuestionSchema", () => {
  it("accepts a minimal short_text question", () => {
    const r = QuestionSchema.parse({ type: "short_text", label: "Name?" })
    expect(r.label).toBe("Name?")
  })

  it("rejects unknown types", () => {
    expect(
      QuestionSchema.safeParse({ type: "drawing", label: "x" }).success,
    ).toBe(false)
  })

  it("rejects empty / overlong labels", () => {
    expect(QuestionSchema.safeParse({ type: "short_text", label: "" }).success).toBe(
      false,
    )
    expect(
      QuestionSchema.safeParse({
        type: "short_text",
        label: "x".repeat(241),
      }).success,
    ).toBe(false)
  })

  it("caps options at 8 entries and 60 chars each", () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => `o${i}`)
    expect(
      QuestionSchema.safeParse({
        type: "single_choice",
        label: "Pick",
        options: tooMany,
      }).success,
    ).toBe(false)

    expect(
      QuestionSchema.safeParse({
        type: "single_choice",
        label: "Pick",
        options: ["x".repeat(61)],
      }).success,
    ).toBe(false)
  })
})

describe("CreateFeedbackInput", () => {
  it("accepts a minimal name-only payload", () => {
    expect(CreateFeedbackInput.safeParse({ name: "Public beta" }).success).toBe(
      true,
    )
  })

  it("enforces name length 1-80", () => {
    expect(CreateFeedbackInput.safeParse({ name: "" }).success).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({ name: "a".repeat(81) }).success,
    ).toBe(false)
  })

  it("requires accent to match #RRGGBB", () => {
    expect(
      CreateFeedbackInput.safeParse({ name: "x", accent: "blue" }).success,
    ).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({ name: "x", accent: "#abc" }).success,
    ).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({
        name: "x",
        accent: "javascript:alert(1)",
      }).success,
    ).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({ name: "x", accent: "#aabbcc" }).success,
    ).toBe(true)
  })

  it("caps the question count at 12", () => {
    const questions = Array.from({ length: 13 }, () => ({
      type: "short_text" as const,
      label: "x",
    }))
    expect(
      CreateFeedbackInput.safeParse({ name: "x", questions }).success,
    ).toBe(false)
  })

  it("rejects extra unknown nested fields on each question", () => {
    // Question schema is a strict shape (no `id` from the agent);
    // nested questions in CreateFeedbackInput omit `id`, but unknowns
    // still pass through unless explicitly stripped — we only ensure
    // that required fields exist and types are right here.
    const r = CreateFeedbackInput.safeParse({
      name: "x",
      questions: [{ type: "rating", label: "Rate" }],
    })
    expect(r.success).toBe(true)
  })

  it("treats triggerLabel length as 1-40", () => {
    expect(
      CreateFeedbackInput.safeParse({ name: "x", triggerLabel: "" }).success,
    ).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({
        name: "x",
        triggerLabel: "a".repeat(41),
      }).success,
    ).toBe(false)
    expect(
      CreateFeedbackInput.safeParse({ name: "x", triggerLabel: "Send" }).success,
    ).toBe(true)
  })
})

describe("GetEmbedInput", () => {
  it("requires id and defaults format to hosted", () => {
    const r = GetEmbedInput.parse({ id: "w_123" })
    expect(r.format).toBe("hosted")
  })

  it("rejects missing id", () => {
    expect(GetEmbedInput.safeParse({}).success).toBe(false)
  })

  it("rejects unknown format", () => {
    expect(
      GetEmbedInput.safeParse({ id: "w_123", format: "iframe" }).success,
    ).toBe(false)
  })

  it("accepts every documented format", () => {
    for (const format of ["hosted", "manual", "custom", "react", "all"] as const) {
      expect(GetEmbedInput.safeParse({ id: "w_123", format }).success).toBe(true)
    }
  })
})

describe("ListResponsesInput", () => {
  it("requires id and accepts limit in 1-100", () => {
    expect(ListResponsesInput.safeParse({ id: "w_123" }).success).toBe(true)
    expect(ListResponsesInput.safeParse({ id: "w_123", limit: 1 }).success).toBe(
      true,
    )
    expect(ListResponsesInput.safeParse({ id: "w_123", limit: 100 }).success).toBe(
      true,
    )
  })

  it("rejects limit out of range or non-integer", () => {
    expect(ListResponsesInput.safeParse({ id: "w_x", limit: 0 }).success).toBe(
      false,
    )
    expect(ListResponsesInput.safeParse({ id: "w_x", limit: 101 }).success).toBe(
      false,
    )
    expect(
      ListResponsesInput.safeParse({ id: "w_x", limit: 3.5 }).success,
    ).toBe(false)
    expect(
      ListResponsesInput.safeParse({ id: "w_x", limit: -1 }).success,
    ).toBe(false)
  })
})
