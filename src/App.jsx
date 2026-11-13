import React, { useState, useEffect } from 'react';
import { Trophy, Sparkles, CheckCircle2, XCircle, ArrowRight, RefreshCw, Lightbulb, Plus, X, Star, Volume2, VolumeX, Lock, Unlock, ArrowLeft, Save, BookOpen, Pencil, Trash2, Download, Clock } from 'lucide-react';

// COLOQUE AQUI A URL DO SEU WORKER CLOUDFLARE
const API_URL = 'https://bataille-api.myqueiaswin.workers.dev'; 

const AVATARS = ['🦊', '🐱', '🐼', '🐸', '🐷', '🐙', '🦄', '🦖', '👻', '🤖', '👽', '🦉', '🦀', '🦁'];

const LEVELS = {
  facile: { label: 'Fácil', points: 10 },
  moyen: { label: 'Médio', points: 20 },
  difficile: { label: 'Difícil', points: 30 }
};

const INITIAL_QUESTION_STATE = {
  level: 'facile', sentence: '', infinitive: '', correctAnswer: '',
  translation: '', tense: '', explanation: ''
};

const FALLBACK_BANK = [
  {
    level: 'facile',
    sentence: 'Je ___ une pomme.',
    infinitive: 'manger',
    correctAnswer: 'mange',
    translation: 'Eu como uma maçã.',
    tense: 'présent',
    explanation: 'Com "je", os verbos em -er recebem a terminação -e no presente.'
  }
];

const MAX_TEAMS = 10;
const MIN_TEAMS = 1;

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");

