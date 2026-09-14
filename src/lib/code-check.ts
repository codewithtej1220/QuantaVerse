/**
 * Mistakes in typed Qiskit that the diagram would otherwise swallow in silence.
 *
 * The sandbox's parser is forgiving on purpose: a line it cannot use is skipped,
 * so a half-typed program still draws whatever part of it makes sense. The cost
 * of that forgiveness is that nothing ever says a line was skipped. `qc.h(5)` on
 * a three-qubit register, `qc.cx(1, 1)`, `qc.H(0)`, `qc.hadamard(0)` — every one
 * of them vanishes from the board without a word, and the learner is left
 * comparing a program that plainly has a gate in it with a circuit that plainly
 * does not.
 *
 * So this reads the same text and reports exactly the lines the parser drops,
 * and why. It is deliberately narrow. It does not try to parse Python — a line
 * using a variable, a loop or a helper is somebody writing real code, and the
 * right place for that is the Build button, which runs it. Everything reported
 * here is a literal the checker can prove is wrong by looking at it, because a
 * mascot that flies across the page to complain about correct code is worse than
 * one that never moves.
 */

export type CodeIssueKind =
  | "unknown-gate"
  | "not-drawable"
  | "wire-out-of-range"
  | "same-wire"
  | "arity"
  | "unbalanced"
  | "register-mismatch";

export interface CodeIssue {
  kind: CodeIssueKind;
  /** 1-based, as the editor numbers it. */
  line: number;
  /** Where on the line, for the squiggle. 1-based columns, end exclusive. */
  startColumn: number;
  endColumn: number;
  message: string;
  fix: string;
}

/** What the board can draw, and so what the parser keeps. */
const DRAWABLE = new Set([
  "h",
  "x",
  "y",
  "z",
  "s",
  "t",
  "cx",
  "cnot",
  "measure",
  "measure_all",
]);

/** Real Qiskit the board has no gate for. Valid code, and invisible on the board. */
const REAL_BUT_UNDRAWN: Record<string, string> = {
  cz: "Rewrite it as qc.h(t), qc.cx(c, t), qc.h(t) — a controlled-Z is a CNOT between two Hadamards on the target.",
  cy: "The board has no controlled-Y. Press Build from code to run it for real, or rebuild it from S, CX and S†.",
  ch: "The board has no controlled-H. Press Build from code to run the program as written.",
  swap: "A swap is three CNOTs: qc.cx(a, b), qc.cx(b, a), qc.cx(a, b).",
  ccx: "A Toffoli needs T† gates the palette does not have. Press Build from code to run it for real.",
  cswap:
    "The board has no Fredkin gate. Press Build from code to run the program as written.",
  rx: "The board only draws fixed gates. Press Build from code to run a rotation by an arbitrary angle.",
  ry: "The board only draws fixed gates. Press Build from code to run a rotation by an arbitrary angle.",
  rz: "The board only draws fixed gates. Press Build from code to run a rotation by an arbitrary angle.",
  p: "The board only draws fixed phases — S is π/2 and T is π/4. Press Build from code for any other angle.",
  u: "The board only draws named gates. Press Build from code to run a general single-qubit unitary.",
  sdg: "The palette has no S†. Three S gates in a row are the same operation: qc.s(q) three times.",
  tdg: "The palette has no T†. Seven T gates in a row are the same operation, or press Build from code.",
  sx: "The board has no √X. Press Build from code to run it as written.",
  id: "An identity gate does nothing, so there is nothing to draw — it is safe to delete.",
  i: "An identity gate does nothing, so there is nothing to draw — it is safe to delete.",
  reset:
    "The board has no reset. Press Build from code to run the program as written.",
};

/** Calls that are fine and simply have no gate — not worth a word. */
const HARMLESS = new Set([
  "barrier",
  "draw",
  "name",
  "num_qubits",
  "depth",
  "size",
  "copy",
]);

