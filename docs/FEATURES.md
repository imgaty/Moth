# Features

`Created: 12 September 2026` | `Last updated: 18 September 2026`

Moth's current, planned, and rejected features.

<br>

## Current features

### Theme switcher

Switch between light, dark, and system themes from the status bar. See the
[User Manual](USER-MANUAL.md#theme-switcher) for details.

### Icon styles

Moth bundles carefully selected icons from several icon libraries: `Lucide`,
`Tabler Icons`, `Phosphor`, `Bootstrap Icons`, `Font Awesome`, and
`Material Symbols`. For now, they let you choose the icon of the theme
switcher button.

### Multi-language support

Moth's display language follows Visual Studio Code's
(**Command Palette > Configure Display Language**). It includes a translation
for every language pack the editor offers: `Arabic`, `Armenian`, `Bulgarian`,
`Burmese`, `Catalan`, `Chinese (Simplified and Traditional)`, `Czech`,
`Dutch`, `French`, `German`, `Gujarati`, `Hindi`, `Hungarian`, `Indonesian`,
`Italian`, `Japanese`, `Korean`, `Lithuanian`, `Marathi`, `Polish`,
`Portuguese (Brazil)`, `Punjabi`, `Russian`, `Spanish`, `Turkish`,
`Ukrainian`, and `Vietnamese`.

Each translation is a single `l10n/bundle.l10n.<language>.json` file. The
English text in `src/extension.js` serves as the key, so English needs no file
of its own, and it is also the fallback when a translation is missing.

To add a language, copy any file in `l10n/`, rename it using Visual Studio
Code's ID for that language (for example, `sv`), and translate the values.

Command Palette names stay in English. Visual Studio Code only reads their
translations from files next to `package.json`, while Moth keeps all language
files in one folder.

<br>

## Known limitations

**Visual Studio Code for the Web** (vscode.dev) is not supported.

<br>

## Roadmap

- [x] `Theme switcher`: switch between light, dark, and system themes from the
  status bar.
- [ ] `Format on save`: turn format on save on or off in one click.
- [ ] `Indentation`: set tabs or spaces, and their size, for all file types or
  one at a time.
- [ ] `Individual auto-save`: choose which files save automatically and which
  don't.
- [ ] `Kill a port process`: free a port stuck on `EADDRINUSE` without leaving
  the editor.
- [ ] `Whitespace`: show or hide spaces and tabs in the editor.
- [ ] `Word wrap`: turn line wrapping on or off.
- [ ] `Zoom`: change the editor font size and the window zoom level.

<br>

## Rejected

### AI token tracking

There is no local source of truth. Every service keeps usage and billing data
on its own servers; what reaches the disk is undocumented transcript and cache
data that can change with any release.

It is also a different kind of product: it monitors spending rather than
making the editor more comfortable to use.

### Clipboard history

Visual Studio Code fires no event when the clipboard changes, so Moth would
have to poll `env.clipboard.readText()` on a timer. That drains battery and
means reading everything you copy, passwords included, for a feature the
operating system or a dedicated app already provides.

### Reordering status bar items

Visual Studio Code does not allow status bar items to be rearranged manually.
