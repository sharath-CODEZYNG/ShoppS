import { Navigate } from "react-router-dom"

export default function AdminRoute({ children }) {
  const raw = localStorage.getItem("user")

  if (!raw) return <Navigate to="/" replace />

  try {
    const user = JSON.parse(raw)

    if (user?.role === "admin") {
      return children
    }

  } catch (err) {
    console.error("Invalid currentUser in storage", err)
  }

  return <Navigate to="/" replace />
}
