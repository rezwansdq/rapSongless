// Daily-challenge UI shared by the home page and the calendar, so a saved day
// looks and behaves the same wherever it's opened from.

import * as dailyStore from './dailyStore.js';

/** Hand off to the game page for one specific day. */
export function playDay(dateStr) {
    dailyStore.setActiveDate(dateStr);
    localStorage.setItem('userGenreId', '18'); // daily still carries a genre id behind the scenes
    localStorage.setItem('userArtistName', '');
    localStorage.setItem('userInputMode', 'daily');
    localStorage.setItem('userGenreName', 'Daily Song');
    window.location.href = `/game?date=${encodeURIComponent(dateStr)}`;
}

/** Copy `text`, flashing confirmation on the button whether or not it resolves. */
export function copyToClipboard(text, button, doneLabel, resetLabel) {
    const flash = () => {
        if (!button) return;
        button.textContent = doneLabel;
        setTimeout(() => { button.textContent = resetLabel; }, 2000);
    };
    navigator.clipboard.writeText(text).then(flash).catch(flash);
}

/** Native share where available, clipboard everywhere else. */
export function shareDay(dateStr, button, doneLabel, resetLabel) {
    const text = dailyStore.buildShareText(dateStr, dailyStore.getDayRecord(dateStr), dailyStore.DAILY_TOTAL);
    if (navigator.share) {
        navigator.share({ title: 'Songless Unlimited', text }).catch(() => {});
    } else {
        copyToClipboard(text, button, doneLabel, resetLabel);
    }
}

/** Replace a node with a clone to drop stale listeners, then bind `handler`. */
function rebind(id, handler) {
    const original = document.getElementById(id);
    if (!original) return null;
    const fresh = original.cloneNode(true);
    original.parentNode.replaceChild(fresh, original);
    fresh.addEventListener('click', () => handler(fresh));
    return fresh;
}

/**
 * Fills and opens the saved-results card for one day.
 * `onAfterClose` runs once the card is dismissed, so callers can refresh
 * whatever view sits behind it.
 */
export function openDayResults(modal, dateStr, { onAfterClose } = {}) {
    if (!modal) return;
    const record = dailyStore.getDayRecord(dateStr);
    const total = record.log.length || dailyStore.DAILY_TOTAL;
    const dayLabel = dailyStore.formatDateLabel(dateStr);

    const heading = document.getElementById('day-result-heading');
    const score = document.getElementById('day-result-score');
    const sub = document.getElementById('day-result-sub');
    const list = document.getElementById('day-result-list');
    const summary = document.getElementById('day-result-summary');

    if (heading) heading.textContent = dayLabel === 'Today' ? "Today's Results" : `${dayLabel} — Results`;
    if (score) score.textContent = `${record.correct}/${total}`;
    if (sub) {
        sub.textContent = record.correct === total ? 'Perfect'
            : record.correct === 0 ? 'Keep practicing'
            : 'Correct';
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
                `<span class="recap-song-meta">${entry.guesses} ${guessWord}</span>`;
            row.querySelector('.recap-song-title').textContent = entry.title;
            list.appendChild(row);
        });
    }

    if (summary) summary.textContent = `${record.guesses} total guesses`;

    rebind('day-result-share-btn', btn => shareDay(dateStr, btn, 'Copied', 'Share'));

    rebind('day-result-replay-btn', () => {
        const confirmed = window.confirm(
            `Play ${dayLabel.toLowerCase()} again? Your saved result for this day will be cleared.`
        );
        if (!confirmed) return;
        dailyStore.clearDayRecord(dateStr);
        playDay(dateStr);
    });

    rebind('day-result-close-btn', () => {
        modal.classList.remove('active');
        if (onAfterClose) onAfterClose();
    });

    modal.classList.add('active');
}
