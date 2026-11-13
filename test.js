// Checks the package list parser and the release-time lookup against Roblox's live files.
const assert = require('assert');
const { parseManifest, robloxRelease } = require('./archive');
const m = parseManifest('v0\nRobloxApp.zip\nAB12\n10\n20\ncontent-sky.zip\ncd34\n1\n2\n');
assert.deepStrictEqual(m, [{ name: 'RobloxApp.zip', md5: 'ab12' }, { name: 'content-sky.zip', md5: 'cd34' }]);
(async () => {
  const live = await (await fetch('https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE')).json();
  const t = await robloxRelease(live.version);
  assert.match(t, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/, `no release time for ${live.version}`);
  console.log('archive ok', live.version, t);
})();
