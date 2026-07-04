/**
 * The single registry of MCP tools. src/server.ts registers exactly this
 * table — never call registerTool anywhere else.
 */
import { z } from "zod"
import {
  getAllIndicesSchema,
  getCatalogChaptersSchema,
  getChapterTopicsSchema,
  getIndexCalculatorSchema,
  getIndexDataSchema,
  getIndexTopicsSchema,
  getMainIndicesByPeriodSchema,
  getMainIndicesSchema,
  getSubjectCodesSchema,
} from "../schemas/request.schema"
import {
  getAllIndicesOutputSchema,
  getCatalogChaptersOutputSchema,
  getChapterTopicsOutputSchema,
  getIndexCalculatorOutputSchema,
  getIndexDataOutputSchema,
  getIndexTopicsOutputSchema,
  getMainIndicesByPeriodOutputSchema,
  getMainIndicesOutputSchema,
  getSubjectCodesOutputSchema,
} from "../schemas/output.schema"
import { getIndexTopics } from "./handlers/getIndexTopics"
import { getCatalogChapters } from "./handlers/getCatalogChapters"
import { getChapterTopics } from "./handlers/getChapterTopics"
import { getSubjectCodes } from "./handlers/getSubjectCodes"
import { getIndexData } from "./handlers/getIndexData"
import { getIndexCalculator } from "./handlers/getIndexCalculator"
import {
  getMainIndices,
  getMainIndicesByPeriod,
} from "./handlers/getMainIndices"
import { getAllIndices } from "./handlers/getAllIndices"

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: z.ZodRawShape
  outputSchema: z.ZodRawShape
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

function defineTool<Shape extends z.ZodRawShape>(def: {
  name: string
  title: string
  description: string
  inputSchema: z.ZodObject<Shape>
  outputSchema: z.ZodObject<z.ZodRawShape>
  handler: (
    args: z.objectOutputType<Shape, z.ZodTypeAny>
  ) => Promise<Record<string, unknown>>
}): ToolDefinition {
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema: def.inputSchema.shape,
    outputSchema: def.outputSchema.shape,
    handler: def.handler as ToolDefinition["handler"],
  }
}

export const TOOLS: ToolDefinition[] = [
  defineTool({
    name: "get_index_topics",
    title: "Search Index Topics",
    description:
      "Browse or search the full CBS catalog tree of price-index topics and codes. The best starting point for keyword discovery (e.g. searchText='bread' or 'housing'). Returns chapters with their subjects and index codes; feed a codeId into get_index_data or get_index_calculator. Hebrew is the default language — pass lang='en' for English names.",
    inputSchema: getIndexTopicsSchema,
    outputSchema: getIndexTopicsOutputSchema,
    handler: getIndexTopics,
  }),
  defineTool({
    name: "get_index_data",
    title: "Get Index Time Series",
    description:
      "Retrieve the historical time series for one index code (from get_subject_codes or get_index_topics). Periods use mm-yyyy (e.g. startPeriod='01-2020', endPeriod='12-2024'); use last=N for just the most recent N points; coef=true adds chaining coefficients to previous base periods. Housing indices (codes 18xxxx) are bi-monthly with provisional recent values — the summary warns when that matters.",
    inputSchema: getIndexDataSchema,
    outputSchema: getIndexDataOutputSchema,
    handler: getIndexData,
  }),
  defineTool({
    name: "get_catalog_chapters",
    title: "List Index Chapters",
    description:
      "List all CBS index chapters (a=Consumer Price Index, aa=Housing Market, b/ba/bb=Producer Prices, c/ca=Building Inputs, d=Road Construction, e=Agriculture, f/fa=Bus & Minibus Inputs, plus any newly added). This is the authoritative chapter list — use a chapterId with get_chapter_topics or get_all_indices.",
    inputSchema: getCatalogChaptersSchema,
    outputSchema: getCatalogChaptersOutputSchema,
    handler: getCatalogChapters,
  }),
  defineTool({
    name: "get_chapter_topics",
    title: "Get Chapter Topics",
    description:
      "List the subjects/topics inside one chapter (chapterId from get_catalog_chapters, e.g. 'aa' for the housing market). Returns subjectIds for get_subject_codes; code arrays may be null at this level — that is normal, drill down via get_subject_codes.",
    inputSchema: getChapterTopicsSchema,
    outputSchema: getChapterTopicsOutputSchema,
    handler: getChapterTopics,
  }),
  defineTool({
    name: "get_subject_codes",
    title: "Get Subject Index Codes",
    description:
      "List the concrete index codes for one subject/topic (subjectId from get_chapter_topics or get_index_topics), optionally filtered by searchText. Each code includes its date coverage and update frequency — use codeId with get_index_data or get_index_calculator.",
    inputSchema: getSubjectCodesSchema,
    outputSchema: getSubjectCodesOutputSchema,
    handler: getSubjectCodes,
  }),
  defineTool({
    name: "get_index_calculator",
    title: "Calculate Price Linkage",
    description:
      "Inflation-adjust a monetary amount between two dates using a specific index (the official CBS linkage calculator). Dates: use yyyy-mm-dd (recommended, e.g. '2020-01-15'); dd-mm-yyyy is auto-corrected only when unambiguous (day>12) — otherwise it is read as the CBS mm-dd-yyyy convention. Some series (e.g. 110050) legitimately return null coefficient bounds. For housing indices, avoid toDate values inside the provisional window flagged in the summary. Use indexCode 120010 for general CPI.",
    inputSchema: getIndexCalculatorSchema,
    outputSchema: getIndexCalculatorOutputSchema,
    handler: getIndexCalculator,
  }),
  defineTool({
    name: "get_main_indices",
    title: "Get Main Indices Snapshot",
    description:
      "Current snapshot of the headline CBS indices (general CPI, housing, producer prices, …) with values across base periods and the last monthly percent change. No parameters required; oldFormat=true switches to the legacy layout.",
    inputSchema: getMainIndicesSchema,
    outputSchema: getMainIndicesOutputSchema,
    handler: getMainIndices,
  }),
  defineTool({
    name: "get_main_indices_by_period",
    title: "Get Main Indices by Period",
    description:
      "Headline indices over a month range. Dates use compact yyyymm (startDate='202401', endDate='202403'); the range must start no earlier than 199701 and endDate must not precede startDate. Results come both as a flat list and grouped by month.",
    inputSchema: getMainIndicesByPeriodSchema,
    outputSchema: getMainIndicesByPeriodOutputSchema,
    handler: getMainIndicesByPeriod,
  }),
  defineTool({
    name: "get_all_indices",
    title: "Get All Current Indices",
    description:
      "The complete current-month index tree, optionally filtered to one chapter (e.g. chapter='aa' for housing — the summary then carries the bi-monthly/provisional caveat). Large payload: prefer chapter filtering. The indices field mirrors the raw CBS XML structure (values arrive as string arrays).",
    inputSchema: getAllIndicesSchema,
    outputSchema: getAllIndicesOutputSchema,
    handler: getAllIndices,
  }),
]
