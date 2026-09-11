/**
 * The lesson bodies.
 *
 * A module used to be an outline and a graded lab with nothing in between: the
 * learner was handed a list of concept names and sent straight to a circuit
 * they had been told nothing about. The lab is the assessment, and an
 * assessment with no teaching in front of it is a filter rather than a course.
 *
 * The shape is deliberately not markdown. A module needs kets, amplitudes and
 * the odd matrix, and a markdown pipeline either mangles those or drags in a
 * maths renderer to fix what it broke. Prose is prose, notation is a separate
 * field set in the mono face the rest of the site already uses for states, and
 * code is a third. Each piece is then styled once, correctly, rather than being
 * parsed out of a string.
 *
 * `practice` is what makes a lesson land: a specific thing to build in the
 * sandbox, so the reader leaves having done the thing rather than having read
 * about it. It is not decoration and it is not optional padding — where a
 * lesson has no obvious thing to build, the field is left off.
 */

export interface Lesson {
  /** Shown in the outline and as the section heading. */
  title: string;
  /** One sentence, under the title. */
  summary: string;
  minutes: number;
  /** Prose. One string per paragraph. */
  body: string[];
  /** Worked notation, set in the mono face. Kets and amplitudes live here. */
  notation?: { lines: string[]; caption?: string };
  /** A Qiskit fragment, where the lesson is about code. */
  code?: string;
  /** What to go and build in the sandbox, in one sentence. */
  practice?: string;
}

