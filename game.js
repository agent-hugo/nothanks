/* No Thanks! — игровая логика без сети и DOM.
   Работает и в браузере (window.NoThanks), и в Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoThanks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 7;
  const CARDS_IN_PLAY = 24;

  // Сколько фишек у каждого игрока по правилам.
  function chipsFor(n, tactical) {
    if (tactical) return 10;
    return n <= 5 ? 11 : n === 6 ? 9 : 7;
  }

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** players: [{id, name}] */
  function newGame(players, opts, rnd) {
    opts = opts || {};
    rnd = rnd || Math.random;
    const n = players.length;
    if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
      throw new Error(`Нужно от ${MIN_PLAYERS} до ${MAX_PLAYERS} игроков`);
    }
    const tactical = !!opts.tactical;
    const pool = [];
    for (let c = 3; c <= 35; c++) {
      if (tactical && c % 10 === 0) continue; // 10, 20, 30 убираются
      pool.push(c);
    }
    shuffle(pool, rnd);
    const deck = pool.slice(0, CARDS_IN_PLAY); // остальные карты отложены и не используются
    const chips = chipsFor(n, tactical);
    return {
      phase: 'play',
      tactical,
      card: deck[0],
      deck: deck.slice(1),
      pot: 0,
      turn: Math.floor(rnd() * n),
      players: players.map(p => ({ id: p.id, name: p.name, chips, cards: [] })),
      log: [],
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function canPass(state, playerId) {
    const p = state.players[state.turn];
    return state.phase === 'play' && p.id === playerId && p.chips > 0;
  }

  /** type: 'take' | 'pass'. Возвращает новое состояние, исходное не меняет. */
  function apply(state, playerId, type) {
    if (state.phase !== 'play') throw new Error('Партия не идёт');
    const s = clone(state);
    const p = s.players[s.turn];
    if (p.id !== playerId) throw new Error('Сейчас не ваш ход');

    let entry;
    if (type === 'pass') {
      if (p.chips <= 0) throw new Error('Фишек нет — нужно взять карту');
      p.chips -= 1;
      s.pot += 1;
      entry = { pid: p.id, type, card: s.card };
      s.turn = (s.turn + 1) % s.players.length;
    } else if (type === 'take') {
      entry = { pid: p.id, type, card: s.card, pot: s.pot };
      p.cards.push(s.card);
      p.cards.sort((a, b) => a - b);
      p.chips += s.pot;
      s.pot = 0;
      if (s.deck.length === 0) {
        s.card = null;
        s.phase = 'end';
      } else {
        s.card = s.deck.shift(); // взявший открывает следующую карту и ходит снова
      }
    } else {
      throw new Error('Неизвестное действие: ' + type);
    }
    s.log = (s.log || []).concat(entry).slice(-40);
    return s;
  }

  /** Разбивает отсортированные карты на цепочки подряд идущих номеров. */
  function runs(cards) {
    const sorted = cards.slice().sort((a, b) => a - b);
    const out = [];
    for (const c of sorted) {
      const last = out[out.length - 1];
      if (last && c === last[last.length - 1] + 1) last.push(c);
      else out.push([c]);
    }
    return out;
  }

  /** Очки за карты: каждая цепочка считается по наименьшей карте. */
  function cardPoints(cards) {
    return runs(cards).reduce((sum, r) => sum + r[0], 0);
  }

  function score(player) {
    const pts = cardPoints(player.cards);
    return { cards: pts, chips: player.chips, total: pts - player.chips };
  }

  /** Итоговая таблица: меньше очков — выше место. Равные очки делят место. */
  function ranking(state) {
    const rows = state.players
      .map(p => Object.assign({ id: p.id, name: p.name }, score(p)))
      .sort((a, b) => a.total - b.total);
    rows.forEach((r, i) => {
      r.place = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].place : i + 1;
    });
    return rows;
  }

  return {
    MIN_PLAYERS, MAX_PLAYERS, CARDS_IN_PLAY,
    chipsFor, newGame, apply, canPass, runs, cardPoints, score, ranking,
  };
});
