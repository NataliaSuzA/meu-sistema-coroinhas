/**
 * Módulo 10: Aniversariantes + Mural de Parabéns (Individualizado por Integrante)
 * - Lê a Data de Nascimento de cada integrante individualmente (inclusive irmãos em Contas Familiares).
 * - Cada irmão aparece no seu respectivo mês de aniversário com seu próprio card e Mural de Parabéns.
 */

import { dataService } from '../services/dataService.js';
import {
  cleanPhoneForWhatsApp,
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  getAccountMembers,
  getInitials,
  getUserMemberships,
  isFamilyAccount,
  isGeneralAdmin,
  MONTHS_PT,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

const QUICK_BIRTHDAY_MESSAGES = [
  "Feliz aniversário! Que Deus e Santa Teresa d'Ávila abençoem muito sua vida e missão!",
  'Parabéns pelo seu dia! Muita saúde, paz e alegria no serviço à nossa paróquia!',
  'Que o Senhor ilumine sempre seus caminhos e renove suas forças. Feliz aniversário!',
  'Feliz vida! Obrigado(a) por toda dedicação e carinho na nossa comunidade paroquial!',
];

let selectedMonth = new Date().getMonth() + 1;
let selectedPastoralId = 'all';

function parseMonthDay(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return null;
  const parts = isoDate.split('-').map(Number);
  if (parts.length < 3 || Number.isNaN(parts[1]) || Number.isNaN(parts[2])) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

export function renderBirthdays(container, { user }) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const currentYear = today.getFullYear();

  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // Desdobra todas as contas em integrantes individuais para ler a data de nascimento de cada irmão
  const birthdaysInMonth = [];
  users.forEach((u) => {
    if (selectedPastoralId !== 'all') {
      const inPastoral = getUserMemberships(u).some((m) => m.pastoralId === selectedPastoralId);
      if (!inPastoral) return;
    }
    const members = getAccountMembers(u);
    const isFam = isFamilyAccount(u);

    members.forEach((member) => {
      const parsed = parseMonthDay(member.birthDate);
      if (!parsed || parsed.month !== selectedMonth) return;
      birthdaysInMonth.push({
        id: member.id,
        accountId: u.id,
        name: member.name,
        birthDate: member.birthDate,
        phone: u.phone,
        isGeneralAdmin: u.isGeneralAdmin,
        memberships: u.memberships,
        isFamily: isFam,
        accountName: u.name,
        bDay: parsed.day,
        bMonth: parsed.month,
        ageTurning: currentYear - parsed.year,
        isToday: parsed.month === todayMonth && parsed.day === todayDay,
        wallMessages: dataService.getBirthdayMessagesForUser(member.id),
      });
    });
  });

  birthdaysInMonth.sort((a, b) => a.bDay - b.bDay);
  const todayBirthdays = birthdaysInMonth.filter((b) => b.isToday);

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Aniversariantes &amp; Mural de Parabéns</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Celebre a vida de cada integrante da paróquia (incluindo cada irmão de contas familiares) deixando um recado!
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <select id="bday-pastoral-select"
            class="px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-xs sm:text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
            <option value="all" ${selectedPastoralId === 'all' ? 'selected' : ''}>Todas as Pastorais</option>
            ${pastorals
              .map((p) => `<option value="${p.id}" ${selectedPastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`)
              .join('')}
          </select>

          <select id="bday-month-select"
            class="px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-xs sm:text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
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
        <section class="rounded-3xl bg-gradient-to-r from-[#2B1B18] via-[#3E2723] to-[#5D4037] text-white p-6 shadow-lg border border-amber-400/40 relative overflow-hidden">
          <div class="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-[0.18em] mb-3">
            <i data-lucide="party-popper" class="w-4 h-4"></i>
            Parabéns! Aniversariante de Hoje
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${todayBirthdays
              .map((b) => {
                const wa = cleanPhoneForWhatsApp(b.phone);
                const msg = encodeURIComponent(
                  `Paz e bem! Parabéns pelo aniversário de ${b.name}! Que Deus e Santa Teresa d'Ávila abençoem sempre sua vida e missão!`,
                );
                const pNames = getUserMemberships(b)
                  .map((m) => pastoralMap[m.pastoralId]?.shortName)
                  .filter(Boolean)
                  .join(' • ');
                return `
                  <div class="rounded-2xl bg-white/10 backdrop-blur-xs border border-amber-400/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3.5 min-w-0">
                      <div class="w-12 h-12 rounded-2xl bg-amber-500 text-[#2B1B18] font-extrabold text-sm flex items-center justify-center shrink-0 shadow">
                        ${escapeHtml(getInitials(b.name))}
                      </div>
                      <div class="min-w-0">
                        <h4 class="font-extrabold text-white truncate">${escapeHtml(b.name)}</h4>
                        <p class="text-xs text-amber-200 font-semibold truncate">${escapeHtml(pNames || 'Paróquia Santa Teresa')} • ${String(b.bDay).padStart(2, '0')}/${String(b.bMonth).padStart(2, '0')}</p>
                        <p class="text-[11px] text-amber-100/80 mt-0.5">${b.wallMessages.length} ${b.wallMessages.length === 1 ? 'recado no mural' : 'recados no mural'}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button type="button" data-congrats-mid="${b.id}"
                        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#2B1B18] text-xs font-extrabold transition">
                        <i data-lucide="heart" class="w-3.5 h-3.5"></i>
                        Deixar Parabéns
                      </button>
                      ${
                        wa
                          ? `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener noreferrer" title="Enviar parabéns no WhatsApp"
                              class="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition">
                              <i data-lucide="message-circle" class="w-4 h-4"></i>
                            </a>`
                          : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- Cards do Mês + Mini-Mural de Parabéns -->
      <section class="space-y-3">
        <h4 class="text-sm font-bold uppercase tracking-wider text-[#6D4C41]">
          Aniversariantes de ${MONTHS_PT[selectedMonth - 1]} (${birthdaysInMonth.length})
        </h4>

        ${
          birthdaysInMonth.length === 0
            ? `
          <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
            <i data-lucide="cake" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
            <p class="text-sm font-semibold text-[#4E342E]">Nenhum aniversariante encontrado para este filtro em ${MONTHS_PT[selectedMonth - 1]}.</p>
          </div>
        `
            : `
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            ${birthdaysInMonth
              .map((b) => {
                const wa = cleanPhoneForWhatsApp(b.phone);
                const msg = encodeURIComponent(
                  `Paz e bem! Feliz aniversário para ${b.name}! Deus abençoe muito sua caminhada na Paróquia Santa Teresa d'Ávila!`,
                );
                const mems = getUserMemberships(b);
                return `
                  <article class="bg-white rounded-2xl border-2 ${
                    b.isToday ? 'border-amber-400 bg-amber-50/30 shadow-md' : 'border-[#E6DACE]'
                  } p-5 flex flex-col justify-between gap-4">
                    <div class="space-y-4">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-11 h-11 rounded-xl ${
                            b.isToday ? 'bg-[#D97706] text-white' : 'bg-[#3E2723] text-amber-400'
                          } font-extrabold text-xs flex items-center justify-center shrink-0">
                            ${escapeHtml(getInitials(b.name))}
                          </div>
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <h5 class="font-extrabold text-[#3E2723] truncate">${escapeHtml(b.name)}</h5>
                              ${
                                b.isFamily
                                  ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-[#78350F] border border-amber-300">
                                      <i data-lucide="users" class="w-3 h-3"></i>
                                      Conta Familiar
                                    </span>`
                                  : ''
                              }
                            </div>
                            <div class="flex items-center gap-1 flex-wrap mt-1">
                              ${
                                b.isGeneralAdmin
                                  ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#92400E] border border-amber-300">Coord. Geral</span>`
                                  : mems.map((m) => renderPastoralPill(pastoralMap[m.pastoralId], { compact: true })).join('')
                              }
                            </div>
                          </div>
                        </div>
                        <div class="text-center px-2.5 py-1.5 rounded-xl ${
                          b.isToday ? 'bg-[#D97706] text-white' : 'bg-[#F5EFE6] text-[#3E2723]'
                        } shrink-0">
                          <p class="text-base font-extrabold leading-none">${String(b.bDay).padStart(2, '0')}</p>
                          <p class="text-[10px] font-bold uppercase mt-0.5">${MONTHS_PT[b.bMonth - 1].slice(0, 3)}</p>
                        </div>
                      </div>

                      <!-- Mini-Mural de Parabéns -->
                      <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-3.5 space-y-2.5">
                        <div class="flex items-center justify-between">
                          <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#5D4037] flex items-center gap-1.5">
                            <i data-lucide="message-square-heart" class="w-3.5 h-3.5 text-[#B45309]"></i>
                            Mural de Parabéns (${b.wallMessages.length})
                          </span>
                          <span class="text-[11px] text-[#8D6E63] font-medium">
                            ${b.isToday ? '<strong class="text-[#B45309]">Hoje!</strong>' : `Completa ${b.ageTurning} anos`}
                          </span>
                        </div>

                        ${
                          b.wallMessages.length === 0
                            ? `<p class="text-xs text-[#8D6E63] italic">Seja o primeiro a deixar um recado de parabéns!</p>`
                            : `
                          <div class="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                            ${b.wallMessages
                              .map((wm) => {
                                const authorName = userMap[wm.authorId]?.name || 'Membro da Paróquia';
                                return `
                                  <div class="rounded-lg bg-white border border-[#E6DACE]/80 p-2.5 text-xs">
                                    <p class="text-[#3E2723] leading-relaxed">“${escapeHtml(wm.message)}”</p>
                                    <div class="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#8D6E63]">
                                      <span class="font-bold text-[#5D4037]">${escapeHtml(authorName)} • ${escapeHtml(wm.authorPastoralLabel)}</span>
                                      <span>${escapeHtml(formatDateTimeBR(wm.createdAt))}</span>
                                    </div>
                                  </div>
                                `;
                              })
                              .join('')}
                          </div>
                        `
                        }
                      </div>
                    </div>

                    <div class="pt-3 border-t border-[#E6DACE]/70 flex items-center justify-between gap-2 flex-wrap">
                      <button type="button" data-congrats-mid="${b.id}"
                        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs font-bold transition">
                        <i data-lucide="heart" class="w-3.5 h-3.5 text-amber-400"></i>
                        Deixar Parabéns
                      </button>
                      ${
                        wa
                          ? `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener noreferrer"
                              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition">
                              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                              WhatsApp${b.isFamily ? ' (Resp.)' : ''}
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
    renderBirthdays(container, { user });
  });

  container.querySelector('#bday-pastoral-select').addEventListener('change', (e) => {
    selectedPastoralId = e.target.value;
    renderBirthdays(container, { user });
  });

  container.querySelectorAll('[data-congrats-mid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const recipient = birthdaysInMonth.find((b) => b.id === btn.dataset.congratsMid);
      if (recipient) {
        openCongratsModal(recipient, user, pastoralMap, () => renderBirthdays(container, { user }));
      }
    });
  });

  refreshIcons();
}

function openCongratsModal(recipient, author, pastoralMap, onSaved) {
  const authorPastoralLabel = isGeneralAdmin(author)
    ? 'Coordenação Geral'
    : getUserMemberships(author)
        .map((m) => pastoralMap[m.pastoralId]?.shortName)
        .filter(Boolean)
        .join(', ') || "Paróquia Santa Teresa d'Ávila";

  openModal({
    title: `Deixar Parabéns para ${recipient.name.split(' ')[0]}`,
    maxWidth: 'max-w-xl',
    bodyHtml: `
      <form id="congrats-form" class="space-y-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-2">Mensagens rápidas prontas (clique para preencher):</p>
          <div class="space-y-1.5">
            ${QUICK_BIRTHDAY_MESSAGES.map(
              (msg, idx) => `
              <button type="button" data-quick-msg="${idx}"
                class="w-full text-left text-xs text-[#3E2723] bg-[#FAF6F0] hover:bg-amber-50 border border-[#E6DACE] hover:border-amber-300 rounded-xl px-3 py-2 transition">
                “${escapeHtml(msg)}”
              </button>
            `,
            ).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Seu Recado Personalizado *</label>
          <textarea id="congrats-textarea" name="message" rows="3" required placeholder="Escreva sua mensagem de parabéns..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-congrats-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold transition flex items-center gap-1.5">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            Publicar no Mural
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const textarea = bodyEl.querySelector('#congrats-textarea');
      bodyEl.querySelectorAll('[data-quick-msg]').forEach((btn) => {
        btn.addEventListener('click', () => {
          textarea.value = QUICK_BIRTHDAY_MESSAGES[Number(btn.dataset.quickMsg)] || '';
          textarea.focus();
        });
      });
      bodyEl.querySelector('#cancel-congrats-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#congrats-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const message = textarea.value.trim();
        if (!message) return;
        dataService.addBirthdayMessage({
          recipientUserId: recipient.id,
          authorId: author.id,
          authorPastoralLabel,
          message,
        });
        closeModal();
        showToast(`Parabéns publicado no mural de ${recipient.name.split(' ')[0]}!`);
        onSaved();
      });
    },
  });
}
