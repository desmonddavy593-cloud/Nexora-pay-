const fs = require('fs').promises;
const path = require('path');
const { pool } = require('./db');

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL manquant, migrations ignorées');
    return;
  }

  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '001_initial.sql');
  let sql;
  try {
    sql = await fs.readFile(migrationPath, 'utf8');
  } catch (error) {
    console.error(`Lecture des migrations impossible : ${error.message}`);
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await pool.query(sql);
      console.log('Migrations appliquées');
      return;
    } catch (error) {
      console.error(`Migration échouée (tentative ${attempt}/${MAX_ATTEMPTS}) : ${error.message}`);
      if (attempt < MAX_ATTEMPTS) await wait(RETRY_DELAY_MS);
    }
  }

  console.error('Migrations abandonnées après 5 tentatives');
}

module.exports = migrate;
