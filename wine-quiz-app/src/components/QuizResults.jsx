export function QuizResults({ results, onPlayAgain, onGoHome, darkMode }) {
  const percentage = Math.round((results.score / results.total) * 100);

  const getMessage = () => {
    if (percentage === 100) return { emoji: '🏆', text: 'Perfect Score!' };
    if (percentage >= 80) return { emoji: '🌟', text: 'Excellent!' };
    if (percentage >= 60) return { emoji: '👍', text: 'Good Job!' };
    if (percentage >= 40) return { emoji: '📚', text: 'Keep Learning!' };
    return { emoji: '💪', text: 'Practice Makes Perfect!' };
  };

  const message = getMessage();

  // Group incorrect answers
  const incorrectAnswers = results.answers.filter(a => !a.isCorrect);

  return (
    <div className={`quiz-results ${darkMode ? 'dark' : ''}`}>
      <div className="results-header">
        <div className="result-emoji">{message.emoji}</div>
        <h2>{message.text}</h2>
        <div className="score-display">
          <span className="score-value">{results.score}</span>
          <span className="score-divider">/</span>
          <span className="score-total">{results.total}</span>
        </div>
        <div className="score-percentage">{percentage}%</div>
      </div>

      {incorrectAnswers.length > 0 && (
        <div className="review-section">
          <h3>Review These Wines</h3>
          <div className="review-list">
            {incorrectAnswers.map((answer, index) => (
              <div key={index} className="review-item">
                <div className="review-question">
                  {answer.question.wine?.name ||
                   answer.question.style?.name ||
                   answer.question.statement ||
                   'Question'}
                </div>
                {answer.details?.explanation && (
                  <div className="review-explanation">
                    {answer.details.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="results-actions">
        <button className="primary-btn" onClick={onPlayAgain}>
          Play Again
        </button>
        <button className="secondary-btn" onClick={onGoHome}>
          Go Home
        </button>
      </div>
    </div>
  );
}
