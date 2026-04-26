export interface EpicColorScheme {
  full: string;   // Epic bar background
  medium: string; // Story bar background
  light: string;  // Task bar background
}

const SCHEMES: EpicColorScheme[] = [
  { full: '#C4A4A0', medium: '#DCCAC7', light: '#EDE0DE' }, // Old Rose
  { full: '#7FB5B0', medium: '#B5D3D0', light: '#DDE9E8' }, // Muted Teal
  { full: '#D4A87C', medium: '#E6CCAF', light: '#F0E2D3' }, // Soft Apricot
  { full: '#9BA4C4', medium: '#C3C9DC', light: '#E0E3EC' }, // Soft Periwinkle
  { full: '#B5A08A', medium: '#D3C7B9', light: '#E6DFD6' }, // Warm Umber
];

/** Deterministic hash so the same epic always gets the same color */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getEpicScheme(epicId: string): EpicColorScheme {
  return SCHEMES[hashString(epicId) % SCHEMES.length];
}

/** Fallback scheme when no epic ancestor is found */
export const FALLBACK_SCHEME: EpicColorScheme = SCHEMES[4]; // Warm Umber
