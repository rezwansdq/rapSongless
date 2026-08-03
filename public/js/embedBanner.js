// Wires up the dismiss button on the embed-escape banner (see the inline
// script in <head> that sets html.is-embedded, and the markup right after
// <body> on every page). The banner only exists in the DOM's visible flow
// when that class is set — this module just makes it dismissible per tab.

const DISMISS_KEY = 'embedBannerDismissed';

function wasDismissed() {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false; // storage blocked (e.g. a sandboxed iframe) — just show it every time
    }
}

function remember() {
    try {
        sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
        // storage blocked — nothing to persist, the banner simply reappears next load
    }
}

function initEmbedBanner() {
    if (!document.documentElement.classList.contains('is-embedded')) return;
    const banner = document.getElementById('embed-banner');
    if (!banner) return;

    if (wasDismissed()) {
        banner.remove();
        return;
    }

    const dismissBtn = document.getElementById('embed-banner-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            remember();
            banner.remove();
        });
    }
}

initEmbedBanner();
