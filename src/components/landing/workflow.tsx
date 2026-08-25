/**
 * The workflow section.
 *
 * Every quantum computation has exactly three stages — prepare a state, evolve
 * it with unitaries, measure it — and so does every lesson on this platform.
 * The section is therefore drawn as one circuit diagram split into three
 * regions, and the prose blocks sit underneath the region they describe. The
 * structure is the content: no invented 01 / 02 / 03 numbering needed, because
 * the stages already have names the subject uses.
 */

const WIRES = [56, 104, 152] as const;
const WIRE_START = 34;
const WIRE_END = 880;

const PHOTON = "#38e8ff";
const PHASE = "#b14eff";
const COLLAPSE = "#ff4d9d";

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
        x={x - 15}
        y={y - 15}
        width={30}
        height={30}
        rx={7}
        fill="#080d1c"
        stroke={tone}
        strokeWidth={1.3}
      />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13.5}
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
    <g stroke={PHOTON} strokeWidth={1.4} strokeLinecap="round">
      <line x1={x} y1={control} x2={x} y2={target} />
      <circle cx={x} cy={control} r={4.6} fill={PHOTON} stroke="none" />
      <circle cx={x} cy={target} r={10} fill="#080d1c" />
      <line x1={x - 10} y1={target} x2={x + 10} y2={target} />
      <line x1={x} y1={target - 10} x2={x} y2={target + 10} />
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
    <section className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
      <header className="max-w-2xl">
        <p className="eyebrow">Three stages, every time</p>
        <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
          A quantum computation has three stages. So does every lesson here.
        </h2>
      </header>

      {/* The diagram is decorative in the accessibility tree — the prose below
          carries the same information in text. */}
      <div className="glass mt-12 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto px-4 py-6 sm:px-8 sm:py-8">
          <svg
            viewBox="0 0 900 190"
            className="h-[190px] w-full min-w-[680px]"
            role="img"
            aria-label="A three-qubit circuit split into prepare, evolve and measure regions."
          >
            <defs>
              <linearGradient id="wf-wire" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4a63b8" stopOpacity="0.15" />
                <stop offset="18%" stopColor="#6f8bd8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#6f8bd8" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Region boundaries at exact thirds, matched by the grid below. */}
            {[300, 600].map((x) => (
              <line
                key={x}
                x1={x}
                y1={6}
                x2={x}
                y2={184}
                stroke="#6f8bd8"
                strokeOpacity={0.22}
                strokeWidth={1}
                strokeDasharray="3 6"
              />
            ))}

            {(["Prepare", "Evolve", "Measure"] as const).map((label, i) => (
              <text
                key={label}
                x={150 + i * 300}
                y={20}
                textAnchor="middle"
                fontSize={9.5}
                letterSpacing="3.4"
                fill="#afc0e8"
                fillOpacity={0.7}
                style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
              >
                {label.toUpperCase()}
              </text>
            ))}

            {/* Wires and their qubit labels. */}
            {WIRES.map((y, i) => (
              <g key={y}>
                <text
                  x={4}
                  y={y}
                  dominantBaseline="central"
                  fontSize={11}
                  fill="#afc0e8"
                  fillOpacity={0.55}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  q{i}
                </text>
                <line
                  x1={WIRE_START}
                  y1={y}
                  x2={WIRE_END}
                  y2={y}
                  stroke="url(#wf-wire)"
                  strokeWidth={1.2}
                />
              </g>
            ))}

            {/* Travelling amplitudes, staggered so the wires read as one system. */}
            {WIRES.map((y, i) => (
              <g
                key={`pulse-${y}`}
                className="animate-wire"
                style={{ animationDelay: `${i * 0.45}s` }}
              >
                <circle cx={WIRE_START} cy={y} r={9} fill={PHOTON} fillOpacity={0.13} />
                <circle cx={WIRE_START} cy={y} r={2.6} fill={PHOTON} />
              </g>
            ))}

            {/* Prepare: a Hadamard on the control wire. */}
            <GateBox x={150} y={WIRES[0]} label="H" tone={PHOTON} />

            {/* Evolve: entangle down the register, then add a phase. */}
            <Cnot x={370} control={WIRES[0]} target={WIRES[1]} />
            <Cnot x={455} control={WIRES[1]} target={WIRES[2]} />
            <GateBox x={545} y={WIRES[0]} label="Z" tone={PHASE} />

            {/* Measure: collapse all three onto the classical register. */}
            {WIRES.map((y) => (
              <GateBox key={`m-${y}`} x={750} y={y} label="M" tone={COLLAPSE} />
            ))}
            <line
              x1={750}
              y1={WIRES[2] + 15}
              x2={750}
              y2={176}
              stroke={COLLAPSE}
              strokeOpacity={0.45}
              strokeWidth={1}
            />
            <line
              x1={WIRE_START}
              y1={176}
              x2={WIRE_END}
              y2={176}
              stroke={COLLAPSE}
              strokeOpacity={0.28}
              strokeWidth={2.4}
            />
            <line
              x1={WIRE_START}
              y1={180}
              x2={WIRE_END}
              y2={180}
              stroke={COLLAPSE}
              strokeOpacity={0.28}
              strokeWidth={1}
            />
            <text
              x={WIRE_END - 2}
              y={169}
              textAnchor="end"
              fontSize={9.5}
              fill="#ff4d9d"
              fillOpacity={0.65}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              c3
            </text>
          </svg>
        </div>

        <div className="grid divide-y divide-white/6 border-t border-white/6 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {STAGES.map((stage) => (
            <div key={stage.stage} className="px-6 py-7 sm:px-8">
              <div className="flex items-baseline gap-3">
                <span className="eyebrow text-photon/85">{stage.stage}</span>
                <span className="math text-sm text-frost/60">{stage.ket}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.015em] text-paper">
                {stage.heading}
              </h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-frost/75">{stage.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
