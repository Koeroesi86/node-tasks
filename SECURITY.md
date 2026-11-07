# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/Koeroesi86/node-tasks/security/advisories/new)
instead of opening a public issue. Expect an initial response within a few days.

## Supported versions

Only the latest commit on `main` and the `latest` Docker image are supported.

## Deployment notes

The bundled [crontab-ui](https://github.com/alseambusher/crontab-ui) can run
arbitrary commands as root inside the container. Never expose it directly to an
untrusted network: keep basic auth enabled, bind it to a loopback address, and
put a VPN or an authenticating reverse proxy in front of it.
