import { secureFetch, GlobalParams } from "../helpers/fetcher"
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

  // Extract global parameters
  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize,
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
  const baseSummary =
    allDataPoints.length > 0
      ? `Retrieved ${allDataPoints.length} data points. Average value: ${avg.toFixed(2)}.`
      : `No data points found for index ${args.code} in the requested range.`

  return {
    data,
    summary: addHousingWarningsToSummary(baseSummary, housingWarning),
  }
}
