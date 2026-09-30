export type LegalDoc = 'privacy' | 'terms' | 'health' | 'delete'

export const LEGAL_TITLES: Record<LegalDoc, string> = { privacy: 'Privacy policy', terms: 'Terms of use', health: 'Health notice', delete: 'Deleting your account' }
