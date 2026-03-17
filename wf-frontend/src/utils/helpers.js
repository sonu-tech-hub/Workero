/**
 * Shared utility helpers – mirrors backend logic for client-side previews
 */

// ── Commission calculator (mirrors backend helpers.js) ────────
// Platform commission 10%, Trust & Safety 2%
// GST 18% on (commission + trust fee)
export const calculateCommission = (amount) => {
  const platformComm  = amount * 0.10;
  const trustFee      = amount * 0.02;
  const gst           = (platformComm + trustFee) * 0.18;
  const workerPayout  = amount - platformComm - trustFee;
  return {
    job_amount:        round2(amount),
    platform_fee:      round2(platformComm),
    trust_safety_fee:  round2(trustFee),
    gst_amount:        round2(gst),
    total_deductions:  round2(platformComm + trustFee),
    worker_payout:     round2(workerPayout),
    seeker_total:      round2(amount + gst),
  };
};

const round2 = (n) => Math.round(n * 100) / 100;

// ── Haversine distance (km) ───────────────────────────────────
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return round2(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ── Date formatters ───────────────────────────────────────────
export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const timeAgo = (d) => {
  if (!d) return '';
  const secs = Math.floor((Date.now() - new Date(d)) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

// ── Currency formatter ────────────────────────────────────────
export const formatCurrency = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
    : '—';

// ── Parse JSON safely ─────────────────────────────────────────
export const parseJSON = (val, fallback = []) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); }
  catch { return fallback; }
};

// ── Job status helpers ────────────────────────────────────────
export const JOB_STATUSES = ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'];

export const jobStatusColor = (status) => ({
  open:        '#3b82f6',
  assigned:    '#8b5cf6',
  in_progress: '#f59e0b',
  completed:   '#10b981',
  cancelled:   '#ef4444',
  disputed:    '#f97316',
}[status] || '#6b7280');

export const jobStatusLabel = (status) => ({
  open:        'Open',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  disputed:    'Disputed',
}[status] || status);

// ── AI performance tier color ─────────────────────────────────
export const tierColor = (tier) => ({
  Diamond:  '#60a5fa',
  Platinum: '#a78bfa',
  Gold:     '#fbbf24',
  Silver:   '#9ca3af',
  Bronze:   '#b45309',
}[tier] || '#6b7280');

// ── Extract API error message ─────────────────────────────────
export const extractError = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.errors?.[0]?.message ||
  err?.message ||
  'Something went wrong';

// ── Debounce ──────────────────────────────────────────────────
export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
