
// Created on 11 September 2026 by imgaty
// Last updated on 18 September 2026 by imgaty
//
// Runs the extension against a fake `vscode` module and checks the status bar button, the panel,
// the picker, the icon sets and the system name on Linux.
// See CONTRIBUTING.md -> Before a pull request.

'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const LINUX_NAMES = [
    ['NAME="Arch Linux"\nID=arch\n', 'Arch'],
    ['NAME="Ubuntu"\nVERSION="24.04 LTS"\n', 'Ubuntu'],
    ['NAME="Debian GNU/Linux"\n', 'Debian'],
    ['NAME="Linux Mint"\n', 'Linux Mint'],
    ['NAME=Fedora Linux\n', 'Fedora'],
    ['', 'Linux']
];
const osRelease = process.env.MOTH_TEST_OS_RELEASE;
if (osRelease !== undefined) {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const readFileSync = fs.readFileSync;
    fs.readFileSync = (file, ...rest) => {
        if (String(file).endsWith('os-release')) {
            if (osRelease === '' || file !== '/etc/os-release') {
                throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
            }
            return osRelease;
        }
        return readFileSync(file, ...rest);
    };
}

const settings = {
    'workbench.colorTheme': 'Dark A',
    'workbench.preferredLightColorTheme': 'Light A',
    'workbench.preferredDarkColorTheme': 'Dark A',
    'window.autoDetectColorScheme': false
};
const commands = {};
const configurationListeners = [];
let quickPick;
let statusBarItem;

const noEvent = () => () => ({ dispose() { } });
const vscode = {
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    QuickPickItemKind: { Separator: -1, Default: 0 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ConfigurationTarget: { Global: 1, Workspace: 2 },
    MarkdownString: class { constructor(value) { this.value = value; } },
    l10n: { t: (message, ...args) => message.replace(/\{(\d+)\}/g, (_, i) => String(args[i])) },
    window: {
        activeColorTheme: { kind: 2 },
        createStatusBarItem: (id, alignment, priority) =>
            (statusBarItem = { id, alignment, priority, show() { }, dispose() { } }),
        setStatusBarMessage() { },
        showErrorMessage(message) { throw new Error(message); },
        onDidChangeActiveColorTheme: noEvent(),
        createQuickPick() {
            const listeners = { accept: [], active: [], hide: [] };
            quickPick = {
                listeners,
                items: [],
                activeItems: [],
                value: '',
                hidden: false,
                onDidAccept: fn => listeners.accept.push(fn),
                onDidChangeActive: fn => listeners.active.push(fn),
                onDidHide: fn => listeners.hide.push(fn),
                show() { },
                hide() {
                    this.hidden = true;
                    listeners.hide.forEach(fn => fn());
                },
                dispose() { }
            };
            return quickPick;
        }
    },
    workspace: {
        getConfiguration: section => ({
            get: key => settings[`${section}.${key}`],
            inspect: () => ({}),
            update: async (key, value) => {
                const id = `${section}.${key}`;
                settings[id] = value;
                configurationListeners.forEach(fn => fn({ affectsConfiguration: wanted => wanted === id }));
            }
        }),
        onDidChangeConfiguration: fn => {
            configurationListeners.push(fn);
            return { dispose() { } };
        }
    },
    extensions: {
        all: [{
            id: 'test.themes',
            extensionPath: '/nonexistent',
            packageJSON: {
                displayName: 'Test Themes',
                contributes: {
                    themes: [
                        { id: 'Light A', uiTheme: 'vs', path: 'a.json' },
                        { id: 'Light B', uiTheme: 'vs', path: 'b.json' },
                        { id: 'Dark A', uiTheme: 'vs-dark', path: 'c.json' },
                        { id: 'Dark B', uiTheme: 'vs-dark', path: 'd.json' }
                    ]
                }
            }
        }],
        onDidChange: noEvent()
    },
    commands: {
        registerCommand: (id, fn) => {
            commands[id] = fn;
            return { dispose() { } };
        }
    }
};

const load = Module._load;
Module._load = function (request, ...rest) {
    return request === 'vscode' ? vscode : load.call(this, request, ...rest);
};
require(path.join(ROOT, PKG.main)).activate({ subscriptions: [] });

const caption = () => statusBarItem.tooltip.value.match(/>(Follows [^<]*)</)[1];
if (osRelease !== undefined) {
    console.log(caption());
    return;
}

const setting = name => settings[`workbench.${name}`];
const plain = item => item.label.replace(/^\$\([^)]+\) /, '');
const row = name => quickPick.items.find(item => item.group && plain(item) === name);
const ICON_NAMES = ['Lucide', 'Tabler', 'Phosphor', 'Phosphor Fill', 'Bootstrap Icons', 'Material Symbols', 'Material Symbols Filled', 'Font Awesome'];
const ticked = () => {
    const rows = quickPick.items.filter(item => item.group);
    assert.ok(rows.every(item => /^\$\((check|blank)\) /.test(item.label)), 'every row starts with a tick or a blank');
    return rows.filter(item => item.label.startsWith('$(check) ')).map(plain);
};
const settle = async () => {
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setImmediate(resolve));
    }
};
const announceCursor = () => quickPick.listeners.active.forEach(fn => fn(quickPick.activeItems));
const open = async () => {
    const done = commands['moth.chooseThemes']();
    if (!quickPick.activeItems.length) {
        quickPick.activeItems = [quickPick.items.find(item => item.group)];
    }
    announceCursor();
    await settle();
    return { done };
};
const move = async name => {
    quickPick.activeItems = [row(name)];
    announceCursor();
    await settle();
};
const pick = async (name, search = '') => {
    quickPick.value = search;
    await move(name);
    quickPick.listeners.accept.forEach(fn => fn());
    await settle();
};
const close = async done => {
    quickPick.hide();
    await done;
};

