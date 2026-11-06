// Renders one shard of the video as JPEG stills, then encodes a segment mp4.
// Usage: node render_shard.mjs <shard> <numShards> <totalFrames> [fps]
// Frames are global indices: shard s of N covers [s*ceil(total/N), min(total, (s+1)*ceil(total/N))).
// Each frame is independent: renderAt(t) depends only on t, and shot7 already
// replays its pre-release state when a render starts mid-shot.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = server.address().port;

const GL = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu'];
const browser = await chromium.launch({ args: [...GL, '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.setDefaultTimeout(120000);
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?render=1`);
await page.waitForFunction(() => window.renderAt && window.ready);
await page.evaluate(() => window.ready);
// Freeze the rAF loop's renderAt so it cannot race the exact time we set per frame.
await page.evaluate(() => { window.__renderAt = window.renderAt; window.renderAt = () => {}; });

const shard = Number(process.argv[2]);
const numShards = Number(process.argv[3]);
const total = Number(process.argv[4]);
const fps = Number(process.argv[5] || 30);
const per = Math.ceil(total / numShards);
const n0 = shard * per;
const n1 = Math.min(total, n0 + per);
fs.mkdirSync('frames', { recursive: true });
const T0 = Date.now();
for (let n = n0; n < n1; n++) {
  await page.evaluate(t => window.__renderAt(t), n / fps);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 720, height: 1280 }, type: 'jpeg', quality: 92, timeout: 120000 });
  fs.writeFileSync(`frames/frame_${String(n).padStart(4, '0')}.jpg`, buf);
  if ((n - n0) % 10 === 0 || n === n1 - 1) console.log(`frame ${n}/${n1} ${((Date.now() - T0) / (n - n0 + 1)).toFixed(0)} ms/frame`);
}
await browser.close();
server.close();

const seg = `seg_${String(shard).padStart(2, '0')}.mp4`;
const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', String(n0), '-i', 'frames/frame_%04d.jpg', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', seg], { stdio: 'inherit' });
if (ff.status !== 0) { console.error('ffmpeg segment encode failed'); process.exit(1); }
console.log('wrote', seg);
