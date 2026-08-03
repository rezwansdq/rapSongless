import * as dailyStore from './dailyStore.js';
import { playDay, shareDay, copyToClipboard, openDayResults } from './dailyUi.js';
import './notesBg.js';

document.addEventListener('DOMContentLoaded', () => {
    const artistNameInput = document.getElementById('artist-name');
    const validateButton = document.getElementById('validate-input-btn');
    const messageArea = document.getElementById('validation-message');

    const modeButtons = document.querySelectorAll('.input-mode-selector .mode-btn');
    const artistInputSection = document.getElementById('artist-input-section');
    const genreInputSection = document.getElementById('genre-input-section');
    const dailySongSection = document.getElementById('daily-song-section');
    const genreSelect = document.getElementById('genre-select');
    const archiveSection = document.getElementById('daily-archive');
    const archiveLinkSub = document.getElementById('archive-link-sub');
    const dayResultModal = document.getElementById('day-result-modal');

    const howToPlayButton = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const closeHowToPlayButton = document.getElementById('close-how-to-play-btn');

    let currentInputMode = 'daily';

    const DAILY_TOTAL = dailyStore.DAILY_TOTAL;

    const todayStr = () => dailyStore.todayStr();
    const getDailyStats = (dateStr = todayStr()) => dailyStore.getDayRecord(dateStr);

    // ── Today's readout ─────────────────────────────────────────────────────

    function renderDailyStats() {
        const statsEl = document.getElementById('daily-stats');
        if (!statsEl) return;
        const { completed, correct, guesses } = getDailyStats();

        if (completed >= DAILY_TOTAL) {
            statsEl.textContent = `${correct}/${DAILY_TOTAL} correct · ${guesses} guesses`;
            statsEl.className = 'daily-stats daily-stats--complete';
            showDailyShareButtons(todayStr());
        } else if (completed > 0) {
            statsEl.textContent = `${completed}/${DAILY_TOTAL} played · ${correct} correct`;
            statsEl.className = 'daily-stats';
            hideDailyShareButtons();
        } else {
            statsEl.textContent = `${DAILY_TOTAL} songs · same for everyone`;
            statsEl.className = 'daily-stats';
            hideDailyShareButtons();
        }
    }

    function showDailyShareButtons(dateStr) {
        const shareRow = document.getElementById('daily-share-row');
        if (!shareRow) return;
        shareRow.style.display = 'flex';

        const shareBtn = document.getElementById('home-share-btn');
        const copyBtn = document.getElementById('home-copy-btn');

        // Clone to drop stale listeners bound to an earlier date.
        if (shareBtn) {
            const newShare = shareBtn.cloneNode(true);
            shareBtn.parentNode.replaceChild(newShare, shareBtn);
            newShare.addEventListener('click', () => shareDay(dateStr, newShare, 'Copied', 'Share'));
        }

        if (copyBtn) {
            const newCopy = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(newCopy, copyBtn);
            newCopy.addEventListener('click', () => {
                const text = dailyStore.buildShareText(dateStr, dailyStore.getDayRecord(dateStr), DAILY_TOTAL);
                copyToClipboard(text, newCopy, 'Copied', 'Copy result');
            });
        }
    }

    function hideDailyShareButtons() {
        const shareRow = document.getElementById('daily-share-row');
        if (shareRow) shareRow.style.display = 'none';
    }

    function renderArchiveLink() {
        if (!archiveLinkSub) return;
        const { daysPlayed } = dailyStore.getLifetimeStats();
        archiveLinkSub.textContent = daysPlayed
            ? `${daysPlayed} of ${dailyStore.ARCHIVE_DAYS} days played`
            : `Play any of the last ${dailyStore.ARCHIVE_DAYS} days`;
    }

    function applyDailyButtonState() {
        if (currentInputMode !== 'daily') return;
        const { completed } = getDailyStats();
        validateButton.disabled = false;
        validateButton.classList.remove('btn--disabled');
        if (completed >= DAILY_TOTAL) {
            validateButton.textContent = "View Today's Results";
        } else if (completed > 0) {
            validateButton.textContent = `Resume · Song ${completed + 1} of ${DAILY_TOTAL}`;
        } else {
            validateButton.textContent = "Play Today's Songs";
        }
    }

    // ── Mode switching ──────────────────────────────────────────────────────

    const genres = [
        { name: 'Rap & Hip-Hop', genreId: '18' },
        { name: 'Pop', genreId: '14' },
        { name: 'R&B / Soul', genreId: '15' },
        { name: 'Alternative', genreId: '20' },
        { name: 'Dance', genreId: '17' },
        { name: 'Country', genreId: '6' },
    ];

    function populateGenres() {
        if (!genreSelect) return;
        genreSelect.innerHTML = '';
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.genreId;
            option.textContent = genre.name;
            genreSelect.appendChild(option);
        });
    }

    function updateInputModeUI(mode) {
        currentInputMode = mode;
        artistInputSection.style.display = 'none';
        genreInputSection.style.display = 'none';
        if (dailySongSection) dailySongSection.style.display = 'none';
        if (archiveSection) archiveSection.style.display = mode === 'daily' ? 'block' : 'none';

        validateButton.disabled = false;
        validateButton.classList.remove('btn--disabled');

        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'artist') {
            artistInputSection.style.display = 'block';
            validateButton.textContent = 'Start Game';
            hideDailyShareButtons();
            artistNameInput.focus();
        } else if (mode === 'genre') {
            genreInputSection.style.display = 'block';
            populateGenres();
            validateButton.textContent = 'Start Game';
            hideDailyShareButtons();
        } else if (mode === 'daily') {
            if (dailySongSection) dailySongSection.style.display = 'block';
            renderDailyStats();
            renderArchiveLink();
            applyDailyButtonState();
        }
        messageArea.textContent = '';
    }

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            updateInputModeUI(mode);
            localStorage.setItem('userInputMode', mode);
        });
    });

    // ── Restore the previous session's mode ─────────────────────────────────

    const storedInputMode = localStorage.getItem('userInputMode');
    const storedArtistName = localStorage.getItem('userArtistName');
    const storedGenreId = localStorage.getItem('userGenreId');

    if (storedInputMode === 'playlist') {
        // Retired mode — fall back to daily.
        localStorage.removeItem('userInputMode');
        localStorage.removeItem('userPlaylistId');
        updateInputModeUI('daily');
    } else if (storedInputMode) {
        updateInputModeUI(storedInputMode);

        if (storedInputMode === 'artist' && storedArtistName) {
            artistNameInput.value = storedArtistName;
        } else if (storedInputMode === 'genre' && genreSelect && storedGenreId) {
            const exists = Array.from(genreSelect.options).some(opt => opt.value === storedGenreId);
            if (exists) genreSelect.value = storedGenreId;
        }
    } else {
        updateInputModeUI('daily');
    }

    // ── Start ───────────────────────────────────────────────────────────────

    if (validateButton) {
        validateButton.addEventListener('click', () => {
            if (currentInputMode === 'artist') {
                const artistName = artistNameInput.value.trim();
                if (!artistName) {
                    messageArea.textContent = 'Enter an artist name to start.';
                    return;
                }
                localStorage.setItem('userArtistName', artistName);
                localStorage.setItem('userGenreId', '');
                localStorage.setItem('userInputMode', 'artist');
                localStorage.setItem('userGenreName', '');
                window.location.href = '/game';
            } else if (currentInputMode === 'genre') {
                const selectedGenreId = genreSelect ? genreSelect.value : null;
                const selectedGenreName = genreSelect ? genreSelect.options[genreSelect.selectedIndex].text : '';
                if (!selectedGenreId) {
                    messageArea.textContent = 'Pick a genre to start.';
                    return;
                }
                localStorage.setItem('userGenreId', selectedGenreId);
                localStorage.setItem('userArtistName', '');
                localStorage.setItem('userInputMode', 'genre');
                localStorage.setItem('userGenreName', selectedGenreName);
                window.location.href = '/game';
            } else if (currentInputMode === 'daily') {
                const today = todayStr();
                if (getDailyStats(today).completed >= DAILY_TOTAL) {
                    // Today is finished — show the score rather than replaying blindly.
                    openDayResults(dayResultModal, today, {
                        onAfterClose: () => {
                            renderDailyStats();
                            renderArchiveLink();
                            applyDailyButtonState();
                        },
                    });
                    return;
                }
                playDay(today);
            }
        });
    }

    // ── How to play ─────────────────────────────────────────────────────────

    if (howToPlayButton) {
        howToPlayButton.addEventListener('click', () => howToPlayModal.classList.add('active'));
    }
    if (closeHowToPlayButton) {
        closeHowToPlayButton.addEventListener('click', () => howToPlayModal.classList.remove('active'));
    }
});
