// Roblox version archive: saves each new Roblox version (Windows Player, LIVE channel) into this repo's
// GitHub releases, so it can still be installed after Roblox stops offering it. HuiClient lists them in
// Settings > Deployment. Running it when the newest version is already saved does nothing.
// GitHub runs it every 30 minutes (.github/workflows/archive.yml). By hand: Node 18+ and the GitHub CLI signed in.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'Krozix1012/roblox-versions';
const CDN = 'https://setup.rbxcdn.com';
const HASH_RE = /^version-[0-9a-f]+$/;
const log = (msg) => console.log(`[${new Date().toLocaleString('en-GB')}] ${msg}`);
const gh = (args, stdio = 'pipe') => execFileSync('gh', args, { encoding: 'utf8', stdio: stdio === 'pipe' ? ['ignore', 'pipe', 'pipe'] : stdio, maxBuffer: 64e6, windowsHide: true });

async function get(url, as = 'text') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
}

// The package list: a "v0" line, then name, md5, packed size, unpacked size for each zip.
function parseManifest(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out = [];
  for (let i = 1; i + 1 < lines.length; i++) if (/\.zip$/i.test(lines[i])) { out.push({ name: lines[i], md5: lines[i + 1].toLowerCase() }); i += 3; }
  return out;
}

// A wall-clock time in Roblox's time zone (US Pacific, summer time included) as a UTC ISO string.
function pacificToUtc(y, mo, d, h, mi, s) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(wall)).map((p) => [p.type, +p.value]));
  const offset = wall - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(wall + offset).toISOString();
}

// Roblox's deploy log hides version ids now, but still lists each build's number with the time it went out
// (in Pacific time: its newest line always matches the file's own UTC change time minus 7 or 8 hours).
async function robloxRelease(number) {
  const fileVersion = number.split('.').join(', ');
  const history = await get(`${CDN}/DeployHistory.txt`).catch(() => '');
  const line = history.split(/\r?\n/).find((l) => l.startsWith('New WindowsPlayer ') && l.includes(`file version: ${fileVersion},`));
  const m = line && line.match(/ at (\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) (AM|PM)/);
  if (!m) return '';
  const [, mo, d, y, h, mi, s, ap] = m.map((x) => (/^\d+$/.test(x) ? +x : x));
  return pacificToUtc(y, mo, d, (h % 12) + (ap === 'PM' ? 12 : 0), mi, s);
}

async function download(url, file, md5) {
  for (let attempt = 1; ; attempt++) {
    try {
      const data = await get(url, 'buffer');
      if (crypto.createHash('md5').update(data).digest('hex') !== md5) throw new Error('checksum mismatch');
      fs.writeFileSync(file, data);
      return data.length;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${path.basename(file)} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

// Roblox rolls a new version out gradually, so its two version addresses can answer differently, and one
// machine can keep getting the old version for hours. Both are asked, and every version either names is saved.
const SOURCES = [
  'https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE',
  'https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE',
];
async function liveVersions() {
  const found = new Map();
  for (const url of SOURCES) {
    try {
      const v = JSON.parse(await get(url));
      if (HASH_RE.test(v.clientVersionUpload || '')) found.set(v.clientVersionUpload, v.version);
    } catch (e) { log(`Couldn't ask ${new URL(url).hostname}: ${e.message}`); }
  }
  if (!found.size) throw new Error("Roblox didn't say which version is current.");
  return [...found].map(([hash, number]) => ({ hash, number }));
}
const isSaved = (hash) => { try { gh(['release', 'view', hash, '-R', REPO]); return true; } catch { return false; } };

// --watch <minutes>: keep asking every 2 minutes for that long, to catch a version that's still rolling out.
async function main() {
  const at = process.argv.indexOf('--watch'), until = Date.now() + (at > 0 ? +process.argv[at + 1] || 0 : 0) * 60000;
  for (;;) {
    for (const v of await liveVersions()) {
      if (isSaved(v.hash)) log(`${v.number} (${v.hash}) is already saved.`);
      else await save(v);
    }
    if (Date.now() + 120000 > until) return;
    await new Promise((r) => setTimeout(r, 120000));
  }
}

async function save({ hash, number }) {

  log(`New version ${number} (${hash}). Downloading...`);
  const manifestName = `${hash}-rbxPkgManifest.txt`;
  const manifest = await get(`${CDN}/${manifestName}`);
  const pkgs = parseManifest(manifest);
  if (!pkgs.length) throw new Error('The package list was empty.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roblox-archive-'));
  try {
    fs.writeFileSync(path.join(dir, manifestName), manifest);
    let bytes = 0;
    const queue = [...pkgs];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) { const p = queue.shift(); const n = await download(`${CDN}/${hash}-${p.name}`, path.join(dir, `${hash}-${p.name}`), p.md5); bytes += n; }
    }));
    log(`Downloaded ${pkgs.length} packages (${Math.round(bytes / 1048576)} MB), all checksums match. Uploading...`);
    const released = await robloxRelease(number);
    const notes = [
      `Roblox version: ${number}`,
      `Released by Roblox: ${released || 'unknown'}`,
      `Saved: ${new Date().toISOString()}`,
      '',
      'Windows Player, LIVE channel. Install it from HuiClient > Settings > Deployment.',
      'The release time (UTC) is from Roblox\'s own deploy log.',
    ].join('\n');
    const files = [manifestName, ...pkgs.map((p) => `${hash}-${p.name}`)].map((f) => path.join(dir, f));
    gh(['release', 'create', hash, ...files, '-R', REPO, '--title', `${number}${released ? ` (${released.slice(0, 10)})` : ''}`, '--notes', notes], 'inherit');
    log(`Saved ${number} to ${REPO}.`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch((e) => { log(`Failed: ${e.message}`); process.exitCode = 1; });
module.exports = { pacificToUtc, parseManifest, robloxRelease };
