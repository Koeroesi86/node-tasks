import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, readdir, rename, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

const ARCHIVE_SUFFIX = '.tar.gz';
const ARCHIVE_PATTERN = /^\d{8}T\d{6}Z\.tar\.gz$/;

/** Streams `command` over ssh to `output`; resolves with the remote exit code. */
export type RemoteStream = (
  host: string,
  command: string,
  output: NodeJS.WritableStream
) => Promise<number>;

/** Lists the entries of an archive, throwing when it is corrupt. */
export type VerifyArchive = (file: string) => Promise<void>;

export interface SshBackupOptions {
  /** Host alias defined in the ssh config (~/.ssh/config). */
  host: string;
  /** Absolute remote paths to back up. */
  paths: string[];
  /** tar exclude patterns, for example `node_modules`. */
  excludes?: string[];
  /** Local directory holding one sub-directory per host. */
  destination: string;
  /** Number of archives to keep; everything is kept when undefined. */
  keep?: number;
  now?: Date;
  stream?: RemoteStream;
  verify?: VerifyArchive;
}

const waitForExit = (child: ReturnType<typeof spawn>) =>
  new Promise<number>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolveExit(code ?? 1));
  });

const defaultStream: RemoteStream = async (host, command, output) => {
  const child = spawn('ssh', ['-o', 'BatchMode=yes', '--', host, command], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exit = waitForExit(child);
  const piped = pipeline(child.stdout, createGzip({ level: 6 }), output);
  const [code] = await Promise.all([exit, piped]);
  return code;
};

const defaultVerify: VerifyArchive = async (file) => {
  const child = spawn('tar', ['-tzf', file], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const code = await waitForExit(child);
  if (code !== 0) throw new Error(`Archive verification failed (tar ${code})`);
};

export const DEFAULT_KEEP = 14;

/** Missing or invalid values fall back to the default instead of keeping everything. */
export const parseKeep = (value: string | undefined): number =>
  /^[1-9]\d*$/.test(value ?? '') ? Number(value) : DEFAULT_KEEP;

export const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const archiveName = (date: Date) =>
  date.toISOString().replace(/[-:]|\.\d+/g, '') + ARCHIVE_SUFFIX;

/** Quotes a value so the remote shell receives it as one argument. */
export const shellQuote = (value: string) =>
  `'${value.replace(/'/g, `'\\''`)}'`;

/** Builds the remote tar command; paths are made relative to `/`. */
export const buildRemoteCommand = (paths: string[], excludes: string[] = []) =>
  [
    'tar',
    '-C',
    '/',
    '--numeric-owner',
    '--warning=no-file-changed',
    ...excludes.map((pattern) => shellQuote(`--exclude=${pattern}`)),
    '-cf',
    '-',
    ...paths.map((path) => shellQuote(path.replace(/^\/+/, ''))),
  ].join(' ');

const validate = ({
  host,
  paths,
}: Pick<SshBackupOptions, 'host' | 'paths'>) => {
  if (!host || host.startsWith('-') || /[\s:/]/.test(host)) {
    throw new Error(`Invalid ssh host alias: "${host}"`);
  }
  if (!paths.length || paths.some((path) => !path.startsWith('/'))) {
    throw new Error('Remote paths must be absolute');
  }
};

const pruneArchives = async (hostDir: string, keep: number) =>
  Promise.all(
    (await readdir(hostDir))
      .filter((name) => ARCHIVE_PATTERN.test(name))
      .sort()
      .slice(0, -keep)
      .map((name) => rm(join(hostDir, name), { force: true }))
  );

/**
 * Backs up remote paths from a host known to ssh (by its ssh config alias).
 * Only `tar` is needed on the server: the archive is streamed over ssh,
 * compressed locally, verified, and only then moved into place, so a failed
 * run never leaves a partial archive behind. Ownership is kept numerically.
 */
export async function backupViaSsh({
  host,
  paths,
  excludes = [],
  destination,
  keep,
  now = new Date(),
  stream = defaultStream,
  verify = defaultVerify,
}: SshBackupOptions): Promise<string> {
  validate({ host, paths });

  const hostDir = resolve(destination, host);
  const archive = join(hostDir, archiveName(now));
  const partial = `${archive}.partial`;

  await mkdir(hostDir, { recursive: true, mode: 0o700 });

  try {
    const code = await stream(
      host,
      buildRemoteCommand(paths, excludes),
      createWriteStream(partial, { mode: 0o600 })
    );
    // tar exits 1 when a file changed while it was read: a warning, not a failure.
    if (code > 1) throw new Error(`Remote tar failed with exit code ${code}`);
    if (code === 1)
      console.warn('warning: tar reported changed files (exit 1)');

    await verify(partial);
    await rename(partial, archive);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }

  if (keep) await pruneArchives(hostDir, keep);

  return archive;
}

export type RunCommand = (
  command: string,
  env: Record<string, string>
) => Promise<number>;

const defaultRunCommand: RunCommand = (command, env) =>
  waitForExit(
    spawn('sh', ['-c', command], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
      timeout: 60_000,
    })
  );

/**
 * Runs the optional failure command (for example a curl to a healthcheck or
 * chat webhook). Nothing happens when it is missing or blank. Details reach it
 * through SSH_BACKUP_HOST and SSH_BACKUP_ERROR, never by string interpolation.
 * A failing hook is logged and never replaces the original error.
 */
export async function notifyFailure(
  command: string | undefined,
  host: string,
  error: unknown,
  run: RunCommand = defaultRunCommand
): Promise<void> {
  if (!command?.trim()) return;

  await run(command, {
    SSH_BACKUP_HOST: host,
    SSH_BACKUP_ERROR: error instanceof Error ? error.message : String(error),
  })
    .then((code) => {
      if (code !== 0) console.error(`Failure command exited with ${code}`);
    })
    .catch((hookError: unknown) =>
      console.error('Failure command could not run:', hookError)
    );
}
