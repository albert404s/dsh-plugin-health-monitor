# Security policy

## Scope

This project reads public metadata from GitHub, npm and OSV. It never installs or executes the plugins it analyses.

## Reporting

Please open a private security advisory or contact the repository owner if you find:

- a way for collected third-party text to become executable HTML;
- a token or credential accidentally present in the frontend build;
- an unsafe GitHub Actions permission or artifact flow;
- an SSRF, path traversal, or injection issue in the collector.

Please do not include live tokens in an issue.

## Deployment boundary

- The collection workflow runs third-party npm scripts with a read-only `GITHUB_TOKEN`.
- A separate minimal job commits the generated JSON with `contents: write`; it does not install dependencies.
- Pages deployment uses only official Actions and a short-lived Pages token.
- `npm run check:dist` scans the built site for known token patterns.
