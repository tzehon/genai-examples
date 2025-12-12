import { useState, useEffect, useCallback } from 'react';
import { Navigation } from './Navigation';
import { Home } from './Home';
import { QuizModeSelector } from './QuizModeSelector';
import { QuizEngine } from './QuizEngine';
import { QuizResults } from './QuizResults';
import { StudyMode } from './StudyMode';
import { ProgressDashboard } from './ProgressDashboard';
import { Settings } from './Settings';
import { useWineData } from '../hooks/useWineData';
import { useProgress } from '../hooks/useProgress';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';

export function App() {
  const [currentView, setCurrentView] = useState('home');
  const [quizState, setQuizState] = useState('idle'); // idle, configuring, playing, results
  const [quizConfig, setQuizConfig] = useState({
    selectedModes: [],
    selectedCategories: [],
    questionCount: 10
  });
  const [quizResults, setQuizResults] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const {
    wineData,
    pronunciations,
    loading,
    error,
    lastUpdated,
    refresh,
    getAllWines,
    getAllStyles
  } = useWineData();

  const {
    progress,
    recordWineAnswer,
    recordCategoryAnswer,
    updateStreak,
    incrementQuestions,
    updateSettings,
    toggleDarkMode,
    resetProgress,
    exportProgress,
    importProgress,
    markWineStudyStatus
  } = useProgress();

  const { calculateUpdatedProgress } = useSpacedRepetition(
    progress.wineProgress,
    getAllWines()
  );

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply dark mode to document
  useEffect(() => {
    document.body.classList.toggle('dark-mode', progress.settings.darkMode);
  }, [progress.settings.darkMode]);

  // Initialize quiz config with settings
  useEffect(() => {
    setQuizConfig(prev => ({
      ...prev,
      selectedModes: [...progress.settings.enabledModes],
      questionCount: progress.settings.questionsPerSession
    }));
  }, [progress.settings.enabledModes, progress.settings.questionsPerSession]);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
    if (view !== 'quiz') {
      setQuizState('idle');
    }
  }, []);

  const handleStartQuiz = useCallback(() => {
    setCurrentView('quiz');
    setQuizState('configuring');
  }, []);

  const handleBeginQuiz = useCallback(() => {
    setQuizState('playing');
  }, []);

  const handleQuizAnswer = useCallback((identifier, isCorrect, details) => {
    if (details.wineName) {
      recordWineAnswer(details.wineName, isCorrect);
    }
    if (details.categoryId) {
      recordCategoryAnswer(details.categoryId, isCorrect);
    }
    incrementQuestions();
  }, [recordWineAnswer, recordCategoryAnswer, incrementQuestions]);

  const handleQuizComplete = useCallback((results) => {
    setQuizResults(results);
    setQuizState('results');
    updateStreak();
  }, [updateStreak]);

  const handleExitQuiz = useCallback(() => {
    setQuizState('idle');
    setCurrentView('home');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setQuizState('configuring');
  }, []);

  const renderContent = () => {
    if (loading && !wineData) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading wine data...</p>
        </div>
      );
    }

    if (error && !wineData) {
      return (
        <div className="error-screen">
          <p>Error: {error}</p>
          <button onClick={refresh}>Retry</button>
        </div>
      );
    }

    // Quiz flow
    if (currentView === 'quiz') {
      if (quizState === 'configuring') {
        return (
          <QuizModeSelector
            enabledModes={progress.settings.enabledModes}
            selectedModes={quizConfig.selectedModes}
            onModesChange={(modes) => setQuizConfig(prev => ({ ...prev, selectedModes: modes }))}
            categories={getAllStyles()}
            selectedCategories={quizConfig.selectedCategories}
            onCategoriesChange={(cats) => setQuizConfig(prev => ({ ...prev, selectedCategories: cats }))}
            questionCount={quizConfig.questionCount}
            onQuestionCountChange={(count) => setQuizConfig(prev => ({ ...prev, questionCount: count }))}
            onStartQuiz={handleBeginQuiz}
            darkMode={progress.settings.darkMode}
          />
        );
      }

      if (quizState === 'playing') {
        return (
          <QuizEngine
            selectedModes={quizConfig.selectedModes}
            selectedCategories={quizConfig.selectedCategories}
            questionCount={quizConfig.questionCount}
            wineData={wineData}
            pronunciations={pronunciations}
            difficulty={progress.settings.difficulty}
            onAnswer={handleQuizAnswer}
            onComplete={handleQuizComplete}
            onExit={handleExitQuiz}
            darkMode={progress.settings.darkMode}
          />
        );
      }

      if (quizState === 'results') {
        return (
          <QuizResults
            results={quizResults}
            onPlayAgain={handlePlayAgain}
            onGoHome={handleExitQuiz}
            darkMode={progress.settings.darkMode}
          />
        );
      }
    }

    switch (currentView) {
      case 'study':
        return (
          <StudyMode
            wineData={wineData}
            pronunciations={pronunciations}
            progress={progress}
            onMarkStudyStatus={markWineStudyStatus}
            darkMode={progress.settings.darkMode}
          />
        );

      case 'progress':
        return (
          <ProgressDashboard
            progress={progress}
            wineData={wineData}
            darkMode={progress.settings.darkMode}
          />
        );

      case 'settings':
        return (
          <Settings
            settings={progress.settings}
            onUpdateSettings={updateSettings}
            onResetProgress={resetProgress}
            onExportProgress={exportProgress}
            onImportProgress={importProgress}
            onToggleDarkMode={toggleDarkMode}
            darkMode={progress.settings.darkMode}
          />
        );

      default:
        return (
          <Home
            progress={progress}
            wineData={wineData}
            onStartQuiz={handleStartQuiz}
            onNavigate={handleNavigate}
            darkMode={progress.settings.darkMode}
          />
        );
    }
  };

  return (
    <div className={`app ${progress.settings.darkMode ? 'dark' : ''}`}>
      {!isOnline && (
        <div className="offline-banner">
          Offline - Using cached data
        </div>
      )}

      {quizState !== 'playing' && (
        <Navigation
          currentView={currentView}
          onNavigate={handleNavigate}
          darkMode={progress.settings.darkMode}
        />
      )}

      <main className="main-content">
        {renderContent()}
      </main>

      {lastUpdated && quizState !== 'playing' && (
        <footer className="app-footer">
          <span>Data updated: {lastUpdated}</span>
          {isOnline && (
            <button className="refresh-btn" onClick={refresh}>
              Refresh
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
