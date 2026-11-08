# Koeroesi86/node-tasks [![CI](https://github.com/Koeroesi86/node-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/Koeroesi86/node-tasks/actions/workflows/ci.yml)

Schedule tasks with NodeJS

### Usage

Requires Docker with Compose. Credentials for the web UI are mandatory:

    BASIC_AUTH_USER=<user> BASIC_AUTH_PWD=<password> docker-compose up

The UI is then available at <http://127.0.0.1:3000>. State is kept in the
`crontab-ui-db` and `crontabs` named volumes.

### Environment variables

| Variable | Description |
| --- | --- |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PWD` | Required. Web UI credentials. |
| `TZ` | Time zone used by the cron jobs. |
| `ROUTER_PASSWORD` | Router password used when the task's password argument is omitted or empty. |
| `ROUTER_PASSWORD_FILE` | Path to a file (for example a mounted secret) holding the router password. |
| `SSH_BACKUP_KEEP` | Number of archives the `ssh_backup` task keeps per host. Defaults to 14 when missing or invalid. |
| `SSH_BACKUP_ON_FAILURE` | Optional shell command run when `ssh_backup` fails. Missing or blank does nothing. See below. |
| `SSH_BACKUP_EXCLUDE` | Comma-separated `tar` exclude patterns for `ssh_backup`, for example `node_modules,*.log`. |

The other `crontab-ui` variables (`BASE_URL`, `ENABLE_AUTOSAVE`, `SSL_CERT`, `SSL_KEY`) also apply.

### Backing up files from an SSH server

The `ssh_backup` task backs up paths from any host defined in your ssh config
(`~/.ssh/config`). It streams `tar` over `ssh`, so the server only needs `tar`.
Compose mounts `~/.ssh` (override with `SSH_DIR`) read-only at
`/home/node/.ssh` and keeps backups in the `ssh-backups` volume at `/backups`.

Add a cron job in the UI:

    node /data/dist/tasks/ssh_backup.js "<ssh_config_host>" "/backups" "/etc" "/var/www"

Each run writes `/backups/<host>/<UTC timestamp>.tar.gz` (mode `0600`). Paths
are stored relative to `/` with numeric owners, so a restore keeps ownership.
The archive is written as `.partial`, verified with `tar -tzf`, and only then
renamed, so a failed run leaves nothing behind. `tar` exit code 1 (a file changed
while being read) is a warning; anything higher fails the run.

Requirements: the host's key must work non-interactively (`BatchMode` is on, so
no passphrase or password prompts) and its host key must already be in
`known_hosts`. Remote paths must be absolute. Reading files owned by other
users, such as `/etc/letsencrypt`, needs an ssh login that can read them.

#### Failure notification

Set `SSH_BACKUP_ON_FAILURE` to any shell command; it runs only when a backup
fails, and the task still exits non-zero afterwards. The command gets
`SSH_BACKUP_HOST` and `SSH_BACKUP_ERROR` in its environment. If the command
itself fails it is logged and does not hide the original error. For example,
pinging the fail endpoint of a healthchecks.io check:

    SSH_BACKUP_ON_FAILURE='curl -fsS -m 10 --retry 3 https://hc-ping.com/<uuid>/fail'

or posting to a webhook:

    SSH_BACKUP_ON_FAILURE='curl -fsS -m 10 -d "backup of $SSH_BACKUP_HOST failed: $SSH_BACKUP_ERROR" https://ntfy.sh/<topic>'

Since a job that never starts cannot report its own failure, also ping a
success URL after each run if you need to detect missed runs.

### Running as a different uid/gid

The container runs as an unprivileged user (uid/gid 1000 by default). It cannot
switch users at runtime, so set the ids when building to match the owner of the
mounted `~/.ssh` and of any bind-mounted backup directory:

    PUID=$(id -u) PGID=$(id -g) BASIC_AUTH_USER=<user> BASIC_AUTH_PWD=<password> docker compose up --build

or `docker build --build-arg PUID=... --build-arg PGID=... .`. Existing named
volumes keep their old owner, so re-run the `chown` from the upgrade section
below with the new ids.

### Security notes

- `crontab-ui` can run arbitrary commands as root in the container. The compose
  file publishes it on `127.0.0.1` only; put a VPN or an authenticating reverse
  proxy in front of it before exposing it. See [SECURITY.md](SECURITY.md).
- Prefer `ROUTER_PASSWORD` / `ROUTER_PASSWORD_FILE` over passing the router
  password in the cron command line, where it is stored in the crontab-ui DB
  and visible in `ps`.

### Upgrading from a root-based image

The container now runs as the unprivileged `node` user (uid 1000). Named volumes
created by earlier versions are owned by root, so fix their ownership once
(the credentials are only needed because compose requires them):

    BASIC_AUTH_USER=x BASIC_AUTH_PWD=x docker compose run --rm --no-deps --user root --entrypoint chown webapp -R 1000:1000 /etc/crontabs /var/lib/crontab-ui

Then start the stack and save once in the UI to regenerate the crontab.

### Build & Test

Requires Node.js 22 or newer.

    npm ci
    npm run build
