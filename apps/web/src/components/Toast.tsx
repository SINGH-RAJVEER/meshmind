import { createSignal, For, type Setter } from "solid-js"

interface Toast {
    id: string
    message: string
    type: "success" | "error" | "info" | "warning"
}

let toastId = 0

export const toastContext = {
    toasts: [] as Toast[],
    setToasts: ((_t: Toast[]) => {}) as Setter<Toast[]>,
}

const Toast = () => {
    const [toasts, setToasts] = createSignal<Toast[]>([])

    toastContext.setToasts = setToasts
    toastContext.toasts = toasts()

    return (
        <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
            <For each={toasts()}>
                {(toast) => (
                    <div
                        class={`px-4 py-3 rounded-lg shadow-lg text-white animate-in fade-in slide-in-from-right-4 ${
                            toast.type === "success"
                                ? "bg-green-500"
                                : toast.type === "error"
                                  ? "bg-red-500"
                                  : toast.type === "warning"
                                    ? "bg-yellow-500"
                                    : "bg-blue-500"
                        }`}
                    >
                        {toast.message}
                    </div>
                )}
            </For>
        </div>
    )
}

export const toast = {
    success: (message: string) => {
        const id = `toast-${toastId++}`
        const newToast: Toast = { id, message, type: "success" }
        const currentToasts = toastContext.toasts || []
        toastContext.setToasts([...currentToasts, newToast])

        setTimeout(() => {
            toastContext.setToasts((t) => t.filter((x) => x.id !== id))
        }, 3000)
    },
    error: (message: string) => {
        const id = `toast-${toastId++}`
        const newToast: Toast = { id, message, type: "error" }
        const currentToasts = toastContext.toasts || []
        toastContext.setToasts([...currentToasts, newToast])

        setTimeout(() => {
            toastContext.setToasts((t) => t.filter((x) => x.id !== id))
        }, 3000)
    },
    warning: (message: string) => {
        const id = `toast-${toastId++}`
        const newToast: Toast = { id, message, type: "warning" }
        const currentToasts = toastContext.toasts || []
        toastContext.setToasts([...currentToasts, newToast])

        setTimeout(() => {
            toastContext.setToasts((t) => t.filter((x) => x.id !== id))
        }, 3000)
    },
    info: (message: string) => {
        const id = `toast-${toastId++}`
        const newToast: Toast = { id, message, type: "info" }
        const currentToasts = toastContext.toasts || []
        toastContext.setToasts([...currentToasts, newToast])

        setTimeout(() => {
            toastContext.setToasts((t) => t.filter((x) => x.id !== id))
        }, 3000)
    },
}

export default Toast
