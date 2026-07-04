import { secureFetch, GlobalParams } from "../helpers/fetcher"
import { chapterTopicsResponseSchema } from "../../schemas/response.schema"
import { getChapterTopicsSchema } from "../../schemas/request.schema"
import { z } from "zod"
import {
  checkHousingWarnings,
  addHousingWarningsToSummary,
} from "../helpers/housingWarnings"

export async function getChapterTopics(
  args: z.infer<typeof getChapterTopicsSchema>
) {
  // Extract global parameters
  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize,
  }

  const data = await secureFetch(
    "index/catalog/chapter",
    { id: args.chapterId, format: "json", download: "false" },
    chapterTopicsResponseSchema,
    globalParams
  )

  // Check for housing-related warnings
  const housingWarning = checkHousingWarnings({ chapter: args.chapterId })
  const baseSummary = `Found ${data.subject.length} topics in chapter ${args.chapterId}.`

  return {
    topics: data.subject,
    summary: addHousingWarningsToSummary(baseSummary, housingWarning),
  }
}
