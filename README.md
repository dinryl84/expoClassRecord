# SHS Class Record — Android (Expo) — Phase 1–7 (feature-complete)

This is the React Native / Expo port of the SHS Class Record PWA, targeting
the Google Play Store.

## Phase 7 (this update): Polish + Play Store prep

**What I could actually do from here** vs. **what genuinely needs your own
accounts/machine** — being direct about the split, since this phase is
different from 1–6:

Done in this phase:
- **App icon, adaptive icon, and splash screen** — generated to match the
  app's brand colors (maroon/cream), wired into `app.json` via
  `expo-splash-screen`. These are placeholder-quality (a simple "SHS"
  monogram), not a professional logo — swap `assets/icon.png`,
  `assets/adaptive-icon.png`, and `assets/splash-icon.png` for real
  artwork whenever you have it; nothing else needs to change.
- **`app.json` production config** — versionCode, package name
  (unchanged: `com.bnhs.shsclassrecord`), proper icon/splash wiring.
- **`eas.json`** — build profiles for development, preview (APK, for
  testing on your own device before release), and production (AAB, what
  Play Console actually wants).
- **`PRIVACY_POLICY.md`** — a real, accurate policy reflecting what this
  app actually does (nothing is collected or transmitted — everything is
  local-only). Needs your contact info and a publish date filled in, then
  hosting somewhere public (steps included).
- **`PLAY_STORE_SUBMISSION.md`** — step-by-step: accounts needed, hosting
  the privacy policy, the exact `eas build`/`eas submit` commands, Data
  Safety form answers that match this app honestly, content rating
  guidance, target audience, and a draft store listing description.
- **`store-assets/`** — a ready-to-upload 512×512 icon and 1024×500
  feature graphic for the Play Console listing.

**Not done here, and can't be** — I have no access to Expo's build
servers, your Google account, or Play Console from this sandbox, so
`eas build`, `eas submit`, and the actual Play Console listing all need to
happen on your own machine, following `PLAY_STORE_SUBMISSION.md`. Same for
device screenshots — those need to come from the real app running on a
real (or emulated) phone.

At this point the app is **feature-complete** across everything the PWA
does — Sections, Learners, Score Encoding, Grade Reports, Grade Weights,
Attendance, Student Reports, Notes, Excel import/export (with your real
ECR template bundled), Print/PDF, and interchangeable backups. What's left
is entirely outside this sandbox: build it, test it on a device, and
submit it.

## Phase 6: Print / PDF

**Not a submission format** — this is a printable paper view of a class
record for the teacher's own use (posting a copy, a paper file, handing a
copy to a co-adviser), separate from the Excel (Phase 5) which is the
actual DepEd-required file. Ported from the PWA's `PrintView.tsx`, which
built an HTML layout and called the browser's `window.print()` — RN has no
such API, so this uses `expo-print` instead, generating the same HTML and
handing it to the native print pipeline.

- **`src/utils/printClassRecord.ts`** — rebuilds the PWA's HTML table
  layout (school info grid, Male/Female tables with T1/T2/T3/Average/
  Remarks, same PASSED/FAILED ≥75 color logic) as a plain HTML string.
- **🖨 Print** button (Score Encoding → Grades view) — opens Android's
  native print dialog via `Print.printAsync()`. Android's print dialog
  itself includes "Save as PDF" as a printer option, so this covers both
  physical printing and PDF saving in one native flow.
- **📄 Save/Share PDF** button — generates the PDF directly with
  `Print.printToFileAsync()` and opens the share sheet, for when the
  teacher wants to send it via email/chat rather than go through the print
  dialog.

## Phase 5: Excel (ECR) import/export

**The stack changed here, deliberately.** The PWA reads/writes Excel with
`exceljs` + `xlsx` (SheetJS) + `file-saver`. All three are risky in React
Native — `exceljs` and `xlsx` are written Node-first and pull in APIs that
don't exist on-device, and `file-saver` is a pure browser API with no RN
equivalent. Rather than fight those, this phase rebuilds the same
capability on **JSZip + direct sheet-XML editing** — which is actually the
same approach the PWA's *own export path* already used (see
`exportExcel.ts`'s style-preserving cell patcher), just extended here to
also **read** cells for import, not only write them.

- **`src/utils/ecrCellMap.ts`** — the ECR template's cell coordinates,
  ported verbatim (pure data, zero changes).
- **`src/utils/ecrXlsxIO.ts`** (new) — shared JSZip helpers: sheet-name →
  path resolution, shared-string table parsing, cell read, and the
  style-preserving cell write ported from the PWA's `exportExcel.ts`. Both
  import and export are built on this one shared module.
- **Import Excel** (Dashboard → 📄 Import Excel) — picks a `.xlsx`, reads
  school info, section name, grade level, subject, learner names, and all
  three terms' scores directly from the official ECR layout. Matches an
  existing section by name + grade level (adds/updates the subject in it)
  or creates a new one — same matching behavior as the PWA. The imported
  file is also saved as the reusable export template.
