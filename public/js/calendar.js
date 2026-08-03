// Month-by-month view of the daily challenge archive.
//
// Each cell is an indicator lamp: the three dots are the day's three songs, so
// a month's results read without parsing a single number. Days that haven't
// arrived — and days older than the archive window — are drawn unlit and are
// not clickable.

import * as dailyStore from './dailyStore.js';
import { playDay, openDayResults } from './dailyUi.js';
import './notesBg.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const grid = document.getElementById('calendar-grid');
const monthLabel = document.getElementById('month-label');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const summaryEl = document.getElementById('calendar-summary');
const dayResultModal = document.getElementById('day-result-modal');

const today = dailyStore.todayStr();
// Oldest day still playable — the far edge of the archive window.
const earliest = dailyStore.getArchiveDates().slice(-1)[0];

// The month on screen, tracked as a Date pinned to the 1st.
let viewYear;
let viewMonth;

function pad(n) {
    return String(n).padStart(2, '0');
}

function dateStrFor(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/** Is this month entirely before the archive, or entirely in the future? */
function monthHasPlayableDays(year, month) {
    const lastOfMonth = dateStrFor(year, month, daysInMonth(year, month));
    const firstOfMonth = dateStrFor(year, month, 1);
    return lastOfMonth >= earliest && firstOfMonth <= today;
}

function renderSummary() {
    if (!summaryEl) return;
    const { daysPlayed, songs, correct } = dailyStore.getLifetimeStats();
    summaryEl.textContent = daysPlayed
        ? `${daysPlayed} ${daysPlayed === 1 ? 'day' : 'days'} played · ${correct}/${songs} songs correct`
        : 'No days played yet — pick one below.';
}

function buildDayCell(dateStr, dayNum) {
    const record = dailyStore.getDayRecord(dateStr);
    const complete = record.completed >= dailyStore.DAILY_TOTAL;
    const started = record.completed > 0;
    // A day is locked if it hasn't arrived or has aged out of the archive.
    const locked = dateStr > today || dateStr < earliest;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-day';
    cell.dataset.date = dateStr;

    if (locked) {
        cell.classList.add('calendar-day--locked');
        cell.disabled = true;
        cell.setAttribute('aria-disabled', 'true');
    } else if (complete) {
        cell.classList.add('calendar-day--complete');
    } else if (started) {
        cell.classList.add('calendar-day--partial');
    }
    if (dateStr === today) cell.classList.add('calendar-day--today');

    const num = document.createElement('span');
    num.className = 'calendar-day-num';
    num.textContent = String(dayNum);
    cell.appendChild(num);

    // Three dots — one per song. Only drawn once a day has been started.
    if (!locked && started) {
        const dots = document.createElement('span');
        dots.className = 'calendar-day-dots';
        for (let i = 0; i < dailyStore.DAILY_TOTAL; i++) {
            const dot = document.createElement('span');
            const entry = record.log[i];
            dot.className = 'day-dot' + (entry ? (entry.correct ? ' day-dot--correct' : ' day-dot--wrong') : '');
            dots.appendChild(dot);
        }
        cell.appendChild(dots);
    }

    const label = dailyStore.formatDateLabel(dateStr);
    cell.setAttribute('aria-label',
        locked ? `${label} — not available`
        : complete ? `${label} — ${record.correct} of ${dailyStore.DAILY_TOTAL} correct`
        : started ? `${label} — ${record.completed} of ${dailyStore.DAILY_TOTAL} played, resume`
        : `${label} — play`);

    if (!locked) {
        cell.addEventListener('click', () => {
            if (complete) {
                openDayResults(dayResultModal, dateStr, { onAfterClose: render });
            } else {
                playDay(dateStr);
            }
        });
    }

    return cell;
}

function render() {
    if (!grid) return;
    grid.innerHTML = '';

    if (monthLabel) {
        monthLabel.textContent = new Date(viewYear, viewMonth, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    WEEKDAYS.forEach(day => {
        const head = document.createElement('div');
        head.className = 'calendar-weekday';
        head.textContent = day.slice(0, 1);
        head.setAttribute('aria-label', day);
        grid.appendChild(head);
    });

    // Pad out to the weekday the 1st falls on.
    const leading = new Date(viewYear, viewMonth, 1).getDay();
    for (let i = 0; i < leading; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-blank';
        grid.appendChild(blank);
    }

    const total = daysInMonth(viewYear, viewMonth);
    for (let day = 1; day <= total; day++) {
        grid.appendChild(buildDayCell(dateStrFor(viewYear, viewMonth, day), day));
    }

    if (prevBtn) {
        const prev = new Date(viewYear, viewMonth - 1, 1);
        prevBtn.disabled = !monthHasPlayableDays(prev.getFullYear(), prev.getMonth());
    }
    if (nextBtn) {
        const next = new Date(viewYear, viewMonth + 1, 1);
        nextBtn.disabled = !monthHasPlayableDays(next.getFullYear(), next.getMonth());
    }

    renderSummary();
}

function shiftMonth(delta) {
    const shifted = new Date(viewYear, viewMonth + delta, 1);
    viewYear = shifted.getFullYear();
    viewMonth = shifted.getMonth();
    render();
}

function init() {
    const now = dailyStore.parseDateStr(today) || new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    if (prevBtn) prevBtn.addEventListener('click', () => shiftMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => shiftMonth(1));

    render();
}

init();
