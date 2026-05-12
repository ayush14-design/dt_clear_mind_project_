const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let pool;
let localDB;
const isProduction = !!process.env.POSTGRES_URL;
const isSupabase = !!process.env.SUPABASE_URL;

if (isProduction) {
  console.log("☁️ Running in PRODUCTION mode (Postgres).");
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
} else if (isSupabase) {
  console.log("🌌 Running in CLOUD mode (Supabase).");
} else {
  console.log("⚠️ Running in LOCAL mode (SQLite). No cloud database detected.");
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  localDB = new sqlite3.Database(path.join(dataDir, 'clearmind.db'));
}

function convertSql(sql) {
  if (!isProduction) return sql; // SQLite uses ? already
  let count = 1;
  return sql.replace(/\?/g, () => `$${count++}`);
}

const run = async (sql, params = []) => {
  if (isProduction) {
    const result = await pool.query(convertSql(sql), params);
    return { id: result.rows[0]?.id, changes: result.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      localDB.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

const get = async (sql, params = []) => {
  if (isProduction) {
    const result = await pool.query(convertSql(sql), params);
    return result.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      localDB.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

const all = async (sql, params = []) => {
  if (isProduction) {
    const result = await pool.query(convertSql(sql), params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      localDB.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

async function initDB() {
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      industry TEXT,
      createdAt TEXT,
      streak INTEGER DEFAULT 1,
      totalMinutes INTEGER DEFAULT 0,
      lastActiveDate TEXT,
      roadmap TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS moods (
      ${isProduction ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'},
      userId TEXT,
      emoji TEXT,
      label TEXT,
      note TEXT,
      intensity INTEGER,
      timestamp TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      ${isProduction ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'},
      userId TEXT,
      type TEXT,
      subtype TEXT,
      duration INTEGER,
      timestamp TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS queries (
      ${isProduction ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'},
      userId TEXT,
      query TEXT,
      timestamp TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS journals (
      ${isProduction ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'},
      userId TEXT,
      content TEXT,
      prompt TEXT,
      timestamp TEXT
    )`
  ];

  for (const q of schema) {
    await run(q);
  }
  console.log("✅ Database initialized successfully.");
}

module.exports = { run, get, all, initDB };
