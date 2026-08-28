/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/ui.js
 * Version:    1.0.0
 * Build:      1
 * Datum:      2026-07-09
 *
 * Beschreibung:
 * Stellt allgemeine, wiederverwendbare UI-Bausteine bereit: Navigation
 * zwischen Ansichten, modale Dialoge, Toast-Benachrichtigungen sowie
 * Format- und Escaping-Hilfsfunktionen. Diese Datei kennt keine
 * fachlichen Inhalte (keine Mitarbeiter, keine Dienste) - sie ist rein
 * technischer Natur und wird von allen Fachmodulen genutzt.
 */

'use strict';

const FDPUI = (() => {

    const VIEWS = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
        { id: 'calendar', label: 'Kalender', icon: 'calendar' },
        { id: 'employees', label: 'Mitarbeiter', icon: 'users' },
        { id: 'vacation', label: 'Urlaub & Abwesenheit', icon: 'sun' },
        { id: 'planner', label: 'Dienstplanung', icon: 'shuffle' },
        { id: 'statistics', label: 'Statistik', icon: 'bar-chart' },
        { id: 'settings', label: 'Einstellungen', icon: 'settings' }
    ];

    const ICONS = {
        grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
        calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
        users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.3 4.5 2.6 4.5 5.3"/></svg>',
        sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
        shuffle: '<svg viewBox="0 0 24 24"><path d="M3 6h3.5c2 0 3 1 4.3 3M3 18h3.5c2 0 3-1 4.3-3"/><path d="M14 6h4M14 18h4"/><path d="M17 3l4 3-4 3M17 15l4 3-4 3"/></svg>',
        'bar-chart': '<svg viewBox="0 0 24 24"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>',
        settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 000-2l1.3-1.1a.6.6 0 00.1-.8l-1.5-2.6a.6.6 0 00-.8-.2l-1.5.6a7.4 7.4 0 00-1.7-1l-.2-1.6a.6.6 0 00-.6-.5h-3a.6.6 0 00-.6.5l-.2 1.6a7.4 7.4 0 00-1.7 1l-1.5-.6a.6.6 0 00-.8.2L4.7 9.1a.6.6 0 00.1.8L6.1 11a1.7 1.7 0 000 2l-1.3 1.1a.6.6 0 00-.1.8l1.5 2.6c.2.3.5.4.8.2l1.5-.6c.5.4 1.1.8 1.7 1l.2 1.6c0 .3.3.5.6.5h3c.3 0 .6-.2.6-.5l.2-1.6c.6-.2 1.2-.6 1.7-1l1.5.6c.3.1.6 0 .8-.2l1.5-2.6a.6.6 0 00-.1-.8L19.4 13z"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
        edit: '<svg viewBox="0 0 24 24"><path d="M3 21l3.6-.9L20 6.7a2 2 0 000-2.8l-1.9-1.9a2 2 0 00-2.8 0L2 15.4 1.1 19 3 21z"/></svg>',
        trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
        close: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
        chevronLeft: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
        chevronRight: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
        warning: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 17h.01"/></svg>'
    };

    function icon(name, cls = 'icon') {
        return `<span class="${cls}">${ICONS[name] || ''}</span>`;
    }

    let currentView = 'dashboard';
    const viewRenderers = {};

    function registerView(id, renderFn) {
        viewRenderers[id] = renderFn;
    }

    function renderNav() {
        const nav = document.getElementById('mainNav');
        nav.innerHTML = VIEWS.map((v) => `
            <button class="nav-item ${v.id === currentView ? 'active' : ''}" data-view="${v.id}">
                ${icon(v.icon)}
                <span>${v.label}</span>
            </button>
        `).join('');

        nav.querySelectorAll('.nav-item').forEach((btn) => {
            btn.addEventListener('click', () => navigateTo(btn.dataset.view));
        });
    }

    async function navigateTo(viewId) {
        currentView = viewId;
        renderNav();
        const content = document.getElementById('appContent');
        content.classList.add('view-loading');
        const renderer = viewRenderers[viewId];
        if (renderer) {
            await renderer(content);
        } else {
            content.innerHTML = '<div class="empty-state">Diese Ansicht ist noch nicht verfügbar.</div>';
        }
        content.classList.remove('view-loading');
        content.scrollTop = 0;
    }

    function refreshCurrentView() {
        navigateTo(currentView);
    }

    function getCurrentView() {
        return currentView;
    }

    // ---------------------------------------------------------------
    // Toast-Benachrichtigungen
    // ---------------------------------------------------------------
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ---------------------------------------------------------------
    // Modale Dialoge
    // ---------------------------------------------------------------
    function showModal({ title, bodyHtml, footerHtml, onRender, size = 'medium' }) {
        closeModal();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'activeModalOverlay';
        overlay.innerHTML = `
            <div class="modal modal-${size}">
                <div class="modal-header">
                    <h2>${escapeHtml(title)}</h2>
                    <button class="icon-btn modal-close-btn" type="button">${icon('close')}</button>
                </div>
                <div class="modal-body">${bodyHtml}</div>
                ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', escCloseHandler);
        if (onRender) onRender(overlay);
        return overlay;
    }

    function escCloseHandler(e) {
        if (e.key === 'Escape') closeModal();
    }

    function closeModal() {
        const overlay = document.getElementById('activeModalOverlay');
        if (overlay) overlay.remove();
        document.removeEventListener('keydown', escCloseHandler);
    }

    function confirmDialog(message, confirmLabel = 'Löschen', danger = true) {
        return new Promise((resolve) => {
            const overlay = showModal({
                title: 'Bestätigung erforderlich',
                bodyHtml: `<p>${escapeHtml(message)}</p>`,
                footerHtml: `
                    <button class="btn btn-secondary" id="confirmCancelBtn">Abbrechen</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOkBtn">${escapeHtml(confirmLabel)}</button>
                `
            });
            overlay.querySelector('#confirmCancelBtn').addEventListener('click', () => {
                closeModal();
                resolve(false);
            });
            overlay.querySelector('#confirmOkBtn').addEventListener('click', () => {
                closeModal();
                resolve(true);
            });
        });
    }

    // ---------------------------------------------------------------
    // Format- und Hilfsfunktionen
    // ---------------------------------------------------------------
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseISO(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDateDisplay(dateStr) {
        const d = parseISO(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    function weekdayShort(date) {
        return WEEKDAYS_SHORT[date.getDay()];
    }

    function weekdayLong(date) {
        return WEEKDAYS_LONG[date.getDay()];
    }

    function monthName(index) {
        return MONTHS[index];
    }

    function isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    function dateRangeOverlaps(startA, endA, startB, endB) {
        return startA <= endB && startB <= endA;
    }

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'class') node.className = v;
            else if (k === 'html') node.innerHTML = v;
            else node.setAttribute(k, v);
        });
        children.forEach((c) => node.appendChild(c));
        return node;
    }

    return {
        registerView,
        navigateTo,
        refreshCurrentView,
        getCurrentView,
        renderNav,
        showToast,
        showModal,
        closeModal,
        confirmDialog,
        escapeHtml,
        icon,
        formatDateISO,
        parseISO,
        formatDateDisplay,
        weekdayShort,
        weekdayLong,
        monthName,
        isWeekend,
        dateRangeOverlaps,
        el
    };
})();
