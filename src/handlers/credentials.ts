import { readFileSync } from 'fs';

/**
 * Resolves a router password without requiring it on the command line
 * (where it would be stored in the crontab and visible in `ps`).
 * Order: explicit argument, ROUTER_PASSWORD, contents of ROUTER_PASSWORD_FILE.
 */
export const resolvePassword = (
  arg: string | undefined,
  env: Record<string, string | undefined> = process.env
): string | undefined =>
  arg ||
  env.ROUTER_PASSWORD ||
  (env.ROUTER_PASSWORD_FILE
    ? readFileSync(env.ROUTER_PASSWORD_FILE, 'utf8').trim()
    : undefined);
