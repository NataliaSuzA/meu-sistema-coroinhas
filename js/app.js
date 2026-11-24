/**
 * Controlador principal da aplicação:
 * - Autenticação + Tela de Login + Seletor Rápido de Perfil no topo
 * - Navegação lateral responsiva (Sidebar desktop + Drawer mobile)
 * - Roteamento de módulos com controle de permissões por perfil
 * - Link externo do Instagram editável pela Coordenação
 */

import { dataService } from './services/dataService.js';
import {
  closeModal,
  escapeHtml,
  getCategoryBadgeClass,
  getCategoryDisplayLabel,
  getFirstName,
  getInitials,
  isCoordinator,
  openModal,
  refreshIcons,
  showToast,
} from './utils/helpers.js';

import { renderDashboard } from './modules/dashboard.js';
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
  { id: 'dashboard', label: 'Início', subtitle: 'Resumo da Pastoral, aviso fixado e próximas escalas', icon: 'layout-dashboard', coordOnly: false },
  { id: 'users', label: 'Gestão de Usuários', subtitle: 'Cadastro, filtros e status dos membros', icon: 'users', coordOnly: true },
  { id: 'agenda', label: 'Agenda', subtitle: 'Calendário sincronizado com suas escalas e eventos', icon: 'calendar-days', coordOnly: false },
  { id: 'schedules', label: 'Escalas', subtitle: 'Escalas litúrgicas e solicitações de substituição', icon: 'calendar-check-2', coordOnly: false },
  { id: 'roles', label: 'Configuração de Funções', subtitle: 'Gerenciamento das funções litúrgicas do altar', icon: 'sliders-horizontal', coordOnly: true },
  { id: 'forms', label: 'Formulários', subtitle: 'Pesquisas de disponibilidade e inscrições', icon: 'clipboard-list', coordOnly: false },
  { id: 'notes', label: 'Bloco de Notas', subtitle: 'Mural compartilhado de anotações e orientações', icon: 'notebook-pen', coordOnly: false },
  { id: 'notices', label: 'Avisos', subtitle: 'Comunicados oficiais da coordenação', icon: 'megaphone', coordOnly: false },
  { id: 'birthdays', label: 'Aniversariantes', subtitle: 'Celebração dos aniversariantes da pastoral', icon: 'cake', coordOnly: false },
  { id: 'attendance', label: 'Presença', subtitle: 'Chamadas e indicador de frequência', icon: 'check-square', coordOnly: false },
  { id: 'responses', label: 'Respostas', subtitle: 'Painel consolidado e exportação CSV/Excel', icon: 'bar-chart-3', coordOnly: true },
  { id: 'instagram', label: 'Instagram', subtitle: 'Perfil oficial da pastoral', icon: 'instagram', coordOnly: false, external: true },
];

let currentUser = null;
let currentRoute = 'dashboard';

function getDemoProfiles() {
  const users = dataService.getUsers();
  const preferredIds = ['usr_natalia', 'usr_joao', 'usr_maria'];
  const list = preferredIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
  if (list.length > 0) return list;
  return users.filter((u) => u.status === 'Ativo').slice(0, 3);
}

