// One-off build helper: minifies App-scripts/modules/attendance.html's <script> JS via terser
// and compacts the CSS/HTML shell, so the result fits Google Sheets' 50,000-char cell limit.
// Run: node scripts/minify-attendance.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';

const SRC = 'App-scripts/modules/attendance.html';
const OUT = 'App-scripts/modules/attendance.min.html';

const src = readFileSync(SRC, 'utf8');

const scriptMatch = src.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No <script> block found');
const jsCode = scriptMatch[1];

const result = await minify(jsCode, {
  compress: { passes: 2 },
  mangle: true,
  format: { comments: false }
});
if (result.error) throw result.error;

let out = src.slice(0, scriptMatch.index) + '<script>' + result.code + '</script>' + src.slice(scriptMatch.index + scriptMatch[0].length);

// Minify the <style> block: strip comments, collapse whitespace/newlines.
out = out.replace(/<style>([\s\S]*?)<\/style>/, (full, css) => {
  const mini = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/ ?([{}:;,]) ?/g, '$1')
    .trim();
  return '<style>' + mini + '</style>';
});

// Compact the plain HTML shell (link tags + container divs) before the <script>: collapse
// blank lines/indentation. Safe here since none of this markup is inside a template literal.
const scriptStart = out.indexOf('<script>');
let head = out.slice(0, scriptStart);
head = head.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
out = head + '\n' + out.slice(scriptStart);

writeFileSync(OUT, out, 'utf8');
console.log('Input chars: ', src.length);
console.log('Output chars:', out.length);
