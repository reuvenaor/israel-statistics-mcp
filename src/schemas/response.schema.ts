import { z } from "zod"
import { chapterSchema } from "./shared.schema"
import {
  paginationSchema,
  subjectCodeSchema,
  baseSubjectSchema,
  baseChapterSchema,
  chapterWithSubjectsSchema,
  baseIndexValueSchema,
  currencyBaseSchema,
} from "./base.schema"

// Index Topics response schema (JSON API)
export const indexTopicsResponseSchema = z.object({
  chapters: z
    .array(chapterWithSubjectsSchema)
    .describe("Array of all index chapters available in the CBS system"),
})

// Previous-base entry: with coef=true CBS returns an ARRAY of these
// (one per historical base, each carrying the chaining coefficient).
const prevBaseEntrySchema = z
  .object({
    baseDesc: z.string().describe("Base period description"),
    value: z.number().describe("Index value expressed in this base"),
    coeff: z
      .number()
      .nullable()
      .optional()
      .describe("Chaining coefficient to the previous base (with coef=true)"),
  })
  .passthrough()

// Index Data response schema (JSON API) - for index/data/price
export const indexDataResponseSchema = z
  .object({
    month: z
      .array(
        z.object({
          code: z.number().describe("Index code"),
          name: z.string().describe("Index name (language follows lang param)"),
          date: z
            .array(
              z
                .object({
                  year: z.number().describe("Year"),
                  percent: z
                    .number()
                    .nullable()
                    .describe("Monthly percentage change"),
                  percentYear: z
                    .number()
                    .nullable()
                    .describe("Yearly percentage change"),
                  currBase: currencyBaseSchema.passthrough(),
                  // Single object normally; array of bases when coef=true
                  prevBase: z
                    .union([prevBaseEntrySchema, z.array(prevBaseEntrySchema)])
                    .nullable()
                    .optional(),
                  month: z.number().describe("Month number"),
                  monthDesc: z.string().describe("Month name"),
                })
                .passthrough()
            )
            .describe("Array of date entries with index values"),
        })
      )
      .nullable()
      .describe(
        "Monthly index data (null when the code is quarterly or no data matches)"
      ),
    quarter: z
      .array(z.unknown())
      .nullable()
      .optional()
      .describe("Quarterly index data (if applicable)"),
    paging: paginationSchema,
  })
  .describe(
    "Index data response containing monthly/quarterly data with pagination"
  )

// Index Calculator response schema (Calculator endpoint)
export const indexCalculatorResponseSchema = z
  .object({
    request: z
      .object({
        code: z.number().describe("The index code used for calculation"),
        sum: z
          .number()
          .describe("The original amount entered for linkage calculation"),
        currency: z
          .string()
          .describe("Currency type (NEW_SHEQEL, OLD_SHEQEL, LIRA)"),
        from_date: z
          .string()
          .describe(
            "Starting date for linkage calculation in YYYY-MM-DD format"
          ),
        to_date: z
          .string()
          .describe("Target date for linkage calculation in YYYY-MM-DD format"),
      })
      .describe("Request parameters sent to the calculator"),
    answer: z
      .object({
        from_value: z.number().describe("Original value amount"),
        to_value: z.number().describe("Linked/adjusted value at target date"),
        base_year: z.string().describe("Base year for the index calculation"),
        from_index_date: z
          .string()
          .describe("Index period corresponding to the from_date"),
        from_index_value: z.number().describe("Index value at the from_date"),
        to_index_date: z
          .string()
          .describe("Index period corresponding to the to_date"),
        to_index_value: z.number().describe("Index value at the to_date"),
        chaining_coefficient: z
          .number()
          .nullable()
          .describe(
            "Coefficient used for chaining between base years (null for some index series)"
          ),
        mult_min: z
          .number()
          .nullable()
          .describe(
            "Minimum multiplication factor (null for index series without min/max bounds, e.g. 110050)"
          ),
        mult_max: z
          .number()
          .nullable()
          .describe(
            "Maximum multiplication factor (null for index series without min/max bounds)"
          ),
        Koeff: z
          .number()
          .nullable()
          .describe("Additional coefficient factor (may be null)"),
        change_percent: z
          .number()
          .nullable()
          .describe(
            "Percentage change from original to linked value (may be null; compute from from_value/to_value when absent)"
          ),
      })
      .describe(
        "Calculation results showing original value linked to target date"
      ),
  })
  .describe(
    "Price linkage calculation result showing how a monetary amount changes in value over time due to inflation/deflation"
  )

