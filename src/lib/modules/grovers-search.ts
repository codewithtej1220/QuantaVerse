import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Grover's Search Algorithm — seven lessons. */
export const lessons: Lesson[] = [
  {
    title: "Unstructured search",
    summary: "A haystack with no structure at all, and what that costs classically.",
    minutes: 9,
    body: [
      "There are N possibilities and exactly one of them is the answer. You have no index, no ordering and no clue — all you can do is pick a candidate and ask whether it is the one. How many questions does it take?",
      "Classically, on average, about half of them, and in the worst case all N. There is no cleverness available: the problem has no structure to exploit, which is what unstructured means. Any classical algorithm is reduced to guessing, and guessing costs O(N).",
      "Grover's algorithm finds the answer in about √N queries. For a million items that is a thousand instead of half a million, and for a database that is impressive rather than revolutionary — it is a quadratic speed-up, not an exponential one. The last lesson of this module is about why that distinction matters more than it sounds.",
    ],
    notation: {
      lines: [
        "N candidates, one marked",
        "",
        "classical:  ~N/2 queries on average,  N worst case",
        "Grover:     ~(π/4)√N queries",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=_cDIzwycANg",
      minutes: 6,
      caption:
        "“What is Grover’s Algorithm?” by quantumfy — the search problem and the √N claim, in six minutes.",
    },
  },
  {
    title: "Marking the answer",
    summary: "An oracle that flips a sign, and nothing else.",
    minutes: 10,
    body: [
      "Grover's oracle does one job: it recognises the answer and flips the sign of that one term, leaving every other term untouched. It does not tell you which item it flipped — if it could do that, there would be no search problem left to solve.",
      "That sign flip is the same phase kickback from the previous module, and it is built the same way: an ancilla in |−⟩, the recognising function XORed onto it, and the answer arriving as a minus sign on the marked term of the input register. Nothing new is required here, which is a good reason to have met it already.",
      "Now look at what the register actually looks like after the oracle. Start from an equal superposition of all N terms, mark one, and every amplitude is still the same size — only one of them is negative. Since the Born rule squares, measuring at this point gives a uniformly random result. The oracle alone achieves nothing measurable, and the rest of the algorithm is about fixing that.",
    ],
    notation: {
      lines: [
        "before:   (|000⟩ + |001⟩ + … + |111⟩) / √8",
        "after:    (|000⟩ + |001⟩ − |011⟩ + … ) / √8",
        "",
        "all magnitudes equal   ->   measuring now is still uniform",
      ],
    },
    practice:
      "A Z gate on one wire is the simplest possible marker. Build H, Z, H on a single qubit to see a sign flip turn into a certain outcome.",
    video: {
      url: "https://www.youtube.com/watch?v=Dlsa9EBKDGI",
      minutes: 16,
      caption:
        "“Where my explanation of Grover’s algorithm failed” by 3Blue1Brown — what the oracle really is: a check you can run, not a lookup of the answer.",
    },
  },
  {
    title: "Amplitude amplification",
    summary: "The geometric picture: two reflections make a rotation.",
    minutes: 12,
    body: [
      "Here is the idea that makes the whole algorithm obvious, and it is geometric rather than algebraic. The state lives in a plane spanned by two directions: the marked answer, and the even mixture of everything else. Any state of the register during the algorithm is some angle within that plane.",
      "The starting superposition sits very close to the wrong-answers direction, because there are N−1 of them and only one right one — that closeness is exactly why a measurement is unlikely to succeed. The goal is to rotate the state away from there and towards the answer.",
      "Two reflections compose into a rotation. The oracle is the first reflection, about the wrong-answers direction, because it flips the marked term's sign and nothing else. The diffuser is the second, and together they rotate the state by a fixed small angle towards the answer on every pass. Repeat until it is pointing close enough to measure.",
    ],
    notation: {
      lines: [
        "plane spanned by:   |marked⟩   and   |everything else⟩",
        "",
        "oracle   = reflect about |everything else⟩",
        "diffuser = reflect about the starting state",
        "together = a rotation towards |marked⟩",
      ],
      caption: "Two reflections about different axes are a rotation by twice the angle between them.",
    },
    video: {
      url: "https://www.youtube.com/watch?v=RQWpF2Gb-gU",
      minutes: 37,
      caption:
        "“But what is quantum computing? (Grover’s Algorithm)” by 3Blue1Brown — the two reflections that make a rotation, drawn properly.",
    },
  },
  {
    title: "The diffuser",
    summary: "Inversion about the mean, and why it makes one amplitude grow.",
    minutes: 12,
    body: [
      "The diffuser is the second reflection, and it has an arithmetic reading that is much easier to picture than the geometry. It takes the average of all the amplitudes and reflects each one about that average: an amplitude above the mean drops below it by the same distance, and one below rises above.",
      "Follow what that does after the oracle. Every unmarked amplitude is some positive value a; the marked one is −a. The mean is therefore slightly below a. Reflecting leaves the unmarked amplitudes barely changed — they were near the mean already — while the marked one, sitting far below it, is thrown a long way above. One amplitude grows and the rest shrink slightly to pay for it.",
      "In gates, the diffuser is built the same way every time: Hadamards to move into the right basis, a phase flip on the all-zeros state, then Hadamards back. It is the same sandwich pattern as phase kickback, applied to a different marked state, and it is worth recognising because it recurs throughout the field.",
    ],
    notation: {
      lines: [
        "mean of the amplitudes = m",
        "each amplitude a  ->  2m − a",
        "",
        "unmarked:  near the mean, barely move",
        "marked:    far below, thrown far above",
      ],
    },
    code: "# the diffuser, for a 3-qubit register\nqc.h([0, 1, 2])\nqc.x([0, 1, 2])\nqc.h(2); qc.ccx(0, 1, 2); qc.h(2)   # phase flip on |000>\nqc.x([0, 1, 2])\nqc.h([0, 1, 2])",
    video: {
      url: "https://www.youtube.com/watch?v=DnxJQwdlrRM",
      minutes: 10,
      caption:
        "“Inversion About Mean” by Jaideep Mulherkar — the diffuser as a reflection about the average amplitude.",
    },
  },
  {
    title: "One iteration",
    summary: "Putting the two reflections together, and watching the amplitude climb.",
    minutes: 10,
    body: [
      "A Grover iteration is the oracle followed by the diffuser. Before any iterations, every amplitude is 1/√N and the chance of measuring the answer is 1/N — no better than guessing. After one iteration the marked amplitude has grown noticeably and the others have shrunk a little.",
      "For small registers the effect is dramatic. With four items — two qubits — a single iteration takes the marked amplitude all the way to one, and the answer is found with certainty. That is the smallest complete Grover, and it is worth building because you can check it exhaustively.",
      "For larger N each pass is a smaller fraction of the journey, which is where the query count comes from. The rotation angle per iteration is roughly 2/√N, and you need to cover about π/2 of angle in total — which is the (π/4)√N figure from the first lesson, arrived at honestly.",
    ],
    notation: {
      lines: [
        "iteration = oracle · diffuser",
        "",
        "N = 4:   one iteration  ->  certainty",
        "large N: angle per iteration ≈ 2/√N,  total needed ≈ π/2",
      ],
    },
    practice:
      "Before the lab, build just the oracle for |11⟩ in the sandbox: H on q1, a CNOT from q0, then H on q1 again. Put Hadamards on both qubits in front of it and the histogram stays flat — the mark is there, and only the diffuser turns it into an answer.",
    video: {
      url: "https://www.youtube.com/watch?v=0RPFWZj7Jm0",
      minutes: 19,
      caption:
        "“Grover’s Algorithm — Coding with Qiskit S2E3” by Qiskit — the oracle and the diffuser built in Qiskit and put together into an iteration.",
    },
  },
  {
    title: "How many iterations",
    summary: "Why more is not better, and what happens if you overshoot.",
    minutes: 11,
    body: [
      "This is the counter-intuitive part, and it is the thing most people get wrong first. Grover is a rotation, and a rotation does not stop when it reaches the target. Keep applying iterations past the optimum and the state rotates straight past the answer and back out the other side, and the success probability falls again.",
      "It is periodic. Run far too many iterations and the probability oscillates up and down forever, so the algorithm genuinely gets worse with more work — which is not an intuition anything in classical computing prepares you for. Knowing when to stop is part of the algorithm, not an implementation detail.",
      "The optimal count is about (π/4)√N, rounded to a whole number, and it depends on knowing how many marked items there are. If you do not know that count, there are variants that handle it — searching with an unknown number of solutions is a solved problem — but the plain algorithm assumes you know.",
    ],
    notation: {
      lines: [
        "optimal ≈ (π/4)√N        (round to the nearest integer)",
        "",
        "N = 4    ->  1 iteration",
        "N = 16   ->  3 iterations",
        "N = 1024 ->  25 iterations",
        "",
        "past the optimum, success probability falls again",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=hnpjC8WQVrQ",
      minutes: 55,
      caption:
        "“Grover’s Algorithm | Understanding Quantum Information & Computation | Lesson 08” by Qiskit — the full lecture, including how many iterations to run.",
    },
  },
  {
    title: "What a quadratic speed-up buys",
    summary: "Real, useful, and not the thing that breaks encryption.",
    minutes: 11,
    body: [
      "Grover is provably optimal: no quantum algorithm can search an unstructured space in fewer than order √N queries, so this is the end of the road for this problem rather than a waypoint. That is a genuinely strong result — the bound is on every possible quantum algorithm, not just the ones anyone has thought of.",
      "It is also only quadratic, and that changes what it is good for. An exponential speed-up turns an impossible problem into an easy one. A quadratic one turns a problem that takes a million steps into one that takes a thousand, which is valuable but does not move anything across the line from infeasible to feasible on its own.",
      "The standard illustration is symmetric encryption. Grover can search a key space in the square root of the time, which effectively halves a key's strength — so a 128-bit key offers about 64 bits of resistance against a quantum attacker. The response is simply to use 256-bit keys, and the problem is closed. Compare that with Shor's, the next module, where an exponential speed-up breaks the underlying assumption outright and no key length saves it.",
    ],
    notation: {
      lines: [
        "Grover:  quadratic   N -> √N        double the key length, problem solved",
        "Shor:    exponential                the assumption itself fails",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=CIArKQjiblc",
      minutes: 18,
      caption:
        "“Grover’s Algorithm: Quadratic Speedup in Searching (Derivation, Proof of Optimality)” by VarPi — including why √N is the best any quantum algorithm can do.",
    },
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What does unstructured mean here?",
      options: [
        "The data is unsorted but indexed",
        "There is no structure to exploit — you can only test candidates",
        "The answer may not exist",
        "There are many answers",
      ],
      answer: 1,
      because: "No index, no ordering, no clue. Any classical algorithm is reduced to guessing.",
    },
    {
      prompt: "Classically, how many queries on average?",
      options: ["√N", "N/2", "log N", "1"],
      answer: 1,
      because: "About half of them, and all N in the worst case.",
    },
    {
      prompt: "How many does Grover need?",
      options: ["log N", "About √N", "N/4", "1"],
      answer: 1,
      because: "About (π/4)√N — a thousand queries for a million items.",
    },
    {
      prompt: "Is that an exponential speed-up?",
      options: ["Yes", "No — it is quadratic", "It depends on N", "Only for large N"],
      answer: 1,
      because: "Quadratic, and the difference matters more than it sounds.",
    },
  ],
  [
    {
      prompt: "What does Grover's oracle do?",
      options: [
        "Returns the index of the answer",
        "Flips the sign of the marked term and nothing else",
        "Measures the register",
        "Amplifies the marked amplitude",
      ],
      answer: 1,
      because: "A sign flip. If it could tell you which item, there would be no search problem left.",
    },
    {
      prompt: "How is that sign flip built?",
      options: [
        "With a measurement",
        "Phase kickback — an ancilla in |−⟩ with the recogniser XORed onto it",
        "With a SWAP",
        "With a classical lookup",
      ],
      answer: 1,
      because: "Exactly the construction from the Deutsch–Jozsa module.",
    },
    {
      prompt: "If you measure immediately after the oracle, what do you get?",
      options: [
        "The answer",
        "A uniformly random result",
        "All zeros",
        "Nothing",
      ],
      answer: 1,
      because: "Every magnitude is still equal — only a sign changed, and squaring discards it.",
    },
    {
      prompt: "So what does the oracle achieve on its own?",
      options: [
        "It solves the problem",
        "Nothing measurable — the rest of the algorithm is about fixing that",
        "It halves the search space",
        "It entangles the register",
      ],
      answer: 1,
      because: "A phase difference is raw material for interference, not a result.",
    },
  ],
  [
    {
      prompt: "The state during Grover lives in a plane spanned by:",
      options: [
        "|0⟩ and |1⟩",
        "The marked answer and the mixture of everything else",
        "X and Z",
        "All N basis states equally",
      ],
      answer: 1,
      because: "Two directions, which is what makes the whole thing a picture rather than algebra.",
    },
    {
      prompt: "Why does the starting state sit close to the wrong-answers direction?",
      options: [
        "Because of the oracle",
        "Because there are N−1 wrong answers and one right one",
        "Because of decoherence",
        "It does not",
      ],
      answer: 1,
      because: "And that closeness is exactly why measuring it is unlikely to succeed.",
    },
    {
      prompt: "Two reflections about different axes compose into:",
      options: ["Another reflection", "A rotation", "The identity", "A projection"],
      answer: 1,
      because: "A rotation by twice the angle between the axes — which is the engine of the algorithm.",
    },
    {
      prompt: "Which two reflections?",
      options: [
        "Two oracles",
        "The oracle and the diffuser",
        "Two diffusers",
        "The Hadamard and the oracle",
      ],
      answer: 1,
      because: "The oracle reflects about the wrong answers; the diffuser reflects about the starting state.",
    },
  ],
  [
    {
      prompt: "What does the diffuser do arithmetically?",
      options: [
        "Normalises the amplitudes",
        "Reflects each amplitude about their mean",
        "Sets the marked amplitude to one",
        "Measures the register",
      ],
      answer: 1,
      because: "Inversion about the mean — above drops below, below rises above.",
    },
    {
      prompt: "After the oracle, where does the marked amplitude sit relative to the mean?",
      options: ["Just above it", "Far below it", "Exactly on it", "Far above it"],
      answer: 1,
      because: "It is −a while everything else is +a, so it is far below — and reflection throws it far above.",
    },
    {
      prompt: "What happens to the unmarked amplitudes?",
      options: [
        "They vanish",
        "They barely move, shrinking slightly",
        "They double",
        "They all become negative",
      ],
      answer: 1,
      because: "They were near the mean already. Their small loss pays for the marked one's gain.",
    },
    {
      prompt: "In gates, the diffuser is:",
      options: [
        "A single gate",
        "Hadamards, a phase flip on all-zeros, Hadamards back",
        "A measurement followed by a reset",
        "A chain of CNOTs",
      ],
      answer: 1,
      because: "The same sandwich pattern as phase kickback, applied to a different marked state.",
    },
  ],
  [
    {
      prompt: "What is one Grover iteration?",
      options: [
        "Oracle only",
        "Diffuser only",
        "Oracle then diffuser",
        "Two oracles",
      ],
      answer: 2,
      because: "The two reflections together, which compose into one rotation towards the answer.",
    },
    {
      prompt: "Before any iterations, the chance of measuring the answer is:",
      options: ["1/2", "1/N", "1/√N", "0"],
      answer: 1,
      because: "Every amplitude is 1/√N, so squaring gives 1/N — no better than guessing.",
    },
    {
      prompt: "With four items, how many iterations for certainty?",
      options: ["1", "2", "4", "It is never certain"],
      answer: 0,
      because: "One pass takes the marked amplitude all the way to one. It is the smallest complete Grover.",
    },
    {
      prompt: "Roughly how much does each iteration rotate, for large N?",
      options: ["π/2", "2/√N", "1/N", "π/4"],
      answer: 1,
      because: "And you need about π/2 in total, which is where (π/4)√N comes from.",
    },
  ],
  [
    {
      prompt: "What happens if you run more iterations than the optimum?",
      options: [
        "The answer becomes more certain",
        "Nothing changes",
        "The state rotates past the answer and success probability falls",
        "The circuit errors",
      ],
      answer: 2,
      because: "It is a rotation, and a rotation does not stop when it reaches the target.",
    },
    {
      prompt: "Run far too many iterations and the success probability:",
      options: [
        "Settles at one",
        "Settles at zero",
        "Oscillates up and down forever",
        "Decays to 1/N",
      ],
      answer: 2,
      because: "It is periodic. The algorithm genuinely gets worse with more work.",
    },
    {
      prompt: "For N = 1024, roughly how many iterations?",
      options: ["3", "25", "100", "512"],
      answer: 1,
      because: "(π/4)√1024 ≈ 25.",
    },
    {
      prompt: "What does the optimal count depend on knowing?",
      options: [
        "The answer itself",
        "How many marked items there are",
        "The hardware's error rate",
        "The classical runtime",
      ],
      answer: 1,
      because:
        "The plain algorithm assumes you know. Variants exist for an unknown number of solutions.",
    },
  ],
  [
    {
      prompt: "Is Grover optimal?",
      options: [
        "No, faster quantum algorithms exist",
        "Yes — no quantum algorithm can do unstructured search in fewer than order √N queries",
        "Only for small N",
        "Unknown",
      ],
      answer: 1,
      because: "The bound is on every possible quantum algorithm, which makes it a genuinely strong result.",
    },
    {
      prompt: "What does a quadratic speed-up do to a million-step problem?",
      options: [
        "Makes it instant",
        "Reduces it to about a thousand steps",
        "Reduces it to about twenty steps",
        "Leaves it unchanged",
      ],
      answer: 1,
      because: "Valuable, but it does not on its own move a problem from infeasible to feasible.",
    },
    {
      prompt: "What does Grover do to a 128-bit symmetric key?",
      options: [
        "Breaks it completely",
        "Effectively halves its strength, to about 64 bits",
        "Leaves it untouched",
        "Makes it stronger",
      ],
      answer: 1,
      because: "Square-root search halves the effective key length.",
    },
    {
      prompt: "What is the response to that threat?",
      options: [
        "Abandon symmetric encryption",
        "Use 256-bit keys",
        "Add more rounds",
        "There is no response",
      ],
      answer: 1,
      because:
        "Double the key length and the problem closes — unlike Shor's, where no key length saves the assumption.",
    },
  ],
];
