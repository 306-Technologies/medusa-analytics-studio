import { ArrowRightMini } from "@medusajs/icons"
import { Heading, Skeleton, Text, clx } from "@medusajs/ui"
import { useRef, type ReactNode } from "react"
import { Link } from "react-router-dom"

import activeCartsDot from "../assets/live/dot-active-carts.svg"
import checkingOutDot from "../assets/live/dot-checking-out.svg"
import eventDot from "../assets/live/dot-event.svg"
import keyLargeDot from "../assets/live/dot-key-large.svg"
import keySmallDot from "../assets/live/dot-key-small.svg"
import liveDot from "../assets/live/dot-live.svg"
import newestDot from "../assets/live/dot-newest.svg"
import halo from "../assets/live/halo.svg"
import newestMarker from "../assets/live/newest-order-marker.svg"
import pulse from "../assets/live/pulse.svg"
import { countryName, formatMoney, formatNumber, formatTime } from "../format"
import { locate, toGlobe } from "../geo"
import { DASHBOARD_HREF } from "../routes"
import type { LiveOrder, LiveResponse } from "../types"
import { Globe } from "./globe"

const Glow = ({
  src,
  size,
  glow,
}: {
  src: string
  size: number
  glow: number
}) => (
  <span
    className="relative inline-block shrink-0"
    style={{ width: size, height: size }}
  >
    <img
      alt=""
      src={src}
      className="absolute max-w-none"
      style={{ inset: -(glow - size) / 2, width: glow, height: glow }}
    />
  </span>
)

const Glass = ({
  className,
  children,
  ...props
}: {
  className?: string
  children: ReactNode
  "data-tour-anchor"?: string
}) => (
  <div
    {...props}
    className={clx(
      "rounded-xl border border-black/[0.06] bg-white/75 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-[8px] dark:border-white/[0.08] dark:bg-[rgba(33,33,36,0.72)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.32)]",
      className
    )}
  >
    {children}
  </div>
)

const LivePill = () => (
  <span className="flex items-center gap-x-1.5 rounded-full bg-[#d1fae5] py-[3px] dark:bg-[#022c22] pl-2 pr-2.5">
    <Glow src={liveDot} size={6} glow={22} />
    <span className="text-[12px] font-medium text-[#047857] dark:text-[#34d399]">
      Live
    </span>
  </span>
)

