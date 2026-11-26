/**
 * Serviço de Cruzamento Inteligente de Disponibilidade (Formulários × Escalas)
 * - Cruza respostas de formulários (perguntas de data única e de Final de Semana)
 *   com a Data, Horário, Local e Pastoral selecionados na montagem/edição de Escalas.
 * - Suporta perguntas padronizadas com metadados (`massMeta`) e perguntas em texto livre
 *   (ex: "02/12 (Qua) 19:30 - São Francisco", "24/12 (Qui) 19:00 - Vigília de Natal",
 *   "Final de Semana dia 05 e 06/12", "Final de Semana dia 02/01 e 03/01").
 * - Aplica respostas de Contas Familiares (`all_family`) a todos os irmãos da família naquela pastoral,
 *   respeitando respostas individuais por integrante quando existirem.
 */

const WEEKDAY_TOKENS = {
  0: ['domingo', 'dom'],
  1: ['segunda', 'seg'],
  2: ['terca', 'ter'],
  3: ['quarta', 'qua'],
  4: ['quinta', 'qui'],
  5: ['sexta', 'sex'],
  6: ['sabado', 'sab'],
};

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DEFAULT_WEEKEND_OPTIONS = [
  'Sábado 17:30 Matriz',
  'Sábado 19:00 Maria Goretti',
  'Domingo 07:00 Matriz',
  'Domingo 09:00 Matriz',
  'Domingo 19:00 São Francisco',
  'Nenhum horário disponível',
];

export function normalizeAvailabilityText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLocationCore(str) {
  const norm = normalizeAvailabilityText(str)
    .replace(/[:/]/g, ' ')
    .replace(/\b(comunidade|capela|igreja|paroquia|santuario|espaco)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm;
}

export function parseTimeHHMM(str) {
  const text = String(str || '');
  const match = text.match(/\b(\d{1,2})\s*[:h]\s*(\d{2})\b/i) || text.match(/\b(\d{1,2})\s*h\b/i);
  if (!match) return '';
  const hh = String(Number(match[1])).padStart(2, '0');
  const mm = match[2] ? String(Number(match[2])).padStart(2, '0') : '00';
  return `${hh}:${mm}`;
}

export function getIsoDateParts(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return null;
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    year: y,
    month: m,
    day: d,
    dd: String(d).padStart(2, '0'),
    mm: String(m).padStart(2, '0'),
    dow: dt.getDay(),
    weekdayShort: WEEKDAY_SHORT_PT[dt.getDay()],
  };
}

export function formatSingleMassQuestionText({ date, time, locationName = '', celebrationLabel = '' }) {
  const parts = getIsoDateParts(date);
  if (!parts) return '';
  const hhmm = parseTimeHHMM(time) || time || '';
  const segments = [`${parts.dd}/${parts.mm} (${parts.weekdayShort})${hhmm ? ` ${hhmm}` : ''}`];
  if (celebrationLabel && celebrationLabel.trim()) {
    segments.push(celebrationLabel.trim());
  }
  if (locationName && locationName.trim()) {
    const cleanLoc = locationName.trim().replace(/^Comunidade\s+/i, '');
    segments.push(cleanLoc);
  }
  return segments.join(' - ');
}

export function formatWeekendQuestionText({ date, endDate }) {
  const start = getIsoDateParts(date);
  if (!start) return '';
  const end = getIsoDateParts(endDate);
  if (!end) {
    return `Final de Semana dia ${start.dd}/${start.mm}`;
  }
  if (start.month === end.month) {
    return `Final de Semana dia ${start.dd} e ${end.dd}/${end.mm}`;
  }
  return `Final de Semana dia ${start.dd}/${start.mm} e ${end.dd}/${end.mm}`;
}

function getKnownLocationCores(locations = []) {
  const base = ['matriz', 'sao francisco', 'maria goretti', 'sav', 'salao'];
  const fromDb = locations
    .map((l) => normalizeLocationCore(l.name))
    .filter((c) => c.length >= 3);
  return Array.from(new Set([...fromDb, ...base]));
}

function extractLocationCoreFromText(text, knownCores = []) {
  const norm = normalizeAvailabilityText(text).replace(/[:/]/g, ' ');
  for (const core of knownCores) {
    if (!core) continue;
    const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
    if (regex.test(norm)) return core;
  }
  return '';
}

