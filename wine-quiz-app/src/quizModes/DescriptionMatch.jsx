export function DescriptionMatch({ question, onAnswer, showFeedback, darkMode }) {
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

      <div className="options-grid">
        {question.options.map((option) => (
          <button
            key={option.id}
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
          </button>
        ))}
      </div>
    </div>
  );
}
