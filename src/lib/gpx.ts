/** Read a GPS track (GPX, as exported by Strava, Garmin, Apple Watch apps...) into distance and moving time. */
export interface GpxSummary { miles: number; minutes: number; date: string | null; name: string | null }

const R_MI = 3958.7613
const rad = (d: number) => (d * Math.PI) / 180
function haversine(a: [number, number], b: [number, number]) {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Parses with a regex rather than a DOM so it also runs in tests; GPX is simple enough for that. */
export function parseGpx(xml: string): GpxSummary | null {
  const pts: { ll: [number, number]; t: number | null }[] = []
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g
  for (let m; (m = re.exec(xml)); ) {
    const attrs = m[1] ?? m[3] ?? ''
    const lat = /lat="([-\d.]+)"/.exec(attrs)
    const lon = /lon="([-\d.]+)"/.exec(attrs)
    if (!lat || !lon) continue
    const time = /<time>([^<]+)<\/time>/.exec(m[2] ?? '')
    pts.push({ ll: [Number(lat[1]), Number(lon[1])], t: time ? Date.parse(time[1]) : null })
  }
  if (pts.length < 2) return null
  let miles = 0
  let moving = 0
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].ll, pts[i].ll)
    miles += d
    const a = pts[i - 1].t
    const b = pts[i].t
    // Count time only while moving (skip pauses: gaps over a minute with under ~20 m covered).
    if (a != null && b != null && b > a && !(b - a > 60000 && d < 0.0125)) moving += b - a
  }
  const first = pts.find((p) => p.t != null)?.t
  const date = first != null ? new Date(first) : null
  const name = /<trk>[\s\S]*?<name>([^<]*)<\/name>/.exec(xml)?.[1]?.trim() || null
  return {
    miles: Math.round(miles * 100) / 100,
    minutes: Math.round((moving / 60000) * 10) / 10,
    date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null,
    name,
  }
}
