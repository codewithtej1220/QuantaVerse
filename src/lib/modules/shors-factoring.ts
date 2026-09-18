import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Shor's Factoring Algorithm — nine lessons. */
export const lessons: Lesson[] = [
  {
    title: "Why factoring matters",
    summary: "The assumption a great deal of the internet is resting on.",
    minutes: 10,
    body: [
      "Multiplying two large primes is easy. Recovering them from the product is, as far as anyone knows, hard — the best classical algorithms take time that grows faster than any polynomial in the number of digits. RSA takes that asymmetry and builds a public-key cryptosystem out of it: the product is published, the factors are the secret, and security rests entirely on nobody being able to get from one to the other.",
      "It is worth being precise about the status of that claim. Nobody has proved factoring is hard. It is an assumption supported by decades of failure to find a fast classical method, which is evidence but not proof, and the whole edifice would fall just as surely to a clever classical breakthrough as to a quantum one.",
      "Shor's algorithm factors in polynomial time on a quantum computer. That is an exponential speed-up over the best known classical method, and unlike Grover's quadratic improvement it is the kind that moves a problem across the line from infeasible to feasible. It is the single result most responsible for the field being funded.",
    ],
    notation: {
      lines: [
        "multiply:  p × q = N          easy",
        "factor:    N -> p, q          believed hard classically",
        "",
        "best classical:  sub-exponential",
        "Shor:            polynomial",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=wXB-V_Keiu8",
      minutes: 17,
      caption:
        "“Public Key Cryptography: RSA Encryption” by Art of the Problem — how RSA works, and why it rests on factoring being hard.",
    },
  },
  {
    title: "Factoring as period finding",
    summary: "The reduction that turns a number-theory problem into a wave problem.",
    minutes: 12,
    body: [
      "Shor's algorithm does not factor directly. It solves a different problem — finding the period of a function — and the reduction from one to the other is entirely classical number theory that predates quantum computing.",
      "Pick a number a with no factor in common with N and look at the sequence a¹, a², a³ … all taken modulo N. It repeats, and the length of the repeat is called the period r. Once you have r, and if r is even and a^(r/2) is not −1 mod N, then the greatest common divisor of a^(r/2) ± 1 with N gives you a genuine factor — computable in moments with Euclid's algorithm.",
      "So the quantum computer's entire job is finding r. Everything before it is choosing a and checking a gcd; everything after it is another gcd. If the conditions fail you pick a different a and try again, and they hold often enough that a handful of attempts suffices.",
    ],
    notation: {
      lines: [
        "find r such that  a^r ≡ 1 (mod N)",
        "",
        "if r is even and a^(r/2) ≢ −1 (mod N):",
        "    gcd(a^(r/2) − 1, N)  and  gcd(a^(r/2) + 1, N)  are factors",
      ],
      caption: "Classical number theory. The quantum part is only the search for r.",
    },
    video: {
      url: "https://www.youtube.com/watch?v=lvTqbM5Dq4Q",
      minutes: 18,
      caption:
        "“How Quantum Computers Break Encryption | Shor’s Algorithm Explained” by minutephysics — the reduction from factoring to finding a period.",
    },
  },
  {
    title: "Modular exponentiation",
    summary: "The part of the circuit that does the real work, and costs the most.",
    minutes: 11,
    body: [
      "The quantum step needs a^x mod N computed for every x at once — that is, as a unitary acting on a register in superposition. This is the oracle of this algorithm, and unlike the toy oracles of the previous two modules it has to be built from arithmetic, in gates, reversibly.",
      "That construction dominates everything. The Fourier transform that gets all the attention is comparatively cheap; the modular exponentiation is where almost all the qubits and almost all the depth go. Estimates for factoring a 2048-bit RSA key run to around a million physical qubits or more, and it is the arithmetic that drives that number rather than the transform.",
      "This is also the honest answer to why nobody has factored anything interesting yet. The algorithm is correct and has been for thirty years; the obstacle is building a machine that can run enough reversible arithmetic without the errors swamping it. That is an engineering problem, but it is a very large one.",
    ],
    notation: {
      lines: [
        "U |x⟩|1⟩  =  |x⟩ |a^x mod N⟩",
        "",
        "cost:  dominates the circuit — most of the qubits, most of the depth",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=EdJ7RoWcU48",
      minutes: 16,
      caption:
        "“Shor’s Algorithm — Coding with Qiskit S2E7” by Qiskit — Shor’s algorithm built in Qiskit, controlled modular multiplications included.",
    },
  },
  {
    title: "The quantum Fourier transform",
    summary: "The same transform as the classical one, applied to amplitudes.",
    minutes: 12,
    body: [
      "The Fourier transform takes a signal and reports which frequencies it contains. Feed it something periodic and you get a sharp spike at the period's frequency — which is exactly the tool you want when the thing you are hunting is a period.",
      "The quantum version does the same job to the amplitudes of a register. Where a classical FFT on 2ⁿ samples costs about n·2ⁿ operations, the QFT costs about n² gates, because it is transforming an exponentially large vector held in n qubits rather than an array in memory. That is a genuinely exponential saving, and it is the engine of the algorithm.",
      "The catch is the one that runs through this whole course. You cannot read the transformed amplitudes out — a measurement gives you one outcome sampled from them, not the spectrum. The QFT is not a way to compute a Fourier transform and look at it; it is a way to arrange for a measurement to land on something useful, which is what the next lesson is about.",
    ],
    notation: {
      lines: [
        "classical FFT:  ~ n · 2ⁿ operations on 2ⁿ samples",
        "QFT:            ~ n² gates on n qubits",
        "",
        "but: you cannot read the spectrum, only sample from it",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=ha5Fs6l-vGk",
      minutes: 18,
      caption:
        "“The Quantum Fourier Transform Explained with Music” by Qiskit — the transform on amplitudes, heard as well as seen.",
    },
  },
  {
    title: "Reading a period",
    summary: "What the measurement after the QFT actually gives you.",
    minutes: 12,
    body: [
      "After the modular exponentiation the first register holds a superposition whose amplitudes repeat with period r. Applying the QFT concentrates those amplitudes onto values that are close to multiples of 2ⁿ/r, and measuring gives you one of them — chosen at random, and only approximately.",
      "So a single run gives a number of the form roughly k·2ⁿ/r for some k you do not know. That is less than you wanted and more than nothing: it is a fraction whose denominator is the period you are after, measured with limited precision, which turns the remaining problem into one of rational approximation.",
      "This step is called phase estimation, and it is worth naming because it is reusable. Estimating the eigenvalue phase of a unitary is a subroutine in its own right, and it appears in quantum chemistry and linear-algebra algorithms well away from factoring. Shor's is the most famous consumer of it rather than the only one.",
    ],
    notation: {
      lines: [
        "measured value  m  ≈  k · 2ⁿ / r      for some unknown k",
        "",
        "so   m / 2ⁿ  ≈  k / r",
      ],
      caption: "A fraction whose denominator is the answer, known only approximately.",
    },
    video: {
      url: "https://www.youtube.com/watch?v=vOvCIU7U0vU",
      minutes: 29,
      caption:
        "“Quantum Period-Finding Algorithm, Order-Finding, Phase Estimation, Modular Exponentiation” by Elucyda — what the measurement gives you, and how the period comes out of it.",
    },
  },
  {
    title: "Continued fractions",
    summary: "The classical trick that recovers r from an approximate fraction.",
    minutes: 11,
    body: [
      "You have m/2ⁿ, which is approximately k/r with both k and r unknown. The continued-fraction expansion is the standard method for finding the simplest fraction close to a given decimal, and it recovers r from that approximation efficiently.",
      "It does not always work. The k you happened to measure may share a factor with r, in which case the expansion returns a divisor of the period rather than the period itself. This is why the algorithm is probabilistic: you check whether your candidate r actually satisfies a^r ≡ 1 mod N, and if not you run the quantum part again and try the next measurement.",
      "The check is cheap and the failure rate is modest, so a small number of repetitions gives a correct answer with high confidence. That structure — a quantum step that usually helps, wrapped in a cheap classical check that always catches a failure — is a common and practical shape for quantum algorithms, and worth recognising as a pattern.",
    ],
    notation: {
      lines: [
        "m / 2ⁿ  ->  continued fractions  ->  candidate r",
        "",
        "verify:  a^r ≡ 1 (mod N) ?",
        "  yes  ->  done",
        "  no   ->  run the quantum part again",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=R5HhNmFPLPQ",
      minutes: 7,
      caption:
        "“Continued Fractions 1: Introduction and Basic Examples” by CrystalMath — the classical tool on its own, before it is pointed at s/r.",
    },
  },
  {
    title: "The whole algorithm",
    summary: "Every step in order, and how little of it is quantum.",
    minutes: 10,
    body: [
      "Put end to end: pick a random a below N, and take gcd(a, N) — if it is not 1 you have stumbled on a factor and are finished, which is rare but free to check. Otherwise run the quantum subroutine to get a measurement, use continued fractions to propose r, and verify it classically. With r in hand, compute the two gcds and read off the factors.",
      "Count how much of that is quantum: one subroutine. The rest is Euclid's algorithm, a random choice, and a rational approximation — all of it classical, all of it fast, and none of it new. Shor's contribution was seeing that period-finding was the bottleneck and that a quantum computer could do that one thing exponentially faster.",
      "That shape is typical rather than unusual. Practical quantum algorithms tend to be classical programs with a quantum subroutine called from inside a loop, and the subroutine does one specific thing that classical hardware finds hard. A quantum computer is a co-processor, not a replacement.",
    ],
    notation: {
      lines: [
        "1. pick a,  check gcd(a, N)              classical",
        "2. quantum period finding  ->  m         quantum",
        "3. continued fractions  ->  r            classical",
        "4. verify  a^r ≡ 1 (mod N)               classical",
        "5. gcd(a^(r/2) ± 1, N)  ->  factors      classical",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=FRZQ-efABeQ",
      minutes: 6,
      caption:
        "“How Shor’s Algorithm Factors 314191” by minutephysics — every step, run on one real number.",
    },
  },
  {
    title: "Error budgets",
    summary: "Why the famous demonstrations factor 15, and why that is not a scandal.",
    minutes: 12,
    body: [
      "Physical qubits are noisy. Gates misfire at rates around one in a thousand on good hardware, and states decay on timescales that a deep circuit easily exceeds. A circuit with a million sequential gates and a one-in-a-thousand error rate produces noise, not an answer — the errors compound long before the end.",
      "Error correction is the response, and it is expensive. Many physical qubits are combined into one logical qubit that behaves far better than any of its parts, and current estimates put that ratio at roughly a thousand to one for the code distances a factoring circuit would need. That is where the million-qubit figures come from: it is logical qubits by the thousand multiplied by the correction overhead.",
      "So a demonstration factoring 15 is not a cheat, and it is not evidence the algorithm is wrong. It is evidence that the machine is small. The gap between 15 and a 2048-bit key is entirely an engineering gap in qubit count and error rate, and the honest summary is that the algorithm has been ready for decades and the hardware has not.",
    ],
    notation: {
      lines: [
        "gate error ~ 10⁻³",
        "a circuit of 10⁶ gates  ->  error is certain without correction",
        "",
        "logical qubit ≈ 10³ physical qubits",
        "RSA-2048  ->  thousands of logical  ->  around a million physical, or more",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=9be41egAbes",
      minutes: 10,
      caption:
        "“Every Qubit Is Broken. Here’s the Fix.” by Qiskit — noisy physical qubits, and the error correction that turns many of them into one good one.",
    },
  },
  {
    title: "What this means for cryptography",
    summary: "What breaks, what does not, and why the migration started already.",
    minutes: 11,
    body: [
      "Shor's algorithm breaks RSA, Diffie–Hellman and elliptic-curve cryptography, because all three rest on a problem it solves — factoring or the closely related discrete logarithm. Symmetric encryption and hash functions are not affected in the same way: as the Grover module showed, they lose half their key strength and are repaired by doubling the key.",
      "The response is post-quantum cryptography: public-key schemes built on problems with no known quantum attack, mostly from lattices and error-correcting codes. NIST has been standardising these since 2016 and published its first finished standards in 2024. The transition is a large engineering programme and it is already under way.",
      "The reason for starting before a machine exists is harvest-now-decrypt-later. An adversary can record encrypted traffic today and decrypt it whenever a capable machine arrives, so anything that must stay secret for a decade is already at risk. That argument, rather than any imminent demonstration, is what is driving the migration — and it is the most practical reason anyone has to understand this algorithm.",
    ],
    notation: {
      lines: [
        "broken by Shor:   RSA, Diffie–Hellman, elliptic curve",
        "weakened by Grover: symmetric ciphers, hashes  ->  double the key",
        "unaffected so far:  lattice- and code-based schemes",
      ],
    },
    video: {
      url: "https://www.youtube.com/watch?v=_MoRcYLN-7U",
      minutes: 13,
      caption:
        "“Post Quantum Cryptography” by Computerphile — the replacement schemes, and why the switch is happening before the machines exist.",
    },
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What is RSA's security resting on?",
      options: [
        "A proof that factoring is hard",
        "The assumption that factoring is hard, supported by decades of failed attempts",
        "The size of the key alone",
        "Quantum mechanics",
      ],
      answer: 1,
      because: "An assumption, not a theorem. A classical breakthrough would break it just as surely.",
    },
    {
      prompt: "Shor's speed-up over the best classical method is:",
      options: ["Quadratic", "Exponential", "Linear", "Constant"],
      answer: 1,
      because: "Which is the kind that moves a problem from infeasible to feasible.",
    },
    {
      prompt: "Multiplying two large primes is:",
      options: ["Hard", "Easy", "Impossible", "The same difficulty as factoring"],
      answer: 1,
      because: "The asymmetry between the two directions is the entire basis of RSA.",
    },
    {
      prompt: "Why is this result significant for the field?",
      options: [
        "It is the simplest quantum algorithm",
        "It is the single result most responsible for the field being funded",
        "It runs on today's hardware",
        "It requires no error correction",
      ],
      answer: 1,
      because: "A concrete, valuable, exponentially faster application changed how the field was resourced.",
    },
  ],
  [
    {
      prompt: "What does Shor's algorithm actually solve?",
      options: ["Factoring directly", "Finding the period of a function", "Discrete search", "Matrix inversion"],
      answer: 1,
      because: "Period finding. The link to factoring is classical number theory.",
    },
    {
      prompt: "What is r, the period?",
      options: [
        "The number of qubits",
        "The smallest r with a^r ≡ 1 (mod N)",
        "A factor of N",
        "The measurement outcome",
      ],
      answer: 1,
      because: "The length of the repeat in the sequence a¹, a², a³ … mod N.",
    },
    {
      prompt: "Once you have r, how do you get a factor?",
      options: [
        "Another quantum circuit",
        "gcd(a^(r/2) ± 1, N), with Euclid's algorithm",
        "Trial division",
        "The QFT again",
      ],
      answer: 1,
      because: "Computable in moments classically — provided r is even and a^(r/2) ≢ −1 mod N.",
    },
    {
      prompt: "If those conditions fail?",
      options: ["The algorithm fails permanently", "Pick a different a and try again", "Double the qubits", "Use Grover instead"],
      answer: 1,
      because: "They hold often enough that a handful of attempts suffices.",
    },
  ],
  [
    {
      prompt: "What does the modular exponentiation step compute?",
      options: [
        "The period directly",
        "a^x mod N for every x at once, as a unitary",
        "The greatest common divisor",
        "The Fourier transform",
      ],
      answer: 1,
      because: "It is this algorithm's oracle, and unlike the toy ones it is real reversible arithmetic.",
    },
    {
      prompt: "Which part of the circuit dominates the cost?",
      options: ["The QFT", "The modular exponentiation", "The measurement", "The Hadamards"],
      answer: 1,
      because: "Most of the qubits and most of the depth. The transform that gets the attention is comparatively cheap.",
    },
    {
      prompt: "Why has nothing interesting been factored yet?",
      options: [
        "The algorithm is wrong",
        "Building a machine that can run enough reversible arithmetic without errors swamping it",
        "Nobody has tried",
        "It is classified",
      ],
      answer: 1,
      because: "The algorithm has been correct for thirty years. The obstacle is engineering.",
    },
    {
      prompt: "Estimates for RSA-2048 run to:",
      options: ["Hundreds of qubits", "Thousands of qubits", "Around a million physical qubits or more", "A dozen qubits"],
      answer: 2,
      because: "And it is the arithmetic that drives that number rather than the transform.",
    },
  ],
  [
    {
      prompt: "What does a Fourier transform report?",
      options: [
        "The average of a signal",
        "Which frequencies a signal contains",
        "The signal's length",
        "The signal's noise level",
      ],
      answer: 1,
      because: "Which is exactly the tool you want when hunting a period.",
    },
    {
      prompt: "Roughly how many gates does the QFT need on n qubits?",
      options: ["n", "n²", "2ⁿ", "n · 2ⁿ"],
      answer: 1,
      because: "About n², against about n·2ⁿ operations for a classical FFT on the same-sized vector.",
    },
    {
      prompt: "Can you read the transformed amplitudes out?",
      options: [
        "Yes, that is the point",
        "No — a measurement samples one outcome, it does not return the spectrum",
        "Yes, on a simulator only",
        "Only the largest one",
      ],
      answer: 1,
      because: "The QFT arranges for a measurement to land somewhere useful; it does not hand you a spectrum.",
    },
    {
      prompt: "Where does the exponential saving come from?",
      options: [
        "Faster gates",
        "Transforming an exponentially large vector held in n qubits rather than an array in memory",
        "Parallel measurement",
        "Error correction",
      ],
      answer: 1,
      because: "n² gates operating on 2ⁿ amplitudes is the whole trick.",
    },
  ],
  [
    {
      prompt: "After the QFT, the measured value is approximately:",
      options: ["r", "k · 2ⁿ / r for unknown k", "2ⁿ / r exactly", "a random number"],
      answer: 1,
      because: "A multiple, chosen at random, and known only approximately.",
    },
    {
      prompt: "So what problem is left after the measurement?",
      options: [
        "Another quantum circuit",
        "Rational approximation — recovering r from m/2ⁿ ≈ k/r",
        "Trial division",
        "Nothing, you have r",
      ],
      answer: 1,
      because: "A fraction whose denominator is the answer, measured with limited precision.",
    },
    {
      prompt: "What is this step called?",
      options: ["Amplitude amplification", "Phase estimation", "Transpilation", "Phase kickback"],
      answer: 1,
      because: "And it is reusable — it appears in chemistry and linear-algebra algorithms too.",
    },
    {
      prompt: "Is Shor's the only consumer of phase estimation?",
      options: ["Yes", "No — it is the most famous one", "It is not used elsewhere", "Only in Grover"],
      answer: 1,
      because: "Estimating a unitary's eigenvalue phase is a subroutine in its own right.",
    },
  ],
  [
    {
      prompt: "What do continued fractions do here?",
      options: [
        "Compute the gcd",
        "Find the simplest fraction close to a decimal, recovering r",
        "Perform the Fourier transform",
        "Correct errors",
      ],
      answer: 1,
      because: "It is the standard efficient method for exactly this.",
    },
    {
      prompt: "When does the step fail?",
      options: [
        "When N is even",
        "When the measured k shares a factor with r, giving a divisor instead of the period",
        "When a is prime",
        "It never fails",
      ],
      answer: 1,
      because: "You get a divisor of the period rather than the period itself.",
    },
    {
      prompt: "How is that failure caught?",
      options: [
        "It is not",
        "Check whether a^r ≡ 1 (mod N)",
        "Run the QFT twice",
        "Compare against a table",
      ],
      answer: 1,
      because: "A cheap classical check that always catches a failure.",
    },
    {
      prompt: "What general pattern does that illustrate?",
      options: [
        "Quantum algorithms are always deterministic",
        "A quantum step that usually helps, wrapped in a cheap classical check",
        "Errors cannot be detected",
        "Classical verification is impossible",
      ],
      answer: 1,
      because: "A common and practical shape for quantum algorithms.",
    },
  ],
  [
    {
      prompt: "How much of Shor's algorithm is quantum?",
      options: ["All of it", "One subroutine", "Half", "Only the measurement"],
      answer: 1,
      because: "Period finding. The rest is Euclid, a random choice and a rational approximation.",
    },
    {
      prompt: "What do you do first?",
      options: [
        "Run the QFT",
        "Pick a random a and check gcd(a, N)",
        "Build the oracle",
        "Measure",
      ],
      answer: 1,
      because: "Rare to succeed, but free to check — and if it does, you are finished.",
    },
    {
      prompt: "What was Shor's actual contribution?",
      options: [
        "Inventing the Fourier transform",
        "Seeing that period-finding was the bottleneck and that a quantum computer could do it exponentially faster",
        "Building the first quantum computer",
        "Proving factoring is hard",
      ],
      answer: 1,
      because: "The reduction and the number theory were already known.",
    },
    {
      prompt: "The typical shape of a practical quantum algorithm is:",
      options: [
        "Entirely quantum",
        "A classical program calling a quantum subroutine from inside a loop",
        "A single circuit run once",
        "Quantum hardware replacing classical hardware",
      ],
      answer: 1,
      because: "A quantum computer is a co-processor, not a replacement.",
    },
  ],
  [
    {
      prompt: "Typical gate error rates on good hardware are around:",
      options: ["1 in 10", "1 in 1,000", "1 in 10⁹", "Zero"],
      answer: 1,
      because: "Which a circuit of a million sequential gates comfortably exceeds.",
    },
    {
      prompt: "Roughly how many physical qubits make one logical qubit, for this purpose?",
      options: ["2", "10", "About 1,000", "1,000,000"],
      answer: 2,
      because: "Which is where the million-physical-qubit estimates come from.",
    },
    {
      prompt: "Demonstrations factoring 15 show that:",
      options: [
        "The algorithm is wrong",
        "The machine is small",
        "Factoring is easy",
        "Error correction is unnecessary",
      ],
      answer: 1,
      because: "The gap to a 2048-bit key is entirely engineering: qubit count and error rate.",
    },
    {
      prompt: "The honest summary of the situation is:",
      options: [
        "The algorithm is not ready",
        "The algorithm has been ready for decades; the hardware has not",
        "Both are ready",
        "Neither will ever be ready",
      ],
      answer: 1,
      because: "Correctness was settled in 1994. Everything since has been an engineering problem.",
    },
  ],
  [
    {
      prompt: "Which of these does Shor's algorithm break?",
      options: ["AES", "SHA-256", "RSA and elliptic-curve cryptography", "Lattice-based schemes"],
      answer: 2,
      because: "All the public-key schemes resting on factoring or discrete logarithms.",
    },
    {
      prompt: "What happens to symmetric ciphers?",
      options: [
        "They break completely",
        "They lose half their key strength and are repaired by doubling the key",
        "They are unaffected entirely",
        "They become faster",
      ],
      answer: 1,
      because: "That is the Grover result, and the fix is straightforward.",
    },
    {
      prompt: "What is post-quantum cryptography built on?",
      options: [
        "Larger RSA keys",
        "Problems with no known quantum attack, mostly lattices and error-correcting codes",
        "Quantum hardware",
        "One-time pads only",
      ],
      answer: 1,
      because: "NIST has been standardising these since 2016 and published finished standards in 2024.",
    },
    {
      prompt: "Why migrate before a capable machine exists?",
      options: [
        "Regulatory deadlines",
        "Harvest-now-decrypt-later — traffic recorded today can be decrypted later",
        "It is cheaper now",
        "There is no reason to",
      ],
      answer: 1,
      because: "Anything that must stay secret for a decade is already at risk.",
    },
  ],
];
