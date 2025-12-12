export function CategoryMatch({ question, onAnswer, showFeedback, darkMode }) {
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
        <div className="wine-name">{question.wine.name}</div>
        {question.wine.origin && (
          <div className="wine-origin">{question.wine.origin}</div>
        )}
      </div>

      <div className="options-grid">
        {question.options.map((option, index) => (
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
