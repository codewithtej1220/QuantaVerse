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
        <pre className="w-full overflow-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed text-frost/70">
          {value}
        </pre>
      }
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("quantaverse", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "comment", foreground: "5a6b96", fontStyle: "italic" },
            { token: "keyword", foreground: "b14eff" },
            { token: "keyword.flow", foreground: "b14eff" },
            { token: "string", foreground: "38e8ff" },
            { token: "number", foreground: "ff4d9d" },
            { token: "identifier", foreground: "eaf1ff" },
            { token: "type", foreground: "6ee7ff" },
            { token: "delimiter", foreground: "8fa2cf" },
          ],
          colors: {
            "editor.background": "#05080f",
            "editor.foreground": "#eaf1ff",
            "editorLineNumber.foreground": "#2c3968",
            "editorLineNumber.activeForeground": "#38e8ff",
            "editor.lineHighlightBackground": "#0a1020",
            "editor.selectionBackground": "#1b2555",
            "editorCursor.foreground": "#38e8ff",
            "editorIndentGuide.background1": "#141d3d",
            "editorWidget.background": "#0a0f22",
            "scrollbarSlider.background": "#1b255588",
            "scrollbarSlider.hoverBackground": "#2a3a70aa",
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
