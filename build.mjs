// Builds the Mysterra offline map package for Czechia into ./out:
//   cz.pmtiles   – extract of the latest Protomaps daily OSM build (ODbL)
//   assets.zip   – fonts (Latin/Greek/Cyrillic ranges) + light sprites from protomaps/basemaps-assets
//   manifest.json – { version, files: [{ name, size, sha256 }] }
// Requires: Node 22, `pmtiles` CLI (path in PMTILES env, default "pmtiles"), `unzip` and `zip` on PATH.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, createReadStream, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BBOX = '12.09,48.55,18.86,51.06';
const MAX_ZOOM = '15';
// Every stack the Protomaps style references (incl. format overrides), all glyph ranges: a missing
// range file can stall symbol layout for a whole tile in MapLibre Native.
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic', 'Noto Sans Devanagari Regular v1'];
const SPRITES = ['light.json', 'light.png', 'light@2x.json', 'light@2x.png'];
const MAX_BYTES = 2 * 1024 ** 3; // GitHub release asset limit

const out = 'out';
const work = 'work';
rmSync(out, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(out);
mkdirSync(work);

const builds = await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json();
const latest = builds.map((b) => b.key).filter((k) => /^\d{8}\.pmtiles$/.test(k)).sort().at(-1);
const version = latest.slice(0, 8);
console.log('Protomaps build', latest);

execFileSync(
  process.env.PMTILES ?? 'pmtiles',
  ['extract', `https://build.protomaps.com/${latest}`, join(out, 'cz.pmtiles'), `--bbox=${BBOX}`, `--maxzoom=${MAX_ZOOM}`],
  { stdio: 'inherit' },
);
if (statSync(join(out, 'cz.pmtiles')).size > MAX_BYTES) throw new Error('cz.pmtiles exceeds 2 GiB');

const res = await fetch('https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip');
if (!res.ok) throw new Error(`basemaps-assets: HTTP ${res.status}`);
writeFileSync(join(work, 'assets-src.zip'), Buffer.from(await res.arrayBuffer()));
execFileSync('unzip', ['-q', 'assets-src.zip'], { cwd: work, stdio: 'inherit' });
const src = join(work, 'basemaps-assets-main');
const pkg = join(work, 'pkg');
for (const font of FONTS) cpSync(join(src, 'fonts', font), join(pkg, 'fonts', font), { recursive: true });
for (const s of SPRITES) cpSync(join(src, 'sprites', 'v4', s), join(pkg, 'sprites', 'v4', s));
cpSync(join(src, 'fonts', 'OFL.txt'), join(pkg, 'fonts', 'OFL.txt'));
execFileSync('zip', ['-q', '-r', join('..', '..', out, 'assets.zip'), 'fonts', 'sprites'], { cwd: pkg, stdio: 'inherit' });

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
const files = [];
for (const name of ['cz.pmtiles', 'assets.zip']) {
  const path = join(out, name);
  files.push({ name, size: statSync(path).size, sha256: await sha256(path) });
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ version, files }, null, 2));
console.log(JSON.stringify({ version, files }, null, 2));
