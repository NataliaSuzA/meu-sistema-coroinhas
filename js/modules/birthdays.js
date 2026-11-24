/**
 * Módulo 10: Aniversariantes
 * Puxa automaticamente a data de nascimento do cadastro de usuários,
 * exibe os aniversariantes do mês atual, destaca quem faz aniversário hoje
 * e permite filtrar por qualquer outro mês.
 */

import { dataService } from '../services/dataService.js';
import {
  escapeHtml,
  getCategoryBadgeClass,
  getInitials,
  MONTHS_PT,
  refreshIcons,
} from '../utils/helpers.js';

let selectedMonth = new Date().getMonth() + 1; // 1..12

function parseMonthDay(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return null;
  const parts = isoDate.split('-').map(Number);
  if (parts.length < 3 || Number.isNaN(parts[1]) || Number.isNaN(parts[2])) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function cleanPhoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function renderBirthdays(container) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const currentYear = today.getFullYear();

  const users = dataService.getUsers();
  const birthdaysInMonth = users
    .map((u) => {
      const parsed = parseMonthDay(u.birthDate);
      if (!parsed || parsed.month !== selectedMonth) return null;
      return {
        ...u,
        bDay: parsed.day,
        bMonth: parsed.month,
        ageTurning: currentYear - parsed.year,
        isToday: parsed.month === todayMonth && parsed.day === todayDay,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.bDay - b.bDay);

  const todayBirthdays = birthdaysInMonth.filter((b) => b.isToday);

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Aniversariantes da Pastoral</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Integrado automaticamente ao cadastro de membros. Celebre a vida de quem serve ao altar!
          </p>
        </div>

        <div class="flex items-center gap-2">
          <label for="bday-month-select" class="text-xs font-bold uppercase tracking-wider text-slate-500">Mês:</label>
          <select id="bday-month-select"
            class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#0F172A] outline-none focus:border-[#1E3A8A]">
            ${MONTHS_PT.map(
              (mName, i) => `<option value="${i + 1}" ${selectedMonth === i + 1 ? 'selected' : ''}>${mName}${i + 1 === todayMonth ? ' (Atual)' : ''}</option>`,
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Destaque Aniversariante de Hoje -->
      ${
        todayBirthdays.length > 0
          ? `
        <section class="rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#1E3A8A] text-white p-6 shadow-lg border border-amber-400/40 relative overflow-hidden">
          <div class="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-[0.18em] mb-3">
            <i data-lucide="party-popper" class="w-4 h-4"></i>
            Parabéns! Aniversariante de Hoje
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${todayBirthdays
              .map((b) => {
                const wa = cleanPhoneForWhatsApp(b.phone);
                const msg = encodeURIComponent(
                  `Paz e bem, ${b.name}! Parabéns pelo seu aniversário! Que Deus e Santa Teresa d'Ávila abençoem sempre sua vida e sua missão na Pastoral dos Coroinhas e Acólitos!`,
                );
                return `
                  <div class="rounded-2xl bg-white/10 backdrop-blur-xs border border-amber-400/35 p-4 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5 min-w-0">
                      <div class="w-12 h-12 rounded-2xl bg-amber-500 text-[#0F172A] font-extrabold text-sm flex items-center justify-center shrink-0 shadow">
                        ${escapeHtml(getInitials(b.name))}
                      </div>
                      <div class="min-w-0">
                        <h4 class="font-extrabold text-white truncate">${escapeHtml(b.name)}</h4>
                        <p class="text-xs text-amber-200 font-semibold">${escapeHtml(b.category)} • ${String(b.bDay).padStart(2, '0')}/${String(b.bMonth).padStart(2, '0')}</p>
                      </div>
                    </div>
                    ${
                      wa
                        ? `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener noreferrer"
                            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0F172A] text-xs font-extrabold transition">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                            Parabenizar
                          </a>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- Grade do Mês Selecionado -->
      <section class="space-y-3">
        <h4 class="text-sm font-bold uppercase tracking-wider text-slate-500">
          Aniversariantes de ${MONTHS_PT[selectedMonth - 1]} (${birthdaysInMonth.length})
        </h4>

        ${
          birthdaysInMonth.length === 0
            ? `
          <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <i data-lucide="cake" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
            <p class="text-sm font-semibold text-slate-700">Nenhum aniversariante cadastrado em ${MONTHS_PT[selectedMonth - 1]}.</p>
          </div>
        `
            : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${birthdaysInMonth
              .map((b) => {
                const wa = cleanPhoneForWhatsApp(b.phone);
                const msg = encodeURIComponent(
                  `Paz e bem, ${b.name}! Feliz aniversário! Deus abençoe muito sua caminhada na Pastoral dos Coroinhas e Acólitos!`,
                );
                return `
                  <article class="bg-white rounded-2xl border-2 ${
                    b.isToday ? 'border-amber-400 bg-amber-50/40 shadow-md' : 'border-slate-200/90'
                  } p-5 flex flex-col justify-between gap-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-xl ${
                          b.isToday ? 'bg-amber-500 text-white' : 'bg-[#0F172A] text-amber-400'
                        } font-extrabold text-xs flex items-center justify-center shrink-0">
                          ${escapeHtml(getInitials(b.name))}
                        </div>
                        <div class="min-w-0">
                          <h5 class="font-bold text-[#0F172A] truncate">${escapeHtml(b.name)}</h5>
                          <span class="inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(b.category)}">
                            ${escapeHtml(b.category)}
                          </span>
                        </div>
                      </div>
                      <div class="text-center px-2.5 py-1.5 rounded-xl ${
                        b.isToday ? 'bg-amber-500 text-white' : 'bg-slate-100 text-[#0F172A]'
                      } shrink-0">
                        <p class="text-base font-extrabold leading-none">${String(b.bDay).padStart(2, '0')}</p>
                        <p class="text-[10px] font-bold uppercase mt-0.5">${MONTHS_PT[b.bMonth - 1].slice(0, 3)}</p>
                      </div>
                    </div>

                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span class="text-slate-500 font-medium">
                        ${b.isToday ? '<strong class="text-amber-700">Faz aniversário hoje!</strong>' : `Completa ${b.ageTurning} anos`}
                      </span>
                      ${
                        wa
                          ? `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 font-bold text-[#1E3A8A] hover:text-amber-600 transition">
                              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                              WhatsApp
                            </a>`
                          : ''
                      }
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
        `
        }
      </section>
    </div>
  `;

  container.querySelector('#bday-month-select').addEventListener('change', (e) => {
    selectedMonth = Number(e.target.value);
    renderBirthdays(container);
  });

  refreshIcons();
}