let finished = false;
process.on('exit', code => {
    if (code === 0 && !finished) {
        console.error('extension: stopped before all checks ran');
        process.exitCode = 1;
    }
});

(async () => {
    const html = statusBarItem.tooltip.value;
    assert.equal(statusBarItem.text, '$(moth-lucide-moon)');
    assert.equal(statusBarItem.accessibilityInformation.label, 'Moth: Switch to the light theme');
    assert.match(html, /<strong>Moth<\/strong>/);
    assert.match(html, /command:moth\.chooseThemes">Change…<\/a>/);
    assert.equal(caption(), `Follows ${{ darwin: 'macOS', win32: 'Windows' }[process.platform] ?? caption().slice(8)}`);
    assert.deepEqual(Object.keys(commands).sort(), ['moth.chooseThemes', 'moth.followSystemTheme', 'moth.toggle', 'moth.useDarkTheme', 'moth.useLightTheme']);
    assert.equal(statusBarItem.alignment, vscode.StatusBarAlignment.Right, 'the button sits on the right');
    assert.deepEqual([...statusBarItem.tooltip.isTrusted.enabledCommands].sort(),
        ['moth.chooseThemes', 'moth.followSystemTheme', 'moth.useDarkTheme', 'moth.useLightTheme'],
        'the panel may run only the commands it links');

    let { done } = await open();
    assert.equal(quickPick.title, 'Moth: Select Your Themes');
    assert.ok(!quickPick.canSelectMany, 'no VS Code checkboxes');
    assert.deepEqual(quickPick.items.map(plain), ['Status Bar Icons', ...ICON_NAMES, 'Light', 'Light A', 'Light B', 'Dark', 'Dark A', 'Dark B']);
    assert.deepEqual(ticked(), ['Lucide', 'Light A', 'Dark A']);
    assert.equal(plain(quickPick.activeItems[0]), 'Lucide', 'the cursor starts on the first row');
    assert.equal(setting('colorTheme'), 'Dark A');

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const contributed = pkg.contributes.icons;
    const property = pkg.contributes.configuration.properties['moth.icons'];
    assert.deepEqual(property.enumItemLabels, ICON_NAMES);
    for (const name of ICON_NAMES) {
        assert.equal(row(name).description, 'Icon Pack');
    }
    for (const set of property.enum) {
        for (const id of [`moth-${set}-sun`, `moth-${set}-moon`]) {
            assert.ok(contributed[id], `${id} is registered`);
            assert.ok(fs.existsSync(path.join(ROOT, contributed[id].default.fontPath)), `${id}'s font exists`);
        }
    }
    assert.equal(Object.keys(contributed).length, property.enum.length * 2, 'no unused icons');
    assert.deepEqual(pkg.contributes.commands.map(c => c.command).sort(), Object.keys(commands).sort(), 'every command is contributed and registered');

    await move('Light B');
    assert.equal(setting('colorTheme'), 'Light B', 'previews the theme under the cursor');
    assert.equal(setting('preferredLightColorTheme'), 'Light A');
    await move('Tabler');
    assert.equal(statusBarItem.text, '$(moth-tabler-moon)', 'previews the icons under the cursor');
    assert.equal(setting('colorTheme'), 'Dark A', 'rows without a theme show what is saved');
    await move('Dark B');
    assert.equal(setting('colorTheme'), 'Dark B');
    assert.equal(statusBarItem.text, '$(moth-lucide-moon)', 'the icon preview ends when the cursor leaves the icons');

    await close(done);
    assert.equal(setting('colorTheme'), 'Dark A');
    assert.equal(setting('preferredLightColorTheme'), 'Light A');
    assert.equal(setting('preferredDarkColorTheme'), 'Dark A');
    assert.equal(settings['moth.icons'], undefined);

    ({ done } = await open());
    await pick('Light B');
    assert.equal(setting('preferredLightColorTheme'), 'Light B', 'a picked theme is saved at once');
    assert.equal(setting('colorTheme'), 'Light B', 'and goes on screen');
    assert.deepEqual(ticked(), ['Lucide', 'Light B', 'Dark A']);
    assert.equal(quickPick.hidden, false);
    assert.equal(plain(quickPick.activeItems[0]), 'Light B');
    await pick('Phosphor Fill');
    assert.equal(settings['moth.icons'], 'phosphor-fill', 'a picked icon set is saved at once');
    assert.equal(statusBarItem.text, '$(moth-phosphor-fill-moon)');
    await pick('Dark B', 'dark b');
    assert.equal(setting('preferredDarkColorTheme'), 'Dark B');
    assert.equal(quickPick.value, '', 'a search clears after picking');
    assert.equal(plain(quickPick.activeItems[0]), 'Dark B');
    assert.deepEqual(ticked(), ['Phosphor Fill', 'Light B', 'Dark B']);

    await move('Light A');
    assert.equal(setting('colorTheme'), 'Light A');
    await close(done);
    assert.equal(setting('colorTheme'), 'Dark B');
    assert.equal(setting('preferredLightColorTheme'), 'Light B');
    assert.equal(settings['moth.icons'], 'phosphor-fill');
    assert.equal(statusBarItem.text, '$(moth-phosphor-fill-moon)');

    settings['window.autoDetectColorScheme'] = true;
    ({ done } = await open());
    assert.equal(statusBarItem.text, '$(moth-phosphor-fill-moon)', 'the cursor opening on the Lucide row previews nothing');
    await move('Dark A');
    assert.equal(setting('preferredDarkColorTheme'), 'Dark A', 'previews through the preferred theme');
    await move('Light A');
    assert.equal(setting('preferredDarkColorTheme'), 'Dark B', 'the screen goes back to what is saved');
    await pick('Light A');
    assert.equal(setting('preferredLightColorTheme'), 'Light A');
    assert.equal(setting('colorTheme'), 'Dark B', 'colorTheme is left alone while following the system');
    await move('Dark A');
    await close(done);
    assert.equal(setting('preferredDarkColorTheme'), 'Dark B');
    assert.equal(setting('preferredLightColorTheme'), 'Light A');

    // Clicking a card ticks it at once. VS Code updates activeColorTheme.kind an event later, so
    // reading the theme on screen here would leave the previous card ticked until the panel reopens.
    settings['window.autoDetectColorScheme'] = false;
    const outlined = () => statusBarItem.tooltip.value
        .split('<img src="data:image/svg+xml;base64,').slice(1)
        .map((chunk, i) => [['Light', 'Dark', 'System'][i], Buffer.from(chunk.split('"')[0], 'base64').toString()])
        .filter(([, svg]) => svg.includes('stroke-width="3"'))
        .map(([name]) => name);
    await commands['moth.useLightTheme']();
    assert.deepEqual(outlined(), ['Light'], 'the Light card is ticked without waiting for the theme to change');
    await commands['moth.useDarkTheme']();
    assert.deepEqual(outlined(), ['Dark'], 'the Dark card is ticked without waiting for the theme to change');

    for (const [release, name] of LINUX_NAMES) {
        const result = spawnSync(process.execPath, [__filename], { env: { ...process.env, MOTH_TEST_OS_RELEASE: release }, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), `Follows ${name}`);
    }

    finished = true;
    console.log('extension: all checks passed');
    
})().catch(error => {
    console.error(error);
    process.exit(1);
});
