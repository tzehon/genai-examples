An interactive [React](https://react.dev/) web application for learning wine categories and varietals through seven different quiz modes: category matching, multi-select wine selection, pronunciation quizzes with phonetic guides, timed quick-fire true/false questions, description matching, odd-one-out identification, and origin matching with country flags. The app implements the SM-2 spaced repetition algorithm to schedule reviews optimally, tracking per-wine and per-category progress with daily streak monitoring and overall mastery percentages stored in localStorage. Wine data is loaded from external JSON files (`/public/data/wines.json` and `pronunciations.json`), enabling content updates without redeployment, while the mobile-first responsive design with dark mode support makes it ideal for studying alongside a wine book.

**Key Features:**
- **7 quiz modes**: Category match, wine selection (multi-select), pronunciation, quick-fire (10s timer), description match, odd-one-out, origin match
- **Progress tracking**: SM-2 spaced repetition, streak calendar, mastery percentages, export/import JSON
- **37 wines** across 7 categories: Sparkling, Light/Full-Bodied White, Aromatic White, Rosé, Light/Medium-Bodied Red
- **Offline support**: localStorage caching with offline indicator
