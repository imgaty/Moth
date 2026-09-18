
// Created on 11 September 2026 by imgaty
// Last updated on 18 September 2026 by imgaty
//
// The extension itself: the status bar button, the hover panel it opens, and the picker for
// choosing the light theme, the dark theme and the icon style.

'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { CARD, readPalette, cardImage } = require('./themePreview');

const LIGHT = 'light';
const DARK = 'dark';
const SYSTEM = 'system';
const THEME_KEY = { [LIGHT]: 'preferredLightColorTheme', [DARK]: 'preferredDarkColorTheme' };
const PRIORITY = 100.15; // In the status bar, left of the Copilot button
const ICON_SETS = {
    lucide: 'Lucide',
    tabler: 'Tabler',
    phosphor: 'Phosphor',
    'phosphor-fill': 'Phosphor Fill',
    bootstrap: 'Bootstrap Icons',
    material: 'Material Symbols',
    'material-filled': 'Material Symbols Filled',
    fontawesome: 'Font Awesome'
};
const PANEL_COMMANDS = ['moth.useLightTheme', 'moth.useDarkTheme', 'moth.followSystemTheme', 'moth.chooseThemes'];
const WATCHED_SETTINGS = ['moth.icons', 'window.autoDetectColorScheme', 'workbench.colorTheme', 'workbench.preferredLightColorTheme', 'workbench.preferredDarkColorTheme'];
const OS_NAME = osName();

/** @type {vscode.StatusBarItem} */
let statusBarItem;
let previewIcons;
let themeIndex;
const palettes = new Map();

const moth = () => vscode.workspace.getConfiguration('moth');
const workbench = () => vscode.workspace.getConfiguration('workbench');
const icon = (set, mode) => `$(moth-${set}-${mode === LIGHT ? 'sun' : 'moon'})`;
const tick = on => (on ? '$(check)' : '$(blank)');

function currentMode() {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight ? LIGHT : DARK;
}

function themeFor(mode) {
    return workbench().get(THEME_KEY[mode]);
}

function iconSet() {
    const set = moth().get('icons');
    return Object.hasOwn(ICON_SETS, set) ? set : 'lucide';
}

function followsSystem() {
    return vscode.workspace.getConfiguration('window').get('autoDetectColorScheme') === true;
}

function setFollowSystem(on) {
    return vscode.workspace.getConfiguration('window').update('autoDetectColorScheme', on, vscode.ConfigurationTarget.Global);
}

