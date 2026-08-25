import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyDirect,
  applyProfile,
  buildProxyConfig,
  configMatchesProfile,
  deriveProxyStatus
} from '../../extension/core/proxy.js';

const profile = {
  id: 'work',
  name: 'Work',
  scheme: 'http',
  host: '127.0.0.1',
  port: 3328,
  bypassList: ['localhost', '192.168.0.0/16']
};

function settingsMock() {
  let value = {mode: 'direct'};
  return {
    async get() {
      return {
        value: structuredClone(value),
        levelOfControl: 'controlled_by_this_extension'
      };
    },
    async set(input) {
      value = structuredClone(input.value);
    }
  };
}

test('builds a singleProxy fixed-server Chrome configuration', () => {
  assert.deepEqual(buildProxyConfig(profile), {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'http',
        host: '127.0.0.1',
        port: 3328
      },
      bypassList: ['localhost', '192.168.0.0/16']
    }
  });
});

test('matches equivalent proxy configuration independent of bypass order and case', () => {
  const setting = {
    value: {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'HTTP',
          host: '127.0.0.1',
          port: 3328
        },
        bypassList: ['192.168.0.0/16', 'LOCALHOST']
      }
    }
  };
  assert.equal(configMatchesProfile(setting, profile), true);
});

test('applies and verifies profile and Direct settings', async () => {
  const settings = settingsMock();
  const applied = await applyProfile(profile, settings);
  assert.equal(configMatchesProfile(applied, profile), true);

  const direct = await applyDirect(settings);
  assert.equal(direct.value.mode, 'direct');
});

test('derives active and control-conflict states from Chrome settings', () => {
  const active = deriveProxyStatus({
    value: buildProxyConfig(profile),
    levelOfControl: 'controlled_by_this_extension'
  }, [profile]);
  assert.equal(active.activeProfileId, 'work');
  assert.equal(active.canControl, true);

  const blocked = deriveProxyStatus({
    value: {mode: 'direct'},
    levelOfControl: 'controlled_by_other_extensions'
  }, [profile]);
  assert.equal(blocked.canControl, false);
  assert.match(blocked.controlMessage, /Another extension/);
});

test('reports an unmatched fixed proxy', () => {
  const status = deriveProxyStatus({
    value: {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'socks5',
          host: '127.0.0.1',
          port: 9999
        }
      }
    },
    levelOfControl: 'controllable_by_this_extension'
  }, [profile]);

  assert.equal(status.activeProfileId, null);
  assert.equal(status.isUnmatchedFixed, true);
});
