import { secureFetch, GlobalParams } from "../helpers/fetcher"
import { indexCalculatorResponseSchema } from "../../schemas/response.schema"
import { getIndexCalculatorSchema } from "../../schemas/request.schema"
import { z } from "zod"
import { normalizeCalculatorDate } from "../helpers/dates"
import {
  addHousingWarningsToSummary,
  checkHousingWarnings,
} from "../helpers/housingWarnings"

export async function getIndexCalculator(
  args: z.infer<typeof getIndexCalculatorSchema>
) {
  // CBS misparses dd-mm-yyyy silently — always send unambiguous yyyy-mm-dd.
  const fromDate = normalizeCalculatorDate(args.fromDate)
  const toDate = normalizeCalculatorDate(args.toDate)

  const params: Record<string, string> = {
    value: args.value.toString(),
    date: fromDate,
    toDate: toDate,
    format: "json",
    download: "false",
  }

  if (args.currency) params.currency = args.currency

  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize,
  }

  const data = await secureFetch(
    `index/data/calculator/${args.indexCode}`,
    params,
    indexCalculatorResponseSchema,
    globalParams
  )

  // change_percent is null for some series — derive it so the summary
  // stays informative either way.
  const { from_value, to_value, change_percent } = data.answer
  const effectivePercent =
    change_percent ??
    (from_value !== 0
      ? Number((((to_value - from_value) / from_value) * 100).toFixed(2))
      : null)

  const housingWarning = checkHousingWarnings({
    code: args.indexCode,
    targetPeriod: toDate,
  })

  const baseSummary = `Linked ${data.request.sum} from ${data.request.from_date} to ${data.request.to_date}: ${to_value}${
    effectivePercent != null ? ` (${effectivePercent}% change)` : ""
  }`

  return {
    request: data.request,
    answer: data.answer,
    summary: addHousingWarningsToSummary(baseSummary, housingWarning),
  }
}
