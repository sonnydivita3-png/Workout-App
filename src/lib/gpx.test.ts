import { describe, expect, it } from 'vitest'
import { parseGpx } from './gpx'

const track = (pts: [number, number, string][]) =>
  `<?xml version="1.0"?><gpx><trk><name>Morning Run</name><trkseg>${pts.map(([la, lo, t]) => `<trkpt lat="${la}" lon="${lo}"><ele>10</ele><time>${t}</time></trkpt>`).join('')}</trkseg></trk></gpx>`

describe('parseGpx', () => {
  it('adds up distance and moving time', () => {
    // 0.01 degrees of latitude is about 0.69 miles.
    const g = parseGpx(track([[43.0, -88.0, '2026-09-28T12:00:00Z'], [43.01, -88.0, '2026-09-28T12:06:00Z'], [43.02, -88.0, '2026-09-28T12:12:00Z']]))!
    expect(g.miles).toBeCloseTo(1.38, 1)
    expect(g.minutes).toBe(12)
    expect(g.name).toBe('Morning Run')
    expect(g.date).toMatch(/^2026-09-2[78]$/)
  })
  it('skips long pauses when standing still', () => {
    const g = parseGpx(track([[43.0, -88.0, '2026-09-28T12:00:00Z'], [43.01, -88.0, '2026-09-28T12:06:00Z'], [43.01, -88.0, '2026-09-28T12:20:00Z'], [43.02, -88.0, '2026-09-28T12:26:00Z']]))!
    expect(g.minutes).toBe(12)
  })
  it('rejects files without a track', () => {
    expect(parseGpx('<gpx></gpx>')).toBeNull()
    expect(parseGpx('not xml')).toBeNull()
  })
})
