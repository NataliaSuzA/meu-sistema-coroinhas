/**
 * Módulo "Liturgia Diária" + Roteiro do Celebrante
 * - Carregamento real da Liturgia Diária do Brasil (API Railway v2 -> fallback Vercel -> local)
 * - Navegação por datas (← Dia Anterior / Calendário / Hoje / Próximo Dia →)
 * - Controle de tamanho da fonte para leitura confortável no celular (A- / A / A+)
 * - Seletor de Celebração/Roteiro quando há escalas na paróquia para a data selecionada
 * - Abas: Leituras & Evangelho | Oração Eucarística & Rito (9 OEs integrais) | Roteiro do Celebrante
 */

import { dataService } from '../services/dataService.js';
import { liturgyService } from '../services/liturgyService.js';
import { EUCHARISTIC_PRAYERS, getEucharisticPrayerById } from '../services/eucharisticPrayers.js';
import {
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getTodayISO,
  refreshIcons,
  renderPastoralPill,
} from '../utils/helpers.js';

let selectedDateISO = getTodayISO();
let selectedScheduleId = 'standard'; // 'standard' | schedule.id
let activeTab = 'readings'; // 'readings' | 'eucharistic' | 'script'
let manualOEOverride = null; // Permite ler qualquer OE na aba sem alterar a escala
let fontScale = 1; // 0 = pequeno, 1 = normal, 2 = grande, 3 = extra grande

const FONT_CLASSES = [
  'text-xs sm:text-sm leading-relaxed',
  'text-sm sm:text-base leading-relaxed',
  'text-base sm:text-lg leading-loose',
  'text-lg sm:text-xl leading-loose',
];

export function setLiturgyViewTarget(dateISO, scheduleId = 'standard') {
  selectedDateISO = dateISO || getTodayISO();
  selectedScheduleId = scheduleId || 'standard';
  manualOEOverride = null;
  activeTab = 'readings';
}

