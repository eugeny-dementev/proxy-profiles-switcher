import {test as base, chromium} from '@playwright/test';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
export const extensionPath = path.resolve(testDirectory, '..', '..', 'extension');

export async function launchExtensionContext(userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      '--disable-extensions-except=' + extensionPath,
      '--load-extension=' + extensionPath,
      '--host-resolver-rules=MAP target.test 127.0.0.1'
    ]
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  const extensionId = serviceWorker.url().split('/')[2];
  return {context, extensionId, serviceWorker};
}

export const test = base.extend({
  extensionSession: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'proxy-profiles-e2e-'));
    const session = await launchExtensionContext(userDataDir);
    try {
      await use({...session, userDataDir});
    }
    finally {
      await session.context.close();
      const resolved = path.resolve(userDataDir);
      if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
        throw new Error('Refusing to remove non-temporary browser profile: ' + resolved);
      }
      await rm(resolved, {recursive: true, force: true});
    }
  }
});

export {expect} from '@playwright/test';

export async function openOptions(context, extensionId) {
  const page = await context.newPage();
  await page.goto('chrome-extension://' + extensionId + '/options/options.html');
  await page.locator('#profile-name').waitFor({state: 'visible'});
  return page;
}

export async function openPopup(context, extensionId) {
  const page = await context.newPage();
  await page.goto(
    'chrome-extension://' + extensionId + '/popup/popup.html?stayOpen=1'
  );
  await page.locator('#profile-list').waitFor({state: 'visible'});
  return page;
}

export async function addProfile(page, profile) {
  await page.locator('#add-profile').click();
  await page.locator('#profile-name').fill(profile.name);
  await page.locator('#profile-scheme').selectOption(profile.scheme);
  await page.locator('#profile-host').fill(profile.host);
  await page.locator('#profile-port').fill(String(profile.port));
  await page.locator('#profile-bypass').fill(
    (profile.bypassList ?? []).join('\n')
  );
  await page.locator('#save-profile').click();
  await page.locator('#page-status').filter({hasText: 'saved'}).waitFor();
}
