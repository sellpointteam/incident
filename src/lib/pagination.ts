/**
 * Keyset pagination helpers.
 *
 * Offset pagination breaks at scale: Postgres has to count + skip every
 * preceding row. Keyset (a.k.a. "seek") pagination uses the last-seen
 * sort key as the cursor — O(log n) regardless of page depth.
 *
 * Usage with React Query:
 *   useInfiniteQuery({
 *     queryFn: ({ pageParam }) => fetchPage(pageParam),
 *     getNextPageParam: (last) => last.nextCursor,
 *     initialPageParam: null,
 *   })
 */

export interface KeysetPage<T, C> {
  rows: T[];
  nextCursor: C | null;
}

/** Encode a (date, id) tuple as a single cursor string. */
export function encodeDateIdCursor(date: string, id: string): string {
  return `${date}|${id}`;
}

export function decodeDateIdCursor(
  cursor: string | null | undefined,
): { date: string; id: string } | null {
  if (!cursor) return null;
  const [date, id] = cursor.split("|");
  if (!date || !id) return null;
  return { date, id };
}
