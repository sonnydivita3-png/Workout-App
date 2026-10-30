export type LegalDoc = 'privacy' | 'terms' | 'health' | 'delete'

export const LEGAL_TITLES: Record<LegalDoc, string> = { privacy: 'Privacy policy', terms: 'Terms of use', health: 'Health notice', delete: 'Deleting your account' }

/**
 * Who runs the app, as named in the terms. Change to the company's exact legal name once it's formed (e.g. "Durata
 * Fitness LLC"); the terms already cover a company formed to run the app, so nobody has to agree again for that.
 */
export const OPERATOR = 'Durata'
/** Where the operator is based: the terms' governing law and venue. */
export const HOME_STATE = 'Wisconsin'
export const HOME_COUNTY = 'Waukesha County'

/**
 * Raise this when the terms, health notice or privacy policy change in a way people should agree to again: everyone
 * sees the agreement screen once more before using the app.
 */
export const TERMS_VERSION = 1
export const TERMS_UPDATED = 'October 30, 2026'

export type LegalAcceptance = { version: number; at: string }

/** Whether this person has agreed to the current terms. */
export const termsAccepted = (a: LegalAcceptance | null | undefined) => !!a && a.version >= TERMS_VERSION

/** A saved agreement, if it's a real one (from storage, a backup file or the cloud). */
export function cleanAcceptance(v: unknown): LegalAcceptance | null {
  if (!v || typeof v !== 'object') return null
  const { version, at } = v as Record<string, unknown>
  return typeof version === 'number' && Number.isInteger(version) && version > 0 && typeof at === 'string' && !Number.isNaN(Date.parse(at)) ? { version, at } : null
}

/** When to talk to a doctor before using the app (the agreement screen and the health notice). */
export const HEALTH_FLAGS = [
  'A doctor has told you that you have a heart condition or high blood pressure, or that you should only exercise with medical supervision.',
  'You get chest pain, pressure or tightness at rest, in daily life, or when you exercise.',
  'You’ve fainted, or lost your balance because of dizziness, in the past year.',
  'You have diabetes, or kidney, lung or another long-term condition, or take medicine for one.',
  'You have a bone, joint, muscle or other injury or condition that more activity could make worse.',
  'You’re pregnant or gave birth in the past year.',
  'Anything else makes you unsure whether exercise is safe for you.',
]

/** When to stop exercising right away. */
export const STOP_SIGNS = 'Stop right away and get medical help if you feel chest pain or pressure, unusual shortness of breath, faintness or dizziness, a racing or irregular heartbeat, or sharp pain.'
