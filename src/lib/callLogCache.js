import { base44 } from '@/api/base44Client';

const DB_NAME = 'entic-call-log-cache';
// Bumped to 4 — retire full-dataset IndexedDB raw cache (caused timeouts on large imports).
const DB_VERSION = 4;
const STORE_NAME = 'cache';
const CACHE_RECORD_KEY = 'latest';

/** React Query defaults for User Directory (small, load once). */
export const CALL_LOG_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  retry: false,
};

/** React Query defaults for date-range call log fetches. */
export const CALL_LOG_PERIOD_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  retry: false,
};

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

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
  queryClient.setQueryDefaults(['inbound-calls'], CALL_LOG_PERIOD_QUERY_OPTIONS);
  queryClient.setQueryDefaults(['outbound-calls'], CALL_LOG_PERIOD_QUERY_OPTIONS);
  queryClient.setQueryDefaults(['user-directory'], CALL_LOG_QUERY_OPTIONS);
  queryClient.setQueryDefaults(['call-log-monthly-kpi-inbound'], CALL_LOG_PERIOD_QUERY_OPTIONS);
}

/** Clear legacy IndexedDB raw cache (e.g. after CDR import). */
export async function clearCallLogCache() {
  try {
    const db = await openCacheDb();
    await idbDelete(db, CACHE_RECORD_KEY);
  } catch (error) {
    console.warn('Unable to clear Call Log cache:', error);
  }
}

/** Prefetch User Directory only — call records are loaded per reporting period. */
export async function syncCallLogReportData(queryClient, { onStatus } = {}) {
  const setStatus = (status) => {
    if (onStatus) onStatus(status);
  };

  removeLegacyCallLogQueries(queryClient);
  configureCallLogCacheHits(queryClient);

  if (Array.isArray(queryClient.getQueryData(['user-directory']))) {
    setStatus('ready');
    return;
  }

  setStatus('loading');

  try {
    const users = await base44.entities.UserDirectory.list();
    queryClient.setQueryData(['user-directory'], users);
    setStatus('ready');
  } catch (error) {
    console.error('Call Log user directory load failed:', error);
    setStatus('error');
    throw error;
  }
}

/** Refetch active call log queries after manual refresh or CDR import. */
export async function forceRefreshCallLogData(queryClient) {
  removeLegacyCallLogQueries(queryClient);
  configureCallLogCacheHits(queryClient);
  await clearCallLogCache();

  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['user-directory'] }),
    queryClient.refetchQueries({ queryKey: ['inbound-calls'] }),
    queryClient.refetchQueries({ queryKey: ['outbound-calls'] }),
    queryClient.refetchQueries({ queryKey: ['call-log-monthly-kpi-inbound'] }),
  ]);
}
