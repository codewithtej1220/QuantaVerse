"use client";

import Editor from "@monaco-editor/react";

import { registerEditor } from "@/lib/code-editor";

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
      /* Registered so the studio can mark a faulty line and the cat can find
         it on screen, without either of them holding a ref into this module. */
      onMount={(editor, monaco) => registerEditor(editor, monaco)}
      loading={
        <pre className="w-full overflow-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed text-void">
          {value}
        </pre>
      }
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("quantaverse", {
          base: "vs",
          inherit: true,
          /* Four values, not seven colours. Deep teal-black is what the
             author named, a darkened site cyan marks the language's own
             words, slate is a literal and a lighter slate is anything the
             interpreter ignores. A learner reading Qiskit for the first time
             gets structure out of the colour instead of a fruit salad.

             These are the site's hues taken down to work on paper rather than
             the dark theme's inks reused. Cyan at #2fe4ff is 1.1:1 on this
             ground — invisible — so the keyword colour is that same hue driven
             down to 5.2:1. Nothing here is a Monaco default. */
          rules: [
            { token: "comment", foreground: "596e6a", fontStyle: "italic" },
            { token: "keyword", foreground: "0e6d80" },
            { token: "keyword.flow", foreground: "0e6d80" },
            { token: "string", foreground: "3f5350" },
            { token: "number", foreground: "3f5350" },
            { token: "identifier", foreground: "0f1c19" },
            { token: "type", foreground: "0f1c19" },
            { token: "delimiter", foreground: "596e6a" },
          ],
          colors: {
            /* sheet — the page's own ink value, used as a ground. The editor
               is the one light surface on the site: a sheet of paper laid on a
               dark desk, which is both what a code pane actually is and the
               only thing that gives the surrounding dark something to be dark
               against. */
            "editor.background": "#f4efe6",
            "editor.foreground": "#0f1c19",
            "editorLineNumber.foreground": "#7d918d",
            "editorLineNumber.activeForeground": "#0e6d80",
            "editor.lineHighlightBackground": "#ece5d8",
            "editor.selectionBackground": "#cfe9f0",
            "editorCursor.foreground": "#0e6d80",
            "editorIndentGuide.background1": "#ddd6c8",
            "editorWidget.background": "#fbf8f2",
            "editorWidget.border": "#ddd6c8",
            "scrollbarSlider.background": "#0f1c1926",
            "scrollbarSlider.hoverBackground": "#0f1c1944",
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
        /* The squiggle's message on hover, so a reader who never looks at the
           cat still gets the sentence it would have said. */
        hover: { enabled: "on", delay: 250 },
      }}
    />
  );
}