function locationsMatch(textOrNameA, textOrNameB, knownCores = []) {
  const coreA = normalizeLocationCore(textOrNameA);
  const coreB = normalizeLocationCore(textOrNameB);
  if (!coreA || !coreB) return true;
  if (coreA === coreB || coreA.includes(coreB) || coreB.includes(coreA)) return true;

  const detectedA = extractLocationCoreFromText(textOrNameA, knownCores);
  const detectedB = extractLocationCoreFromText(textOrNameB, knownCores);
  if (detectedA && detectedB) {
    return detectedA === detectedB || detectedA.includes(detectedB) || detectedB.includes(detectedA);
  }
  return false;
}

function textMatchesWeekday(text, dow) {
  const tokens = WEEKDAY_TOKENS[dow] || [];
  const norm = normalizeAvailabilityText(text).replace(/[:/]/g, ' ');
  return tokens.some((tok) => {
    const regex = new RegExp(`(^|\\s)${tok}(\\s|$)`, 'i');
    return regex.test(norm);
  });
}

function isNegativeOption(text) {
  const norm = normalizeAvailabilityText(text);
  return (
    norm.includes('nenhum') ||
    norm.includes('indisponivel') ||
    norm === 'nao' ||
    norm.startsWith('nao ') ||
    norm.includes('nao disponivel') ||
    norm.includes('nao posso')
  );
}

function optionMatchesSlot(optionText, { dow, time, locationName, knownCores }) {
  if (!optionText || isNegativeOption(optionText)) return false;

  // 1. Dia da semana
  if (!textMatchesWeekday(optionText, dow)) return false;

  // 2. Horário
  const optTime = parseTimeHHMM(optionText);
  if (!optTime || (time && optTime !== time)) return false;

  // 3. Local (se a opção citar local e um local alvo tiver sido selecionado)
  if (locationName) {
    const optLoc = extractLocationCoreFromText(optionText, knownCores);
    if (optLoc && !locationsMatch(optLoc, locationName, knownCores)) {
      return false;
    }
  }
  return true;
}

function getFormValidYears(form) {
  const years = new Set();
  const text = `${form.title || ''} ${form.description || ''}`;
  const matches = text.match(/\b20\d{2}\b/g) || [];
  matches.forEach((y) => years.add(Number(y)));

  const deadlineYear = form.deadline ? Number(String(form.deadline).slice(0, 4)) : 0;
  const createdYear = form.createdAt ? Number(String(form.createdAt).slice(0, 4)) : 0;
  const createdMonth = form.createdAt ? Number(String(form.createdAt).slice(5, 7)) : 0;
  const deadlineMonth = form.deadline ? Number(String(form.deadline).slice(5, 7)) : 0;

  if (deadlineYear >= 2020) years.add(deadlineYear);
  if (createdYear >= 2020) years.add(createdYear);

  // Formulários criados no fim do ano (nov/dez) frequentemente cobrem o início de janeiro do ano seguinte
  if (createdYear >= 2020 && (createdMonth >= 11 || deadlineMonth === 12 || /dezembro/i.test(text))) {
    years.add(createdYear + 1);
  }
  return years;
}

