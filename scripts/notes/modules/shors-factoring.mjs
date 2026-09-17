const notes = {
  slug: "shors-factoring",
  title: "Shor's Factoring Algorithm",
  track: "Algorithms",
  summary:
    "The one that started the funding. Period finding via the quantum Fourier transform, and an honest look at the qubit count RSA-2048 needs.",
  conventions:
    "$N$ is the number to factor, with $n = \\lceil\\log_2 N\\rceil$ bits. $a$ is a random base with $\\gcd(a, N) = 1$, and $r$ is its order modulo $N$. The counting register has $t$ qubits and $M = 2^t$ basis states. $a \\bmod N$ is the remainder, and $\\equiv \\pmod N$ is congruence.",
  lessons: [
    {
      title: "Why factoring matters",
      summary: "The assumption a great deal of the internet is resting on.",
      notes: String.raw`
idea: Multiplying two large primes is easy; recovering them from the product is believed to be classically hard. RSA's security rests on that gap, and Shor's algorithm closes it.
eq*: N = pq, \qquad \varphi(N) = (p-1)(q-1), \qquad ed \equiv 1 \pmod{\varphi(N)} ;; an RSA key: public $(N, e)$, private $d$
eq*: c = m^e \bmod N, \qquad m = c^d \bmod N ;; encryption and decryption
p: Anyone who can factor $N$ can compute $\varphi(N)$, then $d$ from $e$, and decrypt everything. The best known classical method, the general number field sieve, is sub-exponential: faster than trying divisors, still far out of reach for 2048-bit moduli.
eq: L_N = \exp\!\left(\left(\tfrac{64}{9}\right)^{1/3}(\ln N)^{1/3}(\ln\ln N)^{2/3}\right) ;; the number field sieve's running time, to leading order
eq*: \text{Shor: } O\!\left(n^3\right) \ \text{gates for an } n\text{-bit } N ;; polynomial, with schoolbook arithmetic: faster multiplication lowers it further
table: Method | Time for $n$-bit $N$ | Character ;; trial division | $\approx 2^{n/2}$ | exponential ;; number field sieve | $L_N$ above | sub-exponential ;; Shor | $O(n^3)$ gates | polynomial
ex: RSA in miniature ;; $p = 5$, $q = 11$: $N = 55$ and $\varphi(N) = 40$. Take $e = 3$; then $d = 27$, since $3\cdot 27 = 81 = 2\cdot40 + 1$. ;; Encrypt $m = 2$: $c = 2^3 \bmod 55 = 8$. Decrypt: $8^{27} \bmod 55 = 2$. Factoring 55 is trivial, which is the whole point: at 2048 bits it is not.
`,
    },
    {
      title: "Factoring as period finding",
      summary: "The reduction that turns a number-theory problem into a wave problem.",
      notes: String.raw`
idea: Factoring reduces to finding the *order* $r$ of a random number $a$ modulo $N$. The sequence $a^x \bmod N$ repeats with period $r$, and a quantum computer finds periods efficiently.
eq*: r = \min\left\{\,r > 0 \;:\; a^r \equiv 1 \pmod N\,\right\} ;; the order of $a$ modulo $N$, defined when $\gcd(a, N) = 1$
p: If $r$ is even, $a^r - 1 = (a^{r/2} - 1)(a^{r/2} + 1)$ is a multiple of $N$. Unless $a^{r/2} \equiv -1$, neither bracket is itself a multiple of $N$, so each shares a proper factor with it, and a gcd extracts it.
eq*: \gcd\!\left(a^{r/2} - 1,\ N\right) \quad\text{and}\quad \gcd\!\left(a^{r/2} + 1,\ N\right) ;; the factors, when $r$ is even and $a^{r/2} \not\equiv -1 \pmod N$
eq: P\left(r \text{ even and } a^{r/2}\not\equiv -1\right) \ge \frac12 ;; for odd $N$ with at least two distinct prime factors: a few random tries suffice
p: Everything in this reduction is classical and fast, including the gcds, by Euclid's algorithm. Only finding $r$ is hard, and that is the part handed to the quantum computer.
table: $a$ | powers of $a \bmod 15$ | $r$ | $a^{r/2} \bmod 15$ | factors found ;; $2$ | $2, 4, 8, 1$ | $4$ | $4$ | $\gcd(3,15) = 3$, $\gcd(5,15) = 5$ ;; $7$ | $7, 4, 13, 1$ | $4$ | $4$ | $3$ and $5$ ;; $11$ | $11, 1$ | $2$ | $11$ | $\gcd(10,15) = 5$, $\gcd(12,15) = 3$ ;; $14$ | $14, 1$ | $2$ | $14 \equiv -1$ | none: pick another $a$
ex: N = 15, a = 7 ;; $7^1 \equiv 7$, $7^2 = 49 \equiv 4$, $7^3 \equiv 28 \equiv 13$, $7^4 \equiv 91 \equiv 1$, so $r = 4$. ;; $a^{r/2} = 7^2 \equiv 4$, which is not $-1 \equiv 14$. So $\gcd(3, 15) = 3$ and $\gcd(5, 15) = 5$: $15 = 3\times5$.
`,
    },
    {
      title: "Modular exponentiation",
      summary: "The part of the circuit that does the real work, and costs the most.",
      notes: String.raw`
idea: The circuit computes $a^x \bmod N$ for every $x$ in a superposition at once, by controlled modular multiplications. It is ordinary arithmetic made reversible, and it dominates the cost.
eq*: U_a\ket{y} = \ket{ay \bmod N} \quad (0 \le y < N) ;; modular multiplication: a permutation, so a unitary, because $\gcd(a, N) = 1$
eq*: \ket{x}\ket{1} \mapsto \ket{x}\ket{a^x \bmod N}, \qquad a^x = \prod_{j=0}^{t-1}\left(a^{2^j}\right)^{x_j} ;; controlled powers: one controlled $U_{a^{2^j}}$ per bit $x_j$ of the counting register
p: The powers $a^{2^j} \bmod N$ are computed classically in advance by repeated squaring, so the circuit only ever multiplies by known constants. Each multiplication is built from reversible adders, which is where most qubits and most gates go.
p: The key to why this helps lies in the eigenvectors of $U_a$. They are uniform superpositions over the cycle $1, a, a^2, \dots$, with phases that wind $s$ times around, and their eigenvalues carry $s/r$.
eq*: \ket{u_s} = \frac{1}{\sqrt r}\sum_{k=0}^{r-1}e^{-2\pi i sk/r}\ket{a^k \bmod N}, \qquad U_a\ket{u_s} = e^{2\pi i s/r}\ket{u_s} ;; eigenstates of modular multiplication
eq: \frac{1}{\sqrt r}\sum_{s=0}^{r-1}\ket{u_s} = \ket{1} ;; the easy input $\ket{1}$ is an equal mix of all of them
p: So starting the work register in $\ket{1}$ is starting in a superposition of eigenstates, each carrying a phase $s/r$. Phase estimation (lesson 8.4) reads one such $s/r$ at random, which is exactly what lesson 8.6 needs.
table: Register | Qubits | Role ;; counting | $t \approx 2n$ | holds $x$, later the phase estimate ;; work | $n$ | holds $a^x \bmod N$ ;; ancillas | $O(n)$ | scratch space for the reversible adders
ex: The cycle for a = 7, N = 15 ;; Multiplying by 7 cycles $1 \to 7 \to 4 \to 13 \to 1$, so $r = 4$. ;; The eigenstate with $s = 1$ is $\tfrac12\left(\ket{1} - i\ket{7} - \ket{4} + i\ket{13}\right)$. Multiplying each term by 7 shifts every label one step along the cycle, and that is the same as multiplying the whole state by $e^{2\pi i/4} = i$.
`,
    },
    {
      title: "The quantum Fourier transform",
      summary: "The same transform as the classical one, applied to amplitudes.",
      notes: String.raw`
idea: The QFT is the discrete Fourier transform acting on the $2^t$ amplitudes of a register. It needs only about $t^2/2$ gates, but its output can only be sampled, not read in full.
eq*: \mathrm{QFT}\ket{x} = \frac{1}{\sqrt M}\sum_{y=0}^{M-1}e^{2\pi i\,xy/M}\ket{y}, \qquad M = 2^t ;; the quantum Fourier transform
p: The circuit is a Hadamard on each qubit followed by controlled phase rotations from the less significant qubits, then a reversal of qubit order.
eq*: R_k = \begin{pmatrix}1&0\\0&e^{2\pi i/2^k}\end{pmatrix}, \qquad R_1 = Z,\ \ R_2 = S,\ \ R_3 = T ;; the controlled rotations
eq: \#\text{gates} = \underbrace{t}_{H} + \underbrace{\tfrac{t(t-1)}{2}}_{\text{controlled } R_k} + \underbrace{\lfloor t/2\rfloor}_{\text{swaps}} ;; circuit size
table: Transform | Operations on $M = 2^t$ values | Output ;; classical FFT | $O(t\,2^t)$ | every coefficient, exactly ;; QFT | $O(t^2)$ gates | one sample from the spectrum
p: In Shor's algorithm the QFT is used in reverse, as the last step of *phase estimation*. A register holding a phase gradient $e^{2\pi i\varphi x}$ is transformed into a state concentrated on the $t$-bit number closest to $M\varphi$.
eq*: \frac{1}{\sqrt M}\sum_{x=0}^{M-1}e^{2\pi i\varphi x}\ket{x} \ \xrightarrow{\ \mathrm{QFT}^\dagger\ }\ \approx \ket{\widetilde{M\varphi}} ;; phase estimation: the phase, written out as a binary number
p: The controlled powers of lesson 8.3 create exactly that gradient, with $\varphi = s/r$, because an eigenstate kicks its phase back onto every control qubit, just as the oracle did in lesson 6.3.
note: Rotations $R_k$ with large $k$ change the state very little. Dropping those beyond $k \approx \log_2 t + O(1)$ gives the *approximate QFT*, with a negligible loss of accuracy and about $t\log t$ gates.
ex: QFT of a basis state, t = 2 ;; $\mathrm{QFT}\ket{1} = \tfrac12\left(\ket{0} + i\ket{1} - \ket{2} - i\ket{3}\right)$: the phases $e^{2\pi i\,y/4} = 1, i, -1, -i$ wind once around the circle. ;; $\ket{2}$ would wind twice, giving $1, -1, 1, -1$. The winding number is the input, which is why $\mathrm{QFT}^\dagger$ can read it back.
`,
    },
    {
      title: "Reading a period",
      summary: "What the measurement after the QFT actually gives you.",
      notes: String.raw`
idea: The measurement does not return $r$. It returns a number $y$ close to $kM/r$ for a random $k$, so $y/M$ approximates the fraction $k/r$.
p: After the controlled powers, the counting register holds a superposition that repeats with period $r$, whether or not the work register is ever measured. The inverse QFT turns that periodicity into sharp peaks.
eq*: P(y) \approx \frac1r \ \ \text{for } y \approx k\,\frac{M}{r}, \qquad k = 0, 1, \dots, r-1 ;; $r$ peaks of equal height
eq*: \frac{y}{M} \approx \frac{k}{r} ;; what one measurement tells you
p: If $r$ divides $M$ the peaks are exact integers. Otherwise each peak is spread over neighbouring values, but the nearest integer still carries a large share of its weight.
eq: P\!\left(\left|\frac{y}{M} - \frac{k}{r}\right| \le \frac{1}{2M}\right) \ge \frac{4}{\pi^2 r} \quad\text{for each } k ;; the nearest integer to each peak: in total at least $4/\pi^2 \approx 0.41$
table: Measured $y$ for $N = 15$, $a = 7$, $M = 256$ | $y/M$ | Fraction $k/r$ | Candidate $r$ ;; $0$ | $0$ | $0/4$ | none: try again ;; $64$ | $0.25$ | $1/4$ | $4$ ✓ ;; $128$ | $0.5$ | $2/4 = 1/2$ | $2$ ✗ ($7^2 \not\equiv 1$) ;; $192$ | $0.75$ | $3/4$ | $4$ ✓
p: The table shows the two ways a run can fail. $k = 0$ carries no information, and when $k$ shares a factor with $r$ the fraction reduces and reveals only a divisor of $r$. Both are caught by checking whether $a^r \equiv 1$, and both are fixed by running again or by combining candidates.
eq: r = \mathrm{lcm}(r_1, r_2) \quad\text{from two runs giving reduced denominators } r_1, r_2 ;; combining partial answers
ex: Why r = 4 gives exact peaks ;; $M = 256 = 4\cdot64$, so $M/r = 64$ is an integer and $y \in \{0, 64, 128, 192\}$ each with probability exactly $\tfrac14$. ;; Half of all runs ($k = 1$ or $3$) give $r = 4$ immediately.
`,
    },
    {
      title: "Continued fractions",
      summary: "The classical trick that recovers r from an approximate fraction.",
      notes: String.raw`
idea: $y/M$ is a rational number close to $k/r$, with $r < N$. The continued-fraction expansion of $y/M$ finds the best such approximation efficiently, and a classic theorem says it will be among them.
eq*: \frac{y}{M} = a_0 + \cfrac{1}{a_1 + \cfrac{1}{a_2 + \cfrac{1}{\ddots}}} = [a_0; a_1, a_2, \dots] ;; the continued-fraction expansion
eq*: p_j = a_jp_{j-1} + p_{j-2}, \qquad q_j = a_jq_{j-1} + q_{j-2}, \qquad \frac{p_j}{q_j} = [a_0; a_1, \dots, a_j] ;; convergents, from $p_{-1} = 1, p_{-2} = 0, q_{-1} = 0, q_{-2} = 1$
eq*: \left|\frac{y}{M} - \frac{k}{r}\right| \le \frac{1}{2r^2} \;\Rightarrow\; \frac{k}{r} \text{ is a convergent of } \frac{y}{M} ;; Legendre's theorem
p: The measurement guarantees an error of at most $1/(2M)$. Choosing the counting register large enough, $M \ge N^2$, makes that at most $1/(2N^2) < 1/(2r^2)$, so the theorem applies. This is why $t \approx 2n$.
eq*: M = 2^t \ge N^2 ;; the size of the counting register
p: The recipe: expand $y/M$, and for each convergent $p_j/q_j$ with $q_j < N$, test whether $a^{q_j} \equiv 1 \pmod N$. The first that passes is a candidate order. The expansion has $O(n)$ terms, so this is fast.
ex: N = 21, a = 2, M = 512 ;; The order is $r = 6$, since $2^6 = 64 = 3\cdot21 + 1$. A run returns $y = 427$, the nearest integer to $5\cdot512/6 \approx 426.7$. ;; $427/512 = [0; 1, 5, 42, 2]$: $512 = 1\cdot427 + 85$, $427 = 5\cdot85 + 2$, $85 = 42\cdot2 + 1$, $2 = 2\cdot1$. ;; Convergents: $0/1$, $1/1$, $5/6$, $211/253$, $427/512$. The first denominator that works is $6$: $2^6 \equiv 1 \pmod{21}$. ;; Then $2^3 = 8 \not\equiv -1$, so $\gcd(7, 21) = 7$ and $\gcd(9, 21) = 3$: $21 = 3\times7$.
`,
    },
    {
      title: "The whole algorithm",
      summary: "Every step in order, and how little of it is quantum.",
      notes: String.raw`
idea: Shor's algorithm is a classical reduction wrapped around one quantum subroutine, period finding. Everything before and after the quantum step is ordinary number theory.
table: Step | What happens | Where ;; 1 | if $N$ is even or a prime power, factor it directly | classical ;; 2 | pick random $a$; if $\gcd(a, N) > 1$, that gcd is a factor | classical ;; 3 | prepare $\ket{0}^{\otimes t}\ket{1}$, apply $H^{\otimes t}$ | quantum ;; 4 | controlled modular exponentiation, $\ket{x}\ket{1}\mapsto\ket{x}\ket{a^x \bmod N}$ | quantum ;; 5 | apply $\mathrm{QFT}^\dagger$ to the counting register and measure $y$ | quantum ;; 6 | continued fractions on $y/M$, giving a candidate $r$; check $a^r \equiv 1$ | classical ;; 7 | if $r$ is even and $a^{r/2}\not\equiv -1$, output $\gcd(a^{r/2}\pm1, N)$; otherwise repeat | classical
circuit: Period finding
counting: |0⟩^t ──H^⊗t──●──────────────QFT†──M──▶ y
                        │
    work: |1⟩ ──────────U: x ↦ a^x mod N──────────
:end
p: Each run succeeds with a probability bounded below by a slowly shrinking function of $N$, at worst proportional to $1/\log\log N$, so a small number of repetitions finds the factors.
eq*: \text{qubits} \approx \underbrace{2n}_{\text{counting}} + \underbrace{n}_{\text{work}} + O(n)_{\text{ancillas}}, \qquad \text{gates} = O(n^3) ;; the size of one run
p: Careful circuit design shrinks the width. The counting register can be replaced by a single qubit that is measured and reset $2n$ times, with the phase corrections applied classically. That gives constructions with $2n + 3$ qubits in total (Beauregard, 2003).
eq: \text{semiclassical QFT:} \quad 2n \text{ counting qubits} \;\to\; 1 \text{ recycled qubit} ;; the width saving, paid for in mid-circuit measurements
ex: Counting for RSA-2048 ;; $n = 2048$: about $4096$ counting qubits and $2048$ work qubits in the textbook layout, or around $4100$ logical qubits in a $2n + 3$ design. ;; Every one of those must be a *logical*, error-corrected qubit, which is where lesson 8.8 begins.
`,
    },
    {
      title: "Error budgets",
      summary: "Why the famous demonstrations factor 15, and why that is not a scandal.",
      notes: String.raw`
idea: A circuit of $G$ gates with error $p$ each succeeds with probability about $e^{-pG}$. Shor's circuits are millions to billions of gates, so they need error correction, and error correction multiplies the qubit count by roughly a thousand.
eq*: P_{\text{success}} \approx (1 - p)^G \approx e^{-pG} ;; unprotected gates
p: With today's physical error rates near $10^{-3}$, a million-gate circuit has $pG = 1000$ and essentially no chance of running cleanly. Only circuits of a few hundred gates survive without correction.
eq*: p_L \approx A\left(\frac{p}{p_{\text{th}}}\right)^{\lfloor(d+1)/2\rfloor}, \qquad n_{\text{phys}} \approx 2d^2 ;; surface code of distance $d$: logical error rate and physical qubits per logical qubit
p: Below the threshold $p_{\text{th}} \approx 10^{-2}$, every increase of the code distance by two multiplies the logical error rate by $p/p_{\text{th}}$. The price is qubits, growing as $d^2$.
ex: Sizing one logical qubit ;; Take $p = 10^{-3}$, $p_{\text{th}} = 10^{-2}$, $A = 0.1$, and a target of $p_L \approx 10^{-12}$ for a long computation. ;; Then $0.1\times0.1^{(d+1)/2} \le 10^{-12}$ requires $(d+1)/2 \ge 11$, so $d = 21$ and $n_{\text{phys}} \approx 2\cdot21^2 = 882$: roughly a thousand physical qubits per logical qubit.
table: Estimate for RSA-2048 | Physical qubits | Run time ;; Gidney and Ekerå, 2019 | about 20 million | about 8 hours ;; Gidney, 2025 | under 1 million | under a week
p: Against that scale, factoring 15 or 21 is a demonstration of the circuit's parts, not of its power. Several early demonstrations also used circuits simplified with knowledge of the answer, which Smolin, Smith and Vargo (2013) showed can "factor" numbers of any size without doing any real work.
note: Estimates assume a physical error rate near $10^{-3}$ and nearest-neighbour connectivity, and they have fallen steadily as algorithms and error-correction schemes improve. Treat them as orders of magnitude.
`,
    },
    {
      title: "What this means for cryptography",
      summary: "What breaks, what does not, and why the migration started already.",
      notes: String.raw`
idea: Shor breaks every widely deployed public-key scheme built on factoring or discrete logarithms. Symmetric cryptography only needs larger keys. The replacement schemes are standardised, and migration has begun, because encrypted data can be stored today and decrypted later.
table: Scheme | Hard problem | Quantum attack | Status ;; RSA | factoring | Shor | broken ;; Diffie–Hellman, DSA | discrete logarithm | Shor | broken ;; elliptic-curve (ECDH, ECDSA) | elliptic-curve discrete log | Shor | broken ;; AES, ChaCha20 | key search | Grover | use 256-bit keys ;; SHA-2, SHA-3 | preimages | Grover | use longer outputs ;; ML-KEM, ML-DSA | module lattices | none known | standardised 2024 ;; SLH-DSA | hash functions | Grover only | standardised 2024
eq*: \text{AES-}k: \ 2^k \to 2^{k/2}, \qquad \text{hash preimage: } 2^h \to 2^{h/2} ;; Grover's effect on symmetric primitives (module 7)
p: Elliptic-curve cryptography falls to a variant of Shor's algorithm for discrete logarithms, and it needs fewer logical qubits than RSA at comparable classical security, because its keys are much shorter.
eq: \text{ECDLP on an } n\text{-bit curve:} \quad \le 9n + 2\lceil\log_2 n\rceil + 10 \ \text{logical qubits} \quad (n = 256:\ 2330) ;; an upper-bound estimate (Roetteler et al., 2017)
p: In August 2024 NIST published its first post-quantum standards: FIPS 203 (ML-KEM, from Kyber) for key exchange, and FIPS 204 (ML-DSA, from Dilithium) and FIPS 205 (SLH-DSA, from SPHINCS+) for signatures. HQC was selected in 2025 as a backup key-encapsulation scheme based on different mathematics.
def: Harvest now, decrypt later ;; An adversary records encrypted traffic today and decrypts it once a large quantum computer exists. Data that must stay secret for years is therefore already at risk, even though no such computer exists yet.
eq*: x + y > z \;\Rightarrow\; \text{start migrating now} ;; Mosca's inequality: $x$ years of required secrecy, $y$ years to migrate, $z$ years until a cryptographically relevant quantum computer
ex: Applying Mosca's inequality ;; Medical records must stay confidential for $x = 25$ years, and migrating a hospital network's systems takes $y = 5$. ;; If a cryptographically relevant quantum computer is $z = 15$ years away, then $x + y = 30 > 15$. The last records encrypted with RSA, at the end of the migration, would still need $x + y - z = 15$ years of secrecy after that computer arrives, so the migration is already late.
`,
    },
  ],
};

export default notes;
