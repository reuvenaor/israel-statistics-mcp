import z from "zod"

// NOT an enum: CBS adds chapters over time (g and j appeared in 2026) —
// get_catalog_chapters is the authoritative list at any moment.
export const chapterSchema = z
  .string()
  .regex(
    /^[a-z]{1,3}$/,
    "chapter must be a short lowercase id like 'a' or 'aa'"
  )
  .describe(
    "Index chapter id. Known chapters: a=Consumer Price Index (groceries, retail) | aa=Housing Market Index | b=Producer Price Index Industrial | ba=Producer Price Index Exports | bb=Producer Price Index Services | c=Residential Building Input | ca=Commercial Building Input | d=Road Construction Input | e=Agriculture Input | f=Bus Input | fa=Public Minibus Input — call get_catalog_chapters for the current full list. Leave empty for all."
  )

export const languageSchema = z
  .enum(["he", "en"])
  .describe(
    "Language for response. Options: he=Hebrew (default) | en=English. Use 'en' for English responses."
  )

export const periodSchema = z
  .enum(["M", "Q", "MQ", "QM"])
  .describe(
    "Filter indices by update frequency. Options: M=monthly data only | Q=quarterly data only | MQ=both monthly and quarterly (most comprehensive) | QM=quarterly and monthly. Default shows all."
  )

export const searchTypeSchema = z
  .enum(["begins_with", "contains", "equals"])
  .describe(
    "Search matching method. Options: contains=finds text anywhere in name (recommended) | begins_with=name starts with your text | equals=exact name match. Default: contains."
  )

export const currencySchema = z
  .enum(["new_sheqel", "old_sheqel", "lira"])
  .describe(
    "Currency type. Options: new_sheqel=current Israeli Shekel (default, most common) | old_sheqel=pre-1980s Israeli Shekel | lira=historical Israeli Lira."
  )

export const oldFormatSchema = z
  .boolean()
  .describe(
    "Set to true if you need Hebrew text and the legacy display format. Use false (default) for English text and modern formatting."
  )
