import { type JSX, splitProps } from "solid-js"
import { cn } from "./utils"

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLHRElement> {
    orientation?: "horizontal" | "vertical"
    decorative?: boolean
}

export const Separator = (props: SeparatorProps) => {
    const [split, rest] = splitProps(props, ["class", "orientation", "decorative"])
    const orientation = split.orientation ?? "horizontal"
    const decorative = split.decorative ?? false

    const className = cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        split.class
    )

    return <hr aria-hidden={decorative} className={className} {...rest} />
}
