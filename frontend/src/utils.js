/**
 * utils.js — Shared formatting & helper utilities
 */

/** Format an ISO timestamp to a human-readable local date/time */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/** Map a status string to its CSS class suffix */
export function statusClass(status) {
  if (status === 'Open')        return 'open';
  if (status === 'In Progress') return 'progress';
  if (status === 'Closed')      return 'closed';
  return 'open';
}

/** Return a short label for the status */
export function statusLabel(status) {
  return status || 'Unknown';
}

/** Simple debounce */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
