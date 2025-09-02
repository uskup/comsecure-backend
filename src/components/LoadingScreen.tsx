import { useState, useEffect } from 'react';
import ciaLogo from '@/assets/cia-logo.png';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => setShowButton(true), 500);
          return 100;
        }
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(onComplete, 800);
  };

  return (
    <div className={`fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-800 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-gradient-radial from-metallic/10 via-transparent to-transparent animate-pulse" />
      
      <div className="text-center space-y-8 animate-slide-up">
        {/* CIA Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={ciaLogo} 
            alt="CIA Logo" 
            className="w-24 h-24 opacity-80 animate-matrix-glow"
          />
        </div>

        {/* Agency Title */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-mono font-bold text-glow tracking-wider animate-flicker">
            CENTRAL INTELLIGENCE
          </h1>
          <h2 className="text-2xl md:text-4xl font-mono font-bold text-metallic tracking-widest animate-matrix-glow">
            SURVEILLANCE AGENCY
          </h2>
        </div>

        {/* Loading Bar */}
        <div className="w-80 mx-auto space-y-4">
          <div className="text-sm font-mono text-text-secondary tracking-wider">
            INITIALIZING SECURE CONNECTION...
          </div>
          <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-metallic to-metallic-bright transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs font-mono text-text-muted">
            {Math.round(progress)}% COMPLETE
          </div>
        </div>

        {/* Enter Button */}
        {showButton && (
          <div className="animate-fade-in">
            <button
              onClick={handleEnter}
              className="px-8 py-3 bg-gradient-to-r from-metallic to-metallic-bright text-black font-mono font-bold tracking-wider rounded-lg glow-hover transition-all duration-300 hover:scale-105"
            >
              [ ENTER SYSTEM ]
            </button>
          </div>
        )}

        {/* Matrix-style decoration */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-mono text-text-muted opacity-50">
          <div className="animate-flicker">
            CLASSIFIED // AUTHORIZED PERSONNEL ONLY
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;