# Roblox versions

Every Roblox version (Windows Player, LIVE channel) from November 2026 on, saved as a release here: the version id, the exact time Roblox released it, and all of its files. HuiClient lists them in **Settings > Deployment > Choose a version**, so anyone using it can switch Roblox to any of them.

Each release is named after the Roblox version number and the day Roblox released it. Its notes hold the exact release time in UTC (`Released by Roblox`, from Roblox's own deploy log) and when it was saved here. Its files are the same packages Roblox serves, with their checksums checked before upload.

## How new versions get here

GitHub checks for a new version every 30 minutes and saves it (`.github/workflows/archive.yml`), so nothing depends on a PC being on. To start a check right away, open the **Actions** tab, pick **Save new Roblox versions**, and press **Run workflow**.

It can also run on your PC: `archive.cmd` (needs [Node.js](https://nodejs.org) 18+ and the [GitHub CLI](https://cli.github.com) signed in). It does nothing if the newest version is already saved.

## How HuiClient uses it

HuiClient reads these releases through GitHub's public API, so everyone using HuiClient sees them once this repo is public. It downloads a version from Roblox's own servers while Roblox still has it, and from here once Roblox doesn't.

Roblox only shares the id of its newest version, so versions released before the archive started can't be added.
