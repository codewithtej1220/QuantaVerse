import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Measurement & Probability — five lessons. */
export const lessons: Lesson[] = [
  {
    title: "The Born rule",
    summary: "The one line that connects a state vector to something you can actually see.",
    minutes: 8,
    body: [
      "Everything so far has been about amplitudes, which are not observable. The Born rule is the bridge: the probability of measuring a particular basis state is the squared magnitude of that state's amplitude. That is the whole rule, and it is the only place in quantum mechanics where probability enters.",
      "Two consequences follow immediately. Because it squares, the rule throws away the sign and the phase — which is why |+⟩ and |−⟩ give identical outcomes, and why you need another gate before a measurement to see the difference between them. And because the amplitudes are normalised, the probabilities always sum to one without anybody having to arrange it.",
      "It is worth being precise about what a measurement returns. Not an amplitude, not a probability, and not the state: a single classical outcome, one basis label. The probabilities are a property of the state; the outcome is one sample from them, and a single shot tells you almost nothing.",
    ],
    notation: {
      lines: ["|ψ⟩ = α|0⟩ + β|1⟩", "", "P(0) = |α|²      P(1) = |β|²"],
      caption: "Squaring is what discards the phase — and what makes |+⟩ and |−⟩ indistinguishable here.",
    },
    practice:
      "Build a single H in the sandbox and read the probability panel: 50/50 exactly, because both amplitudes are 1/√2 and squaring gives one half.",
  },
  {
    title: "Measuring changes the state",
    summary: "Why you cannot read a qubit twice and learn twice as much.",
    minutes: 9,
    body: [
      "A classical measurement is passive. You can read a byte a thousand times and get the same answer, because reading it does not touch it. A quantum measurement is not like that: the outcome you get becomes the state the qubit is in. Measure |+⟩ and get 0, and the qubit is now |0⟩ — not still |+⟩, not a mixture, but |0⟩ exactly.",
      "This is why you cannot learn a qubit's amplitudes by measuring it repeatedly. The first measurement destroys the superposition you were trying to characterise, and every measurement after it returns the same answer. To estimate the probabilities you have to prepare the state again from scratch and measure once, over and over — which is exactly what a shot count is.",
      "It also explains why measurement sits at the end of almost every circuit in this course. A measurement in the middle collapses everything downstream of it, so a gate placed after one is operating on a definite basis state rather than on the superposition the algorithm was building. Sometimes that is what you want. Usually it is a bug.",
    ],
    notation: {
      lines: [
        "|+⟩  --measure-->  0   and the state is now |0⟩",
        "                   1   and the state is now |1⟩",
        "",
        "measure again  ->  the same answer, every time",
      ],
    },
    practice:
      "In the lab, build a Bell pair and press Measure. Watch the concurrence drop from 1.00 to 0.00 and P(|0⟩) snap to 1.000 or 0.000 — the state has genuinely changed, not just been read.",
  },
  {
    title: "Shot noise",
    summary: "Why 1,024 shots of a fair circuit almost never give exactly 512 and 512.",
    minutes: 9,
    body: [
      "Run a Hadamard a thousand times and you will not see 500/500. You will see something near it — 497 and 503, 511 and 489 — and it will be different every run. This is not simulator error or hardware noise. It is what sampling a probability distribution a finite number of times looks like, and it has a name outside quantum computing too: shot noise.",
      "The size of the wobble is predictable. For N shots the standard deviation of the count is about √(N·p·(1−p)), which for a 50/50 circuit at 1,024 shots is roughly 16 — so a result between about 496 and 528 is entirely unremarkable. Quadrupling the shots halves the relative error, which is a slow and expensive way to buy precision.",
      "This is why the sandbox shows exact probabilities alongside the sampled histogram. The probabilities come from the statevector and are what the circuit means; the histogram is what a finite run of it looks like. When the two disagree slightly, the histogram is the thing that is approximate.",
    ],
    notation: {
      lines: ["σ ≈ √(N · p · (1 − p))", "", "N = 1024, p = 0.5   ->   σ ≈ 16 counts"],
      caption: "Relative error falls as 1/√N: four times the shots for half the error.",
    },
    practice:
      "Run the same single-H circuit three times in the sandbox and compare the histograms. Then compare each to the exact percentages beside them.",
  },
  {
    title: "Changing the basis",
    summary: "A measurement always asks the same question — so rotate the state before asking.",
    minutes: 10,
    body: [
      "Hardware measures in one basis: it asks whether the qubit is |0⟩ or |1⟩, and that is the only question it can ask. That seems like a serious limitation, because |+⟩ and |−⟩ both answer it 50/50 and are therefore indistinguishable by it.",
      "The trick is to rotate the state rather than the question. A Hadamard maps |+⟩ to |0⟩ and |−⟩ to |1⟩, so applying H just before the measurement turns a question about the X axis into the question the hardware can actually answer. What was a coin flip becomes a certainty.",
      "This is the shape of a great deal of quantum programming. The algorithm arranges for the answer to live in a phase, and the last gate before the measurement is the one that converts that phase into an amplitude difference the Born rule can see. Deutsch–Jozsa, later in this course, is exactly this manoeuvre applied to a whole register at once.",
    ],
    notation: {
      lines: [
        "measure |+⟩ directly      ->  50 / 50      no information",
        "apply H, then measure     ->  0 always     the state is known",
      ],
    },
    practice:
      "Build H, then Z, then H, then measure. The Z is invisible on its own; the second H converts it into a certain |1⟩.",
  },
  {
    title: "Classical registers",
    summary: "Where the outcomes go, and why the diagram has a second kind of wire.",
    minutes: 9,
    body: [
      "A measurement produces a classical bit, and that bit has to be stored somewhere. That is what the classical register is for, and it is why a circuit diagram has a double line running along the bottom: the single lines carry qubits, the double line carries ordinary bits, and a measurement is the only thing that crosses between them.",
      "When you declare a circuit as QuantumCircuit(3, 3) you are asking for three qubits and three classical bits. The measurement instruction names both ends — which qubit is being read and which classical bit catches the result. The sandbox does this for you when you place an M tile, which is why the readout is labelled with the wire it came from.",
      "The ordering convention catches people out, so it is worth stating plainly. In Qiskit the register is written with the highest-numbered qubit on the left, so a three-qubit result printed as 011 means q2 = 0, q1 = 1, q0 = 1. This course, its simulator and its histograms all follow that same convention, so a label reads the same everywhere you see it.",
    ],
    code: "qc = QuantumCircuit(3, 3)   # 3 qubits, 3 classical bits\nqc.measure([0, 1, 2], [0, 1, 2])",
    notation: {
      lines: ["|q2 q1 q0⟩", "  0  1  1     ->  printed as \"011\""],
      caption: "Highest-numbered qubit leftmost — the same order in Qiskit, the sandbox and the histogram.",
    },
    practice:
      "Place an M on two different wires in the sandbox and check which position each one moves in the histogram labels.",
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What does the Born rule say?",
      options: [
        "The probability is the amplitude",
        "The probability is the squared magnitude of the amplitude",
        "The probability is the phase",
        "The probability is the real part of the amplitude",
      ],
      answer: 1,
      because: "Squared magnitude. It is the only place probability enters the theory.",
    },
    {
      prompt: "Why do |+⟩ and |−⟩ give identical measurement statistics?",
      options: [
        "They are the same state",
        "Squaring discards the sign",
        "The hardware is imprecise",
        "They are not normalised",
      ],
      answer: 1,
      because:
        "The rule squares the magnitude, which throws away the minus sign that is the only difference between them.",
    },
    {
      prompt: "What does a single measurement return?",
      options: [
        "The amplitudes",
        "The probabilities",
        "One classical outcome",
        "The whole state vector",
      ],
      answer: 2,
      because:
        "One basis label. The probabilities belong to the state; the outcome is a single sample from them.",
    },
    {
      prompt: "Why must the probabilities always add to one?",
      options: [
        "Because the amplitudes are normalised",
        "Because there are only two of them",
        "Because the simulator rescales them",
        "They do not always add to one",
      ],
      answer: 0,
      because: "The state vector has length one, so the squared amplitudes sum to one automatically.",
    },
  ],
  [
    {
      prompt: "You measure |+⟩ and get 0. What state is the qubit in now?",
      options: ["|+⟩ still", "|0⟩", "|−⟩", "An equal mixture"],
      answer: 1,
      because: "|0⟩ exactly. The outcome becomes the state — that is what collapse means.",
    },
    {
      prompt: "You measure the same qubit again, immediately. What do you get?",
      options: ["50/50", "The same answer as before", "The opposite answer", "An error"],
      answer: 1,
      because: "The same answer, every time. The superposition is gone, so there is nothing left to sample.",
    },
    {
      prompt: "How do you estimate a circuit's output probabilities?",
      options: [
        "Measure one qubit many times",
        "Prepare the state again and measure once, repeatedly",
        "Read the amplitudes directly",
        "Measure in a different basis",
      ],
      answer: 1,
      because:
        "Re-prepare and re-measure. That is exactly what a shot count is, and why shots cost real time on hardware.",
    },
    {
      prompt: "What usually goes wrong when a gate is placed after a measurement?",
      options: [
        "Nothing — it behaves identically",
        "It operates on a collapsed basis state rather than the superposition",
        "The circuit will not compile",
        "The measurement is undone",
      ],
      answer: 1,
      because:
        "The superposition the algorithm was building is already destroyed, so the gate acts on a definite |0⟩ or |1⟩.",
    },
  ],
  [
    {
      prompt: "You run a fair circuit for 1,024 shots. Getting exactly 512/512 is:",
      options: ["Guaranteed", "Expected but not guaranteed", "Impossible", "A sign of a bug"],
      answer: 1,
      because:
        "It is the most likely single result and still uncommon. Finite sampling wobbles around the true value.",
    },
    {
      prompt: "Roughly how large is the wobble at 1,024 shots and p = 0.5?",
      options: ["About 1 count", "About 16 counts", "About 100 counts", "About 250 counts"],
      answer: 1,
      because: "√(N·p·(1−p)) ≈ 16, so anything from about 496 to 528 is unremarkable.",
    },
    {
      prompt: "You quadruple the number of shots. The relative error:",
      options: ["Quarters", "Halves", "Stays the same", "Doubles"],
      answer: 1,
      because: "Error falls as 1/√N, so four times the shots buys only half the error. Precision is expensive.",
    },
    {
      prompt: "The histogram and the exact percentages disagree slightly. Which is approximate?",
      options: [
        "The exact percentages",
        "The histogram",
        "Both equally",
        "Neither — it is a bug",
      ],
      answer: 1,
      because:
        "The percentages come from the statevector and are what the circuit means; the histogram is one finite run of it.",
    },
  ],
  [
    {
      prompt: "What question can the hardware's measurement actually ask?",
      options: [
        "Any basis you choose",
        "Only whether the qubit is |0⟩ or |1⟩",
        "The phase of the state",
        "The full amplitude",
      ],
      answer: 1,
      because: "One fixed basis. Everything else is arranged by rotating the state before asking.",
    },
    {
      prompt: "How do you distinguish |+⟩ from |−⟩ with such a measurement?",
      options: [
        "Measure many more times",
        "Apply H first, then measure",
        "Apply X first, then measure",
        "You cannot",
      ],
      answer: 1,
      because: "H maps |+⟩ to |0⟩ and |−⟩ to |1⟩, turning an unanswerable question into a certain one.",
    },
    {
      prompt: "In a typical algorithm, what is the job of the last gate before the measurement?",
      options: [
        "To reset the qubits",
        "To convert a phase into an amplitude difference the Born rule can see",
        "To add redundancy",
        "To normalise the state",
      ],
      answer: 1,
      because:
        "The answer is usually hidden in a phase, and squaring would discard it. The last gate is what makes it visible.",
    },
    {
      prompt: "After H, measuring |+⟩ gives:",
      options: ["50/50", "0 with certainty", "1 with certainty", "An error"],
      answer: 1,
      because: "0 every time — a coin flip has been turned into a certainty by rotating the state.",
    },
  ],
  [
    {
      prompt: "What does the double line at the bottom of a circuit diagram carry?",
      options: ["Extra qubits", "Ordinary classical bits", "Entanglement", "Timing information"],
      answer: 1,
      because: "Classical bits. A measurement is the only instruction that crosses from one kind of wire to the other.",
    },
    {
      prompt: "What does QuantumCircuit(3, 3) declare?",
      options: [
        "Three qubits, measured three times",
        "Three qubits and three classical bits",
        "A three-by-three grid of gates",
        "Three circuits of depth three",
      ],
      answer: 1,
      because: "Three of each. The measurement instruction names one of each end.",
    },
    {
      prompt: "A three-qubit result is printed as 011. What is q0?",
      options: ["0", "1", "Cannot tell", "Both"],
      answer: 1,
      because:
        "1. The highest-numbered qubit is written leftmost, so the rightmost character is q0 — the same convention in Qiskit, the sandbox and the histogram.",
    },
    {
      prompt: "What does placing an M tile in the sandbox do?",
      options: [
        "Deletes the qubit",
        "Reads a qubit into a classical bit",
        "Resets the qubit to |0⟩",
        "Adds a gate to the classical register",
      ],
      answer: 1,
      because: "It reads that wire into the matching classical bit, which is what the readout label refers to.",
    },
  ],
];
