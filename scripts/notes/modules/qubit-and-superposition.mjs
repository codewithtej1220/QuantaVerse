const notes = {
  slug: "qubit-and-superposition",
  title: "The Qubit & Superposition",
  track: "Foundations",
  summary:
    "Build a qubit from the ground up: the Bloch sphere, amplitudes, and why a Hadamard gate puts a state in two places at once.",
  conventions:
    "Kets are column vectors, with $\\ket{0} = (1,0)^{\\mathsf T}$ and $\\ket{1} = (0,1)^{\\mathsf T}$. A dagger is the conjugate transpose, and $z^*$ is the complex conjugate of $z$. The symbol $\\equiv$ between two states means they differ only by a global phase, so no measurement can tell them apart.",
  lessons: [
    {
      title: "A qubit is a direction, not a digit",
      summary: "Why the state of a qubit needs two complex numbers instead of one bit.",
      notes: String.raw`
idea: A qubit's state is a unit vector in a two-dimensional complex vector space. The basis vectors of that space are called $\ket{0}$ and $\ket{1}$.
p: A classical bit holds one of two values. A qubit holds a *direction*: a vector with two complex components. Writing the basis as column vectors makes every later calculation a matter of matrix multiplication.
eq: \ket{0} = \begin{pmatrix}1\\0\end{pmatrix}, \qquad \ket{1} = \begin{pmatrix}0\\1\end{pmatrix} ;; the computational basis
eq*: \ket{\psi} = \alpha\ket{0} + \beta\ket{1} = \begin{pmatrix}\alpha\\ \beta\end{pmatrix}, \qquad \alpha,\beta\in\mathbb{C} ;; the general state of one qubit
p: The numbers $\alpha$ and $\beta$ are the *amplitudes*. They are not free: the vector must have length one, because the squared magnitudes of the amplitudes are the probabilities of the two measurement outcomes, and probabilities sum to one.
eq*: \braket{\psi|\psi} = |\alpha|^2 + |\beta|^2 = 1 ;; normalisation
def: Inner product ;; For $\ket{\phi} = (\phi_0,\phi_1)^{\mathsf T}$ and $\ket{\psi} = (\psi_0,\psi_1)^{\mathsf T}$, the inner product is $\braket{\phi|\psi} = \phi_0^*\psi_0 + \phi_1^*\psi_1$. The bra $\bra{\phi}$ is the conjugate transpose of $\ket{\phi}$, a row vector. Two states are *orthogonal* when their inner product is zero, as $\ket{0}$ and $\ket{1}$ are.
eq: \braket{\phi|\psi} = \phi_0^*\psi_0 + \phi_1^*\psi_1, \qquad \braket{\phi|\psi}^* = \braket{\psi|\phi} ;; the inner product, and its symmetry
p: Counting parameters shows how much a qubit really holds. Two complex numbers make four real ones. Normalisation removes one, and the global phase (lesson 1.6) removes another, leaving two real parameters: exactly the two angles that place a point on a sphere.
ex: Is it a valid state? ;; Take $\ket{\psi} = \tfrac{1}{\sqrt2}\ket{0} + \tfrac{i}{\sqrt2}\ket{1}$. Then $|\alpha|^2 + |\beta|^2 = \tfrac12 + |i|^2\cdot\tfrac12 = \tfrac12 + \tfrac12 = 1$, so it is normalised. Both outcomes have probability one half, and the $i$ is not decoration: it makes this state different from $(\ket{0}+\ket{1})/\sqrt2$.
`,
    },
    {
      title: "Amplitudes are not probabilities",
      summary: "The sign is the part that makes a quantum computer worth building.",
      notes: String.raw`
idea: A probability is the squared magnitude of an amplitude. Amplitudes can be negative or complex, so two routes to the same outcome can cancel, which probabilities never do.
eq*: P(x) = |\alpha_x|^2 ;; the probability of reading $x$ is the squared magnitude of its amplitude
p: Two states can give identical measurement statistics and still be different states. The pair below is the standard example: each gives 0 or 1 with probability one half, yet they are orthogonal, so a suitable measurement tells them apart every time.
eq*: \ket{+} = \frac{\ket{0}+\ket{1}}{\sqrt2}, \qquad \ket{-} = \frac{\ket{0}-\ket{1}}{\sqrt2} ;; the X-basis states
eq: \braket{+|-} = \tfrac12\left(1\cdot 1 + 1\cdot(-1)\right) = 0 ;; same statistics in the Z basis, yet orthogonal
p: When an outcome can be reached along two paths, quantum mechanics adds the *amplitudes* first and squares afterwards. Squaring a sum produces a cross term, and that cross term, interference, is the only thing separating a quantum computer from a random-number generator.
eq*: |a_1 + a_2|^2 = |a_1|^2 + |a_2|^2 + 2\,\mathrm{Re}\!\left(a_1^*a_2\right) ;; interference: the cross term can be positive, negative or zero
table: Paths | Amplitudes | Probability of the outcome ;; in step | $a_1 = a_2 = \tfrac12$ | $|1|^2 = 1$ ;; out of step | $a_1 = \tfrac12,\ a_2 = -\tfrac12$ | $|0|^2 = 0$ ;; classical mixture | probabilities $\tfrac14 + \tfrac14$ | $\tfrac12$, whatever the signs
p: Every algorithm in this course is a way of arranging these signs so that the paths to wrong answers cancel and the paths to the right answer reinforce.
ex: Destructive interference in one line ;; Two paths reach outcome 1 with amplitudes $+\tfrac12$ and $-\tfrac12$. Adding first gives $0$, so $P(1) = 0$. Adding the probabilities instead would have given $\tfrac14 + \tfrac14 = \tfrac12$. The difference between those two answers is what lesson 1.5 measures.
`,
    },
    {
      title: "The Bloch sphere",
      summary: "Four real numbers, two of which do not matter, leaving a point on a ball.",
      notes: String.raw`
idea: Once normalisation and the global phase are removed, every single-qubit state is described by two angles, which place it on the surface of a unit sphere.
eq*: \ket{\psi} = \cos\frac{\theta}{2}\ket{0} + e^{i\varphi}\sin\frac{\theta}{2}\ket{1}, \qquad 0\le\theta\le\pi,\ \ 0\le\varphi<2\pi ;; the Bloch parametrisation
eq*: \vec r = \left(\sin\theta\cos\varphi,\ \sin\theta\sin\varphi,\ \cos\theta\right) ;; the Bloch vector: the point on the sphere
p: The half-angles look odd at first, but they are what makes the picture work. Orthogonal states, which are $90^\circ$ apart as vectors, land on *opposite* points of the sphere: $\ket{0}$ at the north pole and $\ket{1}$ at the south.
table: State | $\theta$ | $\varphi$ | Bloch vector ;; $\ket{0}$ | $0$ | any | $(0,0,1)$, north pole ;; $\ket{1}$ | $\pi$ | any | $(0,0,-1)$, south pole ;; $\ket{+}$ | $\pi/2$ | $0$ | $(1,0,0)$ ;; $\ket{-}$ | $\pi/2$ | $\pi$ | $(-1,0,0)$ ;; $\ket{+i} = (\ket{0}+i\ket{1})/\sqrt2$ | $\pi/2$ | $\pi/2$ | $(0,1,0)$ ;; $\ket{-i} = (\ket{0}-i\ket{1})/\sqrt2$ | $\pi/2$ | $3\pi/2$ | $(0,-1,0)$
p: The components of the Bloch vector are measurable. Each is the average value of one Pauli observable (lesson 3.1), so the sphere is not just a drawing: three kinds of measurement, repeated, pin the point down.
eq: r_x = \langle X\rangle, \qquad r_y = \langle Y\rangle, \qquad r_z = \langle Z\rangle ;; each coordinate is an expectation value
eq*: P(0) = \cos^2\frac{\theta}{2} = \frac{1 + r_z}{2}, \qquad P(1) = \sin^2\frac{\theta}{2} = \frac{1 - r_z}{2} ;; measurement probabilities read off the height
note: The azimuth $\varphi$ never affects $P(0)$ or $P(1)$. It is a relative phase, invisible to a Z-basis measurement, but it decides what a Hadamard or any other rotation does next.
ex: Where is it? ;; For $\ket{\psi} = \tfrac{\sqrt3}{2}\ket{0} + \tfrac12 e^{i\pi/4}\ket{1}$: $\cos\frac\theta2 = \frac{\sqrt3}{2}$ gives $\theta = \pi/3$, and $\varphi = \pi/4$. So $\vec r = (\tfrac{\sqrt3}{2}\cdot\tfrac{\sqrt2}{2},\ \tfrac{\sqrt3}{2}\cdot\tfrac{\sqrt2}{2},\ \tfrac12) \approx (0.61, 0.61, 0.5)$ and $P(0) = \tfrac{1 + 0.5}{2} = \tfrac34$.
`,
    },
    {
      title: "The Hadamard gate",
      summary: "The gate that makes superposition, and undoes it just as reliably.",
      notes: String.raw`
idea: $H$ exchanges the Z basis and the X basis. Applied twice it does nothing, which is what lets it create a superposition and then undo it.
eq*: H = \frac{1}{\sqrt2}\begin{pmatrix}1 & 1\\ 1 & -1\end{pmatrix} ;; the Hadamard gate
eq*: H\ket{0} = \ket{+}, \quad H\ket{1} = \ket{-}, \quad H\ket{+} = \ket{0}, \quad H\ket{-} = \ket{1} ;; its action on the two bases
eq: H^2 = I, \qquad H^\dagger = H ;; self-inverse and Hermitian
p: On the Bloch sphere $H$ is a half-turn about the axis halfway between $x$ and $z$. The half-turn swaps the $z$ axis with the $x$ axis, which is the same statement as the basis swap above.
p: A compact form covers both inputs at once and generalises to many qubits, where it becomes the workhorse of every algorithm in this course.
eq: H\ket{x} = \frac{1}{\sqrt2}\sum_{z\in\{0,1\}}(-1)^{xz}\ket{z}, \qquad x\in\{0,1\} ;; one formula for both basis states
eq*: H^{\otimes n}\ket{0}^{\otimes n} = \frac{1}{\sqrt{2^n}}\sum_{x=0}^{2^n-1}\ket{x} ;; $n$ Hadamards: an equal superposition of all $2^n$ strings
ex: Matrix check ;; $H\ket{1} = \frac{1}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix}\begin{pmatrix}0\\1\end{pmatrix} = \frac{1}{\sqrt2}\begin{pmatrix}1\\-1\end{pmatrix} = \ket{-}$. ;; And $H^2 = \frac12\begin{pmatrix}1+1 & 1-1\\ 1-1 & 1+1\end{pmatrix} = I$, so a second $H$ always returns the qubit to where it started.
`,
    },
    {
      title: 'Superposition is not "both at once"',
      summary: "The two-Hadamard experiment, and why a random coin cannot fake it.",
      notes: String.raw`
idea: A superposition is one definite state, not a hidden coin toss. Applying $H$ twice gives a result no random process can reproduce.
p: A coin model of $H$ would say: send in 0, get out 0 or 1 at random. That model predicts a single $H$ correctly, since $P(0) = P(1) = \tfrac12$. Now apply $H$ twice. The coin model says the second toss is random too, so the result stays 50/50. The quantum result is 0 every time.
eq*: HH\ket{0} = H\,\frac{\ket{0}+\ket{1}}{\sqrt2} = \frac12\Big[\big(\ket{0}+\ket{1}\big) + \big(\ket{0}-\ket{1}\big)\Big] = \ket{0} ;; the two-Hadamard experiment
table: Path to the final outcome | Amplitude via $\ket{0}$ | Amplitude via $\ket{1}$ | Total ;; ends at 0 | $\tfrac{1}{\sqrt2}\cdot\tfrac{1}{\sqrt2} = \tfrac12$ | $\tfrac{1}{\sqrt2}\cdot\tfrac{1}{\sqrt2} = \tfrac12$ | $1$ ;; ends at 1 | $\tfrac{1}{\sqrt2}\cdot\tfrac{1}{\sqrt2} = \tfrac12$ | $\tfrac{1}{\sqrt2}\cdot\left(-\tfrac{1}{\sqrt2}\right) = -\tfrac12$ | $0$
p: The difference between a superposition and a coin can be written down precisely using density matrices. A coin, a *mixture* of 0 and 1, has no off-diagonal entries. The state $\ket{+}$ does. Those off-diagonal entries, the *coherences*, are what interference needs.
eq*: \rho_{\text{coin}} = \frac12\begin{pmatrix}1&0\\0&1\end{pmatrix}, \qquad \rho_{+} = \ket{+}\!\bra{+} = \frac12\begin{pmatrix}1&1\\1&1\end{pmatrix} ;; same diagonal, different off-diagonals
eq: H\rho_{\text{coin}}H^\dagger = \rho_{\text{coin}}, \qquad H\rho_{+}H^\dagger = \ket{0}\!\bra{0} ;; a Hadamard cannot sharpen a coin, but it can sharpen a superposition
note: Decoherence is the loss of those off-diagonal terms through contact with the environment. It is why a real device slowly turns $\rho_+$ into $\rho_{\text{coin}}$, and why circuits have to finish quickly (lesson 5.7).
`,
    },
    {
      title: "Global phase, and what it is not",
      summary: "One phase you can always ignore, and one you never can.",
      notes: String.raw`
idea: Multiplying a whole state by $e^{i\gamma}$ changes nothing that can be measured. A phase *between* components changes the state.
eq*: e^{i\gamma}\ket{\psi} \equiv \ket{\psi} ;; global phase: physically the same state
p: The reason is one line: every probability is a squared magnitude, and $|e^{i\gamma}|=1$. The same holds for measurements in any basis, so no experiment separates the two.
eq: \left|\braket{b|e^{i\gamma}\psi}\right|^2 = |e^{i\gamma}|^2\,|\braket{b|\psi}|^2 = |\braket{b|\psi}|^2 ;; for every basis state $\ket{b}$ of every measurement
eq*: \alpha\ket{0} + e^{i\varphi}\beta\ket{1} ;; relative phase $\varphi$: a rotation about $z$ on the Bloch sphere, and a different state
p: A relative phase is invisible in the Z basis but not in others. The states $\ket{+}$ and $\ket{-}$ differ only by the relative phase $\varphi = \pi$, and a Hadamard sends them to $\ket{0}$ and $\ket{1}$, which a measurement separates perfectly.
eq: -\ket{\psi} \equiv \ket{\psi}, \qquad\text{but}\qquad \frac{\ket{0}-\ket{1}}{\sqrt2} \not\equiv \frac{\ket{0}+\ket{1}}{\sqrt2} ;; a global sign versus a relative sign
p: The same freedom applies to gates: $U$ and $e^{i\gamma}U$ are the same operation. That is why gate identities are often only true up to a phase.
eq: XZ = -iY, \qquad ZX = iY ;; $XZ$ and $ZX$ are the same gate, up to a global phase
note: One caution for later. A global phase stops being global when the gate is *controlled*: controlled-$(e^{i\gamma}U)$ applies the phase only when the control is 1, turning it into a relative phase on the control qubit. That is exactly the phase kickback of lesson 6.3.
ex: Global or relative? ;; $\tfrac{1}{\sqrt2}\left(i\ket{0} - i\ket{1}\right) = i\,\tfrac{1}{\sqrt2}\left(\ket{0} - \ket{1}\right) = i\ket{-}$: the factor $i$ is global, so the state is $\ket{-}$. ;; $\tfrac{1}{\sqrt2}\left(\ket{0} - i\ket{1}\right)$ has no common factor to pull out, so its $-i = e^{i3\pi/2}$ is a relative phase, and the state is $\ket{-i}$, not $\ket{-}$.
`,
    },
  ],
};

export default notes;
