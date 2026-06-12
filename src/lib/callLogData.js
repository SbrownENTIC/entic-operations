/**
 * Paginate through all call log records, avoiding Base44 default list/filter limits.
 * Uses skip += batch.length so partial API page sizes still advance correctly.
 */
export async function fetchAllCallRecords(entity) {
  const allRows = [];
  const batchSize = 5000;
  let skip = 0;

  while (true) {
    const batch = await entity.filter({}, '-updated_date', batchSize, skip);
    if (!batch || batch.length === 0) break;

    allRows.push(...batch);
    skip += batch.length;
  }

  return allRows;
}
