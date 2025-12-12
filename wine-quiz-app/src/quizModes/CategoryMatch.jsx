import { useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';

export function CategoryMatch({ question, onAnswer, showFeedback, darkMode }) {
  const [showHint, setShowHint] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);

  const handleSelect = (option) => {
    if (showFeedback) return;

    onAnswer(option.id, option.isCorrect, {
      wineName: question.wine.name,
      categoryId: question.wine.styleId,
      selectedCategory: option.id,
      explanation: option.isCorrect
        ? `${question.wine.name} is indeed a ${option.name}.`
        : `${question.wine.name} is actually a ${question.options.find(o => o.isCorrect)?.name}.`
    });
  };

  return (
    <div className={`quiz-mode category-match ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>What style is this wine?</h3>
        <div className="wine-name">
          {question.wine.name}
          <SpeakButton text={question.wine.name} className="speak-inline" />
        </div>
        {question.wine.origin && (
          <div className="wine-origin">{question.wine.origin}</div>
        )}
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

      <div className="options-grid">
        {question.options.map((option) => (
          <div key={option.id} className="option-wrapper">
            <button
              className={`option-btn ${
                showFeedback
                  ? option.isCorrect
                    ? 'correct'
                    : 'incorrect'
                  : ''
              }`}
              onClick={() => handleSelect(option)}
              disabled={showFeedback}
              style={{
                '--option-color': option.color
              }}
            >
              <span className="option-color-dot" style={{ backgroundColor: option.color }} />
              <span className="option-text">{option.name}</span>
              {option.description && !showFeedback && (
                <span
                  className="info-icon"
                  onMouseEnter={() => setHoveredOption(option.id)}
                  onMouseLeave={() => setHoveredOption(null)}
                >
                  ⓘ
                </span>
              )}
            </button>
            {hoveredOption === option.id && option.description && (
              <div className="option-tooltip">
                {option.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
