
import React, { useState } from 'react';
import TtsTab from './components/TtsTab';
import LiveApiTab from './components/LiveApiTab';

type Tab = 'tts' | 'live';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('tts');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tts':
        return <TtsTab />;
      case 'live':
        return <LiveApiTab />;
      default:
        return null;
    }
  };
  
  const TabButton = ({ tab, children }: { tab: Tab; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Gemini Audio Suite</h1>
          <p className="text-gray-400">Experience the power of generative audio AI</p>
        </header>

        <div className="flex justify-center space-x-4 mb-6">
          <TabButton tab="tts">Text-to-Speech</TabButton>
          <TabButton tab="live">Live Conversation</TabButton>
        </div>

        <main className="bg-gray-800 rounded-lg shadow-2xl p-6 min-h-[60vh]">
          {renderTabContent()}
        </main>
        
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Powered by Google Gemini</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
