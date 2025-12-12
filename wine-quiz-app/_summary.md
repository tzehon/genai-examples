A mobile-first [React](https://react.dev/) web application helps wine enthusiasts learn varietals and categories through six interactive quiz modes, including timed challenges, category matching, and origin identification. Built with [Vite](https://vitejs.dev/), the app implements spaced repetition learning (SM-2 algorithm) to optimize retention, tracks daily streaks and per-wine mastery, and includes text-to-speech pronunciation for all wine names. Wine data is stored in editable JSON files for easy content updates, while user progress persists in localStorage with offline support and import/export capabilities.

**Key Features:**
- Six quiz modes: Category Match, Wine Selection, Quick Fire (10-sec timer), Description Match, Odd One Out, and Origin Match
- Spaced repetition algorithm tracks 50+ wines across 7 categories (sparkling, whites, rosé, reds)
- Audio pronunciation using browser speech synthesis with language-specific voices
- Dark mode, adjustable difficulty, and customizable session lengths
- Study mode for browsing wines by category with progress marking