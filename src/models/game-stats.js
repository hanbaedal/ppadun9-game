const { getDb } = require('../config/db');

function getGameStatsCollection() {
    const db = getDb();
    return db.collection('game-stats');
}

module.exports = { getGameStatsCollection }; 