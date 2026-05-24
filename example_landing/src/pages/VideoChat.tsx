import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, ArrowLeft, Mic, Cpu, Volume2, Workflow, Settings, X, Key, Languages, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

type Language = 'ja' | 'en';

const VOICE_IDS = {
  ja: '8kgj5469z1URcH4MB2G4',
  en: 'WtA85syCrJwasGeHGH2p',
};

const SYSTEM_PROMPTS = {
  ja: 'あなたはKira（キラ）という名前の親しみやすく、共感的で、魅力的なAIコンパニオンです。ユーザーと親密で、自然で、心地よい会話を楽しみます。あなたの話し方は常に優しく、思いやりに溢れており、ユーザーを元気づけたり、リラックスさせたりすることを目指します。返答は簡潔すぎず、長すぎず、自然な会話の流れを大切にしてください。',
  en: 'You are Kira, a friendly, empathetic, and engaging AI companion. You enjoy intimate, natural, and enjoyable conversations with your user. Your tone is always kind and full of care, aiming to uplift or relax the user. Keep your responses naturally paced, neither too short nor too long, maintaining a smooth conversational flow.',
};

export default function VideoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'こんにちは！キラです。今日はお話しできて嬉しいです。',
    }
  ]);
  const [input, setInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [language, setLanguage] = useState<Language>('ja');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    stopSpeaking();
    const greeting = lang === 'ja' ? 'こんにちは！キラです。今日はお話しできて嬉しいです。' : 'Hello! I am Kira. I am so happy to chat with you today.';
    setMessages([{ id: Date.now().toString(), sender: 'ai', text: greeting }]);
  };

  const speakText = async (text: string, lang: Language) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('ElevenLabs API Key is missing in environment variables.');
      return;
    }

    stopSpeaking();

    const voiceId = VOICE_IDS[lang];
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            output_format: 'mp3_44100_128',
          }),
        }
      );

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const handleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === 'ja' ? 'ja-JP' : 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_LLM_API_KEY;
      const apiUrl = import.meta.env.VITE_LLM_API_URL || 'https://openrouter.ai/api/v1';
      const modelId = import.meta.env.VITE_LLM_MODEL_ID || 'openai/gpt-3.5-turbo';

      if (!apiKey) {
        throw new Error('LLM API Key is missing in environment variables.');
      }

      const messagesForAPI = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));

      messagesForAPI.unshift({ role: 'system', content: SYSTEM_PROMPTS[language] });
      messagesForAPI.push({ role: 'user', content: text });

      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: messagesForAPI,
          max_tokens: 300,
        })
      });

      if (!response.ok) throw new Error('LLM Error');
      const data = await response.json();
      const answer = data.choices[0]?.message?.content || '...';

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: answer,
      };
      setMessages(prev => [...prev, aiMsg]);
      speakText(answer, language);
    } catch (err) {
      console.error('Send error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: language === 'ja' ? '接続エラーが発生しました。環境変数を確認してください。' : 'Connection error. Please check your environment variables.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    sendMessage(input);
  };

  return (
    <div className="min-h-screen bg-[#9d9d9d] flex flex-col md:flex-row overflow-hidden relative">
      
      {/* Navigation - Absolute or Fixed */}
      <nav className="absolute top-0 left-0 w-full z-20 flex items-center justify-between p-6">
        <Link
          to="/chat"
          className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors font-medium bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>
      </nav>

      {/* Video Side (Background or Left side on Desktop) */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden pointer-events-none select-none">
        <video 
          className="w-full h-full object-cover pointer-events-none select-none"
          src="/M3.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        />
        {/* Overlay gradient for better blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#9d9d9d]/60 to-transparent pointer-events-none md:bg-gradient-to-r select-none" />
      </div>

      {/* Chat Side */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-[#9d9d9d] flex flex-col h-[60vh] md:h-screen shadow-2xl z-20 border-t md:border-t-0 md:border-l border-white/20 pb-4 md:pb-0 relative">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-white/20 bg-white/5 backdrop-blur-md relative">
          
          <div className="flex items-center justify-between mb-3 relative z-30">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1 pointer-events-auto relative z-40">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLanguageChange('ja');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all relative z-50 cursor-pointer ${language === 'ja' ? 'bg-white/30 border-white/60 text-white shadow-lg' : 'bg-black/20 border-white/10 text-white/40 hover:bg-white/10'}`}
                >
                  <span className="text-[10px] font-bold pointer-events-none">🇯🇵 日本語</span>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLanguageChange('en');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all relative z-50 cursor-pointer ${language === 'en' ? 'bg-white/30 border-white/60 text-white shadow-lg' : 'bg-black/20 border-white/10 text-white/40 hover:bg-white/10'}`}
                >
                  <span className="text-[10px] font-bold pointer-events-none">🇬🇧 English</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm shadow-inner truncate overflow-hidden">
                  <img src="/Janna/Texture/Face_00.png" alt="Avatar" className="w-full h-full object-cover opacity-80" onError={(e) => { e.currentTarget.style.display='none' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg drop-shadow-md">Kira</h3>
                  <p className="text-white/70 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Online
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5 opacity-80">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/20 border border-white/10 shadow-sm backdrop-blur-md">
                <Cpu size={10} className="text-blue-300" />
                <span className="text-[9px] font-medium text-white/90 tracking-wide uppercase">Custom LLM</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/20 border border-white/10 shadow-sm backdrop-blur-md">
                <Volume2 size={10} className="text-emerald-300" />
                <span className="text-[9px] font-medium text-white/90 tracking-wide uppercase">Custom API Speaks</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/20 border border-white/10 shadow-sm backdrop-blur-md">
                <Workflow size={10} className="text-violet-300" />
                <span className="text-[9px] font-medium text-white/90 tracking-wide uppercase">Sound to Text</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="mt-1 flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-white shadow-sm"
              >
                <Settings size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">API Keys</span>
              </button>
            </div>
          </div>
          
        </div>

        {/* API Keys Modal */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-[#8a8a8a] border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/10">
                 <div className="flex items-center gap-2 text-white">
                   <Key size={16} />
                   <h3 className="font-bold">API Integrations</h3>
                 </div>
                 <button onClick={() => setIsSettingsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                   <X size={18} />
                 </button>
               </div>
               
               <div className="p-5 space-y-4">
                 <div className="space-y-1.5">
                   <label className="flex items-center gap-1.5 text-xs font-semibold text-white/80 uppercase tracking-widest">
                     <Cpu size={12} className="text-blue-300" /> Custom LLM Key
                   </label>
                   <input 
                     type="password"
                     placeholder="sk-..."
                     value={apiKeys.llm}
                     onChange={(e) => setApiKeys({...apiKeys, llm: e.target.value})}
                     className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:bg-black/30 transition-all"
                   />
                   <p className="text-[10px] text-white/40 italic">Note: These inputs are simulation. System uses environment variables for security.</p>
                 </div>
                 
                 <div className="space-y-1.5">
                   <label className="flex items-center gap-1.5 text-xs font-semibold text-white/80 uppercase tracking-widest">
                     <Volume2 size={12} className="text-emerald-300" /> Custom API Speaks
                   </label>
                   <input 
                     type="password"
                     placeholder="Enter TTS API Key..."
                     value={apiKeys.speech}
                     onChange={(e) => setApiKeys({...apiKeys, speech: e.target.value})}
                     className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:bg-black/30 transition-all"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="flex items-center gap-1.5 text-xs font-semibold text-white/80 uppercase tracking-widest">
                     <Workflow size={12} className="text-violet-300" /> Sound to Text API
                   </label>
                   <input 
                     type="password"
                     placeholder="Enter STT API Key..."
                     value={apiKeys.stt}
                     onChange={(e) => setApiKeys({...apiKeys, stt: e.target.value})}
                     className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:bg-black/30 transition-all"
                   />
                 </div>
               </div>

               <div className="px-5 py-4 border-t border-white/10 bg-black/10 flex justify-end">
                 <button 
                   onClick={handleSaveSettings}
                   disabled={isSaving || saveStatus === 'success'}
                   className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                     saveStatus === 'success' 
                       ? 'bg-green-500 text-white' 
                       : 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg active:scale-95'
                   }`}
                 >
                   {isSaving ? (
                     <>
                       <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                       Saving...
                     </>
                   ) : saveStatus === 'success' ? (
                     <>
                       Success!
                     </>
                   ) : (
                     'Save Configuration'
                   )}
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4 invisible-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-white text-slate-800 rounded-tr-sm font-medium'
                    : 'bg-black/20 text-white rounded-tl-sm backdrop-blur-md border border-white/10'
                }`}
              >
                <p className="text-[15px] leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-black/20 text-white rounded-2xl rounded-tl-sm px-5 py-3 backdrop-blur-md border border-white/10">
                <Loader2 size={18} className="animate-spin opacity-60" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 pb-6 pt-2">
          <div className="bg-white/10 p-1.5 rounded-2xl flex items-end gap-2 shadow-lg backdrop-blur-md border border-white/20">
            <button 
              onClick={handleMic}
              className={`p-3 transition-colors flex-shrink-0 bg-transparent rounded-xl hover:bg-white/10 ${isListening ? 'text-red-400 animate-pulse' : 'text-white hover:text-white/80'}`}
            >
              <Mic size={20} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={language === 'ja' ? 'メッセージを入力...' : 'Type a message...'}
              className="flex-1 max-h-32 min-h-12 bg-transparent text-white placeholder:text-white/60 resize-none outline-none py-3 px-2 focus:ring-0 text-[15px]"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="p-3 bg-white text-[#9d9d9d] rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
            >
              <Send size={20} className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
