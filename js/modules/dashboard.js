/**
 * Módulo 1: Início (Dashboard Multi-Pastoral v5)
 * - Bloco "Pedidos de Substituição em Aberto" de colegas das suas pastorais com aceite rápido
 * - Banner Festivo de Aniversário verificando cada irmão de Contas Familiares individualmente
 * - Lembretes internos pendentes de formulários
 * - Aviso Fixado com visibilidade estrita N:N por pastoral
 * - Widget "Minhas Próximas Escalas" com tag "Escalado: [Irmão]" para contas familiares
 */

import { dataService } from '../services/dataService.js';
import { openAcceptSubstitutionModal } from './schedules.js';
import {
  buildUserTimeSlotIndex,
  canManagePastoral,
  escapeHtml,
  formatDateBR,
  formatDateTimeBR,
  formatWeekdayBR,
  getAccountMembers,
  getCoordinatedPastoralIds,
  getCountdownBadge,
  getFirstName,
  getMemberPastoralIds,
  getNoticeDashboardStatus,
  getOpenSubstitutionsForUser,
  getTodayISO,
  getUserMemberships,
  getUserRoleSummary,
  hasPermission,
  hasTimeConflict,
  isFamilyAccount,
  isFormClosed,
  isGeneralAdmin,
  isPastoralScopedItemVisible,
  refreshIcons,
  renderFamilyAccountBadge,
  renderPastoralPill,
  renderPastoralPillsList,
  resolveAssignedMemberName,
} from '../utils/helpers.js';

let dashboardPastoralFilter = 'all';

export function resetDashboardFilter() {
  dashboardPastoralFilter = 'all';
}

