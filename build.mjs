// Builds and publishes the Mysterra offline map release (one GitHub release per Protomaps build):
//   <region>.pmtiles – one extract per country of the latest Protomaps daily OSM build (ODbL)
//   assets.zip       – fonts (all ranges) + light/dark sprites from protomaps/basemaps-assets
//   manifest.json    – { version, files: [{ name, size, sha256 }], regions: [{ id, name, file, bbox }] }
// Each file is uploaded right after it is built and then deleted: all countries together do not fit on a
// GitHub runner's disk. The release stays a draft until the manifest is in, so the app never sees half of it.
// Requires: Node 22, `pmtiles` CLI (PMTILES env), `unzip`, `zip`, `gh` (GH_TOKEN), GITHUB_REPOSITORY.
// REPLACE=true rebuilds a release that already exists; ONLY=cz,ch builds a subset (testing).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, createReadStream, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// bbox: west,south,east,north. Bigger countries at zoom 13 so each file stays under the 2 GiB asset limit;
// a file still over it is cut again one zoom lower.
const REGIONS = [
  { id: 'cz', name: 'Česko', bbox: [12.09, 48.55, 18.86, 51.06], maxzoom: 14 },
  { id: 'sk', name: 'Slovensko', bbox: [16.83, 47.73, 22.57, 49.61], maxzoom: 14 },
  { id: 'at', name: 'Rakousko', bbox: [9.53, 46.37, 17.16, 49.02], maxzoom: 14 },
  { id: 'ch', name: 'Švýcarsko', bbox: [5.95, 45.82, 10.49, 47.81], maxzoom: 14 },
  { id: 'si', name: 'Slovinsko', bbox: [13.37, 45.42, 16.61, 46.88], maxzoom: 14 },
  { id: 'hr', name: 'Chorvatsko', bbox: [13.49, 42.39, 19.45, 46.55], maxzoom: 14 },
  { id: 'hu', name: 'Maďarsko', bbox: [16.11, 45.74, 22.9, 48.59], maxzoom: 14 },
  { id: 'pl', name: 'Polsko', bbox: [14.12, 49.0, 24.15, 54.84], maxzoom: 13 },
  { id: 'de', name: 'Německo', bbox: [5.87, 47.27, 15.04, 55.06], maxzoom: 13 },
];
// Every stack the Protomaps style references (incl. format overrides), all glyph ranges: a missing
// range file can stall symbol layout for a whole tile in MapLibre Native.
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic', 'Noto Sans Devanagari Regular v1'];
const SPRITES = ['light', 'dark'].flatMap((f) => [`${f}.json`, `${f}.png`, `${f}@2x.json`, `${f}@2x.png`]);
const MAX_BYTES = 2 * 1024 ** 3 - 1; // GitHub release asset limit

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) throw new Error('GITHUB_REPOSITORY is not set');
// An empty workflow input arrives as ONLY="" and means "all regions".
const only = (process.env.ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const regions = REGIONS.filter((r) => !only.length || only.includes(r.id));
if (!regions.length) throw new Error(`ONLY=${process.env.ONLY} matches no region`);
const out = 'out';
const work = 'work';
rmSync(out, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(out);
mkdirSync(work);

const gh = (...args) => execFileSync('gh', [...args, '-R', repo], { stdio: 'inherit' });
const exists = (tag) => {
  try {
    execFileSync('gh', ['release', 'view', tag, '-R', repo], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });

const builds = await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json();
const latest = builds
  .map((b) => b.key)
  .filter((k) => /^\d{8}\.pmtiles$/.test(k))
  .sort()
  .at(-1);
const version = latest.slice(0, 8);
const tag = `v${version}`;
console.log('Protomaps build', latest);
if (exists(tag)) {
  if (process.env.REPLACE !== 'true') {
    console.log(`${tag} already released`);
    process.exit(0);
  }
  gh('release', 'delete', tag, '--yes', '--cleanup-tag');
}
gh(
  'release',
  'create',
  tag,
  '--draft',
  '--title',
  `Map ${version}`,
  '--notes',
  `Offline map regions (${regions.map((r) => r.name).join(', ')}) of Protomaps build ${version}. ` +
    'Map data © OpenStreetMap contributors (ODbL), Protomaps. Fonts: Noto Sans (OFL).',
);

const files = [];
async function publish(name) {
  const path = join(out, name);
  files.push({ name, size: statSync(path).size, sha256: await sha256(path) });
  gh('release', 'upload', tag, path);
  rmSync(path);
}

// Shared fonts and sprites.
const res = await fetch('https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip');
if (!res.ok) throw new Error(`basemaps-assets: HTTP ${res.status}`);
writeFileSync(join(work, 'assets-src.zip'), Buffer.from(await res.arrayBuffer()));
execFileSync('unzip', ['-q', 'assets-src.zip'], { cwd: work, stdio: 'inherit' });
const src = join(work, 'basemaps-assets-main');
const pkg = join(work, 'pkg');
for (const font of FONTS) cpSync(join(src, 'fonts', font), join(pkg, 'fonts', font), { recursive: true });
for (const s of SPRITES) cpSync(join(src, 'sprites', 'v4', s), join(pkg, 'sprites', 'v4', s));
cpSync(join(src, 'fonts', 'OFL.txt'), join(pkg, 'fonts', 'OFL.txt'));
execFileSync('zip', ['-q', '-r', join('..', '..', out, 'assets.zip'), 'fonts', 'sprites'], {
  cwd: pkg,
  stdio: 'inherit',
});
await publish('assets.zip');

for (const r of regions) {
  const file = `${r.id}.pmtiles`;
  for (let z = r.maxzoom; ; z--) {
    execFileSync(
      process.env.PMTILES ?? 'pmtiles',
      [
        'extract',
        `https://build.protomaps.com/${latest}`,
        join(out, file),
        `--bbox=${r.bbox.join(',')}`,
        `--maxzoom=${z}`,
      ],
      { stdio: 'inherit' },
    );
    if (statSync(join(out, file)).size <= MAX_BYTES) break;
    if (z <= 11) throw new Error(`${file} exceeds 2 GiB even at zoom ${z}`);
    console.log(`${file} over 2 GiB at zoom ${z}, cutting at ${z - 1}`);
  }
  await publish(file);
}

// Never publish (or clean up after) a release that lacks a region it was meant to carry.
const missing = regions.filter((r) => !files.some((f) => f.name === `${r.id}.pmtiles`));
if (missing.length) throw new Error(`missing region files: ${missing.map((r) => r.id).join(', ')}`);
const manifest = {
  version,
  files,
  regions: regions.map(({ id, name, bbox }) => ({ id, name, file: `${id}.pmtiles`, bbox })),
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
gh('release', 'upload', tag, join(out, 'manifest.json'));
gh('release', 'edit', tag, '--draft=false', '--latest');

// Keep the two newest map releases: the app needs only the latest (and a download that started on the one
// before may still finish); older ones would pile up gigabytes every month.
const tags = JSON.parse(
  execFileSync('gh', ['release', 'list', '-R', repo, '--limit', '100', '--json', 'tagName'], { encoding: 'utf-8' }),
)
  .map((r) => r.tagName)
  .filter((t) => /^v\d{8}$/.test(t))
  .sort()
  .reverse();
for (const old of tags.slice(2)) gh('release', 'delete', old, '--yes', '--cleanup-tag');
console.log(JSON.stringify(manifest, null, 2));
