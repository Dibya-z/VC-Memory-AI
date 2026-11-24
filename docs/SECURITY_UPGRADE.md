# Dependency security upgrade and verification

The dependency review initially reported 24 advisories. The upgraded lockfile reports **zero known vulnerabilities** with `npm audit` at verification on 25 November 2026. This records the package-advisory result, not a claim that the application has undergone a complete security assessment.

## Upgraded stack

- Next.js 16.4.6 and React/React DOM 19.3.1.
- Zod 4.6.7, including the error-path typing adjustment needed by the memory citation validator.
- ESLint 10.15.0 and matching Next ESLint configuration, using flat configuration and `eslint . --max-warnings=0`.
- Prisma and Prisma Client remain on 6.19.3. Narrow overrides under `@prisma/config` select patched `deepmerge-ts` 8.0.2 and `effect` 3.22.5. CLI schema validation and generated-client creation were verified; no broad major-version override or forced audit repair was used.
- Compatible transitive dependencies were refreshed in `package-lock.json`.

Node 24 was used for verification and is recommended for this checkout and deployment. The declared minimum ranges also reflect the requirements of the installed ESLint/tooling. Stop the previous development server and restart it after installing the updated dependencies; a running Next 14 process cannot reliably adopt the Next 16 package in place.

```bash
npm ci
npm run dev
```

## Compatibility changes

Route parameters and search parameters are awaited where required by the App Router. `serverExternalPackages` replaces the older experimental configuration. React ref types include null. Browser-only saved state mounts after hydration using `useSyncExternalStore`; storage writes and focus effects retain their external-system responsibilities rather than disabling the new React lint rules. Company filter forms reset through a stable URL key instead of copying props into state in an effect.

The isolated Playwright development server uses `--webpack` because its `node_modules` directory is deliberately shared through a symlink. Production was separately checked with a clean installation in a self-contained copy using the normal `npm run build` command and Next 16's default Turbopack.

Some plugins bundled by Next's ESLint configuration still declare peer ranges ending at ESLint 9. npm can print peer-range warnings with ESLint 10; the clean install and actual lint checks succeed without `--force` or `--legacy-peer-deps`. The Next ESLint documentation describes this compatibility situation.

Primary references: [Next support policy](https://nextjs.org/support-policy), [Next 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [Next ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint).

## Verification and rollout

```bash
npm audit
npm test
npm run lint
npm run typecheck
npm run eval:memory
npm run test:frontend
```

Verification passed: zero npm audit advisories; 368 default Node tests (one opt-in database test skipped); 16 tests in the explicit PostgreSQL run, including 9 database scenarios; 12 browser scenarios; 15 memory evaluation cases; lint; and TypeScript.

The final build check used a disposable copy, an actual clean dependency installation, generated its own Prisma Client, and inert database/provider settings. It did not alter the active development server’s build artifacts or connect to Neon.

The dependency upgrade itself requires no database change. The separately implemented [durable upload protection](UPLOAD_IDEMPOTENCY.md) requires its reviewed additive table/index SQL **before deployment of the new ingestion code**. That SQL was exercised on disposable local PostgreSQL and applied to the authorized production target during the 25 November 2026 rollout, with existing records verified unchanged. Existing historical duplicate documents are not deleted or retrospectively fingerprinted.
