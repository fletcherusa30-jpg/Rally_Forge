const STORAGE_KEY = 'rf_scanner_activity_v1';
const MAX_ITEMS = 300;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAll() {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  if (!canUseStorage()) return;
  const normalized = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('rf-scanner-activity-changed'));
}

export function listScannerActivities(filters = {}) {
  const statusFilter = String(filters.status || '').toLowerCase();
  const scannerFilter = String(filters.scannerType || '').toLowerCase();

  return readAll()
    .filter((item) => {
      if (statusFilter && String(item?.status || '').toLowerCase() !== statusFilter) return false;
      if (scannerFilter && String(item?.scannerType || '').toLowerCase() !== scannerFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime());
}

export function startScannerActivity({ scannerType, fileName, message, batchId } = {}) {
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const next = {
    id,
    scannerType: scannerType || 'unknown-scanner',
    fileName: fileName || 'Unnamed document',
    batchId: batchId || null,
    status: 'queued',
    progress: 0,
    message: message || 'Queued for processing',
    startedAt: now,
    updatedAt: now,
  };

  const items = [next, ...readAll()];
  writeAll(items);
  return id;
}

export function updateScannerActivity(id, patch = {}) {
  if (!id) return;
  const items = readAll();
  const index = items.findIndex((item) => item?.id === id);
  if (index < 0) return;

  const updated = {
    ...items[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  items[index] = updated;
  writeAll(items);
}

export function clearScannerActivities({ status } = {}) {
  const statusFilter = String(status || '').toLowerCase();
  if (!statusFilter) {
    writeAll([]);
    return;
  }

  const next = readAll().filter((item) => String(item?.status || '').toLowerCase() !== statusFilter);
  writeAll(next);
}
