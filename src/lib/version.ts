/** The build's commit, short; "dev" locally. */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined)?.slice(0, 7) || 'dev'
