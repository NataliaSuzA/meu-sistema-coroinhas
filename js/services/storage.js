/**
 * Camada de persistência abstrata baseada em localStorage (v5).
 * Suporte a Contas Familiares (irmãos), Aceite de Substituições e Liturgia Paulus.
 */

const NAMESPACE = 'psta_gestao_v5';

export const COLLECTIONS = {
  PASTORALS: 'pastorals',
  LOCATIONS: 'locations',
  CELEBRATION_TYPES: 'celebration_types',
  USERS: 'users',
  ROLES: 'roles',
  SCHEDULES: 'schedules',
  EVENTS: 'events',
  NOTES: 'notes',
  FORMS: 'forms',
  RESPONSES: 'responses',
  NOTICES: 'notices',
  NOTIFICATIONS: 'notifications',
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
