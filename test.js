// Checks the package list parser and the release-time lookup against Roblox's live files.
const assert = require('assert');
const { pacificToUtc, parseManifest, robloxRelease } = require('./archive');
assert.strictEqual(pacificToUtc(2026, 11, 9, 15, 10, 59), '2026-11-09T23:10:59.000Z'); // winter: UTC-8
assert.strictEqual(pacificToUtc(2026, 7, 1, 9, 0, 0), '2026-07-01T16:00:00.000Z'); // summer: UTC-7
const m = parseManifest('v0\nRobloxApp.zip\nAB12\n10\n20\ncontent-sky.zip\ncd34\n1\n2\n');
assert.deepStrictEqual(m, [{ name: 'RobloxApp.zip', md5: 'ab12' }, { name: 'content-sky.zip', md5: 'cd34' }]);
(async () => {
  const live = await (await fetch('https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE')).json();
  const t = await robloxRelease(live.version);
  assert.match(t, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/, `no release time for ${live.version}`);
  console.log('archive ok', live.version, t);
})();
