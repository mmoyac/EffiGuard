import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";

const WEBHOOK_URL = "https://n8n.masasestacion.cl/webhook/9dd3e269-578f-42e9-a896-cd70d53d9413/chat";

// sessionId fijo por pestaña — mantiene historial de conversación en n8n
const SESSION_ID = `effiguard-${Math.random().toString(36).slice(2)}`;

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hola, soy el asistente de bodega. ¿En qué te puedo ayudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", chatInput: text, sessionId: SESSION_ID }),
      });
      const data = await res.json();
      const reply = data?.output ?? data?.message ?? "Sin respuesta del agente.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Error al contactar al agente. Intenta nuevamente." }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 flex flex-col bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "70vh" }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-700">
            <Bot size={18} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">Asistente de Bodega</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  m.role === "user" ? "bg-blue-600" : "bg-gray-700"}`}>
                  {m.role === "user" ? <User size={13} /> : <Bot size={13} className="text-blue-400" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-gray-700 text-gray-100 rounded-tl-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-blue-400" />
                </div>
                <div className="bg-gray-700 rounded-2xl rounded-tl-sm px-3 py-2">
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-700 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escribe tu consulta..."
              disabled={loading}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
