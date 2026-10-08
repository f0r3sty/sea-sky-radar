const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (win && !win.isDestroyed()) { win.show(); win.focus(); } });
}

const configPath = () => path.join(app.getPath('userData'), 'config.json');
function loadConfig() { try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; } }
function saveConfig(partial) {
  const cfg = Object.assign(loadConfig(), partial);
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2)); } catch {}
  return cfg;
}

const WIN_W = 420, WIN_H = 292;
let win = null;

function applyPin(mode) {
  if (!win || win.isDestroyed()) return;
  const onTop = mode === 'top';
  try { if (process.platform === 'win32') win.setAlwaysOnTop(onTop); else win.setAlwaysOnTop(true, onTop ? 'floating' : 'desktop'); } catch (e) {}
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: onTop }); } catch (e) {}
}

function createWindow() {
  const cfg = loadConfig();
  const area = screen.getPrimaryDisplay().workAreaSize;
  const ds = screen.getAllDisplays();
  const dl = Math.min(...ds.map((d) => d.workArea.x)), dt = Math.min(...ds.map((d) => d.workArea.y));
  const dr = Math.max(...ds.map((d) => d.workArea.x + d.workArea.width)), db = Math.max(...ds.map((d) => d.workArea.y + d.workArea.height));
  win = new BrowserWindow({
    width: WIN_W, height: WIN_H,
    x: Math.max(dl, Math.min(Number.isFinite(cfg.wx) ? cfg.wx : area.width - WIN_W - 60, dr - WIN_W)),
    y: Math.max(dt, Math.min(Number.isFinite(cfg.wy) ? cfg.wy : area.height - WIN_H - 60, db - WIN_H)),
    frame: false, transparent: true, resizable: false, hasShadow: false,
    skipTaskbar: true, fullscreenable: false, alwaysOnTop: true, title: '海空雷达',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  applyPin(cfg.pin || 'desktop');
  win.on('moved', () => { const [x, y] = win.getPosition(); saveConfig({ wx: x, wy: y }); });
  win.on('closed', () => { win = null; });
  if (process.env.SHOT) {
    setTimeout(async () => {
      try { const img = await win.webContents.capturePage(); fs.writeFileSync('/tmp/ss_shot.png', img.toPNG()); console.log('[shot] saved'); app.exit(0); } catch (e) { app.exit(1); }
    }, Number(process.env.SHOT) || 16000);
  }
}

app.whenReady().then(() => { createWindow(); openShipWS(); app.on('activate', () => { if (!win) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---------- OpenSeaFeed（船舶）----------
let ships = new Map(); // mmsi -> {lat,lon,sog,cog,name,callsign,dest,ts}
let shipWS = null;
let shipBox = null;
let wsTimer = null;

function prune() {
  const cut = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of ships) if (v.ts < cut) ships.delete(k);
}

function applyBox(box) {
  shipBox = box;
  if (shipWS && shipWS.readyState === 1) {
    try { const msg = JSON.stringify({ BoundingBoxes: box ? [box] : [[[-70, -180], [75, 180]]] }); console.log('[ships] subscribe', msg.slice(0, 100)); shipWS.send(msg); } catch (e) { console.log('[ships] send err', e.message); }
  }
}

function openShipWS() {
  try { if (shipWS) { shipWS.close(); shipWS = null; } } catch (e) {}
  try {
    shipWS = new WebSocket('wss://stream.openseafeed.com/v1/stream');
    shipWS.onopen = () => { console.log('[ships] ws open'); applyBox(shipBox); };
    shipWS.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        const md = d.MetaData || {};
        const mmsi = String(md.MMSI || md.MMSI_String || '');
        if (!mmsi) return;
        const pr = d.Message && d.Message.PositionReport;
        const cur = ships.get(mmsi) || {};
        const lat = pr ? pr.Latitude : md.latitude;
        const lon = pr ? pr.Longitude : md.longitude;
        if (lat == null || lon == null) return;
        ships.set(mmsi, {
          mmsi, lat, lon,
          sog: pr ? pr.SpeedOverGround : cur.sog,
          cog: pr ? pr.Cog : cur.cog,
          name: md.ShipName || cur.name || '',
          callsign: md.CallSign || cur.callsign || '',
          dest: md.Destination || cur.dest || '',
          type: md.ShipType || cur.type || 0,
          ts: Date.now(),
        });
      } catch (e) {}
    };
    shipWS.onerror = () => {};
    shipWS.onclose = () => { shipWS = null; clearTimeout(wsTimer); wsTimer = setTimeout(openShipWS, 8000); };
  } catch (e) {}
}

ipcMain.handle('ships:snap', () => { prune(); return Array.from(ships.values()); });
ipcMain.handle('ships:setbox', (_e, box) => { applyBox(box); return true; });

setInterval(openShipWS, 60 * 60 * 1000); // 保险
setInterval(() => { if (ships.size) console.log('[ships] count', ships.size); }, 10000);

ipcMain.handle('widget:pin', (_e, mode) => { saveConfig({ pin: mode }); applyPin(mode); return mode; });
ipcMain.handle('widget:close', () => { if (win) win.close(); return true; });
ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_e, p) => saveConfig(p));
ipcMain.handle('open:external', (_e, u) => { shell.openExternal(u); return true; });