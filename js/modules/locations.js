/**
 * Módulo de Gestão de Locais (Igrejas, Capelas, Salões e Espaços Externos)
 * Apenas locais com status Ativo aparecem nos seletores de Escalas e Agenda.
 */

import { dataService } from '../services/dataService.js';
import { closeModal, escapeHtml, openModal, refreshIcons, showToast } from '../utils/helpers.js';

const LOCATION_TYPES = ['Matriz', 'Capela', 'Salão', 'Externo'];

function getTypeBadgeClass(type) {
  switch (type) {
    case 'Matriz':
      return 'bg-amber-100 text-[#92400E] border-amber-300';
    case 'Capela':
      return 'bg-[#F5EFE6] text-[#4E342E] border-[#D7C4B2]';
    case 'Salão':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    default:
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
}

export function renderLocations(container) {
  const locations = dataService.getLocations();
  const activeCount = locations.filter((l) => l.active).length;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Locais da Paróquia</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${activeCount} locais ativos de ${locations.length} cadastrados. Apenas locais <strong>Ativos</strong> aparecem ao criar Escalas e Eventos na Agenda.
          </p>
        </div>
        <button id="btn-new-location" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
          <i data-lucide="map-pin-plus" class="w-4 h-4 text-amber-400"></i>
          Novo Local
        </button>
      </div>

      ${
        locations.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center text-[#6D4C41]">
          Nenhum local cadastrado ainda.
        </div>
      `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${locations
            .map(
              (loc) => `
            <article class="bg-white rounded-2xl border ${
              loc.active ? 'border-[#E6DACE]' : 'border-[#E6DACE] bg-[#FAF6F0]/70 opacity-75'
            } p-5 flex flex-col justify-between gap-4 shadow-xs">
              <div>
                <div class="flex items-start justify-between gap-2 mb-2.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getTypeBadgeClass(loc.type)}">
                      ${escapeHtml(loc.type)}
                    </span>
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      loc.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border-stone-200'
                    }">
                      ${loc.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div class="w-8 h-8 rounded-lg ${loc.active ? 'bg-[#3E2723] text-amber-400' : 'bg-stone-200 text-stone-500'} flex items-center justify-center shrink-0">
                    <i data-lucide="map-pin" class="w-4 h-4"></i>
                  </div>
                </div>
                <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(loc.name)}</h4>
                <p class="text-xs text-[#6D4C41] mt-1.5 leading-relaxed">${escapeHtml(loc.address || 'Sem endereço/referência informado.')}</p>
              </div>

              <div class="pt-3 border-t border-[#E6DACE]/70 flex items-center justify-between gap-2">
                <button type="button" data-toggle-loc="${loc.id}"
                  class="text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                    loc.active
                      ? 'text-[#92400E] bg-amber-50 hover:bg-amber-100 border-amber-200'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                  }">
                  ${loc.active ? 'Inativar' : 'Ativar'}
                </button>
                <div class="flex items-center gap-1">
                  <button type="button" data-edit-loc="${loc.id}" title="Editar local"
                    class="p-2 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6]">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button type="button" data-delete-loc="${loc.id}" title="Excluir local"
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
      `
      }
    </div>
  `;

  container.querySelector('#btn-new-location').addEventListener('click', () => {
    openLocationModal(null, () => renderLocations(container));
  });

  container.querySelectorAll('[data-toggle-loc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = dataService.getLocationById(btn.dataset.toggleLoc);
      if (!loc) return;
      dataService.saveLocation({ ...loc, active: !loc.active });
      showToast(`Local "${loc.name}" marcado como ${!loc.active ? 'Ativo' : 'Inativo'}.`);
      renderLocations(container);
    });
  });

  container.querySelectorAll('[data-edit-loc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = dataService.getLocationById(btn.dataset.editLoc);
      if (loc) openLocationModal(loc, () => renderLocations(container));
    });
  });

  container.querySelectorAll('[data-delete-loc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente excluir este local?')) return;
      dataService.deleteLocation(btn.dataset.deleteLoc);
      showToast('Local excluído.');
      renderLocations(container);
    });
  });

  refreshIcons();
}

function openLocationModal(existing, onSaved) {
  openModal({
    title: existing ? 'Editar Local' : 'Cadastrar Novo Local',
    bodyHtml: `
      <form id="location-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome do Local *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Capela São José, Salão Paroquial..."
            class="w-full px-3.5 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Tipo *</label>
            <select name="type" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${LOCATION_TYPES.map((t) => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end pb-2">
            <label class="inline-flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
              <input name="active" type="checkbox" ${(existing?.active ?? true) ? 'checked' : ''} class="rounded text-[#B45309]">
              Local ativo (disponível em Escalas e Agenda)
            </label>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Endereço / Referência</label>
          <input name="address" value="${escapeHtml(existing?.address || '')}" placeholder="Ex: Praça Santa Teresa, 100 — Centro"
            class="w-full px-3.5 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-loc-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Local</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-loc-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#location-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveLocation({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          type: fd.get('type'),
          address: String(fd.get('address') || '').trim(),
          active: fd.get('active') === 'on',
        });
        closeModal();
        showToast(existing ? 'Local atualizado!' : 'Novo local cadastrado!');
        onSaved();
      });
    },
  });
}
