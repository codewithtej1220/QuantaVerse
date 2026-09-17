/**
 * Build the example notes: one PDF of theory and formulas per module.
 *
 *   npm run notes
 *
 * Each module's notes are written in `modules/`, in a small line-based format
 * (see `parse` below), typeset here as HTML with the formulas turned into
 * MathML by Temml, and printed to PDF by a headless Chromium — Edge or Chrome,
 * whichever is installed, or the one named in NOTES_BROWSER.
 *
 * Why print a web page rather than use a PDF library: the formulas are the
 * point of these notes, and a browser is the one widely installed program that
 * typesets MathML properly. A PDF library would have meant drawing fractions by
 * hand.
 *
 * Every lesson starts on a fresh page, so the module page can open the notes
 * at the lesson being read and the reader lands on its heading rather than on
 * the tail of the one before. To know which page that is, each part is also
 * printed on its own and its pages counted; the counts go into
 * `src/lib/example-notes.json` alongside the file sizes. The committed PDFs
 * were printed on Windows, where Cambria, Cambria Math and Bahnschrift are
 * installed; elsewhere the fallbacks in the stylesheet apply and page breaks
 * can land differently, which is why the page numbers are measured on every
 * build rather than assumed.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import temml from "temml";

import { MODULES } from "./modules/index.mjs";

const run = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "public", "notes");
const MANIFEST = path.join(ROOT, "src", "lib", "example-notes.json");
const TEMML_CSS = path.join(ROOT, "node_modules", "temml", "dist", "Temml-Local.css");

const BROWSERS = {
  win32: [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
};

/* ------------------------------------------------------------------ */
/* Text                                                                */

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function math(tex, display = false) {
  try {
    return temml.renderToString(tex, { displayMode: display, throwOnError: true });
  } catch (error) {
    throw new Error(`could not typeset ${JSON.stringify(tex)}: ${error.message}`);
  }
}

const MATH = /(\$[^$]+\$)/g;
const isMath = (part) => part.length > 1 && part.startsWith("$") && part.endsWith("$");

/** Straight quotes to curly ones, in prose only — never inside maths. */
const typographic = (text) =>
  text
    .replace(/"([^"]*)"/g, "“$1”")
    .replace(/(\w)'(\w)/g, "$1’$2")
    .replace(/'([^']*)'/g, "‘$1’");

/** Prose with $inline maths$, **bold** and *italic*. */
function inline(text) {
  return text
    .split(MATH)
    .map((part) => {
      if (isMath(part)) return math(part.slice(1, -1));
      return escape(typographic(part))
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    })
    .join("");
}

/** A table row's cells: split on |, except inside maths, where | is a bar. */
const cells = (row) => {
  const out = [""];
  for (const part of row.split(MATH)) {
    if (isMath(part)) {
      out[out.length - 1] += part;
      continue;
    }
    const pieces = part.split("|");
    out[out.length - 1] += pieces[0];
    out.push(...pieces.slice(1));
  }
  return out.map((cell) => cell.trim());
};

/* ------------------------------------------------------------------ */
/* The notes format                                                    */

const TAG = /^(idea|p|eq\*?|def|ex|note|list|table|code|circuit):\s?(.*)$/;

/**
 * One lesson's notes, from lines like:
 *
 *   idea: the sentence to take away
 *   p: a paragraph, with $\alpha$ inline maths
 *   eq*: \ket{\psi} = \alpha\ket{0} + \beta\ket{1} ;; what it is
 *   def: Term ;; what it means
 *   ex: A worked example ;; the working
 *   note: an aside
 *   list: one ;; two ;; three
 *   table: head | head ;; cell | cell
 *   code:            (verbatim lines follow, up to a line reading :end)
 *   circuit:         (the same, set as a diagram)
 *
 * `eq*` is a key formula, and goes on the formula sheet as well. A line with no
 * tag continues the block above it, so long paragraphs can wrap in the source.
 */
