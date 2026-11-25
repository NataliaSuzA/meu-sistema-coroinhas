/**
 * Módulo 1: Início (Dashboard Multi-Pastoral)
 * - Cabeçalho interno dinâmico com filtro de pastoral (exibe nome da pastoral ou "Visão Geral das Pastorais")
 * - Boas-vindas com nome, papel e badges das pastorais do usuário
 * - Aviso Fixado filtrado conforme visibilidade
 * - Banner Devocional Carmelita (Marcos 10:45 + Santa Teresa / São Tarcísio)
 * - Widget "Minhas Próximas Escalas" unificado com tags coloridas das pastorais e alerta de conflito
 */

import { dataService } from '../services/dataService.js';
import {
  buildUserTimeSlotIndex,
  canManagePastoral,
  escapeHtml,
  formatDateBR,
  formatDateTimeBR,
  formatWeekdayBR,
  getCoordinatedPastoralIds,
  getFirstName,
  getMemberPastoralIds,
  getTodayISO,
  getUserMemberships,
  getUserRoleSummary,
  hasTimeConflict,
  isAnyCoordinator,
  isGeneralAdmin,
  refreshIcons,
  renderPastoralPill,
} from '../utils/helpers.js';

let dashboardPastoralFilter = 'all';

export function resetDashboardFilter() {
  dashboardPastoralFilter = 'all';
}

