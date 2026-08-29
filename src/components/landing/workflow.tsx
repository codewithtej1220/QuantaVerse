import { Zone } from "@/components/three/stage";

/**
 * The workflow section.
 *
 * Every quantum computation has exactly three stages — prepare a state, evolve
 * it with unitaries, measure it — and so does every lesson on this platform.
 * The section is therefore drawn as one circuit diagram split into three
 * regions, and the prose blocks sit underneath the region they describe. The
 * structure is the content: no invented 01 / 02 / 03 numbering needed, because
 * the stages already have names the subject uses.
 *
 * The block turning alongside the heading is the H in the diagram, milled out
 * of steel. It completes most of a revolution as the section crosses the
 * viewport, so by the time the diagram is centred the face is square on.
 */

const WIRES = [56, 104, 152] as const;
const WIRE_START = 34;
const WIRE_END = 880;

const COPPER = "#2fe4ff";
const CHALK = "#ffffff";
const STEEL = "#8e8e89";
const WIRE = "#3d3d3d";
const CHASSIS = "#0b0b0b";

function GateBox({
  x,
  y,
  label,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  tone: string;
}) {
  return (
    <g>
      <rect
        x={x - 16}
        y={y - 16}
        width={32}
        height={32}
        fill={CHASSIS}
        stroke={tone}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={600}
        fill={tone}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </text>
    </g>
  );
}

function Cnot({ x, control, target }: { x: number; control: number; target: number }) {
  return (
    <g stroke={COPPER} strokeWidth={1.6} strokeLinecap="round">
      <line x1={x} y1={control} x2={x} y2={target} />
      <circle cx={x} cy={control} r={5} fill={COPPER} stroke="none" />
      <circle cx={x} cy={target} r={10.5} fill={CHASSIS} />
      <line x1={x - 10.5} y1={target} x2={x + 10.5} y2={target} />
      <line x1={x} y1={target - 10.5} x2={x} y2={target + 10.5} />
    </g>
  );
}

const STAGES = [
  {
    stage: "Prepare",
    ket: "|ψ₀⟩",
    heading: "Set the state you are studying",
    body: "A lesson opens with the state it is about, not with a wall of notation. Drag a Hadamard onto a wire and the sphere in the hero moves the same way yours will.",
  },
  {
    stage: "Evolve",
    ket: "U|ψ₀⟩",
    heading: "Wire gates until it does something",
    body: "Build in the sandbox and read the Qiskit it compiles to, line for line. When a circuit misbehaves the tutor reads the same diagram you are looking at.",
  },
  {
    stage: "Measure",
    ket: "⟨ψ|M|ψ⟩",
    heading: "Run it, then explain the histogram",
    body: "1,024 shots, locally simulated. A module only counts as mastered once you can predict the distribution before you press run.",
  },
] as const;

export function Workflow() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 lg:px-10 lg:py-32">
      <div className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <header>
          <p className="eyebrow">Three stages, every time</p>
          <h2 className="display-2 mt-5 max-w-2xl text-paper">
            A quantum computation has three stages. So does every lesson here.
          </h2>
        </header>
        <Zone
          id="workflow-gate"
          focus="gate"
          scale={1.45}
          className="h-[16rem] w-full lg:h-[20rem]"
        />
      </div>

      {/* The diagram is decorative in the accessibility tree — the prose below
          carries the same information in text. */}
      <div className="panel mt-14">
        <div className="overflow-x-auto px-4 py-7 sm:px-8">
          <svg
            viewBox="0 0 900 190"
            className="h-[190px] w-full min-w-[680px]"
            role="img"
            aria-label="A three-qubit circuit split into prepare, evolve and measure regions."
          >
            {/* Region boundaries at exact thirds, matched by the grid below. */}
            {[300, 600].map((x) => (
              <line
                key={x}
                x1={x}
                y1={6}
                x2={x}
                y2={184}
                stroke="#262626"
                strokeWidth={1}
              />
            ))}

            {(["Prepare", "Evolve", "Measure"] as const).map((label, i) => (
              <text
                key={label}
                x={150 + i * 300}
                y={20}
                textAnchor="middle"
                fontSize={11}
                letterSpacing="2.6"
                fill={STEEL}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {label.toUpperCase()}
              </text>
            ))}

            {/* Wires and their qubit labels. */}
            {WIRES.map((y, i) => (
              <g key={y}>
                <text
                  x={2}
                  y={y}
                  dominantBaseline="central"
                  fontSize={12}
                  fill={STEEL}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  q{i}
                </text>
                <line x1={WIRE_START} y1={y} x2={WIRE_END} y2={y} stroke={WIRE} strokeWidth={1.5} />
              </g>
            ))}

            {/* Travelling amplitudes, staggered so the wires read as one system. */}
            {WIRES.map((y, i) => (
              <g
                key={`pulse-${y}`}
                className="animate-wire"
                style={{ animationDelay: `${i * 0.45}s` }}
              >
                <circle cx={WIRE_START} cy={y} r={3.2} fill={COPPER} />
              </g>
            ))}

            {/* Prepare: a Hadamard on the control wire. */}
            <GateBox x={150} y={WIRES[0]} label="H" tone={COPPER} />

            {/* Evolve: entangle down the register, then add a phase. */}
            <Cnot x={370} control={WIRES[0]} target={WIRES[1]} />
            <Cnot x={455} control={WIRES[1]} target={WIRES[2]} />
            <GateBox x={545} y={WIRES[0]} label="Z" tone={CHALK} />

            {/* Measure: collapse all three onto the classical register. */}
            {WIRES.map((y) => (
              <GateBox key={`m-${y}`} x={750} y={y} label="M" tone={STEEL} />
            ))}
            <line
              x1={750}
              y1={WIRES[2] + 16}
              x2={750}
              y2={175}
              stroke={STEEL}
              strokeWidth={1}
            />
            <line x1={WIRE_START} y1={175} x2={WIRE_END} y2={175} stroke={STEEL} strokeWidth={1} />
            <line x1={WIRE_START} y1={179} x2={WIRE_END} y2={179} stroke={STEEL} strokeWidth={1} />
            <text
              x={WIRE_END - 2}
              y={167}
              textAnchor="end"
              fontSize={12}
              fill={STEEL}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              c3
            </text>
          </svg>
        </div>

        <div className="grid divide-y divide-edge border-t border-edge lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {STAGES.map((stage) => (
            <div key={stage.stage} className="px-6 py-8 sm:px-8">
              <div className="flex items-baseline gap-3">
                <span className="eyebrow text-photon">{stage.stage}</span>
                <span className="math text-[13px] text-dim">{stage.ket}</span>
              </div>
              <h3 className="mt-4 text-[1.375rem] text-paper">{stage.heading}</h3>
              <p className="body-text mt-3">{stage.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
