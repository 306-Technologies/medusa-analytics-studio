import { useEffect, useRef, useState, type RefObject } from "react"

export type GlobeMarker = {
  lat: number
  lng: number
  weight: number
}

type Props = {
  markers: GlobeMarker[]
  focus?: { lat: number; lng: number }
  maxWidth?: number | null
  pin?: { lat: number; lng: number; ref: RefObject<HTMLElement | null> }
}

const isDark = () => document.documentElement.classList.contains("dark")

const useAdminDark = () => {
  const [dark, setDark] = useState(isDark)
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])
  return dark
}

// cobe draws the sphere at 0.8 of half the canvas.
const RADIUS = 0.8

const project = (lat: number, lng: number, phi: number, theta: number) => {
  const la = (lat * Math.PI) / 180
  const lo = (lng * Math.PI) / 180 - Math.PI
  const x0 = -Math.cos(la) * Math.cos(lo)
  const y0 = Math.sin(la)
  const z0 = Math.cos(la) * Math.sin(lo)
  const x = x0 * Math.cos(phi) + z0 * Math.sin(phi)
  const z1 = -x0 * Math.sin(phi) + z0 * Math.cos(phi)
  const y = y0 * Math.cos(theta) - z1 * Math.sin(theta)
  const z = y0 * Math.sin(theta) + z1 * Math.cos(theta)
  return {
    left: 0.5 + (x * RADIUS) / 2,
    top: 0.5 - (y * RADIUS) / 2,
    front: z > 0.05,
  }
}

const angleFor = (lat: number, lng: number): [number, number] => [
  Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
  (lat * Math.PI) / 180,
]

const SWAY_RADIANS = 0.22
const SWAY_SECONDS = 24

export const Globe = ({ markers, focus, maxWidth = 760, pin }: Props) => {
  const dark = useAdminDark()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markersRef = useRef(markers)
  markersRef.current = markers
  const pinRef = useRef(pin)
  pinRef.current = pin
  const drag = useRef<{ x: number; phi: number } | null>(null)
  const hovering = useRef(false)
  const swayClock = useRef(0)
  const lastFrame = useRef(performance.now())
  const rotation = useRef<{ phi: number; theta: number } | null>(null)

  if (!rotation.current) {
    const [phi, theta] = angleFor(focus?.lat ?? 48, focus?.lng ?? 8)
    rotation.current = { phi, theta: Math.min(Math.max(theta, 0.1), 0.6) }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let size = canvas.offsetWidth
    const onResize = () => {
      size = canvas.offsetWidth
    }
    window.addEventListener("resize", onResize)

    let destroy: (() => void) | null = null
    let gone = false

    // Dynamic import: cobe is ESM-only, which the server-side type check cannot import.
    void import("cobe").then(({ default: createGlobe }) => {
      if (gone) {
        return
      }
      const globe = createGlobe(canvas, {
        devicePixelRatio: 2,
        width: size * 2,
        height: size * 2,
        phi: rotation.current?.phi ?? 0,
        theta: rotation.current?.theta ?? 0.3,
        dark: dark ? 1 : 0,
        diffuse: 1.2,
        mapSamples: 18000,
        // In light mode cobe turns land dots black at a mapBrightness of 1 or more.
        mapBrightness: dark ? 5 : 0.82,
        baseColor: dark ? [0.2, 0.3, 0.55] : [0.86, 0.9, 1],
        markerColor: [0.96, 0.25, 0.37],
        glowColor: dark ? [0.1, 0.14, 0.26] : [0.94, 0.96, 1],
        markers: [],
        onRender: (state) => {
          const current = rotation.current
          if (!drag.current && !hovering.current) {
            swayClock.current += (performance.now() - lastFrame.current) / 1000
          }
          lastFrame.current = performance.now()
          const sway =
            Math.sin((swayClock.current / SWAY_SECONDS) * Math.PI * 2) *
            SWAY_RADIANS
          state.phi = (current?.phi ?? 0) + sway
          state.theta = current?.theta ?? 0.3
          state.width = size * 2
          state.height = size * 2
          state.markers = markersRef.current.map((marker) => ({
            location: [marker.lat, marker.lng],
            size: 0.012 + marker.weight * 0.02,
          }))
          const pinned = pinRef.current
          const element = pinned?.ref.current
          if (pinned && element) {
            const point = project(
              pinned.lat,
              pinned.lng,
              state.phi,
              state.theta
            )
            element.style.transform = `translate(${point.left * size}px, ${point.top * size}px)`
            element.style.opacity = point.front ? "1" : "0"
            element.dataset.side = point.left > 0.62 ? "left" : "right"
          }
        },
      })
      destroy = () => globe.destroy()
    })

    return () => {
      gone = true
      destroy?.()
      window.removeEventListener("resize", onResize)
    }
  }, [dark])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Globe showing where today's orders came from"
      className="aspect-square w-full cursor-grab"
      style={{ contain: "layout paint size", maxWidth: maxWidth ?? undefined }}
      onPointerEnter={() => {
        hovering.current = true
      }}
      onPointerLeave={() => {
        hovering.current = false
        drag.current = null
      }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, phi: rotation.current?.phi ?? 0 }
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerMove={(event) => {
        if (drag.current && rotation.current) {
          rotation.current.phi =
            drag.current.phi + (event.clientX - drag.current.x) / 180
        }
      }}
    />
  )
}
