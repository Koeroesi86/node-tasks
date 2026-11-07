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

The other `crontab-ui` variables (`BASE_URL`, `ENABLE_AUTOSAVE`, `SSL_CERT`, `SSL_KEY`) also apply.

### Security notes

- `crontab-ui` can run arbitrary commands as root in the container. The compose
  file publishes it on `127.0.0.1` only; put a VPN or an authenticating reverse
  proxy in front of it before exposing it. See [SECURITY.md](SECURITY.md).
- Prefer `ROUTER_PASSWORD` / `ROUTER_PASSWORD_FILE` over passing the router
  password in the cron command line, where it is stored in the crontab-ui DB
  and visible in `ps`.

### Build & Test

Requires Node.js 22 or newer.

    npm ci
    npm run build
