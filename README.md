# ARTDiCO 导师课表桌面浮窗（Electron 薄壳）

一个常驻 Windows 桌面的**置顶小窗口**，供导师看自己的课表、填上课记录、排课。

## 这个仓库只是「壳」

- 真正的界面/逻辑在主仓库 [`artdico-deck`](https://github.com/kunanli/artdico-deck) 的 `widget.html`，部署在 `https://portal.artdico.cc/widget.html`。
- 这个壳只负责：用一个置顶、可拖动、带系统托盘的小窗口把那个网址装起来。
- **改功能几乎永远只改 `widget.html`**（走 OSS 部署，2–3 分钟上线），这个壳很少动。

## 载入地址

`main.js` 顶部的 `WIDGET_URL`（默认 `https://portal.artdico.cc/widget.html`）。
也可用环境变量 `ARTDICO_WIDGET_URL` 覆盖（测试指向别的地址时用）。

## 出安装档给导师（不用本地环境）

1. 在 GitHub 打一个 tag（如 `v0.1.0`）→ **Build Windows Installer** workflow 自动跑
2. 跑完在 **Releases** 里拿到 `ARTDiCO-Widget-Setup-0.1.0.exe`
3. 把这个 .exe 发给导师，双击安装即可

> 想先试打包不发布：Actions 里手动跑 **Build Windows Installer**，完成后在该 run 的 Artifacts 下载 `artdico-widget-win`。

> ⚠️ 未做代码签名时，Windows SmartScreen 首次会弹「未知发布者」→ 点「更多信息 → 仍要运行」。要消除此提示需购买代码签名证书（后续可加）。

## 本地开发（可选 · 需 Node）

```bash
npm install
npm start        # 打开浮窗（载入线上 widget.html）
npm run build    # 本地打 Windows 安装档到 dist/
```

## 结构

```
main.js                      置顶窗口 + 托盘 + 记忆窗口位置
package.json                 electron / electron-builder 配置
.github/workflows/build.yml  Actions 打 .exe + 发 Release
```
