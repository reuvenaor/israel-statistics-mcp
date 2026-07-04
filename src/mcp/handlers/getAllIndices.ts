import { secureFetch, GlobalParams } from "../helpers/fetcher"
import { allIndicesResponseSchema } from "../../schemas/response.schema"
import { getAllIndicesSchema } from "../../schemas/request.schema"
import { z } from "zod"
import {
  checkHousingWarnings,
  addHousingWarningsToSummary,
} from "../helpers/housingWarnings"

export async function getAllIndices(
  args?: z.infer<typeof getAllIndicesSchema>
) {
  const params: Record<string, string> = {
    format: "xml",
    download: "false",
  }

  if (args?.oldFormat) params.oldformat = "true"
  if (args?.chapter) params.chapter = args.chapter

  // Extract global parameters
  const globalParams: GlobalParams = {
    lang: args?.lang,
    page: args?.page,
    pagesize: args?.pagesize,
  }

  const data = await secureFetch(
    "index/data/price_all",
    params,
    allIndicesResponseSchema,
    globalParams
  )

  // Check for housing-related warnings
  const housingWarning = checkHousingWarnings({ chapter: args?.chapter })
  const chapterFilter = args?.chapter ? ` for chapter ${args.chapter}` : ""

  // Count total indices across all chapters
  const totalIndices = data.indices.chapter.reduce((total, chapter) => {
    return (
      total +
      (chapter.month?.reduce((monthTotal, monthData) => {
        return monthTotal + monthData.index.length
      }, 0) || 0)
    )
  }, 0)

  const baseSummary = `Retrieved ${totalIndices} indices${chapterFilter}.`

  return {
    indices: data.indices,
    summary: addHousingWarningsToSummary(baseSummary, housingWarning),
  }
}