function shiftDateISO(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getLiturgicalColorStyle(cor) {
  const c = String(cor || 'Verde').toLowerCase();
  if (c.includes('branc') || c.includes('dourad')) {
    return { dot: '#D97706', cls: 'bg-amber-50 text-[#78350F] border-amber-300', label: cor || 'Branco' };
  }
  if (c.includes('vermelh')) {
    return { dot: '#B91C1C', cls: 'bg-red-50 text-red-800 border-red-200', label: cor || 'Vermelho' };
  }
  if (c.includes('rox')) {
    return { dot: '#6D28D9', cls: 'bg-purple-50 text-purple-800 border-purple-200', label: cor || 'Roxo' };
  }
  if (c.includes('ros')) {
    return { dot: '#BE185D', cls: 'bg-pink-50 text-pink-800 border-pink-200', label: cor || 'Rosa' };
  }
  return { dot: '#15803D', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: cor || 'Verde' };
}

export async function renderLiturgy(container, { user }) {
  const renderToken = `${Date.now()}_${Math.random()}`;
  container.dataset.liturgyToken = renderToken;

  // Estado inicial de carregamento elegante
  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-[#E6DACE] p-8 text-center">
        <div class="w-10 h-10 rounded-xl bg-[#3E2723] text-amber-400 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <i data-lucide="book-open" class="w-5 h-5"></i>
        </div>
        <p class="text-sm font-bold text-[#3E2723]">Carregando Liturgia Diária de ${escapeHtml(formatDateBR(selectedDateISO))}...</p>
        <p class="text-xs text-[#8D6E63] mt-1">Consultando os textos litúrgicos oficiais do dia</p>
      </div>
    </div>
  `;
  refreshIcons();

  const liturgy = await liturgyService.fetchLiturgyByDate(selectedDateISO);
  if (container.dataset.liturgyToken !== renderToken) return; // Navegação mudou durante o fetch

  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const daySchedules = dataService
    .getSchedules()
    .filter((s) => s.date === selectedDateISO)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));

  if (selectedScheduleId !== 'standard' && !daySchedules.some((s) => s.id === selectedScheduleId)) {
    selectedScheduleId = 'standard';
  }

  const activeSchedule = selectedScheduleId === 'standard' ? null : daySchedules.find((s) => s.id === selectedScheduleId) || null;
  const specialSchedulesCount = daySchedules.filter((s) => s.celebrantScript || s.eucharisticPrayerSource === 'custom').length;

  const baseOEId =
    activeSchedule && activeSchedule.eucharisticPrayerId
      ? activeSchedule.eucharisticPrayerId
      : liturgy.defaultEucharisticPrayerId;
  const activeOEId = manualOEOverride || baseOEId;
  const activeOE = getEucharisticPrayerById(activeOEId);

  const isCustomByCelebrant =
    !manualOEOverride &&
    Boolean(activeSchedule && activeSchedule.eucharisticPrayerSource === 'custom');
  const oeOriginBadge = manualOEOverride
    ? { label: 'Selecionada para leitura livre', cls: 'bg-[#F5EFE6] text-[#4E342E] border-[#D7C4B2]' }
    : isCustomByCelebrant
      ? { label: 'Escolhida no Roteiro do Celebrante', cls: 'bg-amber-100 text-[#92400E] border-amber-400' }
      : liturgy.source === 'paulus'
        ? { label: 'Fonte: Liturgia Diária Paulus', cls: 'bg-amber-100 text-[#78350F] border-amber-400' }
        : { label: 'Padrão da Liturgia Diária', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };

  const sourceBadgeClass =
    liturgy.source === 'paulus'
      ? 'bg-amber-100 text-[#78350F] border-amber-400 font-extrabold'
      : 'bg-[#FAF6F0] text-[#6D4C41] border-[#E6DACE] font-semibold';

  const colorStyle = getLiturgicalColorStyle(liturgy.liturgicalColor);
  const textClass = FONT_CLASSES[fontScale] || FONT_CLASSES[1];

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Barra de Navegação de Data + Fonte -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] p-4 sm:p-5 shadow-xs space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <button id="lit-prev-day" type="button"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] hover:bg-[#F5EFE6] text-xs font-bold text-[#3E2723] transition">
              ← Dia Anterior
            </button>
            <input id="lit-date-picker" type="date" value="${escapeHtml(selectedDateISO)}"
              class="px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-xs sm:text-sm font-bold text-[#3E2723] outline-none focus:border-[#B45309]">
            <button id="lit-next-day" type="button"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] hover:bg-[#F5EFE6] text-xs font-bold text-[#3E2723] transition">
              Próximo Dia →
            </button>
            <button id="lit-today" type="button"
              class="px-3 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 text-xs font-bold transition">
              Hoje
            </button>
          </div>

          <!-- Controle de Tamanho de Fonte para Celular -->
          <div class="flex items-center gap-1.5 self-start lg:self-auto bg-[#FAF6F0] border border-[#E6DACE] rounded-xl px-2.5 py-1.5">
            <span class="text-[11px] font-bold text-[#6D4C41] mr-1">Fonte:</span>
            <button id="lit-font-down" type="button" class="px-2 py-1 rounded-lg bg-white hover:bg-[#F5EFE6] border border-[#E6DACE] text-xs font-extrabold text-[#3E2723]" title="Diminuir fonte">A-</button>
            <button id="lit-font-reset" type="button" class="px-2 py-1 rounded-lg bg-white hover:bg-[#F5EFE6] border border-[#E6DACE] text-xs font-extrabold text-[#3E2723]" title="Tamanho padrão">A</button>
            <button id="lit-font-up" type="button" class="px-2 py-1 rounded-lg bg-white hover:bg-[#F5EFE6] border border-[#E6DACE] text-xs font-extrabold text-[#3E2723]" title="Aumentar fonte">A+</button>
          </div>
        </div>

        <!-- Cabeçalho Litúrgico do Dia -->
        <div class="pt-3 border-t border-[#E6DACE]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${colorStyle.cls}">
                <span class="w-2 h-2 rounded-full" style="background-color:${colorStyle.dot};"></span>
                Cor Litúrgica: ${escapeHtml(colorStyle.label)}
              </span>
              <span class="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border ${sourceBadgeClass}">
                <i data-lucide="book-open" class="w-3 h-3"></i>
                ${escapeHtml(liturgy.sourceLabel)}
              </span>
            </div>
            <h3 class="font-serif text-lg sm:text-xl font-bold text-[#3E2723]">${escapeHtml(liturgy.liturgiaTitle)}</h3>
            <p class="text-xs text-[#6D4C41] capitalize mt-0.5">
              ${escapeHtml(formatWeekdayBR(selectedDateISO))}, ${escapeHtml(formatDateBR(selectedDateISO))}${liturgy.liturgicalSeason && liturgy.liturgicalSeason !== liturgy.liturgiaTitle ? ` • ${escapeHtml(liturgy.liturgicalSeason)}` : ''}
            </p>
          </div>
        </div>
      </section>

      <!-- Seletor de Celebração / Roteiro Especial do Padre -->
      ${
        daySchedules.length > 0
          ? `
        <section class="rounded-2xl border-2 ${
          activeSchedule ? 'border-amber-400 bg-amber-50/70' : 'border-[#E6DACE] bg-[#FDFBF7]'
        } p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#3E2723] text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <i data-lucide="scroll-text" class="w-4 h-4"></i>
            </div>
            <div>
              <p class="text-xs font-extrabold uppercase tracking-wider text-[#92400E]">
                Celebrações da Paróquia neste dia (${daySchedules.length}${specialSchedulesCount > 0 ? ` • ${specialSchedulesCount} com Roteiro Especial` : ''})
              </p>
              <p class="text-xs text-[#5D4037] mt-0.5">
                Alterne entre a Liturgia Padrão do Dia e o roteiro de uma missa agendada.
              </p>
            </div>
          </div>

          <select id="lit-schedule-select"
            class="px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs sm:text-sm font-bold text-[#3E2723] outline-none focus:border-[#B45309] max-w-md">
            <option value="standard" ${selectedScheduleId === 'standard' ? 'selected' : ''}>Liturgia Padrão do Dia</option>
            ${daySchedules
              .map((s) => {
                const hasSpecial = Boolean(s.celebrantScript || s.eucharisticPrayerSource === 'custom');
                return `<option value="${s.id}" ${selectedScheduleId === s.id ? 'selected' : ''}>Missa das ${escapeHtml(s.time)} — ${escapeHtml(s.location)}${hasSpecial ? ' ★ Roteiro do Padre' : ''}</option>`;
              })
              .join('')}
          </select>
        </section>
      `
          : ''
      }

      <!-- Abas da Liturgia -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        ${[
          { id: 'readings', label: 'Leituras & Evangelho', icon: 'book-open-text' },
          { id: 'eucharistic', label: 'Oração Eucarística & Rito', icon: 'flame' },
          { id: 'script', label: `Roteiro do Celebrante${activeSchedule?.celebrantScript ? ' ★' : ''}`, icon: 'scroll-text' },
        ]
          .map(
            (t) => `
          <button type="button" data-lit-tab="${t.id}"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition ${
              activeTab === t.id
                ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-sm'
                : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
            }">
            <i data-lucide="${t.icon}" class="w-4 h-4 ${activeTab === t.id ? 'text-amber-400' : 'text-[#8D6E63]'}"></i>
            ${escapeHtml(t.label)}
          </button>
        `,
          )
          .join('')}
      </div>

      <!-- Conteúdo da Aba -->
      <div class="space-y-5">
        ${
          activeTab === 'readings'
            ? renderReadingsTab(liturgy, textClass)
            : activeTab === 'eucharistic'
              ? renderEucharisticTab(liturgy, activeOE, oeOriginBadge, textClass)
              : renderScriptTab(activeSchedule, daySchedules, pastoralMap, textClass)
        }
      </div>
    </div>
  `;

  container.querySelector('#lit-prev-day').addEventListener('click', () => {
    selectedDateISO = shiftDateISO(selectedDateISO, -1);
    selectedScheduleId = 'standard';
    manualOEOverride = null;
    renderLiturgy(container, { user });
  });

  container.querySelector('#lit-next-day').addEventListener('click', () => {
    selectedDateISO = shiftDateISO(selectedDateISO, 1);
    selectedScheduleId = 'standard';
    manualOEOverride = null;
    renderLiturgy(container, { user });
  });

  container.querySelector('#lit-today').addEventListener('click', () => {
    selectedDateISO = getTodayISO();
    selectedScheduleId = 'standard';
    manualOEOverride = null;
    renderLiturgy(container, { user });
  });

  container.querySelector('#lit-date-picker').addEventListener('change', (e) => {
    if (!e.target.value) return;
    selectedDateISO = e.target.value;
    selectedScheduleId = 'standard';
    manualOEOverride = null;
    renderLiturgy(container, { user });
  });

  container.querySelector('#lit-font-down').addEventListener('click', () => {
    fontScale = Math.max(0, fontScale - 1);
    renderLiturgy(container, { user });
  });
  container.querySelector('#lit-font-reset').addEventListener('click', () => {
    fontScale = 1;
    renderLiturgy(container, { user });
  });
  container.querySelector('#lit-font-up').addEventListener('click', () => {
    fontScale = Math.min(FONT_CLASSES.length - 1, fontScale + 1);
    renderLiturgy(container, { user });
  });

  container.querySelector('#lit-schedule-select')?.addEventListener('change', (e) => {
    selectedScheduleId = e.target.value;
    manualOEOverride = null;
    renderLiturgy(container, { user });
  });

  container.querySelectorAll('[data-lit-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.litTab;
      renderLiturgy(container, { user });
    });
  });

  container.querySelector('#lit-oe-select')?.addEventListener('change', (e) => {
    manualOEOverride = e.target.value;
    renderLiturgy(container, { user });
  });

  container.querySelectorAll('[data-pick-day-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedScheduleId = btn.dataset.pickDaySchedule;
      manualOEOverride = null;
      renderLiturgy(container, { user });
    });
  });

  refreshIcons();
}

