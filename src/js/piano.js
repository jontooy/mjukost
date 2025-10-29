import * as Tone from "tone";

// Piano component
export function startPiano() {
  const pianoOverlay = document.getElementById("piano-overlay");
  pianoOverlay.style.display = "flex";

  const closeBtn = document.getElementById("close-piano");
  const pianoKeys = document.getElementById("piano-keys");

  // Clear previous keys if any
  pianoKeys.innerHTML = "";

  // Initialize Tone.js sampler
  const sampler = new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination();

  // Define C3-C4 octave (white and black keys) with keyboard mappings
  const notes = [
    { note: "C3", type: "white", label: "C", key: "A" },
    { note: "C#3", type: "black", label: "C#", key: "W" },
    { note: "D3", type: "white", label: "D", key: "S" },
    { note: "D#3", type: "black", label: "D#", key: "E" },
    { note: "E3", type: "white", label: "E", key: "D" },
    { note: "F3", type: "white", label: "F", key: "F" },
    { note: "F#3", type: "black", label: "F#", key: "T" },
    { note: "G3", type: "white", label: "G", key: "G" },
    { note: "G#3", type: "black", label: "G#", key: "Y" },
    { note: "A3", type: "white", label: "A", key: "H" },
    { note: "A#3", type: "black", label: "A#", key: "U" },
    { note: "B3", type: "white", label: "B", key: "J" },
    { note: "C4", type: "white", label: "C", key: "K" },
  ];

  // Create a map from keyboard keys to notes
  const keyToNote = {};
  notes.forEach(({ note, key }) => {
    keyToNote[key.toLowerCase()] = note;
    keyToNote[key.toUpperCase()] = note;
  });

  // Create piano keys
  notes.forEach(({ note, type, label, key }) => {
    const keyDiv = document.createElement("div");
    keyDiv.className = `piano-key ${type}-key`;
    keyDiv.dataset.note = note;

    // Play note on click
    keyDiv.addEventListener("mousedown", async () => {
      await Tone.start();
      keyDiv.classList.add("active");
      sampler.triggerAttackRelease(note, "8n");
    });

    keyDiv.addEventListener("mouseup", () => {
      keyDiv.classList.remove("active");
    });

    keyDiv.addEventListener("mouseleave", () => {
      keyDiv.classList.remove("active");
    });

    pianoKeys.appendChild(keyDiv);
  });

  // Add keyboard listener for playing notes
  function handlePianoKeyDown(e) {
    const note = keyToNote[e.key];
    if (note) {
      e.preventDefault();
      const keyDiv = pianoKeys.querySelector(`[data-note="${note}"]`);
      if (keyDiv && !keyDiv.classList.contains("active")) {
        Tone.start();
        keyDiv.classList.add("active");
        sampler.triggerAttackRelease(note, "8n");
      }
    }
  }

  function handlePianoKeyUp(e) {
    const note = keyToNote[e.key];
    if (note) {
      const keyDiv = pianoKeys.querySelector(`[data-note="${note}"]`);
      if (keyDiv) {
        keyDiv.classList.remove("active");
      }
    }
  }

  document.addEventListener("keydown", handlePianoKeyDown);
  document.addEventListener("keyup", handlePianoKeyUp);

  closeBtn.onclick = () => {
    document.removeEventListener("keydown", handlePianoKeyDown);
    document.removeEventListener("keyup", handlePianoKeyUp);
    pianoOverlay.style.display = "none";
  };
}