/** Common ways to type a gate the sandbox does have. */
const ALIASES: Record<string, string> = {
  hadamard: "h",
  not: "x",
  pauli_x: "x",
  pauli_y: "y",
  pauli_z: "z",
  cnot: "cx",
  controlled_not: "cx",
  measureall: "measure_all",
  measure_al: "measure_all",
};

const WIDTH_LIMIT = 4;

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = held;
    }
  }
  return row[b.length];
}

/** The gate somebody probably meant, or null if nothing is close enough to guess. */
function nearest(name: string): string | null {
  const lower = name.toLowerCase();
  if (DRAWABLE.has(lower)) return lower === "cnot" ? "cx" : lower;
  if (ALIASES[lower]) return ALIASES[lower];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const candidate of DRAWABLE) {
    const score = distance(lower, candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  /* One edit away on a short name is a typo; two away on a one-letter gate is
     a different word. Guessing wrong is worse than not guessing. */
  const allowed = best && best.length <= 2 ? 1 : 2;
  return best && bestScore <= allowed ? best : null;
}

/** Strip a trailing comment, leaving anything inside a string alone. */
function codePart(raw: string) {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote && raw[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#") {
      return raw.slice(0, i);
    }
  }
  return raw;
}

function balance(text: string) {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
  }
  return depth;
}

/** Integer literals in a call's argument list, or null if any argument is not one. */
function literalArgs(inside: string): number[] | null {
  const parts = inside
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  const out: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    out.push(Number(part));
  }
  return out;
}

function range(qubits: number) {
  return qubits === 1 ? "q0" : `q0–q${qubits - 1}`;
}

