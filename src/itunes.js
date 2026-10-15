const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

// iTunes returns 100x100 artwork; the same URL accepts a larger size.
function highResArt(track) {
    return track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : track.artworkUrl100;
}

function toAppTrack(track) {
    return {
        id: track.trackId ? track.trackId.toString() : Date.now().toString(),
        title: track.trackName,
        artist: track.artistName,
        previewUrl: track.previewUrl,
        albumArt: highResArt(track),
    };
}

export async function searchRaw(term, { limit = 50, attribute = null } = {}) {
    const params = new URLSearchParams();
    if (term && term.trim() !== '') params.append('term', term);
    params.append('country', 'US');
    params.append('media', 'music');
    params.append('entity', 'song');
    params.append('limit', String(limit));
    if (attribute) params.append('attribute', attribute);

    const url = `${ITUNES_SEARCH_URL}?${params}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`iTunes search failed: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.results || [];
}

// Top songs from the iTunes RSS chart. genreId=null is the general top chart.
// Entries are returned in the iTunes search shape (trackId, trackName, ...).
export async function topSongsRss(genreId, limit = 100) {
    const url = genreId
        ? `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`
        : `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`iTunes RSS fetch failed: ${response.status}`);
        const data = await response.json();
        if (!data.feed || !data.feed.entry) return [];

        return data.feed.entry.map(entry => {
            const preview = entry.link.find(
                l => l.attributes && l.attributes.rel === 'enclosure' && l.attributes.type === 'audio/x-m4a'
            );
            const images = entry['im:image'];
            return {
                trackId: entry.id.attributes['im:id'],
                trackName: entry['im:name'].label,
                artistName: entry['im:artist'].label,
                previewUrl: preview ? preview.attributes.href : null,
                artworkUrl100: images && images.length > 0 ? images[images.length - 1].label : null,
            };
        }).filter(t => t.previewUrl);
    } catch (error) {
        console.error(`itunes: RSS error for genre ${genreId}:`, error);
        return [];
    }
}

export async function getRandomSong({ genreId, artistName, excludeIds }) {
    let tracks;
    if (genreId) {
        tracks = await topSongsRss(genreId, 100);
    } else if (artistName) {
        tracks = (await searchRaw(artistName, { limit: 50, attribute: 'artistTerm' })).filter(t => t.previewUrl);
    } else {
        return null;
    }

    const available = tracks.filter(t => !excludeIds.has(t.trackId ? t.trackId.toString() : ''));
    if (available.length === 0) return null;
    return toAppTrack(available[Math.floor(Math.random() * available.length)]);
}

export async function searchForAutocomplete(term) {
    try {
        const results = await searchRaw(term, { limit: 10 });
        return results.map(t => ({
            id: t.trackId ? t.trackId.toString() : Date.now().toString(),
            title: t.trackName,
            artist: t.artistName,
            albumArt: highResArt(t),
        }));
    } catch (error) {
        console.error(`itunes: autocomplete error for "${term}":`, error.message);
        return [];
    }
}
