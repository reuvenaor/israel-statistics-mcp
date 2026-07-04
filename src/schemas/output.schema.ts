/**
 * Per-tool output schemas (MCP `outputSchema` / `structuredContent`).
 *
 * IMPORTANT: the SDK validates every tool result against these at runtime —
 * a schema stricter than CBS reality turns a working tool into a hard
 * failure. Keep them tolerant: nullable numerics, passthrough at CBS-shaped
 * leaves, and deliberately loose typing where CBS output is volatile.
 */
import { z } from "zod"
import { baseChapterSchema } from "./base.schema"
import {
  chapterTopicsResponseSchema,
  indexCalculatorResponseSchema,
  indexDataResponseSchema,
  subjectCodesResponseSchema,
  transformedIndexTopicsSchema,
  transformedMainIndicesByPeriodSchema,
  transformedMainIndicesSchema,
} from "./response.schema"

const summaryField = z
  .string()
  .describe("Human-readable summary (includes housing warnings when relevant)")

export const getIndexTopicsOutputSchema = transformedIndexTopicsSchema

export const getCatalogChaptersOutputSchema = z.object({
  chapters: z
    .array(baseChapterSchema)
    .describe("All available index chapters (a..fa)"),
  summary: summaryField,
})

export const getChapterTopicsOutputSchema = z.object({
  topics: chapterTopicsResponseSchema.shape.subject,
  summary: summaryField,
})

export const getSubjectCodesOutputSchema = z.object({
  codes: subjectCodesResponseSchema.shape.code,
  summary: summaryField,
})

export const getIndexDataOutputSchema = z.object({
  data: indexDataResponseSchema,
  summary: summaryField,
})

export const getIndexCalculatorOutputSchema = z.object({
  request: indexCalculatorResponseSchema.shape.request,
  answer: indexCalculatorResponseSchema.shape.answer,
  summary: summaryField,
})

export const getMainIndicesOutputSchema = transformedMainIndicesSchema

export const getMainIndicesByPeriodOutputSchema =
  transformedMainIndicesByPeriodSchema

// price_all echoes raw xml2js output whose deep shape is CBS-volatile —
// a strict schema here would be a runtime landmine.
export const getAllIndicesOutputSchema = z.object({
  indices: z
    .unknown()
    .describe(
      "Raw CBS all-indices tree (chapters -> months -> index entries; xml2js array conventions)"
    ),
  summary: summaryField,
})
