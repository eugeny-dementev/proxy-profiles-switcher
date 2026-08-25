import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const iconsDirectory = path.join(projectDirectory, 'extension', 'icons');
const sourceUrl = pathToFileURL(path.join(iconsDirectory, 'icon.svg')).href;
const sizes = [16, 32, 48, 128];

await mkdir(iconsDirectory, {recursive: true});
const browser = await chromium.launch({headless: true});

try {
  const page = await browser.newPage();
  await page.goto(sourceUrl);
  await page.locator('svg').waitFor({state: 'visible'});
  for (const size of sizes) {
    await page.setViewportSize({width: size, height: size});
    await page.locator('svg').evaluate((svg, iconSize) => {
      svg.setAttribute('width', String(iconSize));
      svg.setAttribute('height', String(iconSize));
      svg.style.display = 'block';
    }, size);
    await page.screenshot({
      path: path.join(iconsDirectory, 'icon-' + size + '.png'),
      omitBackground: true,
      clip: {x: 0, y: 0, width: size, height: size}
    });
  }
}
finally {
  await browser.close();
}

console.log('Generated extension icons: ' + sizes.join(', '));
