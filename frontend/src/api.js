/**
 * api.js — Centralized API client
 *
 * All requests go through fetch('/api/...').
 * In dev, Vite proxies /api → http://localhost:5000.
 * In production, same origin.
 */

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();

  if (!json.success) {
    const err = new Error(json.error?.message || 'Request failed');
    err.code   = json.error?.code;
    err.fields = json.error?.fields;
    err.status = res.status;
    throw err;
  }
  return json;
}

/* ── Ticket endpoints ─────────────────────────────────────── */

export const ticketsApi = {
  /**
   * GET /api/tickets
   * @param {{ status?:string, search?:string, page?:number, limit?:number }} params
   */
  list(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.page)   qs.set('page',   params.page);
    if (params.limit)  qs.set('limit',  params.limit);
    const query = qs.toString() ? `?${qs}` : '';
    return request('GET', `/tickets${query}`);
  },

  /** GET /api/tickets/:ticket_id */
  get(ticketId) {
    return request('GET', `/tickets/${encodeURIComponent(ticketId)}`);
  },

  /**
   * POST /api/tickets
   * @param {{ customer_name, customer_email, subject, description }} body
   */
  create(body) {
    return request('POST', '/tickets', body);
  },

  /**
   * PUT /api/tickets/:ticket_id
   * @param {string} ticketId
   * @param {{ status?:string, note?:string }} body
   */
  update(ticketId, body) {
    return request('PUT', `/tickets/${encodeURIComponent(ticketId)}`, body);
  },
};
