/**
 * Serviço de domínio multi-pastoral (pronto para futura migração ao Firestore).
 */

import { storageAdapter, COLLECTIONS } from './storage.js';
import { buildSeedData } from './seedData.js';

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const dataService = {
  init() {
    if (!storageAdapter.hasSeeded()) {
      this.resetToDemoData();
    }
  },

  resetToDemoData() {
    const seed = buildSeedData();
    storageAdapter.saveCollection(COLLECTIONS.PASTORALS, seed.pastorals);
    storageAdapter.saveCollection(COLLECTIONS.USERS, seed.users);
    storageAdapter.saveCollection(COLLECTIONS.ROLES, seed.roles);
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, seed.schedules);
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, seed.events);
    storageAdapter.saveCollection(COLLECTIONS.NOTES, seed.notes);
    storageAdapter.saveCollection(COLLECTIONS.FORMS, seed.forms);
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, seed.responses);
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, seed.notices);
    storageAdapter.saveDocument(COLLECTIONS.ATTENDANCE, seed.attendance);
    storageAdapter.saveDocument(COLLECTIONS.SETTINGS, seed.settings);
    storageAdapter.markSeeded();
  },

  // --- Sessão ---
  getSessionUserId() {
    const session = storageAdapter.getDocument(COLLECTIONS.SESSION, null);
    return session?.userId || null;
  },

  setSessionUserId(userId) {
    storageAdapter.saveDocument(COLLECTIONS.SESSION, userId ? { userId } : null);
  },

  // --- Configurações ---
  getSettings() {
    return storageAdapter.getDocument(COLLECTIONS.SETTINGS, {
      instagramUrl: 'https://www.instagram.com/',
      parishName: "Paróquia Santa Teresa d'Ávila",
      subtitle: 'Gestão Pastoral',
    });
  },

  updateSettings(patch) {
    const updated = { ...this.getSettings(), ...patch };
    storageAdapter.saveDocument(COLLECTIONS.SETTINGS, updated);
    return updated;
  },

  // --- Pastorais ---
  getPastorals() {
    return storageAdapter.getCollection(COLLECTIONS.PASTORALS, []);
  },

  getActivePastorals() {
    return this.getPastorals().filter((p) => p.active);
  },

  getPastoralById(id) {
    return this.getPastorals().find((p) => p.id === id) || null;
  },

  savePastoral(pastoral) {
    const list = this.getPastorals();
    if (pastoral.id) {
      const idx = list.findIndex((p) => p.id === pastoral.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...pastoral };
    } else {
      pastoral = { ...pastoral, id: genId('pas') };
      list.push(pastoral);
    }
    storageAdapter.saveCollection(COLLECTIONS.PASTORALS, list);
    return pastoral;
  },

  deletePastoral(id) {
    storageAdapter.saveCollection(COLLECTIONS.PASTORALS, this.getPastorals().filter((p) => p.id !== id));
    storageAdapter.saveCollection(COLLECTIONS.ROLES, this.getRoles().filter((r) => r.pastoralId !== id));
    // Remove vínculos da pastoral excluída nos usuários
    const updatedUsers = this.getUsers().map((u) => ({
      ...u,
      memberships: (u.memberships || []).filter((m) => m.pastoralId !== id),
    }));
    storageAdapter.saveCollection(COLLECTIONS.USERS, updatedUsers);
  },

  // --- Usuários (N:N com Pastorais) ---
  getUsers() {
    return storageAdapter.getCollection(COLLECTIONS.USERS, []);
  },

  getUserById(id) {
    return this.getUsers().find((u) => u.id === id) || null;
  },

  getActiveUsersByPastoral(pastoralId) {
    return this.getUsers().filter(
      (u) => u.status === 'Ativo' && (u.memberships || []).some((m) => m.pastoralId === pastoralId),
    );
  },

  saveUser(user) {
    const list = this.getUsers();
    const cleanMemberships = (user.memberships || []).filter((m) => m.pastoralId && m.role);
    if (user.id) {
      const idx = list.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...user, memberships: cleanMemberships };
      } else {
        list.push({ ...user, memberships: cleanMemberships });
      }
    } else {
      user = { ...user, id: genId('usr'), memberships: cleanMemberships };
      list.push(user);
    }
    storageAdapter.saveCollection(COLLECTIONS.USERS, list);
    return user;
  },

  deleteUser(id) {
    storageAdapter.saveCollection(COLLECTIONS.USERS, this.getUsers().filter((u) => u.id !== id));
  },

  // --- Funções por Pastoral ---
  getRoles() {
    return storageAdapter.getCollection(COLLECTIONS.ROLES, []);
  },

  getRolesByPastoral(pastoralId) {
    return this.getRoles().filter((r) => r.pastoralId === pastoralId);
  },

  getActiveRolesByPastoral(pastoralId) {
    return this.getRoles().filter((r) => r.pastoralId === pastoralId && r.active);
  },

  getRoleById(id) {
    return this.getRoles().find((r) => r.id === id) || null;
  },

  saveRole(role) {
    const list = this.getRoles();
    if (role.id) {
      const idx = list.findIndex((r) => r.id === role.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...role };
    } else {
      role = { ...role, id: genId('role') };
      list.push(role);
    }
    storageAdapter.saveCollection(COLLECTIONS.ROLES, list);
    return role;
  },

  deleteRole(id) {
    storageAdapter.saveCollection(COLLECTIONS.ROLES, this.getRoles().filter((r) => r.id !== id));
  },

  // --- Escalas Multi-Pastoral ---
  getSchedules() {
    return storageAdapter.getCollection(COLLECTIONS.SCHEDULES, []);
  },

  getScheduleById(id) {
    return this.getSchedules().find((s) => s.id === id) || null;
  },

  saveSchedule(schedule) {
    const list = this.getSchedules();
    const normalizedAssignments = (schedule.assignments || []).map((a) => ({
      id: a.id || genId('asg'),
      pastoralId: a.pastoralId || schedule.pastoralId,
      roleId: a.roleId,
      userId: a.userId,
      substitutionRequested: Boolean(a.substitutionRequested),
      substitutionReason: a.substitutionReason || '',
    }));

    const distinctPastorals = Array.from(new Set(normalizedAssignments.map((a) => a.pastoralId).filter(Boolean)));
    const derivedPastoralId = schedule.pastoralId || distinctPastorals[0] || 'pas_coroinhas';

    if (schedule.id) {
      const idx = list.findIndex((s) => s.id === schedule.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...schedule, pastoralId: derivedPastoralId, assignments: normalizedAssignments };
      }
    } else {
      schedule = { ...schedule, id: genId('sch'), pastoralId: derivedPastoralId, assignments: normalizedAssignments };
      list.push(schedule);
    }
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);
    return schedule;
  },

  deleteSchedule(id) {
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, this.getSchedules().filter((s) => s.id !== id));
  },

  requestSubstitution(scheduleId, assignmentId, reason) {
    const list = this.getSchedules();
    const sch = list.find((s) => s.id === scheduleId);
    if (!sch) return null;
    const asg = sch.assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;
    asg.substitutionRequested = true;
    asg.substitutionReason = reason.trim();
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);
    return sch;
  },

  reassignScheduleMember(scheduleId, assignmentId, newUserId) {
    const list = this.getSchedules();
    const sch = list.find((s) => s.id === scheduleId);
    if (!sch) return null;
    const asg = sch.assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;
    asg.userId = newUserId;
    asg.substitutionRequested = false;
    asg.substitutionReason = '';
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);
    return sch;
  },

  // --- Eventos da Agenda ---
  getEvents() {
    return storageAdapter.getCollection(COLLECTIONS.EVENTS, []);
  },

  saveEvent(evt) {
    const list = this.getEvents();
    if (evt.id) {
      const idx = list.findIndex((e) => e.id === evt.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...evt };
    } else {
      evt = { ...evt, id: genId('evt') };
      list.push(evt);
    }
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, list);
    return evt;
  },

  deleteEvent(id) {
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, this.getEvents().filter((e) => e.id !== id));
  },

  // --- Bloco de Notas ---
  getNotes() {
    return storageAdapter.getCollection(COLLECTIONS.NOTES, []);
  },

  saveNote(note) {
    const list = this.getNotes();
    if (note.id) {
      const idx = list.findIndex((n) => n.id === note.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...note };
    } else {
      note = { ...note, id: genId('note'), createdAt: new Date().toISOString() };
      list.unshift(note);
    }
    storageAdapter.saveCollection(COLLECTIONS.NOTES, list);
    return note;
  },

  deleteNote(id) {
    storageAdapter.saveCollection(COLLECTIONS.NOTES, this.getNotes().filter((n) => n.id !== id));
  },

  // --- Formulários e Respostas ---
  getForms() {
    return storageAdapter.getCollection(COLLECTIONS.FORMS, []);
  },

  saveForm(form) {
    const list = this.getForms();
    const questions = (form.questions || []).map((q) => ({
      id: q.id || genId('q'),
      text: q.text,
      type: q.type,
      required: Boolean(q.required),
      options: q.options || [],
    }));
    if (form.id) {
      const idx = list.findIndex((f) => f.id === form.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...form, questions };
    } else {
      form = { ...form, id: genId('form'), createdAt: new Date().toISOString().slice(0, 10), questions };
      list.unshift(form);
    }
    storageAdapter.saveCollection(COLLECTIONS.FORMS, list);
    return form;
  },

  deleteForm(id) {
    storageAdapter.saveCollection(COLLECTIONS.FORMS, this.getForms().filter((f) => f.id !== id));
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, this.getResponses().filter((r) => r.formId !== id));
  },

  getResponses() {
    return storageAdapter.getCollection(COLLECTIONS.RESPONSES, []);
  },

  saveResponse(response) {
    const list = this.getResponses();
    const existingIdx = list.findIndex((r) => r.formId === response.formId && r.userId === response.userId);
    const payload = {
      id: existingIdx >= 0 ? list[existingIdx].id : genId('resp'),
      formId: response.formId,
      userId: response.userId,
      answers: response.answers,
      submittedAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      list[existingIdx] = payload;
    } else {
      list.unshift(payload);
    }
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, list);
    return payload;
  },

  // --- Avisos ---
  getNotices() {
    return storageAdapter.getCollection(COLLECTIONS.NOTICES, []);
  },

  saveNotice(notice) {
    const list = this.getNotices();
    if (notice.pinned) {
      list.forEach((n) => {
        if (n.pastoralId === notice.pastoralId || notice.pastoralId === 'all') {
          n.pinned = false;
        }
      });
    }
    if (notice.id) {
      const idx = list.findIndex((n) => n.id === notice.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...notice };
    } else {
      notice = { ...notice, id: genId('not'), createdAt: new Date().toISOString() };
      list.unshift(notice);
    }
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, list);
    return notice;
  },

  togglePinNotice(id) {
    const list = this.getNotices();
    const target = list.find((n) => n.id === id);
    if (!target) return;
    const willPin = !target.pinned;
    if (willPin) {
      list.forEach((n) => {
        if (n.pastoralId === target.pastoralId) n.pinned = false;
      });
    }
    target.pinned = willPin;
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, list);
  },

  deleteNotice(id) {
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, this.getNotices().filter((n) => n.id !== id));
  },

  // --- Presença ---
  getAttendanceMap() {
    return storageAdapter.getDocument(COLLECTIONS.ATTENDANCE, {});
  },

  setAttendanceStatus(sourceId, userId, status) {
    const map = this.getAttendanceMap();
    if (!map[sourceId]) map[sourceId] = {};
    map[sourceId][userId] = status;
    storageAdapter.saveDocument(COLLECTIONS.ATTENDANCE, map);
    return map;
  },
};
