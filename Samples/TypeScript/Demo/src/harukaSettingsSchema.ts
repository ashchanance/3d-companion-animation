export interface FactItem {
  id: number;
  text: string;
}

export interface HarukaSettings {
  presetCard: string;
  syncPreset: boolean;
  thinkingMode: boolean;
  visionModule: boolean;
  speechSynthesis: boolean;
  gamingCompanion: boolean;
  lightingSystem: string;
  sceneBrightness: number;
  windSpeed: number;
  rigArchitecture: string;
  rigPhysics: string;
  eyeTracking: number;
  vectorMemory: boolean;
  bufferAllocation: number;
  chatProvider: string;
  speechProvider: string;
  sttProvider: string;
  wsUrl: string;
  autoReconnect: boolean;
  themePalette: string;
  layoutScale: number;
  facts: FactItem[];
  pumpTokenAddress: string;
  pumpWsUrl: string;
  pumpRoomUsername: string;
  relayEnabled: boolean;
  mirrorPumpToUi: boolean;
  pumpHistoryLimit: number;
  queueDelayMs: number;
  queueMaxSize: number;
  minCommentLength: number;
  maxCommentLength: number;
  blockedWords: string;
  harukaMessageTemplate: string;
  harukaEnvelopeTemplate: string;
}

export const defaultHarukaSettings: HarukaSettings = {
  presetCard: 'classic',
  syncPreset: true,
  thinkingMode: true,
  visionModule: false,
  speechSynthesis: true,
  gamingCompanion: false,
  lightingSystem: 'dynamic',
  sceneBrightness: 80,
  windSpeed: 18,
  rigArchitecture: 'live2d',
  rigPhysics: 'high',
  eyeTracking: 75,
  vectorMemory: true,
  bufferAllocation: 2048,
  chatProvider: 'ollama',
  speechProvider: 'elevenlabs',
  sttProvider: 'webspeech',
  wsUrl: '',
  autoReconnect: true,
  themePalette: 'gold',
  layoutScale: 100,
  facts: [
    { id: 1, text: 'User loves digital forest walk exploration.' },
    { id: 2, text: "User's companion token is $HARUKA on Solana." },
    { id: 3, text: 'Haruka was designed to be cheerful and always helpful.' }
  ],
  pumpTokenAddress: '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump',
  pumpWsUrl: 'wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket',
  pumpRoomUsername: 'HarukaRelay',
  relayEnabled: false,
  mirrorPumpToUi: true,
  pumpHistoryLimit: 50,
  queueDelayMs: 5000,
  queueMaxSize: 24,
  minCommentLength: 3,
  maxCommentLength: 200,
  blockedWords: 'spam, rug, scam',
  harukaMessageTemplate: 'viewer {{username}} says: "{{message}}"',
  harukaEnvelopeTemplate: '{\n  "type": "chat",\n  "content": "{{formatted}}"\n}'
};
