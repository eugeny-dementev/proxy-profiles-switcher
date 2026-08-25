import {mkdtemp, rm} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {chromium} from '@playwright/test';

const extensionPath = path.resolve('extension');
const checkUrl = process.env.PROXY_PROFILE_CHECK_URL ??
  'https://api.ipify.org?format=json';
const candidates = [
  {
    name: 'Local HTTP',
    value: process.env.PROXY_PROFILE_HTTP_URL ?? 'http://127.0.0.1:3328'
  },
  {
    name: 'Local SOCKS5',
    value: process.env.PROXY_PROFILE_SOCKS_URL ?? 'socks5://127.0.0.1:1080'
  }
];

async function isListening(host, port) {
  return new Promise(resolve => {
    const socket = net.connect({host, port});
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

const profiles = [];
for (const [index, candidate] of candidates.entries()) {
  const parsed = new URL(candidate.value);
  const scheme = parsed.protocol.replace(':', '');
  const port = Number(parsed.port);
  if (!['http', 'https', 'socks4', 'socks5'].includes(scheme)) {
    throw new Error('Unsupported smoke-test protocol: ' + scheme);
  }
  if (!await isListening(parsed.hostname, port)) {
    console.log('SKIP ' + candidate.name + ' — endpoint is not listening.');
    continue;
  }
  profiles.push({
    id: 'smoke-' + index,
    name: candidate.name + ' ' + port,
    scheme,
    host: parsed.hostname,
    port,
    bypassList: ['<local>', 'localhost', '127.0.0.1', '192.168.0.0/16']
  });
}

if (profiles.length === 0) {
  throw new Error('No configured localhost proxy endpoint is listening.');
}

const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'proxy-profiles-live-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [
    '--disable-extensions-except=' + extensionPath,
    '--load-extension=' + extensionPath
  ]
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker');
  }
  const extensionId = worker.url().split('/')[2];
  await worker.evaluate(async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const stored = await chrome.storage.local.get('proxyProfilesState');
      if (stored.proxyProfilesState) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Extension storage initialization timed out.');
  });
  await worker.evaluate(async profilesToStore => {
    await chrome.storage.local.set({
      proxyProfilesState: {
        schemaVersion: 1,
        profiles: profilesToStore,
        lastSelectedProfileId: null
      }
    });
  }, profiles);

  for (const profile of profiles) {
    const popup = await context.newPage();
    await popup.goto(
      'chrome-extension://' + extensionId + '/popup/popup.html?stayOpen=1'
    );
    await popup.getByRole('button', {name: new RegExp(profile.name)}).click();
    await popup.locator('#status').filter({hasText: 'is active'}).waitFor();

    const page = await context.newPage();
    try {
      const response = await page.goto(checkUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 25_000
      });
      if (!response?.ok()) {
        throw new Error('IP check returned HTTP ' + response?.status());
      }
      const body = (await page.locator('body').innerText()).trim();
      console.log('PASS ' + profile.name + ' — ' + body);
    }
    finally {
      await page.close();
      await popup.close();
    }
  }
}
finally {
  await context.close();
  const resolved = path.resolve(userDataDir);
  if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
    throw new Error('Refusing to remove non-temporary browser profile: ' + resolved);
  }
  await rm(resolved, {recursive: true, force: true});
}
