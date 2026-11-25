import type { SVGAttributes } from "react"
import { useId } from "react"

type Props = Omit<SVGAttributes<SVGSVGElement>, "children">

// The Analytics Studio mark, sized like the @medusajs/icons set (15px).
export const AnalyticsStudioIcon = (props: Props) => {
  const id = useId()
  const lower = `${id}-lower`
  const upper = `${id}-upper`

  return (
    <svg
      width={15}
      height={15}
      viewBox="48 24 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect x="48" y="24" width="512" height="512" rx="116" fill="#F6F886" />
      <rect
        x="48"
        y="24"
        width="512"
        height="512"
        rx="116"
        fill={`url(#${lower})`}
      />
      <rect
        x="48"
        y="24"
        width="512"
        height="512"
        rx="116"
        fill={`url(#${upper})`}
      />
      <rect x="182" y="270" width="68" height="150" rx="34" fill="#000" />
      <rect x="270" y="200" width="68" height="220" rx="34" fill="#000" />
      <rect x="358" y="130" width="68" height="290" rx="34" fill="#000" />
      <defs>
        <radialGradient
          id={lower}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(48 536) scale(317.44)"
        >
          <stop stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={upper}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(201.6 49.6) scale(256)"
        >
          <stop stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}
