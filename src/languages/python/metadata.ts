import type { LanguageMetadata } from '../types';

export const metadata: LanguageMetadata = {
  id: 'python',
  name: 'Python',
  extension: '.py',
  cmLanguage: 'python',
  weight: 'heavy',
  prefetchUrls: [
    'https://cdn.jsdelivr.net/pyodide/v314.0.5/full/pyodide.js'
  ]
};

export default metadata;
