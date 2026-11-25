/**
 * Controlador principal da Plataforma Multi-Pastoral — Paróquia Santa Teresa d'Ávila
 * - Autenticação + Tela de Login + Seletor Rápido com 4 perfis demonstrando isolamento:
 *   1. Coordenação Geral (Admin Paroquial)
 *   2. Coordenadora 1 (Natália: Coroinhas e Liturgia)
 *   3. Coordenador 2 (Carlos: Música e Acolhida)
 *   4. Membro Simples (João: multi-pastoral)
 * - Registro do Service Worker (PWA) + botão discreto "Instalar App no Celular"
 * - Cabeçalho interno dinâmico + Sidebar Carmelita responsiva
 */

import { dataService } from './services/dataService.js';
import {
  closeModal,
  escapeHtml,
  getCoordinatedPastoralIds,
  getFirstName,
  getInitials,
  getUserMemberships,
  getUserRoleSummary,
  isAnyCoordinator,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  showToast,
} from './utils/helpers.js';

import { renderDashboard, resetDashboardFilter } from './modules/dashboard.js';
import { renderUsers } from './modules/users.js';
import { renderAgenda } from './modules/agenda.js';
import { renderSchedules, resetSchedulesTab } from './modules/schedules.js';
import { renderRoles } from './modules/roles.js';
import { renderForms } from './modules/forms.js';
import { renderNotes } from './modules/notes.js';
import { renderNotices } from './modules/notices.js';
import { renderBirthdays } from './modules/birthdays.js';
import { renderAttendance } from './modules/attendance.js';
import { renderResponses } from './modules/responses.js';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Início', subtitle: 'Visão Geral das Pastorais', icon: 'layout-dashboard', coordOnly: false },
  { id: 'users', label: 'Gestão de Usuários', subtitle: 'Cadastro de membros e vínculos N:N com pastorais', icon: 'users', coordOnly: true },
  { id: 'agenda', label: 'Agenda', subtitle: 'Calendário unificado com suas escalas e eventos', icon: 'calendar-days', coordOnly: false },
  { id: 'schedules', label: 'Escalas', subtitle: 'Visão Geral das Pastorais', icon: 'calendar-check-2', coordOnly: false },
  { id: 'roles', label: 'Pastorais & Funções', subtitle: 'Cadastro de pastorais e funções litúrgicas/ministeriais', icon: 'sliders-horizontal', coordOnly: true },
  { id: 'forms', label: 'Formulários', subtitle: 'Pesquisas de disponibilidade e inscrições', icon: 'clipboard-list', coordOnly: false },
  { id: 'notes', label: 'Bloco de Notas', subtitle: 'Mural compartilhado de orientações por pastoral', icon: 'notebook-pen', coordOnly: false },
  { id: 'notices', label: 'Avisos', subtitle: 'Comunicados paroquiais e das pastorais', icon: 'megaphone', coordOnly: false },
  { id: 'birthdays', label: 'Aniversariantes', subtitle: 'Celebração dos aniversariantes da paróquia', icon: 'cake', coordOnly: false },
  { id: 'attendance', label: 'Presença', subtitle: 'Chamadas e indicador de frequência', icon: 'check-square', coordOnly: false },
  { id: 'responses', label: 'Respostas', subtitle: 'Painel consolidado e exportação CSV/Excel', icon: 'bar-chart-3', coordOnly: true },
  { id: 'instagram', label: 'Instagram', subtitle: 'Perfil oficial da paróquia', icon: 'instagram', coordOnly: false, external: true },
];

let currentUser = null;
let currentRoute = 'dashboard';
let deferredInstallPrompt = null;

function registerServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[PWA] Service Worker não registrado:', err);
    });
  }
}

