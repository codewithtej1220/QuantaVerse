import type { Lesson, TestQuestion } from "@/lib/lessons";

/** Circuits with Qiskit — eight lessons. */
export const lessons: Lesson[] = [
  {
    title: "QuantumCircuit",
    summary: "The object everything else in Qiskit hangs off.",
    minutes: 8,
    body: [
      "A Qiskit program starts by declaring how much it needs: how many qubits, and how many classical bits to catch the measurements. QuantumCircuit(3, 3) gives you three of each, numbered from zero, and everything after that is adding instructions to it.",
      "The object is mutable and order-sensitive. Each method call appends an instruction, so the sequence of your lines is the sequence of the circuit — which is why the code pane in the sandbox and the diagram beside it stay in step as you type. They are two views of the same list.",
      "The second number is optional and often omitted while you are exploring. A circuit with no classical bits can still be simulated for its statevector; it just has nowhere to put a measurement, so `measure` will fail. Declare the classical bits when you intend to read the register, and leave them off when you are inspecting amplitudes.",
    ],
    code: "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(3, 3)   # 3 qubits, 3 classical bits\nqc = QuantumCircuit(3)      # statevector work — no measurements",
    practice:
      "Change the qubit count in the sandbox toolbar and watch the generated code's first line change with it.",
  },
  {
    title: "Adding gates",
    summary: "The method names, and the argument order that trips everyone once.",
    minutes: 9,
    body: [
      "Single-qubit gates take the wire they act on: qc.h(0) puts a Hadamard on qubit zero. Two-qubit gates take both, and the order is control first, target second — qc.cx(0, 1) controls on qubit zero and flips qubit one. Reversing those two arguments gives a different circuit, not an error, which is what makes it worth saying out loud.",
      "Parameterised gates take the parameter first and the wire afterwards: qc.rz(theta, 0). That ordering is consistent across the library once you have seen it once, but it reads backwards compared to the gate methods that take only wires.",
      "Measurement takes two arguments, the qubit and the classical bit, and both accept lists. qc.measure([0, 1], [0, 1]) reads two qubits into the matching two bits in one call. The sandbox writes exactly this form when you place M tiles, which is why the generated code stays short even on a wide register.",
    ],
    code: "qc.h(0)                 # Hadamard on q0\nqc.x(1)                 # NOT on q1\nqc.cx(0, 1)             # control q0, target q1\nqc.rz(3.14159 / 4, 0)   # parameter first, then the wire\nqc.measure([0, 1], [0, 1])",
    practice:
      "Place a CNOT in the sandbox, read the generated qc.cx line, then drag the control to the other wire and watch the argument order swap.",
  },
  {
    title: "Running it",
    summary: "Shots, samplers, and getting counts back out.",
    minutes: 10,
    body: [
      "A circuit on its own computes nothing — it is a description. To get numbers you hand it to a backend and ask for some number of shots, each of which prepares the state from scratch, runs the instructions and measures. What comes back is a dictionary of outcome labels to how often each appeared.",
      "The default in this course is 1,024 shots, which is a convention rather than a law. It is enough to see a 50/50 split clearly and cheap enough to feel instant, and as the shot-noise lesson showed, the wobble at that count is around sixteen. Raise it when you need a small difference resolved and accept that precision improves only as the square root.",
      "The counts dictionary is keyed by the register as a string, highest-numbered qubit leftmost, exactly as the sandbox histogram labels them. Anything you never measured simply does not appear in the key, which is why a circuit that measures two of three qubits returns two-character labels.",
    ],
    code: "from qiskit_aer import AerSimulator\n\nsim = AerSimulator()\nresult = sim.run(qc, shots=1024).result()\nprint(result.get_counts())   # {'00': 511, '11': 513}",
    practice:
      "Switch the sandbox engine from Browser to Qiskit and run the same circuit. The note under the board names the version and the shot count it actually used.",
  },
  {
    title: "The statevector simulator",
    summary: "Exact amplitudes, no sampling, and why it is the one you learn with.",
    minutes: 10,
    body: [
      "Sampling gives you a histogram. The statevector simulator gives you the amplitudes themselves — the actual complex numbers, before any measurement has thrown the phase away. There is no shot count because there is no sampling: the answer is exact.",
      "This is why the sandbox shows exact percentages beside the sampled bars, and why the Bloch spheres can show you a phase at all. A histogram could never tell you the difference between |+⟩ and |−⟩; the statevector prints it directly as a sign.",
      "The catch is the one from the entanglement module: the vector has 2ⁿ entries, so this approach dies somewhere around fifty qubits on a large machine and much earlier on a laptop. It is a learning and debugging tool, not a scaling strategy — which is exactly the right tool for every circuit in this course.",
    ],
    code: "from qiskit.quantum_info import Statevector\n\nstate = Statevector.from_instruction(qc.remove_final_measurements(False))\nprint(state.probabilities_dict())",
    notation: {
      lines: ["sampled     ->  {'00': 511, '11': 513}     approximate", "statevector ->  0.707|00⟩ + 0.707|11⟩       exact"],
    },
    practice:
      "Build H then Z then H and compare the histogram with the state vector line. The histogram shows a certainty; the state vector shows you why.",
  },
  {
    title: "Basis gates",
    summary: "The short list a real machine can actually perform.",
    minutes: 10,
    body: [
      "The gates in this course are a teaching set. A physical device implements a much smaller list — often one two-qubit gate and a couple of single-qubit rotations — and everything else has to be expressed in terms of those. That list is the device's basis gates.",
      "Nothing is lost in principle. A small set of gates can be universal, meaning any unitary can be built from them to whatever accuracy you like, and the standard sets are. What is lost is brevity: a gate that is one instruction in your circuit may be several once rewritten, and a gate the device does not have natively can be surprisingly expensive.",
      "This is the reason your circuit and the circuit that runs are not the same object, and the reason a depth of four in the sandbox may become a depth of twenty on hardware. Neither number is wrong; they are counting different circuits.",
    ],
    notation: {
      lines: [
        "your circuit:     H, T, CNOT, ...",
        "device basis:     RZ, SX, X, CX      (a typical superconducting set)",
        "",
        "H  ->  RZ(π/2) · SX · RZ(π/2)",
      ],
      caption: "One instruction becomes three. Universal, but not free.",
    },
  },
  {
    title: "Transpilation",
    summary: "The compiler step between what you wrote and what runs.",
    minutes: 11,
    body: [
      "Transpiling is rewriting your circuit into one the target device can execute. It does three jobs at once: translate every gate into the basis set, map your logical qubits onto physical ones, and insert whatever is needed to work around the fact that not every pair of physical qubits can talk to each other.",
      "That last job is the one with teeth. On most hardware a two-qubit gate only works between neighbours, so a CNOT between qubits that are not adjacent has to be moved — usually by inserting SWAP gates to walk the state across the chip. Each SWAP is itself three CNOTs, so a badly placed pair of qubits can cost more than the algorithm it is part of.",
      "Transpilers take an optimisation level, and it is worth using. Higher levels spend more time searching for a better layout and cancelling redundant gates, and on a non-trivial circuit the difference in final depth can be several-fold. It is the cheapest improvement available on real hardware.",
    ],
    code: "from qiskit import transpile\n\nrun_me = transpile(qc, backend=device, optimization_level=3)\nprint(run_me.depth(), run_me.count_ops())",
    practice:
      "Compare the depth the sandbox reports with what a transpiled version would need. The sandbox counts your circuit; hardware counts the rewritten one.",
  },
  {
    title: "Depth and width",
    summary: "The two numbers that decide whether a circuit survives the hardware.",
    minutes: 9,
    body: [
      "Width is how many qubits a circuit uses, and it is the obvious constraint: a device with 127 qubits cannot run a circuit needing 128. It is also the easier of the two, because it is fixed the moment you declare the register.",
      "Depth is how many layers of gates run in sequence, where gates acting on different qubits at the same time count as one layer. It matters because qubits decohere: they hold their state for a limited time, and a circuit deeper than that window returns noise regardless of how correct it is on paper. Depth is a clock you are racing.",
      "The sandbox reports both, and the coherence-headroom figure beside them is the same idea made concrete — depth multiplied by an assumed gate time, compared against an assumed coherence time. Both assumptions are stated on the page rather than hidden, because the simulator has no decoherence of its own to measure and it would be dishonest to imply otherwise.",
    ],
    notation: {
      lines: [
        "width  = qubits used              a hard limit",
        "depth  = sequential gate layers   a race against decoherence",
        "",
        "gates on different wires in the same step  ->  one layer",
      ],
    },
    practice:
      "Place two gates on different wires in the same column and watch the depth stay at one. Then move one along a column and watch it become two.",
  },
  {
    title: "Reading a circuit back",
    summary: "Drawing, inspecting, and the fact that a circuit is data.",
    minutes: 9,
    body: [
      "A QuantumCircuit is not opaque. You can draw it, count its operations, ask for its depth, and walk its instruction list — which is how the sandbox's Build from code button works: it runs your source in a sandboxed interpreter and reads the circuit object that results, rather than trying to parse the text.",
      "That distinction is why the button exists at all. The in-tab parser recognises single calls like qc.h(0) and can keep the diagram in step as you type, but it cannot follow a loop, a helper function or anything built with numpy. Sending the source to a real interpreter and inspecting the object afterwards handles all of it.",
      "The same property is what makes transpilation, optimisation and visualisation possible in the first place. A circuit being an inspectable data structure rather than a compiled blob is what lets a toolchain exist around it, and it is worth noticing because it is not true of most programs you write.",
    ],
    code: "print(qc.draw())         # an ASCII diagram\nprint(qc.depth())        # sequential layers\nprint(qc.count_ops())    # {'h': 1, 'cx': 1, 'measure': 2}\nfor instruction in qc.data:\n    print(instruction.operation.name, instruction.qubits)",
    practice:
      "Write a circuit in the sandbox code pane using a for loop, then press Build from code. The diagram catches up with something the live parser could not follow.",
  },
];

