/**
 * Serviço de domínio conectado em tempo real ao Cloud Firestore (`onSnapshot`)
 * Mantém 100% das regras de negócio:
 *  - Contas Familiares (`integrantes` / `familyMembers`)
 *  - Fluxo Completo de Aceite e Cancelamento de Substituições + Notificações
 *  - Isolamento N:N de Coordenadores, Matriz Dinâmica de Permissões, Locais,
 *    Tipos de Celebração, Liturgia da Paulus, Oração Eucarística e Roteiro do Celebrante.
 */

import { COLLECTIONS, storageAdapter } from './storage.js';
import { buildDefaultPermissions, buildSeedData } from './seedData.js';

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeFamilyMembers(user) {
  const source =
    Array.isArray(user.familyMembers) && user.familyMembers.length > 0
      ? user.familyMembers
      : Array.isArray(user.integrantes) && user.integrantes.length > 0
        ? user.integrantes
        : null;

  if (source) {
    return source.map((m, idx) => ({
      id: m.id || (idx === 0 && user.id ? user.id : genId('mem')),
      name: String(m.name || user.name || '').trim(),
      birthDate: m.birthDate || user.birthDate || '',
    }));
  }
  return [
    {
      id: user.id || genId('mem'),
      name: String(user.name || '').trim(),
      birthDate: user.birthDate || '',
    },
  ];
}

function resolveMemberNameFromList(users, userId, memberId) {
  const acc = users.find((u) => u.id === userId);
  if (!acc) return 'Membro';
  const members = normalizeFamilyMembers(acc);
  const found = members.find((m) => m.id === memberId) || members[0];
  return found?.name || acc.name;
}

