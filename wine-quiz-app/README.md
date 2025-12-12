# Wine Quiz App

An interactive React web application for learning wine categories and varietals through various quiz modes.

## Features

### Quiz Modes
- **Category Match**: Match wines to their style category (e.g., "Gamay" → Light-Bodied Red)
- **Wine Selection**: Select all wines belonging to a category (multi-select)
- **Quick Fire**: Rapid true/false questions with 10-second timer
- **Description Match**: Match style descriptions to categories
- **Odd One Out**: Find the wine that doesn't belong among 4 options
- **Origin Match**: Match wines to their country/region of origin

### Audio Pronunciation
- Speaker icon on all wine names for text-to-speech pronunciation
- Uses browser's built-in speech synthesis
- Prefers Italian/French/Spanish voices for authentic pronunciation

### Progress Tracking
- Spaced repetition (SM-2 algorithm) for optimal review scheduling
- Per-wine and per-category progress tracking
- Daily streak tracking
- Overall mastery percentage
- Progress export/import as JSON

### Study Mode
- Browse all wines organized by category
- View pronunciation, origin, and style descriptions
- Mark wines as "known" or "need to study"

### Settings
- Dark mode support
- Adjustable difficulty (3/4/5 options per question)
- Enable/disable specific quiz modes
- Configurable questions per session (5/10/15/20)
- Reset progress with confirmation

## Data Architecture

Wine data is loaded from JSON files in `/public/data/`, allowing content updates without redeployment:

- `wines.json`: Wine categories, varietals, origins, and descriptions
- `pronunciations.json`: Phonetic pronunciation guides

User progress is stored in localStorage with automatic caching.

## Tech Stack

- **React 19** with hooks
- **Vite** for fast development and building
- **CSS** with CSS variables for theming
- **localStorage** for persistence

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
wine-quiz-app/
├── public/
│   └── data/
│       ├── wines.json          # Wine data
│       └── pronunciations.json # Pronunciation guides
├── src/
│   ├── components/
│   │   ├── App.jsx             # Main app component
│   │   ├── Navigation.jsx      # Bottom navigation
│   │   ├── Home.jsx            # Home screen
│   │   ├── QuizEngine.jsx      # Quiz controller
│   │   ├── QuizModeSelector.jsx
│   │   ├── QuizResults.jsx
│   │   ├── StudyMode.jsx
│   │   ├── ProgressDashboard.jsx
│   │   ├── Settings.jsx
│   │   └── SpeakButton.jsx     # Text-to-speech button
│   ├── quizModes/
│   │   ├── CategoryMatch.jsx
│   │   ├── WineSelection.jsx
│   │   ├── QuickFire.jsx
│   │   ├── DescriptionMatch.jsx
│   │   ├── OddOneOut.jsx
│   │   └── OriginMatch.jsx
│   ├── hooks/
│   │   ├── useWineData.js      # Fetch and cache wine data
│   │   ├── useProgress.js      # Manage localStorage progress
│   │   └── useSpacedRepetition.js
│   ├── utils/
│   │   ├── shuffleArray.js
│   │   ├── calculateMastery.js
│   │   └── speak.js            # Text-to-speech utility
│   ├── styles.css              # All styles
│   └── main.jsx                # Entry point
└── index.html
```

## Wine Categories Included

- **Sparkling**: Cava, Champagne, Lambrusco, Prosecco
- **Light-Bodied White**: Albariño, Grüner Veltliner, Muscadet, Pinot Gris, Sauvignon Blanc, Soave, Vermentino
- **Full-Bodied White**: Chardonnay, Marsanne Blend, Sémillon, Viognier
- **Aromatic White**: Chenin Blanc, Gewürztraminer, Muscat Blanc, Riesling, Torrontés
- **Rosé**: Rosé
- **Light-Bodied Red**: Gamay, Pinot Noir
- **Medium-Bodied Red**: Barbera, Cabernet Franc, Carignan, Carménère, Grenache, Mencía, Merlot, Montepulciano, Negroamaro, Rhône/GSM Blend, Sangiovese, Valpolicella Blend, Zinfandel

## Updating Wine Data

Edit the JSON files in `/public/data/` to add or modify wines:

```json
// wines.json - Add a new wine to a category
{
  "id": "light-white",
  "name": "Light-Bodied White Wine",
  "wines": [
    { "name": "New Wine", "origin": "Country" }
  ]
}

// pronunciations.json - Add pronunciation
{
  "pronunciations": {
    "New Wine": { "simple": "NEW WINE" }
  }
}
```

## Offline Support

The app works offline using cached data from localStorage. An offline indicator appears when disconnected.

## Mobile First

Designed primarily for mobile use while reading a wine book, with responsive layout for larger screens.

## Deploying to Vercel

Since this app is in a subfolder of a monorepo, configure Vercel to use the correct root directory:

### Option 1: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and import your repository
2. In the configuration step, set **Root Directory** to `wine-quiz-app`
3. Vercel auto-detects Vite and configures build settings
4. Click **Deploy**

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# From the wine-quiz-app directory
cd wine-quiz-app
vercel

# Or specify root directory from repo root
vercel --cwd wine-quiz-app
```

### Option 3: vercel.json (in wine-quiz-app folder)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

Then set root directory to `wine-quiz-app` in Vercel dashboard.

### Environment

No environment variables required - the app uses static JSON files and localStorage.
