import { type JSX, splitProps } from "solid-js"
import { cn } from "./utils"

export interface SidebarProps extends JSX.HTMLAttributes<HTMLElement> {
    collapsed?: boolean
    onCollapse?: () => void
}

export const Sidebar = (props: SidebarProps) => {
    const [split, rest] = splitProps(props, ["class", "children", "collapsed", "onCollapse"])

    return (
        <aside
            className={cn(
                "flex h-full shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
                split.collapsed ? "w-16" : "w-72",
                split.class
            )}
            {...rest}
        >
            {split.children}
        </aside>
    )
}