function setupPwaInstall() {
  const installBox = document.getElementById('pwa-install-box');
  const installBtn = document.getElementById('btn-install-pwa');
  if (!installBox || !installBtn) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    installBox.classList.add('hidden');
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBox.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBox.classList.add('hidden');
    showToast('App "Santa Teresa" instalado na tela inicial!');
  });

  installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        installBox.classList.add('hidden');
      }
      return;
    }

    // Orientações claras para iPhone (Safari) e Android caso o prompt nativo não esteja disponível
    openModal({
      title: 'Instalar App — Santa Teresa',
      bodyHtml: `
        <div class="space-y-4 text-sm text-[#4E342E]">
          <p>Você pode instalar a plataforma <strong>Gestão Pastoral - Santa Teresa</strong> diretamente na tela inicial do seu celular em modo aplicativo (tela cheia):</p>
          <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-4 space-y-2">
            <p class="font-extrabold text-[#3E2723] flex items-center gap-2">
              <i data-lucide="smartphone" class="w-4 h-4 text-[#B45309]"></i>
              No Android (Chrome / Edge)
            </p>
            <p class="text-xs leading-relaxed">Toque no menu <strong>⋮</strong> (canto superior direito) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
          </div>
          <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-4 space-y-2">
            <p class="font-extrabold text-[#3E2723] flex items-center gap-2">
              <i data-lucide="share" class="w-4 h-4 text-[#B45309]"></i>
              No iPhone / iPad (Safari)
            </p>
            <p class="text-xs leading-relaxed">Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima) e escolha <strong>"Adicionar à Tela de Início"</strong>.</p>
          </div>
          <div class="flex justify-end pt-1">
            <button type="button" id="close-pwa-guide" class="px-5 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold">Entendi</button>
          </div>
        </div>
      `,
      onMount(bodyEl) {
        bodyEl.querySelector('#close-pwa-guide').addEventListener('click', closeModal);
      },
    });
  });
}

function getDemoProfiles() {
  const users = dataService.getUsers();
  const preferredIds = ['usr_admin', 'usr_natalia', 'usr_carlos', 'usr_joao'];
  const list = preferredIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
  if (list.length > 0) return list;
  return users.filter((u) => u.status === 'Ativo').slice(0, 4);
}

function describeUserScope(u, pastoralMap) {
  if (isGeneralAdmin(u)) return 'Admin Paroquial • Todas as pastorais';
  const mems = getUserMemberships(u);
  const coords = mems
    .filter((m) => m.role === 'Coordenador')
    .map((m) => pastoralMap[m.pastoralId]?.shortName)
    .filter(Boolean);
  const members = mems
    .filter((m) => m.role === 'Membro')
    .map((m) => pastoralMap[m.pastoralId]?.shortName)
    .filter(Boolean);

  if (coords.length > 0) {
    return `Coord.: ${coords.join(' e ')}`;
  }
  return members.length ? `Membro: ${members.join(', ')}` : 'Membro';
}

function init() {
  dataService.init();
  registerServiceWorker();
  setupPwaInstall();
  bindGlobalEvents();

  const savedUserId = dataService.getSessionUserId();
  const savedUser = savedUserId ? dataService.getUserById(savedUserId) : null;

  if (savedUser && savedUser.status === 'Ativo') {
    loginAs(savedUser, { silent: true });
  } else {
    showLoginScreen();
  }
}

function bindGlobalEvents() {
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-root') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('open-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(true));
  document.getElementById('close-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(false));
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => setMobileSidebar(false));

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    dataService.setSessionUserId(null);
    currentUser = null;
    showLoginScreen();
    showToast('Você saiu do portal.', 'info');
  });

  document.getElementById('quick-profile-switcher')?.addEventListener('change', (e) => {
    const target = dataService.getUserById(e.target.value);
    if (!target) return;
    resetSchedulesTab();
    resetDashboardFilter();
    loginAs(target, { silent: false });
  });

  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const errorEl = document.getElementById('login-error');
    const found = dataService.getUsers().find((u) => u.email.toLowerCase() === email);

    if (!found) {
      errorEl.textContent = 'E-mail não encontrado. Utilize um dos perfis de demonstração abaixo ou cadastre o membro.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (found.status !== 'Ativo') {
      errorEl.textContent = `Acesso indisponível: este usuário está com status "${found.status}".`;
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    loginAs(found);
  });
}

function setMobileSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  if (open) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function showLoginScreen() {
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');

  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const quickBox = document.getElementById('login-quick-profiles');
  const demos = getDemoProfiles();

  quickBox.innerHTML = demos
    .map((u) => {
      const summary = getUserRoleSummary(u, pastorals);
      const scope = describeUserScope(u, pastoralMap);
      return `
        <button type="button" data-quick-login="${u.id}"
          class="text-left p-3 rounded-xl border border-[#E6DACE] bg-[#FDFBF7] hover:border-[#D97706] hover:bg-amber-50/50 transition group">
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-7 h-7 rounded-lg bg-[#3E2723] text-amber-400 text-[11px] font-extrabold flex items-center justify-center shrink-0">
                ${escapeHtml(getInitials(u.name))}
              </span>
              <span class="text-xs font-extrabold text-[#3E2723] truncate">${escapeHtml(u.name.split(' ').slice(0, 2).join(' '))}</span>
            </div>
            <span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${summary.badgeClass}">
              ${escapeHtml(summary.label)}
            </span>
          </div>
          <p class="text-[11px] text-[#6D4C41] truncate pl-9">${escapeHtml(scope)}</p>
        </button>
      `;
    })
    .join('');

  quickBox.querySelectorAll('[data-quick-login]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = dataService.getUserById(btn.dataset.quickLogin);
      if (target) loginAs(target);
    });
  });

  refreshIcons();
}

function loginAs(user, { silent = false } = {}) {
  currentUser = user;
  dataService.setSessionUserId(user.id);

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  const activeMenuItem = MENU_ITEMS.find((m) => m.id === currentRoute);
  if (!activeMenuItem || (activeMenuItem.coordOnly && !isAnyCoordinator(currentUser))) {
    currentRoute = 'dashboard';
  }

  renderHeader();
  renderSidebar();
  renderCurrentRoute();

  if (!silent) {
    const pastorals = dataService.getPastorals();
    const summary = getUserRoleSummary(user, pastorals);
    showToast(`Conectado como ${getFirstName(user.name)} (${summary.label}).`, 'info');
  }
}

function setHeaderContext(title, subtitle) {
  const t = document.getElementById('page-title');
  const s = document.getElementById('page-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

function renderHeader() {
  if (!currentUser) return;
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const summary = getUserRoleSummary(currentUser, pastorals);

  const badgeEl = document.getElementById('header-user-badge');
  badgeEl.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-[#3E2723] text-amber-400 text-[11px] font-extrabold flex items-center justify-center shrink-0">
      ${escapeHtml(getInitials(currentUser.name))}
    </div>
    <div class="flex items-center gap-1.5 min-w-0">
      <span class="text-xs font-extrabold text-[#3E2723] truncate max-w-[95px] sm:max-w-[140px]">${escapeHtml(getFirstName(currentUser.name))}</span>
      <span class="text-[#D7C4B2] hidden sm:inline">•</span>
      <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${summary.badgeClass}">
        ${escapeHtml(summary.label)}
      </span>
    </div>
  `;

  const switcher = document.getElementById('quick-profile-switcher');
  const activeUsers = dataService.getUsers().filter((u) => u.status === 'Ativo');
  const demoOrder = ['usr_admin', 'usr_natalia', 'usr_carlos', 'usr_joao'];
  const demoSet = new Set(demoOrder);
  const sorted = [
    ...demoOrder.map((id) => activeUsers.find((u) => u.id === id)).filter(Boolean),
    ...activeUsers.filter((u) => !demoSet.has(u.id)),
  ];

  switcher.innerHTML = sorted
    .map((u) => {
      const scope = describeUserScope(u, pastoralMap);
      const shortLabel = `${u.name.split(' ')[0]} — ${scope}`;
      return `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${escapeHtml(shortLabel)}</option>`;
    })
    .join('');
}

function renderSidebar() {
  if (!currentUser) return;
  const nav = document.getElementById('sidebar-nav');
  const anyCoord = isAnyCoordinator(currentUser);
  const settings = dataService.getSettings();

  const visibleItems = MENU_ITEMS.filter((item) => !item.coordOnly || anyCoord);

  nav.innerHTML = visibleItems
    .map((item) => {
      if (item.external) {
        return `
          <div class="pt-2 mt-2 border-t border-white/10 flex items-center gap-1">
            <a href="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}" target="_blank" rel="noopener noreferrer"
              class="flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-amber-100/80 hover:text-white hover:bg-white/10 transition">
              <span class="flex items-center gap-3">
                <i data-lucide="${item.icon}" class="w-4 h-4 text-amber-400"></i>
                ${escapeHtml(item.label)}
              </span>
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-200/50"></i>
            </a>
            ${
              anyCoord
                ? `<button id="btn-edit-instagram" type="button" title="Editar link do Instagram"
                    class="p-2.5 rounded-xl text-amber-200/70 hover:text-amber-400 hover:bg-white/10 transition">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                  </button>`
                : ''
            }
          </div>
        `;
      }

      const active = currentRoute === item.id;
      return `
        <button type="button" data-route="${item.id}"
          class="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
            active
              ? 'sidebar-link-active font-semibold'
              : 'text-amber-100/80 hover:text-white hover:bg-white/10'
          }">
          <span class="flex items-center gap-3 truncate">
            <i data-lucide="${item.icon}" class="w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-amber-200/60'}"></i>
            <span class="truncate">${escapeHtml(item.label)}</span>
          </span>
          ${
            item.coordOnly
              ? `<span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/25 font-bold">${isGeneralAdmin(currentUser) ? 'Admin' : 'Coord'}</span>`
              : ''
          }
        </button>
      `;
    })
    .join('');

  nav.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.route);
      setMobileSidebar(false);
    });
  });

  nav.querySelector('#btn-edit-instagram')?.addEventListener('click', openInstagramModal);
  refreshIcons();
}

function openInstagramModal() {
  const settings = dataService.getSettings();
  openModal({
    title: 'Configurar Link do Instagram',
    bodyHtml: `
      <form id="ig-form" class="space-y-4">
        <p class="text-sm text-[#5D4037]">
          Defina o endereço oficial do Instagram da Paróquia Santa Teresa d'Ávila. O link abrirá em nova aba.
        </p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">URL do Instagram *</label>
          <input name="instagramUrl" type="url" required value="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}"
            placeholder="https://www.instagram.com/paroquiasantateresa"
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-ig-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Link</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-ig-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#ig-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const url = String(new FormData(e.target).get('instagramUrl')).trim();
        dataService.updateSettings({ instagramUrl: url });
        closeModal();
        renderSidebar();
        showToast('Link do Instagram atualizado!');
      });
    },
  });
}

