import {rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {RUNTIME_STATUS_KEY} from '../../extension/core/constants.js';
import {
  addProfile,
  expect,
  launchExtensionContext,
  openOptions,
  openPopup,
  test
} from './extension-fixture.js';
import {createProxyFixtures} from './proxy-fixtures.js';

test('install and reload do not claim or change Chrome proxy settings', async ({
  extensionSession
}) => {
  const {context, extensionId} = extensionSession;
  const popup = await openPopup(context, extensionId);
  const setting = await popup.evaluate(() =>
    chrome.proxy.settings.get({incognito: false})
  );

  expect(setting.levelOfControl).toBe('controllable_by_this_extension');
  expect(setting.value.mode).not.toBe('fixed_servers');

  await popup.reload();
  const reloaded = await popup.evaluate(() =>
    chrome.proxy.settings.get({incognito: false})
  );
  expect(reloaded.levelOfControl).toBe('controllable_by_this_extension');
});

test('profile CRUD, activation, service-worker restart, and active deletion', async ({
  extensionSession
}) => {
  const {context, extensionId} = extensionSession;
  const options = await openOptions(context, extensionId);
  await addProfile(options, {
    name: 'Work',
    scheme: 'http',
    host: '127.0.0.1',
    port: 3328,
    bypassList: ['localhost']
  });

  const popup = await openPopup(context, extensionId);
  await popup.getByRole('button', {name: /Work/}).click();
  await expect(popup.locator('#status')).toContainText('Work is active');

  await popup.evaluate(({key, timestamp}) => chrome.storage.session.set({
    [key]: {
      kind: 'proxy-error',
      message: 'net::ERR_TUNNEL_CONNECTION_FAILED',
      timestamp
    }
  }), {key: RUNTIME_STATUS_KEY, timestamp: Date.now()});
  await popup.reload();
  await expect(popup.locator('#status')).toContainText('Work is active');
  await expect.poll(() => popup.evaluate(() =>
    chrome.action.getBadgeText({})
  )).toBe('ON');
  await expect.poll(() => popup.evaluate(
    key => chrome.storage.session.get(key).then(values => values[key]),
    RUNTIME_STATUS_KEY
  )).toBeUndefined();

  await popup.evaluate(({key, timestamp}) => chrome.storage.session.set({
    [key]: {
      kind: 'application-error',
      message: 'Chrome rejected the setting.',
      timestamp
    }
  }), {key: RUNTIME_STATUS_KEY, timestamp: Date.now()});
  await popup.reload();
  await expect(popup.locator('#status')).toContainText(
    'Chrome rejected the setting.'
  );
  await expect.poll(() => popup.evaluate(() =>
    chrome.action.getBadgeText({})
  )).toBe('!');
  await popup.evaluate(key => chrome.storage.session.remove(key), RUNTIME_STATUS_KEY);
  await popup.reload();

  const setting = await popup.evaluate(() =>
    chrome.proxy.settings.get({incognito: false})
  );
  expect(setting.value.rules.singleProxy).toEqual({
    host: '127.0.0.1',
    port: 3328,
    scheme: 'http'
  });

  const cdp = await context.newCDPSession(popup);
  const targets = await cdp.send('Target.getTargets');
  const workerTarget = targets.targetInfos.find(target =>
    target.type === 'service_worker' &&
    target.url.startsWith('chrome-extension://' + extensionId)
  );
  expect(workerTarget).toBeTruthy();
  await cdp.send('Target.closeTarget', {targetId: workerTarget.targetId});
  const response = await popup.evaluate(() =>
    chrome.runtime.sendMessage({type: 'refresh-action'})
  );
  expect(response.ok).toBe(true);

  await options.reload();
  await expect(options.locator('.row-name')).toContainText('Work');
  options.on('dialog', dialog => dialog.accept());
  await options.locator('.select-profile').filter({hasText: 'Work'}).click();
  await options.locator('#delete-profile').click();
  await expect(options.locator('#page-status')).toContainText('Direct mode is active');

  const direct = await options.evaluate(() =>
    chrome.proxy.settings.get({incognito: false})
  );
  expect(direct.value.mode).toBe('direct');
});

test('imports a compatible legacy backup after preview', async ({
  extensionSession
}) => {
  const {context, extensionId} = extensionSession;
  const options = await openOptions(context, extensionId);
  const legacy = {
    profiles: ['Imported'],
    'profile.Imported': {
      value: {
        rules: {
          proxyForHttp: {
            scheme: 'socks5',
            host: '127.0.0.1',
            port: 1080
          },
          proxyForHttps: {
            scheme: 'socks5',
            host: '127.0.0.1',
            port: 1080
          },
          bypassList: ['localhost']
        }
      }
    }
  };

  await options.locator('#import-file').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy))
  });
  await expect(options.locator('#import-dialog')).toBeVisible();
  await expect(options.locator('#import-details')).toContainText('legacy-proxy-switcher');
  await options.locator('#confirm-import').click();
  await expect(options.locator('.row-name')).toContainText('Imported');
});

