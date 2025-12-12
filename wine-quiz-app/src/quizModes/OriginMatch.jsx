import { useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';

export function OriginMatch({ question, onAnswer, showFeedback, darkMode }) {
  const [showHint, setShowHint] = useState(false);

  const handleSelect = (option) => {
    if (showFeedback) return;

    const isCorrect = question.correctOrigins.includes(option.origin);

    onAnswer(option.origin, isCorrect, {
      wineName: question.wine.name,
      categoryId: question.wine.styleId,
      explanation: isCorrect
        ? `Correct! ${question.wine.name} originates from ${question.wine.origin}.`
        : `${question.wine.name} actually originates from ${question.wine.origin}.`
    });
  };

  return (
    <div className={`quiz-mode origin-match ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>Where does this wine originate?</h3>
        <div className="wine-name">
          {question.wine.name}
          <SpeakButton text={question.wine.name} className="speak-inline" />
        </div>
      </div>

      {!showFeedback && question.hint && (
        <div className="hint-container">
          {showHint ? (
            <div className="hint-text">{question.hint}</div>
          ) : (
            <button className="hint-btn" onClick={() => setShowHint(true)}>
              Show Hint
            </button>
          )}
        </div>
      )}

      <div className="origin-options">
        {question.options.map((option, index) => (
          <button
            key={index}
            className={`origin-btn ${
              showFeedback
                ? option.isCorrect
                  ? 'correct'
                  : 'incorrect'
                : ''
            }`}
            onClick={() => handleSelect(option)}
            disabled={showFeedback}
          >
            <span className="origin-flag">{getCountryFlag(option.origin)}</span>
            <span className="origin-name">{option.origin}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper to get country flag emoji
function getCountryFlag(country) {
  const flags = {
    'Spain': '🇪🇸',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'Austria': '🇦🇹',
    'USA': '🇺🇸',
    'Chile': '🇨🇱',
    'Argentina': '🇦🇷',
    'Portugal': '🇵🇹',
    'Australia': '🇦🇺',
    'New Zealand': '🇳🇿',
    'South Africa': '🇿🇦',
    'Croatia': '🇭🇷',
    'Various': '🌍'
  };
  return flags[country] || '🍷';
}
