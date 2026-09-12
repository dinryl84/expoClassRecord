# Play Store Submission Guide

This covers everything from here to a live (or in-review) Play Store
listing. None of these steps can be run from within this chat — they need
your own Expo account, Google account, and $25 one-time Google Play
Developer registration — so this is a checklist to follow on your own
machine.

## 1. One-time accounts you'll need

- **Expo account** (free) — [expo.dev](https://expo.dev/signup) — this is
  what runs the actual Android build in the cloud, since you can't build
  an Android app without either a Mac/Linux build machine or a cloud build
  service.
- **Google Play Developer account** ($25 one-time) —
  [play.google.com/console/signup](https://play.google.com/console/signup)

## 2. Host the privacy policy

`PRIVACY_POLICY.md` is written and ready, but Play Console requires a
**public URL**, not a file. Easiest free option — GitHub Pages:

1. Create a new public GitHub repo (or use an existing one).
2. Add `PRIVACY_POLICY.md` (rename to `index.md` for the simplest setup),
   fill in the "Last updated" date and your contact email.
3. Repo Settings → Pages → Source: deploy from the `main` branch.
4. Your policy will be live at
   `https://<your-username>.github.io/<repo-name>/`.

(A Google Sites page or Notion public page works too, if you'd rather not
use GitHub — any URL that's publicly reachable and shows the actual policy
text is fine.)

## 3. Build the app

From the project folder, on your own machine:

```bash
npm install -g eas-cli
npm install
eas login
eas build:configure       # links this project to your Expo account, fills in the real eas.projectId
```

That last command will ask to update `app.json`'s
`extra.eas.projectId` — let it; it's currently a placeholder
(`REPLACE_WITH_YOUR_EAS_PROJECT_ID`).

Then build:

```bash
eas build --platform android --profile preview     # APK, for testing on your own device first
eas build --platform android --profile production  # AAB, what you actually upload to Play Console
```

The build runs on Expo's servers and gives you a download link when done
(10–20 minutes typically). **Install the preview APK on your own phone and
go through Import → Export → Print once before uploading anything** — see
the on-device smoke test note already in `README.md`.

## 4. Play Console setup

Inside [Play Console](https://play.google.com/console):

1. **Create app** → name it "SHS Class Record" → Free → fill the
   declarations (not primarily for children, etc. — see §6 below).
2. **App content** section — this has several required forms:
   - **Privacy policy** — paste the URL from step 2.
   - **App access** — "All functionality is available without special
     access" (there's no login server, so this is straightforward).
   - **Ads** — No, the app has no ads.
   - **Content rating questionnaire** — see §5.
   - **Data safety** — see §6. This is the one people get wrong most
     often; the answers below are accurate for this app specifically.
   - **Government apps / Financial features / Health** — No to all.
   - **Target audience** — see §7.
3. **Store listing**:
   - **App name:** SHS Class Record
   - **Short description** (80 char max):
     `Offline SHS class record: grades, attendance, and DepEd Excel export.`
   - **Full description:** see §8 below, edit freely.
   - **App icon:** `store-assets/icon-512.png` (512×512, ready to upload
     as-is).
   - **Feature graphic** (1024×500, required): `store-assets/feature-graphic.png`
     — generated and ready to upload as-is.
   - **Screenshots** (min 2, phone-size): take these from the preview APK
     running on your device — Dashboard, Score Encoding, and Grade Report
     are the most representative screens.
4. **Production → Create release** (or Internal testing track first,
   which is strongly recommended for your very first release) → upload
   the `.aab` from the production build.

## 5. Content rating questionnaire — expected answers

This is a teacher productivity tool with no user-generated content shared
with others, no violence, no user communication features. Answering
honestly through Google's IARC questionnaire should land this at
**"Everyone."** There's nothing in this app that should trigger a higher
rating.

## 6. Data Safety form — the answers that match this app

Based on what's actually in the codebase (no network calls, no analytics
SDK, no ad SDK):

- **Does your app collect or share any of the required user data types?**
  **No** — nothing is collected or transmitted off-device.
- **Is all user data encrypted in transit?** N/A (nothing is transmitted).
- **Do you provide a way for users to request data deletion?** Not
  applicable in the usual sense — there's no server-held data to delete;
  uninstalling the app removes everything. You can state this plainly in
  the form's free-text field if it asks.

If Play Console's questionnaire asks whether the app handles data "about
children" — the honest answer is that the app is a **teacher's tool**, not
an app used by or directed at children, even though a teacher may type
student names into it. This is the same category as any private
spreadsheet or gradebook app; the Data Safety form has language for exactly
this case ("app collects data about other people, not the end user, for a
professional purpose").

## 7. Target audience

Select an adult audience (e.g., 18+), since the *user* of this app is a
teacher, not a student.

## 8. Suggested full store listing description

```
SHS Class Record is an offline class record app for Philippine Senior
High School teachers, built around the official DepEd Electronic Class
Record (ECR) format.

FEATURES
• Manage multiple sections and subjects
• Score encoding for Written Works, Performance Tasks, and Summative
  Assessments, with automatic DepEd-compliant grade computation
• Attendance tracking with daily and monthly views
• Per-student grade reports and notes
• Import and export official DepEd ECR Excel (.xlsx) files
• Print or save class records as PDF
• Works fully offline — your data never leaves your device
• Backup and restore your data anytime

Built for teachers, by someone who teaches. No ads, no accounts, no data
collection — just a faster way to manage your class records on the go.
```

Edit freely — this is a starting draft, not final copy.

## 9. After submission

First-time apps typically go through a review that can take a few days to
about a week. Using the **Internal testing** track first (rather than
Production) lets you and a few others install it immediately via a private
link while you wait on the full review for a public Production release —
worth doing for your first upload.
