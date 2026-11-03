/** A choice chip: the accent when picked. `hit` gives it a 44 px tap area without making a row of them taller. */
export const chipBtn = (on: boolean) => `hit rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent font-medium text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
