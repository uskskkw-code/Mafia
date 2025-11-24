
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, set, get, update, onValue } from "firebase/database";

export default function MafiaGameOnline() {
  const [gameState, setGameState] = useState('setup');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    if (!roomCode) return;
    const unsub = onValue(ref(db, 'rooms/' + roomCode), (snap) => {
      setRoomData(snap.exists() ? snap.val() : null);
      if (!snap.exists()) setGameState('setup');
    });
    return () => unsub();
  }, [roomCode]);

  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialRoom = {
      code,
      players: [],
      gameState: 'waiting',
      phase: 'night',
      round: 1,
      votes: {}
    };
    await set(ref(db, 'rooms/' + code), initialRoom);
    setRoomCode(code);
    setGameState('waiting');
  };

  const joinRoom = async () => {
    if (!roomCode || !playerName.trim()) return;
    const code = roomCode.toUpperCase();
    const roomRef = ref(db, 'rooms/' + code);
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) {
      alert('غرفة غير موجودة!');
      return;
    }
    const newPlayerId = Date.now() + Math.floor(Math.random() * 9999);
    setPlayerId(newPlayerId);
    setGameState('waiting');
    const room = roomSnap.val();
    if (!room.players.find(p => p.name === playerName)) {
      room.players.push({ id: newPlayerId, name: playerName, role: null, alive: true });
      await update(roomRef, { players: room.players });
    } else {
      setPlayerId(room.players.find(p => p.name === playerName).id);
    }
    setRoomCode(code);
  };

  const startGame = async () => {
    if (!roomData || roomData.players.length < 4) {
      alert('تحتاج 4 لاعبين على الأقل!');
      return;
    }
    let newPlayers = [...roomData.players];
    const mafia = newPlayers.length >= 5 ? 2 : 1;
    let roles = ['شايب', 'طبيب', ...Array(mafia).fill('مافيا'), ...Array(newPlayers.length - mafia - 2).fill('مواطن')];
    newPlayers = newPlayers.map(p => {
      const idx = Math.floor(Math.random() * roles.length);
      const role = roles[idx];
      roles.splice(idx, 1);
      return { ...p, role };
    });
    await update(ref(db, 'rooms/' + roomCode), {
      players: newPlayers,
      gameState: "game",
      phase: "night",
      currentTurn: newPlayers.find(p => p.role === 'مافيا').id
    });
    setGameState('game');
  };

  const isMyTurn = () => {
    return playerId && roomData?.currentTurn === playerId;
  };
  const getPhase = () => roomData?.phase;

  const selectTarget = async (targetId) => {
    if (!isMyTurn()) return;
    let room = { ...roomData };
    const roles = ['مافيا', 'طبيب', 'شايب'];
    for (let role of roles) {
      const alivePlayers = room.players.filter(p => p.alive && p.role === role);
      if (alivePlayers.length && room.phase === 'night' && !alivePlayers.some(p => p.id === playerId)) {
        await update(ref(db, 'rooms/' + roomCode), { currentTurn: alivePlayers[0].id });
        return;
      }
    }
    await update(ref(db, 'rooms/' + roomCode), { phase: "day", currentTurn: null });
  };

  const castVote = (targetId) => {
    if (getPhase() !== 'day') return;
    const newVotes = { ...roomData.votes, [playerId]: targetId };
    update(ref(db, 'rooms/' + roomCode), { votes: newVotes });
  };

  const endDay = async () => {
    const voteCounts = {};
    Object.values(roomData.votes || {}).forEach(id => {
      voteCounts[id] = (voteCounts[id] || 0) + 1;
    });
    const eliminatedId = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let newPlayers = roomData.players.map(p => ({ ...p }));
    if (eliminatedId) {
      const eliminated = newPlayers.find(p => p.id == eliminatedId);
      if (eliminated) eliminated.alive = false;
    }
    await update(ref(db, 'rooms/' + roomCode), {
      players: newPlayers,
      phase: "night",
      round: (roomData.round || 1) + 1,
      currentTurn: newPlayers.find(p => p.role === 'مافيا' && p.alive)?.id || null,
      votes: {}
    });
  };

  if (gameState === 'setup') {
    return (
      <div style={{padding:40,textAlign:'center'}}>
        <h1>🎭 مافيا أونلاين</h1>
        <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="اسمك" />
        <br/>
        <button onClick={createRoom}>✨ إنشاء غرفة جديدة</button>
        <div>أو</div>
        <input
          value={roomCode}
          onChange={e=>setRoomCode(e.target.value.toUpperCase())}
          placeholder="كود الغرفة"
        />
        <button onClick={joinRoom}>🚪 الدخول للغرفة</button>
      </div>
    );
  }

  if (gameState === 'waiting' && roomData) {
    const isHost = roomData?.players[0]?.id === playerId;
    return (
      <div style={{padding:40,textAlign:'center'}}>
        <h2>⏳ غرفة اللعبة / الكود: <b>{roomData.code}</b> </h2>
        <div>اللاعبون ({roomData.players.length}):</div>
        {roomData.players.map(p=><div key={p.id}>{p.name} {p.id===playerId&&'👈 أنت'}</div>)}
        {isHost && roomData.players.length >= 4 && (
          <button onClick={startGame}>🎮 بدأ اللعبة!</button>
        )}
      </div>
    );
  }

  if (gameState === 'game' && roomData) {
    const myPlayer = roomData.players.find(p => p.id === playerId);
    const phase = getPhase();
    if (!myPlayer) return <div>خارج اللعبة</div>;
    if (phase === 'night' && isMyTurn()) {
      return <div style={{padding:60,textAlign:'center'}}>
        <h1>🌙 دورك الحين!</h1>
        <div>دور: <b>{myPlayer.role}</b></div>
        <div>
          {roomData.players.filter(p => p.alive && p.id !== playerId).map(target =>
            <button key={target.id} onClick={()=>selectTarget(target.id)}>
              {target.name}
            </button>
          )}
        </div>
      </div>;
    }
    if (phase === 'night') {
      const activeRole = roomData.players.find(p=> p.id===roomData.currentTurn)?.role;
      return <div style={{padding:60,textAlign:'center'}}>
        <h1>🌙 دور {activeRole || '؟'}</h1>
        <div>انتظر دورك ...</div>
      </div>;
    }
    if (phase === 'day') {
      return <div style={{padding:60,textAlign:'center'}}>
        <h1>☀️ الجولة {roomData.round} - تصويت</h1>
        <div>
        {roomData.players.filter(p=>p.alive).map(player =>
          <button
            key={player.id}
            onClick={()=>castVote(player.id)}
            style={{margin:8, background: roomData.votes?.[playerId]===player.id ? '#C00' : '#ddd'}}
          >
            {player.name}
          </button>
        )}
        </div>
        <button onClick={endDay}>اعتماد التصويت</button>
      </div>;
    }
  }
  return <div>...</div>;
}
