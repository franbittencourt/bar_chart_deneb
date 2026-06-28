/**
 * Gera screenshots do gráfico: modo mensal e modo acumulado.
 * Executa: node render_screenshot.mjs
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import * as vega from './node_modules/vega/build/vega.module.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function renderChart(specOverrides, outFile, title, subtitle) {
  const specPath = resolve(__dirname, 'spec', 'vega_test.json');
  const spec = { ...JSON.parse(readFileSync(specPath, 'utf8')), ...specOverrides };

  const view = new vega.View(vega.parse(spec), { renderer: 'none' }).initialize();
  const svg  = await view.toSVG();

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { margin: 0; background: #f4f6f9; font-family: "Segoe UI", sans-serif; }
  .card { margin: 20px; background: #fff; border-radius: 8px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10); padding: 20px 20px 12px; display: inline-block; }
  h2 { font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 0 0 3px 0; text-align: center; }
  p  { font-size: 11px; color: #666; margin: 0 0 12px 0; text-align: center; }
</style></head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>${subtitle}</p>
    ${svg}
  </div>
</body></html>`;

  const tmpFile = join(tmpdir(), `vega_${outFile}.html`);
  writeFileSync(tmpFile, html);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 920, height: 650 });
  await page.goto('file://' + tmpFile, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const card = await page.$('.card');
  const outPath = resolve(__dirname, 'preview', outFile + '.png');
  await card.screenshot({ path: outPath });

  await browser.close();
  unlinkSync(tmpFile);
  console.log('Salvo:', outPath);
}

// Screenshot modo mensal (modoAcumulado = false, padrão)
await renderChart(
  {},
  'screenshot',
  'Colunas Agrupadas Dinâmicas — Visão Mensal',
  'Vega · Deneb · Power BI  |  Cada mês exibe exatamente duas barras, sem espaços para medidas nulas'
);

// Screenshot modo acumulado — injeta o signal via override do spec
// Não é possível injetar clicks via API server-side, então alteramos o valor do signal diretamente
await renderChart(
  {
    signals: JSON.parse(readFileSync(resolve(__dirname, 'spec', 'vega_test.json'), 'utf8'))
      .signals.map(s => s.name === 'modoAcumulado' ? { ...s, value: true } : s)
  },
  'screenshot_acumulado',
  'Colunas Agrupadas Dinâmicas — Visão Acumulada (YTD)',
  'Vega · Deneb · Power BI  |  Planejado acum. vs (Realizado + Projetado) acum.'
);
