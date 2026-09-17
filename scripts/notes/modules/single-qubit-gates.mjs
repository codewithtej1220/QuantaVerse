const notes = {
  slug: "single-qubit-gates",
  title: "Single-Qubit Gates",
  track: "Foundations",
  summary:
    "Rotate a state anywhere on the sphere. Pauli X, Y, Z, the phase gates S and T, and the RX/RY/RZ family as continuous rotations.",
  conventions:
    "Matrices act on column vectors in the basis $(\\ket{0}, \\ket{1})$. A circuit read left to right applies its gates in that order, so its matrix is written right to left. $U \\equiv V$ means equal up to a global phase.",
  lessons: [
    {
      title: "The Pauli gates",
      summary: "Three gates, three axes, and the only ones that are their own inverse.",
      notes: String.raw`
idea: $X$, $Y$ and $Z$ are half-turns of the Bloch sphere about its three axes. Each squares to the identity, and any two of them anticommute.
eq*: X = \begin{pmatrix}0&1\\1&0\end{pmatrix}, \qquad Y = \begin{pmatrix}0&-i\\ i&0\end{pmatrix}, \qquad Z = \begin{pmatrix}1&0\\0&-1\end{pmatrix} ;; the Pauli matrices
p: $X$ is the quantum NOT: it swaps $\ket{0}$ and $\ket{1}$. $Z$ leaves $\ket{0}$ alone and flips the sign of $\ket{1}$, a *phase flip* that is invisible to a Z measurement. $Y$ does both, with a factor of $i$.
eq: X\ket{0} = \ket{1},\quad X\ket{1} = \ket{0},\qquad Z\ket{0} = \ket{0},\quad Z\ket{1} = -\ket{1},\qquad Y\ket{0} = i\ket{1},\quad Y\ket{1} = -i\ket{0} ;; bit flip, phase flip, and both
eq*: X^2 = Y^2 = Z^2 = I, \qquad XY = iZ,\quad YZ = iX,\quad ZX = iY ;; the Pauli algebra
eq: \{\sigma_j, \sigma_k\} = \sigma_j\sigma_k + \sigma_k\sigma_j = 2\delta_{jk}\,I ;; distinct Paulis anticommute: $XZ = -ZX$
p: Each Pauli has eigenvalues $+1$ and $-1$, and its eigenvectors are the two poles of its own axis. That is why they double as *observables*: measuring $Z$ reports $\pm1$, and its average is the $z$ coordinate of the Bloch vector.
table: Gate | Eigenvalue $+1$ | Eigenvalue $-1$ | Rotation ;; $X$ | $\ket{+}$ | $\ket{-}$ | $180^\circ$ about $x$ ;; $Y$ | $\ket{+i}$ | $\ket{-i}$ | $180^\circ$ about $y$ ;; $Z$ | $\ket{0}$ | $\ket{1}$ | $180^\circ$ about $z$
ex: Checking one product ;; $XY = \begin{pmatrix}0&1\\1&0\end{pmatrix}\begin{pmatrix}0&-i\\i&0\end{pmatrix} = \begin{pmatrix}i&0\\0&-i\end{pmatrix} = i\begin{pmatrix}1&0\\0&-1\end{pmatrix} = iZ$. ;; In the other order, $YX = -iZ$. Up to a phase, $XY$ and $YX$ are both $Z$: two half-turns about perpendicular axes make a half-turn about the third.
`,
    },
    {
      title: "Why gates must be unitary",
      summary: "The one constraint on what a quantum gate is allowed to be.",
      notes: String.raw`
idea: A gate must keep every state normalised, for every input. The matrices that do that are exactly the unitary ones, and every one of them can be undone.
eq*: U^\dagger U = UU^\dagger = I ;; unitarity
p: If $U^\dagger U = I$, then $U$ preserves inner products, so lengths and angles between states are unchanged. In particular the probabilities of any measurement still add to one after the gate.
eq*: \braket{U\phi|U\psi} = \braket{\phi|U^\dagger U|\psi} = \braket{\phi|\psi} ;; unitaries preserve inner products
p: Unitarity also means reversibility: the inverse of a gate is its conjugate transpose, which is itself a valid gate. A circuit is undone by running the inverses of its gates in reverse order.
eq: (U_k\cdots U_2U_1)^\dagger = U_1^\dagger U_2^\dagger\cdots U_k^\dagger ;; undoing a circuit
eq: U\ket{v} = \lambda\ket{v} \;\Rightarrow\; |\lambda| = 1,\ \ \lambda = e^{i\vartheta} ;; the eigenvalues of a unitary are pure phases
def: Hermitian and unitary ;; A Hermitian matrix satisfies $A^\dagger = A$ and represents something measurable. A unitary satisfies $U^\dagger = U^{-1}$ and represents something you can do. The Paulis and $H$ are both at once, which is why each is its own inverse.
ex: Unitary or not? ;; $H$: $H^\dagger H = H^2 = I$, so yes. ;; $A = \begin{pmatrix}1&1\\0&0\end{pmatrix}$ sends both $\ket{0}$ and $\ket{1}$ to $\ket{0}$. Two different inputs, one output: it cannot be undone and cannot be a gate. $A^\dagger A = \begin{pmatrix}1&1\\1&1\end{pmatrix} \neq I$ confirms it.
note: Measurement and reset are not unitary, and that is why circuits treat them as separate operations rather than gates.
`,
    },
    {
      title: "Gates as rotations",
      summary: "Every single-qubit gate is a rotation of the sphere, and nothing else.",
      notes: String.raw`
idea: Up to a global phase, every single-qubit unitary is a rotation of the Bloch sphere by some angle about some axis.
eq*: R_{\hat n}(\theta) = e^{-i\theta\,\hat n\cdot\vec\sigma/2} = \cos\frac{\theta}{2}\,I - i\sin\frac{\theta}{2}\left(n_xX + n_yY + n_zZ\right) ;; rotation by $\theta$ about the unit axis $\hat n$
eq*: U = e^{i\alpha}\,R_{\hat n}(\theta) ;; every single-qubit gate, for some phase $\alpha$, axis $\hat n$ and angle $\theta$
p: The fixed gates of the palette are all half-turns, $\theta = \pi$, about different axes. With $\theta = \pi$ the formula gives $R_{\hat n}(\pi) = -i\,(\hat n\cdot\vec\sigma)$, so each gate is its rotation times the global phase $i$.
table: Gate | Axis $\hat n$ | Angle | Exactly ;; $X$ | $(1,0,0)$ | $\pi$ | $X = iR_x(\pi)$ ;; $Y$ | $(0,1,0)$ | $\pi$ | $Y = iR_y(\pi)$ ;; $Z$ | $(0,0,1)$ | $\pi$ | $Z = iR_z(\pi)$ ;; $H$ | $\tfrac{1}{\sqrt2}(1,0,1)$ | $\pi$ | $H = iR_{\hat n}(\pi)$
eq: R_{\hat n}(\pi) = -i\,\frac{X + Z}{\sqrt2} = -iH \quad\text{for}\quad \hat n = \tfrac{1}{\sqrt2}(1,0,1) ;; the Hadamard is a half-turn about the diagonal
p: Any rotation can be built from rotations about just two fixed axes. The standard choice is $z$, $y$, $z$, and this is the form compilers use to turn an arbitrary gate into hardware pulses.
eq*: U = e^{i\alpha}\,R_z(\beta)\,R_y(\gamma)\,R_z(\delta) ;; the Z–Y–Z decomposition
ex: Where does X send a state? ;; $X$ is a half-turn about $x$, so it maps the Bloch vector $(r_x, r_y, r_z)$ to $(r_x, -r_y, -r_z)$. For $\ket{+i}$, at $(0,1,0)$, the result is $(0,-1,0) = \ket{-i}$. Directly: $X\,\tfrac{1}{\sqrt2}(\ket{0} + i\ket{1}) = \tfrac{1}{\sqrt2}(\ket{1} + i\ket{0}) = \tfrac{i}{\sqrt2}(\ket{0} - i\ket{1}) \equiv \ket{-i}$.
`,
    },
    {
      title: "S and T — the phase gates",
      summary: "Quarter and eighth turns about the Z axis, and why T is the expensive one.",
      notes: String.raw`
idea: $S$ and $T$ add a relative phase of $90^\circ$ and $45^\circ$ to $\ket{1}$. They are quarter and eighth turns about $z$.
eq*: S = \begin{pmatrix}1&0\\0&i\end{pmatrix}, \qquad T = \begin{pmatrix}1&0\\0&e^{i\pi/4}\end{pmatrix} ;; the phase gates
eq*: T^2 = S, \qquad S^2 = Z, \qquad Z^2 = I, \qquad T^8 = I ;; each is the square root of the one before
eq: P(\varphi) = \begin{pmatrix}1&0\\0&e^{i\varphi}\end{pmatrix} = e^{i\varphi/2}R_z(\varphi) ;; the general phase gate: $S = P(\pi/2)$, $T = P(\pi/4)$, $Z = P(\pi)$
p: On a state on the equator, a phase gate is a turn about $z$ by its angle. $S$ takes $\ket{+}$ to $\ket{+i}$, a quarter turn; $T$ takes it halfway there.
eq: S\ket{+} = \frac{\ket{0} + i\ket{1}}{\sqrt2} = \ket{+i}, \qquad T\ket{+} = \frac{\ket{0} + e^{i\pi/4}\ket{1}}{\sqrt2} ;; quarter and eighth turns of $\ket{+}$
eq: S^\dagger = \begin{pmatrix}1&0\\0&-i\end{pmatrix}, \qquad T^\dagger = \begin{pmatrix}1&0\\0&e^{-i\pi/4}\end{pmatrix} ;; the inverses turn the other way
p: The difference between the two shows up when conjugating a Pauli. $S$ turns $X$ into $Y$, another Pauli. $T$ turns $X$ into a mixture of $X$ and $Y$, which is not a Pauli. That property, keeping Paulis as Paulis or not, is the dividing line of lesson 3.7.
eq*: SXS^\dagger = Y, \qquad TXT^\dagger = \frac{X + Y}{\sqrt2} ;; $S$ maps Paulis to Paulis; $T$ does not
ex: Verifying SXS† = Y ;; $SXS^\dagger = \begin{pmatrix}1&0\\0&i\end{pmatrix}\begin{pmatrix}0&1\\1&0\end{pmatrix}\begin{pmatrix}1&0\\0&-i\end{pmatrix} = \begin{pmatrix}0&1\\i&0\end{pmatrix}\begin{pmatrix}1&0\\0&-i\end{pmatrix} = \begin{pmatrix}0&-i\\i&0\end{pmatrix} = Y$.
`,
    },
    {
      title: "Continuous rotations",
      summary: "RZ, and gates that take an angle instead of being fixed.",
      notes: String.raw`
idea: $R_x$, $R_y$ and $R_z$ take an angle, so one gate can reach any amount of rotation about its axis. The fixed gates are special angles of them.
eq*: R_x(\theta) = \begin{pmatrix}\cos\frac\theta2 & -i\sin\frac\theta2\\ -i\sin\frac\theta2 & \cos\frac\theta2\end{pmatrix}, \qquad R_y(\theta) = \begin{pmatrix}\cos\frac\theta2 & -\sin\frac\theta2\\ \sin\frac\theta2 & \cos\frac\theta2\end{pmatrix} ;; rotations about $x$ and $y$
eq*: R_z(\theta) = \begin{pmatrix}e^{-i\theta/2} & 0\\ 0 & e^{i\theta/2}\end{pmatrix} ;; rotation about $z$
eq: R_z(\pi) = -iZ \equiv Z, \qquad R_z(\tfrac\pi2) = e^{-i\pi/4}S \equiv S, \qquad R_z(\tfrac\pi4) = e^{-i\pi/8}T \equiv T ;; the fixed phase gates, as angles of $R_z$
p: Rotations about the same axis add their angles. A full turn, $\theta = 2\pi$, gives $-I$: the same physical operation as doing nothing, but a sign that matters once the rotation is controlled. Only $\theta = 4\pi$ gives exactly $I$.
eq*: R_{\hat n}(\theta_1)\,R_{\hat n}(\theta_2) = R_{\hat n}(\theta_1 + \theta_2), \qquad R_{\hat n}(2\pi) = -I ;; angles add; a full turn is a sign
p: $R_y$ is the useful one for preparing states with real amplitudes: from $\ket{0}$ it produces any probability split without adding a phase.
eq: R_y(\theta)\ket{0} = \cos\frac\theta2\ket{0} + \sin\frac\theta2\ket{1} \;\Rightarrow\; P(1) = \sin^2\frac\theta2 ;; preparing a chosen probability
ex: A 90/10 split ;; To get $P(1) = 0.1$, solve $\sin^2\frac\theta2 = 0.1$: $\theta = 2\arcsin\sqrt{0.1} \approx 2 \times 0.3218 = 0.6435$ rad, about $36.9^\circ$. ;; Then $R_y(0.6435)\ket{0} \approx 0.949\ket{0} + 0.316\ket{1}$, and $0.949^2 \approx 0.9$.
note: Parametrised rotations are what variational algorithms tune: the angles are the parameters a classical optimiser adjusts between runs.
`,
    },
    {
      title: "Order matters",
      summary: "Gates are matrices, matrices do not commute, and circuits read left to right.",
      notes: String.raw`
idea: A circuit is read left to right, but its matrix is written right to left, and swapping two gates usually changes the result.
eq*: \ket{\psi} \to A \to B \quad\Longleftrightarrow\quad BA\ket{\psi} ;; the first gate in time is the rightmost matrix
p: Matrix multiplication is not commutative, and neither are gates. The *commutator* measures how far two gates are from commuting; when it vanishes, their order does not matter.
eq: [A, B] = AB - BA ;; the commutator: zero exactly when order does not matter
p: Conjugating by $H$ swaps the roles of $x$ and $z$, which explains most of the identities used in circuit simplification.
eq*: HXH = Z, \qquad HZH = X, \qquad HYH = -Y ;; conjugating by $H$ swaps $x$ and $z$, and reverses $y$
circuit: The same two gates, in both orders
|0⟩ ──H──Z──   =  Z·H|0⟩ = Z|+⟩ = |−⟩
|0⟩ ──Z──H──   =  H·Z|0⟩ = H|0⟩ = |+⟩
:end
p: The two outputs above are genuinely different states, told apart with certainty by an X-basis measurement. Some reorderings do only change a global phase, which no measurement sees. Distinct Paulis are the standard case, since they anticommute.
eq: XZ = -ZX \;\Rightarrow\; XZ\ket{\psi} \equiv ZX\ket{\psi} ;; anticommuting gates differ only by a sign
def: Commuting gates ;; Gates on different qubits always commute, and so do gates that are diagonal in the same basis, such as $Z$, $S$, $T$ and $R_z$. A compiler may reorder those freely and merge runs of them into one rotation.
ex: Merging a run ;; $T\,S\,Z = P(\tfrac\pi4)\,P(\tfrac\pi2)\,P(\pi) = P(\tfrac{7\pi}{4}) = T^\dagger$, because phase gates about the same axis add their angles modulo $2\pi$: three gates become one.
`,
    },
    {
      title: "T-depth, and what a gate costs",
      summary: "Why not all gates are priced the same on real hardware.",
      notes: String.raw`
idea: Clifford gates ($H$, $S$, CNOT and the Paulis) are cheap to run fault-tolerantly and easy to simulate. $T$ is neither, and the number of $T$ gates is what a circuit really costs.
def: Clifford group ;; The gates generated by $H$, $S$ and CNOT. They map every Pauli operator to another Pauli operator, up to a sign, under conjugation.
eq*: C\,P\,C^\dagger \in \pm\{I, X, Y, Z\}^{\otimes n} \quad\text{for every Pauli string } P ;; what makes a gate Clifford
p: Because Cliffords only shuffle Paulis, a classical computer can track a Clifford circuit by tracking a few Pauli strings instead of $2^n$ amplitudes. Any circuit made only of them can therefore be simulated efficiently. This is the *Gottesman–Knill theorem*.
p: Adding $T$ breaks that shortcut, and Clifford + $T$ is universal: any single-qubit gate can be approximated to accuracy $\varepsilon$ with a short sequence of them.
eq*: N_{\text{gates}} = O\!\left(\log^{c}\frac{1}{\varepsilon}\right) ;; the Solovay–Kitaev theorem: $c$ is a small constant, about 4 in the textbook construction and lower in later ones
note: For $z$-rotations, optimal Clifford + $T$ synthesis does better still, using about $3\log_2(1/\varepsilon)$ $T$ gates.
p: On an error-corrected machine the price difference is large. Clifford gates can be applied almost directly to encoded qubits, while each $T$ needs a *magic state*, prepared and purified by a separate, costly distillation process. Circuits are therefore compared by two numbers.
table: Measure | Counts | Why it matters ;; T-count | $T$ and $T^\dagger$ gates in total | one magic state each ;; T-depth | layers containing a $T$ | how long the magic-state supply must keep up ;; Clifford count | everything else | cheap by comparison
ex: A Toffoli's price ;; The Toffoli gate (controlled-controlled-NOT) needs seven $T$ or $T^\dagger$ gates in its standard decomposition into Clifford + $T$. A circuit with a thousand Toffolis therefore needs about seven thousand magic states before any other cost is counted.
note: Resource estimates for large algorithms, such as the Shor estimates in lesson 8.8, are dominated by T-count for exactly this reason.
`,
    },
  ],
};

export default notes;