function parse(source) {
  const blocks = [];
  let verbatim = null;

  for (const raw of source.split(/\r?\n/)) {
    if (verbatim) {
      if (raw.trim() === ":end") {
        blocks.push(verbatim);
        verbatim = null;
      } else {
        verbatim.lines.push(raw);
      }
      continue;
    }
    const line = raw.trim();
    if (!line) continue;
    const match = TAG.exec(line);
    if (!match) {
      const last = blocks.at(-1);
      if (!last || last.lines) throw new Error(`text outside a block: ${line}`);
      last.text += ` ${line}`;
      continue;
    }
    const [, tag, rest] = match;
    if (tag === "code" || tag === "circuit") {
      verbatim = { tag, title: rest.trim(), lines: [] };
    } else {
      blocks.push({ tag, text: rest });
    }
  }
  if (verbatim) throw new Error(`a ${verbatim.tag} block is missing its :end`);
  return blocks;
}

const fields = (text) => text.split(/\s*;;\s*/);

/* ------------------------------------------------------------------ */
/* Pages                                                               */

function renderBlocks(blocks, lessonNumber, sheet) {
  let equation = 0;
  return blocks
    .map((block) => {
      switch (block.tag) {
        case "idea":
          return `<p class="idea"><span class="label">Key idea</span>${inline(block.text)}</p>`;
        case "p":
          return `<p>${inline(block.text)}</p>`;
        case "eq":
        case "eq*": {
          const [tex, caption] = fields(block.text);
          equation += 1;
          const number = `${lessonNumber}.${equation}`;
          const key = block.tag === "eq*";
          if (key) sheet.push({ tex, caption, number });
          return `<figure class="eq${key ? " key" : ""}">
            <div class="eq-row"><div class="eq-math">${math(tex, true)}</div><span class="eq-no">(${number})</span></div>
            ${caption ? `<figcaption>${inline(caption)}</figcaption>` : ""}
          </figure>`;
        }
        case "def": {
          const [term, meaning] = fields(block.text);
          return `<div class="def"><span class="label">Definition · ${inline(term)}</span><p>${inline(meaning)}</p></div>`;
        }
        case "ex": {
          const [title, ...working] = fields(block.text);
          return `<div class="ex"><span class="label">Worked example · ${inline(title)}</span>${working
            .map((step) => `<p>${inline(step)}</p>`)
            .join("")}</div>`;
        }
        case "note":
          return `<p class="note">${inline(block.text)}</p>`;
        case "list":
          return `<ul>${fields(block.text)
            .map((item) => `<li>${inline(item)}</li>`)
            .join("")}</ul>`;
        case "table": {
          const [head, ...rows] = fields(block.text).map(cells);
          return `<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`;
        }
        case "code":
        case "circuit":
          return `<figure class="${block.tag}">${
            block.title ? `<span class="label">${inline(block.title)}</span>` : ""
          }<pre>${escape(block.lines.join("\n").replace(/^\n+|\s+$/g, ""))}</pre></figure>`;
        default:
          throw new Error(`unknown block ${block.tag}`);
      }
    })
    .join("\n");
}

