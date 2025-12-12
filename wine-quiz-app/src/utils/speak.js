// Text-to-speech utility for wine pronunciation

export function speakWineName(name, lang = 'it-IT') {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(name);

  // Try to use an appropriate voice for wine names (Italian/French/Spanish tend to work well)
  const voices = window.speechSynthesis.getVoices();

  // Prefer voices in this order for wine pronunciation
  const preferredLangs = ['it-IT', 'fr-FR', 'es-ES', 'de-DE', 'en-GB'];

  for (const preferred of preferredLangs) {
    const voice = voices.find(v => v.lang === preferred);
    if (voice) {
      utterance.voice = voice;
      break;
    }
  }

  utterance.rate = 0.8; // Slower for clarity
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

// Check if speech synthesis is supported
export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}
