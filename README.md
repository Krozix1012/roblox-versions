# Roblox versions

Every Roblox version (Windows Player, LIVE channel) saved as a release here, so it can be installed again after Roblox stops offering it. HuiClient lists them in **Settings > Deployment > Choose a version**.

Each release is named after the Roblox version number and the day Roblox released it. Its notes hold the exact time from Roblox's own deploy log (`Released by Roblox`) and when it was saved here. Its files are the same packages Roblox serves, with their checksums checked before upload.

## Use

Needs [Node.js](https://nodejs.org) 18 or newer and the [GitHub CLI](https://cli.github.com) signed in (`gh auth login`) with access to this repo.

- `archive.cmd`: save the newest version now. It does nothing if it's already saved.
- `schedule.cmd`: check every hour in the background while you're signed in to Windows. Output goes to `archive.log`.
- `unschedule.cmd`: stop the hourly check.

HuiClient reads these releases through GitHub's public API, so everyone using HuiClient can install them once this repo is public. It tries Roblox's own servers first and only downloads from here when Roblox no longer has a version.

Roblox only shares the id of its newest version, so versions released before the archive started can't be added.
