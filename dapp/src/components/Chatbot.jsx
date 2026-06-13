import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Loader,
  Bot,
  User,
  Sparkles,
  Minimize2,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════ */
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT =
  "You are the AI assistant for CertChain, a Web3 decentralized application (DApp) built on Ethereum for issuing and verifying academic certificates. " +
  "CertChain allows authorized admin wallets to issue tamper-proof certificates stored as cryptographic hashes on the Ethereum blockchain. " +
  "Anyone can verify a certificate instantly by entering its ID. " +
  "Keep your answers concise, helpful, and well-formatted. Use bullet points and short paragraphs where appropriate. " +
  "If the user asks something unrelated to CertChain or blockchain, gently redirect them.";

/* ══════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ══════════════════════════════════════════════════════════ */
const windowVariants = {
  hidden: {
    opacity: 0,
    scale: 0.85,
    y: 24,
    originX: 1,
    originY: 1,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: 20,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const messageVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 28 },
  },
};

const buttonPulse = {
  rest: { scale: 1, boxShadow: "0 0 0px rgba(6,182,212,0)" },
  hover: {
    scale: 1.1,
    boxShadow:
      "0 0 28px rgba(6,182,212,0.55), 0 0 50px rgba(147,51,234,0.3)",
    transition: { type: "spring", stiffness: 400, damping: 20 },
  },
  tap: { scale: 0.93 },
};

/* ══════════════════════════════════════════════════════════
   TYPING INDICATOR
   ══════════════════════════════════════════════════════════ */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SINGLE MESSAGE BUBBLE
   ══════════════════════════════════════════════════════════ */
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs
          ${
            isUser
              ? "bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_0_12px_rgba(147,51,234,0.4)]"
              : "bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
          }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
          ${
            isUser
              ? "bg-gradient-to-br from-purple-600/80 to-purple-700/70 text-white rounded-br-sm border border-purple-500/30"
              : "bg-white/[0.07] backdrop-blur-sm text-slate-200 rounded-bl-sm border border-white/[0.08]"
          }`}
      >
        {msg.text}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN CHATBOT COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "bot",
      text: "👋 Hi! I'm the CertChain AI assistant.\n\nAsk me anything about issuing or verifying blockchain certificates!",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatHistoryRef = useRef([]); // tracks full Gemini conversation turns

  /* ── Auto-scroll to latest message ── */
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  /* ── Focus input when chat opens ── */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  /* ── Call Gemini REST API ── */
  const callGemini = useCallback(async (userText) => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    if (!apiKey) {
      return "⚠️ Gemini API key is not configured. Please set REACT_APP_GEMINI_API_KEY in your .env file.";
    }

    // Append user turn to conversation history
    chatHistoryRef.current.push({
      role: "user",
      parts: [{ text: userText }],
    });

    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: chatHistoryRef.current,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.9,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody?.error?.message || `HTTP ${response.status} — Gemini API error`
      );
    }

    const data = await response.json();
    const botText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "I couldn't generate a response. Please try again.";

    // Append bot turn to conversation history
    chatHistoryRef.current.push({
      role: "model",
      parts: [{ text: botText }],
    });

    return botText;
  }, []);

  /* ── Send a message ── */
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const botText = await callGemini(text);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: botText,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Gemini API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          text: `❌ Error: ${err.message || "Could not reach Gemini API. Check your network and API key."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, callGemini]);

  /* ── Enter key to send ── */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-3"
      aria-label="CertChain AI Chatbot"
    >
      {/* ── Chat Window ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            variants={windowVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              w-[calc(100vw-2.5rem)] max-w-sm
              sm:w-96
              h-[520px]
              flex flex-col
              rounded-2xl overflow-hidden
              border border-white/[0.10]
              bg-slate-900/80 backdrop-blur-xl
              shadow-[0_0_60px_rgba(6,182,212,0.12),0_20px_60px_rgba(0,0,0,0.7)]
            "
            role="dialog"
            aria-label="CertChain AI Assistant"
          >
            {/* ── Header ── */}
            <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              {/* Gradient top-bar accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500" />

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_16px_rgba(6,182,212,0.45)]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  {/* Online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    CertChain AI
                  </p>
                  <p className="text-[10px] text-cyan-400 leading-tight tracking-wide">
                    Powered by Gemini
                  </p>
                </div>
              </div>

              <button
                onClick={toggleOpen}
                aria-label="Close chat"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

            {/* ── Messages ── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
              style={{ scrollbarWidth: "thin" }}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Loading indicator */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex items-end gap-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)] flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] rounded-2xl rounded-bl-sm px-4 py-3">
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Bar ── */}
            <div className="px-3 py-3 border-t border-white/[0.08]">
              <div className="flex items-end gap-2 bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.12)] transition-all duration-300">
                <textarea
                  ref={inputRef}
                  id="chatbot-input"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    // Auto-grow textarea (max 3 lines)
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 80) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about CertChain…"
                  rows={1}
                  disabled={isLoading}
                  aria-label="Chat message input"
                  className="
                    flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500
                    resize-none outline-none leading-relaxed
                    disabled:opacity-50
                  "
                  style={{ maxHeight: "80px" }}
                />
                <motion.button
                  id="chatbot-send-btn"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  whileHover={inputValue.trim() && !isLoading ? { scale: 1.1 } : {}}
                  whileTap={inputValue.trim() && !isLoading ? { scale: 0.9 } : {}}
                  aria-label="Send message"
                  className={`
                    flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                    transition-all duration-200 mb-0.5
                    ${
                      inputValue.trim() && !isLoading
                        ? "bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-[0_0_14px_rgba(6,182,212,0.4)] hover:shadow-[0_0_22px_rgba(6,182,212,0.6)]"
                        : "bg-white/5 text-slate-600 cursor-not-allowed"
                    }
                  `}
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
              <p className="text-center text-[10px] text-slate-600 mt-1.5">
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Toggle Button ── */}
      <motion.button
        id="chatbot-toggle-btn"
        onClick={toggleOpen}
        variants={buttonPulse}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        aria-label={isOpen ? "Close AI Chat" : "Open AI Chat"}
        className="
          relative w-14 h-14 rounded-full
          bg-gradient-to-br from-cyan-500 to-purple-600
          text-white
          flex items-center justify-center
          shadow-[0_4px_24px_rgba(6,182,212,0.35),0_0_0_1px_rgba(255,255,255,0.08)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
        "
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <MessageSquare className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Notification ping dot — shown only when closed */}
        <AnimatePresence>
          {!isOpen && (
            <motion.span
              key="ping"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900"
            >
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
