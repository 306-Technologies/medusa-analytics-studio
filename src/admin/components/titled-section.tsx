import { Container, Text } from "@medusajs/ui"
import type { ReactNode } from "react"

type Props = {
  title: string
  children: ReactNode
  framed?: boolean
}

export const TitledSection = ({ title, children, framed }: Props) =>
  framed ? (
    <Container className="flex flex-col gap-y-2 px-4 py-3">
      <Text size="small" weight="plus" className="text-ui-fg-subtle">
        {title}
      </Text>
      {children}
    </Container>
  ) : (
    <div className="flex flex-col gap-y-2 px-4 py-4">
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
        {title}
      </Text>
      {children}
    </div>
  )
