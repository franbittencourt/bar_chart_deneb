/**
 * Gera o screenshot do gráfico usando Vega API (Node.js) + Playwright.
 * Executa: node render_screenshot.js
 */

import { createRequire } from 'module';
import { createWriteStream, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const require   = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Carrega Vega via UMD (CommonJS-compatível)
const vega = require('./node_modules/vega/build/vega.js');

const specPath = resolve(__dirname, 'spec', 'vega_test.json');
const outPath  = resolve(__dirname, 'preview', 'screenshot.png');

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

// Renderiza em SVG usando a API server-side do Vega
const view = new vega.View(vega.parse(spec), { renderer: 'none' }).initialize();
const svg  = await view.toSVG();

// Envolve em HTML para screenshot com Playwright
const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { margin: 0; background: #f4f6f9; font-family: "Segoe UI", sans-serif; }
  .card { margin: 24px; background: #fff; border-radius: 8px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10); padding: 24px 24px 16px; display: inline-block; }
  h2 { font-size: 16px; font-weight: 600; color: #1a1a2e; margin: 0 0 4px 0; text-align: center; }
  p  { font-size: 12px; color: #666; margin: 0 0 16px 0; text-align: center; }
</style></head>
<body>
  <div class="card">
    <h2>Colunas Agrupadas Dinâmicas — Planejado / Realizado / Projetado</h2>
    <p>Vega · Deneb · Power BI &nbsp;|&nbsp; Cada mês exibe exatamente duas barras, sem espaços para medidas nulas</p>
    ${svg}
  </div>
</body></html>`;

const tmpFile = join(tmpdir(), 'vega_chart.html');
writeFileSync(tmpFile, html);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 880, height: 620 });
await page.goto('file://' + tmpFile, { waitUntil: 'load' });
await page.waitForTimeout(300);

const card = await page.$('.card');
await card.screenshot({ path: outPath });

await browser.close();
unlinkSync(tmpFile);

console.log('Screenshot salvo em:', outPath);
