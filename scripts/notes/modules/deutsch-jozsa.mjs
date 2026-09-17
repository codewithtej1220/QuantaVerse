const notes = {
  slug: "deutsch-jozsa",
  title: "The Deutsch–Jozsa Algorithm",
  track: "Algorithms",
  summary:
    "The first algorithm with a provable quantum advantage. One oracle query decides what a classical machine needs 2ⁿ⁻¹+1 queries to decide.",
  conventions:
    "$x$ and $z$ are $n$-bit strings, written $x_{n-1}\\cdots x_1x_0$ as Qiskit prints them, so 01 means $x_0 = 1$. $\\oplus$ is XOR, and $x\\cdot z = x_0z_0 \\oplus \\cdots \\oplus x_{n-1}z_{n-1}$ is the bitwise inner product mod 2. The input register has $n$ qubits and the answer (ancilla) register one.",
  lessons: [
    {
      title: "The problem",
      summary: "A question with a silly premise and an honest answer about speed-ups.",
      notes: String.raw`
idea: A function is promised to be either constant or balanced, and the task is to tell which. A deterministic classical algorithm needs, in the worst case, just over half of all inputs. The quantum algorithm needs one query.
eq*: f : \{0,1\}^n \to \{0,1\}, \qquad \text{constant: } f(x) = c\ \ \forall x, \qquad \text{balanced: } \left|f^{-1}(0)\right| = \left|f^{-1}(1)\right| = 2^{n-1} ;; the promise
p: Classically, each query reveals one value $f(x)$. Seeing two different values proves "balanced" at once, but seeing only equal values proves nothing until more than half of the inputs have been checked: a balanced function can hide all its 1s in the half not yet asked about.
eq*: Q_{\text{classical, deterministic}} = 2^{n-1} + 1, \qquad Q_{\text{quantum}} = 1 ;; worst-case queries
eq: \#\{\text{constant } f\} = 2, \qquad \#\{\text{balanced } f\} = \binom{2^n}{2^{n-1}} ;; how many functions satisfy the promise
p: The case $n = 1$ is Deutsch's original problem: is $f(0) = f(1)$? Classically that takes two evaluations, and the quantum circuit takes one.
table: $n$ | Inputs $2^n$ | Classical worst case | Quantum ;; $1$ | $2$ | $2$ | $1$ ;; $3$ | $8$ | $5$ | $1$ ;; $10$ | $1024$ | $513$ | $1$ ;; $50$ | $\approx 1.1\times10^{15}$ | $\approx 5.6\times10^{14}$ | $1$
p: A randomised classical algorithm does far better than the worst case. If $f$ is balanced, $k$ random queries all return the same value with probability at most $2^{1-k}$, so a few queries give high confidence. The honest summary is an *exact* separation, not a practical one.
eq: P(\text{a balanced } f \text{ looks constant after } k \text{ random queries}) \le 2^{1-k} ;; why randomness nearly closes the gap
ex: n = 2, all six balanced functions ;; On inputs $00, 01, 10, 11$ a balanced $f$ has exactly two 1s: $\binom42 = 6$ choices, for example $f(x) = x_0$, $f(x) = x_1$ and $f(x) = x_0\oplus x_1$. A classical algorithm that has seen $f(00) = f(01) = 0$ still cannot rule out $f = x_1$, so it must ask a third time.
`,
    },
    {
      title: "Oracles",
      summary: "How a function becomes a gate you can put in a circuit.",
      notes: String.raw`
idea: A quantum gate must be reversible, but most functions are not. The standard fix keeps the input and XORs the output onto an extra qubit.
eq*: U_f\ket{x}\ket{y} = \ket{x}\ket{y\oplus f(x)} ;; the bit oracle
eq*: U_f^2 = I \quad\text{since}\quad y\oplus f(x)\oplus f(x) = y ;; every such oracle is its own inverse, whatever $f$ is
p: The map $\ket{x}\mapsto\ket{f(x)}$ would not be a gate: two inputs with the same output cannot be told apart afterwards, so no unitary does it. Keeping $x$ makes the map a permutation of basis states, which is always unitary.
table: Function | Oracle circuit ;; $f(x) = 0$ | nothing: the identity ;; $f(x) = 1$ | $X$ on the answer qubit ;; $f(x) = x_i$ | CNOT from input $i$ to the answer ;; $f(x) = x_0\oplus x_1$ | CNOT from input 0, then CNOT from input 1 ;; $f(x) = s\cdot x$ | one CNOT from each input $i$ with $s_i = 1$
eq: f(x) = s\cdot x \;\Rightarrow\; U_f = \prod_{i\,:\,s_i = 1}\mathrm{CNOT}_{x_i\to y} ;; linear oracles are just CNOTs
p: When the answer qubit is prepared in $\ket{-}$, the bit oracle acts as a *phase oracle* on the input register alone (lesson 6.3). Many algorithms, Grover's included, are written with the phase form directly.
eq*: O_f\ket{x} = (-1)^{f(x)}\ket{x} ;; the phase oracle
def: Query ;; One application of $U_f$ or $O_f$. Query complexity counts only these calls and ignores the rest of the circuit. That is what makes separations provable, and also what limits what they say (lesson 6.5).
ex: The walkthrough's oracle ;; For $f(x_0, x_1) = x_0 \oplus x_1$, applying CNOT from $x_0$ and then from $x_1$ gives $\ket{x_0x_1}\ket{y} \mapsto \ket{x_0x_1}\ket{y\oplus x_0\oplus x_1}$. On $\ket{10}\ket{0}$ the answer qubit becomes 1, and on $\ket{11}\ket{0}$ it returns to 0: balanced, with two 1s among four inputs.
`,
    },
    {
      title: "Phase kickback",
      summary: "The trick that moves the oracle's answer out of the ancilla and into a phase.",
      notes: String.raw`
idea: With the answer qubit in $\ket{-}$, the oracle leaves that qubit unchanged and multiplies the input term by $(-1)^{f(x)}$. The answer arrives as a sign.
eq*: U_f\ket{x}\ket{-} = (-1)^{f(x)}\ket{x}\ket{-} ;; phase kickback
eq: U_f\ket{x}\frac{\ket{0}-\ket{1}}{\sqrt2} = \ket{x}\frac{\ket{f(x)} - \ket{1\oplus f(x)}}{\sqrt2} = (-1)^{f(x)}\ket{x}\frac{\ket{0}-\ket{1}}{\sqrt2} ;; the derivation: if $f(x) = 1$ the two terms swap, which is a sign
p: On a single basis input the sign is a global phase and means nothing. On a superposition of inputs, every input picks up its own sign, which makes it a *relative* phase: the whole truth table of $f$ written into the signs of one state.
eq*: U_f\left(\frac{1}{\sqrt{2^n}}\sum_x\ket{x}\right)\ket{-} = \left(\frac{1}{\sqrt{2^n}}\sum_x(-1)^{f(x)}\ket{x}\right)\ket{-} ;; one query, every value of $f$, stored as signs
p: The answer qubit is prepared from $\ket{0}$ by $X$ then $H$. It ends in $\ket{-}$ again, unentangled from the input register, so it can be ignored.
eq: HX\ket{0} = H\ket{1} = \ket{-} ;; preparing the ancilla
circuit: Deutsch–Jozsa, n = 2
x0: |0⟩ ─────H──┤    ├──H──M
x1: |0⟩ ─────H──┤ Uf ├──H──M
 y: |0⟩ ──X──H──┤    ├──────
:end
ex: Signs for f = x0 ⊕ x1 ;; After the first Hadamards the inputs are $\tfrac12(\ket{00} + \ket{01} + \ket{10} + \ket{11})$. ;; The oracle multiplies each term by $(-1)^{x_0\oplus x_1}$, giving $\tfrac12(\ket{00} - \ket{01} - \ket{10} + \ket{11})$. The probabilities are still a quarter each, so the information is present but not yet readable.
`,
    },
    {
      title: "Interference",
      summary: "A final layer of Hadamards, and why the answer lands on all zeros.",
      notes: String.raw`
idea: A second layer of Hadamards turns the pattern of signs into amplitudes. Every path to $\ket{0\cdots0}$ adds up when $f$ is constant and cancels exactly when $f$ is balanced.
eq*: H^{\otimes n}\ket{x} = \frac{1}{\sqrt{2^n}}\sum_z(-1)^{x\cdot z}\ket{z} ;; the Hadamard transform of a basis state
eq*: \ket{\psi_{\text{final}}} = \sum_z\left[\frac{1}{2^n}\sum_x(-1)^{f(x) + x\cdot z}\right]\ket{z} ;; the input register just before measurement
p: The amplitude of the all-zero string has $x\cdot 0 = 0$ in every term, so it is simply the average of the signs.
eq*: \alpha_{0\cdots0} = \frac{1}{2^n}\sum_x(-1)^{f(x)} = \begin{cases}\pm1 & f \text{ constant}\\ 0 & f \text{ balanced}\end{cases} ;; the decision rule
p: A constant $f$ puts all the amplitude on $\ket{0\cdots0}$, so measurement returns all zeros with certainty. A balanced $f$ has exactly as many $+1$ as $-1$ terms, so all zeros never appears, and any other result means balanced. No probability is involved in either case.
table: Measured string | Conclusion | Certainty ;; $0\cdots0$ | constant | exact ;; anything else | balanced | exact
ex: Finishing f = x0 ⊕ x1 ;; For $z = 11$: $x\cdot z = x_0\oplus x_1 = f(x)$, so every exponent $f(x) + x\cdot z$ is even and $\alpha_{11} = \tfrac14(1+1+1+1) = 1$. ;; The measurement returns 11 every time. That is not all zeros, so $f$ is balanced, decided with one query. The walkthrough on the algorithms page shows the same four signs combining.
note: In general the balanced case can spread its amplitude over many strings. Only the zero string is guaranteed to be empty, and that is all the algorithm needs.
`,
    },
    {
      title: "Query complexity",
      summary: "What was actually proved, and what it does not say.",
      notes: String.raw`
idea: Deutsch–Jozsa proves an exponential separation between exact quantum and deterministic classical query complexity. It does not prove a practical speed-up, because randomised classical algorithms need only a few queries.
table: Model | Queries | Error ;; deterministic classical | $2^{n-1} + 1$ | none ;; randomised classical | $O(\log 1/\varepsilon)$ | $\varepsilon$ ;; quantum (Deutsch–Jozsa) | $1$ | none
p: The same circuit solves a sibling problem with a more useful separation. In *Bernstein–Vazirani* the oracle computes $f(x) = s\cdot x$ for a hidden string $s$, and one query returns all of $s$. Classically each query yields at most one bit of $s$, so $n$ queries are needed even with randomness.
eq*: f(x) = s\cdot x \;\Rightarrow\; H^{\otimes n}\,O_f\,H^{\otimes n}\ket{0}^{\otimes n} = \ket{s} ;; Bernstein–Vazirani: the hidden string, read in one query
eq: \frac{1}{2^n}\sum_x(-1)^{s\cdot x + z\cdot x} = \frac{1}{2^n}\sum_x(-1)^{(s\oplus z)\cdot x} = \begin{cases}1 & z = s\\ 0 & z\ne s\end{cases} ;; why every other string cancels
p: *Simon's problem* goes further: a function hides a string $s$ with $f(x) = f(y) \iff y \in \{x, x\oplus s\}$. A quantum algorithm needs $O(n)$ queries, while any classical algorithm, randomised or not, needs about $2^{n/2}$. Simon's algorithm directly inspired Shor's (module 8).
eq*: Q_{\text{Simon, quantum}} = O(n), \qquad Q_{\text{Simon, classical}} = \Omega\!\left(2^{n/2}\right) ;; an exponential separation that randomness cannot close
def: Oracle separation ;; A proof about how many calls to a black box are needed. It says nothing about any function written out explicitly, where a classical algorithm may read the circuit and skip the queries entirely.
ex: Bernstein–Vazirani, n = 2 ;; With $s = 01$ (so $f(x) = x_0$), the walkthrough's oracle is one CNOT from $x_0$. After the final Hadamards the register reads $x_1x_0 = 01$ with certainty: the secret, from a single query, where two classical queries (inputs 01 and 10) would be needed.
`,
    },
  ],
};

export default notes;
