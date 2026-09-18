import type { Lesson, TestQuestion } from "@/lib/lessons";

/** The Deutsch–Jozsa Algorithm — five lessons. */
export const lessons: Lesson[] = [
  {
    title: "The problem",
    summary: "A question with a silly premise and an honest answer about speed-ups.",
    minutes: 9,
    body: [
      "You are handed a function on n bits that returns one bit, and promised it is one of two kinds: constant, giving the same answer for every input, or balanced, giving 0 for exactly half the inputs and 1 for the other half. You may ask it questions. How many do you need to tell which kind it is?",
      "Classically, in the worst case, you need one more than half the inputs. Ask 2ⁿ⁻¹ times and get the same answer every time and you still cannot tell — the function might be balanced with all the zeros clustered where you happened to look. One more query settles it. So the classical cost grows exponentially with n.",
      "The quantum answer is one query. Not one on average, not one usually — one, always, with certainty. It is worth being straight about the catch: nobody needs this function, and the promise that it is one of exactly two kinds is doing enormous work. Deutsch–Jozsa is a proof that a separation exists, and it is the cleanest place to learn how interference is actually used.",
    ],
    notation: {
      lines: [
        "f : {0,1}ⁿ -> {0,1},  promised constant or balanced",
        "",
        "classical worst case:   2ⁿ⁻¹ + 1 queries",
        "quantum:                1 query",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=47FxvVZA4GM",
      minutes: 5,
      caption:
        "“The Deutsch-Jozsa Algorithm (Simple Version)” by PSPACE — the constant-or-balanced question, animated.",
    },
  },
  {
    title: "Oracles",
    summary: "How a function becomes a gate you can put in a circuit.",
    minutes: 10,
    body: [
      "A circuit is a sequence of unitaries, and an arbitrary function is not one — most functions are not reversible, and a unitary must be. So the function is packaged into a gate that is: the oracle takes an input register and one extra qubit, and XORs the function's answer onto that extra qubit, leaving the input untouched.",
      "That construction is reversible for any f at all, because applying it twice returns the target to where it started. It is the standard way to make a classical function usable inside a quantum circuit, and the extra qubit it requires is usually called the ancilla.",
      "Two things about oracles cause confusion. The oracle is not magic and not free — somebody has to build it out of real gates, and for a real problem that construction can dominate the cost. And querying it in superposition does not evaluate every input in a way you can read out: you get one measurement at the end, and the algorithm's job is to make that one measurement worth having.",
    ],
    notation: {
      lines: [
        "U_f |x⟩|y⟩ = |x⟩ |y ⊕ f(x)⟩",
        "",
        "input register untouched, answer XORed onto the ancilla",
        "U_f · U_f = I      so it is reversible for any f",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=7MdEHsRZxvo",
      minutes: 10,
      caption:
        "“Deutsch’s Algorithm: An Introduction to Quantum Computing Oracles” by Quantum Soar — how a function becomes a gate you can put in a circuit.",
    },
  },
  {
    title: "Phase kickback",
    summary: "The trick that moves the oracle's answer out of the ancilla and into a phase.",
    minutes: 12,
    body: [
      "Prepare the ancilla in |−⟩ rather than |0⟩ and something useful happens. The oracle XORs f(x) onto it, but |−⟩ is an eigenstate of that flip: XORing 0 leaves it alone, and XORing 1 turns |−⟩ into −|−⟩. The ancilla comes out exactly as it went in, and a minus sign has appeared on the input term instead.",
      "That is phase kickback, and it is the single most reused idea in quantum algorithms. The answer has moved off the ancilla, which you were never going to be able to read usefully, and onto the phase of the input register, where interference can act on it. Grover uses the same trick, and so does the phase estimation at the heart of Shor's.",
      "Notice what has been bought and what has not. You still cannot read the phases directly — the Born rule squares them away. What you have is a register where the right answers and the wrong ones now carry different signs, which is precisely the raw material the next lesson turns into a measurable result.",
    ],
    notation: {
      lines: [
        "U_f |x⟩|−⟩ = (−1)^f(x) |x⟩ |−⟩",
        "",
        "the ancilla is unchanged",
        "the sign has landed on the input term",
      ],
      caption: "The answer moves from a qubit you cannot use into a phase you can interfere with.",
    },
    practice:
      "Build H then Z then H on one qubit. The Z is a one-qubit stand-in for a kicked-back phase, and the final H is what converts it into a certain |1⟩.",
    video: {
      url: "https://www.youtube.com/watch?v=iLcQ-X6QzvU",
      minutes: 3,
      caption:
        "“Phase kickback” by QuTech Academy — how a phase applied to the target ends up on the control.",
    },
  },
  {
    title: "Interference",
    summary: "A final layer of Hadamards, and why the answer lands on all zeros.",
    minutes: 11,
    body: [
      "The circuit is short: Hadamards on the input register to put it in an equal superposition of every x, the oracle to stamp each term with its sign, then Hadamards again, then measure. Everything interesting happens in that second layer of Hadamards.",
      "If f is constant, every term carries the same sign. A global sign is unobservable, so the register is still the same equal superposition it was, and the second Hadamard layer inverts the first exactly — returning all zeros with certainty, the same way H·H returns |0⟩ in the very first module.",
      "If f is balanced, half the terms carry a plus and half a minus. In the second Hadamard layer, the amplitude flowing towards the all-zeros outcome is the sum of those signs — and an equal number of pluses and minuses sums to nothing. The all-zeros result is cancelled out completely, so measuring it is impossible, and anything else you see means balanced.",
    ],
    notation: {
      lines: [
        "H⊗ⁿ  ->  U_f  ->  H⊗ⁿ  ->  measure",
        "",
        "constant  ->  000…0  with certainty",
        "balanced  ->  000…0  with probability exactly zero",
      ],
      caption: "One measurement, and the two cases are perfectly distinguishable.",
    },
    practice:
      "Open the lab for this module and build the three-qubit version. The read-out never shows all zeros for the balanced oracle — not rarely, never.",
    video: {
      url: "https://www.youtube.com/watch?v=pC2XRXInHnc",
      minutes: 9,
      caption:
        "“3.4 Deutsch-Jozsa Algorithm” by Quantum Soar — the whole circuit, down to the last layer of Hadamards and the all-zeros answer.",
    },
  },
  {
    title: "Query complexity",
    summary: "What was actually proved, and what it does not say.",
    minutes: 10,
    body: [
      "The result is about query complexity: how many times you must consult the oracle, not how much total work is done. On that measure the separation is as sharp as it gets — exponential classically, one query quantumly, with certainty rather than high probability.",
      "It is worth knowing the honest caveat. If you allow the classical algorithm to be randomised and accept a small chance of error, a handful of random queries distinguishes the two cases with overwhelming confidence. The dramatic gap is against deterministic classical algorithms, and quoting it without that qualifier is how this result gets oversold.",
      "What survives the caveat is the technique, and that is the reason the module exists. Put the register in superposition, use phase kickback to write the answer into the signs, then interfere so that the wrong answers cancel. Grover is that pattern applied repeatedly, and Shor is that pattern with a Fourier transform doing the interfering. This is the smallest complete example of it.",
    ],
    notation: {
      lines: [
        "deterministic classical:  2ⁿ⁻¹ + 1 queries",
        "randomised classical:     a few, with high confidence",
        "quantum:                  1, with certainty",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=QcK0GK7DUh8",
      minutes: 19,
      caption:
        "“Quantum vs Classical: Deutsch & Deutsch-Jozsa Algorithms Explained” by Qiskit — how many queries each side needs, and what the comparison shows.",
    },
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What are you promised about the function?",
      options: [
        "It is invertible",
        "It is either constant or balanced",
        "It returns n bits",
        "It is linear",
      ],
      answer: 1,
      because: "One of exactly two kinds — and that promise is doing a great deal of the work.",
    },
    {
      prompt: "How many queries does the classical worst case need?",
      options: ["1", "n", "2ⁿ⁻¹ + 1", "2ⁿ"],
      answer: 2,
      because: "One more than half the inputs. Until then the zeros you saw might just be where you happened to look.",
    },
    {
      prompt: "How many does the quantum algorithm need?",
      options: ["1, with certainty", "1, on average", "n", "log n"],
      answer: 0,
      because: "One, always, with certainty — not one usually.",
    },
    {
      prompt: "What is the honest reason to study this algorithm?",
      options: [
        "The function is widely useful",
        "It is the cleanest place to learn how interference is used",
        "It is what runs on real hardware today",
        "It breaks encryption",
      ],
      answer: 1,
      because: "Nobody needs this function. It is a proof that a separation exists, and a teaching device.",
    },
  ],
  [
    {
      prompt: "Why can a function not be dropped into a circuit directly?",
      options: [
        "It is too slow",
        "Most functions are not reversible, and gates must be unitary",
        "Functions need classical bits",
        "It can be dropped in directly",
      ],
      answer: 1,
      because: "Unitarity requires reversibility, and most functions throw information away.",
    },
    {
      prompt: "What does the oracle do?",
      options: [
        "Replaces the input with f(x)",
        "XORs f(x) onto an extra qubit, leaving the input untouched",
        "Measures f(x)",
        "Returns f(x) as a classical bit",
      ],
      answer: 1,
      because: "That construction is reversible for any f, which is what makes it a legal gate.",
    },
    {
      prompt: "What is the extra qubit usually called?",
      options: ["The control", "The ancilla", "The target register", "The syndrome"],
      answer: 1,
      because: "The ancilla — the working qubit the oracle needs in order to be reversible.",
    },
    {
      prompt: "Is the oracle free?",
      options: [
        "Yes, it is a single gate",
        "No — somebody has to build it from real gates, and that can dominate the cost",
        "Yes, on hardware",
        "Only for balanced functions",
      ],
      answer: 1,
      because: "Treating the oracle as free is the most common way these speed-ups get misread.",
    },
  ],
  [
    {
      prompt: "What state is the ancilla prepared in for phase kickback?",
      options: ["|0⟩", "|1⟩", "|+⟩", "|−⟩"],
      answer: 3,
      because: "|−⟩ is an eigenstate of the bit flip, which is what makes the trick work.",
    },
    {
      prompt: "What happens to the ancilla after the oracle acts?",
      options: [
        "It holds f(x)",
        "It is unchanged",
        "It is measured",
        "It becomes entangled with the input",
      ],
      answer: 1,
      because: "Exactly as it went in. The answer has gone somewhere else.",
    },
    {
      prompt: "Where does the answer end up?",
      options: [
        "In the classical register",
        "As a sign on the input term",
        "In the ancilla's amplitude",
        "It is lost",
      ],
      answer: 1,
      because: "(−1)^f(x) multiplying |x⟩ — a phase, where interference can act on it.",
    },
    {
      prompt: "Can you read those phases directly?",
      options: [
        "Yes, with a measurement",
        "No — the Born rule squares them away",
        "Yes, on the statevector simulator only",
        "Only for constant f",
      ],
      answer: 1,
      because:
        "Which is why a further step is needed. What you have is raw material for interference, not an answer.",
    },
  ],
  [
    {
      prompt: "What is the structure of the circuit?",
      options: [
        "Oracle, Hadamards, measure",
        "Hadamards, oracle, Hadamards, measure",
        "Hadamards, measure, oracle",
        "Oracle, measure",
      ],
      answer: 1,
      because: "Superpose, stamp the signs, interfere, read.",
    },
    {
      prompt: "If f is constant, what does the measurement give?",
      options: ["All zeros with certainty", "All ones", "Uniformly random", "Nothing"],
      answer: 0,
      because: "A global sign is unobservable, so the second Hadamard layer just inverts the first.",
    },
    {
      prompt: "If f is balanced, the probability of all zeros is:",
      options: ["1", "1/2", "Exactly 0", "1/2ⁿ"],
      answer: 2,
      because:
        "Equal numbers of pluses and minuses sum to nothing, so that amplitude cancels completely.",
    },
    {
      prompt: "Which earlier result is the constant case exactly?",
      options: [
        "The Born rule",
        "H·H returning |0⟩",
        "The no-signalling theorem",
        "The CHSH bound",
      ],
      answer: 1,
      because: "The same two-Hadamard identity from the first module, applied to a whole register.",
    },
  ],
  [
    {
      prompt: "What does the result measure?",
      options: [
        "Total running time",
        "How many times the oracle must be consulted",
        "Circuit depth",
        "Qubit count",
      ],
      answer: 1,
      because: "Query complexity, not total work.",
    },
    {
      prompt: "How does a randomised classical algorithm fare?",
      options: [
        "It still needs exponentially many queries",
        "A few random queries settle it with overwhelming confidence",
        "It cannot solve the problem",
        "It needs exactly one",
      ],
      answer: 1,
      because:
        "Which is the honest caveat. The dramatic gap is against deterministic classical algorithms.",
    },
    {
      prompt: "What survives that caveat?",
      options: [
        "Nothing — the result is void",
        "The technique: superpose, kick back a phase, interfere so wrong answers cancel",
        "The exponential speed-up in practice",
        "The oracle construction",
      ],
      answer: 1,
      because: "Grover repeats that pattern, and Shor runs it with a Fourier transform doing the interfering.",
    },
    {
      prompt: "Quoting the exponential gap without the qualifier is:",
      options: [
        "Standard practice",
        "How this result gets oversold",
        "Required by the proof",
        "Only wrong for large n",
      ],
      answer: 1,
      because: "The comparison has to name which classical model it is beating.",
    },
  ],
];
