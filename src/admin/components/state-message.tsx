import { Container, Text, clx } from "@medusajs/ui"
import type { ReactNode } from "react"

type Props = {
  title?: string
  children: ReactNode
  framed?: boolean
  className?: string
}

export const StateMessage = ({ title, children, framed, className }: Props) => {
  const body = title ? (
    <>
      <Text weight="plus">{title}</Text>
      <Text size="small" className="text-ui-fg-subtle">
        {children}
      </Text>
    </>
  ) : (
    <Text size="small" className="text-ui-fg-muted">
      {children}
    </Text>
  )
  const classes = clx("flex flex-col gap-y-2 px-6 py-10", className)

  return framed ? (
    <Container className={classes}>{body}</Container>
  ) : (
    <div className={classes}>{body}</div>
  )
}
