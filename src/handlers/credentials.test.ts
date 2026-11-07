import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolvePassword } from './credentials';

describe('resolvePassword', () => {
  it('prefers the explicit argument', () => {
    expect(resolvePassword('arg', { ROUTER_PASSWORD: 'env' })).toBe('arg');
  });

  it('falls back to ROUTER_PASSWORD when the argument is empty', () => {
    expect(resolvePassword('', { ROUTER_PASSWORD: 'env' })).toBe('env');
  });

  it('reads and trims ROUTER_PASSWORD_FILE', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'creds-')), 'secret');
    writeFileSync(file, 'from-file\n');
    expect(resolvePassword(undefined, { ROUTER_PASSWORD_FILE: file })).toBe(
      'from-file'
    );
  });

  it('returns undefined when nothing is set', () => {
    expect(resolvePassword(undefined, {})).toBeUndefined();
  });
});
