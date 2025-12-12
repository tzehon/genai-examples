import { useState, useEffect, useRef } from 'react';

const TIMER_DURATION = 10; // seconds

export function QuickFire({ question, onAnswer, showFeedback, onTimeUp, darkMode }) {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerRef = useRef(null);
  const answeredRef = useRef(false);

  useEffect(() => {
    answeredRef.current = false;
    setTimeLeft(TIMER_DURATION);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!answeredRef.current && !showFeedback) {
            answeredRef.current = true;
            onTimeUp(null, false, {
              wineName: question.wine.name,
              categoryId: question.wine.styleId,
              explanation: `Time's up! The answer was ${question.isTrue ? 'Yes' : 'No'}.`
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [question]);

  const handleAnswer = (userAnswer) => {
    if (showFeedback || answeredRef.current) return;

    answeredRef.current = true;
    clearInterval(timerRef.current);

    const isCorrect = userAnswer === question.isTrue;

    onAnswer(userAnswer, isCorrect, {
      wineName: question.wine.name,
      categoryId: question.wine.styleId,
      explanation: isCorrect
        ? 'Correct!'
        : `${question.wine.name} is a ${question.correctStyle.name.toLowerCase().replace(' wine', '')}.`
    });
  };

  const timerPercentage = (timeLeft / TIMER_DURATION) * 100;
  const timerColor = timeLeft <= 3 ? '#A94442' : timeLeft <= 5 ? '#C5A572' : '#2D5A3D';

  return (
    <div className={`quiz-mode quick-fire ${darkMode ? 'dark' : ''}`}>
      <div className="timer-container">
        <div
          className="timer-bar"
          style={{
            width: `${timerPercentage}%`,
            backgroundColor: timerColor
          }}
        />
        <span className="timer-text">{timeLeft}s</span>
      </div>

      <div className="question-prompt">
        <h3>True or False?</h3>
        <div className="statement">{question.statement}</div>
      </div>

      <div className="yes-no-buttons">
        <button
          className={`yes-btn ${
            showFeedback
              ? question.isTrue
                ? 'correct'
                : 'incorrect'
              : ''
          }`}
          onClick={() => handleAnswer(true)}
          disabled={showFeedback}
        >
          Yes
        </button>
        <button
          className={`no-btn ${
            showFeedback
              ? !question.isTrue
                ? 'correct'
                : 'incorrect'
              : ''
          }`}
          onClick={() => handleAnswer(false)}
          disabled={showFeedback}
        >
          No
        </button>
      </div>
    </div>
  );
}
