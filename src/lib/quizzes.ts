import type { TestQuestion } from "@/lib/lessons";

/**
 * The quiz at the end of each lesson.
 *
 * Three or four questions, and passing one is what marks the lesson complete —
 * there is no self-declared tick any more. That swap is the point. A button
 * reading "I have read this" costs nothing to press and tells the
 * recommendation engine nothing, whereas answering more than half of four
 * questions about the thing you just read is weak evidence rather than none.
 *
 * Half is a deliberately low bar. This is a checkpoint on one lesson, not the
 * assessment — the lab at the foot of the module is that — and a checkpoint
 * that sends somebody back to re-read a page they mostly understood only
 * teaches them to resent it. A wrong answer costs a retry and shows the
 * reasoning either way, which is where the teaching in a quiz actually happens.
 *
 * Indexed by position so a quiz sits beside its lesson without the lesson
 * objects having to carry it, and without the two drifting apart when one is
 * edited.
 */
export const LESSON_QUIZZES: Record<string, TestQuestion[][]> = {
  "qubit-and-superposition": [
    [
      {
        prompt: "What does it take to write down the state of a single qubit?",
        options: ["One bit: it is either 0 or 1", "Two complex amplitudes", "Two probabilities", "One real angle"],
        answer: 1,
        because:
          "Two complex amplitudes. Two probabilities would not do — they throw away the phase, which is the part that lets amplitudes cancel.",
      },
      {
        prompt: "What constraint do those two amplitudes satisfy?",
        options: [
          "They are both positive",
          "They add to one",
          "Their squared magnitudes add to one",
          "They are both below one half",
        ],
        answer: 2,
        because:
          "The squared magnitudes are the two outcome probabilities, and probabilities have to add to one.",
      },
      {
        prompt: "A qubit in superposition is best described as:",
        options: [
          "Secretly 0 or 1, and we have not looked yet",
          "A definite vector that is neither basis state",
          "Switching rapidly between 0 and 1",
          "An error state",
        ],
        answer: 1,
        because:
          "A definite state, just not |0⟩ or |1⟩. The hidden-value reading is the one the two-Hadamard experiment later rules out.",
      },
      {
        prompt: "In these terms, what does applying a gate do?",
        options: ["Measures the qubit", "Turns one pair of amplitudes into another", "Adds randomness", "Copies the qubit"],
        answer: 1,
        because: "Every gate in this course is a rule for transforming amplitudes. That is all a circuit ever is.",
      },
    ],
    [
      {
        prompt: "How do you get a probability out of an amplitude?",
        options: ["Take its real part", "Square its magnitude", "Take its absolute value", "Divide it by two"],
        answer: 1,
        because: "Probability is the squared magnitude. Squaring is what discards the sign and the phase.",
      },
      {
        prompt: "What can amplitudes do that probabilities cannot?",
        options: ["Be larger than one", "Cancel one another out", "Be measured directly", "Change over time"],
        answer: 1,
        because:
          "Cancel. Two probabilities can only ever add; two amplitudes of opposite sign destroy each other, and that is where a speed-up comes from.",
      },
      {
        prompt: "|+⟩ and |−⟩ are measured in the computational basis. The statistics are:",
        options: ["Identical — 50/50 for both", "Opposite", "Certain, and different", "Impossible to predict"],
        answer: 0,
        because:
          "Identical. Nothing measured in this basis separates them; the difference is the sign, and it takes another gate to reveal it.",
      },
      {
        prompt: "What do quantum algorithms arrange for, to beat their classical counterparts?",
        options: [
          "More qubits than bits",
          "Faster clock speeds",
          "Wrong answers to cancel and the right one to reinforce",
          "Measuring many times at once",
        ],
        answer: 2,
        because: "Interference. Grover and Deutsch–Jozsa later in this course are that idea and very little else.",
      },
    ],
    [
      {
        prompt: "What sits on the equator of the Bloch sphere?",
        options: [
          "States certain to measure 0",
          "States certain to measure 1",
          "Equal superpositions, differing by phase around the circle",
          "Entangled states",
        ],
        answer: 2,
        because:
          "Equal superpositions. Going round the equator changes phase, not probability — which is why |+⟩ and |−⟩ both live there, opposite each other.",
      },
      {
        prompt: "Two complex amplitudes are four real numbers. Why does the sphere need only two?",
        options: [
          "The imaginary parts are always zero",
          "Normalisation removes one and global phase removes another",
          "Two of them are always equal",
          "The sphere is an approximation",
        ],
        answer: 1,
        because:
          "Length one uses up one degree of freedom and the unobservable overall phase uses up another. Two are left, which is exactly a point on a sphere.",
      },
      {
        prompt: "A qubit's Bloch arrow is shorter than full length. What does that mean?",
        options: [
          "The qubit has less energy",
          "A rounding error in the simulator",
          "It has no definite state of its own — it is entangled with something",
          "It has already been measured",
        ],
        answer: 2,
        because:
          "Length is purity. A full arrow is a state of its own; a shrunken one means the information lives in a correlation with another qubit.",
      },
      {
        prompt: "Where does |1⟩ sit?",
        options: ["North pole", "South pole", "On the equator", "At the centre"],
        answer: 1,
        because: "The south pole, directly opposite |0⟩.",
      },
    ],
    [
      {
        prompt: "What is H|0⟩?",
        options: ["|0⟩", "|1⟩", "|+⟩", "|−⟩"],
        answer: 2,
        because: "An equal superposition with both amplitudes positive.",
      },
      {
        prompt: "What is H·H?",
        options: ["The identity", "A phase flip", "A bit flip", "A measurement"],
        answer: 0,
        because: "H is its own inverse, so applying it twice returns the state untouched.",
      },
      {
        prompt: "What distinguishes H|0⟩ from H|1⟩?",
        options: [
          "Nothing",
          "The sign on the |1⟩ amplitude",
          "The number of outcomes",
          "One is normalised and one is not",
        ],
        answer: 1,
        because:
          "The minus sign in the bottom right of the matrix. That single sign is the whole difference between |+⟩ and |−⟩.",
      },
      {
        prompt: "Every entry of the Hadamard matrix has magnitude:",
        options: ["1", "1/2", "1/√2", "√2"],
        answer: 2,
        because: "1/√2, which is what makes both output amplitudes equal in size.",
      },
    ],
    [
      {
        prompt: "Apply H to |0⟩, then H again, then measure. What do you see?",
        options: ["50/50", "0 with certainty", "1 with certainty", "25/75"],
        answer: 1,
        because: "0, every time. The second H rotates the state exactly back.",
      },
      {
        prompt: "If the first H had genuinely flipped a coin, what would the second one give?",
        options: ["Still 50/50", "0 with certainty", "1 with certainty", "Nothing — it would error"],
        answer: 0,
        because:
          "Still 50/50. Flipping an already-landed coin again just re-randomises it. That is the prediction the experiment falsifies.",
      },
      {
        prompt: "So what does the two-Hadamard result establish?",
        options: [
          "The simulator is deterministic",
          "The state after one H was definite, not a hidden outcome",
          "Measurement is reversible",
          "H is faster than a coin flip",
        ],
        answer: 1,
        because: "A definite state can be rotated back. A result that has already happened cannot be un-happened.",
      },
      {
        prompt: "Which of these is reversible?",
        options: ["Randomness", "A rotation", "Both", "Neither"],
        answer: 1,
        because:
          "A rotation. This is the sharpest one-line difference between a qubit in superposition and a coin mid-air.",
      },
    ],
    [
      {
        prompt: "Multiplying an entire state by e^(iγ) changes:",
        options: ["The measurement probabilities", "The Bloch vector", "Nothing observable", "The relative phase"],
        answer: 2,
        because:
          "Nothing observable — that is what makes it global. It is why the Bloch sphere needs two numbers rather than three.",
      },
      {
        prompt: "A phase between the |0⟩ and |1⟩ amplitudes is:",
        options: [
          "Also unobservable",
          "Physical, and separates |+⟩ from |−⟩",
          "Only present after measurement",
          "The same thing as global phase",
        ],
        answer: 1,
        because: "Entirely physical. Confusing relative phase with global phase is the most common mistake at this stage.",
      },
      {
        prompt: "Why do the graded labs compare your circuit up to global phase?",
        options: [
          "To be lenient",
          "Because no measurement could ever tell the difference",
          "Because the simulator is imprecise",
          "To allow for rounding",
        ],
        answer: 1,
        because:
          "A circuit differing only by a factor nothing can observe is the same circuit. Marking it wrong would be marking bookkeeping.",
      },
      {
        prompt: "What does H·Z·H applied to |0⟩ produce?",
        options: ["|0⟩", "|1⟩", "|+⟩", "|−⟩"],
        answer: 1,
        because:
          "|1⟩ with certainty. The Z is invisible on its own; the second H converts that relative phase into something you can measure.",
      },
    ],
  ],
};

export function quizFor(slug: string, index: number): TestQuestion[] {
  return LESSON_QUIZZES[slug]?.[index] ?? [];
}

/** Share of a quiz that has to be right for the lesson to count as read. */
export const QUIZ_PASS = 0.5;
