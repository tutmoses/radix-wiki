import pg from 'pg';
import { config } from 'dotenv';
config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const { rows } = await c.query("select content from pages where tag_path='ecosystem' and slug='caper'");
const text = rows[0].content[0].text;
console.log('len', text.length);
console.log('U+00A0 count', (text.match(/ /g)||[]).length);
for (const needle of ['10^(6-x)', 'Supermajority Requirements', 'price vesting']) {
  const i = text.indexOf(needle);
  console.log('\n##### ', needle, 'at', i);
  console.log(JSON.stringify(text.slice(i-260, i+900)));
}
c.release(); await pool.end();
