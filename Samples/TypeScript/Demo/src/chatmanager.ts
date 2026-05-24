import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';

export class ChatManager {
  private _form: HTMLFormElement | null = null;
  private _input: HTMLInputElement | null = null;
  private _bubble: HTMLDivElement | null = null;
  private _bubbleText: HTMLSpanElement | null = null;
  private _typingIndicator: HTMLDivElement | null = null;
  private _hideTimeout: number | null = null;
  private _speakingTimeout: number | null = null;
  private _typewriterInterval: number | null = null;
  private _typewriterSpeed: number = 45; // ms per character
  private _activeAudio: HTMLAudioElement | null = null;
  private _activeLang: 'en' | 'jp' = 'en';
  private _micBtn: HTMLButtonElement | null = null;
  private _mediaRecorder: MediaRecorder | null = null;
  private _audioChunks: Blob[] = [];
  private _isRecording: boolean = false;

  constructor() {
    this.initializeUI();
    // Warm up speech synthesis voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  private initializeUI(): void {
    this._form = document.getElementById('chat-form') as HTMLFormElement;
    this._input = document.getElementById('chat-input') as HTMLInputElement;
    this._bubble = document.getElementById('chat-bubble') as HTMLDivElement;
    this._bubbleText = document.getElementById('bubble-text') as HTMLSpanElement;
    this._typingIndicator = document.getElementById('typing-indicator') as HTMLDivElement;

    if (this._form) {
      this._form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    if (this._bubble) {
      this._bubble.addEventListener('click', () => this.hideBubble());
    }

    this._micBtn = document.getElementById('mic-btn') as HTMLButtonElement;
    if (this._micBtn) {
      this._micBtn.addEventListener('click', () => this.toggleRecording());
    }
  }

  public setLanguage(lang: 'en' | 'jp'): void {
    this._activeLang = lang;
    console.log(`[ChatManager] Active language set to: ${lang}`);
  }

  private handleFormSubmit(e: Event): void {
    e.preventDefault();
    if (!this._input || !this._input.value.trim()) return;

    const userMessage = this._input.value.trim();
    this._input.value = '';

    // Cancel active speech and simulation
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._speakingTimeout) {
      clearTimeout(this._speakingTimeout);
      this._speakingTimeout = null;
    }
    this.clearTypewriter();
    this.stopSpeakingSim();

    // Show bubble with typing indicator
    this.showTypingState();

    // Trigger character reaction - thinking/reacting motion and random expression
    this.triggerCharacterAction('thinking');

    // Call MegaLLM API
    this.callMegaLLM(userMessage);
  }

  private showTypingState(): void {
    if (this._bubble && this._bubbleText && this._typingIndicator) {
      this.clearHideTimeout();
      this.clearTypewriter();
      this.stopSpeakingSim();
      this._bubbleText.textContent = '';
      this._bubbleText.classList.add('hidden');
      this._typingIndicator.classList.remove('hidden');
      this._bubble.className = 'cloud-bubble thinking';
      this._bubble.classList.remove('hidden');
    }
  }