function renderReadingsTab(liturgy, textClass) {
  const { leituras, antifonas, oracoes } = liturgy;
  return `
    ${
      antifonas.entrada
        ? `
      <article class="bg-[#FDFBF7] rounded-2xl border border-[#E6DACE] p-5 space-y-1.5">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Antífona de Entrada</h4>
        <p class="${textClass} text-[#3E2723] italic">${escapeHtml(antifonas.entrada)}</p>
      </article>
    `
        : ''
    }

    ${
      oracoes.dia
        ? `
      <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 sm:p-6 space-y-2 shadow-xs">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Oração do Dia (Coleta)</h4>
        <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(oracoes.dia)}</p>
      </article>
    `
        : ''
    }

    ${
      leituras.primeiraLeitura
        ? `
      <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 sm:p-6 space-y-2.5 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">1ª Leitura</h4>
          <span class="text-xs font-bold text-[#5D4037] bg-[#F5EFE6] px-2.5 py-0.5 rounded-full border border-[#E6DACE]">${escapeHtml(leituras.primeiraLeitura.referencia)}</span>
        </div>
        <h5 class="text-sm sm:text-base font-bold text-[#3E2723]">${escapeHtml(leituras.primeiraLeitura.titulo)}</h5>
        <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(leituras.primeiraLeitura.texto)}</p>
      </article>
    `
        : ''
    }

    ${
      leituras.salmo
        ? `
      <article class="bg-white rounded-2xl border-2 border-amber-300/80 p-5 sm:p-6 space-y-3 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Salmo Responsorial</h4>
          <span class="text-xs font-bold text-[#5D4037] bg-[#F5EFE6] px-2.5 py-0.5 rounded-full border border-[#E6DACE]">${escapeHtml(leituras.salmo.referencia)}</span>
        </div>
        ${
          leituras.salmo.refrao
            ? `<div class="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3">
                <p class="text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] mb-1">Refrão</p>
                <p class="${textClass} font-extrabold text-[#3E2723]">R. ${escapeHtml(leituras.salmo.refrao)}</p>
              </div>`
            : ''
        }
        <p class="${textClass} text-[#4E342E] whitespace-pre-line">${escapeHtml(leituras.salmo.texto)}</p>
      </article>
    `
        : ''
    }

    ${
      leituras.segundaLeitura
        ? `
      <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 sm:p-6 space-y-2.5 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">2ª Leitura</h4>
          <span class="text-xs font-bold text-[#5D4037] bg-[#F5EFE6] px-2.5 py-0.5 rounded-full border border-[#E6DACE]">${escapeHtml(leituras.segundaLeitura.referencia)}</span>
        </div>
        <h5 class="text-sm sm:text-base font-bold text-[#3E2723]">${escapeHtml(leituras.segundaLeitura.titulo)}</h5>
        <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(leituras.segundaLeitura.texto)}</p>
      </article>
    `
        : ''
    }

    ${
      leituras.evangelho
        ? `
      <article class="bg-gradient-to-b from-[#FDFBF7] to-white rounded-2xl border-2 border-[#D97706] p-5 sm:p-6 space-y-3 shadow-sm">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309] flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
            Evangelho
          </h4>
          <span class="text-xs font-extrabold text-white bg-[#3E2723] px-3 py-0.5 rounded-full">${escapeHtml(leituras.evangelho.referencia)}</span>
        </div>
        ${
          leituras.evangelho.aclamacao
            ? `<div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#5D4037] italic">
                ${escapeHtml(leituras.evangelho.aclamacao)}
              </div>`
            : ''
        }
        <h5 class="text-sm sm:text-base font-extrabold text-[#3E2723]">${escapeHtml(leituras.evangelho.titulo)}</h5>
        <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(leituras.evangelho.texto)}</p>
      </article>
    `
        : ''
    }
  `;
}

