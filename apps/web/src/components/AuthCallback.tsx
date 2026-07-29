import { useNavigate, useSearchParams } from "@solidjs/router"
import { Loader } from "lucide-solid"
import { onMount } from "solid-js"
import { useAuthStore } from "../store/authStore"
import { toast } from "./Toast"

const delay = (ms: number) =>
    new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })

function AuthCallback() {
    const navigate = useNavigate()
    const { isAuthenticated, refreshSession } = useAuthStore()
    const [searchParams] = useSearchParams()

    onMount(() => {
        const handleCallback = async () => {
            if (searchParams["error"]) {
                toast.error(`Authentication failed: ${searchParams["error"]}`)
                navigate("/login")
                return
            }

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const sessionResolved = await refreshSession()

                if (sessionResolved && isAuthenticated()) {
                    toast.success("Authentication successful")
                    navigate("/dashboard")
                    return
                }

                if (attempt < 2) {
                    await delay(400)
                }
            }

            toast.error("Unable to complete authentication")
            navigate("/login")
        }

        void handleCallback()
    })

    return (
        <div class="flex min-h-screen items-center justify-center bg-background">
            <div class="text-center">
                <Loader class="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
                <p class="font-medium text-foreground">Completing authentication...</p>
            </div>
        </div>
    )
}

export default AuthCallback
