// Renders the HTML sources in images/ to PNG files in public/ with a headless Chromium browser
// (Edge by default; set the BROWSER environment variable to another Chromium-based browser).
// Run after changing a source: npm run images. The PNGs are committed; CI does not run this.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const browser = process.env.BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root = fileURLToPath(new URL('..', import.meta.url));

const images = [
  { source: 'images/og.html', output: 'public/og.png', width: 1200, height: 630 },
  { source: 'images/apple-touch-icon.html', output: 'public/apple-touch-icon.png', width: 180, height: 180 },
];

// A PNG stores its width and height as 4-byte big-endian numbers at bytes 16 and 20 (the IHDR chunk).
function pngSize(file) {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

let failed = false;

for (const image of images) {
  const source = path.join(root, image.source);
  const output = path.join(root, image.output);
  // A throwaway browser profile, so the headless run never attaches to a browser window you have open.
  const profile = mkdtempSync(path.join(tmpdir(), 'render-images-'));

  const result = spawnSync(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      `--window-size=${image.width},${image.height}`,
      `--screenshot=${output}`,
      pathToFileURL(source).href,
    ],
    // Headless Edge logs harmless internal errors on every run; keep its output for when it fails.
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  );
  rmSync(profile, { recursive: true, force: true });

  if (result.error || result.status !== 0) {
    console.error(`${image.output}: the browser failed (${result.error?.message ?? `exit code ${result.status}`})`);
    console.error(result.stderr);
    failed = true;
    continue;
  }

  const size = pngSize(output);
  if (size.width !== image.width || size.height !== image.height) {
    console.error(`${image.output}: expected ${image.width}x${image.height}, got ${size.width}x${size.height}`);
    failed = true;
    continue;
  }
  console.log(`${image.output}: ${size.width}x${size.height}`);
}

process.exitCode = failed ? 1 : 0;