function stylesheet(mod) {
  const running = `${mod.number} · ${mod.title}`.replace(/"/g, '\\"');
  return `${readFileSync(TEMML_CSS, "utf8")}
:root {
  --ink: #13201d;
  --muted: #53635f;
  --accent: #0b6b82;
  --accent-soft: #eaf4f5;
  --amber: #96490a;
  --amber-soft: #fbf2e7;
  --rule: #cfd9d6;
  --sans: Bahnschrift, "DIN Alternate", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --serif: Cambria, Georgia, "Times New Roman", serif;
  --mono: "Cascadia Mono", Consolas, "SF Mono", Menlo, monospace;
}
@page {
  size: A4;
  margin: 21mm 20mm 19mm;
  @top-left { content: "QuantaVerse · Module ${running}"; font: 7.5pt var(--sans); color: #0b6b82; letter-spacing: 0.04em; }
  @top-right { content: "Example notes"; font: 7.5pt var(--sans); color: #53635f; letter-spacing: 0.04em; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 7.5pt var(--sans); color: #53635f; }
}
@page :first {
  @top-left { content: none; }
  @top-right { content: none; }
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.3pt/1.5 var(--serif); color: var(--ink); hyphens: auto; }
math { font-size: 1.04em; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
strong { font-weight: 700; }
.label {
  display: block; margin-bottom: 3pt;
  font: 600 7.5pt/1.2 var(--sans); letter-spacing: 0.12em; text-transform: uppercase;
}
section.part { break-before: page; }
section.part:first-child { break-before: auto; }

.eyebrow { font: 600 8pt var(--sans); letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin: 0 0 6pt; }

/* ---- cover ---- */
.cover .eyebrow { margin-bottom: 14pt; }
.cover h1 { font: 600 28pt/1.08 var(--sans); letter-spacing: -0.01em; margin: 0 0 12pt; text-wrap: balance; }
.cover .lede { font-size: 13pt; line-height: 1.5; color: var(--ink); max-width: 38em; margin-bottom: 18pt; }
.cover .notice { border-top: 1.5pt solid var(--accent); border-bottom: 0.5pt solid var(--rule); padding: 8pt 0 9pt; margin: 0 0 20pt; font-size: 9.5pt; color: var(--muted); }
.cover .notice .label { color: var(--accent); }
.cover .notice p { margin: 0; }
.contents { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
.contents td { padding: 5pt 0; border-bottom: 0.5pt solid var(--rule); vertical-align: baseline; }
.contents td.n { width: 3.2em; font: 9pt var(--sans); color: var(--accent); font-variant-numeric: tabular-nums; }
.contents td.pg { width: 3em; text-align: right; font: 9pt var(--sans); color: var(--muted); font-variant-numeric: tabular-nums; }
.contents a { color: inherit; text-decoration: none; }
.contents .summary { display: block; font-size: 9pt; color: var(--muted); line-height: 1.4; }
.conventions { margin-top: 18pt; font-size: 9.5pt; color: var(--muted); }
.conventions .label { color: var(--muted); }

/* ---- lessons ---- */
.lesson h2 { font: 600 19pt/1.15 var(--sans); letter-spacing: -0.005em; margin: 0 0 8pt; text-wrap: balance; }
.idea { border-left: 2pt solid var(--accent); padding: 1pt 0 1pt 10pt; margin: 0 0 10pt; font-size: 10.8pt; font-style: italic; }
.idea .label { font-style: normal; color: var(--accent); }
.eq { margin: 6pt 0 8pt; break-inside: avoid; }
.eq-row { display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 10pt; }
.eq-math { overflow: hidden; }
.eq-math math { font-size: 1.1em; }
.eq-no { font: 8.5pt var(--sans); color: var(--muted); font-variant-numeric: tabular-nums; }
.eq figcaption { text-align: center; font-size: 8.6pt; line-height: 1.3; color: var(--muted); margin-top: 1pt; }
.eq.key { background: var(--accent-soft); border-radius: 3pt; padding: 4pt 10pt 5pt; }
.eq.key .eq-no { color: var(--accent); }
.def, .ex { break-inside: avoid; margin: 8pt 0 9pt; padding: 6pt 10pt 2pt; border-radius: 3pt; }
.def { border: 0.75pt solid #b9d5d9; }
.def .label { color: var(--accent); }
.ex { background: var(--amber-soft); }
.ex .label { color: var(--amber); }
.note { font-size: 9.5pt; color: var(--muted); border-left: 1pt solid var(--rule); padding-left: 10pt; }
ul { margin: 0 0 9pt; padding-left: 14pt; }
li { margin-bottom: 3pt; }
table:not(.contents) { width: 100%; border-collapse: collapse; margin: 6pt 0 9pt; font-size: 9.5pt; line-height: 1.4; break-inside: avoid; }
table:not(.contents) th { font: 600 7.5pt var(--sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 2pt 6pt 3pt 0; border-bottom: 0.75pt solid var(--ink); }
table:not(.contents) td { padding: 2.5pt 6pt 2.5pt 0; border-bottom: 0.5pt solid var(--rule); vertical-align: baseline; }
figure { margin: 0; }
.code, .circuit { margin: 7pt 0 10pt; break-inside: avoid; }
.code .label, .circuit .label { color: var(--muted); }
pre { margin: 0; font: 8.4pt/1.42 var(--mono); white-space: pre; background: #f2f6f5; border: 0.5pt solid var(--rule); border-radius: 3pt; padding: 6pt 8pt; }
.circuit pre { background: none; border: none; border-left: 1pt solid var(--rule); border-radius: 0; font-size: 9pt; }

/* ---- formula sheet ---- */
.sheet h2 { font: 600 19pt/1.15 var(--sans); margin: 0 0 4pt; }
.sheet .lede { color: var(--muted); font-size: 9.5pt; margin-bottom: 10pt; }
/* The sheet is the one table that may run over a page: kept whole it would
   leave the page before it empty. Rows still never split. */
.sheet table { width: 100%; border-collapse: collapse; break-inside: auto; }
.sheet tr { break-inside: avoid; }
.sheet td { border-bottom: 0.5pt solid var(--rule); padding: 5pt 8pt 5pt 0; vertical-align: middle; break-inside: avoid; }
.sheet td.what { width: 30%; font-size: 9pt; color: var(--muted); line-height: 1.35; }
.sheet td.no { width: 3.5em; text-align: right; font: 8.5pt var(--sans); color: var(--accent); font-variant-numeric: tabular-nums; padding-right: 0; }
.sheet td.formula { text-align: left; }
`;
}

function coverPart(mod, pages) {
  const rows = mod.lessons
    .map(
      (lesson, index) => `<tr>
        <td class="n">${mod.number}.${index + 1}</td>
        <td><a href="#lesson-${index + 1}">${inline(lesson.title)}</a><span class="summary">${inline(lesson.summary)}</span></td>
        <td class="pg">${pages ? pages.lessons[index] : ""}</td>
      </tr>`,
    )
    .join("");
  return `<section class="part cover">
    <p class="eyebrow">QuantaVerse · Module ${mod.number} of ${MODULES.length} · ${escape(mod.track)}</p>
    <h1>${inline(mod.title)}</h1>
    <p class="lede">${inline(mod.summary)}</p>
    <div class="notice">
      <span class="label">Example notes</span>
      <p>Written by the QuantaVerse team to show what a module’s notes can look like: each lesson’s theory in brief, every formula typeset and numbered, and the key ones gathered on a formula sheet at the end. Professors can upload their own notes for this module on its page, and students will see them alongside these.</p>
    </div>
    <table class="contents">
      ${rows}
      <tr>
        <td class="n">∑</td>
        <td><a href="#formula-sheet">Formula sheet</a><span class="summary">Every key formula of the module, gathered at the end.</span></td>
        <td class="pg">${pages ? pages.sheet : ""}</td>
      </tr>
    </table>
    ${mod.conventions ? `<div class="conventions"><span class="label">Conventions</span><p>${inline(mod.conventions)}</p></div>` : ""}
  </section>`;
}

function lessonPart(mod, lesson, index, sheet) {
  const number = `${mod.number}.${index + 1}`;
  return `<section class="part lesson" id="lesson-${index + 1}">
    <p class="eyebrow">Lesson ${number}</p>
    <h2>${inline(lesson.title)}</h2>
    ${renderBlocks(parse(lesson.notes), number, sheet)}
  </section>`;
}

function sheetPart(mod, sheet) {
  return `<section class="part sheet" id="formula-sheet">
    <p class="eyebrow">Module ${mod.number} · Formula sheet</p>
    <h2>Formula sheet</h2>
    <p class="lede">The key results of the module, numbered as they appear in the lessons.</p>
    <table>${sheet
      .map(
        (entry) => `<tr>
          <td class="what">${entry.caption ? inline(entry.caption) : ""}</td>
          <td class="formula">${math(entry.tex, true)}</td>
          <td class="no">(${entry.number})</td>
        </tr>`,
      )
      .join("")}</table>
  </section>`;
}

function page(mod, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>${escape(`${mod.title} — example notes`)}</title>
    <style>${stylesheet(mod)}</style></head><body>${body}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Printing                                                            */

function findBrowser() {
  const named = process.env.NOTES_BROWSER;
  if (named) {
    if (!existsSync(named)) throw new Error(`NOTES_BROWSER points at ${named}, which does not exist`);
    return named;
  }
  const found = (BROWSERS[process.platform] ?? []).find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("no Chromium-based browser found — set NOTES_BROWSER to Chrome or Edge");
  }
  return found;
}

const countPages = (file) =>
  (readFileSync(file).toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

/**
 * Print one page to PDF.
 *
 * `profile` is a browser profile directory, and it is never the user's own.
 * Without one, a headless Chromium on Windows hands the job to whatever browser
 * window is already open, and no PDF appears.
 */
async function print(browser, profile, workdir, name, html) {
  const source = path.join(workdir, `${name}.html`);
  const target = path.join(workdir, `${name}.pdf`);
  writeFileSync(source, html);
  await run(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--no-pdf-header-footer",
      `--print-to-pdf=${target}`,
      pathToFileURL(source).href,
    ],
    { timeout: 120_000 },
  );
  if (!existsSync(target)) throw new Error(`${name}: the browser did not write a PDF`);
  return target;
}

/**
 * Run jobs a few at a time. Each worker keeps one profile for all its jobs:
 * setting up a fresh profile is most of what a headless start costs, and two
 * browsers cannot share one.
 */
async function pool(workdir, jobs, width = 6) {
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, jobs.length) }, async () => {
      const profile = mkdtempSync(path.join(workdir, "profile-"));
      while (next < jobs.length) {
        const index = next++;
        results[index] = await jobs[index](profile);
      }
    }),
  );
  return results;
}

