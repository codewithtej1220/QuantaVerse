import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Single-Qubit Gates — seven lessons. */
export const lessons: Lesson[] = [
  {
    title: "The Pauli gates",
    summary: "Three gates, three axes, and the only ones that are their own inverse.",
    minutes: 9,
    body: [
      "X, Y and Z are the Pauli gates, and each one is a half-turn about its own axis of the Bloch sphere. X is the quantum NOT: it swaps the amplitudes of |0⟩ and |1⟩, taking the north pole to the south. Z leaves the probabilities alone and flips the sign of the |1⟩ amplitude. Y does both at once.",
      "All three square to the identity. Applying X twice returns the qubit exactly to where it started, and the same holds for Y and Z — which makes sense geometrically, since two half-turns about the same axis is a full turn.",
      "Z is the one worth dwelling on, because it is the first gate in this course that does nothing you can measure. Apply it to |0⟩ and the state is unchanged. Apply it to |+⟩ and you get |−⟩, which has exactly the same measurement statistics. Its effect is real and it is entirely in the phase — and it takes a Hadamard afterwards to bring that out.",
    ],
    notation: {
      lines: [
        "X = [ 0  1 ]     Y = [ 0  −i ]     Z = [ 1   0 ]",
        "    [ 1  0 ]         [ i   0 ]         [ 0  −1 ]",
        "",
        "X² = Y² = Z² = I",
      ],
    },
    practice:
      "Place a Z on q0 alone and watch the Bloch sphere: nothing moves, because |0⟩ is already on the Z axis. Now put an H in front of it.",
  },
  {
    title: "Why gates must be unitary",
    summary: "The one constraint on what a quantum gate is allowed to be.",
    minutes: 10,
    body: [
      "A gate is a matrix, but not every matrix is a gate. The rule is that it must be unitary: its conjugate transpose is its inverse. That single condition carries two consequences that between them define what quantum computing can and cannot do.",
      "The first is that lengths are preserved. A unitary matrix maps a unit vector to a unit vector, so a normalised state stays normalised and the probabilities keep summing to one. Nothing has to be renormalised after a gate, because no legal gate could break the normalisation.",
      "The second is that every gate is reversible. If U is unitary then U† undoes it exactly, so no quantum gate can destroy information the way a classical AND gate does — two inputs in, one output out, and the other input gone forever. This is why measurement is described separately from gates in every circuit diagram: it is the one operation in the model that is not reversible.",
    ],
    notation: {
      lines: ["U†U = UU† = I", "", "so   U|ψ⟩  has the same length as  |ψ⟩", "and  U†  undoes  U,  exactly"],
      caption: "Length preserved means probabilities still sum to one. Invertible means no information is lost.",
    },
  },
  {
    title: "Gates as rotations",
    summary: "Every single-qubit gate is a rotation of the sphere, and nothing else.",
    minutes: 10,
    body: [
      "Once you have the Bloch sphere and the unitarity condition, a fact falls out that makes single-qubit circuits much easier to reason about: every unitary on one qubit is a rotation of that sphere. Not an analogy, not approximately — the set of one-qubit gates and the set of rotations are the same set.",
      "So X is a 180° rotation about the X axis, Z is 180° about Z, and H is a 180° rotation about the diagonal axis halfway between X and Z, which is why it swaps those two axes and why applying it twice returns you home. Every gate you meet from here can be read as an angle and an axis.",
      "This also tells you what a single qubit cannot do. Rotations preserve length, so no sequence of gates can shorten the Bloch vector — a pure state stays pure however long the circuit. The only two things in this course that shorten it are measurement and entanglement, and the fact that gates cannot is precisely why entanglement requires two qubits.",
    ],
    notation: {
      lines: [
        "X  =  180° about x",
        "Z  =  180° about z",
        "H  =  180° about the axis halfway between x and z",
      ],
    },
    practice:
      "Build H, then X, then H on q0 and watch where the arrow lands. Two reflections about crossed axes compose into a rotation — the result is a Z.",
  },
  {
    title: "S and T — the phase gates",
    summary: "Quarter and eighth turns about the Z axis, and why T is the expensive one.",
    minutes: 10,
    body: [
      "Z is a half-turn about the Z axis. S is a quarter-turn and T is an eighth. None of them move a state along the Z axis at all — |0⟩ and |1⟩ are fixed points of all three — so like Z they are invisible in the computational basis and entirely visible once a Hadamard is applied.",
      "They compose exactly as the fractions suggest. Two T gates make an S, and two S gates make a Z, so T·T·T·T = Z and eight T gates return to the identity. That regularity is worth remembering, because a long chain of phase gates can usually be collapsed into a much shorter one before it ever reaches hardware.",
      "S is a Clifford gate and T is not, and that distinction matters more than it looks. Circuits made only of Clifford gates — H, S, CNOT and the Paulis — can be simulated efficiently on an ordinary computer, by the Gottesman–Knill theorem. Add a single T and that guarantee disappears. T is where the classical difficulty actually starts.",
    ],
    notation: {
      lines: [
        "S = [ 1  0 ]        T = [ 1     0     ]",
        "    [ 0  i ]            [ 0  e^(iπ/4) ]",
        "",
        "T² = S        S² = Z        Z² = I",
      ],
    },
    practice:
      "Build H then S on q0. The arrow moves a quarter-turn round the equator, from the X axis to the Y axis — the sandbox read-out will show ⟨ΣY⟩ = 1.",
  },
  {
    title: "Continuous rotations",
    summary: "RZ, and gates that take an angle instead of being fixed.",
    minutes: 10,
    body: [
      "Z, S and T are three fixed angles about the same axis: 180°, 90° and 45°. RZ generalises them. It takes an angle as a parameter and rotates by exactly that much, so RZ(π) is Z, RZ(π/2) is S up to a global phase, and RZ of anything else is a gate with no special name.",
      "Parameterised gates are what make variational algorithms possible. If the angle is a number you can tune, a circuit becomes a function you can optimise — which is the entire basis of the family of algorithms PennyLane was built for, and the reason that simulator describes itself as differentiable.",
      "On real hardware the continuous gate is often the primitive and the named ones are special cases, rather than the other way round. A machine may implement arbitrary Z rotations directly and synthesise everything else from them, which is one of the things a transpiler is doing when it rewrites your circuit for a specific device.",
    ],
    notation: {
      lines: ["RZ(θ) = [ e^(−iθ/2)      0     ]", "        [     0      e^(iθ/2) ]", "", "RZ(π) ≡ Z      RZ(π/2) ≡ S      RZ(π/4) ≡ T"],
      caption: "Equal up to global phase, which is why the labs compare that way.",
    },
    code: "import numpy as np\nqc.rz(np.pi / 4, 0)   # the same rotation a T gate performs",
  },
  {
    title: "Order matters",
    summary: "Gates are matrices, matrices do not commute, and circuits read left to right.",
    minutes: 9,
    body: [
      "Applying H then Z is not the same as applying Z then H. This is not a quirk of notation — it is matrix multiplication, which does not commute in general, and it is the reason a circuit is a sequence rather than a set. Two circuits with identical gate counts and identical gates can compute completely different things.",
      "Rotations make the reason obvious. Turn a globe 90° about the vertical axis and then 90° about the horizontal one, and you land somewhere quite different from doing it the other way round. Try it with a physical object once and you will never need reminding.",
      "There is one piece of notation that trips everybody at first. A circuit diagram reads left to right in time, but the matrix product is written right to left — the gate applied first sits nearest the state vector. So a diagram showing H then Z is the product Z·H. The sandbox draws time order; Qiskit's code follows the same order as the drawing, and only the matrices reverse.",
    ],
    notation: {
      lines: [
        "diagram:   |0⟩ ── H ── Z ──",
        "matrix:    Z · H |0⟩",
        "",
        "H·Z ≠ Z·H",
        "X·Z = −Z·X     (a global phase apart: the same circuit)",
      ],
    },
    practice:
      "Build H then Z, note the Bloch vector, then clear and build Z then H. The second circuit leaves the arrow somewhere else entirely.",
  },
  {
    title: "T-depth, and what a gate costs",
    summary: "Why not all gates are priced the same on real hardware.",
    minutes: 12,
    body: [
      "Counting gates is the obvious way to measure a circuit, and it is the wrong one. On hardware that corrects its own errors, Clifford gates — H, S, CNOT, the Paulis — are comparatively cheap, and T gates are dramatically more expensive, often by orders of magnitude. The reason is that fault-tolerant schemes cannot perform a T directly; they consume a specially prepared resource state to do it, and preparing those dominates the cost.",
      "So the number that actually predicts whether a circuit can run is not its depth but its T-depth: how many layers of T gates it needs. A great deal of quantum compiler research is about rewriting a circuit to use fewer of them, and an algorithm with a good gate count but a terrible T-count may simply be unrunnable.",
      "This also closes the loop on the previous lesson. T is the non-Clifford gate, so it is simultaneously what makes a circuit hard to simulate classically and what makes it expensive to run quantum-mechanically. That is not a coincidence: both are measuring the same thing, which is how far the circuit has departed from the part of quantum mechanics a classical computer can keep up with.",
    ],
    notation: {
      lines: [
        "Clifford  H, S, CNOT, X, Y, Z     cheap, classically simulable",
        "non-Clifford  T                   expensive, and where the hardness lives",
      ],
    },
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What does the X gate do?",
      options: [
        "Flips the phase of |1⟩",
        "Swaps the |0⟩ and |1⟩ amplitudes",
        "Creates a superposition",
        "Measures the qubit",
      ],
      answer: 1,
      because: "It is the quantum NOT — a half-turn about the X axis, taking the north pole to the south.",
    },
    {
      prompt: "What is X·X?",
      options: ["X", "The identity", "Z", "H"],
      answer: 1,
      because: "All three Paulis square to the identity. Two half-turns about one axis is a full turn.",
    },
    {
      prompt: "Apply Z to |0⟩. What happens?",
      options: ["It becomes |1⟩", "It becomes |+⟩", "Nothing changes", "It is measured"],
      answer: 2,
      because: "|0⟩ sits on the Z axis, so a rotation about that axis leaves it exactly where it is.",
    },
    {
      prompt: "Apply Z to |+⟩. What do the measurement statistics become?",
      options: ["Certain 0", "Certain 1", "Unchanged at 50/50", "75/25"],
      answer: 2,
      because:
        "Unchanged. Z turns |+⟩ into |−⟩, whose effect is entirely in the phase — it takes an H afterwards to reveal it.",
    },
  ],
  [
    {
      prompt: "What is the condition for a matrix to be a legal quantum gate?",
      options: ["It is square", "It is unitary", "It is real", "Its entries are below one"],
      answer: 1,
      because: "Unitary: its conjugate transpose is its inverse. Everything else follows from that.",
    },
    {
      prompt: "What does unitarity guarantee about the state's length?",
      options: [
        "It shrinks slightly each gate",
        "It is preserved, so probabilities still sum to one",
        "It grows with circuit depth",
        "It is only preserved for Clifford gates",
      ],
      answer: 1,
      because: "A unitary maps unit vectors to unit vectors, so nothing ever needs renormalising after a gate.",
    },
    {
      prompt: "Are quantum gates reversible?",
      options: [
        "No, like classical AND",
        "Yes — U† undoes U exactly",
        "Only the Pauli gates",
        "Only on a simulator",
      ],
      answer: 1,
      because: "Every unitary has an inverse, so no gate can destroy information.",
    },
    {
      prompt: "Which operation in the model is NOT reversible?",
      options: ["The Hadamard", "The CNOT", "Measurement", "The T gate"],
      answer: 2,
      because: "Measurement. That is exactly why it is drawn and described separately from the gates.",
    },
  ],
  [
    {
      prompt: "Every single-qubit unitary is:",
      options: [
        "A rotation of the Bloch sphere",
        "A reflection",
        "A scaling",
        "A projection",
      ],
      answer: 0,
      because: "The two sets are the same set. Every one-qubit gate is an angle about an axis.",
    },
    {
      prompt: "H is a 180° rotation about which axis?",
      options: ["x", "z", "y", "The diagonal halfway between x and z"],
      answer: 3,
      because: "Which is why it swaps the X and Z axes, and why applying it twice returns you home.",
    },
    {
      prompt: "Can any sequence of single-qubit gates shorten the Bloch vector?",
      options: [
        "Yes, with enough gates",
        "No — rotations preserve length",
        "Only a T gate can",
        "Only on hardware",
      ],
      answer: 1,
      because:
        "Rotations preserve length, so a pure state stays pure. Only measurement and entanglement shorten it.",
    },
    {
      prompt: "Why does entanglement require two qubits?",
      options: [
        "Because a single qubit cannot be put into superposition",
        "Because one-qubit gates only rotate an arrow, and a shortened arrow needs a correlation with another qubit",
        "Because the CNOT symbol happens to have two ends",
        "It does not — one qubit can be entangled alone",
      ],
      answer: 1,
      because:
        "A shrunken arrow means the information is in a correlation, and a correlation needs something to correlate with.",
    },
  ],
  [
    {
      prompt: "S is a rotation about the Z axis of:",
      options: ["45°", "90°", "180°", "360°"],
      answer: 1,
      because: "A quarter turn. Z is the half turn and T is the eighth.",
    },
    {
      prompt: "What is T·T?",
      options: ["Z", "S", "The identity", "H"],
      answer: 1,
      because: "Two eighth-turns make a quarter turn, which is S. Two S make a Z, and two Z make the identity.",
    },
    {
      prompt: "Which of these is NOT a Clifford gate?",
      options: ["H", "S", "CNOT", "T"],
      answer: 3,
      because: "T is the non-Clifford one, and that single fact is where the classical difficulty begins.",
    },
    {
      prompt: "What does the Gottesman–Knill theorem say about Clifford-only circuits?",
      options: [
        "They are faster on hardware",
        "They can be simulated efficiently on a classical computer",
        "They cannot be measured",
        "They need no error correction",
      ],
      answer: 1,
      because:
        "Efficiently simulable classically. Adding a single T destroys that guarantee — which is the point of T.",
    },
  ],
  [
    {
      prompt: "What does RZ take that Z does not?",
      options: ["A second qubit", "An angle", "A classical bit", "A measurement result"],
      answer: 1,
      because: "An angle. Z, S and T are three fixed angles about the same axis; RZ is any of them.",
    },
    {
      prompt: "RZ(π) is equivalent to:",
      options: ["H", "Z", "S", "T"],
      answer: 1,
      because: "A half turn about Z, which is exactly what Z does — up to global phase.",
    },
    {
      prompt: "Why do parameterised gates matter for variational algorithms?",
      options: [
        "They are faster",
        "They make the circuit a function you can tune and optimise",
        "They need fewer qubits",
        "They avoid measurement",
      ],
      answer: 1,
      because:
        "An angle you can adjust turns a circuit into something differentiable — which is what PennyLane was built around.",
    },
    {
      prompt: "On real hardware, the relationship is often:",
      options: [
        "Named gates are primitive, RZ is synthesised",
        "RZ is primitive and the named gates are special cases of it",
        "Neither is available",
        "Only H is primitive",
      ],
      answer: 1,
      because:
        "Many machines implement arbitrary Z rotations directly, which is part of what a transpiler is rewriting for.",
    },
  ],
  [
    {
      prompt: "Is H·Z the same as Z·H?",
      options: ["Yes", "No", "Only on |0⟩", "Only up to global phase"],
      answer: 1,
      because:
        "No, not even up to a phase: H then Z leaves |0⟩ at |−⟩, Z then H leaves it at |+⟩. Careful with X and Z, though — X·Z = −Z·X, a global phase apart, so those two orders are physically the same circuit.",
    },
    {
      prompt: "A circuit diagram shows H and then Z. The matrix product is:",
      options: ["H · Z", "Z · H", "Either", "H + Z"],
      answer: 1,
      because:
        "Z · X. The diagram reads left to right in time, but the gate applied first sits nearest the state vector.",
    },
    {
      prompt: "Two circuits with identical gates in a different order:",
      options: [
        "Always compute the same thing",
        "Can compute completely different things",
        "Differ only by global phase",
        "Cannot both be valid",
      ],
      answer: 1,
      because: "Order is the whole content of a circuit. Same gates, different sequence, different operation.",
    },
    {
      prompt: "Why is the rotation picture a good intuition for this?",
      options: [
        "Rotations always commute",
        "Turning an object about two different axes gives a different result depending on the order",
        "Rotations are not matrices",
        "It is only a loose analogy",
      ],
      answer: 1,
      because: "Try it with a physical object once and non-commutativity stops being abstract.",
    },
  ],
  [
    {
      prompt: "On fault-tolerant hardware, which is dramatically more expensive?",
      options: ["H", "CNOT", "T", "X"],
      answer: 2,
      because:
        "T, often by orders of magnitude. Fault-tolerant schemes consume a prepared resource state to perform one.",
    },
    {
      prompt: "Which number best predicts whether a circuit can actually run?",
      options: ["Total gate count", "Qubit count", "T-depth", "Number of measurements"],
      answer: 2,
      because:
        "T-depth. A circuit with a fine gate count and a terrible T-count may simply be unrunnable.",
    },
    {
      prompt: "T is both hard to simulate classically and expensive to run quantumly. Why?",
      options: [
        "Coincidence",
        "Both measure how far the circuit has left the classically-tractable part of the theory",
        "Because it is the slowest gate",
        "Because it uses more qubits",
      ],
      answer: 1,
      because: "The two costs are measuring the same departure, which is why they track each other.",
    },
    {
      prompt: "What is a lot of quantum compiler research trying to reduce?",
      options: [
        "The number of qubits",
        "The number of T gates",
        "The number of measurements",
        "The circuit width",
      ],
      answer: 1,
      because: "Rewriting a circuit to need fewer T layers is one of the central problems in the field.",
    },
  ],
];
