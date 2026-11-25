/**
 * Módulo de Gestão de Tipos de Celebração
 * Nome, Cor/Tag de destaque, Duração média estimada (min) e Exige Liturgia da Palavra (Sim/Não).
 */

import { dataService } from '../services/dataService.js';
import { closeModal, escapeHtml, openModal, refreshIcons, showToast } from '../utils/helpers.js';

const COLOR_SWATCHES = ['#B45309', '#5D4037', '#991B1B', '#D97706', '#0F766E', '#881337', '#6D28D9', '#1E3A8A'];

export function renderCelebrationTypes(container) {
  const types = dataService.getCelebrationTypes();
  const activeCount = types.filter((c) => c.active).length;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Tipos de Celebração</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${activeCount} tipos ativos de ${types.length} cadastrados. Utilizados na montagem de Escalas e eventos da Agenda.
          </p>
        </div>
        <button id="btn-new-ct" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
          <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
          Novo Tipo de Celebração
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${types
          .map(
            (ct) => `
          <article class="bg-white rounded-2xl border ${
            ct.active ? 'border-[#E6DACE]' : 'border-[#E6DACE] bg-[#FAF6F0]/70 opacity-75'
          } p-5 flex flex-col justify-between gap-4 shadow-xs">
            <div>
              <div class="flex items-start justify-between gap-2 mb-3">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style="background-color:${escapeHtml(ct.color)}18; color:${escapeHtml(ct.color)}; border-color:${escapeHtml(ct.color)}44;">
                  <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(ct.color)};"></span>
                  ${escapeHtml(ct.name)}
                </span>
                <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  ct.active
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
                }">
                  ${ct.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div class="space-y-1.5 text-xs text-[#5D4037]">
                <p class="flex items-center gap-2">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-[#B45309]"></i>
                  Duração média: <strong>${Number(ct.durationMin || 60)} minutos</strong>
                </p>
                <p class="flex items-center gap-2">
                  <i data-lucide="book-open" class="w-3.5 h-3.5 text-[#5D4037]"></i>
                  Exige Liturgia da Palavra:
                  <strong class="${ct.requiresLiturgyOfWord ? 'text-emerald-800' : 'text-[#8D6E63]'}">
                    ${ct.requiresLiturgyOfWord ? 'Sim' : 'Não'}
                  </strong>
                </p>
              </div>
            </div>

            <div class="pt-3 border-t border-[#E6DACE]/70 flex items-center justify-between gap-2">
              <button type="button" data-toggle-ct="${ct.id}"
                class="text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                  ct.active
                    ? 'text-[#92400E] bg-amber-50 hover:bg-amber-100 border-amber-200'
                    : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                }">
                ${ct.active ? 'Inativar' : 'Ativar'}
              </button>
              <div class="flex items-center gap-1">
                <button type="button" data-edit-ct="${ct.id}" title="Editar tipo"
                  class="p-2 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6]">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" data-delete-ct="${ct.id}" title="Excluir tipo"
                  class="p-2 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-red-50">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </article>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-new-ct').addEventListener('click', () => {
    openCelebrationTypeModal(null, () => renderCelebrationTypes(container));
  });

  container.querySelectorAll('[data-toggle-ct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ct = dataService.getCelebrationTypeById(btn.dataset.toggleCt);
      if (!ct) return;
      dataService.saveCelebrationType({ ...ct, active: !ct.active });
      showToast(`Tipo "${ct.name}" marcado como ${!ct.active ? 'Ativo' : 'Inativo'}.`);
      renderCelebrationTypes(container);
    });
  });

  container.querySelectorAll('[data-edit-ct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ct = dataService.getCelebrationTypeById(btn.dataset.editCt);
      if (ct) openCelebrationTypeModal(ct, () => renderCelebrationTypes(container));
    });
  });

  container.querySelectorAll('[data-delete-ct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente excluir este tipo de celebração?')) return;
      dataService.deleteCelebrationType(btn.dataset.deleteCt);
      showToast('Tipo de celebração excluído.');
      renderCelebrationTypes(container);
    });
  });

  refreshIcons();
}

function openCelebrationTypeModal(existing, onSaved) {
  openModal({
    title: existing ? 'Editar Tipo de Celebração' : 'Novo Tipo de Celebração',
    bodyHtml: `
      <form id="ct-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome do Tipo / Rito *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Missa Solene, Batizado, Adoração..."
            class="w-full px-3.5 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Duração Média Estimada (min) *</label>
            <input name="durationMin" type="number" min="15" max="300" step="5" required value="${Number(existing?.durationMin || 60)}"
              class="w-full px-3.5 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Cor da Tag *</label>
            <div class="flex items-center gap-2 flex-wrap">
              <input id="ct-color-input" name="color" type="color" value="${escapeHtml(existing?.color || '#B45309')}"
                class="w-10 h-9 rounded-lg border border-[#E6DACE] cursor-pointer p-0.5 bg-white">
              ${COLOR_SWATCHES.map(
                (hex) => `<button type="button" data-ct-swatch="${hex}" class="w-5 h-5 rounded-full border-2 border-white shadow-xs" style="background-color:${hex};"></button>`,
              ).join('')}
            </div>
          </div>
        </div>

        <div class="space-y-2 pt-1">
          <label class="flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
            <input name="requiresLiturgyOfWord" type="checkbox" ${(existing?.requiresLiturgyOfWord ?? true) ? 'checked' : ''} class="rounded text-[#B45309]">
            Exige Liturgia da Palavra (Leituras, Salmo e Evangelho)
          </label>
          <label class="flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
            <input name="active" type="checkbox" ${(existing?.active ?? true) ? 'checked' : ''} class="rounded text-[#B45309]">
            Ativo (disponível em Escalas e Agenda)
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-ct-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const colorInput = bodyEl.querySelector('#ct-color-input');
      bodyEl.querySelectorAll('[data-ct-swatch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          colorInput.value = btn.dataset.ctSwatch;
        });
      });
      bodyEl.querySelector('#cancel-ct-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#ct-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveCelebrationType({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          color: fd.get('color') || '#B45309',
          durationMin: Number(fd.get('durationMin')) || 60,
          requiresLiturgyOfWord: fd.get('requiresLiturgyOfWord') === 'on',
          active: fd.get('active') === 'on',
        });
        closeModal();
        showToast(existing ? 'Tipo de celebração atualizado!' : 'Tipo de celebração cadastrado!');
        onSaved();
      });
    },
  });
}
