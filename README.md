# Songless Unlimited

A music guessing game focused on rap/hip-hop songs.

**this page is a work in progess**

## Running & deploying (Cloudflare Workers)

One Worker (`src/`) serves the `/api/*` endpoints; the site itself is static
assets that `scripts/build-assets.js` assembles into `dist/`. `wrangler dev` and
`wrangler deploy` run that build automatically (`build.command` in
`wrangler.jsonc`), so there is no separate build step.

```
npm install
npm run dev       # wrangler dev on http://localhost:8787
npm run deploy    # wrangler deploy (run `npx wrangler login` first)
```

**Deploy on every push (Workers Builds):** Cloudflare dashboard → Workers & Pages
→ Create → Import a repository → pick this repo. The defaults work as-is
(deploy command `npx wrangler deploy`); the Worker name must stay `rap-songless`
to match `wrangler.jsonc`.

**Custom domain:** Workers → rap-songless → Settings → Domains & Routes → add
`songdle.win` (the domain's DNS must be on Cloudflare), or uncomment `routes` in
`wrangler.jsonc`.

### iTunes access

Genre/artist rounds and the search autocomplete call Apple's iTunes APIs from the
Worker. Apple throttles per IP (answering 403) and Workers share Cloudflare's IP
pool, so `src/itunes.js` retries, caches good answers at the edge (charts 30 min,
artist 1 h, autocomplete 10 min) and falls back to the last good copy (kept 24 h)
if Apple refuses. Responses carry `X-Itunes-Source: live | cache | stale`. If
iTunes can't be reached and nothing is cached, the API answers 502 with
`{"upstreamStatus": <what Apple said>}` and logs the failing URL to Workers Logs.

## Daily challenge

Each day is 3 songs — one rap, one pop, one from the wider chart — the same
three for everyone. Players can also go back and play any of the last 100 days
from the **Past Days** list on the home page; results are saved per day in the
browser's local storage.

The calendar is a committed snapshot, `dailysongs/daily-snapshot.json`, rather
than something assembled at request time. That's what makes a past day replay
the exact songs it originally had. Future days are in the file too, but
`/api/song-daily` refuses any date that hasn't started yet in UTC+14 (the
earliest timezone on Earth), so they can't be read ahead of time.

### Extending the calendar

```
npm run build:daily                       # top up to 100 days back / 365 ahead
npm run build:daily -- --future=730       # or reach further out
```

Days already in the snapshot are never rewritten — the script only fills in
dates that are missing, so running it can't change history. (`--rebuild`
discards the file and regenerates everything, which *will* change past days.)

Songs come from the live iTunes charts when they're reachable, and otherwise
from the 1095 tracks committed in `dailysongs/songs.json`. Run it somewhere
with network access to pick up current chart entries and album artwork.
