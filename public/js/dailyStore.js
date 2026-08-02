// Per-day daily-challenge progress, persisted in the browser (localStorage).
//
// Everything the daily challenge remembers about a user lives here so the home
// page and the game page always agree. Records are keyed by calendar date, which
// is what lets a player go back and play (or re-read) an earlier day.

export const DAILY_TOTAL = 3;      // songs in one daily challenge
export const ARCHIVE_DAYS = 30;    // how far back the archive goes

const STORE_KEY = 'songlessDailyHistory'; // { "YYYY-MM-DD": DayRecord }
const ACTIVE_DATE_KEY = 'dailyChallengeDate'; // which day the game page should load

// Flat keys written by the pre-archive version of the game. Migrated once, then
// removed so the two schemes can't drift apart.
const LEGACY_KEYS = [
    'dailySongsDate',
    'dailySongsCompleted',
    'dailySongsCorrect',
    'dailySongsTotalGuesses',
    'dailySongsLog',
];

// ── Dates ────────────────────────────────────────────────────────────────────

export function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function todayStr() {
    return toDateStr(new Date());
}

export function isValidDateStr(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseDateStr(value);
    return parsed !== null && toDateStr(parsed) === value;
}

// 'YYYY-MM-DD' is parsed as UTC midnight by the Date constructor, which renders
// as the previous day west of Greenwich — build it from local parts instead.
export function parseDateStr(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(date.getTime()) ? null : date;
}

function daysBetween(dateStr, otherStr) {
    const a = parseDateStr(dateStr);
    const b = parseDateStr(otherStr);
    if (!a || !b) return null;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** "Today", "Yesterday", or e.g. "Sat, Aug 2". */
export function formatDateLabel(dateStr) {
    const diff = daysBetween(dateStr, todayStr());
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    const date = parseDateStr(dateStr);
    if (!date) return dateStr;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** e.g. "August 2" — used in share text. */
export function formatDateLong(dateStr) {
    const date = parseDateStr(dateStr);
    if (!date) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** The playable archive, newest first, starting with today. */
export function getArchiveDates(count = ARCHIVE_DAYS) {
    const dates = [];
    const cursor = new Date();
    for (let i = 0; i < count; i++) {
        dates.push(toDateStr(cursor));
        cursor.setDate(cursor.getDate() - 1);
    }
    return dates;
}

/** Is this date inside the window the archive is willing to serve? */
export function isPlayableDate(dateStr) {
    if (!isValidDateStr(dateStr)) return false;
    const diff = daysBetween(dateStr, todayStr());
    return diff !== null && diff <= 0 && diff > -ARCHIVE_DAYS;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export function emptyRecord() {
    return { completed: 0, correct: 0, guesses: 0, log: [] };
}

function readStore() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn('dailyStore: could not read history, starting fresh.', error);
        return {};
    }
}

function writeStore(store) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (error) {
        console.warn('dailyStore: could not save history.', error);
    }
}

function normalizeRecord(record) {
    const base = emptyRecord();
    if (!record || typeof record !== 'object') return base;
    return {
        completed: Number(record.completed) || 0,
        correct: Number(record.correct) || 0,
        guesses: Number(record.guesses) || 0,
        log: Array.isArray(record.log) ? record.log : [],
    };
}

/** Fold the old single-day flat keys into the dated history, once. */
function migrateLegacyProgress() {
    const legacyDate = localStorage.getItem('dailySongsDate');
    if (!legacyDate) return;

    if (isValidDateStr(legacyDate)) {
        const store = readStore();
        if (!store[legacyDate]) {
            let log = [];
            try {
                const parsed = JSON.parse(localStorage.getItem('dailySongsLog') || '[]');
                if (Array.isArray(parsed)) log = parsed;
            } catch { /* corrupt log — drop it, the counters still carry over */ }

            const record = normalizeRecord({
                completed: parseInt(localStorage.getItem('dailySongsCompleted') || '0', 10),
                correct: parseInt(localStorage.getItem('dailySongsCorrect') || '0', 10),
                guesses: parseInt(localStorage.getItem('dailySongsTotalGuesses') || '0', 10),
                log,
            });
            if (record.completed > 0 || record.log.length > 0) {
                store[legacyDate] = record;
                writeStore(store);
                console.log(`dailyStore: migrated legacy progress for ${legacyDate}.`);
            }
        }
    }

    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}

migrateLegacyProgress();

// ── Records ──────────────────────────────────────────────────────────────────

export function getDayRecord(dateStr) {
    return normalizeRecord(readStore()[dateStr]);
}

export function getAllRecords() {
    const store = readStore();
    const out = {};
    Object.keys(store).forEach(date => { out[date] = normalizeRecord(store[date]); });
    return out;
}

function updateDayRecord(dateStr, mutate) {
    const store = readStore();
    const record = normalizeRecord(store[dateStr]);
    mutate(record);
    store[dateStr] = record;
    writeStore(store);
    return record;
}

/** Count one guess attempt (a real guess or a skip). */
export function recordGuess(dateStr) {
    return updateDayRecord(dateStr, record => { record.guesses += 1; });
}

/** Close out a song: `entry` is { title, artist, correct, guesses }. */
export function recordSongEnd(dateStr, entry) {
    return updateDayRecord(dateStr, record => {
        record.completed += 1;
        if (entry.correct) record.correct += 1;
        record.log.push({
            title: entry.title || 'Unknown',
            artist: entry.artist || '',
            correct: !!entry.correct,
            guesses: Number(entry.guesses) || 0,
        });
    });
}

/** Wipe a day so it can be replayed from scratch. */
export function clearDayRecord(dateStr) {
    const store = readStore();
    delete store[dateStr];
    writeStore(store);
}

export function isDayComplete(dateStr, total = DAILY_TOTAL) {
    return getDayRecord(dateStr).completed >= total;
}

/** Totals across every day the player has finished at least one song on. */
export function getLifetimeStats() {
    const records = getAllRecords();
    let daysPlayed = 0;
    let daysCompleted = 0;
    let songs = 0;
    let correct = 0;
    Object.keys(records).forEach(date => {
        const record = records[date];
        if (record.completed <= 0) return;
        daysPlayed += 1;
        if (record.completed >= DAILY_TOTAL) daysCompleted += 1;
        songs += record.completed;
        correct += record.correct;
    });
    return { daysPlayed, daysCompleted, songs, correct };
}

// ── Which day the game page should load ──────────────────────────────────────

export function setActiveDate(dateStr) {
    localStorage.setItem(ACTIVE_DATE_KEY, dateStr);
}

export function getActiveDate() {
    const stored = localStorage.getItem(ACTIVE_DATE_KEY);
    return isPlayableDate(stored) ? stored : todayStr();
}

/** Share text for one day's results. */
export function buildShareText(dateStr, record, total = DAILY_TOTAL) {
    const emojiRow = record.log.length
        ? record.log.map(entry => (entry.correct ? '✅' : '❌')).join(' ')
        : Array.from({ length: total }, (_, i) => (i < record.correct ? '✅' : '❌')).join(' ');
    return [
        `🎵 Songless Unlimited — ${formatDateLong(dateStr)}`,
        emojiRow,
        `${record.correct}/${total} correct · ${record.guesses} guesses`,
        'playsongless.win',
    ].join('\n');
}
