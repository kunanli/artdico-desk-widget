// ============================================================
// ARTDiCO 导师课表桌面浮窗 · Electron 薄壳 · v0.1
// 职责：一个置顶小窗口，载入 widget.html 的网址。UI/逻辑全在 widget.html。
// 改动这个壳很少发生；日常迭代都在 artdico-deck/widget.html（走 OSS 部署）。
// ============================================================
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 桌面挂件：去掉「File Edit View…」菜单栏（整个 app 无菜单）
Menu.setApplicationMenu(null);

// 载入的网页地址 · 改这里即可切换（也可用环境变量 ARTDICO_WIDGET_URL 覆盖）
const WIDGET_URL = process.env.ARTDICO_WIDGET_URL || 'https://portal.artdico.cc/widget.html';

let win = null;
let tray = null;
const boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');

// 单例锁：重复启动只聚焦已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
}

function loadBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile, 'utf8')); } catch (e) { return null; }
}
function saveBounds() {
  if (!win) return;
  try { fs.writeFileSync(boundsFile, JSON.stringify(win.getBounds())); } catch (e) {}
}

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width:  b?.width  || 380,
    height: b?.height || 560,
    x: b?.x, y: b?.y,
    minWidth: 300, minHeight: 380,
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

app.whenReady().then(() => { createWindow(); createTray(); });

// 关掉窗口不退出（常驻托盘）· 从托盘再打开
app.on('window-all-closed', (e) => { /* keep alive in tray */ });
app.on('activate', () => { if (!win) createWindow(); });