export const quiz: TestQuestion[][] = [
  [
    {
      prompt: "What does QuantumCircuit(3, 3) declare?",
      options: ["Three circuits", "Three qubits and three classical bits", "A depth of three", "Three gates"],
      answer: 1,
      because: "Three of each, numbered from zero.",
    },
    {
      prompt: "Does the order of your method calls matter?",
      options: ["No, Qiskit sorts them", "Yes — each call appends an instruction in sequence", "Only for two-qubit gates", "Only after transpiling"],
      answer: 1,
      because: "The sequence of your lines is the sequence of the circuit, which is why the diagram tracks the code.",
    },
    {
      prompt: "When can you omit the second argument?",
      options: [
        "Never",
        "When you are doing statevector work and will not measure",
        "When the circuit has one qubit",
        "When using the simulator",
      ],
      answer: 1,
      because: "With no classical bits there is nowhere to put a measurement, so `measure` would fail.",
    },
    {
      prompt: "The code pane and the diagram in the sandbox are:",
      options: ["Independent", "Two views of the same instruction list", "The diagram is generated nightly", "Unrelated"],
      answer: 1,
      because: "Which is why editing either one moves the other.",
    },
  ],
  [
    {
      prompt: "In qc.cx(0, 1), which qubit is the control?",
      options: ["Qubit 1", "Qubit 0", "Both", "Neither"],
      answer: 1,
      because: "Control first, target second. Reversing them gives a different circuit rather than an error.",
    },
    {
      prompt: "What is the argument order for qc.rz?",
      options: ["Wire, then angle", "Angle, then wire", "Angle only", "Wire only"],
      answer: 1,
      because: "The parameter comes first, which reads backwards compared to the wire-only gate methods.",
    },
    {
      prompt: "What does qc.measure([0, 1], [0, 1]) do?",
      options: [
        "Measures qubit 0 twice",
        "Reads two qubits into the matching two classical bits",
        "Measures in the X basis",
        "Resets both qubits",
      ],
      answer: 1,
      because: "Both arguments accept lists, which keeps the generated code short on a wide register.",
    },
    {
      prompt: "Swapping the two arguments of cx produces:",
      options: ["An error", "The same circuit", "A different circuit", "A transpiler warning"],
      answer: 2,
      because: "A different, perfectly valid circuit — which is exactly what makes it an easy bug.",
    },
  ],
  [
    {
      prompt: "What does one shot involve?",
      options: [
        "One gate",
        "Preparing the state, running the circuit and measuring once",
        "Reading the statevector",
        "One transpilation pass",
      ],
      answer: 1,
      because: "The whole circuit, from scratch, per shot — which is why shots cost real time on hardware.",
    },
    {
      prompt: "What does a run return?",
      options: ["The statevector", "A dictionary of outcome labels to counts", "A single outcome", "The circuit depth"],
      answer: 1,
      because: "Counts, keyed by the register as a string.",
    },
    {
      prompt: "Why is 1,024 the default here?",
      options: [
        "It is a hardware limit",
        "Convention — enough to see a split clearly, cheap enough to feel instant",
        "It is the maximum Aer allows",
        "It eliminates shot noise",
      ],
      answer: 1,
      because: "A convention rather than a law. Precision still only improves as the square root.",
    },
    {
      prompt: "A circuit measures two of three qubits. The keys are:",
      options: ["Three characters", "Two characters", "One character", "Empty"],
      answer: 1,
      because: "Only what you measured appears in the key.",
    },
  ],
  [
    {
      prompt: "What does the statevector simulator give you that sampling does not?",
      options: ["More shots", "The exact amplitudes, including phase", "A faster run", "Error rates"],
      answer: 1,
      because: "The complex numbers themselves, before measurement has discarded the phase.",
    },
    {
      prompt: "Why can a histogram never distinguish |+⟩ from |−⟩?",
      options: [
        "Too few shots",
        "The Born rule squares away the sign",
        "The simulator rounds",
        "It can, with enough shots",
      ],
      answer: 1,
      because: "Squaring discards it. The statevector prints the sign directly.",
    },
    {
      prompt: "What limits the statevector approach?",
      options: [
        "Gate count",
        "The 2ⁿ size of the vector",
        "The number of shots",
        "The classical register width",
      ],
      answer: 1,
      because: "It dies around fifty qubits on a large machine and far earlier on a laptop.",
    },
    {
      prompt: "Is that a problem for this course?",
      options: [
        "Yes, severely",
        "No — every circuit here is small, and exactness is what you want while learning",
        "Only for the Grover module",
        "Only on hardware",
      ],
      answer: 1,
      because: "It is a learning and debugging tool, which is exactly the right tool at this size.",
    },
  ],
  [
    {
      prompt: "What are a device's basis gates?",
      options: [
        "The gates it runs fastest",
        "The short list it can actually perform",
        "The gates you declared",
        "Gates that need no calibration",
      ],
      answer: 1,
      because: "Everything else has to be expressed in terms of them.",
    },
    {
      prompt: "Is anything lost by having only a small basis set?",
      options: [
        "Yes — some unitaries become impossible",
        "Nothing in principle, because the set is universal — but brevity is lost",
        "Only phase information",
        "Only two-qubit gates",
      ],
      answer: 1,
      because: "Universal means any unitary is reachable. One instruction may become several.",
    },
    {
      prompt: "Your sandbox circuit has depth 4 and the hardware version has depth 20. Which is wrong?",
      options: ["The sandbox", "The hardware", "Neither — they count different circuits", "Both"],
      answer: 2,
      because: "One counts what you wrote, the other counts what runs after rewriting.",
    },
    {
      prompt: "A Hadamard on a typical superconducting basis becomes roughly:",
      options: ["One instruction", "Three instructions", "Ten instructions", "It cannot be expressed"],
      answer: 1,
      because: "Something like RZ · SX · RZ. Universal, but not free.",
    },
  ],
  [
    {
      prompt: "Which of these is NOT a job of the transpiler?",
      options: [
        "Translating gates into the basis set",
        "Mapping logical qubits onto physical ones",
        "Choosing how many shots to run",
        "Working around limited connectivity",
      ],
      answer: 2,
      because: "Shots are your choice at run time; the transpiler is rewriting the circuit itself.",
    },
    {
      prompt: "Why do SWAP gates get inserted?",
      options: [
        "To reduce depth",
        "Because two-qubit gates usually only work between neighbouring physical qubits",
        "To improve fidelity",
        "To satisfy the basis set",
      ],
      answer: 1,
      because: "The state has to be walked across the chip to bring the pair together.",
    },
    {
      prompt: "How expensive is one SWAP?",
      options: ["Free", "One CNOT", "Three CNOTs", "Ten CNOTs"],
      answer: 2,
      because: "Three, which is why a poor qubit layout can cost more than the algorithm itself.",
    },
    {
      prompt: "What does a higher optimisation level buy?",
      options: [
        "More shots",
        "More search for a better layout and more gate cancellation",
        "Lower error rates on the device",
        "A smaller basis set",
      ],
      answer: 1,
      because: "On a non-trivial circuit the difference in final depth can be several-fold.",
    },
  ],
  [
    {
      prompt: "What is a circuit's width?",
      options: ["Its gate count", "How many qubits it uses", "Its depth", "Its shot count"],
      answer: 1,
      because: "Fixed the moment you declare the register, and a hard limit against the device.",
    },
    {
      prompt: "Two gates on different wires in the same step count as:",
      options: ["Two layers of depth", "One layer of depth", "No depth", "Depends on the gate"],
      answer: 1,
      because: "Depth counts sequential layers, and independent gates run together.",
    },
    {
      prompt: "Why does depth matter more than gate count on hardware?",
      options: [
        "Deeper circuits use more qubits",
        "Qubits decohere, so depth is a race against a time limit",
        "Depth costs more money",
        "It does not — gate count matters more",
      ],
      answer: 1,
      because: "Past the coherence window the circuit returns noise however correct it is on paper.",
    },
    {
      prompt: "The sandbox's coherence-headroom figure is:",
      options: [
        "Measured from the simulator",
        "An estimate from stated assumptions, since the simulator has no decoherence",
        "Read from real hardware",
        "Randomly generated",
      ],
      answer: 1,
      because: "The assumptions are printed on the page rather than hidden, because implying otherwise would be dishonest.",
    },
  ],
  [
    {
      prompt: "How does the sandbox's Build from code button work?",
      options: [
        "It parses the text with a regular expression",
        "It runs the source and inspects the resulting circuit object",
        "It asks the AI tutor",
        "It compares against a template",
      ],
      answer: 1,
      because: "Which is why it can follow loops and helpers that the live text parser cannot.",
    },
    {
      prompt: "What can the in-tab live parser not follow?",
      options: [
        "qc.h(0)",
        "A for loop or a helper function",
        "Two-qubit gates",
        "Measurements",
      ],
      answer: 1,
      because: "It recognises single calls, which is enough to track typing and not enough for real code.",
    },
    {
      prompt: "qc.count_ops() returns:",
      options: ["The depth", "A dictionary of gate names to how many of each", "The statevector", "The shot count"],
      answer: 1,
      because: "Something like {'h': 1, 'cx': 1, 'measure': 2}.",
    },
    {
      prompt: "Why does a circuit being inspectable data matter?",
      options: [
        "It runs faster",
        "It is what lets transpilers, optimisers and visualisers exist around it",
        "It reduces depth",
        "It improves fidelity",
      ],
      answer: 1,
      because: "A compiled blob could not be rewritten for a device or drawn back to you.",
    },
  ],
];
