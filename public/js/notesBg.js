// ── Animated Music Notes Background ──────────────────────────────────────────
(function initNotesBg() {
    const canvas = document.getElementById('notesBg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CHARS = ['♩', '♪', '♫', '♬'];
    const COLOR = '34, 197, 94'; // #22c55e in RGB
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let notes = [];
    let animId = null;

    function countForWidth(w) {
        // ~1 note per 25px of width, min 20, max 150
        return Math.max(20, Math.min(150, Math.round(w / 25)));
    }

    function buildNotes() {
        const w = canvas.width;
        const h = canvas.height;
        const count = countForWidth(w);
        notes = Array.from({ length: count }, () => ({
            char: CHARS[Math.floor(Math.random() * CHARS.length)],
            x: Math.random() * w,
            y: Math.random() * h,
            size: 24 + Math.random() * 26,          // 24–50 px
            opacity: 0.04 + Math.random() * 0.08,   // 0.04–0.12
            phase: Math.random() * Math.PI * 2,
            freqX: 0.3 + Math.random() * 0.5,       // horizontal sway speed
            freqY: 0.15 + Math.random() * 0.25,     // vertical drift speed
            ampX: 12 + Math.random() * 18,           // horizontal sway ±px
            ampY: 6 + Math.random() * 10,            // vertical drift ±px
        }));
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        buildNotes();
        if (reducedMotion) drawStatic();
    }

    function drawStatic() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        notes.forEach(n => {
            ctx.font = `${n.size}px serif`;
            ctx.fillStyle = `rgba(${COLOR}, ${n.opacity})`;
            ctx.fillText(n.char, n.x, n.y);
        });
    }

    function animate(ts) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const t = ts / 1000; // seconds
        notes.forEach(n => {
            const dx = Math.sin(t * n.freqX + n.phase) * n.ampX;
            const dy = Math.cos(t * n.freqY + n.phase) * n.ampY;
            ctx.font = `${n.size}px serif`;
            ctx.fillStyle = `rgba(${COLOR}, ${n.opacity})`;
            ctx.fillText(n.char, n.x + dx, n.y + dy);
        });
        animId = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reducedMotion) {
        drawStatic();
    } else {
        animId = requestAnimationFrame(animate);
    }
})();
// ─────────────────────────────────────────────────────────────────────────────
