/**
 * Serviço de domínio v5 — Contas Familiares (irmãos), Aceite/Cancelamento de
 * Substituições com notificações automáticas, Locais, Tipos de Celebração e Permissões.
 */

import { storageAdapter, COLLECTIONS } from './storage.js';
import { buildDefaultPermissions, buildSeedData } from './seedData.js';

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeFamilyMembers(user) {
  if (Array.isArray(user.familyMembers) && user.familyMembers.length > 0) {
    return user.familyMembers.map((m, idx) => ({
      id: m.id || (idx === 0 && user.id ? user.id : genId('mem')),
      name: String(m.name || user.name || '').trim(),
      birthDate: m.birthDate || user.birthDate || '',
    }));
  }
  return [{ id: user.id || genId('mem'), name: String(user.name || '').trim(), birthDate: user.birthDate || '' }];
}

function resolveMemberNameFromList(users, userId, memberId) {
  const acc = users.find((u) => u.id === userId);
  if (!acc) return 'Membro';
  const members = normalizeFamilyMembers(acc);
  const found = members.find((m) => m.id === memberId) || members[0];
  return found?.name || acc.name;
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
    storageAdapter.saveCollection(COLLECTIONS.LOCATIONS, seed.locations);
    storageAdapter.saveCollection(COLLECTIONS.CELEBRATION_TYPES, seed.celebrationTypes);
    storageAdapter.saveCollection(COLLECTIONS.USERS, seed.users);
    storageAdapter.saveCollection(COLLECTIONS.ROLES, seed.roles);
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, seed.schedules);
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, seed.events);
    storageAdapter.saveCollection(COLLECTIONS.NOTES, seed.notes);
    storageAdapter.saveCollection(COLLECTIONS.FORMS, seed.forms);
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, seed.responses);
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, seed.notices);
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, seed.notifications);
    storageAdapter.saveDocument(COLLECTIONS.ATTENDANCE, seed.attendance);
    storageAdapter.saveDocument(COLLECTIONS.PERMISSIONS, seed.permissions);
    storageAdapter.saveCollection(COLLECTIONS.BIRTHDAY_MESSAGES, seed.birthdayMessages);
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

  // --- Permissões ---
  getPermissions() {
    const defaults = buildDefaultPermissions();
    const saved = storageAdapter.getDocument(COLLECTIONS.PERMISSIONS, null);
    if (!saved) return defaults;
    return {
      coordinator: { ...defaults.coordinator, ...(saved.coordinator || {}) },
      member: { ...defaults.member, ...(saved.member || {}) },
    };
  },

  savePermissions(matrix) {
    storageAdapter.saveDocument(COLLECTIONS.PERMISSIONS, matrix);
    return matrix;
  },

  resetPermissionsToDefault() {
    const defaults = buildDefaultPermissions();
    storageAdapter.saveDocument(COLLECTIONS.PERMISSIONS, defaults);
    return defaults;
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
    const updatedUsers = this.getUsers().map((u) => ({
      ...u,
      memberships: (u.memberships || []).filter((m) => m.pastoralId !== id),
    }));
    storageAdapter.saveCollection(COLLECTIONS.USERS, updatedUsers);
  },

  // --- Locais ---
  getLocations() {
    return storageAdapter.getCollection(COLLECTIONS.LOCATIONS, []);
  },

  getActiveLocations() {
    return this.getLocations().filter((l) => l.active);
  },

  getLocationById(id) {
    return this.getLocations().find((l) => l.id === id) || null;
  },

  saveLocation(location) {
    const list = this.getLocations();
    if (location.id) {
      const idx = list.findIndex((l) => l.id === location.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...location };
    } else {
      location = { ...location, id: genId('loc') };
      list.push(location);
    }
    storageAdapter.saveCollection(COLLECTIONS.LOCATIONS, list);
    return location;
  },

  deleteLocation(id) {
    storageAdapter.saveCollection(COLLECTIONS.LOCATIONS, this.getLocations().filter((l) => l.id !== id));
  },

  // --- Tipos de Celebração ---
  getCelebrationTypes() {
    return storageAdapter.getCollection(COLLECTIONS.CELEBRATION_TYPES, []);
  },

  getActiveCelebrationTypes() {
    return this.getCelebrationTypes().filter((c) => c.active);
  },

  getCelebrationTypeById(id) {
    return this.getCelebrationTypes().find((c) => c.id === id) || null;
  },

  saveCelebrationType(item) {
    const list = this.getCelebrationTypes();
    if (item.id) {
      const idx = list.findIndex((c) => c.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...item };
    } else {
      item = { ...item, id: genId('ct') };
      list.push(item);
    }
    storageAdapter.saveCollection(COLLECTIONS.CELEBRATION_TYPES, list);
    return item;
  },

  deleteCelebrationType(id) {
    storageAdapter.saveCollection(COLLECTIONS.CELEBRATION_TYPES, this.getCelebrationTypes().filter((c) => c.id !== id));
  },

  // --- Usuários & Contas Familiares ---
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

  /**
   * Retorna cada integrante individualmente (desdobrando Contas Familiares em irmãos)
   * para montagem de Escalas, Presença e Aniversariantes.
   */
  getActiveParticipantsByPastoral(pastoralId) {
    const accounts = this.getActiveUsersByPastoral(pastoralId);
    const participants = [];
    accounts.forEach((acc) => {
      const members = normalizeFamilyMembers(acc);
      members.forEach((m) => {
        participants.push({
          accountId: acc.id,
          memberId: m.id,
          name: m.name,
          birthDate: m.birthDate,
          isFamily: members.length > 1,
          accountName: acc.name,
          account: acc,
        });
      });
    });
    return participants;
  },

  saveUser(user) {
    const list = this.getUsers();
    const cleanMemberships = (user.memberships || []).filter((m) => m.pastoralId && m.role);
    const id = user.id || genId('usr');
    const familyMembers = normalizeFamilyMembers({ ...user, id });
    const primaryName =
      familyMembers.length > 1
        ? user.name?.trim() || `Família (${familyMembers.map((m) => m.name.split(' ')[0]).join(' & ')})`
        : familyMembers[0].name;
    const primaryBirth = familyMembers[0].birthDate || user.birthDate || '';

    const idx = list.findIndex((u) => u.id === id);
    const existing = idx >= 0 ? list[idx] : null;
    const payload = {
      ...(existing || {}),
      ...user,
      id,
      name: primaryName,
      birthDate: primaryBirth,
      password: user.password || existing?.password || 'pastoral2026',
      memberships: cleanMemberships,
      familyMembers,
    };

    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    storageAdapter.saveCollection(COLLECTIONS.USERS, list);
    return payload;
  },

  updateOwnProfile(userId, { name, email, phone, birthDate, familyMembers }) {
    const list = this.getUsers();
    const idx = list.findIndex((u) => u.id === userId);
    if (idx < 0) return null;
    const normalizedMembers = normalizeFamilyMembers({
      id: userId,
      name,
      birthDate,
      familyMembers,
    });
    const derivedName =
      normalizedMembers.length > 1
        ? String(name || '').trim() || `Família (${normalizedMembers.map((m) => m.name.split(' ')[0]).join(' & ')})`
        : normalizedMembers[0].name;

    list[idx] = {
      ...list[idx],
      name: derivedName,
      email: String(email).trim(),
      phone: String(phone).trim(),
      birthDate: normalizedMembers[0].birthDate || birthDate || '',
      familyMembers: normalizedMembers,
    };
    storageAdapter.saveCollection(COLLECTIONS.USERS, list);
    return list[idx];
  },

  updateOwnPassword(userId, currentPassword, newPassword) {
    const list = this.getUsers();
    const idx = list.findIndex((u) => u.id === userId);
    if (idx < 0) return { ok: false, error: 'Usuário não encontrado.' };
    const stored = list[idx].password || 'pastoral2026';
    if (stored !== currentPassword) {
      return { ok: false, error: 'A senha atual informada está incorreta.' };
    }
    list[idx] = { ...list[idx], password: newPassword };
    storageAdapter.saveCollection(COLLECTIONS.USERS, list);
    return { ok: true, user: list[idx] };
  },

  deleteUser(id) {
    storageAdapter.saveCollection(COLLECTIONS.USERS, this.getUsers().filter((u) => u.id !== id));
  },

  // --- Funções ---
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

  // --- Escalas & Fluxo Completo de Substituição ---
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
      memberId: a.memberId || a.userId,
      substitutionRequested: Boolean(a.substitutionRequested),
      substitutionReason: a.substitutionReason || '',
      substitutionAccepted: Boolean(a.substitutionAccepted),
      substitutedFromName: a.substitutedFromName || '',
      substitutedAt: a.substitutedAt || null,
    }));

    const distinctPastorals = Array.from(new Set(normalizedAssignments.map((a) => a.pastoralId).filter(Boolean)));
    const derivedPastoralId = schedule.pastoralId || distinctPastorals[0] || 'pas_coroinhas';

    const locObj = schedule.locationId ? this.getLocationById(schedule.locationId) : null;
    const ctObj = schedule.celebrationTypeId ? this.getCelebrationTypeById(schedule.celebrationTypeId) : null;

    const enriched = {
      ...schedule,
      location: locObj ? locObj.name : schedule.location,
      celebrationType: ctObj ? ctObj.name : schedule.celebrationType,
      pastoralId: derivedPastoralId,
      eucharisticPrayerId: schedule.eucharisticPrayerId || 'oe_2',
      eucharisticPrayerSource: schedule.eucharisticPrayerSource || 'default',
      celebrantScript: String(schedule.celebrantScript || '').trim(),
      assignments: normalizedAssignments,
    };

    if (schedule.id) {
      const idx = list.findIndex((s) => s.id === schedule.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...enriched };
    } else {
      enriched.id = genId('sch');
      list.push(enriched);
    }
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);
    return enriched;
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
    asg.substitutionAccepted = false;
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);

    // Notifica no sino todos os outros membros ativos e coordenadores da mesma pastoral!
    const users = this.getUsers();
    const pastoralId = asg.pastoralId || sch.pastoralId;
    const pastoral = this.getPastoralById(pastoralId);
    const role = this.getRoleById(asg.roleId);
    const requesterName = resolveMemberNameFromList(users, asg.userId, asg.memberId);
    const dateBR = sch.date.split('-').reverse().join('/');
    const colleagues = this.getActiveUsersByPastoral(pastoralId).filter((u) => u.id !== asg.userId);

    const notifs = this.getNotifications();
    const nowISO = new Date().toISOString();
    colleagues.forEach((col) => {
      notifs.unshift({
        id: genId('notif'),
        type: 'substitution_open',
        recipientUserId: col.id,
        senderUserId: asg.userId,
        scheduleId: sch.id,
        assignmentId: asg.id,
        pastoralId,
        title: `Pedido de Substituição em Aberto (${pastoral?.shortName || 'Pastoral'})`,
        message: `${requesterName} pediu substituição em ${role?.name || 'Função'} na missa de ${dateBR} às ${sch.time} (${sch.location}).`,
        createdAt: nowISO,
        read: false,
        completed: false,
      });
    });
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, notifs);
    return sch;
  },

  cancelSubstitutionRequest(scheduleId, assignmentId) {
    const list = this.getSchedules();
    const sch = list.find((s) => s.id === scheduleId);
    if (!sch) return null;
    const asg = sch.assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;

    asg.substitutionRequested = false;
    asg.substitutionReason = '';
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);

    // Conclui notificações de pedido aberto dessa posição
    const notifs = this.getNotifications();
    notifs.forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId) {
        n.completed = true;
        n.read = true;
      }
    });
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, notifs);
    return sch;
  },

  acceptSubstitution(scheduleId, assignmentId, acceptorUserId, acceptorMemberId) {
    const list = this.getSchedules();
    const sch = list.find((s) => s.id === scheduleId);
    if (!sch) return null;
    const asg = sch.assignments.find((a) => a.id === assignmentId);
    if (!asg || !asg.substitutionRequested) return null;

    const users = this.getUsers();
    const prevUserId = asg.userId;
    const prevMemberName = resolveMemberNameFromList(users, asg.userId, asg.memberId);
    const newMemberName = resolveMemberNameFromList(users, acceptorUserId, acceptorMemberId || acceptorUserId);
    const pastoralId = asg.pastoralId || sch.pastoralId;
    const pastoral = this.getPastoralById(pastoralId);
    const role = this.getRoleById(asg.roleId);
    const dateBR = sch.date.split('-').reverse().join('/');
    const nowISO = new Date().toISOString();

    // Troca automática do titular na escala
    asg.userId = acceptorUserId;
    asg.memberId = acceptorMemberId || acceptorUserId;
    asg.substitutionRequested = false;
    asg.substitutionReason = '';
    asg.substitutionAccepted = true;
    asg.substitutedFromName = prevMemberName;
    asg.substitutedAt = nowISO;
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);

    // Fecha notificações de pedido aberto + envia confirmação para quem pediu e para os coordenadores da pastoral
    const notifs = this.getNotifications();
    notifs.forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId) {
        n.completed = true;
        n.read = true;
      }
    });

    // Notifica quem solicitou a substituição
    notifs.unshift({
      id: genId('notif'),
      type: 'substitution_confirmed',
      recipientUserId: prevUserId,
      senderUserId: acceptorUserId,
      scheduleId: sch.id,
      assignmentId: asg.id,
      pastoralId,
      title: `Substituição Confirmada (${pastoral?.shortName || 'Pastoral'})`,
      message: `${newMemberName} assumiu sua função de ${role?.name || 'Função'} na missa de ${dateBR} às ${sch.time} (${sch.location}).`,
      createdAt: nowISO,
      read: false,
      completed: false,
    });

    // Notifica os coordenadores daquela pastoral
    const coords = this.getActiveUsersByPastoral(pastoralId).filter(
      (u) =>
        u.id !== prevUserId &&
        u.id !== acceptorUserId &&
        (u.memberships || []).some((m) => m.pastoralId === pastoralId && m.role === 'Coordenador'),
    );
    coords.forEach((c) => {
      notifs.unshift({
        id: genId('notif'),
        type: 'substitution_confirmed',
        recipientUserId: c.id,
        senderUserId: acceptorUserId,
        scheduleId: sch.id,
        assignmentId: asg.id,
        pastoralId,
        title: `Substituição Confirmada — ${pastoral?.shortName || 'Pastoral'}`,
        message: `${newMemberName} assumiu ${role?.name || 'Função'} no lugar de ${prevMemberName} na missa de ${dateBR} às ${sch.time}.`,
        createdAt: nowISO,
        read: false,
        completed: false,
      });
    });

    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, notifs);
    return { schedule: sch, prevMemberName, newMemberName };
  },

  reassignScheduleMember(scheduleId, assignmentId, newUserId, newMemberId) {
    const list = this.getSchedules();
    const sch = list.find((s) => s.id === scheduleId);
    if (!sch) return null;
    const asg = sch.assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;
    const users = this.getUsers();
    const prevMemberName = resolveMemberNameFromList(users, asg.userId, asg.memberId);

    asg.userId = newUserId;
    asg.memberId = newMemberId || newUserId;
    asg.substitutionRequested = false;
    asg.substitutionReason = '';
    asg.substitutionAccepted = true;
    asg.substitutedFromName = prevMemberName;
    asg.substitutedAt = new Date().toISOString();
    storageAdapter.saveCollection(COLLECTIONS.SCHEDULES, list);

    const notifs = this.getNotifications();
    notifs.forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId) {
        n.completed = true;
        n.read = true;
      }
    });
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, notifs);
    return sch;
  },

  // --- Eventos ---
  getEvents() {
    return storageAdapter.getCollection(COLLECTIONS.EVENTS, []);
  },

  saveEvent(evt) {
    const list = this.getEvents();
    const locObj = evt.locationId ? this.getLocationById(evt.locationId) : null;
    const ctObj = evt.celebrationTypeId ? this.getCelebrationTypeById(evt.celebrationTypeId) : null;
    const enriched = {
      ...evt,
      location: locObj ? locObj.name : evt.location,
      celebrationType: ctObj ? ctObj.name : evt.celebrationType || '',
    };
    if (evt.id) {
      const idx = list.findIndex((e) => e.id === evt.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...enriched };
    } else {
      enriched.id = genId('evt');
      list.push(enriched);
    }
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, list);
    return enriched;
  },

  deleteEvent(id) {
    storageAdapter.saveCollection(COLLECTIONS.EVENTS, this.getEvents().filter((e) => e.id !== id));
  },

  // --- Notas ---
  getNotes() {
    return storageAdapter.getCollection(COLLECTIONS.NOTES, []);
  },

  saveNote(note) {
    const list = this.getNotes();
    const pastoralIds = Array.isArray(note.pastoralIds) && note.pastoralIds.length > 0 ? note.pastoralIds : ['all'];
    if (note.id) {
      const idx = list.findIndex((n) => n.id === note.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...note, pastoralIds };
    } else {
      note = { ...note, id: genId('note'), pastoralIds, createdAt: new Date().toISOString() };
      list.unshift(note);
    }
    storageAdapter.saveCollection(COLLECTIONS.NOTES, list);
    return note;
  },

  deleteNote(id) {
    storageAdapter.saveCollection(COLLECTIONS.NOTES, this.getNotes().filter((n) => n.id !== id));
  },

  // --- Formulários & Respostas (com suporte a Conta Familiar) ---
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
    const pastoralIds = Array.isArray(form.pastoralIds) && form.pastoralIds.length > 0 ? form.pastoralIds : ['all'];
    if (form.id) {
      const idx = list.findIndex((f) => f.id === form.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...form, pastoralIds, questions };
    } else {
      form = { ...form, id: genId('form'), pastoralIds, createdAt: new Date().toISOString().slice(0, 10), questions };
      list.unshift(form);
    }
    storageAdapter.saveCollection(COLLECTIONS.FORMS, list);
    return form;
  },

  deleteForm(id) {
    storageAdapter.saveCollection(COLLECTIONS.FORMS, this.getForms().filter((f) => f.id !== id));
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, this.getResponses().filter((r) => r.formId !== id));
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, this.getNotifications().filter((n) => n.formId !== id));
  },

  getResponses() {
    return storageAdapter.getCollection(COLLECTIONS.RESPONSES, []);
  },

  saveResponse(response) {
    const list = this.getResponses();
    const respondentMemberId = response.respondentMemberId || response.userId;
    const existingIdx = list.findIndex(
      (r) =>
        r.formId === response.formId &&
        r.userId === response.userId &&
        (r.respondentMemberId || r.userId) === respondentMemberId,
    );
    if (existingIdx >= 0 && list[existingIdx].validated) {
      return { ok: false, error: 'Esta resposta já foi validada pela Coordenação e não pode ser editada.' };
    }
    const payload = {
      id: existingIdx >= 0 ? list[existingIdx].id : genId('resp'),
      formId: response.formId,
      userId: response.userId,
      respondentMemberId,
      respondentLabel: response.respondentLabel || '',
      answers: response.answers,
      submittedAt: new Date().toISOString(),
      validated: false,
      validatedBy: null,
      validatedAt: null,
    };
    if (existingIdx >= 0) list[existingIdx] = payload;
    else list.unshift(payload);
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, list);

    this.completeFormRemindersForUser(response.formId, response.userId);
    return { ok: true, response: payload };
  },

  validateResponse(responseId, validatorUserId) {
    const list = this.getResponses();
    const target = list.find((r) => r.id === responseId);
    if (!target) return null;
    target.validated = true;
    target.validatedBy = validatorUserId;
    target.validatedAt = new Date().toISOString();
    storageAdapter.saveCollection(COLLECTIONS.RESPONSES, list);
    return target;
  },

  // --- Notificações Internas ---
  getNotifications() {
    return storageAdapter.getCollection(COLLECTIONS.NOTIFICATIONS, []);
  },

  getNotificationsForUser(userId) {
    return this.getNotifications()
      .filter((n) => n.recipientUserId === userId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  getLatestFormReminder(formId, recipientUserId) {
    return (
      this.getNotifications()
        .filter((n) => n.type === 'form_reminder' && n.formId === formId && n.recipientUserId === recipientUserId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null
    );
  },

  sendFormReminder({ form, recipientUserId, senderUserId }) {
    const list = this.getNotifications();
    const nowISO = new Date().toISOString();
    const existing = list.find(
      (n) => n.type === 'form_reminder' && n.formId === form.id && n.recipientUserId === recipientUserId && !n.completed,
    );
    const message = `A Coordenação enviou um lembrete: responda ao formulário '${form.title}' antes do prazo.`;
    if (existing) {
      existing.senderUserId = senderUserId;
      existing.message = message;
      existing.createdAt = nowISO;
      existing.read = false;
      existing.completed = false;
      storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, list);
      return existing;
    }
    const item = {
      id: genId('notif'),
      type: 'form_reminder',
      recipientUserId,
      senderUserId,
      formId: form.id,
      title: 'Lembrete de Formulário Pendente',
      message,
      createdAt: nowISO,
      read: false,
      completed: false,
    };
    list.unshift(item);
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, list);
    return item;
  },

  markNotificationRead(notificationId) {
    const list = this.getNotifications();
    const n = list.find((x) => x.id === notificationId);
    if (n) {
      n.read = true;
      storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, list);
    }
  },

  markAllNotificationsReadForUser(userId) {
    const list = this.getNotifications();
    list.forEach((n) => {
      if (n.recipientUserId === userId) n.read = true;
    });
    storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, list);
  },

  completeFormRemindersForUser(formId, userId) {
    const list = this.getNotifications();
    let changed = false;
    list.forEach((n) => {
      if (n.type === 'form_reminder' && n.formId === formId && n.recipientUserId === userId) {
        n.completed = true;
        n.read = true;
        changed = true;
      }
    });
    if (changed) storageAdapter.saveCollection(COLLECTIONS.NOTIFICATIONS, list);
  },

  // --- Avisos ---
  getNotices() {
    return storageAdapter.getCollection(COLLECTIONS.NOTICES, []);
  },

  saveNotice(notice) {
    const list = this.getNotices();
    const pastoralIds = Array.isArray(notice.pastoralIds) && notice.pastoralIds.length > 0 ? notice.pastoralIds : ['all'];
    if (notice.pinned) {
      list.forEach((n) => {
        const nPids = n.pastoralIds || ['all'];
        const overlap = pastoralIds.includes('all') || nPids.some((id) => pastoralIds.includes(id));
        if (overlap) n.pinned = false;
      });
    }
    if (notice.id) {
      const idx = list.findIndex((n) => n.id === notice.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...notice, pastoralIds };
    } else {
      notice = { ...notice, id: genId('not'), pastoralIds, createdAt: new Date().toISOString() };
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
      const tPids = target.pastoralIds || ['all'];
      list.forEach((n) => {
        const nPids = n.pastoralIds || ['all'];
        if (tPids.includes('all') || nPids.some((pid) => tPids.includes(pid))) n.pinned = false;
      });
    }
    target.pinned = willPin;
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, list);
  },

  deleteNotice(id) {
    storageAdapter.saveCollection(COLLECTIONS.NOTICES, this.getNotices().filter((n) => n.id !== id));
  },

  // --- Presença (por memberId individual) ---
  getAttendanceMap() {
    return storageAdapter.getDocument(COLLECTIONS.ATTENDANCE, {});
  },

  setAttendanceStatus(sourceId, participantId, status) {
    const map = this.getAttendanceMap();
    if (!map[sourceId]) map[sourceId] = {};
    map[sourceId][participantId] = status;
    storageAdapter.saveDocument(COLLECTIONS.ATTENDANCE, map);
    return map;
  },

  // --- Mural de Parabéns (por memberId individual) ---
  getBirthdayMessages() {
    return storageAdapter.getCollection(COLLECTIONS.BIRTHDAY_MESSAGES, []);
  },

  getBirthdayMessagesForUser(recipientMemberId) {
    return this.getBirthdayMessages()
      .filter((m) => m.recipientUserId === recipientMemberId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  addBirthdayMessage({ recipientUserId, authorId, authorPastoralLabel, message }) {
    const list = this.getBirthdayMessages();
    const item = {
      id: genId('bmsg'),
      recipientUserId,
      authorId,
      authorPastoralLabel: authorPastoralLabel || "Paróquia Santa Teresa d'Ávila",
      message: String(message).trim(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(item);
    storageAdapter.saveCollection(COLLECTIONS.BIRTHDAY_MESSAGES, list);
    return item;
  },
};
