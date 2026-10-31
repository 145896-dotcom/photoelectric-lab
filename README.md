# 光电效应参考实现

这是 `physics-interactive-page` 技能的模板，也是光电效应页面的起点。

## 目录

```
index.html      页面结构（DOM 契约）
styles.css      设计令牌与布局
config.js       常数、金属、范围、预设（UMD-lite）
physics.js      纯函数物理模型（UMD-lite）
app.js          控件、读数、Canvas、Chart、记录导出
tests/          node --test 用例
vendor/         运行前用 scripts/fetch-vendor.ps1 生成
```

## 运行

```powershell
# 取库（KaTeX + Chart.js）
powershell -ExecutionPolicy Bypass -File ..\..\scripts\fetch-vendor.ps1 -Dest .\vendor

# 方式 A：双击 index.html（经典脚本，无需服务）
# 方式 B：本地服务（截图/自动化用）
python -m http.server 8123 --directory .
```

## 测试

```powershell
node --test .\tests\physics.test.cjs
```

期望 8/8 通过。容差：能量/电压 ±0.01，电流 ±0.02。

## 改知识点

1. `config.js`：材料、范围、预设、常数。
2. `physics.js`：公式与模型，保持纯函数。
3. `index.html` / `app.js`：读数标签、图形含义、状态文案。
4. `tests/`：按新模型补用例。

骨架、DOM 契约、`window.__errors` 约定保持不变，这样 `references/ego-verify.md` 里的自动化还能用。

## 注意

- 不要引入 `<script type="module">`，否则 `file://` 双击打不开。
- 不要把读数逻辑复制到 UI 里，所有数字必须来自 `physics.js`。
- 教学简化（线性 I–U）必须在页面脚注说明。