export function renderDashboard(container, { user, navigate, setHeaderContext, permissions, openFormDirectly, onNotificationsChanged }) {
  const today = new Date();
  const todayISO = getTodayISO();
  const curMonth = today.getMonth() + 1;
  const curDay = today.getDate();

  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastorals = pastorals.filter((p) => accessibleIds.includes(p.id));
  const coordIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const isFam = isFamilyAccount(user);

  if (dashboardPastoralFilter !== 'all' && !accessibleIds.includes(dashboardPastoralFilter)) {
    dashboardPastoralFilter = 'all';
  }

  const selectedPastoral = dashboardPastoralFilter === 'all' ? null : pastoralMap[dashboardPastoralFilter];
  const dynamicContextTitle = selectedPastoral ? selectedPastoral.name : 'Visão Geral das Pastorais';
  setHeaderContext?.('Início', dynamicContextTitle);

  const schedules = dataService.getSchedules();
  const roles = dataService.getRoles();
  const users = dataService.getUsers();
  const notices = dataService.getNotices();
  const forms = dataService.getForms();
  const responses = dataService.getResponses();

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const slotIndex = buildUserTimeSlotIndex(schedules);

  // Banner Festivo de Aniversário verificando todos os integrantes (irmãos) da conta logada
  const accountMembers = getAccountMembers(user);
  const birthdayBannerHtml = accountMembers
    .map((member) => {
      if (!member.birthDate || !member.birthDate.includes('-')) return '';
      const [, bm, bd] = member.birthDate.split('-').map(Number);
      if (bm !== curMonth) return '';
      const isBdayToday = bm === curMonth && bd === curDay;
      const myCongrats = dataService.getBirthdayMessagesForUser(member.id);
      return `
        <section class="rounded-2xl bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#5D4037] text-white p-5 shadow-md border border-amber-300/60">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <i data-lucide="party-popper" class="w-6 h-6 text-amber-200"></i>
              </div>
              <div>
                <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-200">
                  ${isBdayToday ? 'Feliz Aniversário Hoje!' : 'Mês de Aniversário!'}
                </p>
                <h4 class="text-lg font-extrabold">
                  Parabéns, ${escapeHtml(getFirstName(member.name))}! Que Deus e Santa Teresa d'Ávila abençoem muito sua vida!
                </h4>
                <p class="text-xs text-amber-100 mt-1">
                  ${
                    myCongrats.length > 0
                      ? `${isFam ? `${escapeHtml(getFirstName(member.name))} recebeu` : 'Você recebeu'} <strong>${myCongrats.length}</strong> ${myCongrats.length === 1 ? 'recado carinhoso' : 'recados carinhosos'} no Mural de Parabéns!`
                      : 'Confira o Mural de Parabéns no módulo Aniversariantes.'
                  }
                </p>
                ${
                  myCongrats.length > 0
                    ? `<div class="mt-2.5 rounded-xl bg-black/20 border border-white/15 px-3.5 py-2 text-xs text-amber-50">
                        “${escapeHtml(myCongrats[0].message)}” — <strong>${escapeHtml(userMap[myCongrats[0].authorId]?.name || 'Paróquia')}</strong>
                      </div>`
                    : ''
                }
              </div>
            </div>
            <button type="button" data-nav="birthdays"
              class="shrink-0 self-start md:self-center px-4 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#3E2723] text-xs font-extrabold shadow-xs transition">
              Ver Mural de Parabéns
            </button>
          </div>
        </section>
      `;
    })
    .filter(Boolean)
    .join('');

  // Bloco de Pedidos de Substituição em Aberto (apenas das pastorais do usuário, excluindo seus próprios pedidos)
  const openSubstitutions = getOpenSubstitutionsForUser(user, schedules, pastorals).filter(
    (item) => dashboardPastoralFilter === 'all' || item.pastoralId === dashboardPastoralFilter,
  );

  const openSubstitutionsBannerHtml =
    openSubstitutions.length > 0
      ? `
      <section class="rounded-2xl bg-gradient-to-r from-amber-50 via-[#FDFBF7] to-emerald-50/40 border-2 border-amber-400 p-4 sm:p-5 space-y-3 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
              <i data-lucide="hand-helping" class="w-4 h-4"></i>
            </div>
            <div>
              <h4 class="text-sm font-extrabold text-[#3E2723]">Pedidos de Substituição em Aberto (${openSubstitutions.length})</h4>
              <p class="text-xs text-[#6D4C41]">Irmãos da sua pastoral precisam de cobertura em uma escala. Pode ajudar?</p>
            </div>
          </div>
          <button type="button" data-nav="schedules" class="text-xs font-bold text-[#B45309] hover:text-[#3E2723] transition">
            Ver todas as escalas →
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${openSubstitutions
            .slice(0, 4)
            .map(({ schedule: sch, assignment: asg, pastoralId }) => {
              const p = pastoralMap[pastoralId];
              const roleName = roleMap[asg.roleId] || 'Função';
              const requesterName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
              return `
                <div class="rounded-xl bg-white border border-amber-300 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="space-y-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${renderPastoralPill(p, { compact: true })}
                      <span class="text-xs font-extrabold text-[#B45309]">${escapeHtml(roleName)}</span>
                    </div>
                    <p class="text-xs font-bold text-[#3E2723]">
                      ${escapeHtml(requesterName)} • ${escapeHtml(formatDateBR(sch.date))} às ${escapeHtml(sch.time)}
                    </p>
                    <p class="text-[11px] text-[#6D4C41]">${escapeHtml(sch.celebrationType)} — ${escapeHtml(sch.location)}</p>
                    ${
                      asg.substitutionReason
                        ? `<p class="text-[11px] text-red-800 italic">“${escapeHtml(asg.substitutionReason)}”</p>`
                        : ''
                    }
                  </div>
                  <button type="button" data-dash-accept-sub="${asg.id}" data-dash-sch-id="${sch.id}"
                    class="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs transition">
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                    Assumir / Aceitar Substituição
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>
    `
      : '';

  // Avisos ativos no Dashboard (fixados dentro do prazo ou sem prazo + avisos com exibirDashboardAte válido >= hoje)
  const visibleNotices = notices.filter((n) => {
    if (!isPastoralScopedItemVisible(n.pastoralIds, user, pastorals)) return false;
    if (dashboardPastoralFilter === 'all') return true;
    const pids = n.pastoralIds || ['all'];
    return pids.includes('all') || pids.includes(dashboardPastoralFilter);
  });
  const dashboardNotices = visibleNotices
    .filter((n) => getNoticeDashboardStatus(n, todayISO).active)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

  // Próximas 3 datas do usuário (ou de todos os irmãos em Contas Familiares)
  const myUpcomingAssignments = [];
  schedules
    .filter((s) => s.date >= todayISO)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .forEach((sch) => {
      (sch.assignments || []).forEach((asg) => {
        if (asg.userId !== user.id) return;
        const pid = asg.pastoralId || sch.pastoralId;
        if (dashboardPastoralFilter !== 'all' && pid !== dashboardPastoralFilter) return;
        const assignedName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
        const personKey = asg.memberId || asg.userId;
        myUpcomingAssignments.push({
          schedule: sch,
          assignment: asg,
          pastoral: pastoralMap[pid],
          assignedName,
          roleName: roleMap[asg.roleId] || 'Função',
          countdown: getCountdownBadge(sch.date),
          hasConflict: hasTimeConflict(slotIndex, personKey, sch.date, sch.time),
        });
      });
    });

  const nextThree = myUpcomingAssignments.slice(0, 3);

  const canManageSchedules = hasPermission(user, 'schedules_manage', permissions);
  const pendingSubstitutions = schedules.reduce((acc, s) => {
    return (
      acc +
      (s.assignments || []).filter(
        (a) => a.substitutionRequested && canManagePastoral(user, a.pastoralId || s.pastoralId),
      ).length
    );
  }, 0);

  // Conta aniversariantes individuais do mês (desdobrando irmãos de contas familiares)
  const birthdaysThisMonth = users.reduce((sum, u) => {
    const count = getAccountMembers(u).filter(
      (m) => m.birthDate && Number(m.birthDate.split('-')[1]) === curMonth,
    ).length;
    return sum + count;
  }, 0);

  const pendingForms = forms.filter((f) => {
    if (isFormClosed(f)) return false;
    if (!isPastoralScopedItemVisible(f.pastoralIds, user, pastorals)) return false;
    const already = responses.some((r) => r.formId === f.id && r.userId === user.id);
    return !already;
  }).length;

  const roleSummary = getUserRoleSummary(user, pastorals);
  const myMemberships = getUserMemberships(user);

  const activeReminders = dataService
    .getNotificationsForUser(user.id)
    .filter((n) => n.type === 'form_reminder' && !n.completed)
    .filter((n) => {
      const f = forms.find((x) => x.id === n.formId);
      return f && !isFormClosed(f);
    });

  const reminderBannersHtml = activeReminders
    .map(
      (rem) => `
      <section class="rounded-2xl bg-red-50 border-2 border-red-300 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center shrink-0">
            <i data-lucide="bell-ring" class="w-5 h-5"></i>
          </div>
          <div>
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-red-700">Lembrete da Coordenação • Pendência</p>
            <p class="text-sm font-bold text-[#3E2723] mt-0.5">${escapeHtml(rem.message)}</p>
            <p class="text-xs text-[#6D4C41] mt-0.5">Enviado em ${escapeHtml(formatDateTimeBR(rem.createdAt))}</p>
          </div>
        </div>
        <button type="button" data-answer-reminder-form="${rem.formId}" data-reminder-id="${rem.id}"
          class="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 text-xs font-extrabold shadow-xs transition">
          <i data-lucide="send" class="w-3.5 h-3.5"></i>
          Responder Agora
        </button>
      </section>
    `,
    )
    .join('');

  container.innerHTML = `
    <div class="space-y-6">
      ${reminderBannersHtml}
      ${openSubstitutionsBannerHtml}
      ${birthdayBannerHtml}

      <!-- Cabeçalho Interno Dinâmico + Filtro de Pastoral -->
      <div class="bg-[#FDFBF7] rounded-2xl border border-[#E6DACE] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              <i data-lucide="compass" class="w-3 h-3"></i>
              ${escapeHtml(dynamicContextTitle)}
            </span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleSummary.badgeClass}">
              ${escapeHtml(roleSummary.label)}
            </span>
            ${renderFamilyAccountBadge(user, { compact: true })}
          </div>

          <h3 class="text-2xl font-extrabold text-[#3E2723]">
            Paz e bem, ${escapeHtml(isFam ? user.name.split('(')[0].trim() : getFirstName(user.name))}!
          </h3>

          <div class="flex items-center gap-1.5 flex-wrap">
            ${
              isGeneralAdmin(user)
                ? `<span class="text-xs text-[#6D4C41] font-medium">Administração Paroquial com visão total das ${pastorals.length} pastorais.</span>`
                : myMemberships.length === 0
                  ? `<span class="text-xs text-[#6D4C41]">Nenhum vínculo pastoral ativo.</span>`
                  : myMemberships
                      .map((m) => {
                        const p = pastoralMap[m.pastoralId];
                        if (!p) return '';
                        const roleTag = m.role === 'Coordenador' ? 'Coord.' : 'Membro';
                        return `
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                            style="background-color:${escapeHtml(p.color)}15; color:${escapeHtml(p.color)}; border-color:${escapeHtml(p.color)}44;">
                            <span class="w-1.5 h-1.5 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
                            ${escapeHtml(p.shortName)} • <span class="opacity-80">${roleTag}</span>
                          </span>
                        `;
                      })
                      .join('')
            }
          </div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex items-center gap-2 bg-white border border-[#E6DACE] rounded-xl px-3 py-2">
            <i data-lucide="filter" class="w-3.5 h-3.5 text-[#B45309]"></i>
            <select id="dashboard-pastoral-filter" aria-label="Filtrar painel por pastoral"
              class="text-xs sm:text-sm font-bold text-[#3E2723] bg-transparent outline-none cursor-pointer">
              <option value="all" ${dashboardPastoralFilter === 'all' ? 'selected' : ''}>Visão Geral das Pastorais</option>
              ${accessiblePastorals
                .map(
                  (p) => `<option value="${p.id}" ${dashboardPastoralFilter === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
          ${
            hasPermission(user, 'my_dates', permissions)
              ? `<button type="button" data-nav="my_dates"
                  class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs sm:text-sm font-semibold shadow-sm transition">
                  <i data-lucide="calendar-clock" class="w-4 h-4 text-amber-400"></i>
                  Minhas Datas
                </button>`
              : ''
          }
        </div>
      </div>

      <!-- Mural de Avisos Ativos no Início (Isolado por Pastoral e Filtrado por Validade) -->
      ${
        dashboardNotices.length > 0
          ? `
        <div class="space-y-3" id="dashboard-notices-mural">
          ${dashboardNotices
            .map((notice) => {
              const dashStatus = getNoticeDashboardStatus(notice, todayISO);
              return `
                <section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-[#FDFBF7] to-white border-2 border-amber-400/80 p-5 shadow-xs">
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div class="flex items-start gap-3.5">
                      <div class="w-10 h-10 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <i data-lucide="pin" class="w-5 h-5"></i>
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5 flex-wrap mb-1">
                          <span class="text-[11px] font-extrabold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                            ${escapeHtml(dashStatus.label || '📌 Aviso Fixado')}
                          </span>
                          ${renderPastoralPillsList(notice.pastoralIds, pastoralMap, { compact: true })}
                          <span class="text-xs text-[#6D4C41]">${escapeHtml(formatDateTimeBR(notice.createdAt))}</span>
                        </div>
                        <h4 class="text-base font-bold text-[#3E2723]">${escapeHtml(notice.title)}</h4>
                        <p class="text-sm text-[#4E342E] mt-1 leading-relaxed whitespace-pre-line">${escapeHtml(notice.content)}</p>
                        <p class="text-xs text-[#8D6E63] mt-2 font-medium">Publicado por ${escapeHtml(userMap[notice.authorId]?.name || 'Coordenação')}</p>
                      </div>
                    </div>
                    <button type="button" data-nav="notices"
                      class="shrink-0 self-start text-xs font-bold text-[#92400E] hover:text-[#3E2723] bg-white hover:bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg transition">
                      Ver avisos
                    </button>
                  </div>
                </section>
              `;
            })
            .join('')}
        </div>
      `
          : ''
      }

      <!-- Banner Devocional Carmelita -->
      <section class="devotional-pattern rounded-3xl text-white p-6 sm:p-8 shadow-lg border border-[#5D4037]/50 relative overflow-hidden">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div class="lg:col-span-8 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 text-xs font-semibold tracking-wide">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              Espiritualidade Pastoral • Paróquia Santa Teresa d'Ávila
            </div>
            <blockquote class="font-serif text-xl sm:text-2xl lg:text-[26px] font-semibold leading-snug text-white">
              “Pois o Filho do Homem não veio para ser servido, mas para servir.”
            </blockquote>
            <p class="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">— Marcos 10:45</p>

            <div class="pt-3 border-t border-white/15 flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-white/10 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
                <i data-lucide="flame" class="w-4 h-4"></i>
              </div>
              <p class="text-sm text-amber-50/90 leading-relaxed">
                <strong class="text-amber-300">Santa Teresa d'Ávila &amp; São Tarcísio:</strong>
                “O Senhor não olha tanto a grandeza das obras, mas o amor com que são feitas; servir na comunidade com zelo é servir ao próprio Cristo.”
              </p>
            </div>
          </div>

          <div class="lg:col-span-4 flex justify-center lg:justify-end">
            <div class="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-white/[0.04] border border-amber-400/30 flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 200 200" class="w-40 h-40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Emblema litúrgico carmelita">
                <circle cx="100" cy="100" r="82" stroke="#D97706" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="5 5"/>
                <circle cx="100" cy="64" r="24" fill="#FFFBEB" fill-opacity="0.12" stroke="#FBBF24" stroke-width="2.2"/>
                <path d="M100 50V78M90 61H110" stroke="#FDE68A" stroke-width="2.4" stroke-linecap="round"/>
                <path d="M68 96H132C132 117 118 131 100 131C82 131 68 117 68 96Z" fill="#D97706" fill-opacity="0.24" stroke="#FBBF24" stroke-width="2.4" stroke-linejoin="round"/>
                <line x1="100" y1="131" x2="100" y2="162" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
                <circle cx="100" cy="145" r="5" fill="#F59E0B"/>
                <path d="M74 170C74 164 85 161 100 161C115 161 126 164 126 170H74Z" fill="#D97706" fill-opacity="0.3" stroke="#FBBF24" stroke-width="2.2" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- Cards de Indicadores Rápidos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button type="button" data-nav="my_dates"
          class="text-left bg-white rounded-2xl p-5 border border-[#E6DACE] hover:border-[#D97706] shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Minhas Datas</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] flex items-center justify-center group-hover:bg-[#B45309] group-hover:text-white transition">
              <i data-lucide="calendar-clock" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#3E2723] mt-3">${myUpcomingAssignments.length}</p>
          <p class="text-xs text-[#8D6E63] mt-0.5">${isFam ? 'escalas da família' : 'próximas escalas'}</p>
        </button>

        <button type="button" data-nav="birthdays"
          class="text-left bg-white rounded-2xl p-5 border border-[#E6DACE] hover:border-[#5D4037] shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Aniversariantes</span>
            <div class="w-9 h-9 rounded-xl bg-[#F5EFE6] text-[#4E342E] flex items-center justify-center group-hover:bg-[#3E2723] group-hover:text-amber-400 transition">
              <i data-lucide="cake" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#3E2723] mt-3">${birthdaysThisMonth}</p>
          <p class="text-xs text-[#8D6E63] mt-0.5">neste mês • Mural de Parabéns</p>
        </button>

        <button type="button" data-nav="forms"
          class="text-left bg-white rounded-2xl p-5 border border-[#E6DACE] hover:border-[#D97706] shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Formulários</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] flex items-center justify-center group-hover:bg-[#B45309] group-hover:text-white transition">
              <i data-lucide="clipboard-list" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#3E2723] mt-3">${pendingForms}</p>
          <p class="text-xs text-[#8D6E63] mt-0.5">abertos aguardando resposta</p>
        </button>

        ${
          canManageSchedules
            ? `
          <button type="button" data-nav="schedules"
            class="text-left bg-white rounded-2xl p-5 border ${pendingSubstitutions > 0 ? 'border-amber-400 bg-amber-50/40' : 'border-[#E6DACE]'} hover:border-[#B45309] shadow-xs hover:shadow-md transition group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Substituições</span>
              <div class="w-9 h-9 rounded-xl ${pendingSubstitutions > 0 ? 'bg-[#D97706] text-white' : 'bg-[#F5EFE6] text-[#5D4037]'} flex items-center justify-center transition">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              </div>
            </div>
            <p class="text-2xl font-extrabold text-[#3E2723] mt-3">${pendingSubstitutions}</p>
            <p class="text-xs text-[#8D6E63] mt-0.5">${isGeneralAdmin(user) ? 'em toda a paróquia' : `nas ${coordIds.size} pastorais que coordena`}</p>
          </button>
        `
            : `
          <button type="button" data-nav="attendance"
            class="text-left bg-white rounded-2xl p-5 border border-[#E6DACE] hover:border-emerald-600 shadow-xs hover:shadow-md transition group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">${isFam ? 'Presença da Família' : 'Minha Presença'}</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition">
                <i data-lucide="check-square" class="w-4 h-4"></i>
              </div>
            </div>
            <p class="text-2xl font-extrabold text-[#3E2723] mt-3">Acompanhar</p>
            <p class="text-xs text-[#8D6E63] mt-0.5">frequência em missas e ensaios</p>
          </button>
        `
        }
      </div>

      <!-- Widget: Minhas Próximas Escalas -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-[#E6DACE]/80 flex items-center justify-between gap-3 bg-[#FDFBF7]">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#3E2723] text-amber-400 flex items-center justify-center">
              <i data-lucide="calendar-heart" class="w-4 h-4"></i>
            </div>
            <div>
              <h4 class="text-base font-bold text-[#3E2723]">${isFam ? 'Próximas Escalas da Família' : 'Minhas Próximas Escalas'}</h4>
              <p class="text-xs text-[#6D4C41]">Próximos 3 compromissos com contagem regressiva</p>
            </div>
          </div>
          <button type="button" data-nav="my_dates"
            class="text-xs font-bold text-[#B45309] hover:text-[#3E2723] flex items-center gap-1 transition">
            Abrir Minhas Datas
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <div class="p-6">
          ${
            nextThree.length === 0
              ? `
            <div class="text-center py-8 px-4 rounded-xl bg-[#FAF6F0] border border-dashed border-[#D7C4B2]">
              <i data-lucide="calendar-off" class="w-8 h-8 text-[#8D6E63] mx-auto mb-2"></i>
              <p class="text-sm font-semibold text-[#4E342E]">Você não possui escalas futuras neste filtro.</p>
            </div>
          `
              : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${nextThree
                .map(({ schedule: sch, assignment: asg, pastoral, assignedName, roleName, countdown, hasConflict }) => `
                  <article class="rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50/50 to-white p-4 flex flex-col justify-between gap-3 shadow-xs">
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${countdown.cls}">
                          ${escapeHtml(countdown.label)}
                        </span>
                        <span class="text-xs font-extrabold text-[#3E2723]">${escapeHtml(sch.time)}</span>
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap mb-2">
                        ${renderPastoralPill(pastoral, { compact: true })}
                        ${
                          isFam
                            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3E2723] text-amber-300">
                                Escalado: ${escapeHtml(assignedName)}
                              </span>`
                            : ''
                        }
                      </div>
                      <h5 class="font-bold text-[#3E2723] text-sm">${escapeHtml(sch.celebrationType)}</h5>
                      <p class="text-xs text-[#6D4C41] mt-0.5 capitalize">${escapeHtml(formatWeekdayBR(sch.date))}, ${escapeHtml(formatDateBR(sch.date))}</p>

                      <div class="mt-3 space-y-1.5 text-xs text-[#5D4037]">
                        <div class="flex items-center gap-2">
                          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#B45309] shrink-0"></i>
                          <span class="font-medium">${escapeHtml(sch.location)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <i data-lucide="bookmark-check" class="w-3.5 h-3.5 text-[#5D4037] shrink-0"></i>
                          <span>Função: <strong class="text-[#3E2723]">${escapeHtml(roleName)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      ${
                        hasConflict
                          ? `<div class="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                              <i data-lucide="clock-alert" class="w-3.5 h-3.5 shrink-0 text-[#B45309]"></i>
                              Conflito no mesmo horário
                            </div>`
                          : ''
                      }
                      ${
                        asg.substitutionRequested
                          ? `<div class="text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                              <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0"></i>
                              Substituição solicitada
                            </div>`
                          : asg.substitutionAccepted && asg.substitutedFromName
                            ? `<div class="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 shrink-0"></i>
                                Substituindo ${escapeHtml(getFirstName(asg.substitutedFromName))}
                              </div>`
                            : ''
                      }
                    </div>
                  </article>
                `)
                .join('')}
            </div>
          `
          }
        </div>
      </section>
    </div>
  `;

  container.querySelector('#dashboard-pastoral-filter')?.addEventListener('change', (e) => {
    dashboardPastoralFilter = e.target.value;
    renderDashboard(container, { user, navigate, setHeaderContext, permissions, openFormDirectly, onNotificationsChanged });
  });

  container.querySelectorAll('[data-dash-accept-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAcceptSubstitutionModal(btn.dataset.dashSchId, btn.dataset.dashAcceptSub, user, () => {
        onNotificationsChanged?.();
        renderDashboard(container, { user, navigate, setHeaderContext, permissions, openFormDirectly, onNotificationsChanged });
      });
    });
  });

  container.querySelectorAll('[data-answer-reminder-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.markNotificationRead(btn.dataset.reminderId);
      onNotificationsChanged?.();
      openFormDirectly?.(btn.dataset.answerReminderForm);
    });
  });

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  refreshIcons();
}
