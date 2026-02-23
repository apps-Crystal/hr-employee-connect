// =====================================================================
// API Service — Communicates with Google Apps Script Backend
// =====================================================================
// IMPORTANT: After deploying your Apps Script as a Web App,
// paste the Web App URL below.
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL || 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// ─── GET requests ───────────────────────────────────────────────────
async function fetchAPI(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));

    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Failed');
    return data;
}

// ─── POST requests ──────────────────────────────────────────────────
async function postAPI(body) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script needs text/plain for CORS
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Failed');
    return data;
}

// ─── Exported Functions ─────────────────────────────────────────────
export const getEmployees = () => fetchAPI('getEmployees').then(r => r.data);
export const getIssues = () => fetchAPI('getIssues').then(r => r.data);
export const getDashboard = () => fetchAPI('');

export const submitWeek1 = (data) => postAPI({ action: 'submitWeek1', data });
export const submitWeek234 = (data) => postAPI({ action: 'submitWeek234', data });
export const addIssues = (data) => postAPI({ action: 'addIssues', data });
export const updateStatus = (ticketID, status, notes) =>
    postAPI({ action: 'updateStatus', ticketID, status, notes });