  private async callMegaLLM(message: string): Promise<void> {
    const apiKey = (import.meta as any).env.VITE_MEGALLM_API_KEY || '';
    const baseUrl = (import.meta as any).env.VITE_MEGALLM_BASE_URL || 'https://ai.megallm.io/v1';
    const modelName = (import.meta as any).env.VITE_MEGALLM_MODEL || 'openai-gpt-oss-120b';

    const childSystemPrompt = this._activeLang === 'jp'
      ? 'You are a cheerful, incredibly cute, and highly expressive Live2D 3D anime child companion. Speak in an adorable, child-like Japanese manner (using cute baby/child particles like ~dayo, ~desu, ~chan, ~nano, ~mon, etc.). Keep your answer very brief and concise (1-2 sentences only). Always respond in Japanese, regardless of the language of the user message. Crucially, express your exact emotions naturally using matching expressive emojis (like 😊, 😂, 😭, 😱, 😡, 😳, 🥺, 🥰) so the user can feel your cute kid vibe!'
      : 'You are a cheerful, incredibly cute, and highly expressive Live2D 3D anime child companion. Speak in an adorable, child-like English manner (using cute words, soft expressions, etc.). Keep your answer very brief and concise (1-2 sentences only). Always respond in English, regardless of the language of the user message. Crucially, express your exact emotions naturally using matching expressive emojis (like 😊, 😂, 😭, 😱, 😡, 😳, 🥺, 🥰) so the user can feel your cute kid vibe!';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: childSystemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Hello! How can I help you?';

      // Detect emotion based on text response
      const emotion = this.detectEmotion(reply);
      console.log(`[ChatManager] Detected emotion "${emotion}" for reply: "${reply}"`);

      this.displayReply(reply, emotion);
      this.triggerCharacterAction(emotion);

    } catch (error) {
      console.error('MegaLLM API Error:', error);
      this.displayReply('Sorry, it seems my connection is having trouble... Please try again later!', 'sad');
      this.triggerCharacterAction('sad');
    }
  }

  private detectEmotion(text: string): 'joy' | 'sad' | 'angry' | 'surprise' | 'blush' | 'thinking' | 'neutral' {
    const lowerText = text.toLowerCase();

    // 1. Check Emojis & Punctuation first for instant high-confidence sentiment
    if (/[😳🥺👉👈🫣]/.test(lowerText) || lowerText.includes('👉👈') || lowerText.includes('blush')) {
      return 'blush';
    }
    if (/[😱😲😮🤯🧐👀]/.test(lowerText) || lowerText.includes('!?') || (lowerText.includes('?') && lowerText.includes('!')) || lowerText.includes('wow')) {
      return 'surprise';
    }
    if (/[😊🥰😍❤️💖😻🎉✨🎂🤩🎈🌈]/.test(lowerText) || /[😂🤣😄😆😀😃😸🥳]/.test(lowerText) || lowerText.includes('haha') || lowerText.includes('hehe') || lowerText.includes('wkwk') || lowerText.includes('hihi') || lowerText.includes('lol')) {
      return 'joy';
    }
    if (/[😢😭😞😔💔😥🤕🥺]/.test(lowerText) || lowerText.includes('huft') || lowerText.includes('hiks')) {
      return 'sad';
    }
    if (/[😠😡🤬👿💢]/.test(lowerText) || lowerText.includes('heh') || lowerText.includes('benci')) {
      return 'angry';
    }

    // 2. Keyword check (English & Indonesian keywords for double compatibility)
    // Joy / positive
    const joyKeywords = [
      'senang', 'bahagia', 'gembira', 'bagus', 'hebat', 'mantap', 'suka', 'cinta', 
      'terima kasih', 'makasih', 'syukur', 'keren', 'asik', 'seru', 'ya', 'oke', 'yes',
      'happy', 'glad', 'joy', 'great', 'awesome', 'nice', 'like', 'love', 'thanks', 'cool', 'fun', 'excite'
    ];
    if (joyKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'joy';
    }

    // Sad / sorry / regret
    const sadKeywords = [
      'maaf', 'sedih', 'kecewa', 'kasihan', 'buruk', 'gagal', 'salah', 'nangis', 
      'sayang sekali', 'aduh', 'sakit', 'sepi', 'takut', 'kesepian',
      'sorry', 'sad', 'disappointed', 'fail', 'bad', 'crying', 'hurt', 'lonely', 'scared', 'afraid'
    ];
    if (sadKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'sad';
    }

    // Blush / shy / cute
    const blushKeywords = [
      'malu', 'blush', 'imut', 'lucu', 'cantik', 'ganteng', 'manis', 'sayang', 'gemas', 'tersipu',
      'shy', 'blush', 'cute', 'sweet', 'handsome', 'beautiful', 'adorable', 'flatter'
    ];
    if (blushKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'blush';
    }

    // Angry
    const angryKeywords = [
      'marah', 'kesal', 'benci', 'jangan', 'tidak boleh', 'kasar', 'nyebelin', 'sebal',
      'angry', 'mad', 'hate', 'annoyed', 'dislike', 'furious', 'upset'
    ];
    if (angryKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'angry';
    }

    // Surprised
    const surpriseKeywords = [
      'terkejut', 'kaget', 'astaga', 'waduh', 'heboh', 'luar biasa', 'apa benar', 'kok bisa', 'masa sih',
      'surprise', 'shocked', 'wow', 'incredible', 'really', 'unbelievable', 'amazed'
    ];
    if (surpriseKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'surprise';
    }

    return 'neutral';
  }

  private displayReply(text: string, emotion: 'joy' | 'sad' | 'angry' | 'surprise' | 'blush' | 'thinking' | 'neutral'): void {
    if (this._bubble && this._bubbleText && this._typingIndicator) {
      this.clearTypewriter();
      this._typingIndicator.classList.add('hidden');
      
      const chars = Array.from(text);
      let charIndex = 0;
      this._bubbleText.textContent = '';
      this._bubbleText.classList.remove('hidden');

      // Update bubble shadow glow matching emotion
      if (this._bubble) {
        this._bubble.className = `cloud-bubble ${emotion}`;
      }

      // Start typewriter effect
      this._typewriterInterval = window.setInterval(() => {
        if (charIndex < chars.length) {
          this._bubbleText!.textContent += chars[charIndex];
          charIndex++;
        } else {
          this.clearTypewriter();
        }
      }, this._typewriterSpeed);
      
      // Auto-hide bubble after 10 seconds of idle
      this.clearHideTimeout();
      this._hideTimeout = window.setTimeout(() => {
        this.hideBubble();
      }, 10000);

      // Trigger Text-to-Speech and lip-sync simulation
      this.speakReply(text);
    }
  }

  private hideBubble(): void {
    this.clearTypewriter();
    if (this._bubble) {
      this._bubble.className = 'cloud-bubble hidden';
      this.clearHideTimeout();
    }
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._speakingTimeout) {
      clearTimeout(this._speakingTimeout);
      this._speakingTimeout = null;
    }
    this.stopSpeakingSim();
  }

  private speakReply(text: string): void {
    // 1. Cancel any active speech and clear existing timeouts
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._speakingTimeout) {
      clearTimeout(this._speakingTimeout);
      this._speakingTimeout = null;
    }

    const delegate = LAppDelegate.getInstance();
    if (!delegate) return;
    const subdelegate = delegate.getSubdelegate(0);
    if (!subdelegate) return;
    const live2dManager = subdelegate.getLive2DManager();
    if (!live2dManager || !live2dManager._models || live2dManager._models.length === 0) return;
    const model = live2dManager._models[0];
    if (!model) return;

    const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY || '';
    const elevenLabsVoiceId = (import.meta as any).env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const elevenLabsModelId = (import.meta as any).env.VITE_ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

    if (elevenLabsApiKey) {
      this.speakElevenLabs(text, elevenLabsApiKey, elevenLabsVoiceId, elevenLabsModelId, model);
    } else {
      this.speakWebSpeech(text, model);
    }
  }

  private async speakElevenLabs(
    text: string,
    apiKey: string,
    voiceId: string,
    modelId: string,
    model: any
  ): Promise<void> {
    try {
      // Clean up text
      const cleanText = text
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
        .replace(/[\[\]\(\)\{\}]/g, ' ')
        .trim();

      if (!cleanText) return;

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      this._activeAudio = audio;

      audio.onplay = () => {
        if (typeof model.startLipSyncSimulating === 'function') {
          model.startLipSyncSimulating();
        }
      };

      const handleAudioStop = () => {
        if (typeof model.stopLipSyncSimulating === 'function') {
          model.stopLipSyncSimulating();
        }
        URL.revokeObjectURL(audioUrl);
        if (this._activeAudio === audio) {
          this._activeAudio = null;
        }
      };

      audio.onended = handleAudioStop;
      audio.onerror = handleAudioStop;
      audio.onpause = handleAudioStop;

      await audio.play();

    } catch (e) {
      console.error('ElevenLabs TTS Error, falling back to Web Speech API:', e);
      this.speakWebSpeech(text, model);
    }
  }

  private speakWebSpeech(text: string, model: any): void {
    // Start mouth movement simulation
    if (typeof (model as any).startLipSyncSimulating === 'function') {
      (model as any).startLipSyncSimulating();
    }

    // Estimate speaking duration as fallback (e.g., 65ms per character + 500ms padding)
    const estimatedDuration = Math.max(1500, text.length * 65 + 500);

    const stopSpeaking = () => {
      if (this._speakingTimeout) {
        clearTimeout(this._speakingTimeout);
        this._speakingTimeout = null;
      }
      if (typeof (model as any).stopLipSyncSimulating === 'function') {
        (model as any).stopLipSyncSimulating();
      }
    };

    // Set fallback timeout to stop mouth movement
    this._speakingTimeout = window.setTimeout(() => {
      stopSpeaking();
    }, estimatedDuration);

    // Try using Web Speech API for TTS
    if ('speechSynthesis' in window) {
      // Strip emojis and brackets from text for smoother reading
      const cleanText = text
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
        .replace(/[\[\]\(\)\{\}]/g, ' ')
        .trim();

      if (cleanText) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();

        if (this._activeLang === 'jp') {
          utterance.lang = 'ja-JP'; // Japanese
          const jaVoice = voices.find(voice => voice.lang.toLowerCase().includes('ja') || voice.lang.toLowerCase().includes('jp'));
          if (jaVoice) {
            utterance.voice = jaVoice;
          }
        } else {
          utterance.lang = 'en-US'; // English
          const enVoice = voices.find(voice => voice.lang.toLowerCase().includes('en'));
          if (enVoice) {
            utterance.voice = enVoice;
          }
        }

        utterance.onstart = () => {
          // Re-affirm simulation start
          if (typeof (model as any).startLipSyncSimulating === 'function') {
            (model as any).startLipSyncSimulating();
          }
        };

        utterance.onend = () => {
          stopSpeaking();
        };

        utterance.onerror = () => {
          stopSpeaking();
        };

        window.speechSynthesis.speak(utterance);
      }
    }
  }

  private stopSpeakingSim(): void {
    try {
      const delegate = LAppDelegate.getInstance();
      if (!delegate) return;
      const subdelegate = delegate.getSubdelegate(0);
      if (!subdelegate) return;
      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager || !live2dManager._models || live2dManager._models.length === 0) return;
      const model = live2dManager._models[0];
      if (model && typeof (model as any).stopLipSyncSimulating === 'function') {
        (model as any).stopLipSyncSimulating();
      }
    } catch (e) {
      console.warn('Could not stop lip sync simulation:', e);
    }
  }

  private clearHideTimeout(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
  }

  private clearTypewriter(): void {
    if (this._typewriterInterval) {
      clearInterval(this._typewriterInterval);
      this._typewriterInterval = null;
    }
  }

  private triggerCharacterAction(emotion: 'joy' | 'sad' | 'angry' | 'surprise' | 'blush' | 'thinking' | 'neutral'): void {
    try {
      const delegate = LAppDelegate.getInstance();
      if (!delegate) return;

      const subdelegate = delegate.getSubdelegate(0);
      if (!subdelegate) return;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager || !live2dManager._models || live2dManager._models.length === 0) return;

      const model = live2dManager._models[0];
      if (!model) return;

      // Dynamic expression matcher based on actual loaded expression keys
      const setExpressionByEmotion = (targetEmotion: 'joy' | 'sad' | 'angry' | 'surprise' | 'blush' | 'thinking' | 'neutral') => {
        if (!model._expressions || typeof model._expressions.keys !== 'function') {
          return;
        }

        const keys = Array.from(model._expressions.keys());
        if (keys.length === 0) return;

        const lowerKeys = keys.map(k => k.toLowerCase());

        // Helper to find a key matching any of the regex patterns in priority order
        const findMatchingKey = (patterns: RegExp[]): string | null => {
          for (const pattern of patterns) {
            const idx = lowerKeys.findIndex(lk => pattern.test(lk));
            if (idx !== -1) {
              return keys[idx];
            }
          }
          return null;
        };

        let expressionId: string | null = null;

        switch (targetEmotion) {
          case 'neutral':
            expressionId = findMatchingKey([/neutral/i, /normal/i, /std/i, /idle/i, /f01/i, /exp_01/i]);
            break;
          case 'joy':
            expressionId = findMatchingKey([/smile/i, /happy/i, /joy/i, /laugh/i, /f05/i, /exp_05/i, /exp_06/i, /exp_02/i]);
            break;
          case 'sad':
            expressionId = findMatchingKey([/sad/i, /cry/i, /sorrow/i, /f03/i, /exp_03/i, /exp_04/i, /f04/i]);
            break;
          case 'angry':
            expressionId = findMatchingKey([/angry/i, /rage/i, /mad/i, /frown/i, /f02/i, /exp_02/i, /exp_04/i]);
            break;
          case 'surprise':
            expressionId = findMatchingKey([/surpris/i, /shock/i, /kaget/i, /f06/i, /exp_07/i, /exp_05/i, /exp_06/i]);
            break;
          case 'blush':
            expressionId = findMatchingKey([/blush/i, /shy/i, /kiss/i, /f07/i, /exp_08/i, /exp_07/i]);
            break;
          case 'thinking':
            expressionId = findMatchingKey([/think/i, /worry/i, /f08/i, /exp_08/i, /exp_04/i]);
            break;
        }

        // Fallback search if the direct match failed
        if (!expressionId) {
          if (targetEmotion === 'neutral') {
            expressionId = keys[0]; // fallback to first key for neutral
          } else {
            // Try to fall back to neutral/normal expression first
            expressionId = findMatchingKey([/normal/i, /neutral/i, /std/i, /f01/i, /exp_01/i]) || keys[0];
          }
        }

        if (expressionId) {
          model.setExpression(expressionId);
          console.log(`[ChatManager] Dynamic expression applied: "${expressionId}" for emotion "${targetEmotion}"`);
        } else {
          model.setRandomExpression();
        }
      };

      // Determine model home directory to target specific indices for Haru if applicable
      const isHaru = model._modelHomeDir && model._modelHomeDir.indexOf('Haru') !== -1;

      // Safe helper to play motion with fallback
      const playMotion = (group: string, preferredIndex: number, priority: number) => {
        if (model._modelSetting && typeof model._modelSetting.getMotionCount === 'function') {
          const count = model._modelSetting.getMotionCount(group);
          if (count > 0) {
            const index = (preferredIndex >= 0 && preferredIndex < count) ? preferredIndex : 0;
            model.startMotion(group, index, priority);
            return;
          }
        }
        model.startRandomMotion(group, priority);
      };

      if (emotion === 'thinking') {
        setExpressionByEmotion('thinking');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 3, LAppDefine.PriorityNormal);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupIdle, LAppDefine.PriorityNormal);
        }
      } else if (emotion === 'joy') {
        setExpressionByEmotion('joy');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 0, LAppDefine.PriorityForce);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupTapBody, LAppDefine.PriorityForce);
        }
      } else if (emotion === 'blush') {
        setExpressionByEmotion('blush');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 2, LAppDefine.PriorityNormal);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupIdle, LAppDefine.PriorityNormal);
        }
      } else if (emotion === 'surprise') {
        setExpressionByEmotion('surprise');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 0, LAppDefine.PriorityForce);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupTapBody, LAppDefine.PriorityForce);
        }
      } else if (emotion === 'sad') {
        setExpressionByEmotion('sad');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 3, LAppDefine.PriorityNormal);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupIdle, LAppDefine.PriorityNormal);
        }
      } else if (emotion === 'angry') {
        setExpressionByEmotion('angry');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 0, LAppDefine.PriorityForce);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupTapBody, LAppDefine.PriorityForce);
        }
      } else {
        setExpressionByEmotion('neutral');
        if (isHaru) {
          playMotion(LAppDefine.MotionGroupTapBody, 2, LAppDefine.PriorityForce);
        } else {
          model.startRandomMotion(LAppDefine.MotionGroupTapBody, LAppDefine.PriorityForce);
        }
      }
    } catch (e) {
      console.warn('Could not trigger Live2D animation:', e);
    }
  }

  // =======================================================
  // Microphone Speech-to-Text Recording & Translation
  // =======================================================
  private async toggleRecording(): Promise<void> {
    if (this._isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY || '';

    // If no ElevenLabs key, fall back to native browser speech recognition
    if (!elevenLabsApiKey) {
      this.startWebSpeechRecognition();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._mediaRecorder = new MediaRecorder(stream);
      this._audioChunks = [];

      this._mediaRecorder.ondataavailable = (event) => {
        this._audioChunks.push(event.data);
      };

      this._mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this._audioChunks, { type: 'audio/webm' });
        this.transcribeAudio(audioBlob);
      };

      this._mediaRecorder.start();
      this._isRecording = true;
      if (this._micBtn) {
        this._micBtn.classList.add('recording');
        this._micBtn.title = 'Stop Recording';
      }
      console.log('[ChatManager] ElevenLabs speech recording started...');
    } catch (err) {
      console.error('Failed to access microphone for ElevenLabs:', err);
      // Fallback
      this.startWebSpeechRecognition();
    }
  }

  private stopRecording(): void {
    if (this._mediaRecorder && this._isRecording) {
      this._mediaRecorder.stop();
      this._mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this._isRecording = false;
      if (this._micBtn) {
        this._micBtn.classList.remove('recording');
        this._micBtn.title = 'Record Voice';
      }
      console.log('[ChatManager] ElevenLabs speech recording stopped.');
    }
  }

  private async transcribeAudio(audioBlob: Blob): Promise<void> {
    const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY || '';
    if (!elevenLabsApiKey) return;

    this.showTypingState();

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'speech.webm');
      formData.append('model_id', 'scribe_v1');
      
      if (this._activeLang === 'jp') {
        formData.append('language_code', 'ja');
      } else {
        formData.append('language_code', 'en');
      }

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs STT error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text || '';
      console.log(`[ChatManager] ElevenLabs transcribed: "${text}"`);

      if (text.trim()) {
        if (this._input) {
          this._input.value = text.trim();
        }
        if (this._form) {
          this._form.dispatchEvent(new Event('submit'));
        }
      } else {
        this.hideBubble();
      }

    } catch (e) {
      console.error('ElevenLabs STT Error:', e);
      this.hideBubble();
    }
  }

  private startWebSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition. Please try Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = this._activeLang === 'jp' ? 'ja-JP' : 'en-US';

      recognition.onstart = () => {
        this._isRecording = true;
        if (this._micBtn) {
          this._micBtn.classList.add('recording');
          this._micBtn.title = 'Mendengarkan...';
        }
        console.log('[ChatManager] Web Speech Recognition started...');
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript || '';
        console.log(`[ChatManager] Web Speech transcribed: "${text}"`);
        if (text.trim()) {
          if (this._input) {
            this._input.value = text.trim();
          }
          if (this._form) {
            this._form.dispatchEvent(new Event('submit'));
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Web Speech Recognition error:', event.error);
        this.cleanupRecognition();
      };

      recognition.onend = () => {
        this.cleanupRecognition();
      };

      recognition.start();

    } catch (e) {
      console.error('Failed to start Web Speech Recognition:', e);
    }
  }

  private cleanupRecognition(): void {
    this._isRecording = false;
    if (this._micBtn) {
      this._micBtn.classList.remove('recording');
      this._micBtn.title = 'Rekam Suara';
    }
    console.log('[ChatManager] Web Speech Recognition stopped.');
  }
}
