
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import React, { useState, useRef, useEffect } from 'react';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

type ConversationStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'stopped';
interface Transcription {
  id: number;
  speaker: 'user' | 'model';
  text: string;
}

const LiveApiTab: React.FC = () => {
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTime = useRef<number>(0);
  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');
  
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptContainerRef.current) {
        transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const handleStart = async () => {
    if (!process.env.API_KEY) {
      setError('API key is not configured.');
      return;
    }
    setTranscriptions([]);
    setStatus('connecting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('connected');
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setError(`Connection error: ${e.message}`);
            setStatus('error');
            handleStop();
          },
          onclose: (e: CloseEvent) => {
            setStatus('stopped');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });
    } catch (e) {
      console.error('Failed to start conversation:', e);
      setError(e instanceof Error ? `Failed to get microphone: ${e.message}` : 'An unknown error occurred.');
      setStatus('error');
    }
  };
  
  const handleServerMessage = async (message: LiveServerMessage) => {
    // Play audio
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && outputAudioContextRef.current) {
        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContextRef.current.currentTime);
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContextRef.current.destination);
        source.addEventListener('ended', () => outputSources.current.delete(source));
        source.start(nextStartTime.current);
        nextStartTime.current += audioBuffer.duration;
        outputSources.current.add(source);
    }
    // Interrupt and clear audio queue
    if (message.serverContent?.interrupted) {
        for (const source of outputSources.current.values()) {
            source.stop();
        }
        outputSources.current.clear();
        nextStartTime.current = 0;
    }
    // Handle transcriptions
    if (message.serverContent?.inputTranscription) {
      currentInputTranscription.current += message.serverContent.inputTranscription.text;
    }
    if (message.serverContent?.outputTranscription) {
      currentOutputTranscription.current += message.serverContent.outputTranscription.text;
    }
    if (message.serverContent?.turnComplete) {
      const fullInput = currentInputTranscription.current.trim();
      const fullOutput = currentOutputTranscription.current.trim();

      setTranscriptions(prev => {
        const newTranscriptions = [...prev];
        if (fullInput) {
            newTranscriptions.push({ id: Date.now() + Math.random(), speaker: 'user', text: fullInput });
        }
        if (fullOutput) {
            newTranscriptions.push({ id: Date.now() + Math.random(), speaker: 'model', text: fullOutput });
        }
        return newTranscriptions;
      });
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
    }
  };

  const handleStop = () => {
    sessionPromiseRef.current?.then((session) => session.close());
    sessionPromiseRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();

    setStatus('stopped');
  };
  
  const isConversationActive = status === 'connecting' || status === 'connected';

  return (
    <div className="flex flex-col h-full items-center">
      <h2 className="text-2xl font-semibold text-center text-white">Live Conversation</h2>
      <p className="text-center text-gray-400 mb-4">
        Speak with Gemini in real-time. Start the conversation and talk naturally.
      </p>

      <div className="w-full flex justify-center mb-4">
        <button
          onClick={isConversationActive ? handleStop : handleStart}
          className={`px-8 py-4 text-lg font-bold rounded-full transition-all duration-300 flex items-center space-x-3 ${
            isConversationActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isConversationActive ? 
            (<><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12v0a9 9 0 01-9 9s-9-4.03-9-9 4.03-9 9-9v0a9 9 0 019 9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg><span>Stop</span></>) :
            (<><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg><span>Start</span></>)
          }
        </button>
      </div>

      <div className="w-full flex flex-col items-center justify-center p-2 bg-gray-900 rounded-md mb-4 h-12">
        <p className="font-mono text-sm uppercase tracking-wider text-gray-400">
            Status: <span className={`font-bold ${status === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>{status}</span>
        </p>
        {status === 'connected' && 
          <div className="flex items-center text-green-400">
              <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="ml-2 text-sm">Listening...</span>
          </div>
        }
      </div>

      <div ref={transcriptContainerRef} className="w-full flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto space-y-4 min-h-[30vh]">
        {transcriptions.length === 0 && status !== 'error' && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Conversation transcript will appear here...</p>
          </div>
        )}
        {transcriptions.map(({id, speaker, text}) => (
          <div key={id} className={`flex ${speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-4 py-2 max-w-sm md:max-w-md lg:max-w-lg ${speaker === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="font-bold capitalize text-sm mb-1">{speaker}</p>
              <p>{text}</p>
            </div>
          </div>
        ))}
         {error && (
            <div className="text-red-400 bg-red-900/50 p-3 rounded-md text-center">{error}</div>
        )}
      </div>
    </div>
  );
};

export default LiveApiTab;
