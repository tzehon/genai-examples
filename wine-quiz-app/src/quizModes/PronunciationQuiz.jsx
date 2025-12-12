import { useMemo } from 'react';
import { getPronunciationOptions } from '../utils/generateFakePronunciations';

export function PronunciationQuiz({ question, onAnswer, showFeedback, darkMode }) {
  const options = useMemo(() => {
    return getPronunciationOptions(question.correctPronunciation, question.optionCount || 4);
  }, [question.correctPronunciation, question.optionCount]);

  const handleSelect = (option) => {
    if (showFeedback) return;

    onAnswer(option.text, option.isCorrect, {
      wineName: question.wine.name,
      categoryId: question.wine.styleId,
      explanation: option.isCorrect
        ? `Correct! "${question.wine.name}" is pronounced "${question.correctPronunciation}".`
        : `The correct pronunciation is "${question.correctPronunciation}".`
    });
  };

  return (
    <div className={`quiz-mode pronunciation-quiz ${darkMode ? 'dark' : ''}`}>
      <div className="question-prompt">
        <h3>How do you pronounce:</h3>
        <div className="wine-name large">{question.wine.name}</div>
      </div>

      <div className="pronunciation-options">
        {options.map((option, index) => (
          <button
            key={index}
            className={`pronunciation-btn ${
              showFeedback
                ? option.isCorrect
                  ? 'correct'
                  : 'incorrect'
                : ''
            }`}
            onClick={() => handleSelect(option)}
            disabled={showFeedback}
          >
            <span className="pronunciation-text">{option.text}</span>
          </button>
        ))}
      </div>

      {showFeedback && (
        <div className="pronunciation-tip">
          <strong>Tip:</strong> Capital letters indicate stressed syllables
        </div>
      )}
    </div>
  );
}
