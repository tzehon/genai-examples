import { useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';

export function WineSelection({ question, onAnswer, showFeedback, darkMode }) {
  const [selected, setSelected] = useState(new Set());
  const [showHint, setShowHint] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);

  const handleToggle = (wineName) => {
    if (showFeedback) return;

    const newSelected = new Set(selected);
    if (newSelected.has(wineName)) {
      newSelected.delete(wineName);
    } else {
      newSelected.add(wineName);
    }
    setSelected(newSelected);
  };

  const handleSubmit = () => {
    const selectedArray = Array.from(selected);
    const correctArray = question.correctWines;

    // Check if selection matches exactly
    const isCorrect =
      selectedArray.length === correctArray.length &&
      selectedArray.every(w => correctArray.includes(w));

    const missed = correctArray.filter(w => !selected.has(w));
    const wrongPicks = selectedArray.filter(w => !correctArray.includes(w));

    let explanation = '';
    if (isCorrect) {
      explanation = 'Perfect! You selected all the correct wines.';
    } else {
      if (missed.length > 0) {
        explanation += `Missed: ${missed.join(', ')}. `;
      }
      if (wrongPicks.length > 0) {
        explanation += `Incorrect selections: ${wrongPicks.join(', ')}.`;
      }
    }

    onAnswer(selectedArray, isCorrect, {
      categoryId: question.style.id,
      explanation
    });
  };

  return (
    <div className={`quiz-mode wine-selection ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>Select all wines in this category:</h3>
        <div
          className="category-badge"
          style={{ backgroundColor: question.style.color }}
        >
          {question.style.name}
        </div>
        {!showFeedback && question.correctCount && (
          <div className="selection-hint">
            Select {question.correctCount} wine{question.correctCount > 1 ? 's' : ''}
          </div>
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

      <div className="checkbox-grid">
        {question.options.map((option) => (
          <div key={option.name} className="checkbox-wrapper">
            <label
              className={`checkbox-option ${selected.has(option.name) ? 'selected' : ''} ${
                showFeedback
                  ? option.isCorrect
                    ? 'correct'
                    : selected.has(option.name)
                      ? 'incorrect'
                      : ''
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(option.name)}
                onChange={() => handleToggle(option.name)}
                disabled={showFeedback}
              />
              <span className="checkbox-text">{option.name}</span>
              <SpeakButton text={option.name} />
              {showFeedback && option.isCorrect && (
                <span className="correct-indicator">✓</span>
              )}
              {!showFeedback && option.origin && (
                <span className="info-icon-wrapper">
                  <span
                    className="info-icon"
                    onMouseEnter={() => setHoveredOption(option.name)}
                    onMouseLeave={() => setHoveredOption(null)}
                  >
                    ⓘ
                  </span>
                  {hoveredOption === option.name && (
                    <div className="checkbox-tooltip">
                      <span className="tooltip-origin">{option.origin}</span>
                    </div>
                  )}
                </span>
              )}
            </label>
          </div>
        ))}
      </div>

      {!showFeedback && (
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={selected.size === 0}
        >
          Submit ({selected.size} selected)
        </button>
      )}
    </div>
  );
}
