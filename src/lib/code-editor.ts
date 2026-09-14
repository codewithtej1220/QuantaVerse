"use client";

import type { OnMount } from "@monaco-editor/react";

import type { CodeIssue } from "@/lib/code-check";

/**
 * The one Monaco instance on the page, reachable from outside the pane.
 *
 * The editor is loaded behind `next/dynamic` inside the code pane, three
 * components down from the studio that knows what is wrong with the code — and
 * the cat that needs to fly to the line lives in the root layout, further away
 * still. Threading a ref through all of that would couple four components to a
 * library only one of them should know about. So the instance registers itself
 * here on mount, the same module-record trick `mascot.ts` plays, and everything
 * else asks it questions in terms of lines.
 */

type Editor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

let instance: {
  editor: Editor;
  monaco: Monaco;
  lines: ReturnType<Editor["createDecorationsCollection"]>;
} | null = null;

const OWNER = "quantaverse";

export function registerEditor(editor: Editor, monaco: Monaco) {
  instance = { editor, monaco, lines: editor.createDecorationsCollection() };
  editor.onDidDispose(() => {
    if (instance?.editor === editor) instance = null;
  });
}

/** The line the caret is on, so a half-typed line is not reported mid-keystroke. */
export function caretLine(): number | null {
  return instance?.editor.getPosition()?.lineNumber ?? null;
}

/**
 * Mark every fault in the editor itself, with a squiggle under each.
 *
 * The markers are Monaco's own, so the hover over a squiggle carries the same
 * sentence the cat does — somebody who never looks at the cat still gets it, and
 * gets it for every line, not only the one the cat happens to be beside.
 */
export function markCode(issues: CodeIssue[]) {
  if (!instance) return;
  const { editor, monaco } = instance;
  const model = editor.getModel();
  if (!model) return;
  const count = model.getLineCount();

  monaco.editor.setModelMarkers(
    model,
    OWNER,
    issues
      .filter((issue) => issue.line <= count)
      .map((issue) => ({
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: issue.line,
        startColumn: issue.startColumn,
        endLineNumber: issue.line,
        endColumn: Math.max(issue.endColumn, issue.startColumn + 1),
        message: `${issue.message}\n${issue.fix}`,
        source: "QuantaVerse",
      })),
  );
}

/** A wash across the line the cat is pointing at, or across none. */
export function washLine(line: number | null) {
  if (!instance) return;
  const { editor, monaco, lines } = instance;
  const model = editor.getModel();
  if (!model || line === null || line < 1 || line > model.getLineCount()) {
    lines.clear();
    return;
  }
  lines.set([
    {
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: "qv-fault-line" },
    },
  ]);
}

/**
 * Where a line is on screen right now.
 *
 * Measured from the text rather than the row: the rectangle runs from the start
 * of the code to the end of what is typed, so a cat parking beside it parks in
 * the empty space after the statement instead of on top of the next one. A line
 * scrolled out of the editor's own view is pinned to the nearer edge, so the cat
 * still sits at the side of the pane the fault is past.
 */
export function locateLine(line: number): DOMRect | null {
  if (!instance) return null;
  const { editor } = instance;
  const model = editor.getModel();
  const dom = editor.getDomNode();
  if (!model || !dom || line < 1 || line > model.getLineCount()) return null;

  const box = dom.getBoundingClientRect();
  if (!box.width || !box.height) return null;

  const start = editor.getScrolledVisiblePosition({
    lineNumber: line,
    column: 1,
  });
  const end = editor.getScrolledVisiblePosition({
    lineNumber: line,
    column: model.getLineMaxColumn(line),
  });
  if (!start || !end) return null;

  const layout = editor.getLayoutInfo();
  const left = box.left + Math.max(start.left, layout.contentLeft);
  const right = Math.max(box.left + end.left, left + 24);
  const top = Math.min(
    Math.max(box.top + start.top, box.top),
    box.bottom - start.height,
  );
  return new DOMRect(left, top, right - left, start.height);
}

/** The editor as a whole, for a fault that belongs to the program rather than a line. */
export function locateEditor(): DOMRect | null {
  const dom = instance?.editor.getDomNode();
  if (!dom) return null;
  const box = dom.getBoundingClientRect();
  if (!box.width) return null;
  /* The top-left of the text, not the middle of the pane: a cat parked in the
     centre of the editor would be sitting on the program it came to talk about. */
  return new DOMRect(box.left + 48, box.top + 16, 40, 22);
}

/** Bring a line into view, for when the reader opens the notification about it. */
export function revealLine(line: number) {
  instance?.editor.revealLineInCenterIfOutsideViewport(line);
}