function renderEucharisticTab(liturgy, activeOE, oeOriginBadge, textClass) {
  return `
    <!-- Oração sobre as Oferendas -->
    ${
      liturgy.oracoes.oferendas
        ? `
      <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 sm:p-6 space-y-2 shadow-xs">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Oração sobre as Oferendas</h4>
        <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(liturgy.oracoes.oferendas)}</p>
      </article>
    `
        : ''
    }

    <!-- Prefácio do Dia -->
    <article class="bg-[#FDFBF7] rounded-2xl border border-[#E6DACE] p-5 sm:p-6 space-y-2">
      <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Prefácio do Dia</h4>
      <p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(liturgy.oracoes.prefacio)}</p>
      <p class="text-xs text-[#8D6E63] pt-1"><strong>Sugestão para esta OE:</strong> ${escapeHtml(activeOE.prefaceSuggestion)}</p>
    </article>

    <!-- Seletor e Texto Integral da Oração Eucarística -->
    <article class="bg-white rounded-2xl border-2 border-[#D97706] overflow-hidden shadow-sm">
      <div class="px-5 py-4 bg-[#3E2723] text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${oeOriginBadge.cls}">
              ${escapeHtml(oeOriginBadge.label)}
            </span>
          </div>
          <h4 class="font-serif text-base sm:text-lg font-bold">${escapeHtml(activeOE.name)}</h4>
          <p class="text-xs text-amber-200/80 mt-0.5">${escapeHtml(activeOE.whenUsed)}</p>
        </div>

        <div class="shrink-0">
          <label for="lit-oe-select" class="block text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">Escolher Oração Eucarística:</label>
          <select id="lit-oe-select"
            class="px-3 py-2 rounded-xl bg-[#2B1B18] border border-amber-400/40 text-white text-xs sm:text-sm font-semibold outline-none focus:border-amber-400">
            ${EUCHARISTIC_PRAYERS.map(
              (oe) => `<option value="${oe.id}" ${oe.id === activeOE.id ? 'selected' : ''}>${escapeHtml(oe.name)}</option>`,
            ).join('')}
          </select>
        </div>
      </div>

      <div class="p-5 sm:p-6 space-y-5">
        ${activeOE.sections
          .map(
            (sec) => `
          <div class="space-y-2 pb-4 border-b border-[#E6DACE]/70 last:border-b-0 last:pb-0">
            <h5 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">${escapeHtml(sec.heading)}</h5>
            ${sec.paragraphs.map((p) => `<p class="${textClass} text-[#3E2723]">${escapeHtml(p)}</p>`).join('')}
          </div>
        `,
          )
          .join('')}
      </div>
    </article>

    <!-- Antífona e Oração depois da Comunhão -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <article class="bg-[#FDFBF7] rounded-2xl border border-[#E6DACE] p-5 space-y-1.5">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Antífona da Comunhão</h4>
        <p class="${textClass} text-[#3E2723] italic">${escapeHtml(liturgy.antifonas.comunhao || '—')}</p>
      </article>
      <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 space-y-1.5">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-[#B45309]">Oração depois da Comunhão</h4>
        <p class="${textClass} text-[#3E2723]">${escapeHtml(liturgy.oracoes.comunhao || '—')}</p>
      </article>
    </div>
  `;
}

