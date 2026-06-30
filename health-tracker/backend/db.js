/**
 * Lightweight JSON file-based data store that mimics the small subset of the
 * node-sqlite3 callback API used in this project (db.run / db.get / db.all).
 *
 * Why: native sqlite3 bindings require compiling against node headers, which
 * is not always possible in locked-down/offline environments. This shim has
 * zero native dependencies, persists to a local JSON file, and is a drop-in
 * replacement for the handful of SQL patterns used by this app's routes.
 *
 * For a production deployment, swap this out for a real database
 * (PostgreSQL/MySQL via an ORM, or sqlite3 with proper native build tools).
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'health_tracker.json');

const DEFAULT_DATA = {
  users: [],
  medical_records: [],
  appointments: [],
  medications: [],
  shared_links: [],
  _seq: { users: 0, medical_records: 0, appointments: 0, medications: 0, shared_links: 0 },
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---- Tiny SQL-pattern interpreter for the exact queries used in this app ----

function matchTable(sql) {
  const m = sql.match(/\b(FROM|INTO|UPDATE)\s+(\w+)/i);
  return m ? m[2] : null;
}

function runInsert(data, sql, params) {
  const table = matchTable(sql);
  const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
  const cols = colsMatch[1].split(',').map((c) => c.trim());
  const row = {};
  cols.forEach((c, i) => (row[c] = params[i] !== undefined ? params[i] : null));
  data._seq[table] = (data._seq[table] || 0) + 1;
  row.id = data._seq[table];
  row.created_at = row.created_at || new Date().toISOString();
  data[table].push(row);
  saveData(data);
  return row.id;
}

function applyWhere(rows, sql, params) {
  const whereMatch = sql.match(/WHERE\s+(.+?)(\s+ORDER BY|\s+LIMIT|$)/is);
  if (!whereMatch) return rows;
  const clause = whereMatch[1].trim();
  const conditions = clause.split(/\s+AND\s+/i);
  return rows.filter((row) => {
    let pIdx = 0;
    return conditions.every((cond) => {
      const m = cond.match(/(\w+)\s*=\s*\?/);
      if (!m) return true;
      const field = m[1];
      const value = params[pIdx++];
      return String(row[field]) === String(value);
    });
  });
}

function applyOrder(rows, sql) {
  const orderMatch = sql.match(/ORDER BY\s+(.+?)(\s+LIMIT|$)/is);
  if (!orderMatch) return rows;
  const parts = orderMatch[1].split(',').map((p) => p.trim());
  return [...rows].sort((a, b) => {
    for (const part of parts) {
      const [field, dir] = part.split(/\s+/);
      const desc = /desc/i.test(dir || '');
      let av = a[field];
      let bv = b[field];
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
    }
    return 0;
  });
}

function runSelect(data, sql, params) {
  const table = matchTable(sql);
  let rows = [...(data[table] || [])];

  // very small join support for the one JOIN query used (shared_links + medical_records)
  if (/JOIN/i.test(sql)) {
    const joinTableMatch = sql.match(/JOIN\s+(\w+)\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
    if (joinTableMatch) {
      const [, joinTable, , aliasA, fieldA, aliasB, fieldB] = joinTableMatch;
      const joinRows = data[joinTable] || [];
      const baseAliasMatch = sql.match(/FROM\s+\w+\s+(\w+)/i);
      const baseAlias = baseAliasMatch ? baseAliasMatch[1] : null;
      rows = rows
        .map((row) => {
          const leftField = aliasA === baseAlias ? fieldA : fieldB;
          const rightField = aliasA === baseAlias ? fieldB : fieldA;
          const match = joinRows.find((jr) => String(jr[rightField]) === String(row[leftField]));
          return match ? { ...row, ...match, id: row.id } : null;
        })
        .filter(Boolean);
    }
  }

  rows = applyWhere(rows, sql, params);
  rows = applyOrder(rows, sql);

  const countMatch = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
  if (countMatch) {
    return [{ [countMatch[1]]: rows.length }];
  }

  return rows;
}

function runUpdate(data, sql, params) {
  const table = matchTable(sql);
  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
  const setClause = setMatch[1];
  const setFields = setClause.split(',').map((s) => s.split('=')[0].trim());
  const whereMatch = sql.match(/WHERE\s+(.+)$/is);
  const whereClause = whereMatch ? whereMatch[1].trim() : null;
  const whereFields = whereClause
    ? whereClause.split(/\s+AND\s+/i).map((c) => c.match(/(\w+)\s*=\s*\?/)[1])
    : [];

  const setValues = params.slice(0, setFields.length);
  const whereValues = params.slice(setFields.length);

  let changes = 0;
  data[table] = data[table].map((row) => {
    const matches = whereFields.every((f, i) => String(row[f]) === String(whereValues[i]));
    if (matches) {
      changes++;
      const updated = { ...row };
      setFields.forEach((f, i) => (updated[f] = setValues[i]));
      return updated;
    }
    return row;
  });
  saveData(data);
  return changes;
}

function runDelete(data, sql, params) {
  const table = matchTable(sql);
  const whereMatch = sql.match(/WHERE\s+(.+)$/is);
  const whereClause = whereMatch ? whereMatch[1].trim() : null;
  const whereFields = whereClause
    ? whereClause.split(/\s+AND\s+/i).map((c) => c.match(/(\w+)\s*=\s*\?/)[1])
    : [];

  const before = data[table].length;
  if (whereFields.length) {
    data[table] = data[table].filter((row) => {
      const matches = whereFields.every((f, i) => String(row[f]) === String(params[i]));
      return !matches;
    });
  } else {
    data[table] = [];
  }
  const changes = before - data[table].length;
  saveData(data);
  return changes;
}

const db = {
  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    callback = callback || function () {};
    try {
      const data = loadData();
      let result;
      if (/^\s*INSERT/i.test(sql)) {
        const id = runInsert(data, sql, params);
        result = { lastID: id, changes: 1 };
      } else if (/^\s*UPDATE/i.test(sql)) {
        const changes = runUpdate(data, sql, params);
        result = { lastID: null, changes };
      } else if (/^\s*DELETE/i.test(sql)) {
        const changes = runDelete(data, sql, params);
        result = { lastID: null, changes };
      } else {
        result = { lastID: null, changes: 0 };
      }
      callback.call(result, null);
    } catch (err) {
      callback.call({}, err);
    }
  },

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const data = loadData();
      const rows = runSelect(data, sql, params);
      callback(null, rows[0] || undefined);
    } catch (err) {
      callback(err);
    }
  },

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const data = loadData();
      const rows = runSelect(data, sql, params);
      callback(null, rows);
    } catch (err) {
      callback(err);
    }
  },

  serialize(fn) {
    fn();
  },
};

// Ensure data file exists on load
loadData();

module.exports = db;
