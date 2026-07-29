import { A } from "@solidjs/router"
import { Github } from "lucide-solid"
import { createSignal, Show } from "solid-js"
import authAPI from "../api/authApi"
import { useLogin } from "../hooks/useLogin"
import ThemeToggle from "./ThemeToggle"
import { toast } from "./Toast"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Separator } from "./ui/separator"

const GoogleLogo = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.6v2.99h3.87c2.27-2.09 3.57-5.18 3.57-8.62Z"
        />
        <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-2.99c-1.07.72-2.44 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.26v3.09A12 12 0 0 0 12 24Z"
        />
        <path
            fill="#FBBC05"
            d="M5.26 14.29A7.2 7.2 0 0 1 4.88 12c0-.79.14-1.56.38-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.78 1.26 5.38l4-3.09Z"
        />
        <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.2 15.23 0 12 0A12 12 0 0 0 1.26 6.62l4 3.09c.95-2.85 3.61-4.94 6.74-4.94Z"
        />
    </svg>
)

function Login() {
    const [email, setEmail] = createSignal("")
    const [password, setPassword] = createSignal("")
    const [isLoadingOAuth, setIsLoadingOAuth] = createSignal(false)
    const { mutate: loginMutate, isPending } = useLogin()

    const handleLogin = (e: Event) => {
        e.preventDefault()
        loginMutate({ email: email(), password: password() })
    }

    const handleOAuthLogin = async (provider: "google" | "github") => {
        try {
            setIsLoadingOAuth(true)
            await authAPI.signInWithOAuth(provider)
        } catch (_error) {
            toast.error(`Failed to redirect to ${provider}`)
            setIsLoadingOAuth(false)
        }
    }

    const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"]

    if (!GOOGLE_CLIENT_ID) {
        console.warn("VITE_GOOGLE_CLIENT_ID is not set")
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="font-wordmark text-5xl font-semibold tracking-[-0.06em] text-foreground">
                        MeshMind
                    </h1>
                </div>

                {/* Email & Password Form */}
                <form className="space-y-4" onSubmit={handleLogin}>
                    <div className="space-y-3">
                        <Input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="Email address"
                            value={email()}
                            onInput={(e) => setEmail(e.currentTarget.value)}
                            className="rounded-lg"
                        />
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            placeholder="Password"
                            value={password()}
                            onInput={(e) => setPassword(e.currentTarget.value)}
                            className="rounded-lg"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full rounded-lg"
                        disabled={isPending() || isLoadingOAuth()}
                    >
                        {isPending() ? "Signing in..." : "Sign in with email"}
                    </Button>
                </form>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Separator className="flex-1" decorative />
                    <span>Or continue with</span>
                    <Separator className="flex-1" decorative />
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-3">
                    <Show when={GOOGLE_CLIENT_ID}>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-lg flex items-center justify-center gap-2"
                            onClick={() => handleOAuthLogin("google")}
                            disabled={isLoadingOAuth() || isPending()}
                        >
                            <GoogleLogo />
                            <span>Google</span>
                        </Button>
                    </Show>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg flex items-center justify-center gap-2"
                        onClick={() => handleOAuthLogin("github")}
                        disabled={isLoadingOAuth() || isPending()}
                    >
                        <Github className="h-5 w-5" />
                        GitHub
                    </Button>
                </div>

                {/* Sign Up Link */}
                <div className="text-center">
                    <p className="text-muted-foreground">
                        Don't have an account?{" "}
                        <A
                            href="/register"
                            className="font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            Sign up
                        </A>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