export function renderDashboard(container, { user, navigate, setHeaderContext }) {
  const todayISO = getTodayISO();
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastorals = pastorals.filter((p) => accessibleIds.includes(p.id));
  const coordIds = new Set(getCoordinatedPastoralIds(user, pastorals));

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

  // Aviso fixado visível ao usuário e ao filtro selecionado
  const visibleNotices = notices.filter((n) => {
    const allowed = isGeneralAdmin(user) || n.pastoralId === 'all' || accessibleIds.includes(n.pastoralId);
    if (!allowed) return false;
    if (dashboardPastoralFilter === 'all') return true;
    return n.pastoralId === 'all' || n.pastoralId === dashboardPastoralFilter;
  });
  const pinnedNotice = visibleNotices.find((n) => n.pinned) || null;

  // Minhas Próximas 3 Escalas (unificadas por posição/pastoral)
  const myUpcomingAssignments = [];
  schedules
    .filter((s) => s.date >= todayISO)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .forEach((sch) => {
      (sch.assignments || []).forEach((asg) => {
        if (asg.userId !== user.id) return;
        const pid = asg.pastoralId || sch.pastoralId;
        if (dashboardPastoralFilter !== 'all' && pid !== dashboardPastoralFilter) return;
        myUpcomingAssignments.push({
          schedule: sch,
          assignment: asg,
          pastoral: pastoralMap[pid],
          roleName: roleMap[asg.roleId] || 'Função',
          hasConflict: hasTimeConflict(slotIndex, user.id, sch.date, sch.time),
        });
      });
    });

  const nextThree = myUpcomingAssignments.slice(0, 3);

  // Substituições pendentes APENAS nas pastorais que o usuário coordena
  const pendingSubstitutions = schedules.reduce((acc, s) => {
    return (
      acc +
      (s.assignments || []).filter(
        (a) => a.substitutionRequested && canManagePastoral(user, a.pastoralId || s.pastoralId),
      ).length
    );
  }, 0);

  const curMonth = new Date().getMonth() + 1;
  const birthdaysThisMonth = users.filter((u) => {
    if (!u.birthDate) return false;
    return Number(u.birthDate.split('-')[1]) === curMonth;
  }).length;

  const pendingForms = forms.filter((f) => {
    if (!f.active) return false;
    const matchPastoral = isGeneralAdmin(user) || f.pastoralId === 'all' || accessibleIds.includes(f.pastoralId);
    if (!matchPastoral) return false;
    const already = responses.some((r) => r.formId === f.id && r.userId === user.id);
    return !already;
  }).length;

  const roleSummary = getUserRoleSummary(user, pastorals);
  const myMemberships = getUserMemberships(user);

  container.innerHTML = `
    <div class="space-y-6">
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
          </div>

          <h3 class="text-2xl font-extrabold text-[#3E2723]">
            Paz e bem, ${escapeHtml(getFirstName(user.name))}!
          </h3>

          <div class="flex items-center gap-1.5 flex-wrap">
            ${
              isGeneralAdmin(user)
                ? `<span class="text-xs text-[#6D4C41] font-medium">Acesso integral de Administração Paroquial em todas as ${pastorals.length} pastorais.</span>`
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
          <button type="button" data-nav="schedules"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs sm:text-sm font-semibold shadow-sm transition">
            <i data-lucide="calendar-check-2" class="w-4 h-4 text-amber-400"></i>
            Minhas Escalas
          </button>
        </div>
      </div>

      <!-- Aviso Fixado -->
      ${
        pinnedNotice
          ? `
        <section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-[#FDFBF7] to-white border-2 border-amber-400/80 p-5 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0 shadow-sm">
                <i data-lucide="pin" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    Aviso Fixado
                  </span>
                  ${
                    pinnedNotice.pastoralId === 'all'
                      ? renderPastoralPill(null, { compact: true })
                      : renderPastoralPill(pastoralMap[pinnedNotice.pastoralId], { compact: true })
                  }
                  <span class="text-xs text-[#6D4C41]">${escapeHtml(formatDateTimeBR(pinnedNotice.createdAt))}</span>
                </div>
                <h4 class="text-base font-bold text-[#3E2723]">${escapeHtml(pinnedNotice.title)}</h4>
                <p class="text-sm text-[#4E342E] mt-1 leading-relaxed">${escapeHtml(pinnedNotice.content)}</p>
                <p class="text-xs text-[#8D6E63] mt-2 font-medium">Publicado por ${escapeHtml(userMap[pinnedNotice.authorId]?.name || 'Coordenação')}</p>
              </div>
            </div>
            <button type="button" data-nav="notices"
              class="shrink-0 self-start text-xs font-bold text-[#92400E] hover:text-[#3E2723] bg-white hover:bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg transition">
              Ver todos os avisos
            </button>
          </div>
        </section>
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
                <g stroke="#F59E0B" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round">
                  <line x1="100" y1="16" x2="100" y2="30"/>
                  <line x1="56" y1="32" x2="64" y2="42"/>
                  <line x1="144" y1="32" x2="136" y2="42"/>
                  <line x1="36" y1="64" x2="49" y2="68"/>
                  <line x1="164" y1="64" x2="151" y2="68"/>
                </g>
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
        <button type="button" data-nav="schedules"
          class="text-left bg-white rounded-2xl p-5 border border-[#E6DACE] hover:border-[#D97706] shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Minhas Próximas</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] flex items-center justify-center group-hover:bg-[#B45309] group-hover:text-white transition">
              <i data-lucide="calendar-check-2" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#3E2723] mt-3">${myUpcomingAssignments.length}</p>
          <p class="text-xs text-[#8D6E63] mt-0.5">posições escaladas</p>
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
          <p class="text-xs text-[#8D6E63] mt-0.5">neste mês na paróquia</p>
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
          <p class="text-xs text-[#8D6E63] mt-0.5">aguardando resposta</p>
        </button>

        ${
          isAnyCoordinator(user)
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
              <span class="text-xs font-semibold text-[#6D4C41] uppercase tracking-wider">Minha Presença</span>
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
              <h4 class="text-base font-bold text-[#3E2723]">Minhas Próximas Escalas</h4>
              <p class="text-xs text-[#6D4C41]">Seus próximos 3 compromissos unificados entre todas as pastorais</p>
            </div>
          </div>
          <button type="button" data-nav="schedules"
            class="text-xs font-bold text-[#B45309] hover:text-[#3E2723] flex items-center gap-1 transition">
            Ver todas
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
              <p class="text-xs text-[#8D6E63] mt-1">Consulte o módulo Escalas ou altere o filtro de pastoral acima.</p>
            </div>
          `
              : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${nextThree
                .map(({ schedule: sch, assignment: asg, pastoral, roleName, hasConflict }) => `
                  <article class="rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50/50 to-white p-4 flex flex-col justify-between gap-3 shadow-xs">
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        ${renderPastoralPill(pastoral, { compact: true })}
                        <span class="text-xs font-extrabold text-[#3E2723]">${escapeHtml(sch.time)}</span>
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
                              Conflito: outra escala no mesmo horário
                            </div>`
                          : ''
                      }
                      ${
                        asg.substitutionRequested
                          ? `<div class="text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                              <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0"></i>
                              Substituição solicitada
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
    renderDashboard(container, { user, navigate, setHeaderContext });
  });

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  refreshIcons();
}
