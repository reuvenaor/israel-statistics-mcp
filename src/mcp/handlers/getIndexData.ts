import { secureFetch, GlobalParams, CBS_MAX_PAGESIZE } from "../helpers/fetcher"
import { indexDataResponseSchema } from "../../schemas/response.schema"
import { getIndexDataSchema } from "../../schemas/request.schema"
import { z } from "zod"
import {
  checkHousingWarnings,
  addHousingWarningsToSummary,
} from "../helpers/housingWarnings"

export async function getIndexData(args: z.infer<typeof getIndexDataSchema>) {
  const params: Record<string, string> = {
    id: args.code,
    format: "json",
    download: "false",
  }

  if (args.startPeriod) params.startPeriod = args.startPeriod
  if (args.endPeriod) params.endPeriod = args.endPeriod
  if (args.last) params.last = args.last.toString()
  if (args.coef) params.coef = args.coef.toString()

  // Extract global parameters. CBS defaults pagesize to 100, which silently
  // truncates a long range (25 years of monthly CPI = 300 points -> 100
  // returned) and would make the average below describe only the first page.
  // Ask for CBS's maximum unless the caller is paginating deliberately.
  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize ?? CBS_MAX_PAGESIZE,
  }

  const endpoint = `index/data/price`
  const data = await secureFetch(
    endpoint,
    params,
    indexDataResponseSchema,
    globalParams
  )

  // Transform the data structure and extract values for statistics
  const allDataPoints = data.month?.[0]?.date || []
  const values = allDataPoints.map((d) => d.currBase.value)
  const avg =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const housingWarning = checkHousingWarnings({
    code: args.code,
    indexName: data.month?.[0]?.name,
    targetPeriod: args.endPeriod,
  })
  // CBS paginates: never present a partial page as if it were the whole series.
  const totalItems = data.paging?.total_items ?? allDataPoints.length
  const truncated = totalItems > allDataPoints.length
  const truncationNote = truncated
    ? ` Note: this is page ${data.paging.current_page} of ${data.paging.last_page} — ${allDataPoints.length} of ${totalItems} data points. The average covers only the returned page; narrow the period or request the remaining pages for the full series.`
    : ""

  const baseSummary =
    allDataPoints.length > 0
      ? `Retrieved ${allDataPoints.length} data points. Average value: ${avg.toFixed(2)}.${truncationNote}`
      : `No data points found for index ${args.code} in the requested range.`

  return {
    data,
    summary: addHousingWarningsToSummary(baseSummary, housingWarning),
  }
}