function renderScriptTab(activeSchedule, daySchedules, pastoralMap, textClass) {
  if (activeSchedule) {
    const oe = getEucharisticPrayerById(activeSchedule.eucharisticPrayerId);
    return `
      <article class="bg-white rounded-2xl border-2 border-amber-400 p-6 space-y-4 shadow-sm">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div class="flex items-center gap-2 flex-wrap mb-1.5">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#3E2723] text-amber-300">
                <i data-lucide="scroll-text" class="w-3 h-3"></i>
                Roteiro do Celebrante
              </span>
              ${renderPastoralPill(pastoralMap[activeSchedule.pastoralId], { compact: true })}
            </div>
            <h4 class="text-lg font-extrabold text-[#3E2723]">${escapeHtml(activeSchedule.celebrationType)} — ${escapeHtml(activeSchedule.time)}</h4>
            <p class="text-xs text-[#6D4C41] mt-0.5">${escapeHtml(activeSchedule.location)}</p>
          </div>
          <div class="text-right">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#8D6E63] block">Oração Eucarística</span>
            <span class="inline-flex mt-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-[#92400E] border border-amber-300">
              ${escapeHtml(oe.shortName)} (${activeSchedule.eucharisticPrayerSource === 'custom' ? 'Roteiro do Padre' : 'Padrão do Dia'})
            </span>
          </div>
        </div>

        <div class="rounded-2xl bg-[#FAF6F0] border border-[#E6DACE] p-5">
          ${
            activeSchedule.celebrantScript
              ? `<p class="${textClass} text-[#3E2723] whitespace-pre-line">${escapeHtml(activeSchedule.celebrantScript)}</p>`
              : `<p class="text-sm text-[#8D6E63] italic">Esta celebração segue o rito litúrgico padrão sem orientações adicionais do celebrante.</p>`
          }
        </div>
      </article>
    `;
  }

  const withScripts = daySchedules.filter((s) => s.celebrantScript || s.eucharisticPrayerSource === 'custom');
  if (withScripts.length === 0) {
    return `
      <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
        <i data-lucide="scroll-text" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
        <h4 class="text-base font-bold text-[#3E2723]">Nenhum Roteiro Especial cadastrado para ${escapeHtml(formatDateBR(selectedDateISO))}</h4>
        <p class="text-sm text-[#6D4C41] mt-1">
          A celebração desta data segue a <strong>Liturgia Padrão do Dia</strong>. Coordenadores podem adicionar orientações do celebrante ao criar ou editar uma escala.
        </p>
      </div>
    `;
  }

  return `
    <div class="space-y-4">
      <p class="text-sm text-[#5D4037]">Selecione uma celebração abaixo para aplicar o roteiro e a Oração Eucarística escolhida pelo celebrante:</p>
      ${withScripts
        .map((s) => {
          const oe = getEucharisticPrayerById(s.eucharisticPrayerId);
          return `
            <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 space-y-3 shadow-xs">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    ${renderPastoralPill(pastoralMap[s.pastoralId], { compact: true })}
                    <span class="text-xs font-extrabold text-[#B45309]">${escapeHtml(s.time)} • ${escapeHtml(s.location)}</span>
                  </div>
                  <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(s.celebrationType)}</h4>
                  <p class="text-xs text-[#6D4C41]">Oração Eucarística: <strong>${escapeHtml(oe.name)}</strong></p>
                </div>
                <button type="button" data-pick-day-schedule="${s.id}"
                  class="self-start sm:self-center px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs font-bold transition">
                  Aplicar este Roteiro
                </button>
              </div>
              ${
                s.celebrantScript
                  ? `<div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-3.5 text-sm text-[#3E2723] whitespace-pre-line">${escapeHtml(s.celebrantScript)}</div>`
                  : ''
              }
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}
