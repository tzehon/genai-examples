import { useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';

export function OddOneOut({ question, onAnswer, showFeedback, darkMode }) {
  const [showHint, setShowHint] = useState(false);

  const handleSelect = (option) => {
    if (showFeedback) return;

    onAnswer(option.name, option.isOdd, {
      wineName: option.name,
      categoryId: option.styleId,
      explanation: option.isOdd
        ? `Correct! ${option.name} is a ${question.oddStyle.name}, while the others are ${question.mainStyle.name}s.`
        : `${question.oddWine} is the odd one out - it's a ${question.oddStyle.name}, while the others are ${question.mainStyle.name}s.`
    });
  };

  return (
    <div className={`quiz-mode odd-one-out ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>Which wine doesn't belong?</h3>
        <p className="hint">Three wines are from the same category. Find the odd one out.</p>
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

      <div className="wine-cards">
        {question.options.map((option, index) => (
          <button
            key={index}
            className={`wine-card ${
              showFeedback
                ? option.isOdd
                  ? 'correct'
                  : 'incorrect'
                : ''
            }`}
            onClick={() => handleSelect(option)}
            disabled={showFeedback}
          >
            <span className="wine-name">{option.name}</span>
            <SpeakButton text={option.name} />
            {showFeedback && (
              <span className="wine-category">{option.styleName}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
