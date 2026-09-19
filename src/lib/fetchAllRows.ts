/**
 * Paged fetch helper.
 *
 * PostgREST caps unpaginated responses at 1000 rows. Any table that can grow
 * past that (kia_soldiers, militant_casualties, ...) must be read in pages,
 * otherwise the tail of the dataset silently disappears from the UI and
 * creates fake KIA/registry discrepancies.
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}
