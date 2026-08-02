# Songless Unlimited

A music guessing game focused on rap/hip-hop songs.

**this page is a work in progess**

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
