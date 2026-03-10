import { useEffect } from "react"
import { useRouter } from "next/router"

export default function Callback() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return

    const code = router.query.code as string
    const state = router.query.state as string
    const apiUrl = process.env.NEXT_PUBLIC_API_URL_EXCHANGE
    
    if (!code) return
    
    if (!apiUrl) {
      console.error('apiUrl no está definida. Reinicia el servidor.');
      return;
    }
    
    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        state
      })
    })
      .then(res => res.json())
      .then(data => {
        localStorage.setItem("access_token", data.access_token)
        localStorage.setItem("refresh_token", data.refresh_token)


        router.push("/dashboard")
      })
      .catch(error => {
        console.error("Error en el proceso de autenticación:", error)
      })

  }, [router.isReady, router.query])

  return <p>Logging in...</p>
}