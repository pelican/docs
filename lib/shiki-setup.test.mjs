import { describe, expect, test } from 'bun:test';
import { hasSetupFlag, hasWrapFlag } from './shiki-setup.ts';

describe('code block flags', () => {
  test('wrap is a word of its own in the meta', () => {
    expect(hasWrapFlag('title="Prompt: install" wrap')).toBe(true);
    expect(hasWrapFlag('wrap')).toBe(true);
    expect(hasWrapFlag('title="wrapper.sh"')).toBe(false);
    expect(hasWrapFlag('nowrap')).toBe(false);
    expect(hasWrapFlag(undefined)).toBe(false);
  });

  test('setup and wrap are read independently', () => {
    expect(hasSetupFlag('setup wrap')).toBe(true);
    expect(hasWrapFlag('setup wrap')).toBe(true);
    expect(hasSetupFlag('wrap')).toBe(false);
  });
});
