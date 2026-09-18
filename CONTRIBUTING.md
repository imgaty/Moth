# Contributing

`Created: 12 September 2026` | `Last updated: 18 September 2026`

A guide to contributing to the Moth project.

<br>

## Project scope

Moth makes Visual Studio Code more comfortable to use. It surfaces settings
that are obscure or buried in the Settings editor, puts useful built-in
features a click away, and turns long-requested quality-of-life improvements
into practical tools.

The status bar button is only the way in. Every feature behind it should make
the editor easier and more pleasant to use, without competing with Visual
Studio Code or adding unnecessary complexity.

### What belongs in Moth

A feature fits Moth when it solves a real problem that Visual Studio Code users
run into repeatedly, either by exposing an existing setting or capability that
is hard to discover or use, or by delivering a widely requested quality-of-life
improvement. It should also be quick to reach, and run locally with a clear and
maintainable implementation.

Before proposing a feature, check [Features](docs/FEATURES.md) to see whether
it is already planned or if it has been rejected. In the proposal, explain the
problem the proposed feature solves, why the current Visual Studio Code
workflow falls short, and why the feature belongs in Moth.

All Moth features must neither require an internet connection at runtime nor
rely on third-party dependencies.

<br>

## Project structure

```text
├── assets/                   # Bundled icon font and images
│   ├── img/                  # Extension icon
│   └── screenshots/          # Documentation screenshots
├── docs/                     # User-facing documentation
│   ├── FEATURES.md           # Current, planned, and rejected features
│   └── USER-MANUAL.md        # Installation and usage guide
├── l10n/                     # Translation bundles
├── src/                      # Extension source code
│   ├── build-font.py         # Rebuilds the icon font
│   ├── extension.js          # Status bar button, panel, and picker
│   └── themePreview.js       # Theme preview cards
├── test/                     # Automated checks
│   ├── extension.test.js     # Extension behavior tests
│   └── languages.test.js     # Translation bundle checks
├── package.json              # Extension manifest and metadata
├── CHANGELOG.md              # Release history
├── CONTRIBUTING.md           # Contributor guide
├── LICENSE                   # MIT license
├── README.md                 # Project overview
└── THIRD-PARTY-NOTICES.md    # Icon set licenses
```

<br>

## Running Moth

Open the project in Visual Studio Code and press `F5`. A second Visual Studio
Code window opens with the extension loaded. After making changes, press
`Ctrl R` (Windows), `Cmd R` (macOS), or `Ctrl R` (Linux) in that window to
reload it.

<br>

## Before a pull request

1.  Run both checks with [Node.js](https://nodejs.org):

    ```sh
    node test/extension.test.js; node test/languages.test.js
    ```

    If Node.js is unavailable, Visual Studio Code's own runtime works too. Run
    each file separately.

    Windows (PowerShell):

    ```powershell
    $env:ELECTRON_RUN_AS_NODE = 1
    ```
    ```powershell
    & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" test\extension.test.js
    ```
    ```powershell
    & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" test\languages.test.js
    ```

    macOS:

    ```sh
    export ELECTRON_RUN_AS_NODE=1
    ```
    ```sh
    "/Applications/Visual Studio Code.app/Contents/MacOS/Code" test/extension.test.js
    ```
    ```sh
    "/Applications/Visual Studio Code.app/Contents/MacOS/Code" test/languages.test.js
    ```

    Linux (`.deb` and `.rpm` installs; Snap uses
    `/snap/code/current/usr/share/code/code`):

    ```sh
    export ELECTRON_RUN_AS_NODE=1
    ```
    ```sh
    /usr/share/code/code test/extension.test.js
    ```
    ```sh
    /usr/share/code/code test/languages.test.js
    ```

    <br>

    `extension.test.js` runs the extension against a fake `vscode` module. It
    checks the button, panel, picker, icon sets, and system names for five Linux
    distributions (`Arch`, `Ubuntu`, `Debian`, `Mint`, and `Fedora`), and
    that a missing or empty `os-release` falls back to `Linux`.

    `languages.test.js` checks every bundle against the strings in
    `src/`, including whether any `l10n.t` call uses a form the extractor cannot
    read.


2.  Keep `dependencies` and `devDependencies` empty.
3.  Maintain the code in plain JavaScript, with no build step and no
    transpiler.
4.  The translation check reads `vscode.l10n.t('...')`, therefore keep all
    display strings in this format and inside the single quotes.
5.  Record all changes and fixes in `CHANGELOG.md` under the relevant version.

For anything larger than a bug fix, open an
[issue](https://github.com/imgaty/Moth/issues) first. This helps confirm that
the proposal fits the project's scope before implementation begins.

<br>

## Rebuilding the icon font

After adding icons, rebuild the font with `src/build-font.py`. The script
needs [fontTools](https://github.com/fonttools/fonttools) with WOFF2 support,
and a network connection, because it downloads the source fonts.

Windows (PowerShell):

```powershell
py -m pip install "fonttools[woff]"
```
```powershell
py src\build-font.py
```

macOS and Linux:

```sh
python3 -m pip install "fonttools[woff]"
```
```sh
python3 src/build-font.py
```

Reload Visual Studio Code after rebuilding. When adding a whole new icon set,
also update `SETS` and `FIRST_CODEPOINT` in the script, `package.json`, and
`THIRD-PARTY-NOTICES.md`.

<br>

## Packaging a release

Packaging requires Node.js, although the extension itself does not. Because
Moth has no runtime dependencies, pass `--no-dependencies`; without it, `vsce`
resolves an empty file list and fails with `Extension entrypoint(s) missing`.

```sh
npx @vscode/vsce package --no-dependencies
```

This produces `moth-<version>.vsix`, which can be attached to a GitHub
release. Publishing to the Marketplace also requires a publisher account and an
Azure DevOps token; see the
[publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

<br>

## Credits

### Icons

[Lucide](https://lucide.dev) (ISC),
[Tabler Icons](https://tabler.io/icons) (MIT),
[Phosphor](https://phosphoricons.com) (MIT),
[Bootstrap Icons](https://icons.getbootstrap.com) (MIT),
[Material Symbols](https://fonts.google.com/icons) (Apache 2.0), and
[Font Awesome](https://fontawesome.com) (SIL OFL 1.1).

For more information, see the [Third-Party Notices](THIRD-PARTY-NOTICES.md).
