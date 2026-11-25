/**
 * Camada de persistência abstrata baseada em localStorage (v3).
 * Estruturada por coleções para futura migração direta ao Firebase Auth / Firestore.
 */

const NAMESPACE = 'psta_gestao_v3';

export const COLLECTIONS = {
  PASTORALS: 'pastorals',
  USERS: 'users',
  ROLES: 'roles',
  SCHEDULES: 'schedules',
  EVENTS: 'events',
  NOTES: 'notes',
  FORMS: 'forms',
  RESPONSES: 'responses',
  NOTICES: 'notices',
  ATTENDANCE: 'attendance',
  PERMISSIONS: 'permissions',
  BIRTHDAY_MESSAGES: 'birthday_messages',
  SETTINGS: 'settings',
  SESSION: 'session',
};

function keyOf(collection) {
  return `${NAMESPACE}:${collection}`;
}

export const storageAdapter = {
  hasSeeded() {
    return localStorage.getItem(`${NAMESPACE}:seeded`) === 'true';
  },

  markSeeded() {
    localStorage.setItem(`${NAMESPACE}:seeded`, 'true');
  },

  getCollection(collection, fallback = []) {
    try {
      const raw = localStorage.getItem(keyOf(collection));
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[Storage] Erro ao ler coleção "${collection}":`, err);
      return fallback;
    }
  },

  saveCollection(collection, data) {
    try {
      localStorage.setItem(keyOf(collection), JSON.stringify(data));
      return true;
    } catch (err) {
      console.error(`[Storage] Erro ao salvar coleção "${collection}":`, err);
      return false;
    }
  },

  getDocument(collection, fallback = null) {
    return this.getCollection(collection, fallback);
  },

  saveDocument(collection, doc) {
    return this.saveCollection(collection, doc);
  },

  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${NAMESPACE}:`))
      .forEach((k) => localStorage.removeItem(k));
  },
};
