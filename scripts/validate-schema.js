#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function collectSourceContracts(srcRoot) {
  const tables = new Set();
  const rpcs = new Set();
  for (const file of walk(srcRoot).filter((item) => /\.jsx?$/.test(item))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) tables.add(match[1]);
    for (const match of source.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) rpcs.add(match[1]);
  }
  return { tables, rpcs };
}

function add(violations, rule, message) {
  violations.push({ rule, message });
}

function hasCreateTable(sql, table) {
  return new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`, 'i').test(sql);
}

function hasCreateFunction(sql, rpc) {
  return new RegExp(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${rpc}\\s*\\(`, 'i').test(sql);
}

function validateCanonicalSchema(root) {
  const violations = [];
  const schemaPath = path.join(root, 'supabase', 'schema_current.sql');
  if (!fs.existsSync(schemaPath)) {
    add(violations, 'missing-schema', 'supabase/schema_current.sql does not exist.');
    return violations;
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const normalized = sql.replace(/--.*$/gm, ' ');
  const contracts = collectSourceContracts(path.join(root, 'src'));

  for (const table of contracts.tables) {
    if (!hasCreateTable(normalized, table)) add(violations, 'missing-table', `Missing table ${table}.`);
  }
  for (const rpc of contracts.rpcs) {
    if (!hasCreateFunction(normalized, rpc)) add(violations, 'missing-rpc', `Missing RPC ${rpc}.`);
  }

  const ownerTables = [
    ...contracts.tables,
    'coaching_messages',
  ];
  for (const table of new Set(ownerTables)) {
    if (!new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(normalized)) {
      add(violations, 'missing-rls', `RLS is not enabled for ${table}.`);
    }
  }

  const exerciseLogsBlock = normalized.match(/create\s+table\s+if\s+not\s+exists\s+(?:public\.)?exercise_logs\s*\(([\s\S]*?)\);/i)?.[1] || '';
  if (!/sets\s+jsonb\s+not\s+null/i.test(exerciseLogsBlock)
      || !/best_set\s+jsonb/i.test(exerciseLogsBlock)
      || !/unique\s*\(\s*user_id\s*,\s*exercise_id\s*,\s*date\s*\)/i.test(exerciseLogsBlock)) {
    add(violations, 'flat-log-contract', 'exercise_logs must use JSONB sets/best_set and a stable user/exercise/date uniqueness contract.');
  }

  if (/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(?:exercise_sessions|exercise_sets)\b/i.test(normalized)) {
    add(violations, 'obsolete-schema', 'Normalized exercise_sessions/exercise_sets must not be canonical.');
  }
  if (/auth\.users\s+limit\s+1/i.test(normalized)) add(violations, 'arbitrary-user', 'RPC selects an arbitrary auth user.');
  if (/select\s+api_key\b/i.test(normalized)) add(violations, 'secret-output', 'Schema emits secret key material.');

  for (const match of normalized.matchAll(/create\s+or\s+replace\s+function\s+([^\s(]+)[\s\S]*?security\s+definer([\s\S]*?)\$\$;/gi)) {
    const functionName = match[1];
    const block = match[0];
    if (!/set\s+search_path\s*=\s*public/i.test(block)) {
      add(violations, 'unsafe-security-definer', `${functionName} does not pin search_path.`);
    }
  }
  if (/security\s+definer/i.test(normalized) && !/revoke\s+all\s+on\s+function\s+public\.get_coach_data\(uuid\)\s+from\s+public/i.test(normalized)) {
    add(violations, 'unsafe-security-definer', 'get_coach_data must revoke PUBLIC execution before explicit grants.');
  }

  return violations;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || process.cwd());
  const violations = validateCanonicalSchema(root);
  if (violations.length) {
    console.error(`Canonical schema: FAIL (${violations.length})`);
    for (const item of violations) console.error(`- [${item.rule}] ${item.message}`);
    process.exitCode = 1;
  } else {
    console.log('Canonical schema: PASS');
  }
}

module.exports = { collectSourceContracts, validateCanonicalSchema };
