import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql.railway.internal',
  port: process.env.DB_PORT || 47187,   // ✅ Railway port
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sxdqGkBtLlELfMjdZtDoeMlYMtvMSKeM',
  database: process.env.DB_NAME || 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