function init() {
  dataService.init();
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
  // Modal close handlers
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-root') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Mobile sidebar drawer
  document.getElementById('open-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(true));
  document.getElementById('close-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(false));
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => setMobileSidebar(false));

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    dataService.setSessionUserId(null);
    currentUser = null;
    showLoginScreen();
    showToast('Você saiu do portal.', 'info');
  });

  // Quick Profile Switcher
  document.getElementById('quick-profile-switcher')?.addEventListener('change', (e) => {
    const target = dataService.getUserById(e.target.value);
    if (!target) return;
    resetSchedulesTab();
    loginAs(target, { silent: false });
  });

  // Login Form
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const errorEl = document.getElementById('login-error');
    const found = dataService.getUsers().find((u) => u.email.toLowerCase() === email);

    if (!found) {
      errorEl.textContent = 'E-mail não encontrado. Utilize um dos perfis de demonstração abaixo ou cadastre o membro na Coordenação.';
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

  const quickBox = document.getElementById('login-quick-profiles');
  const demos = getDemoProfiles();
  quickBox.innerHTML = demos
    .map((u) => {
      const catLabel = getCategoryDisplayLabel(u.category, u.name);
      return `
        <button type="button" data-quick-login="${u.id}"
          class="text-left p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition group">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-7 h-7 rounded-lg bg-[#0F172A] text-amber-400 text-[11px] font-extrabold flex items-center justify-center shrink-0">
              ${escapeHtml(getInitials(u.name))}
            </span>
            <span class="text-xs font-extrabold text-[#0F172A] truncate">${escapeHtml(getFirstName(u.name))}</span>
          </div>
          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(u.category)}">
            ${escapeHtml(catLabel)}
          </span>
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

  // Redireciona se a rota atual for exclusiva da coordenação
  const activeMenuItem = MENU_ITEMS.find((m) => m.id === currentRoute);
  if (!activeMenuItem || (activeMenuItem.coordOnly && !isCoordinator(currentUser))) {
    currentRoute = 'dashboard';
  }

  renderHeader();
  renderSidebar();
  renderCurrentRoute();

  if (!silent) {
    const catLabel = getCategoryDisplayLabel(user.category, user.name);
    showToast(`Conectado como ${getFirstName(user.name)} (${catLabel}).`, 'info');
  }
}

function renderHeader() {
  if (!currentUser) return;

  // Badge do usuário logado no cabeçalho
  const badgeEl = document.getElementById('header-user-badge');
  const catLabel = getCategoryDisplayLabel(currentUser.category, currentUser.name);
  badgeEl.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-[#0F172A] text-amber-400 text-[11px] font-extrabold flex items-center justify-center shrink-0">
      ${escapeHtml(getInitials(currentUser.name))}
    </div>
    <div class="flex items-center gap-1.5 min-w-0">
      <span class="text-xs font-extrabold text-[#0F172A] truncate max-w-[95px] sm:max-w-[140px]">${escapeHtml(getFirstName(currentUser.name))}</span>
      <span class="text-slate-300 hidden sm:inline">•</span>
      <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(currentUser.category)}">
        ${escapeHtml(catLabel)}
      </span>
    </div>
  `;

  // Seletor Rápido de Perfil no topo
  const switcher = document.getElementById('quick-profile-switcher');
  const activeUsers = dataService.getUsers().filter((u) => u.status === 'Ativo');
  const demoIds = new Set(['usr_natalia', 'usr_joao', 'usr_maria']);
  const sorted = [
    ...activeUsers.filter((u) => demoIds.has(u.id)),
    ...activeUsers.filter((u) => !demoIds.has(u.id)),
  ];

  switcher.innerHTML = sorted
    .map((u) => {
      const label = `${getFirstName(u.name)} (${getCategoryDisplayLabel(u.category, u.name)})`;
      return `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function renderSidebar() {
  if (!currentUser) return;
  const nav = document.getElementById('sidebar-nav');
  const coord = isCoordinator(currentUser);
  const settings = dataService.getSettings();

  const visibleItems = MENU_ITEMS.filter((item) => !item.coordOnly || coord);

  nav.innerHTML = visibleItems
    .map((item) => {
      if (item.external) {
        return `
          <div class="pt-2 mt-2 border-t border-slate-800/90 flex items-center gap-1">
            <a href="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}" target="_blank" rel="noopener noreferrer"
              class="flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition">
              <span class="flex items-center gap-3">
                <i data-lucide="${item.icon}" class="w-4 h-4 text-amber-400"></i>
                ${escapeHtml(item.label)}
              </span>
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-500"></i>
            </a>
            ${
              coord
                ? `<button id="btn-edit-instagram" type="button" title="Editar link do Instagram"
                    class="p-2.5 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition">
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
              : 'text-slate-300 hover:text-white hover:bg-slate-800/75'
          }">
          <span class="flex items-center gap-3 truncate">
            <i data-lucide="${item.icon}" class="w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}"></i>
            <span class="truncate">${escapeHtml(item.label)}</span>
          </span>
          ${
            item.coordOnly
              ? `<span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/25 font-bold">Coord</span>`
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
        <p class="text-sm text-slate-600">
          Defina o endereço oficial do Instagram da Pastoral dos Coroinhas e Acólitos. O link abrirá em uma nova aba para todos os membros.
        </p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">URL do Instagram *</label>
          <input name="instagramUrl" type="url" required value="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}"
            placeholder="https://www.instagram.com/suapastoral"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-ig-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">Salvar Link</button>
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
  if (item.coordOnly && !isCoordinator(currentUser)) {
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
  document.getElementById('page-title').textContent = meta.label;
  document.getElementById('page-subtitle').textContent = meta.subtitle;

  const container = document.getElementById('main-content');
  const ctx = {
    user: currentUser,
    navigate,
    onUsersChanged: () => renderHeader(),
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
