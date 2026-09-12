# SHS Class Record — Android (Expo)

Local-only DepEd class-record app (sections, learners, scores, grades,
attendance, notes, Excel/ECR import-export, print) — the React Native port
of the SHS Class Record PWA. No backend, no network; all data lives in
on-device SQLite.

## Project

- Stack: Expo SDK 54, React Native 0.81 (new architecture), Expo Router 6
  (file-based routes), TypeScript (strict). **Android-only** — no web build.
- Entry point: `expo-router/entry` (see `package.json` `main`); routes live
  under `app/`, the root gate + migration bootstrap is `app/_layout.tsx`.
- Android package: `com.bnhs.shsclassrecord` (`app.json`) — immutable after
  the first Play Store upload.
- UI brand tokens live in `src/theme/theme.ts`; there is no seed data —
  first launch goes to Login.

## Commands

```bash
npm install                                         # .npmrc sets legacy-peer-deps=true
npm start                                           # expo start (dev server)
npm run android                                     # expo start --android
npx tsc --noEmit                                    # typecheck — the only automated check
EXPO_OFFLINE=1 npx expo export --platform android   # device-free bundle smoke test
```

There is **no lint config and no test suite** (do not invent commands for
them). After the export check, clean up generated output: `rm -rf dist .expo`.

Release builds (need `eas-cli` + Expo/Google accounts, run outside this
repo's automated flow): `eas build --platform android --profile preview`
(APK) or `--profile production` (AAB) — profiles are defined in `eas.json`.
See `PLAY_STORE_SUBMISSION.md`; the privacy policy is `PRIVACY_POLICY.md`.

## Architecture

- `app/` — one file per route (Expo Router). Screens are thin: they call
  repositories and render. Routes: `dashboard`, `duplicates`,
  `grade-weights`, `import-excel`, `login`, `school-settings`, `settings`,
  and the nested section tree `section/[id]` → `learners`, `attendance`,
  `subject/[subjectId]`, `learner/[learnerId]`.
- `src/db/client.ts` — opens SQLite (`shsclassrecord.db`), turns on
  `PRAGMA foreign_keys`, runs `migrate()` keyed on `PRAGMA user_version`.
  `src/db/schema.ts` holds the single `SCHEMA_SQL`; add migrations by
  bumping `DB_VERSION` in `client.ts` and making `SCHEMA_SQL` idempotent.
  Screens never touch SQL directly. `API: getDb().getAllSync / getFirstSync /
  runSync / execSync` (all synchronous) and `withTransactionSync(...)`.
- `src/db/repositories/*.ts` — one typed CRUD module per table. Mutations
  that must be composed atomically expose a `*Raw` variant (no own
  transaction) used by callers that already hold a transaction. Where the
  PWA (Dexie) nested `learners[]`/`subjects[]` inline, this schema splits
  them into FK'd tables — the backup layer flattens/re-nests across that.
- `src/db/backup.ts` — JSON backup/restore that is **interchangeable with
  the PWA** (`appId: "shs-class-record"`, `backupVersion: 1`). These
  constants and the `data` shape must stay identical to the PWA's
  `src/utils/backup.ts`.
- `src/utils/grades.ts` — the DepEd grading engine: transmutation table,
  A–E letter cutoffs, WW/PT/Summative weighted average. `src/types/index.ts`
  holds `SUBJECT_WEIGHTS` defaults, attendance labels, and domain types.
- `src/utils/ecrXlsxIO.ts` + `src/utils/ecrCellMap.ts` — Excel (ECR) read/
  write via JSZip + direct sheet-XML editing (not `exceljs`/`xlsx`, which
  don't run under Hermes). `importExcel`/`exportExcel`/`printClassRecord`
  build on these; `assets/ecr-template.xlsx` is the bundled fallback.
- `src/components/ui.tsx` — shared `Button`/`Card`/`Modal`/`Field`/
  `SegmentedControl`/`OptionList`; use these rather than raw widgets.

## Conventions

- Import app code through the `@/*` alias (→ `src/*`), e.g.
  `@/db/repositories/sections`, `@/theme/theme`. Kept in `tsconfig.json`.
- All DB access goes through `src/db/repositories/*`; ID generation via
  `uuid()` from `src/utils/id.ts` (expo-crypto), never ad-hoc.
- Multi-step writes wrap in `db.withTransactionSync(...)` and call the
  `*Raw` repository variants inside it.
- Styling: a single `StyleSheet.create({...})` at the bottom of each file,
  using `colors`/`spacing`/`radii` from `@/theme/theme` — no hardcoded hex.
- Keep PWA parity: this file, the grade weights/transmutation table, the
  backup format, and the password-hash scheme (`btoa(password + salt)`, see
  `src/utils/base64.ts`) are deliberately duplicated from the PWA. A change
  on one side must be mirrored on the other or old backups break.
- Comments explain *why* (often citing the PWA origin) — preserve that style.

## Notes

<!-- quick-adds: gotchas, TODOs, links go here -->