- **Export to Excel** (Score Encoding screen → 📤 Export to Excel) — fills
  a copy of the stored template with the current section/subject's data
  and opens the share sheet to save or send it.

**Bundled fallback template — now included.** You sent over the actual ECR
file (`Class_Record_-_Valor-_Orig.xlsx`), which I verified structurally
matches `ecrCellMap.ts` exactly: same sheet names (`INPUT DATA`, `TERM 1/2/3`,
`AVE`, `Helper(IMPORTANT!)`), same coordinates for every school-info field
(e.g. `F13` = School ID, confirmed `304300` — matches this app's own
default), same `HPS` row and formula-linked name row on the TERM sheets.
It's now bundled at `assets/ecr-template.xlsx` and used as the fallback
whenever no template has been imported yet — export works from a blank
section now, same as the PWA's own bundled-template behavior. (I didn't
read or reproduce any student names from the file while checking this —
only the structural cell layout.)

**Worth flagging honestly:** JSZip is the one new dependency this phase
adds, and while it bundled cleanly (I checked it doesn't depend on
`atob`/`btoa` or hard-require Node's `Buffer` — it feature-detects and
falls back to its browser-safe path, which is exactly the path Hermes will
take), I have no way to run it on an actual Android device from here. This
is the one piece of Phase 5 I'd genuinely want smoke-tested — pick a real
ECR file and try Import, then Export, on-device — before trusting it fully.

## Phase 4: Attendance + Student Reports

- **Attendance screen** — Daily view with **tap-to-cycle status** per
  learner (P → A → L → E → C → blank → P…), matching the earlier mobile UI
  recommendation for this screen instead of the PWA's click-a-dropdown
  pattern. Mark All Present, Copy from Previous Day, Clear Day, and a live
  day summary strip (counts + attendance rate) — all ported from
  `utils/attendance.ts`, which is pure calculation logic and needed almost
  no changes beyond swapping Dexie queries for the SQLite repository.
- **Monthly Summary view** — per-learner P/A/L/E/C tallies and rate for a
  selected month. (The PWA's day-by-day calendar grid didn't translate well
  to a phone screen, so this is a deliberate adaptation — a scrollable
  per-learner list rather than a grid — not a straight port.)
- **Student Report screen** — per-subject grades across all three terms
  (tap to expand the WW/PT/Summative → Initial → Transmuted breakdown for
  each term), all-time attendance totals, and the **Notes & Observations**
  widget (categorized quick-notes: submitted / missing / brought materials
  / no materials / other) ported from `components/StudentNotes.tsx`.
  Reachable from a learner's "📊 Report" link on the Learners screen.

Not ported in this phase: the PWA's attendance-by-term-date-range filter on
Student Report (currently shows all-time attendance only) and the
duplicate-edit highlight color picker on Score Encoding — both are minor
and can be added later without restructuring anything.

## Phase 3: Score Encoding + Grade Report + Grade Weights

- **Grading engine ported verbatim** (`src/utils/grades.ts`) — same
  transmutation table, same DepEd Order No. 015 s. 2026 A–E letter cutoffs,
  same Written Works / Performance Tasks / Summative weighted-average
  formula. This file is almost entirely pure logic, so it needed near-zero
  changes; the only real adaptation is that the custom-weights override now
  reads/writes through the SQLite `settings` repository instead of Dexie.
- **Score Encoding screen** — built mobile-first as a one-student-at-a-time
  **focus view** (prev/next navigation, search-to-jump) rather than the
  PWA's wide scrolling table, matching the mobile UI redesign already
  recommended for this screen. Written Works / Performance Tasks /
  Summative tabs, per-tab Highest Possible Score entry, autosaves 800ms
  after the last keystroke (same debounce as the PWA).
