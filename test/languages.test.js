
// Created on 11 September 2026 by imgaty
// Last updated on 18 September 2026 by imgaty
//
// Checks the translations: one bundle.l10n.<language>.json per language in the l10n folder
// package.json points at, each with every string the extension shows, no unused keys,
// placeholders intact, and no language files in the root.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(pkg.l10n, 'package.json needs an l10n folder');
assert.ok(!/"%[^"]+%"/.test(JSON.stringify(pkg)), 'package.json %keys% would need language files in the root');
assert.deepEqual(fs.readdirSync(root).filter(name => /^package\.nls.*\.json$|l10n.*\.json$/.test(name)), [], 'language files in the root');

const source = path.join(root, path.dirname(pkg.main));
const sources = fs.readdirSync(source)
    .filter(name => name.endsWith('.js'))
    .map(name => [name, fs.readFileSync(path.join(source, name), 'utf8')]);

const found = new Set();
const unreadable = [];
for (const [name, code] of sources) {
    const quoted = [...code.matchAll(/vscode\.l10n\.t\('((?:[^'\\]|\\.)*)'/g)];
    quoted.forEach(match => found.add(match[1]));
    const calls = (code.match(/\bl10n\.t\(/g) || []).length;
    if (calls !== quoted.length) {
        unreadable.push(`${name}: ${calls - quoted.length} l10n.t call(s) not in vscode.l10n.t('...') form`);
    }
}
assert.deepEqual(unreadable, [], `\n${unreadable.join('\n')}`);
const strings = [...found];
assert.ok(strings.length > 0, 'no vscode.l10n.t calls found');
const placeholders = text => (text.match(/\{\d+\}/g) || []).sort().join();

const problems = [];
const files = fs.readdirSync(path.join(root, pkg.l10n));
for (const name of files) {
    if (!/^bundle\.l10n\.[a-z]{2,3}(-[a-z]{2,4})?\.json$/.test(name)) {
        problems.push(`${pkg.l10n}/${name}: not named bundle.l10n.<language>.json`);
        continue;
    }
    const bundle = JSON.parse(fs.readFileSync(path.join(root, pkg.l10n, name), 'utf8'));
    const missing = strings.filter(key => !Object.hasOwn(bundle, key));
    const unused = Object.keys(bundle).filter(key => !strings.includes(key));
    if (missing.length || unused.length) {
        problems.push(`${name}: missing ${JSON.stringify(missing)}, unused ${JSON.stringify(unused)}`);
    }
    for (const [key, value] of Object.entries(bundle)) {
        if (typeof value !== 'string' || !value.trim()) {
            problems.push(`${name}: "${key}" is empty`);
        } else if (placeholders(key) !== placeholders(value)) {
            problems.push(`${name}: "${key}" loses a placeholder`);
        }
    }
}
assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
console.log(`languages: ${files.length} translations with all ${strings.length} strings`);