export const LESSONS: Record<string, Lesson[]> = {
  "qubit-and-superposition": [
    {
      title: "A qubit is a direction, not a digit",
      summary: "Why the state of a qubit needs two complex numbers instead of one bit.",
      minutes: 8,
      body: [
        "A classical bit is in one of two states, and you can write it down with a single symbol: 0 or 1. A qubit is not a bit that is secretly one of those and hiding it. Its state is a vector — a direction in a two-dimensional complex space — and the two basis directions of that space are what we call |0⟩ and |1⟩.",
        "Any qubit state is a combination of those two directions. The two numbers in front of them, written α and β below, are called amplitudes. They are complex numbers, and they are what the whole subject is about: every gate you will ever apply is a rule for turning one pair of amplitudes into another.",
        "There is exactly one constraint. The vector has to have length one, because the squared amplitudes are the probabilities of the two measurement outcomes and probabilities have to add to one. That constraint is why a qubit's states form a sphere rather than filling all of space, which is the next lesson but one.",
      ],
      notation: {
        lines: ["|ψ⟩ = α|0⟩ + β|1⟩", "|α|² + |β|² = 1"],
        caption: "α and β are complex. Their squared magnitudes are the two outcome probabilities.",
      },
      practice:
        "Open the sandbox with an empty circuit: one qubit sitting at α = 1, β = 0, which is |0⟩ and the north pole of the Bloch sphere.",
    },
    {
      title: "Amplitudes are not probabilities",
      summary: "The sign is the part that makes a quantum computer worth building.",
      minutes: 10,
      body: [
        "It is tempting to read α and β as probabilities and move on. They are not. Probabilities are real numbers between zero and one. Amplitudes are complex — they can be negative, and they can carry a phase — and you only get a probability out of one by squaring its magnitude.",
        "That difference is not a technicality. Two probabilities can only ever add up. Two amplitudes can cancel. If one path to an outcome carries amplitude +1/√2 and another carries −1/√2, the outcome has amplitude zero and never happens, even though both paths on their own were perfectly likely.",
        "Every quantum algorithm that beats its classical counterpart does it this way: arrange for the amplitudes of the wrong answers to cancel and the amplitudes of the right answer to reinforce. Hold on to that sentence. Grover's search and Deutsch–Jozsa, later in this course, are both that idea and very little else.",
      ],
      notation: {
        lines: [
          "|+⟩ = (|0⟩ + |1⟩)/√2      P(0) = P(1) = 0.5",
          "|−⟩ = (|0⟩ − |1⟩)/√2      P(0) = P(1) = 0.5",
        ],
        caption:
          "Identical probabilities, different states. Nothing you measure in this basis can tell them apart — but they behave completely differently once another gate is applied.",
      },
    },
    {
      title: "The Bloch sphere",
      summary: "Four real numbers, two of which do not matter, leaving a point on a ball.",
      minutes: 9,
      body: [
        "Two complex amplitudes are four real numbers. Normalisation — the length being one — uses up one of them. Global phase, which the last lesson of this module deals with, uses up another, because multiplying the whole state by a phase changes nothing you can measure. Two real numbers are left, and two numbers are exactly what it takes to name a point on the surface of a sphere.",
        "That is the Bloch sphere, and it is not an analogy. Every pure state of one qubit is one point on it and every point is a state. |0⟩ is the north pole, |1⟩ is the south pole, and the equator is where the two are equally likely — the states with a 50/50 measurement in the computational basis, differing only in their phase around the circle.",
        "Watch the length of the arrow as well as its direction. A full-length arrow means the qubit has a definite state of its own. When you reach entanglement, you will see the arrow shrink to nothing while the pair as a whole stays perfectly definite — which is the sharpest picture of entanglement this course can give you.",
      ],
      notation: {
        lines: ["|ψ⟩ = cos(θ/2)|0⟩ + e^(iφ) sin(θ/2)|1⟩"],
        caption: "θ is the angle down from the north pole. φ is the angle around the equator.",
      },
      practice:
        "In the sandbox, place an X on q0 and watch the arrow swing from the north pole to the south. Then clear it and place an H: it lands on the equator.",
    },
    {
      title: "The Hadamard gate",
      summary: "The gate that makes superposition, and undoes it just as reliably.",
      minutes: 10,
      body: [
        "The Hadamard gate is the first gate in almost every circuit in this course. It takes the north pole to the equator: fed |0⟩, it produces an equal superposition of |0⟩ and |1⟩ with both amplitudes positive. Fed |1⟩, it produces the same two outcomes with the |1⟩ amplitude negative.",
        "Look at the matrix. Every entry is ±1/√2, which is what makes the output amplitudes equal in size, and the single minus sign in the bottom right is what distinguishes |+⟩ from |−⟩. That one sign is the entire difference between the two states from the previous lesson.",
        "H is its own inverse. Apply it twice and you are exactly back where you started — H·H is the identity matrix. That fact is more important than it looks, and the next lesson is about why.",
      ],
      notation: {
        lines: ["H = (1/√2) [ 1   1 ]", "             [ 1  −1 ]", "", "H|0⟩ = |+⟩      H|1⟩ = |−⟩"],
      },
      code: "qc.h(0)          # |0> -> |+>",
      practice:
        "Build H on q0 and run it: roughly 50/50. Then add a second H on the same wire and run again — the histogram collapses back to 100% on |0⟩.",
    },
    {
      title: 'Superposition is not "both at once"',
      summary: "The two-Hadamard experiment, and why a random coin cannot fake it.",
      minutes: 11,
      body: [
        "The popular phrasing is that a qubit in superposition is \"both 0 and 1 at the same time\". It is a bad sentence, because it suggests the qubit is secretly one of the two and we simply have not looked. A hidden coin, already heads or tails, would explain a 50/50 measurement just as well.",
        "The two-Hadamard experiment is what rules that out, and you can run it in about thirty seconds. One H on |0⟩ gives 50/50, exactly like a fair coin. Now apply a second H before measuring. If the first H had genuinely flipped a coin, the second would just flip it again and you would still see 50/50. You see 100% |0⟩ instead, every single time.",
        "The state after one H was not a coin that had landed. It was a definite state — a definite direction on the Bloch sphere — and the second H rotated it precisely back. Randomness cannot be undone. A rotation can. That is the whole difference, and it is the reason a quantum computer is not just a fast random number generator.",
      ],
      notation: {
        lines: [
          "H|0⟩      -> 50 / 50      looks like a coin",
          "H·H|0⟩    -> 100 / 0      a coin could never do this",
        ],
      },
      practice:
        "Run H, then H·H, and compare the two histograms. This is the single most convincing thing in the module — do not skip it.",
    },
    {
      title: "Global phase, and what it is not",
      summary: "One phase you can always ignore, and one you never can.",
      minutes: 9,
      body: [
        "Multiply an entire qubit state by a complex number of magnitude one and nothing observable changes. Not the probabilities, not the Bloch vector, not the outcome of any measurement you or anyone else could make. This is global phase, and it is genuinely unphysical — the reason the Bloch sphere needed only two numbers rather than three.",
        "Relative phase is a completely different thing, and confusing the two is the most common mistake at this stage. A phase between |0⟩ and |1⟩ — one amplitude picking up a sign or an angle while the other does not — is entirely physical. It is what separates |+⟩ from |−⟩, it is invisible in the computational basis, and it is what a Hadamard converts into something you can see.",
        "So: a phase in front of the whole state is bookkeeping. A phase between the parts is information. The graded labs in this course check the state you built up to global phase for exactly this reason — a circuit that differs from the target only by that factor is the same circuit, and would be marked wrong by a stricter check for no good reason.",
      ],
      notation: {
        lines: [
          "e^(iγ)|ψ⟩   ≡ |ψ⟩          global — no measurement sees it",
          "(|0⟩ − |1⟩)/√2 ≠ (|0⟩ + |1⟩)/√2   relative — an H tells them apart",
        ],
      },
      practice:
        "Build H then Z then H on q0. The Z is invisible on its own, but the second H turns it into a certain |1⟩ — a relative phase made visible.",
    },
  ],
};

/** Lessons written so far. The rest of the modules still publish their outline. */
export function lessonsFor(slug: string): Lesson[] {
  return LESSONS[slug] ?? [];
}
