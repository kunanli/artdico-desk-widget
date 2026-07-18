// ============================================================
// ARTDiCO 导师课表桌面浮窗 · Electron 薄壳 · v0.1
// 职责：一个置顶小窗口，载入 widget.html 的网址。UI/逻辑全在 widget.html。
// 改动这个壳很少发生；日常迭代都在 artdico-deck/widget.html（走 OSS 部署）。
// ============================================================
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// 桌面挂件：去掉「File Edit View…」菜单栏（整个 app 无菜单）
Menu.setApplicationMenu(null);

// 载入的网页地址 · 改这里即可切换（也可用环境变量 ARTDICO_WIDGET_URL 覆盖）
const WIDGET_URL = process.env.ARTDICO_WIDGET_URL || 'https://portal.artdico.cc/widget.html';
// 安全加固：窗口只允许停留在这个源（页面被诱导跳转也去不了别处）
let ALLOWED_ORIGIN = 'https://portal.artdico.cc';
try { ALLOWED_ORIGIN = new URL(WIDGET_URL).origin; } catch (e) {}

let win = null;
let tray = null;
let _isMini = false;
const MINI_H = 96;
const boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');  // 正常（展开）尺寸
const prefFile   = path.join(app.getPath('userData'), 'widget-pref.json');     // { mini, x, y } 上次状态

// 单例锁：重复启动只聚焦已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
}

function _loadJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function loadBounds() { return _loadJSON(boundsFile); }
function loadPref() { return _loadJSON(prefFile) || {}; }
function savePref() {
  try { const b = win ? win.getBounds() : {}; fs.writeFileSync(prefFile, JSON.stringify({ mini: _isMini, x: b.x, y: b.y })); } catch (e) {}
}
function saveBounds() {
  if (!win) return;
  // 迷你时只记位置（不覆盖展开尺寸）· 展开时记完整尺寸
  if (!_isMini) { try { fs.writeFileSync(boundsFile, JSON.stringify(win.getBounds())); } catch (e) {} }
  savePref();
}

function createWindow() {
  const nb = loadBounds() || {};
  const pref = loadPref();
  _isMini = pref.mini === true;   // 跟随上次状态（页面 localStorage 为准 · 载入后会再同步）
  win = new BrowserWindow({
    width:  nb.width || 380,
    height: _isMini ? MINI_H : (nb.height || 560),
    x: (pref.x != null ? pref.x : nb.x),
    y: (pref.y != null ? pref.y : nb.y),
    minWidth: 300, minHeight: _isMini ? 68 : 380,
    title: 'ARTDiCO 课表浮窗',
    backgroundColor: '#0A0A0A',
    frame: false,            // 无原生标题栏（挂件感）· 拖动/关闭由页面顶栏负责
    icon: path.join(__dirname, 'icon.png'),   // 任务栏 / Alt-Tab 图标（橙色 A）
    alwaysOnTop: true,
    fullscreenable: false,
    maximizable: false,
    skipTaskbar: false,      // 仍留任务栏入口（也可改 true 纯托盘常驻）
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, 'floating');       // 浮在其它窗口之上
  win.setVisibleOnAllWorkspaces(true);
  win.loadURL(WIDGET_URL);

  // 页面里的外链（如帮助文档）用系统浏览器打开，不在浮窗里跳走
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // 安全加固：锁死导航目标 · 只允许 ALLOWED_ORIGIN · 其余一律拦下（外链交系统浏览器）
  const guardNav = (e, url) => {
    let origin = '';
    try { origin = new URL(url).origin; } catch (_) {}
    if (origin !== ALLOWED_ORIGIN) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  };
  win.webContents.on('will-navigate', guardNav);
  win.webContents.on('will-redirect', guardNav);

  win.on('close', saveBounds);
  win.on('moved', saveBounds);
  win.on('resized', saveBounds);
  win.on('closed', () => { win = null; });
}

function toggleWindow() {
  if (!win) return createWindow();
  win.isVisible() ? win.hide() : (win.show(), win.focus());
}

function createTray() {
  // 橙色 A 托盘图标（右下角系统托盘）
  let icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('ARTDiCO 课表浮窗');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: toggleWindow },
    { label: '始终置顶', type: 'checkbox', checked: true,
      click: (item) => { if (win) win.setAlwaysOnTop(item.checked, 'floating'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', toggleWindow);
}

// 窗口控制（页面顶栏的 – / ✕ 通过 preload → IPC 调这里）
ipcMain.on('widget:minimize', () => { if (win) win.minimize(); });
ipcMain.on('widget:hide',     () => { if (win) win.hide(); });   // ✕ = 收起到托盘（托盘点回来）
ipcMain.on('widget:quit',     () => { app.isQuitting = true; app.quit(); });

// 迷你模式：收缩到一条（只显示下一堂）/ 恢复展开尺寸
ipcMain.on('widget:mini', (e, on) => {
  if (!win) return;
  if (on) {
    if (!_isMini) { try { fs.writeFileSync(boundsFile, JSON.stringify(win.getBounds())); } catch (e) {} }  // 先记住展开尺寸
    _isMini = true;
    const b = win.getBounds();
    win.setMinimumSize(260, 68);
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: MINI_H });
  } else {
    _isMini = false;
    win.setMinimumSize(300, 380);
    const nb = loadBounds() || {};
    const b = win.getBounds();
    win.setBounds({ x: b.x, y: b.y, width: nb.width || Math.max(b.width, 360), height: nb.height || 560 });
  }
  savePref();
});

// 课前系统通知（页面算好时机 → 这里用原生通知弹出 · 带橙 A 图标）
ipcMain.on('widget:notify', (e, data) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: (data && data.title) || 'ARTDiCO',
    body:  (data && data.body) || '',
    icon:  path.join(__dirname, 'icon.png'),
    silent: false
  });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
});

// 自动更新（generic 源 · deck.artdico.cc/desk-widget/ · 国内 CDN 免 token）
function setupAutoUpdate() {
  if (!app.isPackaged) return;   // 开发态跳过（无更新源会报错）
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;   // 后台下好 · 下次退出静默安装
  autoUpdater.on('error', (err) => console.warn('[updater]', err && err.message));
  autoUpdater.on('update-downloaded', (info) => {
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'ARTDiCO 挂件有新版本',
        body: `v${info && info.version || ''} 已下载 · 退出后自动更新`,
        icon: path.join(__dirname, 'icon.png')
      });
      n.show();
    }
  });
  const check = () => { autoUpdater.checkForUpdates().catch(() => {}); };
  check();                                   // 启动检查一次
  setInterval(check, 6 * 60 * 60 * 1000);    // 之后每 6 小时
}

app.whenReady().then(() => { createWindow(); createTray(); setupAutoUpdate(); });

// 关掉窗口不退出（常驻托盘）· 从托盘再打开
app.on('window-all-closed', (e) => { /* keep alive in tray */ });
app.on('activate', () => { if (!win) createWindow(); });