async function buildModule(browser, mod, keep = false) {
  const workdir = mkdtempSync(path.join(tmpdir(), `notes-${mod.slug}-`));
  try {
    /* Pass one: each part alone, to count its pages. Parts start on a new page
       in the whole document too, so the counts add up to where each begins. */
    const sheet = [];
    const lessonParts = mod.lessons.map((lesson, index) => lessonPart(mod, lesson, index, sheet));
    const coverDraft = coverPart(mod, null);
    const sheetHtml = sheetPart(mod, sheet);

    const counts = await pool(workdir, [
      async (profile) => countPages(await print(browser, profile, workdir, "cover", page(mod, coverDraft))),
      ...lessonParts.map(
        (part, index) => async (profile) =>
          countPages(await print(browser, profile, workdir, `lesson-${index + 1}`, page(mod, part))),
      ),
      async (profile) => countPages(await print(browser, profile, workdir, "sheet", page(mod, sheetHtml))),
    ]);

    const [coverPages, ...rest] = counts;
    const sheetPages = rest.pop();
    const lessons = [];
    let at = coverPages + 1;
    for (const pages of rest) {
      lessons.push(at);
      at += pages;
    }
    const pages = { lessons, sheet: at };
    const expected = at + sheetPages - 1;

    /* Pass two: the whole thing, contents filled in. */
    const whole = page(mod, [coverPart(mod, pages), ...lessonParts, sheetHtml].join("\n"));
    const [printed] = await pool(workdir, [(profile) => print(browser, profile, workdir, "notes", whole)], 1);
    const total = countPages(printed);
    if (total !== expected) {
      throw new Error(`${mod.slug}: printed ${total} pages, but the parts add up to ${expected}`);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const target = path.join(OUT_DIR, `${mod.slug}.pdf`);
    writeFileSync(target, readFileSync(printed));
    return {
      slug: mod.slug,
      title: `${mod.title} — example notes`,
      href: `/notes/${mod.slug}.pdf`,
      pages: total,
      bytes: statSync(target).size,
      lessonPages: pages.lessons,
      sheetPage: pages.sheet,
      formulas: sheet.length,
    };
  } finally {
    /* --keep leaves each part's HTML and PDF behind, for checking where a page breaks. */
    if (keep) console.log(`${mod.slug}: parts kept in ${workdir}`);
    else rmSync(workdir, { recursive: true, force: true });
  }
}

/** Typeset everything without printing: catches a bad formula in seconds. */
function check(modules) {
  for (const mod of modules) {
    const sheet = [];
    const parts = mod.lessons.map((lesson, index) => lessonPart(mod, lesson, index, sheet));
    page(mod, [coverPart(mod, null), ...parts, sheetPart(mod, sheet)].join("\n"));
    console.log(`${mod.slug}: ${mod.lessons.length} lessons, ${sheet.length} key formulas — typesets`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((arg) => !arg.startsWith("--"));
  const chosen = only.length ? MODULES.filter((mod) => only.includes(mod.slug)) : MODULES;
  if (!chosen.length) throw new Error(`no module called ${only.join(", ")}`);
  if (args.includes("--check")) {
    check(chosen);
    return;
  }
  const browser = findBrowser();

  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  for (const mod of chosen) {
    const started = Date.now();
    const entry = await buildModule(browser, mod, args.includes("--keep"));
    manifest[mod.slug] = entry;
    console.log(
      `${mod.slug}: ${entry.pages} pages, ${(entry.bytes / 1024).toFixed(0)} KB, lessons at ${entry.lessonPages.join(", ")}, sheet at ${entry.sheetPage} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
    );
  }

  const ordered = Object.fromEntries(
    MODULES.filter((mod) => manifest[mod.slug]).map((mod) => [mod.slug, manifest[mod.slug]]),
  );
  writeFileSync(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
