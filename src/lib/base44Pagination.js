/**
 * Paginate through all entity records via list(), avoiding Base44 default page limits.
 * Uses skip += batch.length so partial API page sizes still advance correctly.
 */
export async function fetchAllEntityRecords(entity, sort) {
  const allRows = [];
  const batchSize = 5000;
  let skip = 0;

  while (true) {
    const batch = await entity.list(sort, batchSize, skip);
    if (!batch || batch.length === 0) break;

    allRows.push(...batch);
    skip += batch.length;
  }

  return allRows;
}
