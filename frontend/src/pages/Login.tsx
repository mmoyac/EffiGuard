import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi, getMediaUrl } from "../services/api";
import { useAuthStore } from "../stores/authStore";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  // Logo del tenant de la sesión anterior (guardado en localStorage al hacer login)
  const savedLogoUrl = getMediaUrl(localStorage.getItem("tenant_logo_url"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await authApi.login(email, password);
      setTokens(data.access_token, data.refresh_token);
      const { data: user } = await authApi.me();
      setUser(user);
      navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Email o contraseña incorrectos");
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 shadow-2xl">
        {savedLogoUrl
          ? <img src={savedLogoUrl} alt="Logo" className="h-14 max-w-[200px] object-contain mb-2" />
          : <h1 className="text-3xl font-bold text-blue-400 mb-2">EffiGuard</h1>}
        <p className="text-gray-400 mb-8 text-sm">Control de activos y bodega</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none"
            required
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 min-h-[48px] border border-gray-600 focus:border-blue-500 focus:outline-none pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-3 min-h-[48px] transition-colors"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
