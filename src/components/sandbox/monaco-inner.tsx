"use client";

import Editor from "@monaco-editor/react";

/**
 * Monaco, themed to the site rather than to VS Code.
 *
 * Isolated in its own module so the sandbox page can load it with
 * `next/dynamic` — the editor is by far the heaviest thing on the route and must
 * not delay the circuit workspace next to it.
 */
export default function MonacoInner({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Editor
      value={value}
      language="python"
      theme="quantaverse"
      onChange={(next) => onChange(next ?? "")}
      loading={
        <pre className="w-full overflow-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed text-frost">
          {value}
        </pre>
      }
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("quantaverse", {
          base: "vs-dark",
          inherit: true,
          /* Four values, not seven colours. Copper marks the language's own
             words, white is what the author named, silver is a literal and
             steel is anything the interpreter ignores. A learner reading
             Qiskit for the first time gets structure out of the colour
             instead of a fruit salad. */
          rules: [
            { token: "comment", foreground: "7a7a75", fontStyle: "italic" },
            { token: "keyword", foreground: "2fe4ff" },
            { token: "keyword.flow", foreground: "2fe4ff" },
            { token: "string", foreground: "a8a8a3" },
            { token: "number", foreground: "a8a8a3" },
            { token: "identifier", foreground: "f2f2ef" },
            { token: "type", foreground: "f2f2ef" },
            { token: "delimiter", foreground: "8e8e89" },
          ],
          colors: {
            "editor.background": "#000000",
            "editor.foreground": "#f2f2ef",
            "editorLineNumber.foreground": "#262626",
            "editorLineNumber.activeForeground": "#2fe4ff",
            "editor.lineHighlightBackground": "#0b0b0b",
            "editor.selectionBackground": "#262626",
            "editorCursor.foreground": "#2fe4ff",
            "editorIndentGuide.background1": "#151515",
            "editorWidget.background": "#0b0b0b",
            "scrollbarSlider.background": "#26262688",
            "scrollbarSlider.hoverBackground": "#3d3d3daa",
          },
        });
      }}
      options={{
        fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "phase",
        wordWrap: "on",
        tabSize: 4,
        automaticLayout: true,
        overviewRulerLanes: 0,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        guides: { indentation: true },
      }}
    />
  );
}
