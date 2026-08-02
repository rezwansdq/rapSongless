import * as dailyStore from './dailyStore.js';
import './notesBg.js';

// ── Floating Title Words ──────────────────────────────────────────────────────
(function initTitleWords() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    function animateWords() {
        const words = document.querySelectorAll('.title-word');
        if (!words.length) {
            requestAnimationFrame(animateWords);
            return;
        }
        const t = performance.now() * 0.002;
        words.forEach((el, i) => {
            const wave = Math.sin(t + i * 0.4);
            const y = wave * 3;          // ±3 px vertical
            const r = wave * 1;          // ±1 deg rotation
            el.style.transform = `translateY(${y}px) rotate(${r}deg)`;
        });
        requestAnimationFrame(animateWords);
    }

    requestAnimationFrame(animateWords);
})();
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const artistNameInput = document.getElementById('artist-name');
    const validateButton = document.getElementById('validate-input-btn');
    const messageArea = document.getElementById('validation-message');

    const modeButtons = document.querySelectorAll('.input-mode-selector .mode-btn');
    const artistInputSection = document.getElementById('artist-input-section');
    const genreInputSection = document.getElementById('genre-input-section');
    const dailySongSection = document.getElementById('daily-song-section');
    const genreSelect = document.getElementById('genre-select');

    const howToPlayButton = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const closeHowToPlayButton = document.getElementById('close-how-to-play-btn');

    let currentInputMode = 'daily';

    // ── Daily Progress Helpers ──────────────────────────────────────────────
    const DAILY_TOTAL = dailyStore.DAILY_TOTAL;

    function todayStr() {
        return dailyStore.todayStr();
    }

    function getDailyStats(dateStr = todayStr()) {
        return dailyStore.getDayRecord(dateStr);
    }

    function renderDailyStats() {
        const statsEl = document.getElementById('daily-stats');
        if (!statsEl) return;
        const { completed, correct, guesses } = getDailyStats();
        const done = completed >= DAILY_TOTAL;
        if (done) {
            statsEl.textContent = `✅ ${completed}/${DAILY_TOTAL} · ${correct} correct · ${guesses} guesses`;
            statsEl.className = 'daily-stats daily-stats--complete';
            showDailyShareButtons(todayStr());
        } else if (completed > 0) {
            statsEl.textContent = `${completed}/${DAILY_TOTAL} songs · ${correct} correct · ${guesses} guesses`;
            statsEl.className = 'daily-stats';
            hideDailyShareButtons();
        } else {
            statsEl.textContent = '';
            statsEl.className = 'daily-stats';
            hideDailyShareButtons();
        }
    }

    /** Copies `text`, flashing confirmation on `button` either way. */
    function copyToClipboard(text, button, doneLabel, resetLabel) {
        const flash = () => {
            if (!button) return;
            button.textContent = doneLabel;
            setTimeout(() => { button.textContent = resetLabel; }, 2000);
        };
        navigator.clipboard.writeText(text).then(flash).catch(flash);
    }

    function shareDay(dateStr, button, doneLabel, resetLabel) {
        const text = dailyStore.buildShareText(dateStr, dailyStore.getDayRecord(dateStr), DAILY_TOTAL);
        if (navigator.share) {
            navigator.share({ title: 'Songless Unlimited', text }).catch(() => {});
        } else {
            copyToClipboard(text, button, doneLabel, resetLabel);
        }
    }

    function showDailyShareButtons(dateStr) {
        const shareRow = document.getElementById('daily-share-row');
        if (!shareRow) return;
        shareRow.style.display = 'flex';

        const shareBtn = document.getElementById('home-share-btn');
        const copyBtn  = document.getElementById('home-copy-btn');

        // Clone to remove stale listeners
        if (shareBtn) {
            const newShare = shareBtn.cloneNode(true);
            shareBtn.parentNode.replaceChild(newShare, shareBtn);
            newShare.addEventListener('click', () => {
                shareDay(dateStr, newShare, '✓ Copied!', '🔗 Share');
            });
        }

        if (copyBtn) {
            const newCopy = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(newCopy, copyBtn);
            newCopy.addEventListener('click', () => {
                const text = dailyStore.buildShareText(dateStr, dailyStore.getDayRecord(dateStr), DAILY_TOTAL);
                copyToClipboard(text, newCopy, '✓ Copied!', '📋 Copy Result');
            });
        }
    }

    function hideDailyShareButtons() {
        const shareRow = document.getElementById('daily-share-row');
        if (shareRow) shareRow.style.display = 'none';
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
            validateButton.textContent = 'Start Daily Challenge';
        }
    }

    /** Send the player to the game page for a specific day. */
    function playDay(dateStr) {
        dailyStore.setActiveDate(dateStr);
        localStorage.setItem('userGenreId', '18'); // daily still defaults to rap/hip-hop behind the scenes
        localStorage.setItem('userArtistName', '');
        localStorage.setItem('userInputMode', 'daily');
        localStorage.setItem('userGenreName', 'Daily Song');
        window.location.href = `/game?date=${encodeURIComponent(dateStr)}`;
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Past Days Archive ───────────────────────────────────────────────────
    const archiveSection = document.getElementById('daily-archive');
    const archiveToggle = document.getElementById('archive-toggle');
    const archiveBody = document.getElementById('archive-body');
    const archiveCaret = document.getElementById('archive-toggle-caret');
    const archiveList = document.getElementById('archive-list');

    function renderArchive() {
        if (!archiveList) return;
        archiveList.innerHTML = '';

        dailyStore.getArchiveDates().forEach(dateStr => {
            const record = dailyStore.getDayRecord(dateStr);
            const complete = record.completed >= DAILY_TOTAL;
            const started = record.completed > 0;

            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'archive-row' +
                (complete ? ' archive-row--complete' : started ? ' archive-row--partial' : '');
            row.dataset.date = dateStr;

            const label = document.createElement('span');
            label.className = 'archive-row-date';
            label.textContent = dailyStore.formatDateLabel(dateStr);

            const status = document.createElement('span');
            status.className = 'archive-row-status';
            if (complete) {
                status.textContent = `${record.correct}/${DAILY_TOTAL} ✅`;
            } else if (started) {
                status.textContent = `${record.completed}/${DAILY_TOTAL} · resume`;
            } else {
                status.textContent = 'Play';
            }

            row.appendChild(label);
            row.appendChild(status);
            row.addEventListener('click', () => {
                if (complete) {
                    showDayResultModal(dateStr);
                } else {
                    playDay(dateStr);
                }
            });
            archiveList.appendChild(row);
        });

        const lifetimeEl = document.getElementById('archive-lifetime');
        if (lifetimeEl) {
            const { daysPlayed, songs, correct } = dailyStore.getLifetimeStats();
            lifetimeEl.textContent = daysPlayed
                ? `${daysPlayed} ${daysPlayed === 1 ? 'day' : 'days'} played · ${correct}/${songs} songs correct`
                : 'No days played yet — pick one below.';
        }
    }

    function setArchiveOpen(open) {
        if (!archiveBody || !archiveToggle) return;
        archiveBody.style.display = open ? 'block' : 'none';
        archiveToggle.setAttribute('aria-expanded', String(open));
        if (archiveCaret) archiveCaret.textContent = open ? '▴' : '▾';
        if (open) renderArchive();
    }

    if (archiveToggle) {
        archiveToggle.addEventListener('click', () => {
            const open = archiveToggle.getAttribute('aria-expanded') === 'true';
            setArchiveOpen(!open);
        });
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Saved Results Modal (for a finished day) ────────────────────────────
    const dayResultModal = document.getElementById('day-result-modal');

    function showDayResultModal(dateStr) {
        if (!dayResultModal) return;
        const record = dailyStore.getDayRecord(dateStr);

        const heading = document.getElementById('day-result-heading');
        const score = document.getElementById('day-result-score');
        const sub = document.getElementById('day-result-sub');
        const list = document.getElementById('day-result-list');
        const summary = document.getElementById('day-result-summary');

        const dayLabel = dailyStore.formatDateLabel(dateStr);
        if (heading) heading.textContent = dayLabel === 'Today' ? "Today's Results" : `${dayLabel} — Results`;
        if (score) score.textContent = `${record.correct}/${record.log.length || DAILY_TOTAL}`;
        if (sub) {
            sub.textContent = record.correct === (record.log.length || DAILY_TOTAL)
                ? 'Perfect!'
                : record.correct === 0 ? 'Keep practicing' : 'correct';
        }

        if (list) {
            list.innerHTML = '';
            record.log.forEach((entry, i) => {
                const row = document.createElement('div');
                row.className = `recap-song-row ${entry.correct ? 'recap-correct' : 'recap-wrong'}`;
                const guessWord = entry.guesses === 1 ? 'guess' : 'guesses';
                row.innerHTML =
                    `<span class="recap-song-num">${i + 1}</span>` +
                    `<span class="recap-song-title"></span>` +
                    `<span class="recap-song-meta">${entry.guesses} ${guessWord}</span>` +
                    `<span class="recap-song-icon">${entry.correct ? '✅' : '❌'}</span>`;
                row.querySelector('.recap-song-title').textContent = entry.title;
                list.appendChild(row);
            });
        }

        if (summary) summary.textContent = `${record.guesses} total guesses`;

        // Rebind the action buttons for this specific day.
        const rebind = (id, handler) => {
            const original = document.getElementById(id);
            if (!original) return null;
            const fresh = original.cloneNode(true);
            original.parentNode.replaceChild(fresh, original);
            fresh.addEventListener('click', () => handler(fresh));
            return fresh;
        };

        rebind('day-result-share-btn', btn => shareDay(dateStr, btn, 'Copied!', 'Share'));
        rebind('day-result-replay-btn', () => {
            const confirmed = window.confirm(
                `Play ${dayLabel.toLowerCase()} again? Your saved result for this day will be cleared.`
            );
            if (!confirmed) return;
            dailyStore.clearDayRecord(dateStr);
            playDay(dateStr);
        });
        rebind('day-result-close-btn', () => {
            dayResultModal.classList.remove('active');
            renderDailyStats();
            renderArchive();
        });

        dayResultModal.classList.add('active');
    }
    // ───────────────────────────────────────────────────────────────────────

    const genres = [
        { name: "Rap & Hip-Hop", genreId: "18" },
        { name: "Pop", genreId: "14" },
        { name: "R&B / Soul", genreId: "15" },
        { name: "Alternative", genreId: "20" },
        { name: "Dance", genreId: "17" },
        { name: "Country", genreId: "6" }
    ];

    function populateGenres() {
        if (genreSelect) {
            genreSelect.innerHTML = ''; // Clear existing options
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.genreId; // Store iTunes Genre ID as value
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    }

    function updateInputModeUI(mode) {
        currentInputMode = mode;
        artistInputSection.style.display = 'none';
        genreInputSection.style.display = 'none';
        if (dailySongSection) dailySongSection.style.display = 'none';
        if (archiveSection) archiveSection.style.display = mode === 'daily' ? 'block' : 'none';

        // Always reset button to a clean enabled state before applying mode-specific logic.
        // This prevents the daily-mode disabled state from bleeding into artist/genre modes.
        validateButton.disabled = false;
        validateButton.classList.remove('btn--disabled');
        // Force animation restart: removing + re-adding btn-primary resets the keyframe.
        validateButton.classList.remove('btn-primary');
        // Trigger a reflow so the browser treats the re-add as a fresh animation start.
        void validateButton.offsetWidth;
        validateButton.classList.add('btn-primary');

        modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (mode === 'artist') {
            artistInputSection.style.display = 'block';
            validateButton.textContent = 'Set Artist & Start';
            artistNameInput.focus();
        } else if (mode === 'genre') {
            genreInputSection.style.display = 'block';
            populateGenres(); // Populate dropdown when genre mode is active
            validateButton.textContent = 'Set Genre & Start';
            if (genreSelect) genreSelect.focus();
        } else if (mode === 'daily') {
            if (dailySongSection) dailySongSection.style.display = 'block';
            renderDailyStats();
            applyDailyButtonState();
            if (archiveToggle && archiveToggle.getAttribute('aria-expanded') === 'true') renderArchive();
        }
        messageArea.textContent = '';
    }

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            updateInputModeUI(mode);
            localStorage.setItem('userInputMode', mode); // Persist selected mode
        });
    });

    const storedInputMode = localStorage.getItem('userInputMode');
    const storedArtistName = localStorage.getItem('userArtistName');
    const storedGenreName = localStorage.getItem('userGenreName');
    const storedGenreId = localStorage.getItem('userGenreId');

    // Default to daily if the user previously had 'playlist' saved.
    if (storedInputMode === 'playlist') {
        localStorage.removeItem('userInputMode');
        localStorage.removeItem('userPlaylistId');
        updateInputModeUI('daily');
    } else if (storedInputMode) {
        updateInputModeUI(storedInputMode);

        if (storedInputMode === 'artist' && storedArtistName) {
            artistNameInput.value = storedArtistName;
            messageArea.textContent = `Previously used artist: ${storedArtistName}. Set new artist or start.`;
            messageArea.style.color = '#aaa';
        } else if (storedInputMode === 'genre') {
            if (genreSelect && storedGenreId) {
                // Try to set the select to the stored genre ID if it exists in the new list
                const exists = Array.from(genreSelect.options).some(opt => opt.value === storedGenreId);
                if (exists) genreSelect.value = storedGenreId;
            }
            if (storedGenreName) {
                messageArea.textContent = `Previously used genre: ${storedGenreName}. Set new genre or start.`;
            }
            messageArea.style.color = '#aaa';
        } else if (storedInputMode === 'daily') {
            const { completed } = getDailyStats();
            if (completed >= DAILY_TOTAL) {
                messageArea.textContent = "Today's challenge is done — try a past day below.";
            } else if (completed > 0) {
                messageArea.textContent = `Welcome back! You're on song ${completed + 1} of ${DAILY_TOTAL}.`;
            } else {
                messageArea.textContent = `Daily challenge is ready — ${DAILY_TOTAL} songs. Press start to play.`;
            }
            messageArea.style.color = '#aaa';
        }
    } else {
        updateInputModeUI('daily');
    }

    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            if (currentInputMode === 'artist') {
                const artistName = artistNameInput.value.trim();
                if (!artistName) {
                    messageArea.textContent = 'Please enter an artist name.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Artist '${artistName}' set. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userArtistName', artistName);
                localStorage.setItem('userGenreId', '');
                localStorage.setItem('userInputMode', 'artist');
                localStorage.setItem('userGenreName', '');
                window.location.href = '/game';
            } else if (currentInputMode === 'genre') {
                const selectedGenreId = genreSelect ? genreSelect.value : null;
                const selectedGenreName = genreSelect ? genreSelect.options[genreSelect.selectedIndex].text : '';
                if (!selectedGenreId) {
                    messageArea.textContent = 'Please select a genre.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Genre '${selectedGenreName}' selected. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userGenreId', selectedGenreId);
                localStorage.setItem('userArtistName', '');
                localStorage.setItem('userInputMode', 'genre');
                localStorage.setItem('userGenreName', selectedGenreName);
                window.location.href = '/game';
            } else if (currentInputMode === 'daily') {
                const today = todayStr();
                if (getDailyStats(today).completed >= DAILY_TOTAL) {
                    // Today is finished — show what they scored instead of replaying blindly.
                    showDayResultModal(today);
                    return;
                }
                messageArea.textContent = 'Starting the daily challenge...';
                messageArea.style.color = '#2ecc71';
                playDay(today);
            }
        });
    }

    if (howToPlayButton) {
        howToPlayButton.addEventListener('click', () => {
            howToPlayModal.classList.add('active');
        });
    }

    if (closeHowToPlayButton) {
        closeHowToPlayButton.addEventListener('click', () => {
            howToPlayModal.classList.remove('active');
        });
    }
});