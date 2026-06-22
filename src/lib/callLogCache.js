import { base44 } from '@/api/base44Client';
import { fetchAllCallRecords } from '@/lib/callLogData';

const DB_NAME = 'entic-call-log-cache';
// Bumped from 1 → 3 to migrate past the reverted v2 report-bundle cache format.
const DB_VERSION = 3;
const STORE_NAME = 'cache';
const CACHE_RECORD_KEY = 'latest';
const CACHE_FORMAT = 'raw-v1';
const VERSION_CHECK_MIN_INTERVAL_MS = 5 * 60 * 1000;

/** React Query defaults — cache-only reads; no idle refetching. */
export const CALL_LOG_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  retry: false,
};

let callLogLoadInFlight = null;
let lastVersionCheckAt = 0;
let lastVersionCheckResult = null;

function openCacheDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        return;
      }

      if (event.oldVersion > 0 && event.oldVersion < DB_VERSION) {
        request.transaction.objectStore(STORE_NAME).clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getUserDirectoryVersionSnapshot(users) {
  let userDirectoryUpdatedAt = null;

  for (const user of users) {
    if (user.updated_date && (!userDirectoryUpdatedAt || user.updated_date > userDirectoryUpdatedAt)) {
      userDirectoryUpdatedAt = user.updated_date;
    }
  }

  return {
    userDirectoryUpdatedAt,
    userDirectoryCount: users.length,
  };
}

/**
 * Valid client-side raw cache entry. Rejects the reverted v2 report-bundle format.
 */
export function isValidRawCacheEntry(stored) {
  if (!stored) return false;
  if (stored.report) return false;
  if (stored.cacheFormat && stored.cacheFormat !== CACHE_FORMAT) return false;
  if (!Array.isArray(stored.inbound) || !Array.isArray(stored.outbound)) return false;
  return true;
}

/** Remove stale server-side report bundle query state only. */
export function removeLegacyCallLogQueries(queryClient) {
  queryClient.removeQueries({ queryKey: ['call-log-report'] });
}

/** @deprecated Use removeLegacyCallLogQueries + configureCallLogCacheHits instead. */
export function resetLegacyCallLogQueryState(queryClient) {
  removeLegacyCallLogQueries(queryClient);
  configureCallLogCacheHits(queryClient);
}

export function configureCallLogCacheHits(queryClient) {
  queryClient.setQueryDefaults(['inbound-calls'], CALL_LOG_QUERY_OPTIONS);
  queryClient.setQueryDefaults(['outbound-calls'], CALL_LOG_QUERY_OPTIONS);
  queryClient.setQueryDefaults(['user-directory'], CALL_LOG_QUERY_OPTIONS);
}

function hasCallLogQueryData(queryClient) {
  return (
    Array.isArray(queryClient.getQueryData(['inbound-calls'])) &&
    Array.isArray(queryClient.getQueryData(['outbound-calls']))
  );
}

async function fetchEntityRecordsSafely(fetchFn, fallback = []) {
  try {
    const result = await fetchFn();
    return Array.isArray(result) ? result : fallback;
  } catch (error) {
    console.warn('Call Log version check request failed:', error);
    return fallback;
  }
}

/**
 * Lightweight cache version from ImportJob records, raw call timestamps, and User Directory.
 * Debounced to at most once every few minutes unless forced.
 */
export async function fetchCallLogImportVersion({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastVersionCheckResult && now - lastVersionCheckAt < VERSION_CHECK_MIN_INTERVAL_MS) {
    return lastVersionCheckResult;
  }

  const [
    inboundJobs,
    outboundJobs,
    latestInbound,
    latestOutbound,
    userDirectory,
  ] = await Promise.all([
    fetchEntityRecordsSafely(() =>
      base44.entities.ImportJob.filter({ type: 'inbound', status: 'complete' }, '-completed_at', 1)
    ),
    fetchEntityRecordsSafely(() =>
      base44.entities.ImportJob.filter({ type: 'outbound', status: 'complete' }, '-completed_at', 1)
    ),
    fetchEntityRecordsSafely(() =>
      base44.entities.InboundCallRaw.filter({}, '-updated_date', 1)
    ),
    fetchEntityRecordsSafely(() =>
      base44.entities.OutboundCallRaw.filter({}, '-updated_date', 1)
    ),
    fetchEntityRecordsSafely(() => base44.entities.UserDirectory.list()),
  ]);

  const { userDirectoryUpdatedAt, userDirectoryCount } = getUserDirectoryVersionSnapshot(userDirectory);

  lastVersionCheckAt = now;
  lastVersionCheckResult = {
    inboundJobId: inboundJobs[0]?.id ?? null,
    inboundCompletedAt: inboundJobs[0]?.completed_at ?? latestInbound[0]?.updated_date ?? null,
    outboundJobId: outboundJobs[0]?.id ?? null,
    outboundCompletedAt: outboundJobs[0]?.completed_at ?? latestOutbound[0]?.updated_date ?? null,
    userDirectoryUpdatedAt,
    userDirectoryCount,
  };

  return lastVersionCheckResult;
}

export function callLogImportVersionsMatch(storedVersion, currentVersion) {
  if (!storedVersion || !currentVersion) return false;

  return (
    storedVersion.inboundJobId === currentVersion.inboundJobId &&
    storedVersion.inboundCompletedAt === currentVersion.inboundCompletedAt &&
    storedVersion.outboundJobId === currentVersion.outboundJobId &&
    storedVersion.outboundCompletedAt === currentVersion.outboundCompletedAt &&
    storedVersion.userDirectoryUpdatedAt === currentVersion.userDirectoryUpdatedAt &&
    storedVersion.userDirectoryCount === currentVersion.userDirectoryCount
  );
}

export async function loadCallLogCache() {
  try {
    const db = await openCacheDb();
    const stored = await idbGet(db, CACHE_RECORD_KEY);

    if (stored && !isValidRawCacheEntry(stored)) {
      console.warn('Clearing incompatible Call Log cache entry (legacy report-bundle format).');
      await idbDelete(db, CACHE_RECORD_KEY);
      return null;
    }

    return stored;
  } catch (error) {
    console.warn('Unable to read Call Log cache:', error);
    return null;
  }
}

export async function saveCallLogCache(cachePayload) {
  try {
    const db = await openCacheDb();
    await idbPut(db, CACHE_RECORD_KEY, {
      ...cachePayload,
      cacheFormat: CACHE_FORMAT,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Large datasets can exceed IndexedDB quota — cache is optional.
    console.warn('Unable to save Call Log cache:', error);
  }
}

export async function clearCallLogCache() {
  try {
    const db = await openCacheDb();
    await idbDelete(db, CACHE_RECORD_KEY);
  } catch (error) {
    console.warn('Unable to clear Call Log cache:', error);
  }
}

export function applyCallLogCacheToQueries(queryClient, cache) {
  if (Array.isArray(cache?.inbound)) {
    queryClient.setQueryData(['inbound-calls'], cache.inbound);
  }
  if (Array.isArray(cache?.outbound)) {
    queryClient.setQueryData(['outbound-calls'], cache.outbound);
  }
  if (Array.isArray(cache?.users)) {
    queryClient.setQueryData(['user-directory'], cache.users);
  }
}

export async function fetchFullCallLogBundle() {
  const [inbound, outbound, users] = await Promise.all([
    fetchAllCallRecords(base44.entities.InboundCallRaw),
    fetchAllCallRecords(base44.entities.OutboundCallRaw),
    base44.entities.UserDirectory.list(),
  ]);

  return { inbound, outbound, users };
}

async function refreshCallLogBundle(queryClient, importVersion) {
  const bundle = await fetchFullCallLogBundle();
  applyCallLogCacheToQueries(queryClient, bundle);
  await saveCallLogCache({ ...bundle, importVersion });
  configureCallLogCacheHits(queryClient);
  return bundle;
}

function runExclusiveCallLogLoad(task) {
  if (callLogLoadInFlight) {
    return callLogLoadInFlight;
  }

  callLogLoadInFlight = (async () => {
    try {
      return await task();
    } finally {
      callLogLoadInFlight = null;
    }
  })();

  return callLogLoadInFlight;
}

/**
 * Load call log data once on page open. Uses IndexedDB or in-memory cache when available;
 * otherwise fetches a single full bundle from the backend.
 */
export async function syncCallLogReportData(queryClient, { onStatus } = {}) {
  return runExclusiveCallLogLoad(async () => {
    const setStatus = (status) => {
      if (onStatus) onStatus(status);
    };

    removeLegacyCallLogQueries(queryClient);
    configureCallLogCacheHits(queryClient);

    if (hasCallLogQueryData(queryClient)) {
      setStatus('ready');
      return;
    }

    const stored = await loadCallLogCache();
    if (isValidRawCacheEntry(stored)) {
      applyCallLogCacheToQueries(queryClient, stored);
      configureCallLogCacheHits(queryClient);
      setStatus('ready');
      return;
    }

    setStatus('loading');

    try {
      const importVersion = await fetchCallLogImportVersion({ force: true });
      await refreshCallLogBundle(queryClient, importVersion);
      setStatus('ready');
    } catch (error) {
      console.error('Call Log initial load failed:', error);
      setStatus('error');
      throw error;
    }
  });
}

/** Force a full backend refresh (manual refresh or post-CDR import). */
export async function forceRefreshCallLogData(queryClient) {
  return runExclusiveCallLogLoad(async () => {
    removeLegacyCallLogQueries(queryClient);
    configureCallLogCacheHits(queryClient);
    await clearCallLogCache();

    const importVersion = await fetchCallLogImportVersion({ force: true });
    return refreshCallLogBundle(queryClient, importVersion);
  });
}
