/**
 * Adaptador de Persistência em Tempo Real — Cloud Firestore (`onSnapshot`)
 * Projeto: paroquia-santa-teresa-avila
 *
 * Coleções oficiais no Cloud Firestore:
 *  - users (com array `integrantes` para Contas Familiares / irmãos)
 *  - pastorais
 *  - funcoes (vinculadas a `pastoralId`)
 *  - locais
 *  - tiposCelebracao
 *  - escalas (com liturgia da Paulus, Oração Eucarística, `roteiroCelebrante` e substituições)
 *  - eventos
 *  - formularios
 *  - respostas
 *  - presencas (um documento por celebração/evento contendo mapa `records`)
 *  - notas
 *  - avisos
 *  - aniversariosParabens
 *  - notificacoes
 *  - configuracoes (documentos `permissoes` e `geral`)
 */

import {
  collection,
  db,
  deleteDoc,
  doc,
  firebaseConfig,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  writeBatch,
} from './firebaseConfig.js';

export const COLLECTIONS = {
  PASTORALS: 'pastorais',
  LOCATIONS: 'locais',
  CELEBRATION_TYPES: 'tiposCelebracao',
  USERS: 'users',
  ROLES: 'funcoes',
  SCHEDULES: 'escalas',
  SUBSTITUTIONS: 'substituicoes',
  EVENTS: 'eventos',
  NOTES: 'notas',
  FORMS: 'formularios',
  RESPONSES: 'respostas',
  NOTICES: 'avisos',
  NOTIFICATIONS: 'notificacoes',
  ATTENDANCE: 'presencas',
  BIRTHDAY_MESSAGES: 'aniversariosParabens',
  CONFIG: 'configuracoes',
};

const LIST_COLLECTIONS = [
  COLLECTIONS.PASTORALS,
  COLLECTIONS.LOCATIONS,
  COLLECTIONS.CELEBRATION_TYPES,
  COLLECTIONS.USERS,
  COLLECTIONS.ROLES,
  COLLECTIONS.SCHEDULES,
  COLLECTIONS.SUBSTITUTIONS,
  COLLECTIONS.EVENTS,
  COLLECTIONS.NOTES,
  COLLECTIONS.FORMS,
  COLLECTIONS.RESPONSES,
  COLLECTIONS.NOTICES,
  COLLECTIONS.NOTIFICATIONS,
  COLLECTIONS.BIRTHDAY_MESSAGES,
];

const SESSION_KEY = 'psta_firebase_session_uid';

// Cache reativo mantido sempre sincronizado em tempo real pelo onSnapshot
const cache = {
  lists: Object.fromEntries(LIST_COLLECTIONS.map((c) => [c, []])),
  attendance: {},
  permissions: null,
  settings: null,
};

let unsubscribers = [];
let initialized = false;
let connected = false;
let realtimeCallback = null;
let notifyTimer = null;
let pendingWriteCount = 0;

/**
 * Remove recursivamente propriedades `undefined` (que o Firestore rejeita).
 */
function sanitizeForFirestore(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item));
  }
  const clean = {};
  Object.entries(value).forEach(([k, v]) => {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  });
  return clean;
}

/**
 * Normaliza documentos vindos do Firestore garantindo compatibilidade entre
 * os campos em português (`integrantes`, `roteiroCelebrante`) e a camada de UI.
 */
function normalizeFromFirestore(colName, docId, data) {
  const item = { ...data, id: data.id || docId };
  if (colName === COLLECTIONS.USERS) {
    const rawMembers = Array.isArray(item.integrantes) && item.integrantes.length > 0
      ? item.integrantes
      : Array.isArray(item.familyMembers) && item.familyMembers.length > 0
        ? item.familyMembers
        : [{ id: item.id, name: item.name || '', birthDate: item.birthDate || '', pastoralId: '' }];
    const members = rawMembers.map((m) => ({
      id: m.id || item.id,
      name: m.name || item.name || '',
      birthDate: m.birthDate || '',
      pastoralId: m.pastoralId || '',
    }));
    item.integrantes = members;
    item.familyMembers = members;
  } else if (colName === COLLECTIONS.SCHEDULES) {
    const script = item.roteiroCelebrante ?? item.celebrantScript ?? '';
    item.roteiroCelebrante = script;
    item.celebrantScript = script;
  }
  return item;
}

