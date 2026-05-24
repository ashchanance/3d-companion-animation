import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Send, Mic, ArrowLeft, Camera, Settings, Video, Cpu, Volume2, Workflow, Key, X } from "lucide-react";
// import { VRMAvatar } from "../components/VRMAvatar";
// import { setAvatarAction, AvatarAction } from "../vrm-avatar";

type Language = "ja" | "en";

const VOICE_IDS: Record<Language, string> = {
  ja: "8kgj5469z1URcH4MB2G4",
  en: "WtA85syCrJwasGeHGH2p",
};

const SYSTEM_PROMPTS: Record<Language, string> = {
  ja: "あなたはKira（キラ）という優雅で有能なバーチャルアシスタントです。穏やかで優しく、洗練された性格です。必ず日本語のみで返答してください。返答は簡潔で親しみやすくしてください。",
  en: "You are Kira, an elegant, graceful, and highly capable virtual assistant. Your persona is calm, sweet, helpful, and sophisticated. Keep your responses concise and engaging.",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
}

export default function Chat() {
  const [language, setLanguage] = useState<Language>("ja");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      sender: "ai",
      text: "こんにちは！キラです。あなたのエレガントなデジタルコンパニオン。今日はどのようにお手伝いできますか？",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  
  const [apiKeys, setApiKeys] = useState({
    llm: '',
    speech: '',
    stt: ''
  });

  const handleSaveSettings = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
        setIsSettingsOpen(false);
      }, 1500);
    }, 2000);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const speakText = async (text: string, lang: Language) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn("ElevenLabs API Key is missing in environment variables.");
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const voiceId = VOICE_IDS[lang];
    setIsSpeaking(true);
    // setAvatarAction("speak");

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs TTS error: ${response.status} ${errText}`);
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) {
        throw new Error("ElevenLabs returned empty audio payload.");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        // setAvatarAction("idle");
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        // setAvatarAction("idle");
        audioRef.current = null;
      };

      try {
        await audio.play();
      } catch (playErr) {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        throw new Error(`Audio playback failed: ${String(playErr)}`);
      }
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
      // setAvatarAction("idle");
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    // Stop speaking if language changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
      // setAvatarAction("idle");
    }
    const greeting =
      lang === "ja"
        ? "こんにちは！ルミです。日本語でお話しましょう！"
        : "Hello! I'm Kira. Let's chat in English!";
    setMessages([{ id: Date.now().toString(), sender: "ai", text: greeting }]);
  };

  const handleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === "ja" ? "ja-JP" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      setIsListening(false);
      setInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_LLM_API_KEY;
      const apiUrl = import.meta.env.VITE_LLM_API_URL || "https://openrouter.ai/api/v1";
      const modelId = import.meta.env.VITE_LLM_MODEL_ID || "openai/gpt-3.5-turbo";

      if (!apiKey) {
        throw new Error("LLM API Key is missing in environment variables.");
      }

      const messagesForAPI = messages.map((m) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.text,
      }));

      messagesForAPI.unshift({
        role: "system",
        content: SYSTEM_PROMPTS[language],
      });

      messagesForAPI.push({ role: "user", content: text });

      const requestBody = JSON.stringify({
        model: modelId,
        messages: messagesForAPI,
        max_tokens: 300,
        temperature: 0.7,
      });

      const sendWithRetry = async (attempt: number): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 20000);

        try {
          const response = await fetch(`${apiUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal: controller.signal,
          });
          return response;
        } catch (error) {
          const isTransient =
            error instanceof TypeError ||
            (error instanceof Error && /failed to fetch|network|abort/i.test(error.message));

          if (isTransient && attempt < 2) {
            await wait(600 * (attempt + 1));
            return sendWithRetry(attempt + 1);
          }
          throw error;
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      const response = await sendWithRetry(0);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const answer =
        data.choices[0]?.message?.content ||
        data.choices[0]?.message?.reasoning_content ||
        "...";

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: answer,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Speak the response with ElevenLabs TTS
      speakText(answer, language);
    } catch (err) {
      console.error("LLM error:", err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text:
          language === "ja"
            ? "申し訳ありません。環境変数を確認してください。"
            : "I'm sorry, I'm having trouble connecting to my neural network. Please check your environment variables.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      // setAvatarAction("idle");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
  };



  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary-100 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-blue-50 rounded-full blur-[100px] opacity-60" />
      </div>

      {/* Chat Side */}
      <div className="flex-1 flex flex-col relative z-10 lg:pl-8 pt-6 pb-6 min-w-0">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 pb-4 cursor-default">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-500 hover:text-primary-600 transition-colors font-medium"
          >
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <div className="flex flex-row items-center justify-center gap-4">
            <Link
              to="/video-chat"
              className="flex items-center gap-2 bg-gradient-to-r from-[#9d9d9d] to-slate-400 text-white px-4 py-1.5 rounded-full shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              <Video size={16} />
              <span className="text-sm font-semibold">Video Chat</span>
            </Link>
            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-slate-700">Online</span>
            </div>
          </div>
        </nav>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto bg-white/70 backdrop-blur-xl border border-white shadow-2xl rounded-3xl overflow-hidden mt-4">
          <div className="p-6 border-b border-primary-50/50 bg-white/50 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center justify-center gap-3 mb-4">
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Kira <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">キラ</span>
              </h2>
              <p className="text-slate-500 text-sm">
                Your private AI companion is ready.
              </p>
              
              {/* Feature Badges (UI Only) */}
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/50 border border-blue-100/60 shadow-sm backdrop-blur-sm group cursor-default transition-all hover:bg-blue-50">
                  <Cpu size={12} className="text-blue-500 group-hover:text-blue-600 transition-colors" />
                  <span className="text-[10px] font-semibold text-blue-600/90 tracking-wide uppercase">Custom LLM</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />
                </div>
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/50 border border-emerald-100/60 shadow-sm backdrop-blur-sm group cursor-default transition-all hover:bg-emerald-50">
                  <Volume2 size={12} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                  <span className="text-[10px] font-semibold text-emerald-600/90 tracking-wide uppercase">Custom API Speaks</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                </div>
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50/50 border border-violet-100/60 shadow-sm backdrop-blur-sm group cursor-default transition-all hover:bg-violet-50">
                  <Workflow size={12} className="text-violet-500 group-hover:text-violet-600 transition-colors" />
                  <span className="text-[10px] font-semibold text-violet-600/90 tracking-wide uppercase">Sound to Text</span>
                  <div className="flex gap-[2px] items-center ml-0.5 h-1.5 w-max">
                    <span className="w-0.5 h-[60%] bg-violet-400 animate-[bounce_1s_infinite_100ms] rounded-full" />
                    <span className="w-0.5 h-full bg-violet-400 animate-[bounce_1s_infinite_300ms] rounded-full" />
                    <span className="w-0.5 h-[40%] bg-violet-400 animate-[bounce_1s_infinite_500ms] rounded-full" />
                  </div>
                </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="mt-3 flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700 transition-all text-white shadow-md hover:bg-slate-800 hover:-translate-y-0.5 relative z-10"
              >
                <Settings size={14} className="text-slate-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">Configure API Keys</span>
              </button>
            </div>
            </div>

            {/* Language Toggle */}
            <div className="inline-flex items-center bg-slate-100 rounded-2xl p-1 gap-1 relative z-10">
              <button
                onClick={() => handleLanguageChange("ja")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${language === "ja"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <span>🇯🇵</span> 日本語
              </button>
              <button
                onClick={() => handleLanguageChange("en")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${language === "en"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <span>🇬🇧</span> English
              </button>
            </div>
            {isSpeaking && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-primary-500 font-medium">
                <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
                {language === "ja" ? "話しています..." : "Speaking..."}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
            
            {/* API Keys Modal Overlay */}
            {isSettingsOpen && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4">
                <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-slate-800">
                      <div className="p-1.5 bg-white shadow-sm rounded-lg border border-slate-100">
                         <Key size={16} className="text-slate-600" />
                      </div>
                      <h3 className="font-bold text-lg">API Settings</h3>
                    </div>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="px-6 py-6 space-y-5">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <Cpu size={14} className="text-blue-500" /> Custom LLM Key
                      </label>
                      <input 
                        type="password"
                        placeholder="sk-..."
                        value={apiKeys.llm}
                        onChange={(e) => setApiKeys({...apiKeys, llm: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-mono"
                      />
                      <p className="text-[10px] text-slate-400 italic">Note: These inputs are simulation. System uses environment variables for security.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <Volume2 size={14} className="text-emerald-500" /> Custom API Speaks
                      </label>
                      <input 
                        type="password"
                        placeholder="Enter TTS API Key..."
                        value={apiKeys.speech}
                        onChange={(e) => setApiKeys({...apiKeys, speech: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <Workflow size={14} className="text-violet-500" /> Sound to Text API
                      </label>
                      <input 
                        type="password"
                        placeholder="Enter STT API Key..."
                        value={apiKeys.stt}
                        onChange={(e) => setApiKeys({...apiKeys, stt: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <button 
                      onClick={handleSaveSettings}
                      disabled={isSaving || saveStatus === 'success'}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        saveStatus === 'success' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 shadow-lg shadow-slate-900/20 active:scale-[0.98]'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : saveStatus === 'success' ? (
                        <>
                          Success!
                        </>
                      ) : (
                        'Save Integrations'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${m.sender === "user" ? "flex-row-reverse justify-end" : "flex-row"} items-end`}
              >
                {m.sender === "ai" && (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden bg-primary-50 text-primary-600">
                    <video src="/M3.mp4" autoPlay muted loop className="w-full h-full object-cover object-center" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] p-4 text-[0.95rem] leading-relaxed shadow-sm ${m.sender === "ai"
                    ? "bg-white text-slate-700 rounded-3xl rounded-bl-sm border border-slate-100"
                    : "bg-primary-600 text-white rounded-3xl rounded-br-sm"
                    }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4 items-end"
              >
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                  <video src="/M4.mp4" autoPlay muted loop className="w-full h-full object-cover object-center" />
                </div>
                <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-sm border border-slate-100 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-primary-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-primary-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-primary-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white/80 border-t border-slate-100/50">
            {/* Icon Toolbar */}
            <div className="flex gap-3 mb-3 pb-3 border-b border-slate-100/50 justify-center">
              {/* Camera Icon */}
              <div className="flex flex-col items-center gap-0.5 group cursor-not-allowed">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  disabled
                  className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-500 transition-all group-hover:bg-blue-50"
                >
                  <Camera size={16} />
                </motion.button>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                  Coming Soon
                </span>
              </div>

              {/* Settings Icon */}
              <div className="flex flex-col items-center gap-0.5 group cursor-not-allowed">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  disabled
                  className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-500 transition-all group-hover:bg-blue-50"
                >
                  <Settings size={16} />
                </motion.button>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                  Coming Soon
                </span>
              </div>

              {/* Mic Icon */}
              <div className="flex flex-col items-center gap-0.5 group">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleMic}
                  className={`p-2 rounded-xl transition-all ${isListening
                      ? "text-red-500 bg-red-50 animate-pulse"
                      : "text-slate-400 hover:text-primary-500 hover:bg-primary-50"
                    }`}
                  title={isListening ? (language === "ja" ? "録音停止" : "Stop recording") : (language === "ja" ? "音声入力" : "Voice input")}
                >
                  <Mic size={16} />
                </motion.button>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                  {isListening ? (language === "ja" ? "録音中..." : "Recording...") : (language === "ja" ? "マイク" : "Mic")}
                </span>
              </div>
            </div>

            {/* Message Input */}
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 max-h-32 min-h-[52px] bg-slate-50 border-0 focus:outline-none focus:ring-2 focus:ring-primary-200 rounded-2xl px-5 py-3.5 text-slate-700 placeholder:text-slate-400 resize-none"
                placeholder={language === "ja" ? "キラにメッセージを送る..." : "Message Kira..."}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-3.5 bg-primary-600 text-white rounded-2xl hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <Send size={20} className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Panel replaced with Video */}
      <div className="hidden lg:flex w-[450px] shrink-0 flex-col items-center justify-start relative border-l border-white/50 bg-white/30 backdrop-blur-sm z-20">
        {/* Video Avatar */}
        <div className="relative w-full h-[600px] mt-12 flex items-center justify-center overflow-hidden rounded-3xl -translate-x-20">
          <video
            src="/M3.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover object-center scale-[1.1]"
          />
        </div>

        {/* Name card */}
        <div className="bg-white/70 backdrop-blur shadow-sm border border-white/50 px-8 py-4 rounded-3xl text-center w-[320px] -mt-16 z-[40] relative -translate-x-20">
          <h3 className="font-serif font-bold text-2xl text-slate-900 mb-1">
            KIRA キラ
          </h3>
        </div>

        {/* Incoming Avatars */}
        <div className="w-[280px] mt-6 bg-white/40 backdrop-blur border border-white/60 shadow-sm rounded-3xl p-5 z-[40] relative -translate-x-20">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
            <h4 className="font-serif text-xs font-bold text-slate-700 uppercase tracking-widest">Incoming Avatars</h4>
          </div>
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center gap-1.5 group cursor-not-allowed">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 shadow-sm relative transition-all group-hover:border-pink-400 group-hover:shadow-pink-200">
                <video src="/M3.mp4" autoPlay muted loop className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
              </div>
              <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider group-hover:text-pink-500 transition-colors">Kira</span>
              <span className="text-[7px] text-pink-400 font-medium">Energetic Star</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 group cursor-not-allowed">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-200 shadow-sm relative transition-all group-hover:border-purple-400 group-hover:shadow-purple-200">
                <video src="/M2.mp4" autoPlay muted loop className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
              </div>
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider group-hover:text-purple-500 transition-colors">Nova</span>
              <span className="text-[7px] text-purple-400 font-medium">Mysterious Observer</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 group cursor-not-allowed">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-sky-200 shadow-sm relative transition-all group-hover:border-sky-400 group-hover:shadow-sky-200">
                <video src="/M1.mp4" autoPlay muted loop className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
              </div>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider group-hover:text-sky-500 transition-colors">Airi</span>
              <span className="text-[7px] text-sky-400 font-medium">Elegant Companion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
