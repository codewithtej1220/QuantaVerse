import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Quantum Entanglement — six lessons. */
export const lessons: Lesson[] = [
  {
    title: "Two qubits",
    summary: "Four amplitudes, not two — and why the space grows the way it does.",
    minutes: 9,
    body: [
      "One qubit needs two amplitudes. Two qubits need four, one for each of |00⟩, |01⟩, |10⟩ and |11⟩. Three need eight. The pattern is 2ⁿ, and it is the single most quoted fact about quantum computing — usually with the wrong conclusion attached, that a quantum computer simply tries all 2ⁿ answers at once. It does not, because a measurement returns exactly one of them.",
      "What the growth does mean is that the state of n qubits is a vector too large to write down classically once n is beyond about fifty. That is a statement about simulation cost, not about parallelism, and the distinction matters: the difficulty is in describing the state, and extracting anything useful from it still takes interference.",
      "Some two-qubit states factor into a state for each qubit separately. Those are called product states, and they are the ones where each qubit still has a state of its own. The interesting ones do not factor at all, and that is the next lesson but one.",
    ],
    notation: {
      lines: [
        "|ψ⟩ = a|00⟩ + b|01⟩ + c|10⟩ + d|11⟩",
        "|a|² + |b|² + |c|² + |d|² = 1",
        "",
        "n qubits  ->  2ⁿ amplitudes",
      ],
    },
    practice:
      "Set the sandbox to two qubits and read the state panel with an empty circuit: one amplitude at 1 on |00⟩, three at zero.",
    video: {
      url: "https://www.youtube.com/watch?v=ETkBuBdl3wc",
      minutes: 10,
      caption:
        "“2-Qubit Computational Basis States, Tensor Products, Orthonormality, 4D Hilbert Space” by Elucyda — the four basis states and the tensor product that builds them.",
    },
  },
  {
    title: "CNOT",
    summary: "The gate that makes one qubit's behaviour depend on another's.",
    minutes: 10,
    body: [
      "Every gate so far has acted on one qubit alone. CNOT acts on two: it flips the target if and only if the control is |1⟩, and leaves both alone otherwise. On basis states it is exactly the classical controlled-NOT, and if that were all it did it would not be very interesting.",
      "The interesting part is what it does to a control that is *in superposition*. Linearity means the gate acts on each term of the superposition separately, so a control that is half |0⟩ and half |1⟩ produces an output where the target is flipped in one half and not in the other — and the two halves stay in superposition together. The result is a correlation that no separate description of the two qubits can reproduce.",
      "Note which wire is which. The control is the filled dot, the target is the ring with the cross, and swapping them gives a different gate. The sandbox labels both when you place one, and getting the direction wrong is the most common way a two-qubit circuit quietly computes something else.",
    ],
    notation: {
      lines: [
        "CNOT |00⟩ = |00⟩     CNOT |10⟩ = |11⟩",
        "CNOT |01⟩ = |01⟩     CNOT |11⟩ = |10⟩",
        "",
        "control = the dot      target = the ring",
      ],
    },
    practice:
      "Place a CNOT with no H in front of it. Nothing happens — the control is |0⟩, so there is nothing to control.",
    video: {
      url: "https://www.youtube.com/watch?v=1PJonQOi5M8",
      minutes: 6,
      caption:
        "“IQIS Lecture 3.3 — Controlled-NOT” by Artur Ekert — the controlled-NOT gate, from what it does to its matrix.",
    },
  },
  {
    title: "Making a Bell pair",
    summary: "Two gates, and the smallest circuit no classical machine can imitate.",
    minutes: 10,
    body: [
      "A Hadamard on the first qubit followed by a CNOT from it to the second is the whole recipe. The H puts the control into an equal superposition; the CNOT then flips the target in the |1⟩ branch and not in the |0⟩ branch, leaving a state that is half |00⟩ and half |11⟩ — and nothing else.",
      "Read the outcome table and the strangeness is immediate. Each qubit measured alone is a perfect coin: 50/50, every time. Measured together they always agree, in every single shot, with |01⟩ and |10⟩ never appearing at all. Two fair coins that always land the same way up is not something two separate coins can do.",
      "The crucial fact is that this state cannot be factored. There is no pair of single-qubit states whose combination gives it — you can verify that by trying, and it fails on the cross terms. That non-factorability is the definition of entanglement, and it is why the next lesson is about what happens to each qubit's individual description.",
    ],
    notation: {
      lines: [
        "H on q0, then CNOT q0 -> q1",
        "",
        "|Φ+⟩ = ( |00⟩ + |11⟩ ) / √2",
        "",
        "P(00) = P(11) = 0.5      P(01) = P(10) = 0",
      ],
    },
    code: "qc = QuantumCircuit(2, 2)\nqc.h(0)\nqc.cx(0, 1)",
    practice:
      "Build it in the sandbox and watch the second Bloch arrow shrink to nothing as you place the CNOT. That collapse is the whole module in one animation.",
    video: {
      url: "https://www.youtube.com/watch?v=I0jH1_H3x1o",
      minutes: 23,
      caption:
        "“Bell States from 2-Qubit Computational Basis States via Quantum Circuit (Hadamard and CNOT Gates)” by Elucyda — H then CNOT, worked through for all four Bell states.",
    },
  },
  {
    title: "No state of your own",
    summary: "Why an entangled qubit's Bloch arrow shrinks to a point at the origin.",
    minutes: 11,
    body: [
      "Ask the sandbox for the Bloch vector of one half of a Bell pair and it gives you the origin: ⟨X⟩, ⟨Y⟩ and ⟨Z⟩ all zero, arrow length zero, labelled maximally mixed. That is not the simulator giving up. It is the correct and complete answer, and it is the sharpest statement of what entanglement is.",
      "The pair as a whole is in a perfectly definite state — you know exactly what it is, and it has no uncertainty in it at all. But neither qubit separately has a state to report. All of the information is in the correlation between them, and a description of one qubit alone simply has nowhere to put it.",
      "Partial entanglement sits in between, and the arrow's length measures it. A state that is mostly |00⟩ with a little |11⟩ leaves each qubit with a short but non-zero arrow, and the sandbox labels that too. Length one means the qubit is independent; length zero means everything it knows is shared; anything between is a mixture of the two.",
    ],
    notation: {
      lines: [
        "Bell pair, one qubit:   ⟨X⟩ = ⟨Y⟩ = ⟨Z⟩ = 0     |r| = 0",
        "product state:          |r| = 1",
        "",
        "|r| = 1  independent      |r| = 0  fully entangled",
      ],
      caption: "Arrow length is purity, and purity is what entanglement takes away from the individual.",
    },
    practice:
      "Build a Bell pair, then check q0, q1 and q2 in turn. Two arrows at the origin, and the untouched third still at full length on the north pole.",
    video: {
      url: "https://www.youtube.com/watch?v=L5HXMlpWAE8",
      minutes: 5,
      caption:
        "“IQIS Lecture 4.4 — Partial trace” by Artur Ekert — the operation that describes one half of a pair on its own.",
    },
  },
  {
    title: "Measuring one half",
    summary: "What the other qubit does, and what it does not.",
    minutes: 10,
    body: [
      "Measure one half of a Bell pair and you get 0 or 1 at random. The moment you do, the other qubit is no longer maximally mixed — it is in the matching basis state, with certainty, however far away it is. Measure the first and get 1, and the second will give 1 too, every time, without anything having travelled between them.",
      "It is worth being careful about what has changed. Before the measurement the pair was in a definite joint state and neither half had one of its own. After it, both have definite individual states and the entanglement is gone — the concurrence drops to zero, which the lab shows you directly. A measurement does not just read an entangled pair; it destroys the entanglement.",
      "This is also where the temptation to imagine sending a message appears, and the next lesson is about why it fails. For now, notice the thing that blocks it: the outcome you got was random, and you did not choose it. You have learned what the other qubit will say, but you have had no say in what it says.",
    ],
    notation: {
      lines: [
        "before:   |r| = 0 on both     concurrence 1.00",
        "measure q0 -> 1",
        "after:    q0 = |1⟩, q1 = |1⟩  concurrence 0.00",
      ],
    },
    practice:
      "In the lab, build the pair and press Measure repeatedly. The outcome alternates unpredictably, the concurrence drops to 0.00 every time, and P(|0⟩) snaps to a certainty.",
    video: {
      url: "https://www.youtube.com/watch?v=fkAAbXPEAtU",
      minutes: 10,
      caption:
        "“Quantum Entanglement: Explained in REALLY SIMPLE Words” by Science ABC — what measuring one particle of a pair tells you about the other.",
    },
  },
  {
    title: "Correlation is not communication",
    summary: "Stronger than any classical correlation, and still unable to carry a message.",
    minutes: 12,
    body: [
      "The obvious question after the last lesson is whether the correlation can be used to signal, and the answer is a flat no. The reason is precise rather than hand-waved: whatever you do to your half — measure it, rotate it, leave it — the statistics of the other half, taken on their own, are exactly 50/50 either way. Nothing you can do changes anything the other end can observe.",
      "The correlation only becomes visible when the two sets of results are brought together and compared, and doing that requires sending the results by ordinary means. Entanglement gives you a shared random variable that is more tightly correlated than anything classical physics allows, and it gives you no channel to put a message into.",
      "That \"more tightly correlated than classical\" claim is not rhetorical, and the CHSH inequality is how it is made precise. Any theory in which the two qubits carry their answers with them from the start — a hidden-variable theory — obeys a bound of 2 on a particular combination of correlations. Quantum mechanics reaches 2√2, and experiments agree with quantum mechanics. The answers were not decided in advance.",
    ],
    notation: {
      lines: [
        "any local hidden-variable theory:   |S| ≤ 2",
        "quantum mechanics:                  |S| ≤ 2√2  ≈  2.83",
        "",
        "and yet: P(other half = 0) = 0.5, whatever you do to yours",
      ],
      caption: "Stronger than classical correlation, and still not a channel.",
    },
    video: {
      url: "https://www.youtube.com/watch?v=9oBiS_Yb9Ac",
      minutes: 4,
      caption:
        "“Why Quantum Entanglement Can’t Break the Speed of Light” by Qiskit — the same argument as this lesson, in under four minutes.",
    },
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "How many amplitudes does a three-qubit state need?",
      options: ["3", "6", "8", "9"],
      answer: 2,
      because: "2ⁿ, so eight — one for each of |000⟩ through |111⟩.",
    },
    {
      prompt: "Does a quantum computer try all 2ⁿ answers at once?",
      options: [
        "Yes, that is the speed-up",
        "No — a measurement returns exactly one outcome",
        "Only with enough shots",
        "Only for Clifford circuits",
      ],
      answer: 1,
      because:
        "One outcome. The growth makes the state expensive to describe classically; getting anything useful out still takes interference.",
    },
    {
      prompt: "A two-qubit state that factors into one state per qubit is called:",
      options: ["A Bell state", "A product state", "A mixed state", "A basis state"],
      answer: 1,
      because: "A product state — the case where each qubit still has a state of its own.",
    },
    {
      prompt: "Beyond roughly fifty qubits, what becomes infeasible?",
      options: [
        "Measuring the qubits",
        "Writing the state down classically",
        "Applying gates",
        "Entangling them",
      ],
      answer: 1,
      because: "The vector is too large to store. That is a simulation-cost statement, not a parallelism one.",
    },
  ],
  [
    {
      prompt: "What does CNOT do?",
      options: [
        "Flips both qubits",
        "Flips the target if the control is |1⟩",
        "Measures the control",
        "Swaps the two qubits",
      ],
      answer: 1,
      because: "Controlled NOT — and on basis states it is exactly the classical gate of the same name.",
    },
    {
      prompt: "What makes CNOT interesting, given that on basis states it is classical?",
      options: [
        "It is faster",
        "It acts on each term of a superposed control separately, leaving them correlated",
        "It is reversible",
        "It uses fewer gates",
      ],
      answer: 1,
      because:
        "Linearity. A control in superposition produces a correlation no separate description of the two qubits can reproduce.",
    },
    {
      prompt: "In the diagram, the control is:",
      options: ["The ring with the cross", "The filled dot", "Either", "The lower wire always"],
      answer: 1,
      because: "The dot. Swapping control and target gives a different gate, and it is an easy bug to miss.",
    },
    {
      prompt: "You place a CNOT with the control still in |0⟩. What happens?",
      options: ["The target flips", "Nothing", "Both flip", "They become entangled"],
      answer: 1,
      because: "Nothing at all — there is nothing to control until the control is put into superposition.",
    },
  ],
  [
    {
      prompt: "What is the recipe for a Bell pair?",
      options: [
        "CNOT then H",
        "H on the control, then CNOT to the target",
        "Two Hadamards",
        "X then CNOT",
      ],
      answer: 1,
      because: "H first to put the control in superposition, then CNOT to correlate the target with it.",
    },
    {
      prompt: "Measuring just one qubit of a Bell pair gives:",
      options: ["Always 0", "Always 1", "50/50", "An error"],
      answer: 2,
      because: "A perfect coin. Each half alone is completely unbiased.",
    },
    {
      prompt: "Measuring both qubits of |Φ+⟩, which outcomes never appear?",
      options: ["|00⟩ and |11⟩", "|01⟩ and |10⟩", "None — all four appear", "Only |11⟩"],
      answer: 1,
      because: "They always agree. Two fair coins that always land the same way up is not a classical possibility.",
    },
    {
      prompt: "What is the formal definition of entanglement used here?",
      options: [
        "The qubits are physically close",
        "The state cannot be factored into one state per qubit",
        "The qubits were measured together",
        "The amplitudes are complex",
      ],
      answer: 1,
      because: "Non-factorability. Try to split |Φ+⟩ into two single-qubit states and it fails on the cross terms.",
    },
  ],
  [
    {
      prompt: "The Bloch vector of one half of a Bell pair is:",
      options: ["Full length on the equator", "At the origin", "At the north pole", "Undefined"],
      answer: 1,
      because: "All three expectation values are zero. It is the correct answer, not the simulator giving up.",
    },
    {
      prompt: "Is the pair as a whole uncertain?",
      options: [
        "Yes, it is random",
        "No — the joint state is perfectly definite",
        "Only after measurement",
        "Only if you measure one half",
      ],
      answer: 1,
      because:
        "You know the joint state exactly. What is missing is any state for either half on its own.",
    },
    {
      prompt: "Where is the information, if neither qubit has a state?",
      options: [
        "It has been lost",
        "In the correlation between them",
        "In the classical register",
        "In the global phase",
      ],
      answer: 1,
      because: "All of it is shared, and a description of one qubit alone has nowhere to put it.",
    },
    {
      prompt: "An arrow of length 0.5 means the qubit is:",
      options: ["Independent", "Partially entangled", "Fully entangled", "Measured"],
      answer: 1,
      because: "Between the extremes. Length one is independent, length zero is everything shared.",
    },
  ],
  [
    {
      prompt: "You measure one half of a Bell pair and get 1. The other half is now:",
      options: ["Still maximally mixed", "|1⟩ with certainty", "|0⟩ with certainty", "50/50"],
      answer: 1,
      because: "The matching basis state, with certainty, however far away it is.",
    },
    {
      prompt: "What happens to the entanglement when you measure one half?",
      options: [
        "It doubles",
        "It is unchanged",
        "It is destroyed — concurrence drops to zero",
        "It moves to the other qubit",
      ],
      answer: 2,
      because: "A measurement does not merely read an entangled pair; it ends the entanglement.",
    },
    {
      prompt: "Before the measurement, how would you describe the pair?",
      options: [
        "Both halves definite",
        "A definite joint state, with neither half having one of its own",
        "Two independent coins",
        "An error state",
      ],
      answer: 1,
      because: "That is precisely the situation the shrunken Bloch arrows were reporting.",
    },
    {
      prompt: "Why does this not obviously let you send a message?",
      options: [
        "It is too slow",
        "The outcome was random — you learned what the other will say, but had no say in it",
        "The qubits must be close together",
        "It does let you send a message",
      ],
      answer: 1,
      because: "You cannot choose the outcome, which is the thing that blocks signalling.",
    },
  ],
  [
    {
      prompt: "Whatever you do to your half, the other half's own statistics are:",
      options: ["Changed instantly", "Exactly 50/50 either way", "Correlated with your choice", "Undefined"],
      answer: 1,
      because: "Nothing you do changes anything observable at the other end. That is the no-signalling result.",
    },
    {
      prompt: "When does the correlation become visible?",
      options: [
        "Immediately, at both ends",
        "Only when the two sets of results are brought together and compared",
        "Only with enough shots",
        "Only on hardware",
      ],
      answer: 1,
      because: "And bringing them together requires an ordinary classical channel.",
    },
    {
      prompt: "What bound does any local hidden-variable theory obey in CHSH?",
      options: ["1", "2", "2√2", "4"],
      answer: 1,
      because: "2. Quantum mechanics reaches 2√2, and experiment agrees with quantum mechanics.",
    },
    {
      prompt: "What does exceeding that bound rule out?",
      options: [
        "Faster-than-light signalling",
        "That the answers were decided in advance and carried along",
        "That the qubits were entangled",
        "That measurement is random",
      ],
      answer: 1,
      because:
        "Hidden variables. The correlations are too strong for the outcomes to have been fixed from the start.",
    },
  ],
];