function navigate(routeId) {
  const item = MENU_ITEMS.find((m) => m.id === routeId);
  if (!item || item.external) return;
  if (item.coordOnly && !isAnyCoordinator(currentUser)) {
    showToast('Este módulo é exclusivo da Coordenação.', 'error');
    currentRoute = 'dashboard';
  } else {
    if (routeId === 'schedules' && currentRoute !== 'schedules') {
      resetSchedulesTab();
    }
    currentRoute = routeId;
  }
  renderSidebar();
  renderCurrentRoute();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentRoute() {
  if (!currentUser) return;
  const freshUser = dataService.getUserById(currentUser.id);
  if (freshUser) currentUser = freshUser;

  const meta = MENU_ITEMS.find((m) => m.id === currentRoute) || MENU_ITEMS[0];
  setHeaderContext(meta.label, meta.subtitle);

  const container = document.getElementById('main-content');
  const ctx = {
    user: currentUser,
    navigate,
    setHeaderContext,
    onUsersChanged: () => renderHeader(),
    onPastoralsChanged: () => {
      renderHeader();
      renderSidebar();
    },
  };

  switch (currentRoute) {
    case 'dashboard':
      renderDashboard(container, ctx);
      break;
    case 'users':
      renderUsers(container, ctx);
      break;
    case 'agenda':
      renderAgenda(container, ctx);
      break;
    case 'schedules':
      renderSchedules(container, ctx);
      break;
    case 'roles':
      renderRoles(container, ctx);
      break;
    case 'forms':
      renderForms(container, ctx);
      break;
    case 'notes':
      renderNotes(container, ctx);
      break;
    case 'notices':
      renderNotices(container, ctx);
      break;
    case 'birthdays':
      renderBirthdays(container, ctx);
      break;
    case 'attendance':
      renderAttendance(container, ctx);
      break;
    case 'responses':
      renderResponses(container, ctx);
      break;
    default:
      renderDashboard(container, ctx);
      break;
  }
}

document.addEventListener('DOMContentLoaded', init);