const checkAnswer = (given, correct) => {
  let g = normalize(given);
  const c = normalize(correct);
  
  const pronouns = ["j'", "je ", "tu ", "il ", "elle ", "on ", "nous ", "vous ", "ils ", "elles "];
  for (const p of pronouns) {
    if (g.startsWith(p) && !c.startsWith(p)) {
      g = g.slice(p.length).trim();
      break;
    }
  }

  if (g === c) return 'correct';
  if (stripAccents(g) === stripAccents(c)) return 'close';
  return 'incorrect';
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
  
  const [teamInputs, setTeamInputs] = useState([{ name: 'Jogador 1', avatar: AVATARS[0] }]);
  const [openAvatarPicker, setOpenAvatarPicker] = useState(null);
  
  const [rounds, setRounds] = useState(3);
  const [level, setLevel] = useState('facile');
  const [selectedTense, setSelectedTense] = useState('Todos');
  const [timeLimit, setTimeLimit] = useState(0); // 0 = sem tempo
  
  const [setupError, setSetupError] = useState('');

  const [questionBank, setQuestionBank] = useState(FALLBACK_BANK);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  
  const [usedQuestions, setUsedQuestions] = useState([]);

  const [teams, setTeams] = useState([]);
  const [turnsDone, setTurnsDone] = useState(0);

  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [hintShown, setHintShown] = useState(false);
  const [hintIndex, setHintIndex] = useState(null); 

  const [isMuted, setIsMuted] = useState(false);

  const [bgm] = useState(() => {
    const audio = new Audio('/sounds/background_sound.mp3');
    audio.loop = true;
    audio.volume = 0.15; 
    return audio;
  });

  const [tipAudio] = useState(() => {
    const audio = new Audio('/sounds/tip.mp3');
    audio.loop = true; 
    audio.volume = 0.3;
    return audio;
  });

  useEffect(() => {
    bgm.muted = isMuted;
    tipAudio.muted = isMuted;
  }, [isMuted, bgm, tipAudio]);

  const playSound = (fileName) => {
    if (isMuted) return;
    const audio = new Audio(`/sounds/${fileName}`);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  };

  const fetchQuestions = async () => {
    setIsLoadingDB(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Normaliza remoção de "options" caso o JSON venho do banco antigo
        const cleanedData = data.map(q => {
          const { options, ...rest } = q;
          return rest;
        });
        setQuestionBank(cleanedData);
      }
    } catch (e) {
      console.warn("Usando fallback de questões locais.");
    }
    setIsLoadingDB(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Lógica do Temporizador
  useEffect(() => {
    if (phase === 'playing' && !feedback && timeLimit > 0 && question) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, feedback, question, timeLimit]);

  const handleTimeOut = () => {
    tipAudio.pause();
    tipAudio.currentTime = 0;
    playSound('wrong_answer.mp3');
    setFeedback({ result: 'timeout', earned: 0, givenAnswer: '' });
  };

  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [newQ, setNewQ] = useState(INITIAL_QUESTION_STATE);
  const [editingIndex, setEditingIndex] = useState(null);

  const availableTenses = ['Todos', ...new Set(questionBank.map(q => q.tense).filter(Boolean))];

  const updateTeamInput = (index, value) => {
    setTeamInputs((prev) => prev.map((t, i) => (i === index ? { ...t, name: value } : t)));
  };

  const updateTeamAvatar = (index, emoji) => {
    setTeamInputs((prev) => prev.map((t, i) => (i === index ? { ...t, avatar: emoji } : t)));
    setOpenAvatarPicker(null);
  };

  const addTeamInput = () => {
    if (teamInputs.length < MAX_TEAMS) {
      setTeamInputs((prev) => [
        ...prev, 
        { name: `Jogador ${prev.length + 1}`, avatar: AVATARS[prev.length % AVATARS.length] }
      ]);
    }
  };

  const removeTeamInput = (index) => {
    if (teamInputs.length > MIN_TEAMS) {
      setTeamInputs((prev) => prev.filter((_, i) => i !== index));
      if (openAvatarPicker === index) setOpenAvatarPicker(null);
    }
  };

  const pickRandomQuestion = (lvl) => {
    let pool = questionBank.filter((q) => q.level === lvl);
    
    if (selectedTense !== 'Todos') {
      pool = pool.filter(q => q.tense === selectedTense);
    }
    
    let available = pool.filter((q) => !usedQuestions.includes(q.sentence));
    if (available.length === 0 && pool.length > 0) {
      available = pool;
    }

    const sourcePool = available.length > 0 ? available : FALLBACK_BANK;
    const chosen = sourcePool[Math.floor(Math.random() * sourcePool.length)];

    setUsedQuestions((prev) => [...prev, chosen.sentence]);
    return chosen;
  };

  const loadQuestion = (lvl) => {
    setFeedback(null);
    setAnswer('');
    setHintShown(false);
    setHintIndex(null);
    setTimeLeft(timeLimit);
    setQuestion(pickRandomQuestion(lvl));
  };

  const startGame = () => {
    const validTeams = teamInputs.filter((t) => t.name.trim() !== '');
    if (validTeams.length < MIN_TEAMS) {
      playSound('wrong_answer.mp3');
      setSetupError(`Informe pelo menos ${MIN_TEAMS} jogador.`);
      return;
    }
    
    const lowerNames = validTeams.map((t) => t.name.toLowerCase().trim());
    if (new Set(lowerNames).size !== lowerNames.length) {
      playSound('wrong_answer.mp3');
      setSetupError('Os nomes dos jogadores precisam ser diferentes.');
      return;
    }

    // Validação extra: Tem pergunta suficiente pro filtro escolhido?
    let poolCheck = questionBank.filter((q) => q.level === level);
    if (selectedTense !== 'Todos') {
      poolCheck = poolCheck.filter(q => q.tense === selectedTense);
    }
    if (poolCheck.length === 0 && questionBank.length > 0) {
      playSound('wrong_answer.mp3');
      setSetupError(`Não há questões de nível ${LEVELS[level].label} no tempo ${selectedTense}.`);
      return;
    }
    
    setSetupError('');
    setTeams(validTeams.map((t) => ({ name: t.name.trim(), avatar: t.avatar, score: 0 })));
    setTurnsDone(0);
    setUsedQuestions([]); 
    setPhase('playing');
    setOpenAvatarPicker(null);
    loadQuestion(level);
    bgm.play().catch(() => {});
  };

  const resetGame = () => {
    bgm.pause();
    bgm.currentTime = 0;
    tipAudio.pause();
    tipAudio.currentTime = 0;
    setPhase('setup');
    setTeams([]);
    setTurnsDone(0);
    setUsedQuestions([]); 
    setQuestion(null);
    setFeedback(null);
    setAnswer('');
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
    setFeedback({ result, earned, givenAnswer: given });
  };

  const contestAnswer = () => {
    if (!feedback) return;
    const earned = LEVELS[level].points;
    setTeams((prev) =>
      prev.map((t, i) => (i === turnIndex ? { ...t, score: t.score + earned } : t))
    );
    playSound('right_answer.mp3'); 
    setFeedback({ ...feedback, result: 'correct', earned, contested: true });
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

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoadingDB(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminPassInput}` },
        body: JSON.stringify(questionBank)
      });
      if (res.ok) {
        setIsAdminAuth(true);
        setSetupError('');
      } else {
        setSetupError('Senha administrativa incorreta.');
      }
    } catch (e) {
      setSetupError('Erro de conexão com o servidor.');
    }
    setIsLoadingDB(false);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    let safeSentence = newQ.sentence.replace(/_{1,}/g, '___');
    if (!safeSentence.includes('___')) {
      safeSentence += ' ___'; 
    }

    const formattedQuestion = {
      ...newQ,
      sentence: safeSentence,
      correctAnswer: newQ.correctAnswer.trim()
    };
    
    let updatedBank;
    if (editingIndex !== null) {
      updatedBank = [...questionBank];
      updatedBank[editingIndex] = formattedQuestion;
    } else {
      updatedBank = [...questionBank, formattedQuestion];
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminPassInput}` },
        body: JSON.stringify(updatedBank)
      });
      
      if (res.ok) {
        setQuestionBank(updatedBank);
        setNewQ(INITIAL_QUESTION_STATE);
        
        if (editingIndex !== null) {
          alert("Questão atualizada com sucesso!");
          setEditingIndex(null);
        } else {
          alert("Nova questão adicionada com sucesso ao banco de dados!");
        }
      } else {
        alert("Erro ao salvar. Verifique a autenticação.");
      }
    } catch (err) {
      alert("Erro de conexão com a Cloudflare.");
    }
    setIsSaving(false);
  };

  const editQuestion = (index) => {
    setNewQ(questionBank[index]);
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (index) => {
    if (!window.confirm("Tem certeza que deseja apagar esta questão?")) return;
    
    setIsSaving(true);
    const updatedBank = questionBank.filter((_, i) => i !== index);
    
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminPassInput}` },
        body: JSON.stringify(updatedBank)
      });
      if (res.ok) {
        setQuestionBank(updatedBank);
        if (editingIndex === index) {
          setEditingIndex(null);
          setNewQ(INITIAL_QUESTION_STATE);
        }
      } else {
        alert("Erro de autenticação ao deletar.");
      }
    } catch(e) {
       alert("Erro ao conectar com a Cloudflare.");
    }
    setIsSaving(false);
  };

  const exportBackup = () => {
    const dataStr = JSON.stringify(questionBank, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bataille_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalTurns = rounds * teams.length;
  const turnIndex = teams.length ? turnsDone % teams.length : 0;
  const currentTeam = teams[turnIndex];
  const ranking = [...teams].sort((a, b) => b.score - a.score);
  const topScore = ranking[0]?.score ?? 0;
  const winners = ranking.filter((t) => t.score === topScore);

  const GlobalControls = () => (
    <div className="fixed top-4 right-4 flex gap-3 z-50">
      {phase === 'setup' && (
        <button
          onClick={() => setPhase('admin')}
          className="p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-white transition"
          title="Área do Moderador"
        >
          <Lock className="w-5 h-5 text-indigo-600" />
        </button>
      )}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-white transition"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-indigo-600" />}
      </button>
    </div>
  );

  // === TELA DO MODERADOR ===
  if (phase === 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-sans p-4 relative">
        <GlobalControls />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        
        <button onClick={() => setPhase('setup')} className="absolute top-4 left-4 p-3 bg-white rounded-full shadow-md flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-bold transition">
          <ArrowLeft className="w-5 h-5" /> Voltar ao jogo
        </button>

        <div className="glass-card bg-white p-8 md:p-10 rounded-[2rem] shadow-xl max-w-3xl w-full my-12">
          {!isAdminAuth ? (
            <form onSubmit={handleAdminLogin} className="flex flex-col items-center max-w-md mx-auto py-10">
              <div className="bg-indigo-100 p-6 rounded-full mb-6">
                <Unlock className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Painel da Professora</h2>
              <p className="text-gray-500 mb-8 text-center">Autentique-se para gerenciar o banco de questões da turma.</p>
              
              <input
                type="password"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="Insira a chave administrativa"
                className="px-6 py-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-lg w-full mb-4 text-center font-bold"
              />
              {setupError && <p className="text-red-500 font-bold mb-4 animate-shake">{setupError}</p>}
              
              <button disabled={isLoadingDB} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-md text-lg transition disabled:opacity-50">
                {isLoadingDB ? 'Validando...' : 'Acessar Painel'}
              </button>
            </form>
          ) : (
            <div className="animate-bounce-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-4 border-b border-gray-100 gap-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-2xl font-extrabold text-gray-800">
                    {editingIndex !== null ? 'Editar Questão' : 'Nova Questão'}
                  </h2>
                </div>
                <div className="flex gap-3">
                  <button onClick={exportBackup} type="button" className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 transition">
                    <Download className="w-4 h-4"/> Backup (JSON)
                  </button>
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                    {questionBank.length} cadastradas
                  </span>
                </div>
              </div>
              
              <form onSubmit={handleSaveQuestion} className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Estrutura Principal (Digitação)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Frase em francês (Use ___ para a lacuna)</label>
                      <input required type="text" value={newQ.sentence} onChange={e => setNewQ({...newQ, sentence: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800" placeholder="Ex: Je ___ une pomme." />
                    </div>
                    
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Verbo (Infinitivo)</label>
                      <input required type="text" value={newQ.infinitive} onChange={e => setNewQ({...newQ, infinitive: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800" placeholder="Ex: manger" />
                    </div>
                    
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Resposta Correta</label>
                      <input required type="text" value={newQ.correctAnswer} onChange={e => setNewQ({...newQ, correctAnswer: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800 font-bold text-indigo-700" placeholder="Ex: mange" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Classificação e Ensino</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Dificuldade</label>
                      <select value={newQ.level} onChange={e => setNewQ({...newQ, level: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-gray-800 font-medium">
                        <option value="facile">Fácil</option>
                        <option value="moyen">Médio</option>
                        <option value="difficile">Difícil</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Tempo Verbal</label>
                      <input required type="text" value={newQ.tense} onChange={e => setNewQ({...newQ, tense: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800" placeholder="Ex: présent" />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Tradução da frase completa para Português</label>
                      <input required type="text" value={newQ.translation} onChange={e => setNewQ({...newQ, translation: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800" placeholder="Ex: Eu como uma maçã." />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 mb-1 block">Explicação Gramatical (Exibida no acerto ou erro)</label>
                      <textarea required rows="2" value={newQ.explanation} onChange={e => setNewQ({...newQ, explanation: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-gray-800 resize-none" placeholder="Por que essa conjugação está correta?" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-4">
                  {editingIndex !== null && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingIndex(null); setNewQ(INITIAL_QUESTION_STATE); }} 
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 px-8 rounded-2xl transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button disabled={isSaving} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl shadow-lg transition flex items-center gap-3 disabled:opacity-50">
                    {isSaving ? 'Salvando na Cloudflare...' : <><Save className="w-5 h-5" /> {editingIndex !== null ? 'Atualizar Questão' : 'Salvar Questão e Publicar'}</>}
                  </button>
                </div>
              </form>

              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-indigo-600" /> Banco de Questões Atual
                </h3>
                
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {questionBank.length === 0 ? (
                    <p className="text-center text-gray-500 py-4 italic">Nenhuma questão cadastrada ainda.</p>
                  ) : (
                    questionBank.map((q, idx) => (
                      <div key={idx} className={`bg-white p-5 rounded-2xl border-2 shadow-sm flex flex-col gap-2 transition-all ${editingIndex === idx ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-bold text-gray-800 text-lg flex-1">
                            {q.sentence.split(/_{1,}/).map((part, i, arr) => (
                              <React.Fragment key={i}>
                                {part}
                                {i < arr.length - 1 && <span className="text-indigo-600 underline decoration-indigo-300 px-1">{q.correctAnswer}</span>}
                              </React.Fragment>
                            ))}
                          </p>
                          <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                              q.level === 'facile' ? 'bg-green-100 text-green-700 border border-green-200' :
                              q.level === 'moyen' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                              'bg-red-100 text-red-700 border border-red-200'
                            }`}>
                              {LEVELS[q.level]?.label || q.level}
                            </span>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => editQuestion(idx)} className="p-2 text-indigo-600 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => deleteQuestion(idx)} disabled={isSaving} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 italic">"{q.translation}"</p>
                        <div className="flex gap-4 mt-2 text-xs font-semibold text-gray-400">
                          <span>Verbo: {q.infinitive}</span>
                          <span>Tempo: {q.tense}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>
    );
  }

  // === TELA DE SETUP ===
  if (phase === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300 font-sans p-4" onClick={() => setOpenAvatarPicker(null)}>
        <GlobalControls />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

        {openAvatarPicker !== null && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-bounce-in"
            onClick={() => setOpenAvatarPicker(null)}
          >
            <div 
              className="bg-white border-4 border-yellow-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-extrabold text-gray-800">Escolha um Avatar</h3>
                <button onClick={() => setOpenAvatarPicker(null)} className="text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-1 transition">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                {AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateTeamAvatar(openAvatarPicker, emoji)}
                    className="text-4xl p-3 bg-gray-50 hover:bg-yellow-100 rounded-2xl transition hover:scale-110 shadow-sm border border-gray-100 hover:border-yellow-300"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="glass-card p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-bounce-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-pink-400 to-yellow-400" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 mb-1">
            Bataille de Verbes
          </h1>
          <p className="text-center text-gray-600 font-medium mb-6">
            {isLoadingDB ? 'Sincronizando questões do servidor...' : 'Aprenda francês brincando! 🥐✨'}
          </p>

          <div className="space-y-6">
            <div className="bg-yellow-50/80 p-4 rounded-3xl border-2 border-yellow-200 shadow-sm">
              <p className="text-sm font-bold text-yellow-700 mb-3 ml-2">Jogadores ({teamInputs.length}/{MAX_TEAMS})</p>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                {teamInputs.map((team, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenAvatarPicker(i)}
                      className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-2xl bg-white border-2 border-yellow-200 rounded-2xl hover:bg-yellow-100 hover:scale-105 transition shadow-sm"
                      title="Escolher Avatar"
                    >
                      {team.avatar}
                    </button>
                    
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeamInput(i, e.target.value)}
                      placeholder={`Jogador ${i + 1}`}
                      maxLength={20}
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-yellow-200 focus:border-yellow-400 outline-none font-bold text-yellow-800 placeholder-yellow-300 bg-white"
                    />
                    {teamInputs.length > MIN_TEAMS && (
                      <button
                        type="button"
                        onClick={() => removeTeamInput(i)}
                        className="p-2 rounded-full bg-white text-red-400 hover:text-red-600 shadow-sm transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {teamInputs.length < MAX_TEAMS && (
                <button
                  type="button"
                  onClick={addTeamInput}
                  className="mt-4 inline-flex items-center justify-center w-full gap-2 text-sm font-bold text-yellow-700 bg-white hover:bg-yellow-100 rounded-2xl py-3 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar jogador
                </button>
              )}
            </div>

            <div className="bg-blue-50/80 p-4 rounded-3xl border-2 border-blue-200 shadow-sm">
              <p className="text-sm font-bold text-blue-700 mb-3 ml-2">
                Rodadas: <span className="bg-blue-600 text-white px-2 py-1 rounded-full">{rounds}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50/80 p-4 rounded-3xl border-2 border-green-200 shadow-sm col-span-2">
                <p className="text-sm font-bold text-green-700 mb-3 ml-2">Nível & Tempo Verbal</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {Object.entries(LEVELS).map(([id, cfg]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLevel(id)}
                      className={`px-2 py-3 rounded-2xl font-bold text-sm transition flex flex-col items-center ${
                        level === id ? 'bg-green-500 text-white shadow-md scale-105' : 'bg-white text-green-600 hover:bg-green-100 shadow-sm'
                      }`}
                    >
                      <span>{cfg.label}</span>
                    </button>
                  ))}
                </div>
                <select 
                  value={selectedTense} 
                  onChange={e => setSelectedTense(e.target.value)} 
                  className="w-full p-3 rounded-2xl border-2 border-green-200 bg-white text-green-800 font-bold focus:border-green-400 outline-none cursor-pointer"
                >
                  {availableTenses.map(t => (
                    <option key={t} value={t}>{t === 'Todos' ? 'Misturar todos os tempos verbais' : t}</option>
                  ))}
                </select>
              </div>

              <div className="bg-orange-50/80 p-4 rounded-3xl border-2 border-orange-200 shadow-sm col-span-2">
                <p className="text-sm font-bold text-orange-700 mb-3 ml-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Contra o Relógio</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 0, label: 'Livre' },
                    { val: 15, label: '15s' },
                    { val: 20, label: '20s' },
                    { val: 30, label: '30s' }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setTimeLimit(opt.val)}
                      className={`px-2 py-3 rounded-2xl font-bold text-sm transition flex flex-col items-center ${
                        timeLimit === opt.val ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-white text-orange-600 hover:bg-orange-100 shadow-sm'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {setupError && <p className="text-red-600 font-bold text-sm text-center animate-shake">{setupError}</p>}

            <button
              disabled={isLoadingDB}
              onClick={startGame}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg transform transition hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-xl disabled:opacity-50"
            >
              Começar a partida <Sparkles className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === TELA FINISHED ===
  if (phase === 'finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-200 font-sans p-4 relative">
        <GlobalControls />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="glass-card p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center animate-bounce-in">
          
          <div className="relative inline-block mb-4">
            <Trophy className="w-24 h-24 text-yellow-500" />
            <div className="absolute -bottom-2 -right-2 text-5xl drop-shadow-md">
              {winners.length === 1 ? winners[0].avatar : '👑'}
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-purple-800 mb-1">
            {teams.length === 1 ? 'Fim de Jogo!' : (winners.length > 1 ? 'Empate!' : `Vitória: ${winners[0].name}!`)}
          </h2>
          <p className="text-gray-600 mb-6">
            {teams.length === 1
              ? `Você fez ${topScore} pontos em ${rounds} rodada(s)!`
              : (winners.length > 1
                ? `${winners.map((w) => w.name).join(' e ')} empataram com ${topScore} pts.`
                : `Com ${topScore} pontos em ${rounds} rodada(s).`)}
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
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-indigo-50 shadow-sm border border-indigo-100">
                    {team.avatar}
                  </span>
                  <span className="font-bold text-gray-700 truncate max-w-[150px]">{team.name}</span>
                </div>
                <span className="font-extrabold text-indigo-600 text-xl">{team.score}</span>
              </div>
            ))}
          </div>
          <button onClick={resetGame} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-3xl shadow-lg transform transition hover:scale-105 text-lg">
            Nova partida
          </button>
        </div>
      </div>
    );
  }

  // === TELA PLAYING ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 via-blue-100 to-purple-100 font-sans flex flex-col md:flex-row relative">
      <GlobalControls />
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="w-full md:w-72 bg-white/60 backdrop-blur-md border-r border-white/40 p-6 flex flex-col shadow-xl z-10">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 rounded-3xl shadow-md text-white mb-6">
          <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">Rodada</p>
          <p className="text-3xl font-extrabold">{Math.min(Math.floor(turnsDone / teams.length) + 1, rounds)} <span className="text-lg opacity-80">de {rounds}</span></p>
          {teams.length > 1 && (
            <p className="mt-2 text-sm opacity-90 flex items-center gap-1">
              Vez de: <span className="font-bold text-lg">{currentTeam?.avatar} {currentTeam?.name}</span>
            </p>
          )}
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[50vh] pr-1">
          {teams.map((team, i) => (
            <div key={team.name} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${i === turnIndex ? 'bg-indigo-50 border-indigo-300 shadow-sm scale-[1.02]' : 'bg-white/80 border-transparent'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl drop-shadow-sm">{team.avatar}</span>
                <span className="font-bold text-gray-700 truncate max-w-[110px]">{team.name}</span>
                {team.score === topScoreInGame(teams) && team.score > 0 && <Star className="w-4 h-4 text-yellow-500 fill-current ml-1" />}
              </div>
              <span className="font-extrabold text-indigo-600 text-lg">{team.score}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">Progresso: {turnsDone}/{totalTurns} perguntas</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="glass-card w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl relative">
          
          {/* Barra de Tempo (Contra o Relógio) */}
          {!feedback && timeLimit > 0 && question && (
             <div className="absolute top-0 left-0 w-full h-3 bg-gray-100 rounded-t-[3rem] overflow-hidden">
               <div 
                 className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-orange-400'}`} 
                 style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
               />
             </div>
          )}

          {!question ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RefreshCw className="w-12 h-12 text-pink-400 animate-spin" />
              <p className="font-bold text-xl text-gray-500">Preparando o desafio...</p>
            </div>
          ) : (
            <div className="animate-bounce-in mt-4">
              {teams.length > 1 && (
                <p className="text-center text-lg font-extrabold text-indigo-700 mb-4 flex justify-center items-center gap-2">
                  <span className="text-2xl">{currentTeam?.avatar}</span> Pergunta para {currentTeam?.name}
                </p>
              )}
              
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <span className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 px-4 py-2 rounded-full font-bold text-sm">Verbo: <span className="uppercase">{question.infinitive}</span></span>
                {question.tense && <span className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full font-bold text-sm">{question.tense}</span>}
              </div>

              <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight">
                  {question.sentence.split(/_{1,}/).map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                      {part}
                      {idx < arr.length - 1 && (
                        <span className={`inline-block mx-2 px-3 py-0.5 rounded-lg border-b-4 border-dashed ${feedback?.result === 'correct' ? 'text-green-600 border-green-400 bg-green-50' : feedback?.result === 'close' ? 'text-yellow-600 border-yellow-400 bg-yellow-50' : feedback ? 'text-red-600 border-red-400 bg-red-50 font-bold' : 'text-indigo-600 border-indigo-300'}`}>
                          {feedback ? (feedback.result === 'correct' ? question.correctAnswer : (feedback.givenAnswer || answer || '(nada)')) : hintShown && hintIndex !== null ? question.correctAnswer.split('').map((char, charIdx) => charIdx === hintIndex ? char : '·').join('') : '\u00A0'}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </h2>
                <p className="text-gray-500 font-medium mt-4 italic text-lg">"{question.translation}"</p>
              </div>

              {!feedback && !hintShown && (
                <div className="flex justify-center mb-4">
                  <button onClick={() => { bgm.pause(); tipAudio.currentTime = 0; tipAudio.play().catch(() => {}); setHintIndex(Math.floor(Math.random() * question.correctAnswer.length)); setHintShown(true); }} className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-full transition">
                    <Lightbulb className="w-4 h-4" /> Dica de letra (pontos ÷ 2)
                  </button>
                </div>
              )}

              {!feedback ? (
                <form onSubmit={(e) => { e.preventDefault(); submitAnswer(answer); }} className="flex flex-col md:flex-row gap-4 justify-center mt-6">
                  <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Digite a forma conjugada..." className="flex-1 px-6 py-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 outline-none text-xl font-bold text-center md:text-left text-indigo-900" autoFocus />
                  <button type="submit" disabled={!answer.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transform transition hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2">Enviar <ArrowRight className="w-5 h-5" /></button>
                </form>
              ) : (
                <div className={`mt-6 p-6 rounded-3xl flex flex-col items-center justify-center border-2 ${feedback.result === 'correct' ? 'bg-green-50 border-green-200 animate-bounce-in' : feedback.result === 'close' ? 'bg-yellow-50 border-yellow-200 animate-bounce-in' : 'bg-red-50 border-red-200 animate-shake'}`}>
                  {feedback.result === 'correct' && (
                    <><CheckCircle2 className="w-14 h-14 text-green-500 mb-2" /><h3 className="text-2xl font-extrabold text-green-700">Magnifique!</h3></>
                  )}
                  {feedback.result === 'close' && (
                    <><CheckCircle2 className="w-14 h-14 text-yellow-500 mb-2" /><h3 className="text-2xl font-extrabold text-yellow-700">Quase!</h3><p className="text-yellow-700 text-sm">Faltou o acento. Pontos reduzidos pela metade.</p></>
                  )}
                  {(feedback.result === 'incorrect' || feedback.result === 'timeout') && (
                    <>
                      <XCircle className="w-14 h-14 text-red-500 mb-2" />
                      <h3 className="text-2xl font-extrabold text-red-700">
                        {feedback.result === 'timeout' ? 'Tempo esgotado!' : 'Dommage...'}
                      </h3>
                      <p className="text-red-600 mb-1">A resposta correta era: <span className="font-black bg-red-200 px-2 py-1 rounded">{question.correctAnswer}</span></p>
                      <div className="my-2 bg-white border border-red-200 rounded-2xl p-3 text-gray-800 text-center shadow-sm w-full max-w-md">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Frase correta completa:</p>
                        <p className="font-extrabold text-lg text-indigo-900">{question.sentence.replace(/_{1,}/, question.correctAnswer)}</p>
                      </div>
                      <button onClick={contestAnswer} className="mt-2 mb-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold py-2 px-5 rounded-xl shadow-sm transition flex items-center gap-2 text-sm">
                        🛡️ Contestar resposta (Aceitar e ganhar pontos)
                      </button>
                    </>
                  )}
                  <p className="font-bold text-indigo-700 mt-2">{feedback.earned > 0 ? `+${feedback.earned} pontos para ${currentTeam?.name}!` : 'Nenhum ponto nesta vez.'}</p>
                  {question.explanation && (
                    <div className="mt-3 bg-white/70 border border-white rounded-2xl p-4 text-gray-700 text-sm max-w-md">
                      <p className="font-bold text-indigo-700 mb-1">💡 Por que é esta forma?</p>
                      <p>{question.explanation}</p>
                    </div>
                  )}
                  <button onClick={nextTurn} className="mt-5 font-bold py-3 px-8 rounded-2xl shadow-md transform transition hover:scale-105 flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white">
                    {turnsDone + 1 >= totalTurns ? 'Ver resultado' : 'Próxima rodada'} <ArrowRight className="w-5 h-5" />
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
