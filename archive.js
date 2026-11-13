// Roblox version archive: saves each new Roblox version (Windows Player, LIVE channel) into this repo's
// GitHub releases, so it can still be installed after Roblox stops offering it. HuiClient lists them in
// Settings > Deployment. Running it when the newest version is already saved does nothing.
// Needs Node 18+ and the GitHub CLI (gh) signed in with access to this repo.
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

// Roblox's deploy log hides version ids now, but still lists each build's number with the time it went out.
async function robloxRelease(number) {
  const fileVersion = number.split('.').join(', ');
  const history = await get(`${CDN}/DeployHistory.txt`).catch(() => '');
  const line = history.split(/\r?\n/).find((l) => l.startsWith('New WindowsPlayer ') && l.includes(`file version: ${fileVersion},`));
  const m = line && line.match(/ at (\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) (AM|PM)/);
  if (!m) return '';
  const [, mo, d, y, h, mi, s, ap] = m;
  const hour = (+h % 12) + (ap === 'PM' ? 12 : 0);
  const two = (n) => String(n).padStart(2, '0');
  return `${y}-${two(mo)}-${two(d)} ${two(hour)}:${mi}:${s}`;
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

async function main() {
  const live = JSON.parse(await get('https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE'));
  const hash = live.clientVersionUpload, number = live.version;
  if (!HASH_RE.test(hash || '')) throw new Error(`Roblox returned an odd version id: ${hash}`);
  try { gh(['release', 'view', hash, '-R', REPO]); log(`${number} (${hash}) is already saved.`); return; } catch {}

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
      'The release time is from Roblox\'s own deploy log.',
    ].join('\n');
    const files = [manifestName, ...pkgs.map((p) => `${hash}-${p.name}`)].map((f) => path.join(dir, f));
    gh(['release', 'create', hash, ...files, '-R', REPO, '--title', `${number}${released ? ` (${released.slice(0, 10)})` : ''}`, '--notes', notes], 'inherit');
    log(`Saved ${number} to ${REPO}.`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch((e) => { log(`Failed: ${e.message}`); process.exitCode = 1; });
module.exports = { parseManifest, robloxRelease };
