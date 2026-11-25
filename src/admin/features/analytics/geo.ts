import type { GlobeMarker } from "./components/globe"
import type { LiveLocation } from "./types"

type LatLng = [number, number]

const CITIES: Record<string, LatLng> = {
  "copenhagen|DK": [55.68, 12.57],
  "berlin|DE": [52.52, 13.4],
  "munich|DE": [48.14, 11.58],
  "hamburg|DE": [53.55, 9.99],
  "stockholm|SE": [59.33, 18.07],
  "gothenburg|SE": [57.71, 11.97],
  "london|GB": [51.51, -0.13],
  "manchester|GB": [53.48, -2.24],
  "paris|FR": [48.86, 2.35],
  "lyon|FR": [45.76, 4.84],
  "madrid|ES": [40.42, -3.7],
  "barcelona|ES": [41.39, 2.17],
  "milan|IT": [45.46, 9.19],
  "rome|IT": [41.9, 12.5],
  "amsterdam|NL": [52.37, 4.9],
  "oslo|NO": [59.91, 10.75],
  "helsinki|FI": [60.17, 24.94],
  "dublin|IE": [53.35, -6.26],
  "lisbon|PT": [38.72, -9.14],
  "vienna|AT": [48.21, 16.37],
  "zurich|CH": [47.38, 8.54],
  "brussels|BE": [50.85, 4.35],
  "warsaw|PL": [52.23, 21.01],
  "new york|US": [40.71, -74.01],
  "los angeles|US": [34.05, -118.24],
  "chicago|US": [41.88, -87.63],
  "toronto|CA": [43.65, -79.38],
  "vancouver|CA": [49.28, -123.12],
  "sydney|AU": [-33.87, 151.21],
  "melbourne|AU": [-37.81, 144.96],
  "tokyo|JP": [35.68, 139.69],
  "singapore|SG": [1.35, 103.82],
}

const COUNTRIES: Record<string, LatLng> = {
  DK: [56.0, 10.0],
  DE: [51.2, 10.4],
  SE: [62.0, 15.0],
  GB: [54.0, -2.0],
  FR: [46.6, 2.4],
  ES: [40.2, -3.6],
  IT: [42.8, 12.5],
  NL: [52.2, 5.3],
  NO: [61.0, 9.0],
  FI: [64.0, 26.0],
  IE: [53.2, -8.0],
  PT: [39.6, -8.0],
  AT: [47.6, 14.1],
  CH: [46.8, 8.2],
  BE: [50.6, 4.6],
  PL: [52.1, 19.4],
  US: [39.8, -98.6],
  CA: [56.1, -106.3],
  MX: [23.6, -102.5],
  BR: [-14.2, -51.9],
  AU: [-25.3, 133.8],
  NZ: [-41.0, 174.0],
  JP: [36.2, 138.3],
  SG: [1.35, 103.82],
  IN: [20.6, 79.0],
  ZA: [-30.6, 22.9],
  AE: [23.4, 53.8],
}

export const locate = (city: string, countryCode: string): LatLng | null =>
  CITIES[`${city.trim().toLowerCase()}|${countryCode.toUpperCase()}`] ??
  COUNTRIES[countryCode.toUpperCase()] ??
  null

export const toGlobe = (
  locations: LiveLocation[]
): { markers: GlobeMarker[]; focus?: { lat: number; lng: number } } => {
  const busiest = Math.max(1, ...locations.map((entry) => entry.orders))
  const markers = locations.flatMap((entry) => {
    const position = locate(entry.city, entry.country_code)
    return position
      ? [{ lat: position[0], lng: position[1], weight: entry.orders / busiest }]
      : []
  })
  const top = locations[0]
  const focus = top ? locate(top.city, top.country_code) : null
  return {
    markers,
    focus: focus ? { lat: focus[0], lng: focus[1] } : undefined,
  }
}