function matchQuestionToMass(question, { dateParts, isoDate, targetTime, locationId, locationName, knownCores }) {
  if (!question || !dateParts) return null;

  // 1. Metadados estruturados (`massMeta`) criados pelo construtor de formulários
  if (question.massMeta && question.massMeta.mode) {
    const meta = question.massMeta;
    if (meta.mode === 'single' && meta.date) {
      if (meta.date !== isoDate) return null;
      const metaTime = parseTimeHHMM(meta.time);
      if (metaTime && targetTime && metaTime !== targetTime) return null;
      if (meta.locationId && locationId && meta.locationId !== locationId) {
        if (!locationsMatch(meta.locationName || '', locationName, knownCores)) return null;
      } else if (meta.locationName && locationName && !locationsMatch(meta.locationName, locationName, knownCores)) {
        return null;
      }
      return { question, matchType: 'single' };
    }

    if (meta.mode === 'weekend' && meta.date) {
      const inRange =
        meta.date === isoDate ||
        meta.endDate === isoDate ||
        (meta.endDate && isoDate >= meta.date && isoDate <= meta.endDate);
      if (!inRange) return null;
      const opts = Array.isArray(question.options) ? question.options : [];
      if (opts.length > 0) {
        const hasSlotOption = opts.some((opt) =>
          optionMatchesSlot(opt, { dow: dateParts.dow, time: targetTime, locationName, knownCores }),
        );
        if (!hasSlotOption) return null;
      }
      return { question, matchType: 'weekend' };
    }
  }

  // 2. Correspondência por texto padronizado / Google Forms
  const qText = String(question.text || '');
  const qNorm = normalizeAvailabilityText(qText);

  // 2a. Pergunta de Final de Semana (ex: "Final de Semana dia 05 e 06/12" ou "Final de Semana dia 02/01 e 03/01")
  const weekendRangeMatch = qText.match(/(\d{1,2})(?:\/(\d{1,2}))?\s*(?:e|a|-)\s*(\d{1,2})\/(\d{1,2})/i);
  if (
    weekendRangeMatch &&
    (qNorm.includes('final de semana') || qNorm.includes('fim de semana') || qNorm.includes('fds') || question.type === 'checkbox')
  ) {
    const d1 = Number(weekendRangeMatch[1]);
    const m2 = Number(weekendRangeMatch[4]);
    const m1 = weekendRangeMatch[2] ? Number(weekendRangeMatch[2]) : m2;
    const d2 = Number(weekendRangeMatch[3]);

    const dayMatches =
      (dateParts.day === d1 && dateParts.month === m1) ||
      (dateParts.day === d2 && dateParts.month === m2);

    if (dayMatches) {
      const opts = Array.isArray(question.options) ? question.options : [];
      if (opts.length > 0) {
        const hasSlotOption = opts.some((opt) =>
          optionMatchesSlot(opt, { dow: dateParts.dow, time: targetTime, locationName, knownCores }),
        );
        if (!hasSlotOption) return null;
      }
      return { question, matchType: 'weekend' };
    }
    return null;
  }

  // 2b. Pergunta de Data Única (ex: "02/12 (Qua) 19:30 - São Francisco", "24/12 (Qui) 19:00 - Vigília de Natal")
  const singleDateMatch = qText.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (singleDateMatch) {
    const dd = Number(singleDateMatch[1]);
    const mm = Number(singleDateMatch[2]);
    if (dd !== dateParts.day || mm !== dateParts.month) return null;

    if (singleDateMatch[3]) {
      const qYear = singleDateMatch[3].length === 2 ? Number(`20${singleDateMatch[3]}`) : Number(singleDateMatch[3]);
      if (qYear !== dateParts.year) return null;
    }

    const qTime = parseTimeHHMM(qText);
    if (qTime && targetTime && qTime !== targetTime) return null;

    // Se a pergunta menciona explicitamente um local conhecido, exige compatibilidade com o local escolhido.
    // Se não menciona local (ex: "24/12 (Qui) 19:00 - Vigília de Natal"), aceita qualquer local da celebração.
    const qLocCore = extractLocationCoreFromText(qText, knownCores);
    if (qLocCore && locationName && !locationsMatch(qLocCore, locationName, knownCores)) {
      return null;
    }

    return { question, matchType: 'single' };
  }

  return null;
}

function resolveParticipantResponse(formResponses, participant) {
  // Prioridade 1: resposta individual específica para este integrante (ex: mem_lara_cor ou conta individual)
  const exact = formResponses.find(
    (r) => r.userId === participant.accountId && r.respondentMemberId === participant.memberId,
  );
  if (exact) return exact;

  // Prioridade 2: resposta de Conta Familiar marcada para "all_family" (Ambos/Todos os irmãos)
  // ou resposta legada sem respondentMemberId específico
  const familyWide = formResponses.find(
    (r) =>
      r.userId === participant.accountId &&
      (!r.respondentMemberId ||
        r.respondentMemberId === 'all_family' ||
        r.respondentMemberId === participant.accountId),
  );
  return familyWide || null;
}

