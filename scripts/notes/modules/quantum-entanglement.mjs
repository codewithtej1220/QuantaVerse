const notes = {
  slug: "quantum-entanglement",
  title: "Quantum Entanglement",
  track: "Foundations",
  summary:
    "Wire two qubits into a Bell pair, prove the correlation is not classical, and read a CHSH inequality that hardware actually violates.",
  conventions:
    "In this module a two-qubit ket $\\ket{ab}$ lists the first qubit first, as textbooks do, and in CNOT formulas the first qubit is the control. Qiskit prints the same state with the order reversed (lesson 2.5). $\\rho$ is a density matrix and $\\mathrm{Tr}_B$ the partial trace over qubit $B$.",
  lessons: [
    {
      title: "Two qubits",
      summary: "Four amplitudes, not two — and why the space grows the way it does.",
      notes: String.raw`
idea: Two qubits have four amplitudes, one per two-bit string. $n$ qubits have $2^n$, and most of those states cannot be split into one state per qubit.
eq*: \ket{\psi} = \alpha_{00}\ket{00} + \alpha_{01}\ket{01} + \alpha_{10}\ket{10} + \alpha_{11}\ket{11}, \qquad \sum_{x}|\alpha_x|^2 = 1 ;; the general two-qubit state
p: Independent qubits combine by the *tensor product*. Each amplitude of the pair is a product of one amplitude from each qubit.
eq*: (a_0\ket{0} + a_1\ket{1})\otimes(b_0\ket{0} + b_1\ket{1}) = a_0b_0\ket{00} + a_0b_1\ket{01} + a_1b_0\ket{10} + a_1b_1\ket{11} ;; a product state
p: A product state satisfies $\alpha_{00}\alpha_{11} = a_0b_0a_1b_1 = \alpha_{01}\alpha_{10}$. The converse also holds, which gives a one-line test for whether a two-qubit pure state is entangled.
eq*: \ket{\psi}\ \text{is a product state} \iff \alpha_{00}\alpha_{11} = \alpha_{01}\alpha_{10} ;; the product test for two qubits
p: Gates on one qubit of a pair act through the tensor product too: $A\otimes B$ applies $A$ to the first qubit and $B$ to the second, and $A\otimes I$ touches only the first.
eq: (A\otimes B)\left(\ket{a}\otimes\ket{b}\right) = A\ket{a}\otimes B\ket{b}, \qquad \dim\left(\mathbb{C}^2\right)^{\otimes n} = 2^n ;; operators on a register, and its size
table: Qubits $n$ | Amplitudes $2^n$ | Real parameters $2^{n+1} - 2$ | Memory for a statevector ;; $1$ | $2$ | $2$ | 32 bytes ;; $2$ | $4$ | $6$ | 64 bytes ;; $10$ | $1024$ | $2046$ | 16 KB ;; $30$ | $\approx 1.07\times10^{9}$ | $\approx 2.1\times10^{9}$ | 16 GB
ex: Product or entangled? ;; $\tfrac12(\ket{00} + \ket{01} + \ket{10} + \ket{11})$: $\alpha_{00}\alpha_{11} = \tfrac14 = \alpha_{01}\alpha_{10}$, so it is a product, namely $\ket{+}\otimes\ket{+}$. ;; $\tfrac{1}{\sqrt2}(\ket{00} + \ket{11})$: $\alpha_{00}\alpha_{11} = \tfrac12$ but $\alpha_{01}\alpha_{10} = 0$, so no choice of single-qubit states produces it.
`,
    },
    {
      title: "CNOT",
      summary: "The gate that makes one qubit's behaviour depend on another's.",
      notes: String.raw`
idea: CNOT flips the target when the control is 1. On basis states it is a classical XOR; on a control in superposition it creates entanglement.
eq*: \mathrm{CNOT}\,\ket{c}\ket{t} = \ket{c}\ket{t\oplus c} ;; controlled-NOT: control $c$, target $t$
eq: \mathrm{CNOT} = \begin{pmatrix}1&0&0&0\\0&1&0&0\\0&0&0&1\\0&0&1&0\end{pmatrix} = \ket{0}\!\bra{0}\otimes I + \ket{1}\!\bra{1}\otimes X ;; in the basis $\ket{00}, \ket{01}, \ket{10}, \ket{11}$
table: Input $\ket{ct}$ | Output | What happened ;; $\ket{00}$ | $\ket{00}$ | control 0: nothing ;; $\ket{01}$ | $\ket{01}$ | control 0: nothing ;; $\ket{10}$ | $\ket{11}$ | control 1: target flipped ;; $\ket{11}$ | $\ket{10}$ | control 1: target flipped
p: CNOT is its own inverse and a Clifford gate. Its behaviour depends on the basis: in the X basis the roles of control and target swap, so information can flow "backwards" from target to control.
eq: \mathrm{CNOT}^2 = I, \qquad (H\otimes H)\,\mathrm{CNOT}_{1\to2}\,(H\otimes H) = \mathrm{CNOT}_{2\to1} ;; self-inverse, and reversed by Hadamards
p: The reversal has a useful special case, *phase kickback*. With the target in $\ket{-}$, flipping the target only multiplies it by $-1$, and that sign lands on the control instead.
eq*: \mathrm{CNOT}\,\ket{c}\ket{-} = (-1)^{c}\,\ket{c}\ket{-} ;; phase kickback: the target is unchanged, the control picks up the sign
ex: Kickback onto a superposition ;; Control in $\ket{+}$, target in $\ket{-}$: $\mathrm{CNOT}\,\ket{+}\ket{-} = \tfrac{1}{\sqrt2}\left(\ket{0}\ket{-} - \ket{1}\ket{-}\right) = \ket{-}\ket{-}$. ;; The target did not change at all, yet the control turned from $\ket{+}$ into $\ket{-}$. Deutsch–Jozsa and Bernstein–Vazirani are built on this.
`,
    },
    {
      title: "Making a Bell pair",
      summary: "Two gates, and the smallest circuit no classical machine can imitate.",
      notes: String.raw`
idea: A Hadamard puts the control in superposition and a CNOT copies that bit value onto the target. The result is a pair with no individual states and perfectly correlated outcomes.
circuit: The Bell-pair circuit
q0: |0⟩ ──H────●──
               │
q1: |0⟩ ───────⊕──
:end
eq*: \mathrm{CNOT}\,(H\otimes I)\ket{00} = \mathrm{CNOT}\,\frac{\ket{00} + \ket{10}}{\sqrt2} = \frac{\ket{00} + \ket{11}}{\sqrt2} = \ket{\Phi^+} ;; step by step
eq*: \ket{\Phi^\pm} = \frac{\ket{00} \pm \ket{11}}{\sqrt2}, \qquad \ket{\Psi^\pm} = \frac{\ket{01} \pm \ket{10}}{\sqrt2} ;; the four Bell states: an orthonormal basis of two qubits
p: The same circuit makes all four, depending on the input bits. The first input bit chooses the sign, the second chooses whether the two outputs agree.
eq: \ket{\beta_{xy}} = \mathrm{CNOT}\,(H\otimes I)\ket{xy} = \frac{\ket{0\,y} + (-1)^x\ket{1\,\bar y}}{\sqrt2} ;; $\beta_{00} = \Phi^+$, $\beta_{10} = \Phi^-$, $\beta_{01} = \Psi^+$, $\beta_{11} = \Psi^-$
p: $\ket{\Phi^+}$ fails the product test of lesson 4.1, since $\alpha_{00}\alpha_{11} = \tfrac12 \ne 0 = \alpha_{01}\alpha_{10}$. Measured in the Z basis it gives 00 or 11, each half the time, never 01 or 10. The correlation also survives a change of basis, which a pair of pre-agreed classical bits cannot manage.
eq*: \ket{\Phi^+} = \frac{\ket{00} + \ket{11}}{\sqrt2} = \frac{\ket{{+}{+}} + \ket{{-}{-}}}{\sqrt2} ;; perfectly correlated in the Z basis and in the X basis
ex: Checking the X-basis form ;; $\ket{{+}{+}} + \ket{{-}{-}} = \tfrac12\left[(\ket{0}+\ket{1})(\ket{0}+\ket{1}) + (\ket{0}-\ket{1})(\ket{0}-\ket{1})\right] = \tfrac12\left[2\ket{00} + 2\ket{11}\right] = \ket{00} + \ket{11}$. The cross terms $\ket{01}$ and $\ket{10}$ cancel.
`,
    },
    {
      title: "No state of your own",
      summary: "Why an entangled qubit's Bloch arrow shrinks to a point at the origin.",
      notes: String.raw`
idea: Half of an entangled pair has no pure state. Its best description is a density matrix, and for a Bell pair that matrix is the maximally mixed one, with a Bloch vector of length zero.
eq*: \rho_A = \mathrm{Tr}_B\,\ket{\psi}\!\bra{\psi} ;; the reduced state of qubit $A$: what every measurement on $A$ alone can see
eq*: \rho = \frac12\left(I + r_xX + r_yY + r_zZ\right), \qquad |\vec r| \le 1 ;; any one-qubit state, pure ($|\vec r| = 1$) or mixed ($|\vec r| < 1$)
p: For $\ket{\Phi^+}$ the partial trace gives $\rho_A = \tfrac12\ket{0}\!\bra{0} + \tfrac12\ket{1}\!\bra{1} = I/2$, so $\vec r = 0$. Every measurement on $A$ alone is a fair coin, in every basis. The information is in the correlations, not in either qubit.
eq: \mathrm{Tr}(\rho^2) = \frac{1 + |\vec r|^2}{2} ;; purity: $1$ for a pure state, $\tfrac12$ for the maximally mixed one
p: For a pure state of two qubits, entanglement and the mixedness of each half are the same thing. It can be quantified by the *concurrence* $C$, which is $0$ for product states and $1$ for Bell states, and ties directly to the Bloch vector length.
eq*: C = 2\left|\alpha_{00}\alpha_{11} - \alpha_{01}\alpha_{10}\right|, \qquad |\vec r_A|^2 = |\vec r_B|^2 = 1 - C^2 ;; concurrence, and the shrinking Bloch arrow
eq: \ket{\psi} = \sum_i \lambda_i\ket{a_i}\ket{b_i}, \qquad S = -\sum_i \lambda_i^2\log_2\lambda_i^2 ;; Schmidt form and entanglement entropy: $S = 1$ ebit for a Bell pair
ex: A partly entangled pair ;; $\ket{\psi} = \cos\gamma\ket{00} + \sin\gamma\ket{11}$. ;; $C = 2|\cos\gamma\sin\gamma| = |\sin 2\gamma|$ and $\rho_A = \mathrm{diag}(\cos^2\gamma, \sin^2\gamma)$, so $\vec r_A = (0, 0, \cos 2\gamma)$ and $|\vec r_A|^2 = \cos^2 2\gamma = 1 - C^2$. ;; At $\gamma = \pi/8$ both numbers are $1/\sqrt2 \approx 0.71$: the pair is partly entangled, and each arrow is shorter than a pure state's but still points somewhere.
`,
    },
    {
      title: "Measuring one half",
      summary: "What the other qubit does, and what it does not.",
      notes: String.raw`
idea: Measuring one qubit of a Bell pair fixes the other's outcome in that basis. But the other qubit's own statistics, taken without the result, do not change at all.
eq*: \left(\ket{a}\!\bra{a}\otimes I\right)\ket{\Phi^+} = \tfrac{1}{\sqrt2}\ket{a}\ket{a} \;\Rightarrow\; P(a) = \tfrac12,\ \ \text{state afterwards } \ket{aa} ;; measuring qubit $A$ of $\ket{\Phi^+}$ and getting $a$
p: After the measurement the pair is a product state: $C$ drops from $1$ to $0$, and both Bloch vectors jump from the origin to a pole. Measuring in any other basis does the same with that basis's states, up to a complex conjugate.
eq: \left(\bra{u}\otimes I\right)\ket{\Phi^+} = \tfrac{1}{\sqrt2}\,\ket{u^*} ;; Alice finds $\ket{u}$; Bob's qubit is left in $\ket{u^*}$
p: The outcome on A is random, so Bob, who has not been told it, holds a 50/50 mixture of the two possible results. That mixture is exactly the reduced state he held before anything was measured.
eq*: \rho_B = \tfrac12\ket{0}\!\bra{0} + \tfrac12\ket{1}\!\bra{1} = \frac{I}{2} \quad\text{before and after A is measured} ;; B's own statistics cannot tell whether A was measured
table: | Before A is measured | A measured, result unknown to B | A measured, result told to B ;; State of the pair | $\ket{\Phi^+}$ | mixture of $\ket{00}$ and $\ket{11}$ | $\ket{aa}$ ;; $\rho_B$ | $I/2$ | $I/2$ | $\ket{a}\!\bra{a}$ ;; Concurrence | $1$ | $0$ | $0$
ex: Different bases, same correlation ;; Alice measures in the X basis and gets $-$. Using the X-basis form of lesson 4.3, $\ket{\Phi^+} = (\ket{{+}{+}} + \ket{{-}{-}})/\sqrt2$, so Bob's qubit is now $\ket{-}$, and an X measurement on his side gives $-$ with certainty. A Z measurement on his side is still a fair coin.
`,
    },
    {
      title: "Correlation is not communication",
      summary: "Stronger than any classical correlation, and still unable to carry a message.",
      notes: String.raw`
idea: Entangled outcomes are correlated more strongly than any pre-agreed classical strategy allows, and the CHSH inequality measures by how much. The correlation still carries no message.
p: Alice chooses between two measurement settings $a$ and $a'$, and Bob between $b$ and $b'$. Each outcome is $\pm1$, and $E(a,b)$ is the average of the product of their outcomes.
eq*: S = E(a,b) - E(a,b') + E(a',b) + E(a',b') ;; the CHSH combination
eq*: |S| \le 2 \ \ \text{(any local hidden-variable model)}, \qquad |S| \le 2\sqrt2 \approx 2.83 \ \ \text{(quantum mechanics)} ;; Bell's bound and Tsirelson's bound
p: The classical bound follows because, if every outcome is fixed in advance, $S = a(b - b') + a'(b + b')$ with each value $\pm1$: one bracket is $0$ and the other $\pm2$. Quantum pairs do better. For $\ket{\Phi^+}$ measured along directions in the $x$–$z$ plane at angles $\theta$, the correlation is a cosine.
eq: E(\theta_a, \theta_b) = \cos(\theta_a - \theta_b) \quad\text{for}\ \ket{\Phi^+},\ \ \text{observable } \cos\theta\,Z + \sin\theta\,X ;; Bell-pair correlations
ex: Reaching 2√2 ;; Choose $a = 0$, $a' = \tfrac\pi2$, $b = \tfrac\pi4$, $b' = \tfrac{3\pi}{4}$. ;; $E(a,b) = \cos\tfrac\pi4 = \tfrac{\sqrt2}{2}$, $E(a,b') = \cos\tfrac{3\pi}{4} = -\tfrac{\sqrt2}{2}$, $E(a',b) = \cos\tfrac\pi4 = \tfrac{\sqrt2}{2}$, $E(a',b') = \cos\tfrac\pi4 = \tfrac{\sqrt2}{2}$. ;; $S = \tfrac{\sqrt2}{2} + \tfrac{\sqrt2}{2} + \tfrac{\sqrt2}{2} + \tfrac{\sqrt2}{2} = 2\sqrt2$, beyond anything classical.
p: None of this sends information. Whatever Alice chooses to measure, Bob's averaged state is the same, so his statistics alone reveal nothing about her choice. The correlation only appears when the two lists of results are brought together, by an ordinary classical channel.
eq*: \sum_a p(a)\,\rho_{B\mid a} = \mathrm{Tr}_A\,\ket{\Phi^+}\!\bra{\Phi^+} = \frac{I}{2} \quad\text{for every choice of Alice's basis} ;; no-signalling
note: Loophole-free Bell tests since 2015 have measured $S > 2$ with the detection and locality loopholes closed at once. Superdense coding and teleportation, in the algorithms section, are what this non-classical correlation is used for.
`,
    },
  ],
};

export default notes;
