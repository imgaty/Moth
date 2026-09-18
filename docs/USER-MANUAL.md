# User Manual

`Created: 12 September 2026` | `Last updated: 18 September 2026`

Information regarding installation, usage, and deletion of the Moth
extension and all its features.

<br>

## Installation

### From a `.vsix`

Download the `.vsix` from the
[releases](https://github.com/imgaty/Moth/releases) and drag it onto the
Extensions tab, choose `Install from VSIX…` from the menu at the top of the
Extensions tab, or run the following command in the terminal:

```sh
code --install-extension moth-0.1.0.vsix
```


### From source

The extension is plain JavaScript, so a clone works as an install. Clone this
repository while Visual Studio Code is open: it notices new folders in its
extensions directory and adds them. Then reload the window. In case Moth still
doesn't appear after the reload, install the `.vsix` instead.

**Windows (PowerShell):**

```powershell
git clone https://github.com/imgaty/Moth.git "$env:USERPROFILE\.vscode\extensions\moth"
```

**macOS and Linux:**

```sh
git clone https://github.com/imgaty/Moth.git ~/.vscode/extensions/moth
```

For Visual Studio Code Insiders, use `.vscode-insiders` instead of `.vscode`.

<br>

## Theme switcher

### Status bar switch

With the button in the status bar, clicking on it toggles between the two
selected themes. Hovering opens a window for manual selection and customization
of the preferred themes.

Due to the various icon packs bundled, it is also possible to change the
displaying icon to better fit the user's own preferences.

### Settings

| Setting | Holds |
| --- | --- |
| `workbench.colorTheme` | Current theme displaying |
| `workbench.preferredLightColorTheme` | Chosen light theme |
| `workbench.preferredDarkColorTheme` | Chosen dark theme |
| `window.autoDetectColorScheme` | Whether VS Code follows system |
| `moth.icons` | The icon pack chosen |

`moth.icons` is Moth's own setting; all the others are native to the IDE.

### Commands

Every action is in the Command Palette under **Moth**.

Moth ships no keybindings of its own. To bind a key, open **Preferences: Open
Keyboard Shortcuts**, search for `moth`, and bind one.

| Command | Operation |
| --- | --- |
| `Moth: Toggle Light / Dark Theme` | Toggles between the selected themes |
| `Moth: Use Light Theme` | Switches to light theme |
| `Moth: Use Dark Theme` | Switches to dark theme |
| `Moth: Follow System Theme` | Follows the operating system theme |
| `Moth: Choose Light and Dark Themes…` | Picks the chosen themes |

### Troubleshooting

1. **The button never appears.** The Moth project loads once Visual Studio
   Code has finished starting, so give it a moment on a cold start. If it
   still doesn't load, check it isn't hidden by right-clicking the status bar
   and looking for Moth in the list. Reinstall the extension as a last resort.

2. **The System card is missing the Linux OS distribution.** The Moth project
   reads the name from `os-release`, therefore, if the OS doesn't have one, it
   falls back to "Linux."

3. **The panel feels slow.** The Moth project follows the default Visual
   Studio Code delay timer, but it's possible to change the value in
   `workbench.hover.delay`;

<br>

## Uninstalling

Uninstall from the Extensions tab as normal. The natural IDE settings Moth
overrides stay written, and the ones specific to Moth stay written in the
`settings.json` but they are unused.