function evaluateAnswerStatus(rawAnswer, { matchType, dow, time, locationName, knownCores }) {
  const trimmed = String(rawAnswer || '').trim();
  if (!trimmed) return 'no_response';

  if (matchType === 'single') {
    const norm = normalizeAvailabilityText(trimmed);
    if (isNegativeOption(norm)) return 'unavailable';
    if (norm.includes('disponivel') || norm === 'sim' || norm.startsWith('sim ') || norm.includes('posso')) {
      return 'available';
    }
    return 'unavailable';
  }

  // matchType === 'weekend'
  const pickedOptions = trimmed
    .split(/[,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (pickedOptions.length === 0) return 'no_response';

  const matched = pickedOptions.some((opt) =>
    optionMatchesSlot(opt, { dow, time, locationName, knownCores }),
  );
  return matched ? 'available' : 'unavailable';
}

/**
 * Consulta a disponibilidade de todos os participantes de uma pastoral para uma celebração específica.
 */
export function evaluatePastoralAvailability({
  pastoralId,
  date,
  time,
  locationId = '',
  locationName = '',
  forms = [],
  responses = [],
  participants = [],
  locations = [],
}) {
  const dateParts = getIsoDateParts(date);
  const targetTime = parseTimeHHMM(time);
  const knownCores = getKnownLocationCores(locations);

  const emptyResult = {
    hasMatch: false,
    pastoralId,
    form: null,
    question: null,
    matchType: null,
    statusByKey: new Map(),
    available: [],
    noResponse: [],
    unavailable: [],
    totalRegular: participants.filter((p) => !p.account?.isGeneralAdmin).length,
  };

  if (!pastoralId || !dateParts || !targetTime) {
    return emptyResult;
  }

  // Filtra formulários direcionados à pastoral e compatíveis com o ano/período
  const candidateForms = forms.filter((f) => {
    const pids = Array.isArray(f.pastoralIds) ? f.pastoralIds : [];
    const targetsPastoral = pids.includes(pastoralId) || pids.includes('all');
    if (!targetsPastoral) return false;

    const hasStructuredDateMatch = (f.questions || []).some(
      (q) =>
        q.massMeta?.date === date.slice(0, 10) ||
        q.massMeta?.endDate === date.slice(0, 10),
    );
    if (hasStructuredDateMatch) return true;

    const validYears = getFormValidYears(f);
    if (validYears.size > 0 && !validYears.has(dateParts.year)) return false;
    return true;
  });

  let matchedPair = null;
  for (const form of candidateForms) {
    for (const q of form.questions || []) {
      const hit = matchQuestionToMass(q, {
        dateParts,
        isoDate: date.slice(0, 10),
        targetTime,
        locationId,
        locationName,
        knownCores,
      });
      if (hit) {
        matchedPair = { form, ...hit };
        break;
      }
    }
    if (matchedPair) break;
  }

  if (!matchedPair) {
    return emptyResult;
  }

  const formResponses = responses.filter((r) => r.formId === matchedPair.form.id);
  const statusByKey = new Map();
  const available = [];
  const noResponse = [];
  const unavailable = [];

  participants.forEach((p) => {
    const key = `${p.accountId}::${p.memberId}`;
    const resp = resolveParticipantResponse(formResponses, p);
    const rawAns = resp ? resp.answers?.[matchedPair.question.id] : '';
    const status = resp
      ? evaluateAnswerStatus(rawAns, {
          matchType: matchedPair.matchType,
          dow: dateParts.dow,
          time: targetTime,
          locationName,
          knownCores,
        })
      : 'no_response';

    // Exclui Coordenação Geral (admin global) das contagens de formulário caso não tenha respondido
    const isAdminNonRespondent = Boolean(p.account?.isGeneralAdmin) && status === 'no_response';
    statusByKey.set(key, {
      status,
      rawAnswer: rawAns || '',
      respondentLabel: resp?.respondentLabel || '',
      isFamilyWideResponse: resp?.respondentMemberId === 'all_family',
      participant: p,
    });

    if (isAdminNonRespondent) return;

    if (status === 'available') available.push(p);
    else if (status === 'unavailable') unavailable.push(p);
    else noResponse.push(p);
  });

  return {
    hasMatch: true,
    pastoralId,
    form: matchedPair.form,
    question: matchedPair.question,
    matchType: matchedPair.matchType,
    statusByKey,
    available,
    noResponse,
    unavailable,
    totalRegular: available.length + noResponse.length + unavailable.length,
  };
}
