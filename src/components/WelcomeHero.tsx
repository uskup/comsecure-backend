import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Users, Shield } from 'lucide-react';

interface WelcomeHeroProps {
  onJoinChat: () => void;
}

const WelcomeHero = ({ onJoinChat }: WelcomeHeroProps) => {
  const [nickname, setNickname] = useState('');

  const handleJoin = () => {
    if (nickname.trim().length >= 2) {
      // Store nickname in localStorage for ChatInterface to use
      localStorage.setItem('chatNickname', nickname.trim());
      onJoinChat();
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://randallpacker.com/wp-content/uploads/2018/12/self-surveillance.gif"
          alt="Surveillance"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          
          {/* Main Title */}
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-mono font-bold text-glow tracking-wider animate-matrix-glow">
              CLASSIFIED
            </h1>
            <h2 className="text-2xl md:text-4xl font-mono text-metallic tracking-widest">
              REAL-TIME INTELLIGENCE NETWORK
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Secure communication channels for authorized personnel. 
              No registration required. Enter your codename to access the network.
            </p>
          </div>

          {/* Join Form */}
          <div className="glass rounded-2xl p-8 max-w-lg mx-auto space-y-6 glow-hover">
            <div className="space-y-4">
              <label className="text-sm font-mono text-metallic tracking-wider block">
                AGENT CODENAME
              </label>
              <Input
                type="text"
                placeholder="Enter your codename..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="bg-surface-elevated border-metallic/30 text-text-primary placeholder:text-text-muted font-mono"
                maxLength={32}
              />
              <div className="text-xs text-text-muted font-mono">
                2-32 characters • No real names or personal information
              </div>
            </div>

            <Button
              onClick={handleJoin}
              disabled={nickname.trim().length < 2}
              className="w-full bg-gradient-to-r from-metallic to-metallic-bright text-black font-mono font-bold tracking-wider hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              [ ACCESS NETWORK ]
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="glass rounded-xl p-6 space-y-3 glow-hover">
              <MessageSquare className="w-8 h-8 text-metallic mx-auto" />
              <h3 className="font-mono text-lg text-glow">Secure Channels</h3>
              <p className="text-sm text-text-secondary">
                Encrypted communication with automatic message destruction
              </p>
            </div>
            
            <div className="glass rounded-xl p-6 space-y-3 glow-hover">
              <Users className="w-8 h-8 text-metallic mx-auto" />
              <h3 className="font-mono text-lg text-glow">Anonymous Access</h3>
              <p className="text-sm text-text-secondary">
                Join instantly with codename only. No personal data required
              </p>
            </div>
            
            <div className="glass rounded-xl p-6 space-y-3 glow-hover">
              <Shield className="w-8 h-8 text-metallic mx-auto" />
              <h3 className="font-mono text-lg text-glow">Intelligence Grade</h3>
              <p className="text-sm text-text-secondary">
                Military-grade security protocols and surveillance countermeasures
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-text-muted font-mono opacity-60 animate-flicker">
            WARNING: This system is monitored. Unauthorized access is prohibited.
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;