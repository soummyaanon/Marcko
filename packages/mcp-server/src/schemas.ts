import { z } from "zod"

// ---------- publish_to_marcko ----------

export const PublishInput = z.object({
  content: z.string().min(1, "content cannot be empty"),
  title: z.string().trim().min(1).max(160).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
})
export type PublishInput = z.infer<typeof PublishInput>

export const PublishResponse = z.object({
  id: z.string().min(1),
  shareUrl: z.string().url(),
  visibility: z.enum(["public", "private"]),
})

// ---------- feedback widgets ----------

export const QuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["short_text", "long_text", "rating", "single_choice"]),
  label: z.string().min(1).max(240),
  required: z.boolean().optional(),
  placeholder: z.string().max(160).optional(),
  options: z.array(z.string().min(1).max(60)).max(8).optional(),
})

export const WidgetBase = z.object({
  id: z.string(),
  publicKey: z.string(),
  name: z.string(),
  triggerLabel: z.string(),
  accent: z.string(),
  questions: z.array(QuestionSchema),
  collectName: z.boolean(),
  nameRequired: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const WidgetWithCounts = WidgetBase.extend({
  responseCount: z.number(),
  lastResponseAt: z.string().nullable(),
})

export const WidgetListResponse = z.object({ items: z.array(WidgetWithCounts) })

export const WidgetDetailResponse = z.object({
  widget: WidgetBase,
  responses: z.array(
    z.object({
      id: z.string(),
      widgetId: z.string(),
      answers: z.record(z.unknown()),
      submitterName: z.string().nullable(),
      pageUrl: z.string().nullable(),
      userAgent: z.string().nullable(),
      submittedAt: z.string(),
    }),
  ),
})

export const ListFeedbackInput = z.object({})

export const CreateFeedbackInput = z.object({
  name: z.string().min(1).max(80).describe("Internal name for the widget."),
  triggerLabel: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe('End-user-visible button label. Defaults to "Feedback".'),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .describe("Accent color in #RRGGBB. Defaults to #111111."),
  questions: z
    .array(QuestionSchema.omit({ id: true }))
    .max(12)
    .optional()
    .describe(
      "Questions to ask. Types: short_text, long_text, rating (1–5 stars), single_choice (with options). " +
        "If omitted, a sensible default (rating + comment) is used. Always confirm with the user what they want.",
    ),
  collectName: z
    .boolean()
    .optional()
    .describe('Show a "Your name" field at the top of the dialog. Defaults to true.'),
  nameRequired: z
    .boolean()
    .optional()
    .describe("Whether the name field is required. Defaults to true."),
})
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackInput>

export const GetEmbedInput = z.object({
  id: z.string().describe("Widget id from create_feedback_widget or list_feedback_widgets."),
  format: z
    .enum(["hosted", "manual", "custom", "react", "all"])
    .default("hosted")
    .describe(
      "hosted = single <script> tag; manual = inline injector for Electron / strict CSP; " +
        "custom = bring-your-own-button via [data-marcko-feedback]; react = useEffect wrapper; all = return every variant.",
    ),
})

export const ListResponsesInput = z.object({
  id: z.string().describe("Widget id."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of responses to return. Defaults to 25."),
})
