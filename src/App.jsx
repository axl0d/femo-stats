import { useState, useEffect } from "react";
import { getSession, onAuthChange } from "./lib/auth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(setSession).finally(() => setLoading(false));
    return onAuthChange(setSession);
  }, []);

  if (loading) return <p style={{ textAlign: "center", marginTop: "4rem", color: "#666" }}>Loading…</p>;
  return session ? <Dashboard session={session} /> : <Login onSuccess={setSession} />;
}
