
import { GoogleGenAI, Modality } from '@google/genai';
import React, { useState } from 'react';
import { decode, decodeAudioData } from '../utils/audioUtils';

const PREBUILT_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

const TtsTab: React.FC = () => {
  const [text, setText] = useState<string>('Hello! Welcome to the Gemini Audio Suite. Try generating speech with different voices.');
  const [selectedVoice, setSelectedVoice] = useState<string>(PREBUILT_VOICES[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSpeech = async () => {
    if (!text.trim() || !process.env.API_KEY) {
      setError('Please enter text and ensure your API key is set.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioData(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setAudioData(base64Audio);
      } else {
        setError('Failed to generate audio. The response was empty.');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePlayAudio = async () => {
    if (!audioData) return;
    try {
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(audioData),
        outputAudioContext,
        24000,
        1,
      );
      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.destination);
      source.start();
    } catch (e) {
       console.error("Error playing audio: ", e);
       setError("Could not play the generated audio.");
    }
  };

  return (
    <div className="flex flex-col space-y-4 h-full">
      <h2 className="text-2xl font-semibold text-center text-white">Text-to-Speech</h2>
      <p className="text-center text-gray-400">
        Convert text into lifelike speech. Choose a voice and hear your words come alive.
      </p>
      
      <div className="flex-grow flex flex-col">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          className="w-full flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          rows={8}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
            <label htmlFor="voice-select" className="sr-only">Choose a voice</label>
            <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                disabled={isLoading}
            >
                {PREBUILT_VOICES.map(voice => (
                    <option key={voice} value={voice}>{voice}</option>
                ))}
            </select>
        </div>

        <button
          onClick={handleGenerateSpeech}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : 'Generate Speech'}
        </button>
      </div>

      {audioData && !isLoading && (
        <div className="flex items-center justify-center p-4 bg-green-900/50 rounded-lg">
          <button
            onClick={handlePlayAudio}
            className="flex items-center space-x-2 bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Play Generated Audio</span>
          </button>
        </div>
      )}
      
      {error && (
        <div className="text-red-400 bg-red-900/50 p-3 rounded-md text-center">{error}</div>
      )}
    </div>
  );
};

export default TtsTab;
