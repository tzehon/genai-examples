import { useState } from 'react';

export function DescriptionMatch({ question, onAnswer, showFeedback, darkMode }) {
  const [showHint, setShowHint] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);

  const handleSelect = (option) => {
    if (showFeedback) return;

    onAnswer(option.id, option.isCorrect, {
      categoryId: question.style.id,
      explanation: option.isCorrect
        ? `Correct! This describes ${question.style.name}.`
        : `This actually describes ${question.style.name}.`
    });
  };

  return (
    <div className={`quiz-mode description-match ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>Which wine style matches this description?</h3>
        <div className="description-card">
          <p>"{question.description}"</p>
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
