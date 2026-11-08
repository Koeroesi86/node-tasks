import { describe, expect, it, jest } from '@jest/globals';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  archiveName,
  backupViaSsh,
  buildRemoteCommand,
  DEFAULT_KEEP,
  notifyFailure,
  parseKeep,
  parseList,
  shellQuote,
  type RemoteStream,
  type RunCommand,
  type VerifyArchive,
} from './ssh_backup';

const tempDir = () => mkdtempSync(join(tmpdir(), 'ssh-backup-'));
const at = (iso: string) => new Date(iso);

const okStream = (code = 0) =>
  jest
    .fn<RemoteStream>()
    .mockImplementation(async (_host, _command, output) => {
      await new Promise((done) => output.end('data', () => done(undefined)));
      return code;
    });
const okVerify = () => jest.fn<VerifyArchive>().mockResolvedValue(undefined);

describe('archiveName', () => {
  it('formats a sortable UTC timestamp', () => {
    expect(archiveName(at('2026-11-08T10:11:12.345Z'))).toBe(
      '20261108T101112Z.tar.gz'
    );
  });
});

describe('parseKeep', () => {
  it.each([
    ['3', 3],
    ['0', DEFAULT_KEEP],
    ['abc', DEFAULT_KEEP],
    ['-2', DEFAULT_KEEP],
    ['', DEFAULT_KEEP],
    [undefined, DEFAULT_KEEP],
  ])('parses %p as %p', (input, expected) => {
    expect(parseKeep(input)).toBe(expected);
  });
});

describe('notifyFailure', () => {
  it.each([[undefined], [''], ['   ']])(
    'does nothing for %p',
    async (command) => {
      const run = jest.fn<RunCommand>();
      await notifyFailure(command, 'myserver', new Error('x'), run);
      expect(run).not.toHaveBeenCalled();
    }
  );

  it('passes details through the environment, not the command', async () => {
    const run = jest.fn<RunCommand>().mockResolvedValue(0);
    await notifyFailure(
      'curl -fsS https://example.test',
      'myserver',
      new Error('boom'),
      run
    );
    expect(run).toHaveBeenCalledWith('curl -fsS https://example.test', {
      SSH_BACKUP_HOST: 'myserver',
      SSH_BACKUP_ERROR: 'boom',
    });
  });

  it('never throws when the command fails or cannot run', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      notifyFailure('x', 'h', 'e', jest.fn<RunCommand>().mockResolvedValue(3))
    ).resolves.toBeUndefined();
    await expect(
      notifyFailure(
        'x',
        'h',
        'e',
        jest.fn<RunCommand>().mockRejectedValue(new Error('nope'))
      )
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe('parseList', () => {
  it('splits, trims and drops empty items', () => {
    expect(parseList(' node_modules, *.log ,,')).toEqual([
      'node_modules',
      '*.log',
    ]);
    expect(parseList(undefined)).toEqual([]);
  });
});

describe('shellQuote', () => {
  it('keeps embedded quotes inside a single argument', () => {
    expect(shellQuote("it's $HOME")).toBe(`'it'\\''s $HOME'`);
  });
});

describe('buildRemoteCommand', () => {
  it('makes paths relative to / and quotes paths and excludes', () => {
    expect(buildRemoteCommand(['/etc/apache2', '/var/www'], ['*.log'])).toBe(
      "tar -C / --numeric-owner --warning=no-file-changed '--exclude=*.log' -cf - 'etc/apache2' 'var/www'"
    );
  });

  it('cannot be broken out of by a hostile path', () => {
    expect(buildRemoteCommand(['/a; rm -rf /'])).toContain("'a; rm -rf /'");
  });
});

describe('backupViaSsh', () => {
  const base = { host: 'myserver', paths: ['/etc'] };

  it('writes a verified, owner-only archive and no partial file', async () => {
    const destination = tempDir();
    const stream = okStream();
    const verify = okVerify();

    const archive = await backupViaSsh({
      ...base,
      destination,
      now: at('2026-11-08T10:00:00Z'),
      stream,
      verify,
    });

    expect(archive).toBe(
      join(destination, 'myserver', '20261108T100000Z.tar.gz')
    );
    expect(statSync(archive).mode & 0o777).toBe(0o600);
    expect(readdirSync(join(destination, 'myserver'))).toEqual([
      '20261108T100000Z.tar.gz',
    ]);
    expect(verify).toHaveBeenCalledWith(`${archive}.partial`);
    expect(stream.mock.calls[0]?.[1]).toContain("-cf - 'etc'");
  });

  it('treats tar exit 1 as a warning', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const archive = await backupViaSsh({
      ...base,
      destination: tempDir(),
      stream: okStream(1),
      verify: okVerify(),
    });
    expect(existsSync(archive)).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('fails and leaves nothing behind when tar exits above 1', async () => {
    const destination = tempDir();
    await expect(
      backupViaSsh({
        ...base,
        destination,
        stream: okStream(2),
        verify: okVerify(),
      })
    ).rejects.toThrow('exit code 2');
    expect(readdirSync(join(destination, 'myserver'))).toEqual([]);
  });

  it('fails and leaves nothing behind when verification fails', async () => {
    const destination = tempDir();
    await expect(
      backupViaSsh({
        ...base,
        destination,
        stream: okStream(),
        verify: jest
          .fn<VerifyArchive>()
          .mockRejectedValue(new Error('corrupt')),
      })
    ).rejects.toThrow('corrupt');
    expect(readdirSync(join(destination, 'myserver'))).toEqual([]);
  });

  it('prunes the oldest archives beyond keep', async () => {
    const destination = tempDir();
    const hostDir = join(destination, 'myserver');
    mkdirSync(hostDir, { recursive: true });
    ['20261101T000000Z', '20261102T000000Z'].forEach((stamp) =>
      writeFileSync(join(hostDir, `${stamp}.tar.gz`), 'x')
    );
    writeFileSync(join(hostDir, 'notes.txt'), 'unrelated');

    await backupViaSsh({
      ...base,
      destination,
      keep: 2,
      now: at('2026-11-08T10:00:00Z'),
      stream: okStream(),
      verify: okVerify(),
    });

    expect(readdirSync(hostDir).sort()).toEqual([
      '20261102T000000Z.tar.gz',
      '20261108T100000Z.tar.gz',
      'notes.txt',
    ]);
  });

  it.each([
    ['option-like host', '-oProxyCommand=x', ['/etc']],
    ['host with a colon', 'a:b', ['/etc']],
    ['host with a slash', '../x', ['/etc']],
    ['relative path', 'myserver', ['etc']],
    ['no paths', 'myserver', []],
  ])('rejects %s', async (_label, host, paths) => {
    const stream = okStream();
    await expect(
      backupViaSsh({ host, paths, destination: tempDir(), stream })
    ).rejects.toThrow();
    expect(stream).not.toHaveBeenCalled();
  });
});
