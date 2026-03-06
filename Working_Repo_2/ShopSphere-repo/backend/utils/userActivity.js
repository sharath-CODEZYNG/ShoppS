import pool from '../config/db.js';

function toPositiveInt(value) {
const n = Number(value);
return Number.isInteger(n) && n > 0 ? n : null;
}

const ACTIVITY_TABLE_CANDIDATES = ['user_activity', 'user_Activity'];

let cachedShape = null;

function pickColumn(columns, candidates) {
const lowerMap = new Map(columns.map((c) => [String(c).toLowerCase(), c]));
for (const name of candidates) {
const hit = lowerMap.get(name.toLowerCase());
if (hit) return hit;
}
return null;
}

async function resolveActivityShape(executor) {
if (cachedShape) return cachedShape;

for (const tableName of ACTIVITY_TABLE_CANDIDATES) {
const [tableRows] = await executor.query(
`SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
LIMIT 1`,
[tableName]
);

if (!tableRows.length) {
continue;
}

const [columnRows] = await executor.query(
`SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION`,
[tableName]
);

const columns = columnRows.map((r) => r.COLUMN_NAME);

const userCol = pickColumn(columns, ['user_id', 'userid', 'userId', 'user']);
const productCol = pickColumn(columns, ['product_id', 'productid', 'productId', 'product']);
const actionCol = pickColumn(columns, ['action', 'activity', 'activity_type', 'event_type', 'type']);
const timeCol = pickColumn(columns, ['timestamp', 'created_at', 'activity_time', 'createdAt', 'time']);

if (!userCol || !productCol || !actionCol) {
continue;
}

cachedShape = { tableName, userCol, productCol, actionCol, timeCol };
return cachedShape;
}

cachedShape = null;
return null;
}

export async function trackUserActivity({
userId,
productId,
action,
dedupeWindowSeconds = 0,
connection = null
}) {
const uid = toPositiveInt(userId);
const pid = toPositiveInt(productId);
const act = typeof action === 'string' ? action.trim().toLowerCase() : '';

if (!uid || !pid || !act) {
return false;
}

const executor = connection || pool;

try {
const shape = await resolveActivityShape(executor);
if (!shape) {
console.warn('[user_activity] table not found or missing required columns');
return false;
}

if (
dedupeWindowSeconds > 0 &&
act === 'view' &&
shape.timeCol
) {
const [recent] = await executor.query(
`SELECT 1
FROM ${shape.tableName}
WHERE ${shape.userCol} = ?
AND ${shape.productCol} = ?
AND ${shape.actionCol} = ?
AND ${shape.timeCol} >= (NOW() - INTERVAL ? SECOND)
LIMIT 1`,
[uid, pid, act, dedupeWindowSeconds]
);

if (recent.length > 0) {
return false;
}
}

const columns = [shape.userCol, shape.productCol, shape.actionCol];
const values = [uid, pid, act];
const placeholders = ['?', '?', '?'];

if (shape.timeCol) {
columns.push(shape.timeCol);
placeholders.push('NOW()');
}

const sql = `INSERT INTO ${shape.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
await executor.query(sql, values);
return true;
} catch (err) {
console.warn('[user_activity] track failed:', err?.message || err);
return false;
}
}

