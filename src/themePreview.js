
// Created on 11 September 2026 by imgaty
// Last updated on 18 September 2026 by imgaty
//
// Draws each theme as a miniature editor card for the hover panel. VS Code exposes no API for a
// theme's colours, so this reads them from the theme's own file and returns an inline SVG data URI.

'use strict';

const fs = require('fs');
const path = require('path');

const VIEW = { width: 104, height: 68, radius: 8 };
const CARD = { width: 128, height: 84 };

// Generic fallback colors for themes that don't specify all colors for the preview.
const FALLBACK = {
    light: { background: '#ffffff', foreground: '#333333', sidebar: '#f3f3f3', accent: '#006ab1', keyword: '#0000ff', func: '#795e26', string: '#a31515', variable: '#001080' },
    dark: { background: '#1e1e1e', foreground: '#bbbbbb', sidebar: '#252526', accent: '#3794ff', keyword: '#569cd6', func: '#dcdcaa', string: '#ce9178', variable: '#9cdcfe' }
};

// The selected card's outline, thick enough to read at card size.
const STROKE = 3;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TRANSPARENT = /^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/i;
const usable = value => typeof value === 'string' && HEX.test(value) && !TRANSPARENT.test(value);
const pick = (...values) => values.find(usable);

function parseJsonc(text) {
    let out = '';
    for (let i = 0, inString = false; i < text.length; i++) {
        const char = text[i];
        
        if (inString) {
            out += char;
            if (char === '\\') {
                out += text[++i] ?? '';
            } else if (char === '"') {
                inString = false;
            }

        } else if (char === '"') {
            inString = true;
            out += char;

        } else if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
            out += '\n';

        } else if (char === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i + 2);
            i = i === -1 ? text.length : i + 1;

        } else {
            out += char;
        }
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function loadTheme(file, depth = 0) {
    const theme = parseJsonc(fs.readFileSync(file, 'utf8'));
    let colors = {};
    let tokenColors = [];

    if (typeof theme.include === 'string' && depth < 8) {
        try {
            ({ colors, tokenColors } = loadTheme(path.resolve(path.dirname(file), theme.include), depth + 1));
        } catch {
            // A broken include only means fewer colours.
        }
    }

    return {
        colors: { ...colors, ...theme.colors },
        tokenColors: Array.isArray(theme.tokenColors) ? tokenColors.concat(theme.tokenColors) : tokenColors
    };
}

function tokenColor(tokenColors, wanted) {
    for (let i = tokenColors.length - 1; i >= 0; i--) {
        const rule = tokenColors[i];
        const scopes = Array.isArray(rule?.scope) ? rule.scope : typeof rule?.scope === 'string' ? rule.scope.split(',') : [];
        if (usable(rule?.settings?.foreground) && scopes.some(scope => typeof scope === 'string' && (scope.trim() === wanted || scope.trim().startsWith(`${wanted}.`)))) {
            return rule.settings.foreground;
        }
    }
}

function readPalette(file, mode) {
    const fallback = FALLBACK[mode] ?? FALLBACK.dark;
    let colors = {};
    let tokenColors = [];
    if (file) {
        try {
            ({ colors, tokenColors } = loadTheme(file));
        } catch {
            // Unreadable, or not JSON (some themes ship .tmTheme files).
        }
    }
    return {
        background: pick(colors['editor.background']) ?? fallback.background,
        foreground: pick(colors['editor.foreground'], colors.foreground) ?? fallback.foreground,
        sidebar: pick(colors['sideBar.background'], colors['activityBar.background'], colors['editorGroupHeader.tabsBackground']) ?? fallback.sidebar,
        accent: pick(colors['textLink.foreground'], colors.focusBorder, colors['button.background']) ?? fallback.accent,
        keyword: pick(tokenColor(tokenColors, 'keyword'), tokenColor(tokenColors, 'storage')) ?? fallback.keyword,
        func: pick(tokenColor(tokenColors, 'entity.name.function')) ?? fallback.func,
        string: pick(tokenColor(tokenColors, 'string')) ?? fallback.string,
        variable: pick(tokenColor(tokenColors, 'variable')) ?? fallback.variable
    };
}

// Renders a miniature editor with the current theme's colours
function scene(palette) {
    const line = (x, y, width, fill, opacity = 1) =>
        `<rect x="${x}" y="${y}" width="${width}" height="4" rx="2" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;
    return [
        `<rect width="${VIEW.width}" height="${VIEW.height}" fill="${palette.background}"/>`,
        `<rect width="18" height="${VIEW.height}" fill="${palette.sidebar}"/>`,
        `<rect x="18" width="${VIEW.width - 18}" height="12" fill="${palette.sidebar}"/>`,
        `<rect x="18" width="34" height="12" fill="${palette.background}"/>`,
        `<rect x="18" width="34" height="2" fill="${palette.accent}"/>`,
        `<rect x="5" y="17" width="8" height="8" rx="2" fill="${palette.foreground}" fill-opacity="0.4"/>`,
        `<rect x="5" y="30" width="8" height="8" rx="2" fill="${palette.foreground}" fill-opacity="0.2"/>`,
        `<rect x="5" y="43" width="8" height="8" rx="2" fill="${palette.foreground}" fill-opacity="0.2"/>`,
        line(25, 19, 12, palette.keyword), line(41, 19, 26, palette.func),
        line(31, 28, 18, palette.variable), line(53, 28, 32, palette.string),
        line(31, 37, 40, palette.foreground, 0.5),
        line(25, 46, 10, palette.keyword), line(39, 46, 24, palette.string),
        line(25, 55, 16, palette.foreground, 0.3)
    ].join('');
}

function outline({ width, height, radius, selected, selectionColor }) {
    const inset = selected ? STROKE / 2 : 0.5;
    const rect = `x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius - inset}" fill="none"`;
    return selected
        ? `<rect ${rect} stroke="${selectionColor}" stroke-width="${STROKE}"/>`
        : `<rect ${rect} stroke="#808080" stroke-opacity="0.4"/>`;
}

// Tooltips can't reach a file on disk, so each picture travels inside its own src attribute.
const dataUri = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

function cardImage(palette, { selected = false, selectionColor = FALLBACK.dark.accent, split } = {}) {
    const { width, height, radius } = VIEW;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${width} ${height}">`
        + `<defs><clipPath id="card"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath>`
        + `<clipPath id="half"><polygon points="${width},0 ${width},${height} 0,${height}"/></clipPath></defs>`
        + `<g clip-path="url(#card)">${scene(palette)}${split ? `<g clip-path="url(#half)">${scene(split)}</g>` : ''}</g>`
        + outline({ width, height, radius, selected, selectionColor })
        + '</svg>';
    return dataUri(svg);
}

module.exports = { CARD, readPalette, cardImage };
