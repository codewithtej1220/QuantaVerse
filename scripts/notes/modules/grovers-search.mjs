const notes = {
  slug: "grovers-search",
  title: "Grover's Search Algorithm",
  track: "Algorithms",
  summary:
    "Amplify the answer you want. Build the oracle and the diffuser, then watch amplitude drain from every wrong state in √N iterations.",
  conventions:
    "$N = 2^n$ items are indexed by $n$ qubits, $w$ is the marked item, $\\ket{s} = H^{\\otimes n}\\ket{0}^{\\otimes n}$ is the uniform superposition, and $M$ is the number of marked items when there is more than one. Bit strings are written $q_{n-1}\\cdots q_0$.",
  lessons: [
    {
      title: "Unstructured search",
      summary: "A haystack with no structure at all, and what that costs classically.",
      notes: String.raw`
idea: With no structure to exploit, a classical search must check items one by one. Grover's algorithm finds the marked item with about $\tfrac\pi4\sqrt N$ queries, and no quantum algorithm can do better than order $\sqrt N$.
eq*: f : \{0,\dots,N-1\}\to\{0,1\}, \qquad f(x) = 1 \iff x = w ;; the search problem, as an oracle
p: "Unstructured" means the only way to learn about an item is to ask the oracle about it. No sorting, no hashing, no gradient. Classically, each query rules out one item.
eq*: \mathbb{E}[Q_{\text{classical}}] = \frac{N+1}{2}, \qquad Q_{\text{Grover}} \approx \frac{\pi}{4}\sqrt N ;; expected queries: opening boxes in turn, against Grover
table: Items $N$ | Classical, on average | Classical, worst case | Grover iterations ;; $4$ | $2.5$ | $4$ | $1$ ;; $1024$ | $512.5$ | $1024$ | $25$ ;; $10^6$ | $\approx 5\times10^5$ | $10^6$ | $785$ ;; $10^{12}$ | $\approx 5\times10^{11}$ | $10^{12}$ | $785\,398$
p: The speed-up is quadratic, and it is optimal. Any quantum algorithm that finds $w$ with high probability must query the oracle order $\sqrt N$ times. This lower bound (Bennett, Bernstein, Brassard and Vazirani) is why search is not expected to become exponentially faster.
eq*: Q_{\text{quantum}} = \Omega\!\left(\sqrt N\right) ;; the BBBV lower bound: Grover is optimal
def: The oracle is the bottleneck ;; Counting queries treats the oracle as free. In practice it is a reversible circuit that evaluates $f$, and its cost multiplies every iteration.
ex: Four boxes ;; Classically, open boxes in a random order: the prize is in box 1, 2, 3 or 4 of that order with probability $\tfrac14$ each, so the expected number opened is $\tfrac14(1+2+3+4) = 2.5$. ;; Grover's single iteration on two qubits finds it with probability 1, as the walkthrough on the algorithms page shows.
`,
    },
    {
      title: "Marking the answer",
      summary: "An oracle that flips a sign, and nothing else.",
      notes: String.raw`
idea: The oracle flips the sign of the marked item's amplitude and leaves everything else alone. The probabilities do not change, so marking alone reveals nothing.
eq*: O_w\ket{x} = (-1)^{f(x)}\ket{x} = \begin{cases}-\ket{x} & x = w\\ \ket{x} & x \ne w\end{cases} ;; the phase oracle
eq*: O_w = I - 2\ket{w}\!\bra{w} ;; the same oracle, as an operator: a reflection that reverses $\ket{w}$
p: Start in the uniform superposition, where every amplitude is $1/\sqrt N$. After the oracle one amplitude is $-1/\sqrt N$, and every probability is still $1/N$.
eq: O_w\ket{s} = \frac{1}{\sqrt N}\sum_{x\ne w}\ket{x} - \frac{1}{\sqrt N}\ket{w} ;; after marking: a sign, not a probability
p: A phase oracle can be built from a bit oracle with an ancilla in $\ket{-}$ (lesson 6.3), or directly from a multi-controlled $Z$. $C^{n-1}Z$ flips the sign of $\ket{1\cdots1}$ only. To mark some other string, wrap it in $X$ gates on the qubits where $w$ has a 0.
eq*: O_w = X^{\bar w}\,\left(C^{n-1}Z\right)\,X^{\bar w}, \qquad X^{\bar w} = \bigotimes_{k\,:\,w_k = 0}X_k ;; marking any string with one multi-controlled $Z$
eq: \mathrm{CZ} = (I\otimes H)\,\mathrm{CNOT}\,(I\otimes H) ;; for two qubits: a controlled-$Z$ from a CNOT between Hadamards
table: Marked $w = q_1q_0$ | Oracle on two qubits ;; $11$ | CZ ;; $10$ | $X$ on $q_0$, CZ, $X$ on $q_0$ ;; $01$ | $X$ on $q_1$, CZ, $X$ on $q_1$ ;; $00$ | $X$ on both, CZ, $X$ on both
ex: Two qubits, w = 11 ;; $\ket{s} = \tfrac12(\ket{00} + \ket{01} + \ket{10} + \ket{11})$. CZ gives $\tfrac12(\ket{00} + \ket{01} + \ket{10} - \ket{11})$. ;; Each outcome still has probability $\tfrac14$: measuring now would be a blind guess. The walkthrough draws exactly this, one bar flipping below the axis.
`,
    },
    {
      title: "Amplitude amplification",
      summary: "The geometric picture: two reflections make a rotation.",
      notes: String.raw`
idea: Everything happens in a plane spanned by $\ket{w}$ and the uniform superposition of the other items. The oracle and the diffuser are two reflections in that plane, and two reflections make a rotation towards $\ket{w}$.
eq*: \ket{s} = \sin\theta\,\ket{w} + \cos\theta\,\ket{s'}, \qquad \sin\theta = \frac{1}{\sqrt N} ;; the start, in the plane of $\ket{w}$ and $\ket{s'} = \frac{1}{\sqrt{N-1}}\sum_{x\ne w}\ket{x}$
p: The starting state lies at a small angle $\theta$ above $\ket{s'}$. The oracle reverses the $\ket{w}$ component, which reflects the state about $\ket{s'}$. The diffuser reflects about $\ket{s}$ itself.
eq*: O_w = I - 2\ket{w}\!\bra{w}, \qquad D = 2\ket{s}\!\bra{s} - I ;; the two reflections
p: Composing two reflections whose mirrors meet at angle $\theta$ rotates by $2\theta$. Each Grover iteration therefore moves the state $2\theta$ closer to $\ket{w}$, and after $k$ iterations it has turned through $2k\theta$ from its start.
eq*: G = D\,O_w, \qquad G^k\ket{s} = \sin\big((2k+1)\theta\big)\ket{w} + \cos\big((2k+1)\theta\big)\ket{s'} ;; $k$ Grover iterations
eq*: P_k = \sin^2\big((2k+1)\theta\big) ;; the probability of measuring $w$ after $k$ iterations
table: State | Angle above $\ket{s'}$ | Amplitude on $\ket{w}$ ;; $\ket{s}$ | $\theta$ | $\sin\theta$ ;; $O_w\ket{s}$ | $-\theta$ | $-\sin\theta$ ;; $D\,O_w\ket{s} = G\ket{s}$ | $3\theta$ | $\sin 3\theta$ ;; $G^k\ket{s}$ | $(2k+1)\theta$ | $\sin\big((2k+1)\theta\big)$
note: The same analysis works whenever a procedure succeeds with probability $p = \sin^2\theta$. That generalisation is *amplitude amplification*, the subject of lesson 7.7.
ex: The angle for four items ;; $N = 4$: $\sin\theta = \tfrac12$, so $\theta = 30^\circ$. The oracle takes the state to $-30^\circ$, and the diffuser reflects it about the $30^\circ$ line to $90^\circ$: exactly $\ket{w}$. One iteration, certainty.
`,
    },
    {
      title: "The diffuser",
      summary: "Inversion about the mean, and why it makes one amplitude grow.",
      notes: String.raw`
idea: The diffuser replaces each amplitude $a$ by $2\bar a - a$, a reflection about the mean. Amplitudes near the mean barely move, while one far below it is thrown far above.
eq*: D = 2\ket{s}\!\bra{s} - I = H^{\otimes n}\left(2\ket{0}\!\bra{0} - I\right)H^{\otimes n} ;; the diffuser, and why it is built from Hadamards
eq*: D\sum_x a_x\ket{x} = \sum_x\left(2\bar a - a_x\right)\ket{x}, \qquad \bar a = \frac1N\sum_x a_x ;; inversion about the mean
p: The second form follows in one line: $2\ket{s}\!\braket{s|\psi}$ equals $2\cdot\tfrac{1}{\sqrt N}\sum_x\ket{x}\cdot\tfrac{1}{\sqrt N}\sum_y a_y = 2\bar a\sum_x\ket{x}$, and subtracting $\ket{\psi}$ leaves $2\bar a - a_x$ on each basis state.
p: In a circuit, the reflection about $\ket{0\cdots0}$ is built from $X$ gates and a multi-controlled $Z$. Built that way it comes out with an overall minus sign, which is a global phase and harmless.
eq: X^{\otimes n}\left(C^{n-1}Z\right)X^{\otimes n} = I - 2\ket{0\cdots0}\!\bra{0\cdots0} = -\left(2\ket{0\cdots0}\!\bra{0\cdots0} - I\right) ;; the circuit implements $-D$
circuit: The two-qubit diffuser
q0: ──H──X──●──X──H──
q1: ──H──X──Z──X──H──
:end
table: Item | After the oracle | Mean $\bar a$ | $2\bar a - a$ ;; $\ket{00}$ | $+\tfrac12$ | $\tfrac14$ | $0$ ;; $\ket{01}$ | $+\tfrac12$ | $\tfrac14$ | $0$ ;; $\ket{10}$ | $+\tfrac12$ | $\tfrac14$ | $0$ ;; $\ket{11}$ (marked) | $-\tfrac12$ | $\tfrac14$ | $+1$
ex: Why the marked one grows ;; For large $N$ the mean is almost $1/\sqrt N$. An unmarked amplitude $a = 1/\sqrt N$ becomes $2\bar a - a \approx 1/\sqrt N$, almost unchanged. ;; The marked amplitude $-1/\sqrt N$ becomes about $3/\sqrt N$, three times its original size, while each unmarked one shrinks only slightly to keep the total probability at one.
`,
    },
    {
      title: "One iteration",
      summary: "Putting the two reflections together, and watching the amplitude climb.",
      notes: String.raw`
idea: One Grover iteration is the oracle followed by the diffuser. It costs one query and rotates the state by $2\theta \approx 2/\sqrt N$ towards the answer.
eq*: G = D\,O_w ;; one Grover iteration: mark, then reflect about the mean
circuit: One iteration on two qubits, w = 11: the CZ oracle, then the diffuser
q0: ──H──●──H──X──●──X──H──M
q1: ──H──Z──H──X──Z──X──H──M
:end
p: For large $N$, $\theta \approx 1/\sqrt N$, so each iteration adds about $2/\sqrt N$ to the angle. The marked amplitude, $\sin((2k+1)\theta)$, grows almost linearly at first.
eq*: \sin 3\theta = 3\sin\theta - 4\sin^3\theta \approx \frac{3}{\sqrt N} ;; the marked amplitude after one iteration: roughly tripled
eq: \theta = \arcsin\frac{1}{\sqrt N} \approx \frac{1}{\sqrt N} \quad (N \gg 1) ;; the rotation per half-step
table: $N$ | $\theta$ | $P$ before | $P$ after one iteration ;; $4$ | $30^\circ$ | $0.25$ | $1.000$ ;; $16$ | $14.48^\circ$ | $0.0625$ | $0.473$ ;; $64$ | $7.18^\circ$ | $0.0156$ | $0.135$ ;; $1024$ | $1.79^\circ$ | $0.00098$ | $0.0088$
p: The cost of an iteration is one oracle call plus the diffuser, whose multi-controlled $Z$ needs $O(n)$ elementary gates with an ancilla. Total gates therefore grow as $O(\sqrt N\cdot n)$ plus the oracle's own cost.
eq: \text{gates} = O\!\left(\sqrt N\,(n + c_{\text{oracle}})\right) ;; the full circuit's size
ex: Four items, exactly ;; $N = 4$, $\theta = \tfrac\pi6$. After one iteration the angle is $3\theta = \tfrac\pi2$, so $P_1 = \sin^2\tfrac\pi2 = 1$. ;; Amplitude by amplitude, the table of lesson 7.4 shows the same thing: $(\tfrac12, \tfrac12, \tfrac12, -\tfrac12) \mapsto (0, 0, 0, 1)$. Two qubits and one query find the item with certainty.
`,
    },
    {
      title: "How many iterations",
      summary: "Why more is not better, and what happens if you overshoot.",
      notes: String.raw`
idea: Stop when the state is closest to $\ket{w}$, after about $\tfrac\pi4\sqrt N$ iterations. The state keeps rotating, so running longer moves it past the answer and the success probability falls again.
eq*: k^* = \left\lfloor\frac{\pi}{4\theta}\right\rfloor \approx \frac{\pi}{4}\sqrt N ;; the optimal number of iterations
eq*: P_{k^*} \ge 1 - \frac1N ;; the success probability at the optimum
p: The optimum comes from asking for $(2k+1)\theta \approx \tfrac\pi2$. Since $k$ must be a whole number, the final angle misses $\tfrac\pi2$ by at most $\theta$, which costs at most $\sin^2\theta = 1/N$ in probability.
table: $N$ | $\theta$ | $k^*$ | $P_{k^*}$ ;; $4$ | $30.00^\circ$ | $1$ | $1.0000$ ;; $16$ | $14.48^\circ$ | $3$ | $0.9613$ ;; $64$ | $7.18^\circ$ | $6$ | $0.9966$ ;; $1024$ | $1.79^\circ$ | $25$ | $0.9995$
p: Overshooting is not harmless. The probability oscillates with period about $\pi/(2\theta)$ iterations, so doubling the optimal count brings it back near zero.
eq: N = 4,\ k = 2: \quad P_2 = \sin^2\frac{5\pi}{6} = \frac14 ;; one iteration too many, and four items are back to a guess
p: With $M$ marked items the angle is larger and fewer iterations are needed. When $M$ is unknown, *quantum counting* estimates it first, or a randomised schedule of iteration counts finds a marked item in expected $O(\sqrt{N/M})$ queries anyway.
eq*: \sin\theta = \sqrt{\frac{M}{N}}, \qquad k^* \approx \frac{\pi}{4}\sqrt{\frac{N}{M}} ;; $M$ marked items
ex: A million items ;; $N = 2^{20} = 1\,048\,576$: $\theta = \arcsin(1/1024) \approx 0.05596^\circ$, so $k^* = \lfloor \pi/(4\theta)\rfloor = 804$ iterations, and $P_{804} > 0.9999$. ;; A classical search would open about half a million boxes on average.
`,
    },
    {
      title: "What a quadratic speed-up buys",
      summary: "Real, useful, and not the thing that breaks encryption.",
      notes: String.raw`
idea: Grover turns $N$ into $\sqrt N$. That halves the exponent of brute-force search, which is significant, but it is countered simply by doubling key lengths, unlike Shor's exponential speed-up.
eq*: \text{brute-force search over } k\text{-bit keys:} \quad 2^k \;\to\; \approx 2^{k/2} \ \text{oracle calls} ;; Grover against symmetric keys
table: Target | Classical | With Grover | Remedy ;; AES-128 key | $2^{128}$ | $\approx 2^{64}$ | use AES-256 ;; AES-256 key | $2^{256}$ | $\approx 2^{128}$ | already sufficient ;; $n$-bit hash preimage | $2^{n}$ | $\approx 2^{n/2}$ | longer outputs
p: The practical gain is smaller than the exponent suggests. Every iteration is a full reversible evaluation of the cipher, run under error correction, and the iterations must happen in sequence. Splitting the search across $p$ machines helps only by $\sqrt p$.
eq*: p \text{ machines, each searching } N/p \text{ items:} \quad \approx \frac{\pi}{4}\sqrt{\frac{N}{p}} \ \text{iterations each} ;; parallel Grover: total work grows as $\sqrt{pN}$
p: The idea is more general than search. Any procedure that succeeds with probability $p$, without telling you whether it did, would classically be repeated about $1/p$ times. *Amplitude amplification* reaches constant success in about $1/\sqrt p$ repetitions, the same quadratic saving.
eq*: \text{repetitions:} \quad O\!\left(\frac1p\right) \;\to\; O\!\left(\frac{1}{\sqrt p}\right) ;; amplitude amplification
table: Speed-up | Example | Effect on cryptography ;; quadratic | Grover, amplitude amplification | double symmetric key sizes ;; exponential | Shor (module 8) | RSA and elliptic curves broken outright
ex: How long 2^64 takes ;; Suppose, optimistically, a fault-tolerant machine completes one AES Grover iteration per microsecond. $2^{64} \approx 1.8\times10^{19}$ iterations take $1.8\times10^{13}$ seconds, about 580 000 years, in sequence. Classical brute force of AES-128 is hopeless too, but that figure shows why doubling the key length is the accepted answer.
`,
    },
  ],
};

export default notes;
