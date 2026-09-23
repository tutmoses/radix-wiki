import pg from 'pg';
import { config } from 'dotenv';
config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const [tag, slug] = process.argv.slice(2);
const { rows } = await c.query('select id,title,version,updated_at,last_verified_at,metadata,content from pages where tag_path=$1 and slug=$2',[tag,slug]);
if(!rows.length){ console.log('NOT FOUND'); } else {
  const p = rows[0];
  console.log('#', p.title, 'v'+p.version, 'updated', p.updated_at.toISOString(), 'verified', p.last_verified_at && p.last_verified_at.toISOString());
  console.log('# metadata', JSON.stringify(p.metadata));
  p.content.forEach((b,i)=>{
    console.log('\n===== block', i, b.type, b.id);
    if (b.text) console.log(b.text);
    if (b.blocks) b.blocks.forEach((n,j)=>console.log('  -- nested',j,n.type,'\n'+(n.text||JSON.stringify(n).slice(0,400))));
    if (!b.text && !b.blocks) console.log(JSON.stringify(b).slice(0,800));
  });
}
c.release(); await pool.end();