export const dataService = {
  async init(onRealtimeUpdate) {
    await storageAdapter.initRealtime(buildSeedData, onRealtimeUpdate);
  },

  getSyncStatus() {
    return storageAdapter.getSyncStatus();
  },

  // --- Sessão ---
  getSessionUserId() {
    return storageAdapter.getSessionUserId();
  },

  setSessionUserId(userId) {
    storageAdapter.setSessionUserId(userId);
  },

  // --- Permissões (`configuracoes/permissoes`) ---
  getPermissions() {
    const defaults = buildDefaultPermissions();
    const saved = storageAdapter.getPermissionsDoc();
    if (!saved) return defaults;
    return {
      coordinator: { ...defaults.coordinator, ...(saved.coordinator || {}) },
      member: { ...defaults.member, ...(saved.member || {}) },
    };
  },

  savePermissions(matrix) {
    storageAdapter.saveConfigDoc('permissoes', matrix);
    return matrix;
  },

  resetPermissionsToDefault() {
    const defaults = buildDefaultPermissions();
    storageAdapter.saveConfigDoc('permissoes', defaults);
    return defaults;
  },

  // --- Configurações (`configuracoes/geral`) ---
  getSettings() {
    const saved = storageAdapter.getSettingsDoc();
    return {
      instagramUrl: 'https://www.instagram.com/',
      parishName: "Paróquia Santa Teresa d'Ávila",
      subtitle: 'Gestão Pastoral',
      ...(saved || {}),
    };
  },

  updateSettings(patch) {
    const updated = { ...this.getSettings(), ...patch };
    storageAdapter.saveConfigDoc('geral', updated);
    return updated;
  },

  // --- Pastorais (`pastorais`) ---
  getPastorals() {
    return storageAdapter.getCollection(COLLECTIONS.PASTORALS);
  },

  getActivePastorals() {
    return this.getPastorals().filter((p) => p.active);
  },

  getPastoralById(id) {
    return this.getPastorals().find((p) => p.id === id) || null;
  },

  savePastoral(pastoral) {
    const existing = pastoral.id ? this.getPastoralById(pastoral.id) : null;
    const payload = {
      ...(existing || {}),
      ...pastoral,
      id: pastoral.id || genId('pas'),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.PASTORALS, payload);
  },

  deletePastoral(id) {
    const ops = [{ type: 'delete', collection: COLLECTIONS.PASTORALS, id }];
    this.getRoles()
      .filter((r) => r.pastoralId === id)
      .forEach((r) => ops.push({ type: 'delete', collection: COLLECTIONS.ROLES, id: r.id }));
    this.getUsers().forEach((u) => {
      if ((u.memberships || []).some((m) => m.pastoralId === id)) {
        ops.push({
          type: 'set',
          collection: COLLECTIONS.USERS,
          data: {
            ...u,
            memberships: (u.memberships || []).filter((m) => m.pastoralId !== id),
          },
        });
      }
    });
    storageAdapter.runBatch(ops);
  },

  // --- Locais (`locais`) ---
  getLocations() {
    return storageAdapter.getCollection(COLLECTIONS.LOCATIONS);
  },

  getActiveLocations() {
    return this.getLocations().filter((l) => l.active);
  },

  getLocationById(id) {
    return this.getLocations().find((l) => l.id === id) || null;
  },

  saveLocation(location) {
    const existing = location.id ? this.getLocationById(location.id) : null;
    const payload = {
      ...(existing || {}),
      ...location,
      id: location.id || genId('loc'),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.LOCATIONS, payload);
  },

  deleteLocation(id) {
    storageAdapter.removeDoc(COLLECTIONS.LOCATIONS, id);
  },

  // --- Tipos de Celebração (`tiposCelebracao`) ---
  getCelebrationTypes() {
    return storageAdapter.getCollection(COLLECTIONS.CELEBRATION_TYPES);
  },

  getActiveCelebrationTypes() {
    return this.getCelebrationTypes().filter((c) => c.active);
  },

  getCelebrationTypeById(id) {
    return this.getCelebrationTypes().find((c) => c.id === id) || null;
  },

  saveCelebrationType(item) {
    const existing = item.id ? this.getCelebrationTypeById(item.id) : null;
    const payload = {
      ...(existing || {}),
      ...item,
      id: item.id || genId('ct'),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.CELEBRATION_TYPES, payload);
  },

  deleteCelebrationType(id) {
    storageAdapter.removeDoc(COLLECTIONS.CELEBRATION_TYPES, id);
  },

  // --- Usuários & Contas Familiares (`users` com array `integrantes`) ---
  getUsers() {
    return storageAdapter.getCollection(COLLECTIONS.USERS);
  },

  getUserById(id) {
    return this.getUsers().find((u) => u.id === id) || null;
  },

  getActiveUsersByPastoral(pastoralId) {
    return this.getUsers().filter(
      (u) => u.status === 'Ativo' && (u.memberships || []).some((m) => m.pastoralId === pastoralId),
    );
  },

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
    const cleanMemberships = (user.memberships || []).filter((m) => m.pastoralId && m.role);
    const id = user.id || genId('usr');
    const existing = this.getUserById(id);
    const familyMembers = normalizeFamilyMembers({ ...user, id });
    const primaryName =
      familyMembers.length > 1
        ? user.name?.trim() || `Família (${familyMembers.map((m) => m.name.split(' ')[0]).join(' & ')})`
        : familyMembers[0].name;
    const primaryBirth = familyMembers[0].birthDate || user.birthDate || '';

    const payload = {
      ...(existing || {}),
      ...user,
      id,
      name: primaryName,
      birthDate: primaryBirth,
      password: user.password || existing?.password || 'pastoral2026',
      memberships: cleanMemberships,
      integrantes: familyMembers,
      familyMembers,
    };

    return storageAdapter.upsertDoc(COLLECTIONS.USERS, payload);
  },

  updateOwnProfile(userId, { name, email, phone, birthDate, familyMembers }) {
    const existing = this.getUserById(userId);
    if (!existing) return null;
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

    const updated = {
      ...existing,
      name: derivedName,
      email: String(email).trim(),
      phone: String(phone).trim(),
      birthDate: normalizedMembers[0].birthDate || birthDate || '',
      integrantes: normalizedMembers,
      familyMembers: normalizedMembers,
    };
    return storageAdapter.upsertDoc(COLLECTIONS.USERS, updated);
  },

  updateOwnPassword(userId, currentPassword, newPassword) {
    const existing = this.getUserById(userId);
    if (!existing) return { ok: false, error: 'Usuário não encontrado.' };
    const stored = existing.password || 'pastoral2026';
    if (stored !== currentPassword) {
      return { ok: false, error: 'A senha atual informada está incorreta.' };
    }
    const updated = storageAdapter.upsertDoc(COLLECTIONS.USERS, {
      ...existing,
      password: newPassword,
    });
    return { ok: true, user: updated };
  },

  deleteUser(id) {
    storageAdapter.removeDoc(COLLECTIONS.USERS, id);
  },

  // --- Funções (`funcoes`) ---
  getRoles() {
    return storageAdapter.getCollection(COLLECTIONS.ROLES);
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
    const existing = role.id ? this.getRoleById(role.id) : null;
    const payload = {
      ...(existing || {}),
      ...role,
      id: role.id || genId('role'),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.ROLES, payload);
  },

  deleteRole(id) {
    storageAdapter.removeDoc(COLLECTIONS.ROLES, id);
  },

  // --- Escalas & Fluxo Completo de Substituição (`escalas`) ---
  getSchedules() {
    return storageAdapter.getCollection(COLLECTIONS.SCHEDULES);
  },

  getScheduleById(id) {
    return this.getSchedules().find((s) => s.id === id) || null;
  },

  saveSchedule(schedule) {
    const existing = schedule.id ? this.getScheduleById(schedule.id) : null;
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
    const scriptText = String(schedule.celebrantScript ?? schedule.roteiroCelebrante ?? '').trim();

    const enriched = {
      ...(existing || {}),
      ...schedule,
      id: schedule.id || genId('sch'),
      location: locObj ? locObj.name : schedule.location,
      celebrationType: ctObj ? ctObj.name : schedule.celebrationType,
      pastoralId: derivedPastoralId,
      eucharisticPrayerId: schedule.eucharisticPrayerId || 'oe_2',
      eucharisticPrayerSource: schedule.eucharisticPrayerSource || 'default',
      celebrantScript: scriptText,
      roteiroCelebrante: scriptText,
      assignments: normalizedAssignments,
    };

    return storageAdapter.upsertDoc(COLLECTIONS.SCHEDULES, enriched);
  },

  deleteSchedule(id) {
    storageAdapter.removeDoc(COLLECTIONS.SCHEDULES, id);
  },

  requestSubstitution(scheduleId, assignmentId, reason) {
    const sch = this.getScheduleById(scheduleId);
    if (!sch) return null;
    const assignments = (sch.assignments || []).map((a) => ({ ...a }));
    const asg = assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;

    asg.substitutionRequested = true;
    asg.substitutionReason = reason.trim();
    asg.substitutionAccepted = false;

    const updatedSch = { ...sch, assignments };
    const ops = [{ type: 'set', collection: COLLECTIONS.SCHEDULES, data: updatedSch }];

    const users = this.getUsers();
    const pastoralId = asg.pastoralId || sch.pastoralId;
    const pastoral = this.getPastoralById(pastoralId);
    const role = this.getRoleById(asg.roleId);
    const requesterName = resolveMemberNameFromList(users, asg.userId, asg.memberId);
    const dateBR = sch.date.split('-').reverse().join('/');
    const colleagues = this.getActiveUsersByPastoral(pastoralId).filter((u) => u.id !== asg.userId);
    const nowISO = new Date().toISOString();

    colleagues.forEach((col) => {
      ops.push({
        type: 'set',
        collection: COLLECTIONS.NOTIFICATIONS,
        data: {
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
        },
      });
    });

    storageAdapter.runBatch(ops);
    return updatedSch;
  },

  cancelSubstitutionRequest(scheduleId, assignmentId) {
    const sch = this.getScheduleById(scheduleId);
    if (!sch) return null;
    const assignments = (sch.assignments || []).map((a) => ({ ...a }));
    const asg = assignments.find((a) => a.id === assignmentId);
    if (!asg) return null;

    asg.substitutionRequested = false;
    asg.substitutionReason = '';

    const updatedSch = { ...sch, assignments };
    const ops = [{ type: 'set', collection: COLLECTIONS.SCHEDULES, data: updatedSch }];

    this.getNotifications().forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId && !n.completed) {
        ops.push({
          type: 'set',
          collection: COLLECTIONS.NOTIFICATIONS,
          data: { ...n, completed: true, read: true },
        });
      }
    });

    storageAdapter.runBatch(ops);
    return updatedSch;
  },

  acceptSubstitution(scheduleId, assignmentId, acceptorUserId, acceptorMemberId) {
    const sch = this.getScheduleById(scheduleId);
    if (!sch) return null;
    const assignments = (sch.assignments || []).map((a) => ({ ...a }));
    const asg = assignments.find((a) => a.id === assignmentId);
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

    asg.userId = acceptorUserId;
    asg.memberId = acceptorMemberId || acceptorUserId;
    asg.substitutionRequested = false;
    asg.substitutionReason = '';
    asg.substitutionAccepted = true;
    asg.substitutedFromName = prevMemberName;
    asg.substitutedAt = nowISO;

    const updatedSch = { ...sch, assignments };
    const ops = [{ type: 'set', collection: COLLECTIONS.SCHEDULES, data: updatedSch }];

    this.getNotifications().forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId && !n.completed) {
        ops.push({
          type: 'set',
          collection: COLLECTIONS.NOTIFICATIONS,
          data: { ...n, completed: true, read: true },
        });
      }
    });

    ops.push({
      type: 'set',
      collection: COLLECTIONS.NOTIFICATIONS,
      data: {
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
      },
    });

    const coords = this.getActiveUsersByPastoral(pastoralId).filter(
      (u) =>
        u.id !== prevUserId &&
        u.id !== acceptorUserId &&
        (u.memberships || []).some((m) => m.pastoralId === pastoralId && m.role === 'Coordenador'),
    );
    coords.forEach((c) => {
      ops.push({
        type: 'set',
        collection: COLLECTIONS.NOTIFICATIONS,
        data: {
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
        },
      });
    });

    storageAdapter.runBatch(ops);
    return { schedule: updatedSch, prevMemberName, newMemberName };
  },

  reassignScheduleMember(scheduleId, assignmentId, newUserId, newMemberId) {
    const sch = this.getScheduleById(scheduleId);
    if (!sch) return null;
    const assignments = (sch.assignments || []).map((a) => ({ ...a }));
    const asg = assignments.find((a) => a.id === assignmentId);
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

    const updatedSch = { ...sch, assignments };
    const ops = [{ type: 'set', collection: COLLECTIONS.SCHEDULES, data: updatedSch }];

    this.getNotifications().forEach((n) => {
      if (n.type === 'substitution_open' && n.assignmentId === assignmentId && !n.completed) {
        ops.push({
          type: 'set',
          collection: COLLECTIONS.NOTIFICATIONS,
          data: { ...n, completed: true, read: true },
        });
      }
    });

    storageAdapter.runBatch(ops);
    return updatedSch;
  },

  // --- Eventos (`eventos`) ---
  getEvents() {
    return storageAdapter.getCollection(COLLECTIONS.EVENTS);
  },

  saveEvent(evt) {
    const existing = evt.id ? this.getEvents().find((e) => e.id === evt.id) : null;
    const locObj = evt.locationId ? this.getLocationById(evt.locationId) : null;
    const ctObj = evt.celebrationTypeId ? this.getCelebrationTypeById(evt.celebrationTypeId) : null;
    const enriched = {
      ...(existing || {}),
      ...evt,
      id: evt.id || genId('evt'),
      location: locObj ? locObj.name : evt.location,
      celebrationType: ctObj ? ctObj.name : evt.celebrationType || '',
    };
    return storageAdapter.upsertDoc(COLLECTIONS.EVENTS, enriched);
  },

  deleteEvent(id) {
    storageAdapter.removeDoc(COLLECTIONS.EVENTS, id);
  },

  // --- Notas (`notas`) ---
  getNotes() {
    return storageAdapter
      .getCollection(COLLECTIONS.NOTES)
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  saveNote(note) {
    const existing = note.id ? this.getNotes().find((n) => n.id === note.id) : null;
    const pastoralIds = Array.isArray(note.pastoralIds) && note.pastoralIds.length > 0 ? note.pastoralIds : ['all'];
    const payload = {
      ...(existing || {}),
      ...note,
      id: note.id || genId('note'),
      pastoralIds,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.NOTES, payload);
  },

  deleteNote(id) {
    storageAdapter.removeDoc(COLLECTIONS.NOTES, id);
  },

  // --- Formulários & Respostas (`formularios` & `respostas`) ---
  getForms() {
    return storageAdapter
      .getCollection(COLLECTIONS.FORMS)
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  saveForm(form) {
    const existing = form.id ? this.getForms().find((f) => f.id === form.id) : null;
    const questions = (form.questions || []).map((q) => ({
      id: q.id || genId('q'),
      text: q.text,
      type: q.type,
      required: Boolean(q.required),
      options: q.options || [],
    }));
    const pastoralIds = Array.isArray(form.pastoralIds) && form.pastoralIds.length > 0 ? form.pastoralIds : ['all'];
    const payload = {
      ...(existing || {}),
      ...form,
      id: form.id || genId('form'),
      pastoralIds,
      questions,
      createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.FORMS, payload);
  },

  deleteForm(id) {
    const ops = [{ type: 'delete', collection: COLLECTIONS.FORMS, id }];
    this.getResponses()
      .filter((r) => r.formId === id)
      .forEach((r) => ops.push({ type: 'delete', collection: COLLECTIONS.RESPONSES, id: r.id }));
    this.getNotifications()
      .filter((n) => n.formId === id)
      .forEach((n) => ops.push({ type: 'delete', collection: COLLECTIONS.NOTIFICATIONS, id: n.id }));
    storageAdapter.runBatch(ops);
  },

  getResponses() {
    return storageAdapter
      .getCollection(COLLECTIONS.RESPONSES)
      .slice()
      .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  },

  saveResponse(response) {
    const respondentMemberId = response.respondentMemberId || response.userId;
    const existing = this.getResponses().find(
      (r) =>
        r.formId === response.formId &&
        r.userId === response.userId &&
        (r.respondentMemberId || r.userId) === respondentMemberId,
    );
    if (existing && existing.validated) {
      return { ok: false, error: 'Esta resposta já foi validada pela Coordenação e não pode ser editada.' };
    }
    const payload = {
      id: existing ? existing.id : genId('resp'),
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
    const saved = storageAdapter.upsertDoc(COLLECTIONS.RESPONSES, payload);
    this.completeFormRemindersForUser(response.formId, response.userId);
    return { ok: true, response: saved };
  },

  validateResponse(responseId, validatorUserId) {
    const target = this.getResponses().find((r) => r.id === responseId);
    if (!target) return null;
    return storageAdapter.upsertDoc(COLLECTIONS.RESPONSES, {
      ...target,
      validated: true,
      validatedBy: validatorUserId,
      validatedAt: new Date().toISOString(),
    });
  },

  // --- Notificações Internas (`notificacoes`) ---
  getNotifications() {
    return storageAdapter.getCollection(COLLECTIONS.NOTIFICATIONS);
  },

  getNotificationsForUser(userId) {
    return this.getNotifications()
      .filter((n) => n.recipientUserId === userId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  getLatestFormReminder(formId, recipientUserId) {
    return (
      this.getNotifications()
        .filter((n) => n.type === 'form_reminder' && n.formId === formId && n.recipientUserId === recipientUserId)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null
    );
  },

  sendFormReminder({ form, recipientUserId, senderUserId }) {
    const nowISO = new Date().toISOString();
    const existing = this.getNotifications().find(
      (n) => n.type === 'form_reminder' && n.formId === form.id && n.recipientUserId === recipientUserId && !n.completed,
    );
    const message = `A Coordenação enviou um lembrete: responda ao formulário '${form.title}' antes do prazo.`;
    const item = existing
      ? {
          ...existing,
          senderUserId,
          message,
          createdAt: nowISO,
          read: false,
          completed: false,
        }
      : {
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
    return storageAdapter.upsertDoc(COLLECTIONS.NOTIFICATIONS, item);
  },

  markNotificationRead(notificationId) {
    const n = this.getNotifications().find((x) => x.id === notificationId);
    if (n && !n.read) {
      storageAdapter.upsertDoc(COLLECTIONS.NOTIFICATIONS, { ...n, read: true });
    }
  },

  markAllNotificationsReadForUser(userId) {
    const ops = this.getNotifications()
      .filter((n) => n.recipientUserId === userId && !n.read)
      .map((n) => ({
        type: 'set',
        collection: COLLECTIONS.NOTIFICATIONS,
        data: { ...n, read: true },
      }));
    storageAdapter.runBatch(ops);
  },

  completeFormRemindersForUser(formId, userId) {
    const ops = this.getNotifications()
      .filter((n) => n.type === 'form_reminder' && n.formId === formId && n.recipientUserId === userId && !n.completed)
      .map((n) => ({
        type: 'set',
        collection: COLLECTIONS.NOTIFICATIONS,
        data: { ...n, completed: true, read: true },
      }));
    storageAdapter.runBatch(ops);
  },

  // --- Avisos (`avisos`) ---
  getNotices() {
    return storageAdapter
      .getCollection(COLLECTIONS.NOTICES)
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  saveNotice(notice) {
    const existing = notice.id ? this.getNotices().find((n) => n.id === notice.id) : null;
    const pastoralIds = Array.isArray(notice.pastoralIds) && notice.pastoralIds.length > 0 ? notice.pastoralIds : ['all'];
    const ops = [];

    if (notice.pinned) {
      this.getNotices().forEach((n) => {
        if (n.id === notice.id || !n.pinned) return;
        const nPids = n.pastoralIds || ['all'];
        const overlap = pastoralIds.includes('all') || nPids.some((id) => pastoralIds.includes(id));
        if (overlap) {
          ops.push({ type: 'set', collection: COLLECTIONS.NOTICES, data: { ...n, pinned: false } });
        }
      });
    }

    const payload = {
      ...(existing || {}),
      ...notice,
      id: notice.id || genId('not'),
      pastoralIds,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    ops.push({ type: 'set', collection: COLLECTIONS.NOTICES, data: payload });
    storageAdapter.runBatch(ops);
    return payload;
  },

  togglePinNotice(id) {
    const target = this.getNotices().find((n) => n.id === id);
    if (!target) return;
    const willPin = !target.pinned;
    const ops = [];
    if (willPin) {
      const tPids = target.pastoralIds || ['all'];
      this.getNotices().forEach((n) => {
        if (n.id === id || !n.pinned) return;
        const nPids = n.pastoralIds || ['all'];
        if (tPids.includes('all') || nPids.some((pid) => tPids.includes(pid))) {
          ops.push({ type: 'set', collection: COLLECTIONS.NOTICES, data: { ...n, pinned: false } });
        }
      });
    }
    ops.push({ type: 'set', collection: COLLECTIONS.NOTICES, data: { ...target, pinned: willPin } });
    storageAdapter.runBatch(ops);
  },

  deleteNotice(id) {
    storageAdapter.removeDoc(COLLECTIONS.NOTICES, id);
  },

  // --- Presença (`presencas`) ---
  getAttendanceMap() {
    return storageAdapter.getAttendanceMap();
  },

  setAttendanceStatus(sourceId, participantId, status) {
    return storageAdapter.setAttendanceStatus(sourceId, participantId, status);
  },

  // --- Mural de Parabéns (`aniversariosParabens`) ---
  getBirthdayMessages() {
    return storageAdapter.getCollection(COLLECTIONS.BIRTHDAY_MESSAGES);
  },

  getBirthdayMessagesForUser(recipientMemberId) {
    return this.getBirthdayMessages()
      .filter((m) => m.recipientUserId === recipientMemberId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  addBirthdayMessage({ recipientUserId, authorId, authorPastoralLabel, message }) {
    const item = {
      id: genId('bmsg'),
      recipientUserId,
      authorId,
      authorPastoralLabel: authorPastoralLabel || "Paróquia Santa Teresa d'Ávila",
      message: String(message).trim(),
      createdAt: new Date().toISOString(),
    };
    return storageAdapter.upsertDoc(COLLECTIONS.BIRTHDAY_MESSAGES, item);
  },
};
