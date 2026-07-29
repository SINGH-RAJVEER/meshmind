import "solid-js"

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            className?: string
        }

        interface SVGAttributes<T> {
            className?: string
        }

        interface SvgSVGAttributes<T> {
            className?: string
        }

        interface InputHTMLAttributes<T> {
            autoComplete?: string
            autoFocus?: boolean
        }
    }
}

declare module "lucide-solid" {
    interface LucideProps {
        className?: string
    }
}
