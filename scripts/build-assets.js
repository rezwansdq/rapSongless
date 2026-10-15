#!/usr/bin/env node
/**
 * Assembles dist/ — the static asset directory Cloudflare serves.
 *
 * Source layout (public/, images/) is unchanged; this only maps files onto the
 * URLs the site uses:
 *   /          <- public/home.html
 *   /game      <- public/index.html
 *   /calendar  <- public/calendar.html
 *   /favicon.ico, /favicon.svg, /apple-touch-icon.png  <- images/
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const copy = (from, to) => {
    const dest = path.join(dist, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(path.join(root, from), dest, { recursive: true });
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

copy('public/home.html', 'index.html');
copy('public/index.html', 'game.html');
copy('public/calendar.html', 'calendar.html');
for (const f of ['style.css', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'js', 'fonts']) {
    copy(`public/${f}`, f);
}
copy('images', 'images');
copy('images/favicon.ico', 'favicon.ico');
copy('images/favicon.svg', 'favicon.svg');
copy('images/apple-touch-icon.png', 'apple-touch-icon.png');
copy('images/apple-touch-icon.png', 'apple-touch-icon-precomposed.png');

console.log('Built dist/');