test('routes HTTP and SOCKS5 traffic and honors bypass entries', async ({
  extensionSession
}) => {
  const fixtures = await createProxyFixtures();
  const {context, extensionId} = extensionSession;
  try {
    const options = await openOptions(context, extensionId);
    await addProfile(options, {
      name: 'HTTP fixture',
      scheme: 'http',
      host: '127.0.0.1',
      port: fixtures.httpProxyPort,
      bypassList: []
    });
    await addProfile(options, {
      name: 'SOCKS fixture',
      scheme: 'socks5',
      host: '127.0.0.1',
      port: fixtures.socksProxyPort,
      bypassList: []
    });
    await addProfile(options, {
      name: 'Bypass fixture',
      scheme: 'http',
      host: '127.0.0.1',
      port: fixtures.httpProxyPort,
      bypassList: ['target.test']
    });

    const popup = await openPopup(context, extensionId);
    const targetUrl = 'http://target.test:' + fixtures.targetPort + '/';
    const traffic = await context.newPage();

    await popup.getByRole('button', {name: /HTTP fixture/}).click();
    await traffic.goto(targetUrl);
    await expect(traffic.locator('body')).toHaveText('HTTP_PROXY_OK');
    expect(fixtures.metrics.httpProxyHits).toBeGreaterThan(0);

    await popup.reload();
    await popup.getByRole('button', {name: /SOCKS fixture/}).click();
    await traffic.goto(targetUrl);
    await expect(traffic.locator('body')).toHaveText('DIRECT_TARGET_OK');
    expect(fixtures.metrics.socksConnections).toBeGreaterThan(0);

    const proxyHitsBeforeBypass = fixtures.metrics.httpProxyHits;
    await popup.reload();
    await popup.getByRole('button', {name: /Bypass fixture/}).click();
    await traffic.goto(targetUrl);
    await expect(traffic.locator('body')).toHaveText('DIRECT_TARGET_OK');
    expect(fixtures.metrics.httpProxyHits).toBe(proxyHitsBeforeBypass);
  }
  finally {
    await fixtures.close();
  }
});

test('profiles persist across an isolated Chromium restart', async () => {
  const userDataDir = await import('node:fs/promises').then(({mkdtemp}) =>
    mkdtemp(path.join(os.tmpdir(), 'proxy-profiles-restart-'))
  );
  let first;
  let second;
  try {
    first = await launchExtensionContext(userDataDir);
    const options = await openOptions(first.context, first.extensionId);
    await addProfile(options, {
      name: 'Persistent',
      scheme: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      bypassList: ['localhost']
    });
    await first.context.close();
    first = null;

    second = await launchExtensionContext(userDataDir);
    const popup = await openPopup(second.context, second.extensionId);
    await expect(popup.getByRole('button', {name: /Persistent/})).toBeVisible();
  }
  finally {
    await first?.context.close();
    await second?.context.close();
    const resolved = path.resolve(userDataDir);
    if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
      throw new Error('Refusing to remove non-temporary browser profile: ' + resolved);
    }
    await rm(resolved, {recursive: true, force: true});
  }
});