function normalizeForFirestore(colName, data) {
  const payload = { ...data };
  if (colName === COLLECTIONS.USERS) {
    const members = Array.isArray(payload.familyMembers) && payload.familyMembers.length > 0
      ? payload.familyMembers
      : Array.isArray(payload.integrantes) && payload.integrantes.length > 0
        ? payload.integrantes
        : [{ id: payload.id, name: payload.name || '', birthDate: payload.birthDate || '' }];
    payload.integrantes = members;
    payload.familyMembers = members;
  } else if (colName === COLLECTIONS.SCHEDULES) {
    const script = String(payload.celebrantScript ?? payload.roteiroCelebrante ?? '').trim();
    payload.roteiroCelebrante = script;
    payload.celebrantScript = script;
  }
  return sanitizeForFirestore(payload);
}

function scheduleRealtimeNotify() {
  if (!initialized || typeof realtimeCallback !== 'function') return;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    realtimeCallback?.();
  }, 120);
}

function trackWrite(promise) {
  pendingWriteCount += 1;
  return promise
    .catch((err) => {
      console.warn('[Firestore] Erro ao persistir operação:', err?.message || err);
    })
    .finally(() => {
      pendingWriteCount = Math.max(0, pendingWriteCount - 1);
    });
}

export const storageAdapter = {
  getSyncStatus() {
    return {
      connected,
      initialized,
      projectId: firebaseConfig.projectId,
      pendingWrites: pendingWriteCount,
    };
  },

  getSessionUserId() {
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  },

  setSessionUserId(uid) {
    try {
      if (uid) localStorage.setItem(SESSION_KEY, uid);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignora restrições de storage
    }
  },

  /**
   * Conecta ao Cloud Firestore, executa o Seed Inicial automaticamente
   * somente na primeira vez em que o banco estiver vazio e inicia listeners
   * em tempo real (`onSnapshot`) em todas as coleções.
   */
  async initRealtime(buildSeedFn, onRealtimeUpdate) {
    realtimeCallback = onRealtimeUpdate;
    if (initialized && connected) return;

    // 1. Verifica se o banco já possui dados (evita sobrescrever dados reais!)
    const geralRef = doc(db, COLLECTIONS.CONFIG, 'geral');
    const [geralSnap, pastoralsSnap] = await Promise.all([
      getDoc(geralRef),
      getDocs(query(collection(db, COLLECTIONS.PASTORALS), limit(1))),
    ]);

    const alreadySeeded =
      (geralSnap.exists() && Boolean(geralSnap.data()?.seeded)) || !pastoralsSnap.empty;

    if (!alreadySeeded) {
      const seed = buildSeedFn();
      await this.seedFirestoreBatch(seed);
    }

    // 2. Inicia listeners em tempo real (`onSnapshot`) para todas as coleções e configurações
    this.detachListeners();

    const totalStreams = LIST_COLLECTIONS.length + 3; // listas + presencas + permissoes + geral
    let loadedCount = 0;

    await new Promise((resolve) => {
      let resolved = false;
      const markReady = () => {
        loadedCount += 1;
        if (!resolved && loadedCount >= totalStreams) {
          resolved = true;
          connected = true;
          initialized = true;
          resolve();
        }
      };

      // Segurança para nunca travar o boot caso algum stream atrase
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          connected = true;
          initialized = true;
          resolve();
        }
      }, 9000);

      LIST_COLLECTIONS.forEach((colName) => {
        let firstFire = true;
        const unsub = onSnapshot(
          collection(db, colName),
          (snapshot) => {
            cache.lists[colName] = snapshot.docs.map((d) =>
              normalizeFromFirestore(colName, d.id, d.data()),
            );
            if (firstFire) {
              firstFire = false;
              markReady();
            } else {
              scheduleRealtimeNotify();
            }
          },
          () => {
            if (firstFire) {
              firstFire = false;
              markReady();
            }
          },
        );
        unsubscribers.push(unsub);
      });

      // Presenças (um documento por celebração/evento)
      let attFirst = true;
      unsubscribers.push(
        onSnapshot(
          collection(db, COLLECTIONS.ATTENDANCE),
          (snapshot) => {
            const map = {};
            snapshot.docs.forEach((d) => {
              const data = d.data();
              map[d.id] = data?.records ? { ...data.records } : { ...data };
            });
            cache.attendance = map;
            if (attFirst) {
              attFirst = false;
              markReady();
            } else {
              scheduleRealtimeNotify();
            }
          },
          () => {
            if (attFirst) {
              attFirst = false;
              markReady();
            }
          },
        ),
      );

      // Configurações -> Permissões
      let permFirst = true;
      unsubscribers.push(
        onSnapshot(
          doc(db, COLLECTIONS.CONFIG, 'permissoes'),
          (snap) => {
            if (snap.exists()) {
              cache.permissions = snap.data();
            }
            if (permFirst) {
              permFirst = false;
              markReady();
            } else {
              scheduleRealtimeNotify();
            }
          },
          () => {
            if (permFirst) {
              permFirst = false;
              markReady();
            }
          },
        ),
      );

      // Configurações -> Geral
      let setFirst = true;
      unsubscribers.push(
        onSnapshot(
          doc(db, COLLECTIONS.CONFIG, 'geral'),
          (snap) => {
            if (snap.exists()) {
              cache.settings = snap.data();
            }
            if (setFirst) {
              setFirst = false;
              markReady();
            } else {
              scheduleRealtimeNotify();
            }
          },
          () => {
            if (setFirst) {
              setFirst = false;
              markReady();
            }
          },
        ),
      );
    });
  },

  detachListeners() {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {
        // noop
      }
    });
    unsubscribers = [];
    initialized = false;
    connected = false;
  },

  /**
   * Popula o banco Firestore em lote atômico (`writeBatch`) na primeira execução.
   */
  async seedFirestoreBatch(seed) {
    const batch = writeBatch(db);

    const collectionMap = [
      [COLLECTIONS.PASTORALS, seed.pastorals],
      [COLLECTIONS.LOCATIONS, seed.locations],
      [COLLECTIONS.CELEBRATION_TYPES, seed.celebrationTypes],
      [COLLECTIONS.USERS, seed.users],
      [COLLECTIONS.ROLES, seed.roles],
      [COLLECTIONS.SCHEDULES, seed.schedules],
      [COLLECTIONS.EVENTS, seed.events],
      [COLLECTIONS.NOTES, seed.notes],
      [COLLECTIONS.FORMS, seed.forms],
      [COLLECTIONS.RESPONSES, seed.responses],
      [COLLECTIONS.NOTICES, seed.notices],
      [COLLECTIONS.NOTIFICATIONS, seed.notifications],
      [COLLECTIONS.BIRTHDAY_MESSAGES, seed.birthdayMessages],
    ];

    collectionMap.forEach(([colName, items]) => {
      (items || []).forEach((item) => {
        const ref = doc(db, colName, item.id);
        batch.set(ref, normalizeForFirestore(colName, item));
      });
    });

    Object.entries(seed.attendance || {}).forEach(([sessionId, records]) => {
      const ref = doc(db, COLLECTIONS.ATTENDANCE, sessionId);
      batch.set(ref, sanitizeForFirestore({ records }));
    });

    batch.set(
      doc(db, COLLECTIONS.CONFIG, 'permissoes'),
      sanitizeForFirestore(seed.permissions),
    );
    batch.set(
      doc(db, COLLECTIONS.CONFIG, 'geral'),
      sanitizeForFirestore({
        ...seed.settings,
        seeded: true,
        seededAt: new Date().toISOString(),
      }),
    );

    await batch.commit();
  },

  // --- Leituras síncronas a partir do cache reativo do onSnapshot ---
  getCollection(colName) {
    return cache.lists[colName] || [];
  },

  getAttendanceMap() {
    return cache.attendance || {};
  },

  getPermissionsDoc() {
    return cache.permissions;
  },

  getSettingsDoc() {
    return cache.settings;
  },

  // --- Escritas otimistas + persistência real no Cloud Firestore ---
  upsertDoc(colName, item) {
    const clean = normalizeForFirestore(colName, item);
    const list = cache.lists[colName] || [];
    const idx = list.findIndex((x) => x.id === clean.id);
    if (idx >= 0) {
      list[idx] = clean;
    } else {
      list.push(clean);
    }
    cache.lists[colName] = list;
    trackWrite(setDoc(doc(db, colName, clean.id), clean));
    return clean;
  },

  removeDoc(colName, id) {
    cache.lists[colName] = (cache.lists[colName] || []).filter((x) => x.id !== id);
    trackWrite(deleteDoc(doc(db, colName, id)));
  },

  saveConfigDoc(docId, data) {
    const clean = sanitizeForFirestore(data);
    if (docId === 'permissoes') cache.permissions = clean;
    if (docId === 'geral') cache.settings = clean;
    trackWrite(setDoc(doc(db, COLLECTIONS.CONFIG, docId), clean, { merge: true }));
    return clean;
  },

  setAttendanceStatus(sessionId, participantId, status) {
    if (!cache.attendance[sessionId]) cache.attendance[sessionId] = {};
    cache.attendance[sessionId][participantId] = status;
    trackWrite(
      setDoc(
        doc(db, COLLECTIONS.ATTENDANCE, sessionId),
        sanitizeForFirestore({ records: cache.attendance[sessionId] }),
        { merge: true },
      ),
    );
    return cache.attendance;
  },

  /**
   * Executa múltiplas operações atômicas no Firestore (ex: notificações em lote,
   * remoção em cascata ou aceite de substituição).
   */
  runBatch(ops) {
    if (!Array.isArray(ops) || ops.length === 0) return;
    const batch = writeBatch(db);
    ops.forEach((op) => {
      if (op.type === 'set') {
        const clean = normalizeForFirestore(op.collection, op.data);
        const list = cache.lists[op.collection] || [];
        const idx = list.findIndex((x) => x.id === clean.id);
        if (idx >= 0) list[idx] = clean;
        else list.unshift(clean);
        cache.lists[op.collection] = list;
        batch.set(doc(db, op.collection, clean.id), clean);
      } else if (op.type === 'delete') {
        cache.lists[op.collection] = (cache.lists[op.collection] || []).filter(
          (x) => x.id !== op.id,
        );
        batch.delete(doc(db, op.collection, op.id));
      }
    });
    trackWrite(batch.commit());
  },

  /**
   * Executa uma transação atômica real no Cloud Firestore (`runTransaction`) em um documento,
   * garantindo segurança contra concorrência (ex: dois voluntários clicando na última vaga aberta).
   */
  async runDocTransaction(colName, docId, updaterFn) {
    const ref = doc(db, colName, docId);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('Documento não encontrado no Firestore.');
      }
      const current = normalizeFromFirestore(colName, snap.id, snap.data());
      const outcome = updaterFn(current);
      if (!outcome || !outcome.ok) {
        return outcome || { ok: false, error: 'Operação cancelada.' };
      }
      const clean = normalizeForFirestore(colName, outcome.data);
      tx.set(ref, clean);
      return { ...outcome, data: clean };
    });

    if (result?.ok && result.data) {
      const list = cache.lists[colName] || [];
      const idx = list.findIndex((x) => x.id === result.data.id);
      if (idx >= 0) list[idx] = result.data;
      else list.push(result.data);
      cache.lists[colName] = list;
    }
    return result;
  },
};
