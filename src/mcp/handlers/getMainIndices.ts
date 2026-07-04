import { secureFetch, GlobalParams } from "../helpers/fetcher"
import {
  mainIndicesXmlResponseSchema,
  mainIndicesByPeriodXmlResponseSchema,
  type TransformedMainIndicesResponse,
  type TransformedMainIndicesByPeriodResponse,
} from "../../schemas/response.schema"
import {
  getMainIndicesSchema,
  getMainIndicesByPeriodSchema,
} from "../../schemas/request.schema"
import { z } from "zod"
import { parseNumberOrNull } from "../helpers/numbers"

export async function getMainIndices(
  args?: z.infer<typeof getMainIndicesSchema>
): Promise<TransformedMainIndicesResponse> {
  const params: Record<string, string> = {
    // price_selected is an XML-only endpoint — request what it actually serves
    format: "xml",
    download: "false",
  }

  if (args?.oldFormat) params.oldformat = "true"

  // Extract global parameters
  const globalParams: GlobalParams = {
    lang: args?.lang,
    page: args?.page,
    pagesize: args?.pagesize,
  }

  const data = await secureFetch(
    "index/data/price_selected",
    params,
    mainIndicesXmlResponseSchema,
    globalParams
  )

  // Transform XML data to a more usable format - handle all elements properly
  const transformedIndices = data.indices.date.flatMap((dateEntry) =>
    dateEntry.code.map((codeEntry) => ({
      code: codeEntry.code[0], // Single value per code entry
      name: codeEntry.name[0], // Single value per code entry
      percent: parseNumberOrNull(codeEntry.percent[0]),
      year: dateEntry.year[0], // Single value per date entry
      month: dateEntry.month[0], // Single value per date entry
      indices: codeEntry.index.map((idx) => ({
        value: parseNumberOrNull(idx._), // Text content, not in array
        base: idx.base[0], // Attributes are in arrays with explicitArray:true
        chainingCoefficient: idx.chainingCoefficient
          ? parseNumberOrNull(idx.chainingCoefficient[0])
          : undefined,
      })),
    }))
  )

  const updateDate = data.indices.UpdateDate[0] ?? "unknown"
  return {
    indices: transformedIndices,
    updateDate,
    summary:
      transformedIndices.length > 0
        ? `Retrieved ${transformedIndices.length} main indices updated on ${updateDate}.`
        : "No main indices data returned by CBS.",
  }
}

export async function getMainIndicesByPeriod(
  args: z.infer<typeof getMainIndicesByPeriodSchema>
): Promise<TransformedMainIndicesByPeriodResponse> {
  // CBS main-indices data starts January 1997; reject impossible ranges with
  // a clear message instead of forwarding them as opaque CBS errors.
  if (args.startDate < "199701") {
    throw new Error(
      `startDate ${args.startDate} is before 199701 — CBS main indices begin January 1997`
    )
  }
  if (args.endDate < args.startDate) {
    throw new Error(
      `endDate ${args.endDate} is earlier than startDate ${args.startDate}`
    )
  }

  const params = {
    StartDate: args.startDate,
    EndDate: args.endDate,
    format: "xml",
    download: "false",
  }

  // Extract global parameters
  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize,
  }

  const data = await secureFetch(
    "index/data/price_selected_b",
    params,
    mainIndicesByPeriodXmlResponseSchema,
    globalParams
  )

  // Transform XML data to a more usable format
  const transformedIndices = data.indices.ind.map((indEntry) => ({
    code: indEntry.code[0], // Get first element from array
    name: indEntry.n?.[0] || "Unknown Index", // Get first element from array (note: 'n', not 'name')
    percent: parseNumberOrNull(indEntry.percent[0]),
    date: indEntry.date[0], // Get first element from array (YYYY-MM format)
    index: parseNumberOrNull(indEntry.index[0]),
    base: indEntry.base[0], // Base period description
  }))

  // Group by date for better organization
  const groupedByDate = transformedIndices.reduce(
    (acc, curr) => {
      const date = curr.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(curr)
      return acc
    },
    {} as Record<string, typeof transformedIndices>
  )

  return {
    indices: transformedIndices,
    groupedByDate,
    dateRange: `${args.startDate} to ${args.endDate}`,
    totalIndices: transformedIndices.length,
    summary:
      transformedIndices.length > 0
        ? `Retrieved ${transformedIndices.length} main indices from ${args.startDate} to ${args.endDate}.`
        : `No main indices found between ${args.startDate} and ${args.endDate}.`,
  }
}
