import React, { useState, useRef } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { useHandLandmarker } from '../hooks/useMediaPipe';
import { Trophy, RefreshCw, Play, ArrowRight } from 'lucide-react';
import { playTick, playSpell, playVictory, playGameOver, playClick } from '../utils/audio';
import { mapLandmark } from '../utils/tracking';
import confetti from 'canvas-confetti';

type Choice = 'rock' | 'paper' | 'scissors' | 'unknown';
type GameState = 'idle' | 'countdown' | 'roundResult' | 'matchEnd';

export const RockPaperScissors: React.FC = () => {
  const { model: handLandmarker } = useHandLandmarker();

  // Tournament stats
  const [userScore, setUserScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number>(0);
  const [roundsPlayed, setRoundsPlayed] = useState<number>(0); // 0 to 5

  // Game states
  const [gameState, setGameState] = useState<GameState>('idle');
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [roundWinnerMessage, setRoundWinnerMessage] = useState<string>('');
  
  const [userChoice, setUserChoice] = useState<Choice>('unknown');
  const [aiChoice, setAiChoice] = useState<Choice>('unknown');

  // Ref to hold raw gesture detected by frame loop
  const currentHandChoiceRef = useRef<Choice>('unknown');

  // Classify hand shape
  const classifyHand = (landmarks: any[]): Choice => {
    // Y coordinates in MediaPipe go from 0 (top) to 1 (bottom).
    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;
    const ringUp = landmarks[16].y < landmarks[14].y;
    const pinkyUp = landmarks[20].y < landmarks[18].y;

    // Rock: All fingers folded
    if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
      return 'rock';
    }
    // Scissors: Index and Middle up, others folded
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
      return 'scissors';
    }
    // Paper: All fingers extended
    if (indexUp && middleUp && ringUp && pinkyUp) {
      return 'paper';
    }

    return 'unknown';
  };

  const handleFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.width;
    const height = canvas.height;

    let detected: Choice = 'unknown';

    if (handLandmarker) {
      const results = handLandmarker.detectForVideo(video, performance.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0];
        detected = classifyHand(hand);

        // Draw mirrored skeletal bones
        ctx.fillStyle = detected === 'rock' ? '#ff007f' : detected === 'paper' ? '#39ff14' : detected === 'scissors' ? '#00f0ff' : 'rgba(255,255,255,0.4)';
        hand.forEach((pt: any) => {
          const mapped = mapLandmark(pt, width, height, true);
          ctx.beginPath();
          ctx.arc(mapped.x, mapped.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    currentHandChoiceRef.current = detected;
  };

  // Launch a round sequence
  const startNextRound = () => {
    if (gameState === 'countdown' || roundsPlayed >= 5) return;
    playClick();

    setGameState('countdown');
    setRoundWinnerMessage('');
    setUserChoice('unknown');
    setAiChoice('unknown');

    let count = 3;
    setCountdownText('3');
    playTick(400);

    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownText(count.toString());
        playTick(400);
      } else if (count === 0) {
        setCountdownText('GO!');
        playTick(800); // Shoot buzzer

        // Capture hand gesture
        const userFinal = currentHandChoiceRef.current;
        
        // Random AI Move
        const choicesList: Choice[] = ['rock', 'paper', 'scissors'];
        const aiFinal = choicesList[Math.floor(Math.random() * 3)];

        setUserChoice(userFinal);
        setAiChoice(aiFinal);

        setTimeout(() => {
          evaluateRoundResult(userFinal, aiFinal);
          clearInterval(timer);
        }, 600);
      }
    }, 1000);
  };

  const evaluateRoundResult = (user: Choice, ai: Choice) => {
    setCountdownText(null);
    let roundWinner: 'player' | 'ai' | 'draw' = 'draw';
    let msg = '';

    if (user === 'unknown') {
      roundWinner = 'ai';
      msg = 'AI WINS! No valid hand detected.';
      setAiScore(prev => prev + 1);
      playGameOver();
    } else if (user === ai) {
      roundWinner = 'draw';
      msg = "DRAW ROUND!";
      playSpell();
    } else {
      const userWin = 
        (user === 'rock' && ai === 'scissors') ||
        (user === 'paper' && ai === 'rock') ||
        (user === 'scissors' && ai === 'paper');

      if (userWin) {
        roundWinner = 'player';
        msg = "YOU WIN THE ROUND!";
        setUserScore(prev => prev + 1);
        playSpell();
      } else {
        roundWinner = 'ai';
        msg = "AI WINS THE ROUND!";
        setAiScore(prev => prev + 1);
        playGameOver();
      }
    }

    setRoundWinnerMessage(msg);
    const nextRounds = roundsPlayed + 1;
    setRoundsPlayed(nextRounds);

    if (nextRounds >= 5) {
      // Delay before moving to final screen
      setTimeout(() => {
        setGameState('matchEnd');
        const finalUser = nextRounds === 5 && roundWinner === 'player' ? userScore + 1 : userScore;
        const finalAi = nextRounds === 5 && roundWinner === 'ai' ? aiScore + 1 : aiScore;

        if (finalUser > finalAi) {
          playVictory();
          confetti({
            particleCount: 150,
            spread: 85,
            origin: { y: 0.6 }
          });
        } else {
          playGameOver();
        }
      }, 2000);
    } else {
      setGameState('roundResult');
    }
  };

  const proceedToNext = () => {
    playClick();
    setGameState('idle');
  };

  const restartMatch = () => {
    playClick();
    setUserScore(0);
    setAiScore(0);
    setRoundsPlayed(0);
    setRoundWinnerMessage('');
    setCountdownText(null);
    setUserChoice('unknown');
    setAiChoice('unknown');
    setGameState('idle');
  };

  const getFinalVerdict = (): string => {
    if (userScore > aiScore) return '🏆 PLAYER WINS';
    if (aiScore > userScore) return '🏆 AI WINS';
    return '🤝 MATCH DRAW';
  };

  const instructions = [
    "Position your hand inside the camera frame.",
    "Click 'START ROUND' to initiate a countdown.",
    "Watch the 3, 2, 1, GO! overlay count down.",
    "At GO!, show either ROCK (fist), PAPER (flat hand), or SCISSORS (peace sign).",
    "Review round results, scores, and click 'CONTINUE' to play next.",
    "Play exactly 5 rounds. Reconstruct the win stats to claim victory!"
  ];

  const gestures = [
    { gesture: "Rock (Fist)", action: "Folds all fingers closed" },
    { gesture: "Paper (Flat Hand)", action: "Extends all fingers open" },
    { gesture: "Scissors (Peace)", action: "Index and Middle up, others folded" }
  ];

  const tips = [
    "Keep your hand flat to the camera during countdowns to lock coordinates accurately.",
    "AI choices utilize a secure math-random selection with equal 1/3 odds.",
    "The camera displays your active gesture in real-time on screen."
  ];

  const choiceIcons = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️',
    unknown: '❓'
  };

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        {/* Title */}
        <div className="text-center md:text-left">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent glow-text-pink">
            ROCK PAPER SCISSORS
          </h1>
          <p className="text-slate-400 text-sm font-outfit mt-1">
            Beat the AI in a five-round match.
          </p>
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left Column: Camera and Arena */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <CameraManager onFrame={handleFrame}>
              {/* Countdown Screen overlay */}
              {gameState === 'countdown' && countdownText && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 z-20 pointer-events-none select-none">
                  <div className="font-orbitron font-black text-8xl md:text-9xl text-neon-blue glow-text-blue animate-pulse text-center">
                    {countdownText}
                  </div>
                </div>
              )}

              {/* Tournament Match End screen */}
              {gameState === 'matchEnd' && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto z-30">
                  <Trophy className={`w-16 h-16 mb-4 ${userScore > aiScore ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-slate-600'}`} />
                  <h3 className="font-orbitron font-black text-3xl tracking-wider mb-2 text-white">
                    {getFinalVerdict()}
                  </h3>
                  <p className="font-orbitron text-slate-300 text-sm mb-6 uppercase">
                    Final Score: You {userScore} - {aiScore} AI
                  </p>
                  <button
                    onClick={restartMatch}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-orbitron font-bold text-sm tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,0,127,0.3)] hover-target"
                  >
                    <RefreshCw className="w-4 h-4" />
                    PLAY AGAIN
                  </button>
                </div>
              )}

              {/* Round Result Review overlay */}
              {gameState === 'roundResult' && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto z-20">
                  <h3 className="font-orbitron font-black text-xl text-neon-pink glow-text-pink mb-6 uppercase">
                    {roundWinnerMessage}
                  </h3>

                  <div className="flex gap-8 justify-center items-center mb-8">
                    {/* User move */}
                    <div className="flex flex-col items-center bg-white/5 border border-white/10 p-4 rounded-xl min-w-24">
                      <span className="text-3xl">{choiceIcons[userChoice]}</span>
                      <span className="text-[10px] font-orbitron text-neon-blue font-bold uppercase mt-2">You</span>
                    </div>

                    <span className="text-xs font-orbitron text-slate-500">VS</span>

                    {/* AI move */}
                    <div className="flex flex-col items-center bg-white/5 border border-white/10 p-4 rounded-xl min-w-24">
                      <span className="text-3xl">{choiceIcons[aiChoice]}</span>
                      <span className="text-[10px] font-orbitron text-neon-pink font-bold uppercase mt-2">AI</span>
                    </div>
                  </div>

                  <button
                    onClick={proceedToNext}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-orbitron font-bold text-xs tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.3)] hover-target"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Continue to Round {roundsPlayed + 1}
                  </button>
                </div>
              )}

              {/* Score HUD Overlay */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none select-none z-10">
                <div className="flex gap-4 p-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur font-orbitron text-xs">
                  <div>
                    YOU: <span className="text-neon-blue font-bold">{userScore}</span>
                  </div>
                  <div className="text-slate-500">|</div>
                  <div>
                    AI: <span className="text-neon-pink font-bold">{aiScore}</span>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-xl bg-black/60 border border-white/10 backdrop-blur text-[10px] font-orbitron text-slate-300">
                  Round {Math.min(5, roundsPlayed + 1)} of 5
                </div>
              </div>
            </CameraManager>

            {/* Battle controls */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-orbitron text-slate-400">Match Status</span>
                <span className="text-sm font-outfit text-slate-300">
                  {gameState === 'countdown'
                    ? 'Get ready to make your move...'
                    : gameState === 'roundResult'
                      ? 'Review choices and scores.'
                      : gameState === 'matchEnd'
                        ? 'Match finished! Click Play Again.'
                        : `Round ${roundsPlayed + 1} is ready. Click Start Round.`}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={startNextRound}
                  disabled={gameState !== 'idle' || roundsPlayed >= 5}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-orbitron font-bold text-sm tracking-wider hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-[0_0_12px_rgba(255,0,127,0.3)] hover-target"
                >
                  <Play className="w-4 h-4 fill-white" />
                  START ROUND
                </button>
                <button
                  onClick={restartMatch}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron font-bold text-sm transition-all cursor-pointer hover-target"
                >
                  <RefreshCw className="w-4 h-4" />
                  RESET
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Instructions */}
          <InstructionsPanel
            title="Rock Paper Scissors"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default RockPaperScissors;
