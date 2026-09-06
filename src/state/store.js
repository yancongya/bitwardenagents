/**
 * Central shared state for the vault app.
 * Extracted from app.js — single source of truth, mutated in place via setters.
 *
 * Note: kept as plain mutable module state (not a reactive store) to match
 * the existing imperative rendering model. Views re-render explicitly.
 */

// --- Auth / data state ---
export const state = {
  client: null,
  symmetricKey: null,
  vaultData: null,
  allDecryptedCiphers: [],
  allDecryptedTrash: [],
  analysisResult: null,
  healthResult: null,
  folderMap: {},
  folderList: [],          // { id, name } sorted
  currentAuthMode: 'apikey',
  currentView: 'overview',
  selectedFolderId: null,  // for folder view filtering
  activeFilters: new Set(),
  searchQuery: '',
  sortId: 'name-asc',
  selectedItems: new Set(),
  isDemoMode: false,
  isMergeLocked: false,    // Lock to prevent concurrent merge operations
  deadUrlItems: [],        // Items whose URLs failed liveness check
  deadUrlCheckDone: false, // Whether the check has completed
  deadUrlCheckProgress: { checked: 0, total: 0 },
};

// --- DOM helpers ---
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// --- Item type metadata ---
export const TYPE_META = {
  1: { view: 'type-login', icon: '🔐', key: 'type.login' },
  2: { view: 'type-note', icon: '📝', key: 'type.note' },
  3: { view: 'type-card', icon: '💳', key: 'type.card' },
  4: { view: 'type-identity', icon: '🪪', key: 'type.identity' },
  5: { view: 'type-sshkey', icon: '🔑', key: 'type.sshkey' },
};

export const VIEW_TYPE_ID = {
  'type-login': 1,
  'type-note': 2,
  'type-card': 3,
  'type-identity': 4,
  'type-sshkey': 5,
};

// --- Type helpers (i18n function `t` injected to avoid circular import) ---
import { t } from '../i18n.js';

export function typeName(typeId) {
  return t(TYPE_META[typeId]?.key || 'type.item');
}

export function typeTitle(typeId) {
  const meta = TYPE_META[typeId];
  return meta ? `${meta.icon} ${typeName(typeId)}` : t('type.item');
}