const CALL = /^(\s*)qc\.([A-Za-z_]\w*)\s*\(/;
const REGISTER = /QuantumCircuit\s*\(\s*(\d+)/;

export function checkCode(
  code: string,
  qubits: number,
  caretLine: number | null = null,
): CodeIssue[] {
  const found: CodeIssue[] = [];

  code.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const text = codePart(raw);
    if (!text.trim()) return;

    /* The register the code declares, against the one the board is drawing. */
    const declared = REGISTER.exec(text);
    if (declared) {
      const width = Number(declared[1]);
      const start = text.indexOf(declared[0]) + 1;
      if (width > WIDTH_LIMIT) {
        found.push({
          kind: "register-mismatch",
          line,
          startColumn: start,
          endColumn: start + declared[0].length,
          message: `This declares ${width} qubits, and the sandbox board holds at most ${WIDTH_LIMIT}.`,
          fix: `Gates on q${WIDTH_LIMIT} and above will not appear on the board. Keep it to ${WIDTH_LIMIT} qubits, or press Build from code to run the full program.`,
        });
      } else if (width !== qubits) {
        found.push({
          kind: "register-mismatch",
          line,
          startColumn: start,
          endColumn: start + declared[0].length,
          message: `This declares ${width} qubits, but the board is set to ${qubits}.`,
          fix: `Switch the Qubits selector above the board to ${width}, or change this line to QuantumCircuit(${qubits}, ${qubits}), so the board and the code describe the same register.`,
        });
      }
    }

    const call = CALL.exec(text);
    if (!call) return;

    const name = call[2];
    const nameStart = call[1].length + "qc.".length + 1;
    const nameEnd = nameStart + name.length;
    const open = text.indexOf("(", call[0].length - 1);
    const close = text.lastIndexOf(")");

    /* An unclosed bracket is a syntax error, but on the line the caret is on
       it is usually just a line that is not finished being typed yet — and
       being told so mid-keystroke is the opposite of help. */
    if (balance(text) !== 0) {
      if (line === caretLine) return;
      found.push({
        kind: "unbalanced",
        line,
        startColumn: open + 1,
        endColumn: text.trimEnd().length + 1,
        message: `The brackets on this line do not close.`,
        fix: `Python will refuse to run the whole program over this, and the board has skipped the line. Check every ( has a matching ) and every [ a ].`,
      });
      return;
    }

    if (HARMLESS.has(name)) return;

    const lower = name.toLowerCase();
    if (!DRAWABLE.has(name)) {
      if (REAL_BUT_UNDRAWN[lower] && lower === name) {
        found.push({
          kind: "not-drawable",
          line,
          startColumn: nameStart,
          endColumn: nameEnd,
          message: `qc.${name} is real Qiskit, but the board has no gate for it, so this line is missing from the circuit.`,
          fix: REAL_BUT_UNDRAWN[lower],
        });
        return;
      }
      const guess = nearest(name);
      found.push({
        kind: "unknown-gate",
        line,
        startColumn: nameStart,
        endColumn: nameEnd,
        message: `qc.${name} is not a gate, so the board skipped this line.`,
        fix: guess
          ? `Did you mean qc.${guess}? Gate names are lower-case in Qiskit.`
          : `The board draws h, x, y, z, s, t, cx and measure. Anything else needs Build from code.`,
      });
      return;
    }

    if (open < 0 || close < open) return;
    const inside = text.slice(open + 1, close);
    const argStart = open + 2;
    const argEnd = close + 1;

    /* Measurement comes in three shapes; only check the literal ones. */
    if (name === "measure_all") return;
    if (name === "measure") {
      const lists = [...inside.matchAll(/\[([^\]]*)\]/g)];
      const first = lists[0]
        ? literalArgs(lists[0][1])
        : literalArgs(inside.split(",")[0] ?? "");
      if (!first) return;
      const bad = first.find((q) => q >= qubits);
      if (bad !== undefined) {
        found.push({
          kind: "wire-out-of-range",
          line,
          startColumn: argStart,
          endColumn: argEnd,
          message: `There is no q${bad} to measure — this register has ${qubits} qubits (${range(qubits)}).`,
          fix: `The board measured the wires that exist and skipped q${bad}. Measure one of ${range(qubits)} instead.`,
        });
      }
      return;
    }

    const args = literalArgs(inside);
    if (!args) return; // A variable, an expression — real code. Not ours to judge.

    const two = name === "cx" || name === "cnot";
    if (two && args.length !== 2) {
      found.push({
        kind: "arity",
        line,
        startColumn: argStart,
        endColumn: argEnd,
        message: `qc.${name} takes two qubits — a control and a target — and this passes ${args.length}.`,
        fix: `Write it as qc.cx(control, target), for example qc.cx(0, 1).`,
      });
      return;
    }
    if (!two && args.length !== 1) {
      found.push({
        kind: "arity",
        line,
        startColumn: argStart,
        endColumn: argEnd,
        message: `qc.${name} acts on one qubit, and this passes ${args.length}.`,
        fix:
          args.length > 1
            ? `Put each on its own line — ${args.map((q) => `qc.${name}(${q})`).join(", ")}.`
            : `Say which qubit, for example qc.${name}(0).`,
      });
      return;
    }

    const bad = args.find((q) => q >= qubits);
    if (bad !== undefined) {
      found.push({
        kind: "wire-out-of-range",
        line,
        startColumn: argStart,
        endColumn: argEnd,
        message: `There is no q${bad} — this register has ${qubits} qubits (${range(qubits)}), so the board skipped this gate.`,
        fix:
          bad < WIDTH_LIMIT
            ? `Use one of ${range(qubits)}, or raise the Qubits selector to ${bad + 1}.`
            : `Use one of ${range(qubits)} — the sandbox holds at most ${WIDTH_LIMIT} qubits.`,
      });
      return;
    }

    if (two && args[0] === args[1]) {
      found.push({
        kind: "same-wire",
        line,
        startColumn: argStart,
        endColumn: argEnd,
        message: `The control and the target are both q${args[0]}, so the board skipped this CNOT.`,
        fix: `A CNOT needs two different qubits: one whose state decides, one that gets flipped. Try qc.cx(${args[0]}, ${args[0] === 0 ? 1 : 0}).`,
      });
    }
  });

  return found.sort((a, b) => a.line - b.line);
}