// Chapter Topics response schema (JSON API) - for index/catalog/chapter
export const chapterTopicsResponseSchema = z
  .object({
    chapterId: chapterSchema,
    chapterName: z
      .string()
      .nullable()
      .describe("Full descriptive name of the index chapter"),
    chapterOrder: z
      .number()
      .nullable()
      .describe("Display order number for the chapter in the system"),
    mainCode: z
      .number()
      .nullable()
      .describe("Primary index code for this chapter"),
    subject: z
      .array(
        z.object({
          subjectId: z
            .number()
            .describe(
              "Unique numeric identifier for this subject/topic within the chapter"
            ),
          subjectName: z
            .string()
            .describe("Descriptive name of the subject/topic area"),
          code: z
            .array(
              z
                .object({
                  codeId: z.number().describe("Unique numeric index code"),
                  codeName: z.string().describe("Index name"),
                })
                .passthrough()
            )
            .nullable()
            .describe(
              "Array of index codes for this subject, or null if no codes available"
            ),
        })
      )
      .describe(
        "Array of subjects/topics available within the specified chapter"
      ),
  })
  .describe(
    "Topics and subjects available within a specific index chapter from index/catalog/chapter endpoint"
  )

// Subject Codes response schema (JSON API) - for index/catalog/subject
export const subjectCodesResponseSchema = baseSubjectSchema
  .extend({
    subjectName: z
      .string()
      .nullable()
      .describe("Descriptive name of the subject/topic area"),
    chapterId: chapterSchema.optional().nullable(),
    chapterName: z
      .string()
      .optional()
      .nullable()
      .describe("Full descriptive name of the parent chapter"),
    code: z
      .array(subjectCodeSchema)
      .describe("Array of index codes available for the specified subject"),
  })
  .describe(
    "Index codes and details for a specific subject/topic from index/catalog/subject endpoint"
  )

// All Indices response schema (XML API) - for index/data/price_all
// Empty result sets arrive as a self-closing <indices/> element: xml2js then
// yields "" (no attributes) or an object missing the data keys (attributes
// merged) — preprocess + defaults turn both into clean empty arrays.
export const allIndicesResponseSchema = z
  .object({
    indices: z.preprocess(
      (v) => (v == null || typeof v === "string" ? {} : v),
      z.object({
        UpdateDate: z
          .array(z.string())
          .default([])
          .describe("Last update timestamp in ISO format"),
        chapter: z
          .array(
            z.object({
              name: z
                .array(z.string())
                .describe("Chapter name (e.g., 'Consumer Prices Index')"),
              month: z
                .array(
                  z.object({
                    index: z
                      .array(
                        z.object({
                          month: z
                            .array(z.string())
                            .describe("Month name (e.g., 'June')"),
                          year: z
                            .array(z.string())
                            .describe("Year as string (e.g., '2025')"),
                          code: z
                            .array(z.string())
                            .describe("Index code (e.g., '120010')"),
                          index_name: z
                            .array(z.string())
                            .describe("Full index name"),
                          title: z
                            .array(z.string())
                            .optional()
                            .describe("Additional title for some indices"),
                          percent: z
                            .array(z.string())
                            .optional()
                            .describe("Percentage change"),
                          index_base: z
                            .array(
                              z.object({
                                _: z.string().describe("Index value"),
                                base: z
                                  .array(z.string())
                                  .describe(
                                    "Base period (e.g., 'Average 2024')"
                                  ),
                                chaining_coefficient: z
                                  .array(z.string())
                                  .optional()
                                  .describe(
                                    "Chaining coefficient for historical linkage"
                                  ),
                              })
                            )
                            .optional()
                            .describe(
                              "Array of index values for different base periods"
                            ),
                        })
                      )
                      .describe("Array of individual index entries"),
                  })
                )
                .optional()
                .describe("Array of month data"),
            })
          )
          .default([])
          .describe("Array of chapters containing index data"),
      })
    ),
  })
  .describe(
    "All indices response from XML API containing nested structure with chapters, months, and index data"
  )

// Main Indices response schema (XML API) - for regular main indices endpoint
export const mainIndicesXmlResponseSchema = z.object({
  indices: z.preprocess(
    (v) => (v == null || typeof v === "string" ? {} : v),
    z.object({
      UpdateDate: z
        .array(z.string())
        .default([])
        .describe("Last update timestamp of the indices data (ISO format)"),
      date: z
        .array(
          z.object({
            year: z
              .array(z.string())
              .describe("Year of the index data (YYYY format)"),
            month: z
              .array(z.string())
              .describe("Month name of the index data (e.g., 'June', 'July')"),
            code: z.array(
              z.object({
                code: z
                  .array(z.string())
                  .describe("Unique numeric index code identifier"),
                name: z
                  .array(z.string())
                  .describe("Full descriptive name of the index"),
                percent: z
                  .array(z.string())
                  .describe("Monthly percentage change of the index as string"),
                index: z.array(
                  z.object({
                    _: z
                      .string()
                      .describe("Index value for this specific base period"),
                    base: z
                      .array(z.string())
                      .describe(
                        "Base period description (e.g., 'Average 2024', 'Average 2022')"
                      ),
                    chainingCoefficient: z
                      .array(z.string())
                      .optional()
                      .describe(
                        "Coefficient used for linking indices across different base periods"
                      ),
                  })
                ),
              })
            ),
          })
        )
        .default([]),
    })
  ),
})

