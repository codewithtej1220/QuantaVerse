const notes = {
  slug: "circuits-with-qiskit",
  title: "Circuits with Qiskit",
  track: "Hardware",
  summary:
    "Move from diagrams to code. Build, transpile, and simulate circuits in Qiskit, then read the transpiler's output like a compiler log.",
  conventions:
    "Code is Qiskit 1.x and 2.x. Qiskit numbers qubits from 0 and orders basis states little-endian, $\\ket{q_{n-1}\\cdots q_0}$, in amplitudes, matrices and count strings alike. $d$ is circuit depth, $n$ the number of qubits and $N$ the number of shots.",
  lessons: [
    {
      title: "QuantumCircuit",
      summary: "The object everything else in Qiskit hangs off.",
      notes: String.raw`
idea: A QuantumCircuit is a list of instructions over numbered qubits and classical bits. It describes a computation; nothing runs until it is handed to a simulator or a device.
code: Creating a circuit
from qiskit import QuantumCircuit

qc = QuantumCircuit(2, 2)   # 2 qubits, 2 classical bits
print(qc.num_qubits, qc.num_clbits)   # 2 2
:end
p: Every qubit starts in $\ket{0}$, so a fresh circuit with $n$ qubits represents the all-zero state, a vector of $2^n$ amplitudes with a single 1 in it.
eq*: \ket{\psi_0} = \ket{0}^{\otimes n} = \ket{0\cdots0} ;; the initial state of every circuit
p: Registers can be named and combined, which matters once a circuit has an input register, a work register and ancillas.
code: Named registers
from qiskit import QuantumRegister, ClassicalRegister, QuantumCircuit

data = QuantumRegister(3, "data")
anc = QuantumRegister(1, "anc")
out = ClassicalRegister(3, "out")
qc = QuantumCircuit(data, anc, out)   # qubits data[0..2], anc[0]
:end
def: Instruction ;; One gate, measurement, reset or barrier, together with the qubits and bits it acts on. A circuit is an ordered list of them, available as qc.data (lesson 5.8).
table: Property | Meaning | Call ;; width | qubits plus classical bits | qc.width() ;; size | number of operations | qc.size() ;; depth | number of layers (lesson 5.7) | qc.depth() ;; operation counts | how many of each gate | qc.count_ops()
eq: U_{\text{circuit}} = U_k\cdots U_2U_1 \quad\text{for instructions } 1,\dots,k \text{ in order} ;; what a measurement-free circuit represents
ex: Sizing a register ;; A 20-qubit circuit represents a state of $2^{20} = 1\,048\,576$ amplitudes. At 16 bytes per complex amplitude that is 16 MB to simulate exactly, and every extra qubit doubles it.
`,
    },
    {
      title: "Adding gates",
      summary: "The method names, and the argument order that trips everyone once.",
      notes: String.raw`
idea: Gates are methods named after them, qubit arguments come after any angles, and for controlled gates the control comes first.
code: The common gates
from math import pi

qc = QuantumCircuit(2, 2)
qc.h(0)              # Hadamard on qubit 0
qc.x(1); qc.y(1); qc.z(1)
qc.s(0); qc.sdg(0)   # S and S-dagger
qc.t(0); qc.tdg(0)   # T and T-dagger
qc.rz(pi / 4, 0)     # angle first, then the qubit
qc.cx(0, 1)          # control 0, target 1
qc.measure([0, 1], [0, 1])   # qubits, then classical bits
:end
table: Gate | Method | Arguments ;; $H$, $X$, $Y$, $Z$, $S$, $T$ | h, x, y, z, s, t | qubit ;; $S^\dagger$, $T^\dagger$ | sdg, tdg | qubit ;; $R_x$, $R_y$, $R_z$ | rx, ry, rz | angle, qubit ;; CNOT | cx | control, target ;; controlled-$Z$ | cz | qubit, qubit (symmetric) ;; measurement | measure | qubit(s), classical bit(s)
p: Because Qiskit is little-endian, the matrix of a two-qubit gate depends on which qubit is which. A CNOT from qubit 0 to qubit 1 is not the textbook CNOT matrix, which assumes the control is written first.
eq*: \mathrm{CX}_{0\to1} = \begin{pmatrix}1&0&0&0\\0&0&0&1\\0&0&1&0\\0&1&0&0\end{pmatrix} \quad\text{in the basis } \ket{q_1q_0} = \ket{00},\ket{01},\ket{10},\ket{11} ;; control $q_0$, the low bit
p: Angles can also be symbolic, bound to values later, so one circuit serves a whole parameter sweep.
code: Parameters
from qiskit.circuit import Parameter

theta = Parameter("θ")
qc.ry(theta, 0)
bound = qc.assign_parameters({theta: 0.6435})   # about 90/10 (lesson 3.5)
:end
ex: Reading an index ;; After qc.x(0) on two qubits, the state is $\ket{q_1q_0} = \ket{01}$, index $x = 1$, not $\ket{10}$. After qc.x(1) instead it is $\ket{10}$, index $2$. Reading the rightmost digit as qubit 0 avoids nearly every ordering bug.
`,
    },
    {
      title: "Running it",
      summary: "Shots, samplers, and getting counts back out.",
      notes: String.raw`
idea: A sampler runs a measured circuit a number of times and returns counts: how often each bit string came out.
code: Sampling a Bell pair
from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler

qc = QuantumCircuit(2, 2)
qc.h(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])

sampler = StatevectorSampler()
result = sampler.run([qc], shots=1024).result()
counts = result[0].data.c.get_counts()   # 'c' is the register's name
print(counts)   # e.g. {'00': 519, '11': 505}
:end
p: Counts are samples, not probabilities. Dividing by the number of shots estimates each probability, with the statistical error of lesson 2.3.
eq*: \hat p_x = \frac{n_x}{N}, \qquad \mathrm{SE}(\hat p_x) = \sqrt{\frac{\hat p_x(1 - \hat p_x)}{N}} ;; estimating a probability from counts
p: Many quantities of interest are expectation values rather than single probabilities. For observables that are products of $Z$, each outcome contributes $+1$ or $-1$ according to the parity of the measured bits.
eq*: \langle Z_0Z_1\rangle = p_{00} - p_{01} - p_{10} + p_{11} ;; a parity expectation from counts
eq: \langle Z_0\rangle = p_{00} + p_{10} - p_{01} - p_{11} \quad(\text{bit } q_0 \text{ is the rightmost}) ;; a single-qubit expectation, marginalised
def: Primitives ;; Qiskit's two primitives are the Sampler, which returns counts or quasi-probabilities, and the Estimator, which returns expectation values of observables directly. On hardware, the same interface runs on real devices with error mitigation.
ex: Reading the Bell counts ;; From {'00': 519, '11': 505}: $\hat p_{00} = 519/1024 \approx 0.507$ with standard error $\approx 0.016$, consistent with $\tfrac12$. And $\langle Z_0Z_1\rangle = (519 + 505)/1024 = 1$: the two bits always agree.
`,
    },
    {
      title: "The statevector simulator",
      summary: "Exact amplitudes, no sampling, and why it is the one you learn with.",
      notes: String.raw`
idea: A statevector simulator multiplies the circuit's gates into the vector of $2^n$ amplitudes and returns them exactly: no shots and no noise, only memory.
eq*: \ket{\psi} = U_{\text{circuit}}\ket{0}^{\otimes n}, \qquad p(x) = |\braket{x|\psi}|^2 ;; what the simulator computes
code: Exact amplitudes
from qiskit.quantum_info import Statevector

bell = qc.remove_final_measurements(inplace=False)
sv = Statevector.from_instruction(bell)
print(sv)                       # [0.707+0j, 0, 0, 0.707+0j]
print(sv.probabilities_dict())  # {'00': 0.5, '11': 0.5}
:end
p: Sampled and exact results answer different questions. The sampler shows what an experiment would record; the statevector shows the state itself, including phases that no single measurement reveals.
table: | Sampler, 1024 shots | Statevector ;; Output | {'00': 511, '11': 513} | $0.707\ket{00} + 0.707\ket{11}$ ;; Phases visible | no | yes ;; Error | about $\pm 0.016$ per probability | none, up to rounding ;; Cost | grows with shots | grows as $2^n$
p: Each gate touches every amplitude, so applying one costs time proportional to $2^n$. Memory is the hard wall.
eq*: \text{memory} = 16 \cdot 2^n \ \text{bytes} ;; complex128 amplitudes: 16 GB at $n = 30$, 16 TB at $n = 40$
eq: \text{time per gate} = O(2^n), \qquad \text{circuit of } G \text{ gates} = O(G\cdot 2^n) ;; the cost of exact simulation
note: Other simulators trade exactness or generality for size: stabiliser simulators handle Clifford circuits of thousands of qubits (lesson 3.7), and tensor-network simulators handle circuits with little entanglement.
ex: Seeing a phase ;; $\ket{\Phi^+}$ and $\ket{\Phi^-}$ give identical counts, 00 and 11 about half each. Their statevectors differ, $[0.707, 0, 0, 0.707]$ against $[0.707, 0, 0, -0.707]$, and that sign is exactly what superdense coding uses to carry a second bit.
`,
    },
    {
      title: "Basis gates",
      summary: "The short list a real machine can actually perform.",
      notes: String.raw`
idea: A device implements a handful of native gates. Every other gate must be rewritten in terms of them before the circuit can run.
p: A typical superconducting basis is $\{R_z, \sqrt X, X\}$ plus one two-qubit gate, CX on some devices and CZ or ECR on others. $R_z$ is usually applied in software, as a change of reference frame, so it takes no time and adds no error.
eq*: \sqrt X = \frac12\begin{pmatrix}1+i & 1-i\\ 1-i & 1+i\end{pmatrix}, \qquad \left(\sqrt X\right)^2 = X ;; the SX gate
eq*: H = e^{i\pi/4}\,R_z\!\left(\tfrac\pi2\right)\sqrt X\,R_z\!\left(\tfrac\pi2\right) ;; the Hadamard, in basis gates
eq: U = e^{i\alpha}\,R_z(\lambda_1)\,\sqrt X\,R_z(\lambda_2)\,\sqrt X\,R_z(\lambda_3) ;; any single-qubit gate: at most two $\sqrt X$ pulses
p: Two-qubit gates convert into each other with single-qubit gates on the target.
eq*: \mathrm{CX} = (I\otimes H)\,\mathrm{CZ}\,(I\otimes H) ;; CNOT from controlled-$Z$: Hadamards on the target
code: Rewriting into a basis
from qiskit import transpile

native = transpile(qc, basis_gates=["rz", "sx", "x", "cx"], optimization_level=1)
print(native.count_ops())
:end
ex: Checking the Hadamard decomposition ;; With $\sqrt X = \tfrac{1}{\sqrt2}\begin{pmatrix}e^{i\pi/4} & e^{-i\pi/4}\\ e^{-i\pi/4} & e^{i\pi/4}\end{pmatrix}$ and $R_z(\tfrac\pi2) = \mathrm{diag}(e^{-i\pi/4}, e^{i\pi/4})$, each entry of $R_z\sqrt XR_z$ picks up one phase from each side. ;; The result is $\tfrac{e^{-i\pi/4}}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix} = e^{-i\pi/4}H$, so multiplying by $e^{i\pi/4}$ gives $H$ exactly.
note: A gate that looks simple on paper can be expensive natively, and the reverse. The count that matters is the count after rewriting, which is why lesson 5.6 reads the transpiler's output.
`,
    },
    {
      title: "Transpilation",
      summary: "The compiler step between what you wrote and what runs.",
      notes: String.raw`
idea: The transpiler maps a circuit onto a device: it chooses physical qubits, inserts SWAPs where the wiring requires them, rewrites everything into basis gates and simplifies the result.
table: Stage | What it does ;; init | unroll to one- and two-qubit gates ;; layout | assign each virtual qubit to a physical qubit ;; routing | insert SWAPs so every two-qubit gate acts on connected qubits ;; translation | rewrite into the basis gates ;; optimisation | cancel and merge gates ;; scheduling | place gates in time, if requested
p: Hardware qubits only interact with their neighbours on a *coupling map*. A two-qubit gate between distant qubits needs SWAPs, and each SWAP costs three CNOTs.
eq*: \mathrm{SWAP} = \mathrm{CX}_{0\to1}\,\mathrm{CX}_{1\to0}\,\mathrm{CX}_{0\to1} ;; a SWAP from three CNOTs
code: Transpiling for a line of three qubits
from qiskit import transpile

qc = QuantumCircuit(3)
qc.h(0)
qc.cx(0, 2)   # qubits 0 and 2 are not connected below

line = [[0, 1], [1, 0], [1, 2], [2, 1]]
out = transpile(qc, coupling_map=line, basis_gates=["rz", "sx", "x", "cx"],
                optimization_level=3,   # 0 translates only, 3 searches hardest
                seed_transpiler=7)      # fixed, so the same run comes back
:end
p: The output does the same thing as the input, up to a global phase and a relabelling of qubits: routing may also leave the qubits somewhere else at the end.
eq: V = e^{i\gamma}\,P_{\text{final}}\,U\,P_{\text{initial}}^{\dagger} ;; transpiled circuit $V$ against original $U$: permutations $P$ from layout and routing
p: Every inserted gate adds error, so the transpiler's first goal is fewer two-qubit gates. To first order, a circuit runs cleanly with the product of its gates' success rates.
eq*: F \approx \prod_{g}(1 - \varepsilon_g) \approx \exp\!\Big(-\sum_g \varepsilon_g\Big) ;; estimated success probability from per-gate error rates $\varepsilon_g$
ex: What routing costs ;; With two-qubit error $\varepsilon = 10^{-2}$, one SWAP adds three CNOTs: a factor of $(0.99)^3 \approx 0.970$. Ten SWAPs cost $(0.99)^{30} \approx 0.74$, a quarter of all runs lost to routing alone.
`,
    },
    {
      title: "Depth and width",
      summary: "The two numbers that decide whether a circuit survives the hardware.",
      notes: String.raw`
idea: Width is how many qubits a circuit needs. Depth is how many layers of gates it takes, and depth sets how long the qubits must stay coherent.
def: Depth ;; Push every gate as early in time as it can go without passing a gate on the same qubit. The number of resulting layers is the depth. Gates on different qubits in the same layer run at the same time.
eq*: t_{\text{circuit}} \approx d\cdot t_{\text{layer}}, \qquad P_{\text{coherent}} \approx e^{-t_{\text{circuit}}/T_2} ;; depth becomes time, and time becomes decoherence
table: Depth $d$ | Time at $0.1\ \mu$s per layer | $e^{-t/T_2}$ with $T_2 = 100\ \mu$s ;; $10$ | $1\ \mu$s | $0.990$ ;; $100$ | $10\ \mu$s | $0.905$ ;; $1000$ | $100\ \mu$s | $0.368$
note: The timing figures are illustrative, not those of a particular device.
p: Width and depth trade against each other. Extra ancilla qubits can let gates run in parallel. Preparing an $n$-qubit GHZ state is the standard example.
eq*: \ket{\mathrm{GHZ}_n} = \frac{\ket{0}^{\otimes n} + \ket{1}^{\otimes n}}{\sqrt2} ;; the GHZ state
eq: \text{chain of CNOTs: depth } n \qquad\text{fan-out doubling the entangled set each layer: depth } 1 + \lceil\log_2 n\rceil ;; the same state, two depths (all-to-all connectivity)
p: A single figure of merit combines the two. A device has *quantum volume* $2^m$ when it reliably runs random circuits $m$ qubits wide and $m$ layers deep, reliably meaning the "heavy" outputs appear more than two-thirds of the time.
eq: \mathrm{QV} = 2^m, \qquad \text{largest } m \text{ with } \Pr[\text{heavy output}] > \tfrac23 ;; quantum volume
ex: Depth by hand ;; On three qubits: H on q0; CX(0,1); H on q2; CX(1,2). ;; Layer 1: H on q0 and H on q2 together. Layer 2: CX(0,1). Layer 3: CX(1,2), which waits for q1. The depth is 3, though there are four gates.
`,
    },
    {
      title: "Reading a circuit back",
      summary: "Drawing, inspecting, and the fact that a circuit is data.",
      notes: String.raw`
idea: A circuit is a data structure: it can be drawn, iterated, compared, serialised and edited like any other.
code: Inspecting a circuit
print(qc.draw("text"))
print(qc.count_ops())          # e.g. {'h': 1, 'cx': 1, 'measure': 2}

for instruction in qc.data:
    name = instruction.operation.name
    wires = [qc.find_bit(q).index for q in instruction.qubits]
    print(name, wires)          # h [0], then cx [0, 1], ...
:end
p: Two circuits can look nothing alike and still perform the same operation. Comparing their unitaries settles it, and equivalence is only meaningful up to a global phase.
eq*: U \simeq V \iff \frac{\left|\mathrm{Tr}\left(U^\dagger V\right)\right|}{2^n} = 1 ;; equal up to a global phase
eq*: F_{\text{pro}}(U, V) = \frac{\left|\mathrm{Tr}\left(U^\dagger V\right)\right|^2}{d^2}, \qquad d = 2^n ;; process fidelity: 1 for the same operation; the algorithm labs are marked with it
code: Checking equivalence
from math import pi
from qiskit.quantum_info import Operator

a = QuantumCircuit(1); a.h(0)
b = QuantumCircuit(1); b.rz(pi / 2, 0); b.sx(0); b.rz(pi / 2, 0)
print(Operator(a).equiv(Operator(b)))   # True: equal up to global phase
:end
p: Circuits also serialise to OpenQASM, the text format most quantum toolchains read, which is how a circuit moves between Qiskit, other frameworks and hardware providers.
code: OpenQASM 3
from qiskit import qasm3
print(qasm3.dumps(qc))
# OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1]; ...
:end
ex: Why the grader uses fidelity ;; A learner's circuit $V$ for a target $U = X$ might be $V = HZH$, which equals $X$ exactly: $|\mathrm{Tr}(X^\dagger HZH)| = |\mathrm{Tr}(I)| = 2$, so $F = 4/4 = 1$. A circuit $V = -iY$ gives $|\mathrm{Tr}(X^\dagger(-iY))| = |{-i}\,\mathrm{Tr}(XY)| = 0$, so $F = 0$, correctly scored as a different operation.
`,
    },
  ],
};

export default notes;
