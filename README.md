# 📸 Best Beginner Camera — Photo Club Survey

A small static site that:

- Shows a **top-10 leaderboard** of camera recommendations from your club.
- Lets you **tap any camera** to see all the comments people left about it.
- Has a **"Add your recommendation"** button that opens your Google Form.

Submissions are collected through Google Forms (which writes to a Google Sheet),
and the site reads from the sheet to build the leaderboard. No server required.

---

## One-time setup

### 1. Create the Google Form

1. Go to <https://forms.google.com> and create a blank form.
2. Title it **"Best beginner camera for smartphone photographers"**.
3. Add two questions:
   - **Question 1** — type **Short answer**, required.
     - Question text: `Top camera recommendation`
   - **Question 2** — type **Paragraph**, *not* required.
     - Question text: `Comments (optional)`
4. Click **Send** → copy the form link (the `…/viewform` URL). You'll paste this
   into `assets/config.js` as `formUrl`.

> The question text matters: it becomes the column header in the linked sheet,
> and the site looks up responses by that header.

### 2. Link a response sheet

1. In the Form, click the **Responses** tab → the green **Sheets** icon.
2. Choose **"Create a new spreadsheet"** and accept the default name.
3. Open the new sheet. The first tab is named **"Form Responses 1"**.
4. Copy the **sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

### 3. Make the sheet readable

1. In the sheet, click **Share** (top right).
2. Under **General access**, change "Restricted" to **"Anyone with the link"**
   with **Viewer** access. (This lets the website fetch the responses; only
   people who know the sheet URL or have the site can read aggregated data.)
3. Click **Done**.

### 4. Plug your values into the site

Open `assets/config.js` and fill in:

```js
window.SURVEY_CONFIG = {
  formUrl:  "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform",
  sheetId:  "YOUR_SHEET_ID",
  sheetName: "Form Responses 1",
  cameraColumn:   "Top camera recommendation",
  commentsColumn: "Comments (optional)",
};
```

If you used different question text in step 1, update `cameraColumn` /
`commentsColumn` to match **exactly**.

---

## Run it locally

Because browsers block `fetch()` on `file://` URLs, serve the folder with any
tiny static server. From this directory:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish it

The easiest free option is **GitHub Pages**:

1. Create a new GitHub repo and push the contents of this folder to it.
2. In the repo → **Settings → Pages**, set the source to your `main` branch,
   root folder.
3. GitHub gives you a public URL — share that with your club.

You can also drop the folder into Netlify, Cloudflare Pages, Vercel, etc.

---

## How it works

- `index.html` shows the leaderboard. It calls `Survey.initLeaderboard()`.
- `camera.html?camera=<key>` shows the comments for one camera. It calls
  `Survey.initCameraPage()`.
- `assets/app.js` fetches the sheet via Google's public gviz CSV endpoint
  (`/gviz/tq?tqx=out:csv&sheet=…`), parses the CSV, groups answers by a
  case-insensitive form of the camera name, counts votes, and picks the
  most-used spelling as the display name. Comments are shown verbatim.

## Tweaking

- Want more than 10 entries? In `assets/app.js`, change
  `cameras.slice(0, 10)` to whatever number you like.
- Want to canonicalize camera names (e.g. always show "Fujifilm X-T30 II"
  regardless of input)? Build a small alias map and apply it in `normalizeKey`.
- The styling lives entirely in `assets/style.css` and uses CSS custom
  properties at the top — change `--accent`, `--bg`, etc. to rebrand.
