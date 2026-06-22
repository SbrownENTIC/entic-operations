import { base44 } from '@/api/base44Client';
import { fetchAllCallRecords } from '@/lib/callLogData';

const DB_NAME = 'entic-call-log-cache';
// Bumped from 1 → 3 to migrate past the reverted v2 report-bundle cache format.
const DB_VERSION = 3;
const STORE_NAME = 'cache';
const CACHE_RECORD_KEY = 'latest';
const CACHE_FORMAT = 'raw-v1';

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

/**
 * Remove stale server-side report bundle query state left from the reverted optimization.
 */
export function resetLegacyCallLogQueryState(queryClient) {
  queryClient.removeQueries({ queryKey: ['call-log-report'] });
}

/**
 * Lightweight cache version from ImportJob records, raw call timestamps, and User Directory.
 * Falls back to newest raw record updated_date when no completed job exists.
 * User Directory count + latest updated_date detect extension mapping edits and deletions.
 */
export async function fetchCallLogImportVersion() {
  const [inboundJobs, outboundJobs, latestInbound, latestOutbound, userDirectory] = await Promise.all([
    base44.entities.ImportJob.filter({ type: 'inbound', status: 'complete' }, '-completed_at', 1),
    base44.entities.ImportJob.filter({ type: 'outbound', status: 'complete' }, '-completed_at', 1),
    base44.entities.InboundCallRaw.filter({}, '-updated_date', 1),
    base44.entities.OutboundCallRaw.filter({}, '-updated_date', 1),
    base44.entities.UserDirectory.list(),
  ]);

  const { userDirectoryUpdatedAt, userDirectoryCount } = getUserDirectoryVersionSnapshot(userDirectory);

  return {
    inboundJobId: inboundJobs[0]?.id ?? null,
    inboundCompletedAt: inboundJobs[0]?.completed_at ?? latestInbound[0]?.updated_date ?? null,
    outboundJobId: outboundJobs[0]?.id ?? null,
    outboundCompletedAt: outboundJobs[0]?.completed_at ?? latestOutbound[0]?.updated_date ?? null,
    userDirectoryUpdatedAt,
    userDirectoryCount,
  };
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

export function configureCallLogCacheHits(queryClient) {
  const cacheQueryDefaults = {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };

  queryClient.setQueryDefaults(['inbound-calls'], cacheQueryDefaults);
  queryClient.setQueryDefaults(['outbound-calls'], cacheQueryDefaults);
  queryClient.setQueryDefaults(['user-directory'], cacheQueryDefaults);
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

let syncInFlight = null;

async function refreshCallLogBundle(queryClient, currentVersion) {
  const bundle = await fetchFullCallLogBundle();
  applyCallLogCacheToQueries(queryClient, bundle);
  await saveCallLogCache({ ...bundle, importVersion: currentVersion });
  configureCallLogCacheHits(queryClient);
  return bundle;
}

export async function syncCallLogReportData(queryClient, { onStatus, onReadyToMount } = {}) {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    const setStatus = (status) => {
      if (onStatus) onStatus(status);
    };

    resetLegacyCallLogQueryState(queryClient);
    setStatus('loading');

    try {
      const [stored, currentVersion] = await Promise.all([
        loadCallLogCache(),
        fetchCallLogImportVersion(),
      ]);

      const hasStored = isValidRawCacheEntry(stored);
      const hasMemory = Boolean(
        Array.isArray(queryClient.getQueryData(['inbound-calls'])) &&
        Array.isArray(queryClient.getQueryData(['outbound-calls']))
      );

      if (hasStored) {
        applyCallLogCacheToQueries(queryClient, stored);
        configureCallLogCacheHits(queryClient);
      }

      if (hasStored && callLogImportVersionsMatch(stored.importVersion, currentVersion)) {
        setStatus('ready');
        onReadyToMount?.();
        return;
      }

      const showStaleWhileRefreshing = hasStored || hasMemory;

      if (!showStaleWhileRefreshing) {
        try {
          await refreshCallLogBundle(queryClient, currentVersion);
          setStatus('ready');
          onReadyToMount?.();
        } catch (error) {
          console.error('Call Log initial load failed:', error);
          setStatus('error');
        }
        return;
      }

      setStatus('refreshing');
      onReadyToMount?.();

      try {
        await refreshCallLogBundle(queryClient, currentVersion);
        setStatus('ready');
      } catch (error) {
        console.error('Call Log refresh failed:', error);
        setStatus('ready');
      }
    } catch (error) {
      console.error('Call Log sync failed:', error);
      setStatus('error');
    }
  })();

  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export async function forceRefreshCallLogData(queryClient) {
  resetLegacyCallLogQueryState(queryClient);
  await clearCallLogCache();
  const currentVersion = await fetchCallLogImportVersion();
  return refreshCallLogBundle(queryClient, currentVersion);
}

export async function persistCallLogCacheFromQueries(queryClient) {
  const inbound = queryClient.getQueryData(['inbound-calls']);
  const outbound = queryClient.getQueryData(['outbound-calls']);
  const users = queryClient.getQueryData(['user-directory']);

  if (!Array.isArray(inbound) || !Array.isArray(outbound)) return;

  const importVersion = await fetchCallLogImportVersion();
  await saveCallLogCache({
    inbound,
    outbound,
    users: users ?? [],
    importVersion,
  });
  configureCallLogCacheHits(queryClient);
}
