// ============================================================
// preload.js · 只暴露「窗口控制」三个安全方法给页面
// 页面（widget.html）可 feature-detect window.electronWidget 是否存在，
// 存在即在自己顶栏显示 – / ✕ 按钮（纯浏览器打开时不显示）。
// 不暴露任何 Node / 文件系统能力。
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronWidget', {
  minimize: () => ipcRenderer.send('widget:minimize'),
  close:    () => ipcRenderer.send('widget:hide'),   // 收起到托盘
  quit:     () => ipcRenderer.send('widget:quit')
});
