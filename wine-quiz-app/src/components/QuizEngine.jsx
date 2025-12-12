import { useState, useEffect, useCallback, useMemo } from 'react';
import { shuffleArray, getRandomItems, getRandomItem } from '../utils/shuffleArray';
import { CategoryMatch } from '../quizModes/CategoryMatch';
import { WineSelection } from '../quizModes/WineSelection';
import { PronunciationQuiz } from '../quizModes/PronunciationQuiz';
import { QuickFire } from '../quizModes/QuickFire';
import { DescriptionMatch } from '../quizModes/DescriptionMatch';
import { OddOneOut } from '../quizModes/OddOneOut';
import { OriginMatch } from '../quizModes/OriginMatch';

export function QuizEngine({
  selectedModes,
  selectedCategories,
  questionCount,
  wineData,
  pronunciations,
  difficulty,
  onAnswer,
  onComplete,
  onExit,
  darkMode
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [questions, setQuestions] = useState([]);

  // Get option count based on difficulty
  const optionCount = useMemo(() => {
    switch (difficulty) {
      case 'easy': return 3;
      case 'hard': return 5;
      default: return 4;
    }
  }, [difficulty]);

  // Filter styles based on selected categories
  const filteredStyles = useMemo(() => {
    if (!wineData) return [];
    if (selectedCategories.length === 0) {
      return wineData.styles;
    }
    return wineData.styles.filter(s => selectedCategories.includes(s.id));
  }, [wineData, selectedCategories]);

  // Get all wines from filtered styles
  const allWines = useMemo(() => {
    return filteredStyles.flatMap(style =>
      style.wines.map(wine => ({
        ...wine,
        styleId: style.id,
        styleName: style.name,
        styleColor: style.color,
        styleDescription: style.description
      }))
    );
  }, [filteredStyles]);

  // Generate questions
  useEffect(() => {
    if (!wineData || allWines.length === 0) return;

    const generatedQuestions = [];
    const modesPool = shuffleArray([...selectedModes]);

    for (let i = 0; i < questionCount; i++) {
      const mode = modesPool[i % modesPool.length];
      const question = generateQuestion(mode, allWines, filteredStyles, wineData.styles, pronunciations, optionCount);
      if (question) {
        generatedQuestions.push(question);
      }
    }

    setQuestions(shuffleArray(generatedQuestions));
  }, [wineData, allWines, filteredStyles, selectedModes, questionCount, pronunciations, optionCount]);

  const handleAnswer = useCallback((answer, isCorrect, details) => {
    setLastAnswer({ answer, isCorrect, details });
    setShowFeedback(true);

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswers(prev => [...prev, {
      question: questions[currentQuestion],
      answer,
      isCorrect,
      details
    }]);

    onAnswer(details.wineName || details.categoryId, isCorrect, details);
  }, [currentQuestion, questions, onAnswer]);

  const handleNext = useCallback(() => {
    setShowFeedback(false);
    setLastAnswer(null);

    if (currentQuestion + 1 >= questions.length) {
      onComplete({
        score,
        total: questions.length,
        answers
      });
    } else {
      setCurrentQuestion(prev => prev + 1);
    }
  }, [currentQuestion, questions.length, score, answers, onComplete]);

  if (!wineData || questions.length === 0) {
    return (
      <div className={`quiz-engine loading ${darkMode ? 'dark' : ''}`}>
        <p>Loading questions...</p>
      </div>
    );
  }

  const question = questions[currentQuestion];

  const renderQuestion = () => {
    const commonProps = {
      question,
      onAnswer: handleAnswer,
      showFeedback,
      lastAnswer,
      optionCount,
      darkMode
    };

    switch (question.mode) {
      case 'category-match':
        return <CategoryMatch {...commonProps} />;
      case 'wine-selection':
        return <WineSelection {...commonProps} />;
      case 'pronunciation':
        return <PronunciationQuiz {...commonProps} />;
      case 'quick-fire':
        return <QuickFire {...commonProps} onTimeUp={handleAnswer} />;
      case 'description-match':
        return <DescriptionMatch {...commonProps} />;
      case 'odd-one-out':
        return <OddOneOut {...commonProps} />;
      case 'origin-match':
        return <OriginMatch {...commonProps} />;
      default:
        return <p>Unknown question type</p>;
    }
  };

  return (
    <div className={`quiz-engine ${darkMode ? 'dark' : ''}`}>
      <div className="quiz-header">
        <button className="exit-btn" onClick={onExit}>
          Exit
        </button>
        <div className="quiz-progress">
          <span className="progress-text">
            {currentQuestion + 1} / {questions.length}
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="quiz-score">
          Score: {score}
        </div>
      </div>

      <div className="quiz-content">
        {renderQuestion()}
      </div>

      {showFeedback && (
        <div className={`feedback-overlay ${lastAnswer?.isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="feedback-content">
            <div className="feedback-icon">
              {lastAnswer?.isCorrect ? '✓' : '✗'}
            </div>
            <div className="feedback-message">
              {lastAnswer?.isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            {lastAnswer?.details?.explanation && (
              <p className="feedback-explanation">{lastAnswer.details.explanation}</p>
            )}
            <button className="next-btn" onClick={handleNext}>
              {currentQuestion + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Question generation functions
function generateQuestion(mode, allWines, filteredStyles, allStyles, pronunciations, optionCount) {
  switch (mode) {
    case 'category-match':
      return generateCategoryMatchQuestion(allWines, allStyles, optionCount);
    case 'wine-selection':
      return generateWineSelectionQuestion(allWines, filteredStyles);
    case 'pronunciation':
      return generatePronunciationQuestion(allWines, pronunciations, optionCount);
    case 'quick-fire':
      return generateQuickFireQuestion(allWines, allStyles);
    case 'description-match':
      return generateDescriptionMatchQuestion(filteredStyles, allStyles, optionCount);
    case 'odd-one-out':
      return generateOddOneOutQuestion(allWines, filteredStyles);
    case 'origin-match':
      return generateOriginMatchQuestion(allWines, optionCount);
    default:
      return null;
  }
}

function generateCategoryMatchQuestion(allWines, allStyles, optionCount) {
  const wine = getRandomItem(allWines);
  const correctStyle = allStyles.find(s => s.id === wine.styleId);

  // Get incorrect options
  const incorrectStyles = allStyles
    .filter(s => s.id !== wine.styleId)
    .slice(0, optionCount - 1);

  const options = shuffleArray([
    { id: correctStyle.id, name: correctStyle.name, color: correctStyle.color, isCorrect: true },
    ...incorrectStyles.map(s => ({ id: s.id, name: s.name, color: s.color, isCorrect: false }))
  ]);

  return {
    mode: 'category-match',
    wine,
    options,
    correctAnswer: correctStyle.id
  };
}

function generateWineSelectionQuestion(allWines, filteredStyles) {
  const style = getRandomItem(filteredStyles);
  const correctWines = style.wines.map(w => w.name);

  // Get some incorrect wines from other styles
  const otherWines = allWines
    .filter(w => w.styleId !== style.id)
    .map(w => w.name);

  const incorrectWines = getRandomItems(otherWines, Math.min(4, otherWines.length));

  const allOptions = shuffleArray([
    ...correctWines.map(name => ({ name, isCorrect: true })),
    ...incorrectWines.map(name => ({ name, isCorrect: false }))
  ]).slice(0, 8);

  return {
    mode: 'wine-selection',
    style,
    options: allOptions,
    correctWines
  };
}

function generatePronunciationQuestion(allWines, pronunciations, optionCount) {
  // Filter wines that have pronunciations
  const winesWithPronunciations = allWines.filter(w => pronunciations && pronunciations[w.name]);

  if (winesWithPronunciations.length === 0) {
    return null;
  }

  const wine = getRandomItem(winesWithPronunciations);
  const correctPronunciation = pronunciations[wine.name].simple;

  return {
    mode: 'pronunciation',
    wine,
    correctPronunciation,
    optionCount
  };
}

function generateQuickFireQuestion(allWines, allStyles) {
  const wine = getRandomItem(allWines);
  const correctStyle = allStyles.find(s => s.id === wine.styleId);

  // 50% chance of correct statement
  const isCorrectStatement = Math.random() > 0.5;

  let statement, isTrue;
  if (isCorrectStatement) {
    statement = `${wine.name} is a ${correctStyle.name.toLowerCase().replace(' wine', '')}`;
    isTrue = true;
  } else {
    const wrongStyle = getRandomItem(allStyles.filter(s => s.id !== wine.styleId));
    statement = `${wine.name} is a ${wrongStyle.name.toLowerCase().replace(' wine', '')}`;
    isTrue = false;
  }

  return {
    mode: 'quick-fire',
    statement,
    isTrue,
    wine,
    correctStyle
  };
}

function generateDescriptionMatchQuestion(filteredStyles, allStyles, optionCount) {
  const style = getRandomItem(filteredStyles);

  const options = shuffleArray([
    { id: style.id, name: style.name, color: style.color, isCorrect: true },
    ...getRandomItems(allStyles.filter(s => s.id !== style.id), optionCount - 1)
      .map(s => ({ id: s.id, name: s.name, color: s.color, isCorrect: false }))
  ]);

  return {
    mode: 'description-match',
    description: style.description,
    style,
    options,
    correctAnswer: style.id
  };
}

function generateOddOneOutQuestion(allWines, filteredStyles) {
  // Pick a style with at least 3 wines
  const stylesWithEnoughWines = filteredStyles.filter(s => s.wines.length >= 3);
  if (stylesWithEnoughWines.length === 0) {
    return null;
  }

  const mainStyle = getRandomItem(stylesWithEnoughWines);
  const mainWines = getRandomItems(mainStyle.wines, 3);

  // Get one wine from a different style
  const otherStyles = filteredStyles.filter(s => s.id !== mainStyle.id);
  if (otherStyles.length === 0) {
    return null;
  }

  const oddStyle = getRandomItem(otherStyles);
  const oddWine = getRandomItem(oddStyle.wines);

  const options = shuffleArray([
    ...mainWines.map(w => ({
      ...w,
      styleId: mainStyle.id,
      styleName: mainStyle.name,
      isOdd: false
    })),
    {
      ...oddWine,
      styleId: oddStyle.id,
      styleName: oddStyle.name,
      isOdd: true
    }
  ]);

  return {
    mode: 'odd-one-out',
    options,
    oddWine: oddWine.name,
    mainStyle,
    oddStyle
  };
}

function generateOriginMatchQuestion(allWines, optionCount) {
  const wine = getRandomItem(allWines);

  // Get unique origins
  const allOrigins = [...new Set(allWines.flatMap(w => w.origin.split('/').map(o => o.trim())))];
  const correctOrigins = wine.origin.split('/').map(o => o.trim());

  const incorrectOrigins = allOrigins
    .filter(o => !correctOrigins.includes(o));

  const options = shuffleArray([
    ...correctOrigins.map(o => ({ origin: o, isCorrect: true })),
    ...getRandomItems(incorrectOrigins, optionCount - correctOrigins.length)
      .map(o => ({ origin: o, isCorrect: false }))
  ]).slice(0, optionCount);

  return {
    mode: 'origin-match',
    wine,
    options,
    correctOrigins
  };
}
