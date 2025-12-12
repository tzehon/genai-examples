import { useState, useEffect } from 'react';
import { speakWineName, isSpeechSupported } from '../utils/speak';

export function SpeakButton({ text, className = '' }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setIsSupported(isSpeechSupported());

    // Load voices (needed for some browsers)
    if (isSpeechSupported()) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const handleSpeak = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) return;

    setIsSpeaking(true);
    speakWineName(text);

    // Reset speaking state after estimated duration
    setTimeout(() => setIsSpeaking(false), 1500);
  };

  if (!isSupported) return null;

  return (
    <button
      className={`speak-btn ${isSpeaking ? 'speaking' : ''} ${className}`}
      onClick={handleSpeak}
      title={`Listen to pronunciation of "${text}"`}
      type="button"
    >
      {isSpeaking ? '🔊' : '🔈'}
    </button>
  );
}