const Stat = ({
  label,
  dot,
  children,
}: {
  label: string
  dot?: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-y-1 border-black/[0.08] px-5 dark:border-white/[0.08] [&:not(:first-child)]:border-l">
    <span className="flex items-center gap-x-1.5 text-[12px] text-[#52525b] dark:text-[#a1a1aa]">
      {dot ? <Glow src={dot} size={6} glow={22} /> : null}
      {label}
    </span>
    <span className="text-[24px] font-medium tabular-nums text-[#18181b] dark:text-[#f4f4f5]">
      {children}
    </span>
  </div>
)

const ago = (iso: string, asOf: string, timeZone: string): string => {
  const minutes = Math.floor((Date.parse(asOf) - Date.parse(iso)) / 60_000)
  if (minutes < 1) {
    return "just now"
  }
  return minutes < 60 ? `${minutes} min ago` : formatTime(iso, timeZone)
}

const EVENT_COUNT = 6

const HappeningNow = ({ data }: { data: LiveResponse }) => {
  const money = (value: number) => formatMoney(value, data.currency_code)
  const events = data.recent_orders.slice(0, EVENT_COUNT)

  return (
    <Glass className="flex flex-col gap-y-4 p-5 lg:w-[340px]">
      <div className="flex flex-col gap-y-0.5">
        <span className="text-[13px] font-medium text-[#52525b] dark:text-[#a1a1aa]">
          Happening now
        </span>
        <span className="text-[12px] text-[#71717a]">
          Orders as they come in
        </span>
      </div>
      {events.length === 0 ? (
        <Text size="small" className="text-[#71717a]">
          No orders yet today.
        </Text>
      ) : (
        <ol className="flex flex-col">
          {events.map((order, index) => {
            const newest = index === 0
            const last = index === events.length - 1
            return (
              <li key={order.id} style={{ opacity: 1 - index * 0.1 }}>
                <Link
                  to={`/orders/${order.id}`}
                  className="group flex gap-x-3 rounded-md outline-none focus-visible:shadow-borders-focus"
                >
                  <span className="flex w-[9px] shrink-0 flex-col items-center gap-y-1 pt-[5px]">
                    {newest ? (
                      <Glow src={newestDot} size={9} glow={25} />
                    ) : (
                      <img alt="" src={eventDot} width={7} height={7} />
                    )}
                    {last ? null : (
                      <span className="w-px flex-1 bg-black/[0.1] dark:bg-white/[0.12]" />
                    )}
                  </span>
                  <span
                    className={clx(
                      "flex min-w-0 flex-1 flex-col gap-y-0.5",
                      !last && "pb-3.5"
                    )}
                  >
                    <span className="flex items-start justify-between gap-x-3 text-[13px] text-[#18181b] dark:text-[#f4f4f5]">
                      <span className="truncate group-hover:underline">
                        New order from{" "}
                        {order.city || countryName(order.country_code)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {money(order.total)}
                      </span>
                    </span>
                    <span
                      className={clx(
                        "text-[11px]",
                        newest
                          ? "text-[#e11d48] dark:text-[#fb7185]"
                          : "text-[#71717a]"
                      )}
                    >
                      {newest
                        ? ago(order.created_at, data.as_of, data.timezone)
                        : formatTime(order.created_at, data.timezone)}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Glass>
  )
}

const NewestOrderCallout = ({
  order,
  data,
}: {
  order: LiveOrder
  data: LiveResponse
}) => (
  <>
    <span className="absolute -left-[17px] -top-[17px] size-[34px]">
      <img
        alt=""
        src={pulse}
        className="size-full animate-ping [animation-duration:2.4s] motion-reduce:animate-none"
      />
    </span>
    <span className="absolute -left-[7px] -top-[7px]">
      <Glow src={newestMarker} size={14} glow={30} />
    </span>
    <span className="absolute -top-px left-[17px] h-px w-14 bg-black/25 dark:bg-white/30 group-data-[side=left]/callout:-left-[73px]" />
    <Glass className="absolute left-[73px] top-0 flex -translate-y-1/2 flex-col gap-y-0.5 whitespace-nowrap rounded-xl px-3 py-2 group-data-[side=left]/callout:left-auto group-data-[side=left]/callout:right-[73px]">
      <span className="flex items-center gap-x-2 text-[13px] font-medium">
        <span className="text-[#18181b] dark:text-[#f4f4f5]">
          {order.city ? `${order.city}, ` : ""}
          {countryName(order.country_code)}
        </span>
        <span className="tabular-nums text-[#059669] dark:text-[#34d399]">
          {formatMoney(order.total, data.currency_code)}
        </span>
      </span>
      <span className="text-[11px] text-[#71717a]">
        Order #{order.display_id ?? "?"} ·{" "}
        {formatTime(order.created_at, data.timezone)}
      </span>
    </Glass>
  </>
)

const MarkerKey = () => (
  <div className="flex items-center gap-x-2 text-[11px] text-[#71717a]">
    Fewer
    <Glow src={keySmallDot} size={6} glow={22} />
    <Glow src={newestDot} size={9} glow={25} />
    <Glow src={keyLargeDot} size={12} glow={28} />
    More orders today
  </div>
)

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base p-4 dark:border-transparent dark:bg-[#18181b] lg:block lg:h-[calc(100dvh-7rem)] lg:min-h-[640px] lg:p-0 lg:[container-type:size]">
    {children}
  </div>
)

const GLOBE_BOX =
  "relative mx-auto aspect-square w-full max-w-[640px] lg:absolute lg:inset-0 lg:m-auto lg:max-w-none lg:[width:min(88cqh,100cqw)]"

const Header = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-y-1.5 lg:absolute lg:left-10 lg:top-9">
    <div className="flex items-center gap-x-3">
      <Heading
        level="h1"
        className="text-[22px] font-medium leading-normal text-[#18181b] dark:text-[#f4f4f5]"
      >
        Live view
      </Heading>
      <LivePill />
    </div>
    {children}
  </div>
)

export const LiveView = ({ data }: { data: LiveResponse }) => {
  const calloutRef = useRef<HTMLDivElement>(null)
  const money = (value: number) => formatMoney(value, data.currency_code)
  const { markers, focus } = toGlobe(data.locations)
  const newest = data.recent_orders[0]
  const newestPlace = newest ? locate(newest.city, newest.country_code) : null

  return (
    <Stage>
      <div className={GLOBE_BOX} data-tour-anchor="live.globe">
        <img
          alt=""
          src={halo}
          className="pointer-events-none absolute -inset-[18%] -z-10 size-[136%] max-w-none opacity-60 dark:opacity-100"
        />
        <Globe
          markers={markers}
          focus={
            newestPlace ? { lat: newestPlace[0], lng: newestPlace[1] } : focus
          }
          maxWidth={null}
          pin={
            newestPlace
              ? { lat: newestPlace[0], lng: newestPlace[1], ref: calloutRef }
              : undefined
          }
        />
        {newest && newestPlace ? (
          <div
            ref={calloutRef}
            className="group/callout pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-300 motion-reduce:transition-none"
          >
            <NewestOrderCallout order={newest} data={data} />
          </div>
        ) : null}
      </div>

      <Header>
        <span className="text-[12px] text-[#71717a]">
          Updated {formatTime(data.as_of, data.timezone)} · {data.timezone}
        </span>
        {data.filling ? (
          <span className="max-w-sm text-[12px] text-[#52525b] dark:text-[#a1a1aa]">
            Analytics is being filled for the first time; today's numbers appear
            once it finishes.
          </span>
        ) : null}
      </Header>

      <Glass
        className="flex w-fit flex-wrap gap-y-3 py-3.5 lg:absolute lg:left-10 lg:top-28"
        data-tour-anchor="live.cards"
      >
        <Stat label="Sales today">{money(data.today.sales)}</Stat>
        <Stat label="Orders today">{formatNumber(data.today.orders)}</Stat>
        <Stat label="Active carts" dot={activeCartsDot}>
          {formatNumber(data.carts.active)}
        </Stat>
        <Stat label="Checking out" dot={checkingOutDot}>
          {formatNumber(data.carts.checking_out)}
        </Stat>
      </Glass>

      <div className="lg:absolute lg:right-10 lg:top-9">
        <HappeningNow data={data} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 lg:contents">
        <div className="flex items-center gap-x-1.5 text-[12px] lg:absolute lg:bottom-9 lg:left-10">
          <span className="text-[#71717a]">
            Totals, locations and products live on your dashboard.
          </span>
          <Link
            to={DASHBOARD_HREF}
            className="flex items-center gap-x-0.5 font-medium text-[#2563eb] dark:text-[#60a5fa] hover:underline"
          >
            Open dashboard
            <ArrowRightMini />
          </Link>
        </div>
        <div className="lg:absolute lg:bottom-9 lg:right-10">
          <MarkerKey />
        </div>
      </div>
    </Stage>
  )
}

const Bone = ({ className }: { className: string }) => (
  <Skeleton className={`rounded motion-reduce:animate-none ${className}`} />
)

export const LiveViewSkeleton = () => (
  <div role="status" aria-busy="true" aria-label="Loading the live view">
    <Stage>
      <div className={GLOBE_BOX}>
        <img
          alt=""
          src={halo}
          className="pointer-events-none absolute -inset-[18%] -z-10 size-[136%] max-w-none opacity-60 dark:opacity-100"
        />
        <Bone className="absolute inset-[10%] rounded-full" />
      </div>
      <Header>
        <Bone className="h-3 w-52" />
      </Header>
      <Glass className="flex w-fit py-3.5 lg:absolute lg:left-10 lg:top-28">
        {["Sales today", "Orders today", "Active carts", "Checking out"].map(
          (label) => (
            <Stat key={label} label={label}>
              <Bone className="mt-1.5 h-6 w-16" />
            </Stat>
          )
        )}
      </Glass>
      <div className="lg:absolute lg:right-10 lg:top-9">
        <Glass className="flex flex-col gap-y-4 p-5 lg:w-[340px]">
          <div className="flex flex-col gap-y-0.5">
            <span className="text-[13px] font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Happening now
            </span>
            <span className="text-[12px] text-[#71717a]">
              Orders as they come in
            </span>
          </div>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-x-3"
            >
              <Bone className="h-3 w-40" />
              <Bone className="h-3 w-10" />
            </div>
          ))}
        </Glass>
      </div>
    </Stage>
  </div>
)
