const crypto = require("crypto");

const SYMBOLS = ["1", "2", "3", "4"];
const SYMBOL_VALUES = { "1": 1, "2": 2, "3": 3, "4": 4 };

function makeRoomCode() {
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function newBoard(size = 16) {
  // 35% chance for the board to contain ANY special tiles at all.
  const isHighStakesRound = Math.random() < 0.35;
  let superCount = 0;
  let uncommonCount = 0;

  return Array.from({ length: size }, () => {
    if (isHighStakesRound) {
      const roll = Math.random();
      
      // Within a high stakes round, enforce max counts: 2 Super, 4 Uncommon
      if (roll < 0.10 && superCount < 2) {
        superCount++;
        return { rarity: "super", value: Math.floor(Math.random() * 16) + 15 };
      } 
      if (roll < 0.25 && uncommonCount < 4) {
        uncommonCount++;
        return { rarity: "uncommon", value: Math.floor(Math.random() * 10) + 5 };
      }
    }

    // Default to Common
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    return { rarity: "common", value: SYMBOL_VALUES[sym] };
  });
}

/**
 * Calculates pure score results for a round.
 * @returns { attackerPoints, defenderPoints, hitSet, missSet }
 */
function calculateRoundScore(defended, attacked, board) {
  const hitSet = attacked.filter((i) => defended.includes(i));
  const missSet = defended.filter((i) => !hitSet.includes(i));

  const valueAt = (tileIdx) => board[tileIdx]?.value || 0;

  const attackerPoints = hitSet.reduce((sum, i) => sum + valueAt(i), 0);
  const defenderPoints = missSet.reduce((sum, i) => sum + valueAt(i), 0);

  return {
    attackerPoints,
    defenderPoints,
    hits: hitSet,
    misses: missSet
  };
}

module.exports = { makeRoomCode, newBoard, calculateRoundScore, SYMBOL_VALUES };