- **Grade Report view** (toggle from Score Encoding's header) — class
  average, at-risk count, A–E distribution bar, tap-to-expand per-student
  breakdown showing the same WW/PT/Summative → Initial → Transmuted chain
  the PWA shows.
- **Duplicate-edit highlighting** — scores that differ from a duplicated
  section's baseline snapshot are outlined, same `editDiff.ts` logic as the
  PWA (ported verbatim).
- **Grade Weights screen** (Settings → School Settings → Grade Weights) —
  override the DepEd default WW/PT/Summative percentages per subject type,
  validated to sum to 100%, with a reset-to-defaults button.

Attendance, Student Reports (a dedicated single-student printable view),
Excel import/export, and Print are still ahead.

## Phase 2: Section / Learner CRUD + School Settings

- **Dashboard** — section list, Add Section, Duplicate Section (full clone
  of learners/subjects/scores/attendance with new IDs), Delete Section,
  backup-reminder banner (nags after 7 days, snoozable)
- **Duplicates screen** — lists duplicated sections separately, rename/delete
- **Section Detail** — edit section name/grade, add/rename subjects, entry
  points to Learners (built) / Attendance / Student Reports (both stubbed
  with a "coming in a later phase" alert — real UI lands in Phases 3–4)
- **Learners screen** — quick-add, bulk paste-upload (same name-parsing
  logic as the PWA: handles `LAST, FIRST M.`, CSV-with-gender-column, SF1
  copy-paste, numbered-list prefixes), separate Male/Female lists, remove
- **School Settings** — region/division/school ID/name/year/teacher/track,
  term date ranges (used later for filtering attendance/reports by term)

Score Encoding, Attendance, Student Reports, Excel import/export, Print, and
grade-weight customization are still ahead (Phases 3–6) — tapping into a
subject, Attendance, or Student Reports right now shows a "coming soon"
alert rather than a broken screen.

## Phase 1: data layer + navigation shell + backup/restore

## What's actually in this phase

- Expo SDK 54 + Expo Router (file-based navigation), TypeScript, Android-only
  (no web build — `expo-sqlite`'s web backend isn't used here)
- **SQLite schema** (`src/db/schema.ts`) mirroring every Dexie table from the
  PWA. `sections` is the one structural change: learners/subjects are now
  their own tables with a `sectionId` foreign key instead of nested arrays —
  everything else (users, schoolInfo, termScores, settings, templates,
  attendance, notes) is a straight one-row-per-item port.
- **Repository layer** (`src/db/repositories/*.ts`) — typed CRUD functions,
  one file per table, matching the PWA's `db/index.ts` API shape.
- **Backup / restore** (`src/db/backup.ts`) — produces and reads the *exact
  same JSON format* as the PWA (`appId: "shs-class-record"`,
  `backupVersion: 1`, same `data` shape). A backup made on the PWA restores
  here, and a backup made here restores on the PWA. This was the explicit
  requirement going in — see the notes below on the two details that made
  that actually true rather than just "looks similar."
- **Login / Register / Logout** — same local-only auth as the PWA (username +
  password, hashed with the same `btoa(password + salt)` scheme so a
  password set on the PWA still works after restoring a backup here).
- **Dashboard + Settings screens** — minimal, but Settings has working
  backup/restore buttons, which is the real end-to-end proof this phase
  needed to deliver.

## The two compatibility details worth knowing about

1. **No `btoa`/`atob` in React Native.** `src/utils/base64.ts` is a small,
   from-scratch re-implementation of the standard algorithm — not a crypto
   library, just the same bit-shuffling the browser does — so password
   hashes and the base64-encoded ECR template round-trip identically to the
   PWA. If you ever change the password hashing scheme, change it in *both*
   apps together or old backups will stop being able to log in.
2. **Templates are stored as base64 text directly in SQLite**, not decoded
   to a file — this keeps the backup import/export code simple (no
   base64↔binary step needed on the way in/out) since it's already the
   PWA's own on-disk backup representation.

## Running it

```bash
npm install
npx expo start --android   # requires Android Studio emulator or a USB device with Expo Go/dev client
```

There's no seed data — first launch goes to Login (create an account), then
Settings → "Restore from backup…" to bring in an existing PWA export, or
Phase 2 will add real section/learner management to start from scratch.

## Verifying it compiles without a device

`expo-sqlite` doesn't bundle for the web platform in this environment,
so the usual "web export as a syntax smoke test" doesn't apply here.
Use the Android bundle target instead — it exercises every route, import,
and native-module resolution without needing an emulator:

```bash
EXPO_OFFLINE=1 npx expo export --platform android
rm -rf dist .expo   # clean up afterwards, this is a check, not a deliverable
```

## What's next

All 7 planned phases are done. From here it's entirely on your side:

1. Run `eas build:configure`, then `eas build --platform android --profile preview`
2. Install that APK on your own phone — smoke-test Import → Export →
   Print with a real ECR file before going further
3. Host `PRIVACY_POLICY.md` somewhere public (steps in
   `PLAY_STORE_SUBMISSION.md`)
4. Follow `PLAY_STORE_SUBMISSION.md` for the Data Safety form, content
   rating, store listing, and `eas submit`

Nice-to-haves for later, not blockers: a real logo (current icon is a
placeholder monogram), the term-date-range attendance filter on Student
Report, and the duplicate-edit highlight color picker on Score Encoding.

## Play Store reminders for later

- You'll need a **privacy policy URL** in Play Console — required by the
  Data Safety form since the app stores learner names and grades, even
  though everything is local/offline.
- One-time **package name** is already set: `com.bnhs.shsclassrecord`
  (`app.json` → `expo.android.package`) — this can't be changed after your
  first Play Store upload, so confirm it before Phase 7.
- Google Play Developer account is a one-time $25 fee.
