import { createSignal, type JSX, splitProps } from "solid-js"
import { cn } from "./utils"

export interface TooltipContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
    sideOffset?: number
    side?: "top" | "right" | "bottom" | "left"
}

const TooltipProvider = (props: { children: JSX.Element }) => {
    return <>{props.children}</>
}

export const Tooltip = (props: { children: JSX.Element }) => {
    return <>{props.children}</>
}

const TooltipTrigger = (
    props: JSX.HTMLAttributes<HTMLButtonElement> & { children?: JSX.Element }
) => {
    const [isOpen, setIsOpen] = createSignal(false)
    const [split, rest] = splitProps(props, ["children"])

    return (
        <div class="relative inline-block">
            <button
                {...rest}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            />
            {isOpen() && split.children}
        </div>
    )
}

const TooltipContent = (props: TooltipContentProps & { children?: JSX.Element }) => {
    const [split, rest] = splitProps(props, ["class", "sideOffset", "side", "children"])

    return (
        <div
            className={cn(
                "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 origin-[--radix-tooltip-content-transform-origin]",
                split.class
            )}
            {...rest}
        >
            {split.children}
        </div>
    )
}

export { TooltipTrigger, TooltipContent, TooltipProvider }