function osName() {
    if (process.platform === 'darwin') {
        return 'macOS';
    }
    if (process.platform === 'win32') {
        return 'Windows';
    }
    for (const file of ['/run/host/os-release', '/etc/os-release', '/usr/lib/os-release']) {
        try {
            const name = fs.readFileSync(file, 'utf8').match(/^NAME=(["']?)(.+)\1\s*$/m)?.[2];
            if (name) {
                // "Arch Linux" reads as Arch and "Debian GNU/Linux" as Debian; "Linux Mint" stays.
                return name.replace(/\s+(GNU\/)?Linux$/i, '');
            }
        } catch {
            // Ignore errors reading the file.
        }
    }
    return 'Linux';
}

function updateWorkbench(key, value) {
    const target = workbench().inspect(key)?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    return workbench().update(key, value, target);
}

// Writes a setting given as "section.key", unless it already has that value
async function writeSetting(id, value) {
    const dot = id.indexOf('.');
    const section = id.slice(0, dot);
    const key = id.slice(dot + 1);
    if (vscode.workspace.getConfiguration(section).get(key) === value) {
        return;
    }
    try {
        await (section === 'workbench'
            ? updateWorkbench(key, value)
            : vscode.workspace.getConfiguration(section).update(key, value, vscode.ConfigurationTarget.Global));
    } catch (error) {
        vscode.window.showErrorMessage(`Moth: ${error.message}`);
    }
}

// Every installed theme by id. Built-in themes count: VS Code ships them as extensions. Scanning
// every extension's manifest is the expensive part of drawing the panel, so the result is kept
// until extensions change.
function allThemes() {
    if (themeIndex) {
        return themeIndex;
    }
    themeIndex = new Map();
    for (const extension of vscode.extensions.all) {
        const contributed = extension.packageJSON?.contributes?.themes;
        if (!Array.isArray(contributed)) {
            continue;
        }
        for (const theme of contributed) {
            // `workbench.colorTheme` refers to a theme by id when it has one, otherwise by label
            const id = theme.id || theme.label;
            if (id && !themeIndex.has(id)) {
                themeIndex.set(id, {
                    source: extension.packageJSON.displayName || extension.id,
                    light: theme.uiTheme === 'vs' || theme.uiTheme === 'hc-light',
                    file: typeof theme.path === 'string' && extension.extensionPath ? path.join(extension.extensionPath, theme.path) : undefined
                });
            }
        }
    }
    return themeIndex;
}

function installedThemes(mode) {
    return [...allThemes()]
        .filter(([, theme]) => theme.light === (mode === LIGHT))
        .map(([id, theme]) => ({ id, source: theme.source }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function paletteFor(id, mode) {
    if (!palettes.has(id)) {
        const theme = allThemes().get(id);
        palettes.set(id, readPalette(theme?.file, theme ? (theme.light ? LIGHT : DARK) : mode));
    }
    return palettes.get(id);
}

async function useMode(mode) {
    await updateWorkbench('colorTheme', themeFor(mode));
    if (followsSystem()) {
        await setFollowSystem(false);
        vscode.window.setStatusBarMessage(`Moth: ${vscode.l10n.t('Stopped following the system theme')}`, 4000);
    }
}

// Builds the picker in the Command Palette
async function chooseThemes() {
    const modes = [LIGHT, DARK];
    const themes = Object.fromEntries(modes.map(mode => [mode, installedThemes(mode)]));
    const following = followsSystem();
    const onScreen = currentMode();
    const saved = { [LIGHT]: themeFor(LIGHT), [DARK]: themeFor(DARK), icons: iconSet(), showing: workbench().get('colorTheme') };
    const pending = new Map();
    let writing;
    const write = (id, value) => {
        pending.set(id, value);
        writing ??= Promise.resolve().then(async () => {
            for (const [next, nextValue] of pending) {
                pending.delete(next);
                await writeSetting(next, nextValue);
            }
            writing = undefined;
        });
    };
    const screenSetting = mode => (!following ? 'workbench.colorTheme' : mode === onScreen ? `workbench.${THEME_KEY[mode]}` : undefined);
    const showSaved = () => write(screenSetting(onScreen), following ? saved[onScreen] : saved.showing);

    await new Promise(resolve => {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = `Moth: ${vscode.l10n.t('Select Your Themes')}`;
        quickPick.placeholder = vscode.l10n.t('Pick your light and dark themes. Type to filter.');
        quickPick.matchOnDescription = true;
        quickPick.keepScrollPosition = true;

        const render = () => {
            quickPick.items = [
                { label: vscode.l10n.t('Status Bar Icons'), kind: vscode.QuickPickItemKind.Separator },
                ...Object.entries(ICON_SETS).map(([value, name]) => ({
                    label: `${tick(value === saved.icons)} ${name}`,
                    description: vscode.l10n.t('Icon Pack'),
                    group: 'icons',
                    value
                })),

                ...modes.flatMap(mode => [
                    { label: mode === LIGHT ? vscode.l10n.t('Light') : vscode.l10n.t('Dark'), kind: vscode.QuickPickItemKind.Separator },
                    ...themes[mode].map(theme => ({
                        label: `${tick(theme.id === saved[mode])} ${theme.id.replace(/\$\(/g, '\\$(')}`,
                        description: theme.source,
                        group: mode,
                        value: theme.id
                    }))
                ])
            ];
        };

        const rowFor = (group, value) => quickPick.items.find(item => item.group === group && item.value === value);
        render();

        const firstRow = quickPick.items.find(item => item.group);
        let moved = false;

        quickPick.onDidChangeActive(([item]) => {
            if (!item || (!moved && item === firstRow)) {
                return;
            }

            moved = true;

            const setting = item.group !== 'icons' && screenSetting(item.group);
            if (setting) {
                write(setting, item.value);

            } else {
                showSaved();
            }

            previewIcons = item.group === 'icons' ? item.value : saved.icons;
            updateIcon();
        });

        quickPick.onDidAccept(() => {
            const [item] = quickPick.activeItems;

            if (!item?.group) {
                return;
            }

            saved[item.group] = item.value;
            if (item.group === 'icons') {
                write('moth.icons', item.value);

            } else {
                write(`workbench.${THEME_KEY[item.group]}`, item.value);
                // A picked theme goes on screen too, unless VS Code follows the system; then the system decides
                if (!following) {
                    saved.showing = item.value;
                    write('workbench.colorTheme', item.value);
                }
            }

            if (quickPick.value) {
                quickPick.value = '';
            }

            render();
            quickPick.activeItems = [rowFor(item.group, item.value)];
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve();
        });
        quickPick.show();
    });

    showSaved();
    previewIcons = undefined;
    await writing;
    updateIcon();
}

// Theme names come from other extensions, so they are escaped before going into the panel's HTML
function escapeHtml(text) {
    return String(text).replace(/[&<>"$]/g, char => `&#${char.charCodeAt(0)};`);
}

const truncate = (text, max = 20) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const link = (command, content) => `<a href="command:${command}">${content}</a>`;
const muted = content => `<span style="color:var(--vscode-descriptionForeground);">${content}</span>`;
const SPACE = {
    edge: 1,
    between: 10,
    top: 4,
    underHeader: 4,
    underCards: 7,
    bottom: 5
};
const spacer = (width = SPACE.between) => `<td width="${width}"></td>`;
const gapRow = height => `<tr><td height="${height}"></td></tr>`;

// Builds the hover panel shown on the status bar button.
function hoverPanel(mode) {
    const following = followsSystem();
    const showing = following ? themeFor(mode) : workbench().get('colorTheme');
    // Which card is ticked comes from the theme that is set, not from the theme on screen:
    // activeColorTheme.kind lags a write to workbench.colorTheme by an event, so reading it here
    // would draw the previous choice. A theme picked outside Moth matches neither, and then the
    // mode on screen is all there is to go on.
    const selected = following ? SYSTEM
        : showing === themeFor(LIGHT) ? LIGHT
        : showing === themeFor(DARK) ? DARK
        : mode;
    const selectionColor = paletteFor(showing, mode).accent;
    const lightPalette = paletteFor(themeFor(LIGHT), LIGHT);
    const darkPalette = paletteFor(themeFor(DARK), DARK);
    const caption = (command, text) => link(command, muted(escapeHtml(truncate(String(text)))));

    const cards = [
        { key: LIGHT, label: vscode.l10n.t('Light'), command: 'moth.useLightTheme', palette: lightPalette, caption: themeFor(LIGHT) },
        { key: DARK, label: vscode.l10n.t('Dark'), command: 'moth.useDarkTheme', palette: darkPalette, caption: themeFor(DARK) },
        { key: SYSTEM, label: vscode.l10n.t('System'), command: 'moth.followSystemTheme', palette: lightPalette, split: darkPalette, caption: vscode.l10n.t('Follows {0}', OS_NAME) }
    ];

    const row = render => `<tr>${spacer(SPACE.edge)}${cards
        .map(card => `<td align="center" width="${CARD.width}">${render(card)}</td>`)
        .join(spacer())}${spacer(SPACE.edge)}</tr>`;
        
    const image = card => link(card.command,
        `<img src="${cardImage(card.palette, { selected: card.key === selected, selectionColor, split: card.split })}" width="${CARD.width}" height="${CARD.height}" align="top" alt="${escapeHtml(card.label)}">`);

    const header = `<table width="100%">${gapRow(SPACE.top)}<tr>${spacer(SPACE.edge)}<td><strong>Moth</strong></td>`
        + `<td align="right">${link('moth.chooseThemes', escapeHtml(vscode.l10n.t('Change…')))}</td>${spacer(SPACE.edge)}</tr></table>`;
    
    const body = `<table>${gapRow(SPACE.underHeader)}${row(image)}${gapRow(SPACE.underCards)}`
        + `${row(card => caption(card.command, card.caption))}${gapRow(SPACE.bottom)}</table>`;

    return header + body;
}

function updateIcon() {
    statusBarItem.text = icon(previewIcons ?? iconSet(), currentMode());
}

function refresh() {
    const mode = currentMode();

    updateIcon();

    const tooltip = new vscode.MarkdownString(hoverPanel(mode), true);
    tooltip.supportHtml = true;
    tooltip.isTrusted = { enabledCommands: PANEL_COMMANDS };
    statusBarItem.tooltip = tooltip;

    const action = mode === LIGHT ? vscode.l10n.t('Switch to the dark theme') : vscode.l10n.t('Switch to the light theme');
    statusBarItem.accessibilityInformation = { label: `Moth: ${action}`, role: 'button' };
}

function createStatusBarItem() {
    statusBarItem?.dispose();
    statusBarItem = vscode.window.createStatusBarItem('moth.toggle', vscode.StatusBarAlignment.Right, PRIORITY);
    statusBarItem.name = 'Moth';
    statusBarItem.command = 'moth.toggle';
}

// VS Code stops tracking an open panel once the pointer moves into it, so replacing the tooltip
// cannot repaint it and a click would leave the old choice ticked. Rebuilding the button takes the
// panel's anchor away with it, closing it; the next hover draws the new state.
async function fromPanel(action) {
    await action();
    createStatusBarItem();
    refresh();
    statusBarItem.show();
}

function activate(context) {
    createStatusBarItem();

    context.subscriptions.push(
        { dispose: () => statusBarItem?.dispose() },
        vscode.commands.registerCommand('moth.toggle', () => useMode(currentMode() === LIGHT ? DARK : LIGHT)),
        vscode.commands.registerCommand('moth.useLightTheme', () => fromPanel(() => useMode(LIGHT))),
        vscode.commands.registerCommand('moth.useDarkTheme', () => fromPanel(() => useMode(DARK))),
        vscode.commands.registerCommand('moth.followSystemTheme', () => fromPanel(() => setFollowSystem(true))),
        vscode.commands.registerCommand('moth.chooseThemes', chooseThemes),
        vscode.window.onDidChangeActiveColorTheme(refresh),
        vscode.extensions.onDidChange(() => {
            themeIndex = undefined;
            palettes.clear();
            refresh();
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (WATCHED_SETTINGS.some(key => event.affectsConfiguration(key))) {
                refresh();
            }
        })
    );

    refresh();
    statusBarItem.show();
}

function deactivate() { }

module.exports = { activate, deactivate };
