/**
 * Módulo 1: Início (Dashboard)
 * Boas-vindas, Aviso Fixado, Banner Devocional (Marcos 10:45 + São Tarcísio)
 * e Widget "Minhas Próximas Escalas" (próximos 3 compromissos).
 */

import { dataService } from '../services/dataService.js';
import {
  escapeHtml,
  formatDateBR,
  formatDateTimeBR,
  formatWeekdayBR,
  getCategoryBadgeClass,
  getCategoryDisplayLabel,
  getFirstName,
  getTodayISO,
  isCoordinator,
  refreshIcons,
} from '../utils/helpers.js';

export function renderDashboard(container, { user, navigate }) {
  const todayISO = getTodayISO();
  const notices = dataService.getNotices();
  const pinnedNotice = notices.find((n) => n.pinned) || null;
  const schedules = dataService.getSchedules();
  const roles = dataService.getRoles();
  const users = dataService.getUsers();
  const forms = dataService.getForms();
  const responses = dataService.getResponses();

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // Próximas 3 escalas em que o usuário logado está escalado
  const myUpcoming = schedules
    .filter((s) => s.date >= todayISO && s.assignments.some((a) => a.userId === user.id))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .slice(0, 3);

  // Estatísticas auxiliares
  const curMonth = new Date().getMonth() + 1;
  const birthdaysThisMonth = users.filter((u) => {
    if (!u.birthDate) return false;
    const m = Number(u.birthDate.split('-')[1]);
    return m === curMonth;
  }).length;

  const pendingSubstitutions = schedules.reduce(
    (acc, s) => acc + s.assignments.filter((a) => a.substitutionRequested).length,
    0,
  );

  const pendingFormsForUser = forms.filter((f) => {
    if (!f.active) return false;
    const matchAudience = isCoordinator(user) || f.audience === 'Todos' || f.audience === user.category;
    const alreadyAnswered = responses.some((r) => r.formId === f.id && r.userId === user.id);
    return matchAudience && !alreadyAnswered;
  }).length;

  const catLabel = getCategoryDisplayLabel(user.category, user.name);
  const pinnedAuthor = pinnedNotice ? userMap[pinnedNotice.authorId]?.name || 'Coordenação' : '';

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Saudação -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <h3 class="text-2xl font-extrabold text-[#0F172A]">
              Paz e bem, ${escapeHtml(getFirstName(user.name))}!
            </h3>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadgeClass(user.category)}">
              ${escapeHtml(catLabel)}
            </span>
          </div>
          <p class="text-sm text-slate-500 mt-1">
            Bem-vindo(a) ao portal da Pastoral dos Coroinhas e Acólitos • Paróquia Santa Teresa d'Ávila.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" data-nav="schedules"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-xs sm:text-sm font-semibold shadow-sm transition">
            <i data-lucide="calendar-check" class="w-4 h-4 text-amber-400"></i>
            Ver Minhas Escalas
          </button>
          <button type="button" data-nav="agenda"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold transition">
            <i data-lucide="calendar-days" class="w-4 h-4 text-[#1E3A8A]"></i>
            Agenda
          </button>
        </div>
      </div>

      <!-- Aviso Fixado no Topo -->
      ${
        pinnedNotice
          ? `
        <section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/70 to-white border-2 border-amber-300/90 p-5 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <i data-lucide="pin" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    Aviso Fixado pela Coordenação
                  </span>
                  <span class="text-xs text-slate-500">${escapeHtml(formatDateTimeBR(pinnedNotice.createdAt))}</span>
                </div>
                <h4 class="text-base font-bold text-[#0F172A]">${escapeHtml(pinnedNotice.title)}</h4>
                <p class="text-sm text-slate-700 mt-1 leading-relaxed">${escapeHtml(pinnedNotice.content)}</p>
                <p class="text-xs text-slate-500 mt-2 font-medium">Publicado por ${escapeHtml(pinnedAuthor)}</p>
              </div>
            </div>
            <button type="button" data-nav="notices"
              class="shrink-0 self-start text-xs font-bold text-amber-800 hover:text-amber-950 bg-white hover:bg-amber-100/80 border border-amber-300 px-3 py-1.5 rounded-lg transition">
              Ver todos os avisos
            </button>
          </div>
        </section>
      `
          : ''
      }

      <!-- Banner Devocional -->
      <section class="devotional-pattern rounded-3xl text-white p-6 sm:p-8 shadow-lg border border-blue-900/40 relative overflow-hidden">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div class="lg:col-span-8 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 text-xs font-semibold tracking-wide">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              Espiritualidade do Serviço ao Altar
            </div>
            <blockquote class="font-serif text-xl sm:text-2xl lg:text-[26px] font-semibold leading-snug text-white">
              “Pois o Filho do Homem não veio para ser servido, mas para servir.”
            </blockquote>
            <p class="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">— Marcos 10:45</p>

            <div class="pt-3 border-t border-white/15 flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-white/10 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
                <i data-lucide="heart-handshake" class="w-4 h-4"></i>
              </div>
              <p class="text-sm text-slate-200 leading-relaxed">
                <strong class="text-amber-300">São Tarcísio, padroeiro dos coroinhas e acólitos:</strong>
                “A minha vida vale menos que o Corpo de Cristo; servir ao altar com amor e reverência é a nossa maior honra.”
              </p>
            </div>
          </div>

          <!-- Ilustração Vetorial Sacra/Litúrgica -->
          <div class="lg:col-span-4 flex justify-center lg:justify-end">
            <div class="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-white/[0.04] border border-amber-400/25 flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 200 200" class="w-40 h-40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Ilustração litúrgica de cálice e hóstia radiante">
                <!-- Raios dourados -->
                <g stroke="#F59E0B" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round">
                  <line x1="100" y1="14" x2="100" y2="28"/>
                  <line x1="100" y1="100" x2="100" y2="112" stroke-opacity="0"/>
                  <line x1="56" y1="30" x2="64" y2="40"/>
                  <line x1="144" y1="30" x2="136" y2="40"/>
                  <line x1="36" y1="64" x2="49" y2="67"/>
                  <line x1="164" y1="64" x2="151" y2="67"/>
                </g>
                <!-- Hóstia Sagrada -->
                <circle cx="100" cy="64" r="24" fill="#FFFBEB" fill-opacity="0.12" stroke="#FBBF24" stroke-width="2.2"/>
                <path d="M100 50V78M90 61H110" stroke="#FDE68A" stroke-width="2.4" stroke-linecap="round"/>
                <!-- Cálice Litúrgico -->
                <path d="M68 96H132C132 117 118 131 100 131C82 131 68 117 68 96Z" fill="#F59E0B" fill-opacity="0.22" stroke="#FBBF24" stroke-width="2.4" stroke-linejoin="round"/>
                <line x1="100" y1="131" x2="100" y2="162" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
                <circle cx="100" cy="145" r="5" fill="#F59E0B"/>
                <path d="M74 170C74 164 85 161 100 161C115 161 126 164 126 170H74Z" fill="#F59E0B" fill-opacity="0.28" stroke="#FBBF24" stroke-width="2.2" stroke-linejoin="round"/>
                <!-- Estrelas sutis -->
                <circle cx="52" cy="108" r="2" fill="#FDE68A" fill-opacity="0.7"/>
                <circle cx="150" cy="108" r="2" fill="#FDE68A" fill-opacity="0.7"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- Cards de Indicadores Rápidos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button type="button" data-nav="schedules"
          class="text-left bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-amber-400 shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Minhas Próximas</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition">
              <i data-lucide="calendar-check-2" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#0F172A] mt-3">${myUpcoming.length}</p>
          <p class="text-xs text-slate-500 mt-0.5">escalas agendadas</p>
        </button>

        <button type="button" data-nav="birthdays"
          class="text-left bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-blue-400 shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aniversariantes</span>
            <div class="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center group-hover:bg-[#1E3A8A] group-hover:text-white transition">
              <i data-lucide="cake" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#0F172A] mt-3">${birthdaysThisMonth}</p>
          <p class="text-xs text-slate-500 mt-0.5">neste mês</p>
        </button>

        <button type="button" data-nav="forms"
          class="text-left bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-md transition group">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Formulários</span>
            <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
              <i data-lucide="clipboard-list" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#0F172A] mt-3">${pendingFormsForUser}</p>
          <p class="text-xs text-slate-500 mt-0.5">aguardando resposta</p>
        </button>

        ${
          isCoordinator(user)
            ? `
          <button type="button" data-nav="schedules"
            class="text-left bg-white rounded-2xl p-5 border ${pendingSubstitutions > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/90'} hover:border-amber-500 shadow-xs hover:shadow-md transition group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Substituições</span>
              <div class="w-9 h-9 rounded-xl ${pendingSubstitutions > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center transition">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              </div>
            </div>
            <p class="text-2xl font-extrabold text-[#0F172A] mt-3">${pendingSubstitutions}</p>
            <p class="text-xs text-slate-500 mt-0.5">pedidos pendentes</p>
          </button>
        `
            : `
          <button type="button" data-nav="attendance"
            class="text-left bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-emerald-400 shadow-xs hover:shadow-md transition group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Minha Presença</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                <i data-lucide="check-square" class="w-4 h-4"></i>
              </div>
            </div>
            <p class="text-2xl font-extrabold text-[#0F172A] mt-3">Acompanhar</p>
            <p class="text-xs text-slate-500 mt-0.5">frequência em missas e ensaios</p>
          </button>
        `
        }
      </div>

      <!-- Widget: Minhas Próximas Escalas -->
      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#0F172A] text-amber-400 flex items-center justify-center">
              <i data-lucide="calendar-heart" class="w-4 h-4"></i>
            </div>
            <div>
              <h4 class="text-base font-bold text-[#0F172A]">Minhas Próximas Escalas</h4>
              <p class="text-xs text-slate-500">Seus próximos 3 compromissos no serviço ao altar</p>
            </div>
          </div>
          <button type="button" data-nav="schedules"
            class="text-xs font-bold text-[#1E3A8A] hover:text-amber-600 flex items-center gap-1 transition">
            Ver escala completa
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <div class="p-6">
          ${
            myUpcoming.length === 0
              ? `
            <div class="text-center py-8 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <i data-lucide="calendar-off" class="w-8 h-8 text-slate-400 mx-auto mb-2"></i>
              <p class="text-sm font-semibold text-slate-700">Você não possui escalas futuras cadastradas no momento.</p>
              <p class="text-xs text-slate-500 mt-1">Acompanhe a aba Escalas para conferir as próximas publicações da coordenação.</p>
            </div>
          `
              : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${myUpcoming
                .map((sch) => {
                  const myAsg = sch.assignments.filter((a) => a.userId === user.id);
                  const myRoleLabels = myAsg.map((a) => roleMap[a.roleId] || 'Função').join(', ');
                  const hasSub = myAsg.some((a) => a.substitutionRequested);
                  return `
                    <article class="rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/50 to-white p-4 flex flex-col justify-between gap-3 shadow-xs">
                      <div>
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            <i data-lucide="star" class="w-3 h-3"></i>
                            Sua Escala
                          </span>
                          <span class="text-xs font-bold text-[#1E3A8A]">${escapeHtml(sch.time)}</span>
                        </div>
                        <h5 class="font-bold text-[#0F172A] text-sm">${escapeHtml(sch.celebrationType)}</h5>
                        <p class="text-xs text-slate-500 mt-0.5 capitalize">${escapeHtml(formatWeekdayBR(sch.date))}, ${escapeHtml(formatDateBR(sch.date))}</p>

                        <div class="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div class="flex items-center gap-2">
                            <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i>
                            <span class="font-medium">${escapeHtml(sch.location)}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <i data-lucide="bookmark-check" class="w-3.5 h-3.5 text-[#1E3A8A] shrink-0"></i>
                            <span>Função: <strong class="text-[#0F172A]">${escapeHtml(myRoleLabels)}</strong></span>
                          </div>
                        </div>
                      </div>

                      ${
                        hasSub
                          ? `<div class="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                              <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0"></i>
                              Substituição solicitada
                            </div>`
                          : ''
                      }
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      </section>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  refreshIcons();
}
