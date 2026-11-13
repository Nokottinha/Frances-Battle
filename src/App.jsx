import React, { useState } from 'react';
import { Trophy, Sparkles, CheckCircle2, XCircle, ArrowRight, RefreshCw, Lightbulb, Plus, X, Star } from 'lucide-react';

const LEVELS = {
  facile: { label: 'Fácil', points: 10, multipleChoice: true },
  moyen: { label: 'Médio', points: 20, multipleChoice: false },
  difficile: { label: 'Difícil', points: 30, multipleChoice: false }
};

const LOCAL_BANK = [
  {
    level: 'facile',
    sentence: 'Je ___ une pomme.',
    infinitive: 'manger',
    correctAnswer: 'mange',
    options: ['mange', 'manges', 'mangeons', 'mangent'],
    translation: 'Eu como uma maçã.',
    tense: 'présent',
    explanation: 'Com "je", os verbos em -er recebem a terminação -e no presente.'
  },
  {
    level: 'facile',
    sentence: 'Nous ___ en France.',
    infinitive: 'habiter',
    correctAnswer: 'habitons',
    options: ['habite', 'habitons', 'habitez', 'habitent'],
    translation: 'Nós moramos na França.',
    tense: 'présent',
    explanation: 'Com "nous", os verbos em -er terminam em -ons.'
  },
  {
    level: 'facile',
    sentence: 'Tu ___ français ?',
    infinitive: 'parler',
    correctAnswer: 'parles',
    options: ['parle', 'parles', 'parlons', 'parlent'],
    translation: 'Você fala francês?',
    tense: 'présent',
    explanation: 'Com "tu", os verbos em -er terminam em -es.'
  },
  {
    level: 'moyen',
    sentence: 'Hier, nous ___ au marché.',
    infinitive: 'aller',
    correctAnswer: 'sommes allés',
    options: [],
    translation: 'Ontem, nós fomos ao mercado.',
    tense: 'passé composé',
    explanation: 'Aller usa o auxiliar "être", então o particípio concorda com o sujeito.'
  },
  {
    level: 'moyen',
    sentence: "Quand j'étais petit, j'___ souvent à la mer.",
    infinitive: 'aller',
    correctAnswer: 'allais',
    options: [],
    translation: 'Quando eu era pequeno, eu ia com frequência à praia.',
    tense: 'imparfait',
    explanation: 'O imparfait descreve hábitos e ações repetidas no passado.'
  },
  {
    level: 'moyen',
    sentence: "Hier, j'___ un gâteau.",
    infinitive: 'faire',
    correctAnswer: 'ai fait',
    options: [],
    translation: 'Ontem, eu fiz um bolo.',
    tense: 'passé composé',
    explanation: 'Faire usa o auxiliar "avoir", então não há concordância com o sujeito.'
  },
  {
    level: 'difficile',
    sentence: 'Il faut que tu ___ tes devoirs avant ce soir.',
    infinitive: 'faire',
    correctAnswer: 'fasses',
    options: [],
    translation: 'É preciso que você faça seus deveres antes desta noite.',
    tense: 'subjonctif présent',
    explanation: 'A expressão "il faut que" exige o subjuntivo.'
  },
  {
    level: 'difficile',
    sentence: "Si j'avais de l'argent, j'___ un nouveau vélo.",
    infinitive: 'acheter',
    correctAnswer: 'achèterais',
    options: [],
    translation: 'Se eu tivesse dinheiro, compraria uma bicicleta nova.',
    tense: 'conditionnel présent',
    explanation: 'Em "si + imparfait", o verbo principal vai ao conditionnel présent.'
  }
];

const MAX_TEAMS = 4;
const MIN_TEAMS = 2;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");

const checkAnswer = (given, correct) => {
  const g = normalize(given);
  const c = normalize(correct);
  if (g === c) return 'correct';
  if (stripAccents(g) === stripAccents(c)) return 'close';
  return 'incorrect';
};

const pickLocal = (level) => {
  const pool = LOCAL_BANK.filter((q) => q.level === level);
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...chosen,
    options: LEVELS[level].multipleChoice ? shuffle(chosen.options) : []
  };
};

