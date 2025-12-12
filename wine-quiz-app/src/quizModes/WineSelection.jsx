import { useState } from 'react';

export function WineSelection({ question, onAnswer, showFeedback, darkMode }) {
  const [selected, setSelected] = useState(new Set());

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
      </div>

      <div className="checkbox-grid">
        {question.options.map((option) => (
          <label
            key={option.name}
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
            {showFeedback && option.isCorrect && (
              <span className="correct-indicator">✓</span>
            )}
          </label>
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
