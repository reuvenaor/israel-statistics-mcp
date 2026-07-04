import { z } from "zod"
import { chapterSchema } from "./shared.schema"

// Base pagination schema - used across multiple API responses
export const paginationSchema = z
  .object({
    total_items: z.number().describe("Total number of items"),
    page_size: z.number().describe("Items per page"),
    current_page: z.number().describe("Current page number"),
    last_page: z.number().describe("Last page number"),
    first_url: z.string().nullable().describe("URL for first page"),
    previous_url: z.string().nullable().describe("URL for previous page"),
    current_url: z.string().describe("URL for current page"),
    next_url: z.string().nullable().describe("URL for next page"),
    last_url: z.string().describe("URL for last page"),
    base_url: z.string().nullable().describe("Base URL"),
  })
  .describe("Pagination information")

// Base index code schema - core structure for index codes
export const baseCodeSchema = z.object({
  codeId: z
    .number()
    .describe("Unique numeric identifier for this specific index code"),
  codeName: z.string().describe("Full descriptive name of the index"),
  codeNote: z
    .string()
    .optional()
    .describe("Additional notes or explanations about this index"),
  codeLevel: z
    .number()
    .optional()
    .describe("Hierarchical level of this index (1=main, 3=sub, 6=detailed)"),
  codeLine: z
    .number()
    .optional()
    .describe("Display line number for ordering indices"),
  codeType: z.number().optional().describe("Type classification of the index"),
  codeFromDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Start date when this index became available (YYYY-MM-DD format)"
    ),
  codeToDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "End date when this index was discontinued (YYYY-MM-DD format, null if still active)"
    ),
  codeCalcFromDate: z
    .string()
    .nullable()
    .optional()
    .describe("Start date for index calculations (YYYY-MM-DD format)"),
  codeCalcToDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "End date for index calculations (YYYY-MM-DD format, null if still being calculated)"
    ),
  isMonth: z
    .boolean()
    .optional()
    .describe(
      "Whether this index is updated monthly (true) or at other intervals"
    ),
  codePrefix: z
    .number()
    .optional()
    .describe("Prefix number used in the index coding system"),
})

// Extended code schema for subject codes (adds additional fields)
export const subjectCodeSchema = baseCodeSchema.extend({
  codeDescription: z
    .string()
    .optional()
    .nullable()
    .describe("Additional description or notes about this index"),
  period: z
    .string()
    .optional()
    .nullable()
    .describe("Update frequency period (e.g., 'Monthly', 'Quarterly')"),
  baseYear: z
    .string()
    .optional()
    .nullable()
    .describe("Base year period for index calculations"),
})

// Base subject schema - used in multiple places
export const baseSubjectSchema = z.object({
  subjectId: z
    .number()
    .describe("Unique numeric identifier for this subject/topic"),
  subjectName: z
    .string()
    .describe("Descriptive name of the subject/topic area"),
})

// Subject schema with codes
export const subjectWithCodesSchema = baseSubjectSchema.extend({
  code: z.array(baseCodeSchema),
})

// Base chapter schema - used in multiple places
export const baseChapterSchema = z.object({
  chapterId: chapterSchema,
  chapterName: z
    .string()
    .describe("Full descriptive name of the index chapter"),
  chapterOrder: z
    .number()
    .describe("Display order number for the chapter in the system"),
  mainCode: z
    .number()
    .nullable()
    .describe(
      "Primary index code for this chapter (null for some chapters that don't have a main index)"
    ),
})

// Chapter schema with subjects
export const chapterWithSubjectsSchema = baseChapterSchema.extend({
  subject: z.array(subjectWithCodesSchema),
})

// Base value/index schema - used for price indices
export const baseIndexValueSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe(
      "Index value for this specific base period (null when CBS ships a non-numeric value)"
    ),
  base: z.string().describe("Base period description"),
  chainingCoefficient: z
    .number()
    .nullable()
    .optional()
    .describe(
      "Coefficient used for linking indices across different base periods"
    ),
})

// Base date entry schema for monthly data
export const baseDateEntrySchema = z.object({
  year: z.number().describe("Year"),
  month: z.number().describe("Month number"),
  monthDesc: z.string().describe("Month name"),
  percent: z.number().describe("Monthly percentage change"),
  percentYear: z.number().describe("Yearly percentage change"),
})

// Currency base schema for current and previous bases
export const currencyBaseSchema = z.object({
  baseDesc: z.string().describe("Base period description"),
  value: z.number().describe("Index value"),
})

// Extended date entry with currency bases
export const dateEntryWithBasesSchema = baseDateEntrySchema.extend({
  currBase: currencyBaseSchema,
  prevBase: currencyBaseSchema.nullable().optional(),
})

// Index data month schema
export const indexDataMonthSchema = z.object({
  code: z.number().describe("Index code"),
  name: z.string().describe("Index name"),
  date: z.array(dateEntryWithBasesSchema),
})

// Base XML array pattern - many XML responses wrap single values in arrays
export const xmlStringArray = z.array(z.string())
export const xmlNumberArray = z
  .array(z.string())
  .transform((arr) => arr.map((str) => parseFloat(str)))

// XML index base schema
export const xmlIndexBaseSchema = z.object({
  _: z.string().describe("Index value"),
  base: xmlStringArray.describe("Base period description"),
  chainingCoefficient: xmlStringArray
    .optional()
    .describe("Chaining coefficient for historical linkage"),
})
