import { shuffleArray } from './shuffleArray';

/**
 * Generate fake pronunciations by modifying the correct one
 */
const syllableVariations = {
  vowels: {
    'ah': ['oh', 'eh', 'uh', 'ay'],
    'oh': ['ah', 'oo', 'eh', 'aw'],
    'ee': ['ay', 'ih', 'eh', 'oo'],
    'ay': ['ee', 'ah', 'eh', 'iy'],
    'oo': ['oh', 'ew', 'uh', 'ah'],
    'eh': ['ah', 'ay', 'ih', 'ee'],
    'uh': ['ah', 'oh', 'eh', 'aw'],
    'aw': ['oh', 'ah', 'ow', 'uh'],
    'ih': ['ee', 'eh', 'ay', 'uh'],
  },
  consonants: {
    'sh': ['ch', 'zh', 's', 'j'],
    'ch': ['sh', 'k', 'tch', 'j'],
    'zh': ['sh', 'j', 'z', 'ch'],
    'th': ['t', 'd', 'f', 'z'],
    'ny': ['n', 'gn', 'ni', 'ng'],
  }
};

const stressPatterns = [
  // Move stress to different syllable
  (parts) => {
    const stressed = parts.findIndex(p => p === p.toUpperCase());
    if (stressed > 0) {
      const newParts = parts.map(p => p.toLowerCase());
      newParts[stressed - 1] = newParts[stressed - 1].toUpperCase();
      return newParts;
    }
    if (stressed < parts.length - 1) {
      const newParts = parts.map(p => p.toLowerCase());
      newParts[stressed + 1] = newParts[stressed + 1].toUpperCase();
      return newParts;
    }
    return parts;
  }
];

function modifyVowel(syllable) {
  for (const [vowel, alternatives] of Object.entries(syllableVariations.vowels)) {
    if (syllable.toLowerCase().includes(vowel)) {
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      return syllable.replace(new RegExp(vowel, 'i'), alt);
    }
  }
  return syllable;
}

function generateVariation(pronunciation) {
  const parts = pronunciation.split('-');
  const variationType = Math.floor(Math.random() * 3);

  switch (variationType) {
    case 0: {
      // Change stress
      const stressed = parts.findIndex(p => p === p.toUpperCase());
      if (stressed >= 0 && parts.length > 1) {
        const newParts = parts.map(p => p.toLowerCase());
        const newStress = (stressed + 1) % parts.length;
        newParts[newStress] = newParts[newStress].toUpperCase();
        return newParts.join('-');
      }
      break;
    }
    case 1: {
      // Modify a vowel sound
      const idx = Math.floor(Math.random() * parts.length);
      const newParts = [...parts];
      newParts[idx] = modifyVowel(newParts[idx]);
      return newParts.join('-');
    }
    case 2: {
      // Swap syllable order (for longer words)
      if (parts.length >= 3) {
        const newParts = [...parts];
        const i = Math.floor(Math.random() * (parts.length - 1));
        [newParts[i], newParts[i + 1]] = [newParts[i + 1], newParts[i]];
        return newParts.join('-');
      }
      break;
    }
  }

  // Fallback: just modify a vowel
  const newParts = [...parts];
  const idx = Math.floor(Math.random() * parts.length);
  newParts[idx] = modifyVowel(newParts[idx]);
  return newParts.join('-');
}

/**
 * Generate fake pronunciations for a wine name
 * @param {string} correctPronunciation - The correct pronunciation
 * @param {number} count - Number of fakes to generate
 * @returns {string[]} - Array of fake pronunciations
 */
export function generateFakePronunciations(correctPronunciation, count = 3) {
  const fakes = new Set();
  let attempts = 0;
  const maxAttempts = count * 10;

  while (fakes.size < count && attempts < maxAttempts) {
    const fake = generateVariation(correctPronunciation);
    if (fake !== correctPronunciation && !fakes.has(fake)) {
      fakes.add(fake);
    }
    attempts++;
  }

  // If we couldn't generate enough unique fakes, create some obvious variations
  while (fakes.size < count) {
    const parts = correctPronunciation.split('-');
    const fake = parts.reverse().join('-');
    if (fake !== correctPronunciation) {
      fakes.add(fake + fakes.size);
    } else {
      fakes.add(correctPronunciation.replace(/[aeiou]/i, 'o') + fakes.size);
    }
  }

  return Array.from(fakes);
}

/**
 * Get pronunciation options for quiz
 * @param {string} correctPronunciation - The correct pronunciation
 * @param {number} totalOptions - Total number of options (including correct)
 * @returns {Array<{text: string, isCorrect: boolean}>}
 */
export function getPronunciationOptions(correctPronunciation, totalOptions = 4) {
  const fakes = generateFakePronunciations(correctPronunciation, totalOptions - 1);
  const options = [
    { text: correctPronunciation, isCorrect: true },
    ...fakes.map(f => ({ text: f, isCorrect: false }))
  ];
  return shuffleArray(options);
}
