// bun test scripts/sync-eggs.test.mjs  (all tests: bun test)
// The parts of sync-eggs that need no network: reading an egg file, its rules and images,
// and which game a folder belongs to.
import { describe, expect, test } from 'bun:test';
import { gameByPath, imageNote, readEgg, ruleList, slugify } from './sync-eggs.mjs';

describe('readEgg', () => {
  const egg = {
    meta: { version: 'PLCN_v3' },
    uuid: 'a1b2',
    author: 'egg@example.com',
    description: 'A server.\r\n',
    features: ['eula', 'java_version', 'not_a_known_feature'],
    docker_images: { 'Java 21': 'ghcr.io/pelican-eggs/yolks:java_21', 'Java 17': 'ghcr.io/pelican-eggs/yolks:java_17' },
    startup: 'java -jar {{SERVER_JARFILE}}',
    config: { stop: 'stop' },
    scripts: { installation: { container: 'alpine', entrypoint: 'ash', script: '#!/bin/ash\r\necho hi\r\n' } },
    variables: [
      { name: 'Jar', env_variable: 'SERVER_JARFILE', default_value: 'server.jar', user_viewable: true, user_editable: true, rules: 'required|string', sort: 2 },
      { name: 'Build', env_variable: 'BUILD', default_value: 'latest', user_viewable: true, user_editable: false, rules: 'required', sort: 1 },
    ],
  };

  test('reads a JSON egg: images, features, variables and the detail view', () => {
    const read = readEgg(JSON.stringify(egg));

    expect(read.uuid).toBe('a1b2');
    expect(read.images).toEqual(['ghcr.io/pelican-eggs/yolks:java_21', 'ghcr.io/pelican-eggs/yolks:java_17']);
    // Only the features the /eggs filters know, sorted.
    expect(read.features).toEqual(['eula', 'java_version']);
    expect(read.vars).toEqual(['SERVER_JARFILE', 'BUILD']);
    expect(read.detail.description).toBe('A server.');
    expect(read.detail.install.script).toBe('#!/bin/ash\necho hi');
    // Variables in the egg's sort order.
    expect(read.detail.variables.map((v) => v.env)).toEqual(['BUILD', 'SERVER_JARFILE']);
    expect(read.detail.startup).toEqual([{ label: 'Default', command: 'java -jar {{SERVER_JARFILE}}' }]);
  });

  test('reads the same egg written as YAML', () => {
    const yaml = [
      'uuid: a1b2',
      'docker_images:',
      '  Java 21: ghcr.io/pelican-eggs/yolks:java_21',
      'startup: java -jar server.jar',
      'variables: []',
    ].join('\n');

    expect(readEgg(yaml)).toMatchObject({ uuid: 'a1b2', images: ['ghcr.io/pelican-eggs/yolks:java_21'] });
  });

  test('throws on something that isn\'t an egg', () => {
    expect(() => readEgg('42')).toThrow('not an egg');
  });
});

describe('ruleList', () => {
  test('splits a rule string, keeping a regex that contains "|" whole', () => {
    expect(ruleList('required|string|max:20')).toEqual(['required', 'string', 'max:20']);
    expect(ruleList('required|regex:/^(a|b)$/')).toEqual(['required', 'regex:/^(a|b)$/']);
  });

  test('takes a list as it is, and nothing for empty values', () => {
    expect(ruleList(['required', '', ' string '])).toEqual(['required', 'string']);
    expect(ruleList('')).toEqual([]);
    expect(ruleList(undefined)).toEqual([]);
  });
});

test('imageNote: a version range for one runtime, a count otherwise, nothing for one image', () => {
  expect(imageNote(['ghcr.io/y:java_8', 'ghcr.io/y:java_25', 'ghcr.io/y:java_17'])).toBe('Java 8–25');
  expect(imageNote(['ghcr.io/y:java_17', 'ghcr.io/y:nodejs_20'])).toBe('2 images');
  expect(imageNote(['ghcr.io/y:java_17'])).toBe(null);
});

test('gameByPath: the most specific folder rule wins, and unknown folders have none', () => {
  expect(gameByPath('games-standalone/gta/fivem/egg-fivem.json')).toBe('Grand Theft Auto V');
  expect(gameByPath('games-standalone/gta/samp/egg-samp.json')).toBe('Grand Theft Auto: San Andreas');
  expect(gameByPath('games-steamcmd/valheim/egg.json')).toBe(null);
});

test('slugify', () => {
  expect(slugify('Counter-Strike & Friends: 2')).toBe('counter-strike-and-friends-2');
});