// Main Indices By Period response schema (XML API) - for by-period endpoint
export const mainIndicesByPeriodXmlResponseSchema = z.object({
  indices: z.preprocess(
    (v) => (v == null || typeof v === "string" ? {} : v),
    z.object({
      ind: z
        .array(
          z.object({
            date: z
              .array(z.string())
              .describe("Date of the index data in YYYY-MM format"),
            n: z
              .array(z.string())
              .optional()
              .describe("Full descriptive name of the index"),
            index: z
              .array(z.string())
              .describe("Index value as string (e.g., '102.3')"),
            percent: z
              .array(z.string())
              .describe("Monthly percentage change as string (e.g., '0.3')"),
            code: z
              .array(z.string())
              .describe("Unique numeric index code as string (e.g., '120010')"),
            base: z
              .array(z.string())
              .describe("Base period description (e.g., 'Average 2022')"),
          })
        )
        .default([])
        .describe(
          "Array of individual index entries (empty when no data matches the period range)"
        ),
    })
  ),
})

// Transformed response types (what handlers return)
export const transformedIndexTopicsSchema = z.object({
  topics: z
    .array(chapterWithSubjectsSchema)
    .describe("Array of all index chapters with their topics and codes"),
  summary: z
    .string()
    .describe(
      "Human-readable summary of the retrieved data, including count of total index codes found"
    ),
})

export const transformedMainIndicesSchema = z.object({
  indices: z
    .array(
      z.object({
        code: z
          .string()
          .describe(
            "Unique numeric index code identifier (e.g., '120010' for general Consumer Price Index)"
          ),
        name: z
          .string()
          .describe(
            "Full descriptive name of the index (e.g., 'Consumer Price Index - General')"
          ),
        percent: z
          .number()
          .nullable()
          .describe(
            "Monthly percentage change of the index (positive = increase, negative = decrease; null when CBS omits the value)"
          ),
        year: z.string().describe("Year of the index data (YYYY format)"),
        month: z
          .string()
          .describe("Month name of the index data (e.g., 'June', 'July')"),
        indices: z.array(baseIndexValueSchema),
      })
    )
    .describe(
      "Array of main price indices with their values across different base periods"
    ),
  updateDate: z
    .string()
    .describe("Last update timestamp of the indices data (ISO format)"),
  summary: z
    .string()
    .describe(
      "Human-readable summary of the retrieved data, including count and update information"
    ),
})

// Transformed Main Indices By Period response schema
export const transformedMainIndicesByPeriodSchema = z.object({
  indices: z
    .array(
      z.object({
        code: z
          .string()
          .describe("Unique numeric index code identifier (e.g., '120010')"),
        name: z.string().describe("Full descriptive name of the index"),
        percent: z
          .number()
          .nullable()
          .describe(
            "Monthly percentage change of the index (null when CBS omits the value)"
          ),
        date: z.string().describe("Date of the index data in YYYY-MM format"),
        index: z
          .number()
          .nullable()
          .describe("Index value for this period (null when CBS omits it)"),
        base: z
          .string()
          .describe("Base period description (e.g., 'Average 2022')"),
      })
    )
    .describe("Array of main price indices for the specified period range"),
  groupedByDate: z
    .record(z.string(), z.array(z.unknown()))
    .describe("Indices grouped by date for easier navigation"),
  dateRange: z
    .string()
    .describe("The date range requested (startDate to endDate)"),
  totalIndices: z.number().describe("Total number of indices returned"),
  summary: z.string().describe("Human-readable summary of the data retrieval"),
})

// Additional response schemas for other CBS API endpoints

// Catalog Chapters response schema (JSON API)
export const catalogChaptersResponseSchema = z.object({
  chapters: z
    .array(baseChapterSchema)
    .describe("Array of all available index chapters"),
})

// Type exports
export type IndexTopicsResponse = z.infer<typeof indexTopicsResponseSchema>
export type IndexDataResponse = z.infer<typeof indexDataResponseSchema>
export type IndexCalculatorResponse = z.infer<
  typeof indexCalculatorResponseSchema
>
export type ChapterTopicsResponse = z.infer<typeof chapterTopicsResponseSchema>
export type SubjectCodesResponse = z.infer<typeof subjectCodesResponseSchema>
export type AllIndicesResponse = z.infer<typeof allIndicesResponseSchema>
export type MainIndicesXmlResponse = z.infer<
  typeof mainIndicesXmlResponseSchema
>
export type TransformedIndexTopicsResponse = z.infer<
  typeof transformedIndexTopicsSchema
>
export type TransformedMainIndicesResponse = z.infer<
  typeof transformedMainIndicesSchema
>
export type TransformedMainIndicesByPeriodResponse = z.infer<
  typeof transformedMainIndicesByPeriodSchema
>
export type CatalogChaptersResponse = z.infer<
  typeof catalogChaptersResponseSchema
>
