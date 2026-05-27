// Photo Club Survey — shared frontend logic
// Reads form responses from a public Google Sheet, aggregates votes
// per camera, and powers both the leaderboard and the comments page.

(function () {
  const cfg = window.SURVEY_CONFIG || {};

  function buildCsvUrl() {
    const id = encodeURIComponent(cfg.sheetId || "");
    const sheet = encodeURIComponent(cfg.sheetName || "Form Responses 1");
    // gviz endpoint works as long as the sheet is shared with "Anyone with the link".
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
  }

  // Minimal RFC-4180-ish CSV parser. Handles quoted fields, embedded commas,
  // doubled quotes, and embedded newlines.
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          row.push(field); field = "";
        } else if (c === "\n") {
          row.push(field); field = "";
          rows.push(row); row = [];
        } else if (c === "\r") {
          // skip; \n handles row end
        } else {
          field += c;
        }
      }
    }
    // flush final field/row
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function normalizeKey(name) {
    return (name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  // Pick the most-frequently-used spelling/casing among submissions
  // so the leaderboard shows e.g. "Fujifilm X-T30 II" rather than
  // whatever the latest voter happened to type.
  function pickDisplayName(originals) {
    const counts = new Map();
    for (const o of originals) {
      counts.set(o, (counts.get(o) || 0) + 1);
    }
    let best = originals[0];
    let bestN = -1;
    for (const [name, n] of counts) {
      if (n > bestN) { best = name; bestN = n; }
    }
    return best;
  }

  async function fetchResponses() {
    if (!cfg.sheetId || cfg.sheetId.startsWith("REPLACE_")) {
      throw new Error(
        "This site isn't configured yet. Edit assets/config.js with your Google Sheet ID and Form URL — see README.md."
      );
    }
    const url = buildCsvUrl();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Couldn't load survey data (HTTP ${res.status}). Make sure the sheet is shared with "Anyone with the link".`
      );
    }
    const text = await res.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return [];

    const header = rows[0].map((h) => h.trim());
    const cameraIdx = header.indexOf(cfg.cameraColumn);
    const commentsIdx = header.indexOf(cfg.commentsColumn);

    if (cameraIdx === -1) {
      throw new Error(
        `Couldn't find a column named "${cfg.cameraColumn}" in the sheet. ` +
        `Edit cameraColumn in assets/config.js to match your Form's question text exactly.`
      );
    }

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const camera = (r[cameraIdx] || "").trim();
      if (!camera) continue;
      const comment = commentsIdx === -1 ? "" : (r[commentsIdx] || "").trim();
      out.push({ camera, comment });
    }
    return out;
  }

  function aggregate(responses) {
    const groups = new Map(); // key -> { originals: [], comments: [] }
    for (const r of responses) {
      const key = normalizeKey(r.camera);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { originals: [], comments: [] });
      const g = groups.get(key);
      g.originals.push(r.camera);
      if (r.comment) g.comments.push(r.comment);
    }
    const cameras = [];
    for (const [key, g] of groups) {
      cameras.push({
        key,
        name: pickDisplayName(g.originals),
        votes: g.originals.length,
        comments: g.comments,
      });
    }
    cameras.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
    return cameras;
  }

  function setText(el, text) { if (el) el.textContent = text; }

  function renderLeaderboard(container, cameras) {
    container.innerHTML = "";
    if (cameras.length === 0) {
      container.innerHTML =
        '<div class="empty">No responses yet — be the first to recommend a camera!</div>';
      return;
    }
    const top = cameras.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const c = top[i];
      const rank = i + 1;
      const row = document.createElement("a");
      row.className = "row" + (rank <= 3 ? ` r${rank}` : "");
      row.href = `camera.html?camera=${encodeURIComponent(c.key)}`;
      row.style.color = "inherit";
      row.style.textDecoration = "none";
      row.innerHTML = `
        <div class="rank">#${rank}</div>
        <div>
          <div class="name"></div>
          <div class="meta">${c.comments.length} comment${c.comments.length === 1 ? "" : "s"}</div>
        </div>
        <div class="votes">${c.votes} vote${c.votes === 1 ? "" : "s"}</div>
      `;
      row.querySelector(".name").textContent = c.name;
      container.appendChild(row);
    }
  }

  function renderCommentsPage(summaryEl, listEl, cameras, cameraKey) {
    const match = cameras.find((c) => c.key === cameraKey);
    if (!match) {
      summaryEl.innerHTML = `<h2>Camera not found</h2><div class="count">No responses recorded for this camera yet.</div>`;
      listEl.innerHTML = "";
      return;
    }
    summaryEl.innerHTML = `
      <h2></h2>
      <div class="count">${match.votes} vote${match.votes === 1 ? "" : "s"} · ${match.comments.length} comment${match.comments.length === 1 ? "" : "s"}</div>
    `;
    summaryEl.querySelector("h2").textContent = match.name;

    listEl.innerHTML = "";
    if (match.comments.length === 0) {
      listEl.innerHTML = '<div class="no-comments">No comments yet for this camera.</div>';
      return;
    }
    for (const c of match.comments) {
      const div = document.createElement("div");
      div.className = "comment";
      div.textContent = c;
      listEl.appendChild(div);
    }
  }

  function wireSurveyButtons() {
    const url = cfg.formUrl;
    document.querySelectorAll("[data-survey-link]").forEach((el) => {
      if (url && !url.startsWith("https://docs.google.com/forms/d/e/REPLACE_")) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          alert("Survey link isn't set yet. Edit formUrl in assets/config.js.");
        });
      }
    });
  }

  async function initLeaderboard() {
    wireSurveyButtons();
    const list = document.getElementById("leaderboard");
    if (!list) return;
    try {
      const responses = await fetchResponses();
      const cameras = aggregate(responses);
      renderLeaderboard(list, cameras);
    } catch (err) {
      list.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  async function initCameraPage() {
    wireSurveyButtons();
    const summary = document.getElementById("summary");
    const comments = document.getElementById("comments");
    if (!summary || !comments) return;

    const params = new URLSearchParams(window.location.search);
    const key = (params.get("camera") || "").trim();
    if (!key) {
      summary.innerHTML = `<h2>No camera selected</h2><div class="count">Go back to the leaderboard and tap a camera.</div>`;
      return;
    }
    try {
      const responses = await fetchResponses();
      const cameras = aggregate(responses);
      renderCommentsPage(summary, comments, cameras, key);
    } catch (err) {
      summary.innerHTML = `<h2>Couldn't load comments</h2><div class="count error">${err.message}</div>`;
    }
  }

  window.Survey = { initLeaderboard, initCameraPage };
})();
