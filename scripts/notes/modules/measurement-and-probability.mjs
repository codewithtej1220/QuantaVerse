const notes = {
  slug: "measurement-and-probability",
  title: "Measurement & Probability",
  track: "Foundations",
  summary:
    "Collapse a superposition a thousand times and watch the histogram converge on |α|². Measurement is destructive, and that is the point.",
  conventions:
    "Multi-qubit states are written the way Qiskit prints them, highest qubit on the left: $\\ket{q_{n-1}\\cdots q_1q_0}$, so the string 011 means $q_0 = 1$, $q_1 = 1$, $q_2 = 0$. $N$ is a number of shots and $p$ an outcome probability.",
  lessons: [
    {
      title: "The Born rule",
      summary: "The one line that connects a state vector to something you can actually see.",
      notes: String.raw`
idea: A state is not observed directly. Measuring it returns outcome $x$ with probability $|\braket{x|\psi}|^2$, and nothing more.
eq*: P(x) = |\braket{x|\psi}|^2 ;; the Born rule, for a measurement in the basis $\{\ket{x}\}$
eq: \ket{\psi} = \alpha\ket{0} + \beta\ket{1} \;\Rightarrow\; P(0) = |\alpha|^2,\quad P(1) = |\beta|^2 ;; for one qubit in the computational basis
p: The probabilities add to one precisely because the state is normalised. That is not a coincidence of notation: the normalisation condition of lesson 1.1 exists so that the Born rule yields a probability distribution.
eq: \sum_x P(x) = \sum_x \braket{\psi|x}\braket{x|\psi} = \braket{\psi|\psi} = 1 ;; the outcomes are exhaustive
p: More generally a measurement is a set of *projectors* $P_m$, one per outcome, that are mutually orthogonal and sum to the identity. Measuring in a basis is the special case $P_x = \ket{x}\!\bra{x}$.
eq*: p(m) = \braket{\psi|P_m|\psi}, \qquad P_mP_{m'} = \delta_{mm'}P_m, \qquad \sum_m P_m = I ;; projective measurement
p: Repeating a measurement many times gives averages. The average of an observable is its *expectation value*; for $Z$, whose outcomes are $+1$ for 0 and $-1$ for 1, it is the difference of the two probabilities.
eq*: \langle Z\rangle = \braket{\psi|Z|\psi} = P(0) - P(1) ;; the expectation value of $Z$
ex: Reading a state ;; Let $\ket{\psi} = \tfrac{\sqrt3}{2}\ket{0} + \tfrac12 e^{i\pi/3}\ket{1}$. ;; $P(0) = \left|\tfrac{\sqrt3}{2}\right|^2 = \tfrac34$ and $P(1) = \left|\tfrac12 e^{i\pi/3}\right|^2 = \tfrac14$: the phase $e^{i\pi/3}$ has no effect on either. ;; $\langle Z\rangle = \tfrac34 - \tfrac14 = \tfrac12$, which is also the height $r_z = \cos\theta$ of the state on the Bloch sphere, with $\theta = \pi/3$.
`,
    },
    {
      title: "Measuring changes the state",
      summary: "Why you cannot read a qubit twice and learn twice as much.",
      notes: String.raw`
idea: A measurement returns one outcome and leaves the state in the matching basis state. Measuring again only repeats the answer.
eq*: \ket{\psi} \;\longmapsto\; \frac{P_m\ket{\psi}}{\sqrt{p(m)}} ;; the state just after outcome $m$ is observed
p: For a computational-basis measurement of one qubit this says: whatever $\alpha$ and $\beta$ were, the state afterwards is $\ket{0}$ or $\ket{1}$. The amplitudes are gone; all that remains is one bit.
eq: \ket{+} \xrightarrow{\ \text{measure}\ } \begin{cases}\ket{0} & \text{with probability } \tfrac12\\ \ket{1} & \text{with probability } \tfrac12\end{cases} ;; a superposition, measured
p: A second measurement in the same basis repeats the first result with certainty, because a projector applied twice is the same projector. This is why a qubit cannot be read twice to learn more about the original amplitudes.
eq: P_m^2 = P_m \;\Rightarrow\; p(m \mid m) = \frac{\braket{\psi|P_mP_mP_m|\psi}}{p(m)} = 1 ;; repeatability
p: Could the state be copied first, and each copy measured? No. The *no-cloning theorem* says no single operation copies every unknown state. The proof takes one line: an operation that copied two states would have to preserve their inner product, and squaring it at the same time.
eq*: U\ket{\psi}\ket{0} = \ket{\psi}\ket{\psi}\ \ \forall\,\psi \;\Rightarrow\; \braket{\phi|\psi} = \braket{\phi|\psi}^2 \;\Rightarrow\; \braket{\phi|\psi}\in\{0,1\} ;; no-cloning: only orthogonal or identical states can be copied by one $U$
def: Destructive measurement ;; Measurement irreversibly turns amplitudes into one classical outcome. This is not a limitation to engineer away. Algorithms are built so that, just before the measurement, nearly all the amplitude sits on the answer.
ex: What is left ;; Measure $\ket{\psi} = \tfrac{1}{\sqrt3}\ket{0} + \sqrt{\tfrac23}\,e^{i\pi/5}\ket{1}$ and get 1, which happens with probability $\tfrac23$. The state is now exactly $\ket{1}$: the magnitude $\sqrt{2/3}$ and the phase $e^{i\pi/5}$ are both gone, and measuring again returns 1 with probability 1.
`,
    },
    {
      title: "Shot noise",
      summary: "Why 1,024 shots of a fair circuit almost never give exactly 512 and 512.",
      notes: String.raw`
idea: Each shot is an independent draw. Counts follow a binomial distribution, whose spread shrinks only as $1/\sqrt N$.
p: Run the same circuit $N$ times and count $k$, the number of times outcome 0 appears. Each shot is an independent trial with success probability $p$, so $k$ is binomially distributed.
eq*: P(k) = \binom{N}{k}p^k(1-p)^{N-k}, \qquad \mathbb{E}[k] = Np, \qquad \sigma_k = \sqrt{Np(1-p)} ;; counts from $N$ shots
eq*: \hat p = \frac{k}{N}, \qquad \sigma_{\hat p} = \sqrt{\frac{p(1-p)}{N}} ;; the estimated probability, and its standard error
p: The error falls as $1/\sqrt N$. Halving it takes four times the shots; one more decimal place takes a hundred times.
table: Shots $N$ | $\sigma_{\hat p}$ for $p = \tfrac12$ | Typical reading ;; $100$ | $0.050$ | $0.50 \pm 0.05$ ;; $1024$ | $0.016$ | $0.500 \pm 0.016$ ;; $10\,000$ | $0.005$ | $0.500 \pm 0.005$ ;; $1\,000\,000$ | $0.0005$ | $0.5000 \pm 0.0005$
ex: 1024 shots of a fair coin ;; $N = 1024$, $p = \tfrac12$: $\sigma_k = \sqrt{1024\cdot\tfrac12\cdot\tfrac12} = \sqrt{256} = 16$. ;; So about 68% of runs land within $512 \pm 16$ and about 95% within $512 \pm 32$. A result of 530 against 494 is entirely ordinary.
p: Getting *exactly* 512 is unlikely. For large $N$ the central binomial probability is approximately $\sqrt{2/(\pi N)}$.
eq: P\!\left(k = \tfrac{N}{2}\right) = \binom{N}{N/2}2^{-N} \approx \sqrt{\frac{2}{\pi N}} \approx 0.025 \quad (N = 1024) ;; an exact split happens about one run in forty
note: Shot noise is not a hardware fault. A perfect, noiseless device still shows it, because it comes from sampling. Hardware noise adds *bias* on top, a shift that more shots do not remove.
`,
    },
    {
      title: "Changing the basis",
      summary: "A measurement always asks the same question — so rotate the state before asking.",
      notes: String.raw`
idea: Hardware measures in the Z basis only. To measure in any other basis, apply the inverse of the rotation that makes that basis, then measure as usual.
eq*: P(b_i) = |\braket{b_i|\psi}|^2 = |\braket{i|U^\dagger|\psi}|^2, \qquad \ket{b_i} = U\ket{i} ;; measuring in the basis $\{U\ket{i}\}$ is applying $U^\dagger$, then measuring in $\{\ket{i}\}$
p: The X basis is made by $H$, and $H$ is its own inverse, so an X measurement is a Hadamard followed by an ordinary measurement. The Y basis is made by $SH$, so its inverse is $HS^\dagger$: first $S^\dagger$, then $H$.
table: To measure in | Apply first | Outcome 0 means | Outcome 1 means ;; Z basis | nothing | $\ket{0}$ | $\ket{1}$ ;; X basis | $H$ | $\ket{+}$ | $\ket{-}$ ;; Y basis | $S^\dagger$, then $H$ | $\ket{+i}$ | $\ket{-i}$
eq: HS^\dagger\ket{+i} = H\,\frac{\ket{0} + (-i)(i)\ket{1}}{\sqrt2} = H\ket{+} = \ket{0} ;; checking the Y-basis recipe
p: Bases like Z and X are *complementary*: a state that is certain in one is maximally uncertain in the other. The overlaps between their basis states all have the same size.
eq*: |\braket{+|0}|^2 = |\braket{-|0}|^2 = |\braket{+|1}|^2 = |\braket{-|1}|^2 = \tfrac12 ;; complementary bases: knowing Z tells you nothing about X
ex: Telling |+⟩ from |−⟩ ;; Measured directly, both give 50/50, so no number of shots separates them. ;; Apply $H$ first: $H\ket{+} = \ket{0}$ and $H\ket{-} = \ket{1}$. Now one shot is enough, with certainty.
note: This is how the Bloch vector of lesson 1.3 is estimated in practice: many shots measured directly give $\langle Z\rangle$, many after $H$ give $\langle X\rangle$, and many after $S^\dagger H$ give $\langle Y\rangle$.
`,
    },
    {
      title: "Classical registers",
      summary: "Where the outcomes go, and why the diagram has a second kind of wire.",
      notes: String.raw`
idea: A measurement writes a bit into a classical register. How those bits are ordered into a string is a convention, and Qiskit puts qubit 0 on the right.
eq*: \ket{x} = \ket{q_{n-1}\cdots q_1q_0}, \qquad x = \sum_{k=0}^{n-1} q_k\,2^k ;; little-endian: $q_0$ is the lowest bit and is printed last
table: Qubits | Printed string | Integer $x$ ;; $q_0 = 1,\ q_1 = 1,\ q_2 = 0$ | 011 | $3$ ;; $q_0 = 0,\ q_1 = 0,\ q_2 = 1$ | 100 | $4$ ;; $q_0 = 1,\ q_1 = 0,\ q_2 = 1$ | 101 | $5$
p: For several qubits the Born rule is unchanged: the probability of a whole string is the squared magnitude of its amplitude. The probability of *one* qubit's outcome is a marginal, found by summing over the other qubits.
eq*: P(q_k = b) = \sum_{x\,:\,x_k = b} |\alpha_x|^2 ;; the marginal probability of one qubit
ex: A marginal ;; $\ket{\psi} = \tfrac12\ket{00} + \tfrac12\ket{01} + \tfrac{1}{\sqrt2}\ket{11}$, written $\ket{q_1q_0}$. ;; $P(q_0 = 1) = |\alpha_{01}|^2 + |\alpha_{11}|^2 = \tfrac14 + \tfrac12 = \tfrac34$, and $P(q_1 = 1) = |\alpha_{11}|^2 = \tfrac12$.
p: Circuit diagrams draw classical bits as double lines, because what they carry is ordinary information: it can be copied, stored and used to decide later gates.
def: Deferred measurement ;; A measurement whose result only controls later gates can be moved to the end of the circuit, with the classical control replaced by a quantum controlled gate. The output statistics are identical. The teleportation walkthrough relies on this.
eq: \text{measure } q \text{, then apply } U \text{ if the result is } 1 \;\equiv\; \text{controlled-}U \text{ from } q \text{, then measure } q ;; the principle of deferred measurement
note: Keep the convention in mind when reading textbooks, which usually write the first qubit on the left: the same state is $\ket{q_0q_1}$ there and $\ket{q_1q_0}$ in Qiskit output.
`,
    },
  ],
};

export default notes;