const globalStyles = `
  @keyframes bounce-in {
    0% { transform: scale(0.8); opacity: 0; }
    60% { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  .animate-shake { animation: shake 0.3s ease-in-out; }
  .glass-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    border: 2px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
`;

function topScoreInGame(teams) {
  return teams.reduce((max, t) => Math.max(max, t.score), 0);
}

export default function App() {
  const [phase, setPhase] = useState('setup');
  const [teamInputs, setTeamInputs] = useState(['', '']);
  const [rounds, setRounds] = useState(3);
  const [level, setLevel] = useState('facile');
  const [setupError, setSetupError] = useState('');

  const [teams, setTeams] = useState([]);
  const [turnsDone, setTurnsDone] = useState(0);

  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  
  // Controle da dica aleatória
  const [hintShown, setHintShown] = useState(false);
  const [hintIndex, setHintIndex] = useState(null); 

  // Áudios do jogo
  const [bgm] = useState(() => {
    const audio = new Audio('/sounds/background_sound.mp3');
    audio.loop = true;
    audio.volume = 0.15; 
    return audio;
  });

  const [tipAudio] = useState(() => {
    const audio = new Audio('/sounds/tip.mp3');
    audio.loop = true; // Mantém tocando enquanto ele pensa
    audio.volume = 0.3;
    return audio;
  });

  const playSound = (fileName) => {
    const audio = new Audio(`/sounds/${fileName}`);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  };

  const updateTeamInput = (index, value) => {
    setTeamInputs((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addTeamInput = () => {
    if (teamInputs.length < MAX_TEAMS) setTeamInputs((prev) => [...prev, '']);
  };

  const removeTeamInput = (index) => {
    if (teamInputs.length > MIN_TEAMS) {
      setTeamInputs((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const loadQuestion = (lvl) => {
    setFeedback(null);
    setAnswer('');
    setHintShown(false);
    setHintIndex(null); // Reseta a dica na nova rodada
    setQuestion(pickLocal(lvl));
  };

  const startGame = () => {
    const names = teamInputs.map((n) => n.trim()).filter(Boolean);
    if (names.length < MIN_TEAMS) {
      playSound('wrong_answer.mp3');
      setSetupError(`Informe pelo menos ${MIN_TEAMS} equipes.`);
      return;
    }
    const lower = names.map((n) => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      playSound('wrong_answer.mp3');
      setSetupError('Os nomes das equipes precisam ser diferentes.');
      return;
    }
    setSetupError('');
    setTeams(names.map((name) => ({ name, score: 0 })));
    setTurnsDone(0);
    setPhase('playing');
    loadQuestion(level);
    
    bgm.play().catch(() => {}); // Inicia a música de fundo
  };

  const resetGame = () => {
    bgm.pause();
    bgm.currentTime = 0;
    tipAudio.pause();
    tipAudio.currentTime = 0;
    
    setPhase('setup');
    setTeams([]);
    setTurnsDone(0);
    setQuestion(null);
    setFeedback(null);
    setAnswer('');
  };

  const totalTurns = rounds * teams.length;
  const turnIndex = teams.length ? turnsDone % teams.length : 0;
  const currentTeam = teams[turnIndex];

    const contestAnswer = () => {
    if (!feedback) return;
    
    const earned = LEVELS[level].points; // Pontos integrais
    setTeams((prev) =>
      prev.map((t, i) => (i === turnIndex ? { ...t, score: t.score + earned } : t))
    );
    playSound('right_answer.mp3'); 
    
    // Atualiza o feedback para 'correct' para mostrar o aviso de sucesso e a palavra correta na frase
    setFeedback({ ...feedback, result: 'correct', earned, contested: true });
  };



    const submitAnswer = (given) => {
    if (!question || feedback) return;

    tipAudio.pause();
    tipAudio.currentTime = 0;
    if (bgm.paused) {
      bgm.play().catch(() => {});
    }

    const result = checkAnswer(given, question.correctAnswer);
    let earned = 0;

    if (result !== 'incorrect') {
      playSound('right_answer.mp3');
      earned = LEVELS[level].points;
      if (result === 'close') earned = earned / 2;
      if (hintShown) earned = earned / 2;
      earned = Math.round(earned);
    } else {
      playSound('wrong_answer.mp3');
    }

    if (earned > 0) {
      setTeams((prev) =>
        prev.map((t, i) => (i === turnIndex ? { ...t, score: t.score + earned } : t))
      );
    }
    
    // CERTIFIQUE-SE DE QUE ESTA LINHA ESTÁ ASSIM:
    setFeedback({ result, earned, givenAnswer: given });
  };


  const nextTurn = () => {
    const next = turnsDone + 1;
    setTurnsDone(next);
    if (next >= totalTurns) {
      bgm.pause();
      playSound('victory.mp3');
      setPhase('finished');
      setQuestion(null);
    } else {
      loadQuestion(level);
    }
  };

  const ranking = [...teams].sort((a, b) => b.score - a.score);
  const topScore = ranking[0]?.score ?? 0;
  const winners = ranking.filter((t) => t.score === topScore);

  if (phase === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300 font-sans p-4">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

        <div className="glass-card p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-bounce-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-pink-400 to-yellow-400" />

          <h1 className="text-4xl md:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 mb-1">
            Bataille de Verbes
          </h1>
          <p className="text-center text-gray-600 font-medium mb-6">Aprenda francês brincando! 🥐✨</p>

          <div className="space-y-6">
            
            {/* Menu Colorido: Equipes */}
            <div className="bg-yellow-50/80 p-4 rounded-3xl border-2 border-yellow-200 shadow-sm">
              <p className="text-sm font-bold text-yellow-700 mb-3 ml-2">Equipes ({teamInputs.length}/{MAX_TEAMS})</p>
              <div className="space-y-2">
                {teamInputs.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateTeamInput(i, e.target.value)}
                      placeholder={`Equipe ${i + 1}`}
                      maxLength={20}
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-yellow-200 focus:border-yellow-400 outline-none font-bold text-yellow-800 placeholder-yellow-300"
                    />
                    {teamInputs.length > MIN_TEAMS && (
                      <button
                        onClick={() => removeTeamInput(i)}
                        className="p-2 rounded-full bg-white text-red-400 hover:text-red-600 shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {teamInputs.length < MAX_TEAMS && (
                <button
                  onClick={addTeamInput}
                  className="mt-3 inline-flex items-center justify-center w-full gap-2 text-sm font-bold text-yellow-700 bg-white hover:bg-yellow-100 rounded-2xl py-2 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar equipe
                </button>
              )}
            </div>

            {/* Menu Colorido: Rodadas */}
            <div className="bg-blue-50/80 p-4 rounded-3xl border-2 border-blue-200 shadow-sm">
              <p className="text-sm font-bold text-blue-700 mb-3 ml-2">
                Rodadas: <span className="bg-blue-600 text-white px-2 py-1 rounded-full">{rounds}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRounds(n)}
                    className={`px-4 py-2 rounded-2xl font-bold text-sm transition ${
                      rounds === n ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-white text-blue-600 hover:bg-blue-100 shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Colorido: Nível */}
            <div className="bg-green-50/80 p-4 rounded-3xl border-2 border-green-200 shadow-sm">
              <p className="text-sm font-bold text-green-700 mb-3 ml-2">Nível</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(LEVELS).map(([id, cfg]) => (
                  <button
                    key={id}
                    onClick={() => setLevel(id)}
                    className={`px-2 py-3 rounded-2xl font-bold text-sm transition flex flex-col items-center ${
                      level === id ? 'bg-green-500 text-white shadow-md scale-105' : 'bg-white text-green-600 hover:bg-green-100 shadow-sm'
                    }`}
                  >
                    <span>{cfg.label}</span>
                    <span className="text-xs font-normal opacity-90 mt-1">{cfg.points} pts</span>
                  </button>
                ))}
              </div>
            </div>

            {setupError && <p className="text-red-600 font-bold text-sm text-center animate-shake">{setupError}</p>}

            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg transform transition hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-xl"
            >
              Começar a partida <Sparkles className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-200 font-sans p-4">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

        <div className="glass-card p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center animate-bounce-in">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-2" />
          <h2 className="text-3xl font-extrabold text-purple-800 mb-1">
            {winners.length > 1 ? 'Empate!' : `Vitória: ${winners[0].name}!`}
          </h2>
          <p className="text-gray-600 mb-6">
            {winners.length > 1
              ? `${winners.map((w) => w.name).join(' e ')} empataram com ${topScore} pts.`
              : `Com ${topScore} pontos em ${rounds} rodada(s).`}
          </p>

          <div className="space-y-3 mb-8">
            {ranking.map((team, index) => (
              <div
                key={team.name}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                  team.score === topScore ? 'bg-yellow-50 border-yellow-300' : 'bg-white/80 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-indigo-50 text-indigo-600">
                    {index + 1}
                  </span>
                  <span className="font-bold text-gray-700 truncate max-w-[160px]">{team.name}</span>
                </div>
                <span className="font-extrabold text-indigo-600 text-xl">{team.score}</span>
              </div>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-3xl shadow-lg transform transition hover:scale-105 active:scale-95 text-lg"
          >
            Nova partida
          </button>
        </div>
      </div>
    );
  }

  const showVerb = LEVELS[level].multipleChoice || level === 'moyen';

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 via-blue-100 to-purple-100 font-sans flex flex-col md:flex-row">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      <div className="w-full md:w-72 bg-white/60 backdrop-blur-md border-r border-white/40 p-6 flex flex-col shadow-xl">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 rounded-3xl shadow-md text-white mb-6">
          <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">Rodada</p>
          <p className="text-3xl font-extrabold">
            {Math.min(Math.floor(turnsDone / teams.length) + 1, rounds)} <span className="text-lg opacity-80">de {rounds}</span>
          </p>
          <p className="mt-2 text-sm opacity-90">
            Vez de: <span className="font-bold">{currentTeam?.name}</span>
          </p>
        </div>

        <div className="space-y-3 flex-1">
          {teams.map((team, i) => (
            <div
              key={team.name}
              className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                i === turnIndex ? 'bg-indigo-50 border-indigo-300 shadow-sm scale-[1.02]' : 'bg-white/80 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                {team.score === topScoreInGame(teams) && team.score > 0 && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
                <span className="font-bold text-gray-700 truncate max-w-[130px]">{team.name}</span>
              </div>
              <span className="font-extrabold text-indigo-600 text-lg">{team.score}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Progresso: {turnsDone}/{totalTurns} perguntas
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="glass-card w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl">
          {!question ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RefreshCw className="w-12 h-12 text-pink-400 animate-spin" />
              <p className="font-bold text-xl text-gray-500">Preparando o desafio...</p>
            </div>
          ) : (
            <div className="animate-bounce-in">
              <p className="text-center text-lg font-extrabold text-indigo-700 mb-4">
                Pergunta para {currentTeam?.name}
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {showVerb && (
                  <span className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 px-4 py-2 rounded-full font-bold text-sm">
                    Verbo: <span className="uppercase">{question.infinitive}</span>
                  </span>
                )}
                {question.tense && (
                  <span className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full font-bold text-sm">
                    {question.tense}
                  </span>
                )}
              </div>

              <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight">
                  {question.sentence.split('___').map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                      {part}
                      {idx < arr.length - 1 && (
                       <span
                          className={`inline-block mx-2 px-3 py-0.5 rounded-lg border-b-4 border-dashed ${
                            feedback?.result === 'correct' ? 'text-green-600 border-green-400 bg-green-50' :
                            feedback?.result === 'close' ? 'text-yellow-600 border-yellow-400 bg-yellow-50' :
                            feedback ? 'text-red-600 border-red-400 bg-red-50 font-bold' :
                            'text-indigo-600 border-indigo-300'
                          }`}
                        >
                          {feedback
                            ? (feedback.result === 'correct' ? question.correctAnswer : (feedback.givenAnswer || answer || '(nada)'))
                            : hintShown
                              ? `${question.correctAnswer[0]}${'·'.repeat(Math.max(question.correctAnswer.length - 1, 0))}`
                              : '\u00A0'}
                        </span>



                      )}
                    </React.Fragment>
                  ))}
                </h2>
                <p className="text-gray-500 font-medium mt-4 italic text-lg">"{question.translation}"</p>
              </div>

              {!feedback && !hintShown && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={() => {
                      // Pausa a música de fundo e inicia o som da dica
                      bgm.pause();
                      tipAudio.currentTime = 0;
                      tipAudio.play().catch(() => {});
                      
                      // Sorteia uma letra aleatória
                      setHintIndex(Math.floor(Math.random() * question.correctAnswer.length));
                      setHintShown(true);
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-full transition"
                  >
                    <Lightbulb className="w-4 h-4" /> Dica de letra (pontos ÷ 2)
                  </button>
                </div>
              )}

              {!feedback ? (
                LEVELS[level].multipleChoice ? (
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {question.options.map((opt, i) => (
                      <button
                        key={`${opt}-${i}`}
                        onClick={() => submitAnswer(opt)}
                        className="bg-white border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-800 font-bold text-xl py-4 rounded-2xl shadow-sm transform transition hover:-translate-y-1 active:scale-95"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); submitAnswer(answer); }}
                    className="flex flex-col md:flex-row gap-4 justify-center mt-6"
                  >
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Digite a forma conjugada..."
                      className="flex-1 px-6 py-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 outline-none text-xl font-bold text-center md:text-left text-indigo-900"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!answer.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      Enviar <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>
                )
              ) : (
                <div
                  className={`mt-6 p-6 rounded-3xl flex flex-col items-center justify-center border-2 ${
                    feedback.result === 'correct' ? 'bg-green-50 border-green-200 animate-bounce-in' :
                    feedback.result === 'close' ? 'bg-yellow-50 border-yellow-200 animate-bounce-in' :
                    'bg-red-50 border-red-200 animate-shake'
                  }`}
                >
                  {feedback.result === 'correct' && (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-green-500 mb-2" />
                      <h3 className="text-2xl font-extrabold text-green-700">Magnifique!</h3>
                    </>
                  )}
                  {feedback.result === 'close' && (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-yellow-500 mb-2" />
                      <h3 className="text-2xl font-extrabold text-yellow-700">Quase!</h3>
                      <p className="text-yellow-700 text-sm">Faltou o acento. Pontos reduzidos pela metade.</p>
                    </>
                  )}
                  {feedback.result === 'incorrect' && (
                    <>
                      <XCircle className="w-14 h-14 text-red-500 mb-2" />
                      <h3 className="text-2xl font-extrabold text-red-700">Dommage...</h3>
                      <p className="text-red-600 mb-1">
                        A resposta correta era:{' '}
                        <span className="font-black bg-red-200 px-2 py-1 rounded">{question.correctAnswer}</span>
                      </p>

                      {/* Exibe a frase completa correta para leitura e comparação */}
                      <div className="my-2 bg-white border border-red-200 rounded-2xl p-3 text-gray-800 text-center shadow-sm w-full max-w-md">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Frase correta completa:</p>
                        <p className="font-extrabold text-lg text-indigo-900">
                          {question.sentence.replace('___', question.correctAnswer)}
                        </p>
                      </div>

                      {/* BOTÃO DE CONTESTAR */}
                      <button
                        onClick={contestAnswer}
                        className="mt-2 mb-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold py-2 px-5 rounded-xl shadow-sm transition flex items-center gap-2 text-sm"
                      >
                        🛡️ Contestar resposta (Aceitar e ganhar pontos)
                      </button>
                    </>
                  )}



                  <p className="font-bold text-indigo-700 mt-2">
                    {feedback.earned > 0 ? `+${feedback.earned} pontos para ${currentTeam?.name}!` : 'Nenhum ponto nesta vez.'}
                  </p>

                  {question.explanation && (
                    <div className="mt-3 bg-white/70 border border-white rounded-2xl p-4 text-gray-700 text-sm max-w-md">
                      <p className="font-bold text-indigo-700 mb-1">💡 Por que é esta forma?</p>
                      <p>{question.explanation}</p>
                    </div>
                  )}

                  <button
                    onClick={nextTurn}
                    className="mt-5 font-bold py-3 px-8 rounded-2xl shadow-md transform transition hover:scale-105 active:scale-95 flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white"
                  >
                    {turnsDone + 1 >= totalTurns ? 'Ver resultado' : 'Próxima equipe'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
