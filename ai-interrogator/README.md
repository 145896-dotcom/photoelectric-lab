# 反证

只问不答的对抗式学习工具：贴进一段你自己写的材料，它按「事实 → 依据 → 前提」三层逐条追问，把你答不上来的地方记成卡点，最后给一份卡点报告。离线题库版 v0.1，不联网、不存储，内容只存在本机内存里。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && node scripts/inline-dist.mjs   # 产物 dist/index.html 可双击打开
```

**为什么 build 之后必须再跑一次 `node scripts/inline-dist.mjs`**：Vite 产出的是外链 `module script`，而 `file://` 的 origin 是 `null`，浏览器会按 CORS 拒绝加载，直接双击只会白屏；这个脚本把 JS 与 CSS 内联进 `dist/index.html` 并删掉 `modulepreload`，双击才能跑起来。`npm run build` 会把文件还原成未内联形态，所以每次 build 之后都要重跑一次（脚本幂等，重复执行安全）。

## 要知道的四件事

| 项 | 值 |
| --- | --- |
| 依赖 | 7 个包（react / react-dom / vite / @vitejs/plugin-react / typescript / @types/react / @types/react-dom）；无 UI 库、无 CSS 框架、无路由库、无状态库、无动画库 |
| 运行期网络请求 | 0，断网可用 |
| 最小视口 | 1024×720；更窄时只显示「请使用宽度 1024px 以上的窗口」，不做响应式 |
| 产物 | `dist/index.html` 单文件，约 265 KB，JS 与 CSS 已内联 |

## 已知限制

- 题库为 6 条规则加兜底共 24 句问话，覆盖常见断言类型；长尾材料可能落到兜底问句，它不是大模型，不会现场生成问题。
- 会话不持久化，刷新即回入场页并清空。
- 最小视口下入场页需纵向滚动才能看到「开始质问」；材料框最小高 240px 是契约要求，不做压缩。

## 环境备注

`file://` 下浏览器可能不提供剪贴板权限，「复制报告」会降级并提示手动选中报告内容；用 `http://localhost` 打开时正常。

## 目录

| 路径 | 管什么 |
| --- | --- |
| `src/main.tsx`、`src/App.tsx`、`src/types.ts` | 挂载入口；三阶段分发与常驻离线标识；契约类型（写完即冻结） |
| `src/styles/` | 设计令牌与全局样式：黑白直角、单一强调色、全部组件类 |
| `src/state/` | 唯一状态机：reducer 是所有推进的唯一裁决点，Context 只负责把 state 与 dispatch 传下去 |
| `src/data/` | 静态配置：四个场景、三档强度参数、固定文案、题库与兜底问句 |
| `src/lib/` | 纯函数层：论点抽取、取题、报告生成、Markdown 导出、取题适配层 provider |
| `src/components/` | 三个阶段（入场 / 对峙 / 报告）的界面组件与指标卡、层指示器、材料栏、问题流 |
