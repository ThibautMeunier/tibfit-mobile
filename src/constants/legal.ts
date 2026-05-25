// Legal docs URL — pinned to the iOS build number.
// Bump LEGAL_BUILD whenever buildNumber in app.json changes AND the legal
// content was updated for that build. Keep in sync with backend LEGAL_BUILDS.
export const LEGAL_BUILD = 4;

const API_BASE = 'https://api.tibfit.com';

export const PRIVACY_URL = `${API_BASE}/v${LEGAL_BUILD}/privacy`;
export const TERMS_URL = `${API_BASE}/v${LEGAL_BUILD}/terms`;
