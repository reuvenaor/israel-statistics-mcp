import { secureFetch, GlobalParams, CBS_MAX_PAGESIZE } from "../helpers/fetcher"
import { subjectCodesResponseSchema } from "../../schemas/response.schema"
import { getSubjectCodesSchema } from "../../schemas/request.schema"
import { z } from "zod"

export async function getSubjectCodes(
  args: z.infer<typeof getSubjectCodesSchema>
) {
  const params: Record<string, string> = {
    id: args.subjectId.toString(),
    format: "json",
    download: "false",
  }

  if (args.searchText) params.q = args.searchText
  if (args.searchType) params.string_match_type = args.searchType

  // Extract global parameters. subjectCodesResponseSchema carries no `paging`
  // key and is not passthrough, so a truncated page leaves no evidence in the
  // result at all — request CBS's maximum rather than its 100 default.
  const globalParams: GlobalParams = {
    lang: args.lang,
    page: args.page,
    pagesize: args.pagesize ?? CBS_MAX_PAGESIZE,
  }

  const data = await secureFetch(
    "index/catalog/subject",
    params,
    subjectCodesResponseSchema,
    globalParams
  )
  return {
    codes: data.code,
    summary: `Found ${data.code.length} index codes for subject ${args.subjectId}.`,
  }
}
