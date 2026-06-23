import { useState } from "react";
import { signIn, signUp } from "../lib/auth";

export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await signIn(email, password);
        onSuccess(data.session);
      } else {
        await signUp(email, password);
        setMessage("Account created. Check your email to confirm before signing in.");
        setMode("login");
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>FEMO Stats</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
        {mode === "login" ? "Sign in to your account" : "Create your account"}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}
        {message && <p style={{ color: "#27632a", fontSize: 13, margin: 0 }}>{message}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Loading..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setMessage(null); }}
        style={{ marginTop: 16, fontSize: 13, color: "#555", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
      >
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

function translateError(msg) {
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("User already registered")) return "An account with this email already exists.";
  if (msg.includes("Password should be")) return "Password must be at least 6 characters.";
  return msg;
}

const inputStyle = { padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 8 };
const buttonStyle = { padding: "10px 12px", fontSize: 14, fontWeight: 500, border: "none", borderRadius: 8, background: "#1a1a1a", color: "#fff", cursor: "pointer" };
