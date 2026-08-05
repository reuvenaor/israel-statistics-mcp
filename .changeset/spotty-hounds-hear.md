---
"@reuvenorg/israel-statistics-mcp": minor
---

Fix silent data truncation, a housing-window timing bug, and quarterly series reporting

- **`get_index_data` no longer silently truncates long ranges.** CBS defaults `pagesize` to 100, so a 25-year request returned 100 of 300 points and the summary reported that partial mean as if it covered the whole range. The tool now requests CBS's maximum page size when the caller does not paginate, and states page/total explicitly if CBS still reports more. `get_subject_codes` gets the same default — its response schema strips `paging`, so truncation there left no trace at all.
- **Housing provisional-window warnings are correct in every timezone.** The window boundary was a day early (`>= 15` where CBS's rule makes the 15th's publication current only _after_ the 15th), and the day was read from the host clock rather than Israel time. On a UTC+13 host those combined to declare a still-provisional period "final" — the exact unsafe linkage the warning exists to prevent.
- **Quarterly index codes report their data.** `month` is null for quarterly series and the values live in `quarter`, which no handler read, so quarterly codes answered "No data points found" while holding the full series.
- Server instructions no longer claim there are 11 chapters `a..fa`; CBS publishes 14 today and the list grows.
