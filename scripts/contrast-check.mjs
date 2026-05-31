import fs from 'node:fs';
import path from 'node:path';

const themePath = path.resolve(process.cwd(), 'resources', 'css', 'theme.css');
const css = fs.readFileSync(themePath, 'utf8');

const extractBlock = (selector) => {
    const pattern = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const match = css.match(pattern);
    return match ? match[1] : '';
};

const parseVars = (block) => {
    const vars = {};
    const re = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = re.exec(block))) {
        vars[`--${m[1]}`] = m[2].trim();
    }
    return vars;
};

const rootVars = parseVars(extractBlock(':root'));
const darkVars = parseVars(extractBlock("\\[data-theme='dark'\\]"));

const resolveValue = (value, vars, stack = []) => {
    const varMatch = value.match(/^var\((--[a-zA-Z0-9-_]+)\)$/);
    if (!varMatch) return value;
    const name = varMatch[1];
    if (stack.includes(name)) throw new Error(`Cyclic var() reference: ${[...stack, name].join(' -> ')}`);
    const next = vars[name];
    if (!next) throw new Error(`Unresolved variable: ${name}`);
    return resolveValue(next, vars, [...stack, name]);
};

const hexToRgb = (hex) => {
    const v = hex.replace('#', '').trim();
    if (v.length !== 6) throw new Error(`Expected 6-digit hex, got: ${hex}`);
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return { r, g, b };
};

const srgbToLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = ({ r, g, b }) => {
    const R = srgbToLinear(r);
    const G = srgbToLinear(g);
    const B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastRatio = (fgHex, bgHex) => {
    const L1 = luminance(hexToRgb(fgHex));
    const L2 = luminance(hexToRgb(bgHex));
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
};

const buildVars = (mode) => {
    const merged = { ...rootVars, ...(mode === 'dark' ? darkVars : {}) };
    const resolved = {};
    for (const [name, value] of Object.entries(merged)) {
        const v = resolveValue(value, merged);
        if (v.startsWith('#')) resolved[name] = v;
    }
    return resolved;
};

const checks = [
    { name: 'Text on background', fg: '--color-text', bg: '--color-bg', min: 4.5 },
    { name: 'Text on surface', fg: '--color-text', bg: '--color-surface', min: 4.5 },
    { name: 'Text on surface-2', fg: '--color-text', bg: '--color-surface-2', min: 4.5 },
    { name: 'Muted text on background', fg: '--color-text-muted', bg: '--color-bg', min: 4.5 },
    { name: 'Action text on action bg', fg: '--color-action-fg', bg: '--color-action-bg', min: 4.5 },
    { name: 'Action text on hover bg', fg: '--color-action-hover-fg', bg: '--color-action-hover-bg', min: 4.5 },
    { name: 'On-ink text on ink', fg: '--color-on-ink', bg: '--color-ink', min: 4.5 },
];

const runMode = (mode) => {
    const vars = buildVars(mode);
    const failures = [];

    for (const check of checks) {
        const fg = vars[check.fg];
        const bg = vars[check.bg];
        if (!fg || !bg) {
            failures.push(`${check.name}: missing ${!fg ? check.fg : ''}${!fg && !bg ? ' and ' : ''}${!bg ? check.bg : ''}`);
            continue;
        }

        const ratio = contrastRatio(fg, bg);
        const ok = ratio >= check.min;
        const line = `${mode.padEnd(5)} | ${check.name.padEnd(26)} | ${fg} on ${bg} = ${ratio.toFixed(2)} (min ${check.min})`;
        if (!ok) failures.push(line);
        else console.log(line);
    }

    return failures;
};

const lightFailures = runMode('light');
const darkFailures = runMode('dark');
const failures = [...lightFailures, ...darkFailures];

if (failures.length) {
    console.error('\nContrast check failed:\n');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
}

console.log('\nContrast check passed.');
