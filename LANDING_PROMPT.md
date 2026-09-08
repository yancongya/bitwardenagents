# Bitwardenagents 落地页 — 实现方案 Prompt（交给执行 Agent）

> 本文件是给执行 agent 的**自包含任务说明**，已锁定全部决策，无需回溯对话上下文即可开工。

## 0. 一句话目标
为 **Bitwardenagents**（仓库原 `bitwarden-vault-manager`，已 rename 为 `yancongya/bitwardenagents`）做一个**数据驱动、agent 可管理、永久双站发布**的静态落地页：
- **CF Pages 为主平面** → 产品站 `bitwardenagents.itycon.cn/about/`
- **GitHub Pages 为常驻镜像** → `https://<user>.github.io/bitwardenagents/`
- 两者**同一份构建产物、内容一致**，永久可访问。

## 1. 已锁定的决策（不要再质疑，违反即返工）
1. **永久双站**：gh-pages 与 CF Pages 都长期可访问，**不是**临时预览、用完即撤。
2. **CF 为主平面，gh-pages 为镜像**：`<link rel="canonical">` 必须指向 CF 域名。
3. **agent 可管理**：落地页文案 / 功能点 / 链接由**结构化数据驱动**，agent 改数据即双站更新，agent 不碰部署。
4. **复用 `gh-pages-landing` skill 的 A–E 工艺**，但发布阶段改为「双发」，不走该 skill 默认的 GitHub Pages 独立站 handoff。
5. **复用现有设计 tokens**，不另起视觉体系，保持与工具本体一致。

## 2. 架构
- 新增 `landing/` 目录：
  - `landing/landing-data.json` —— **单一真源（SSOT）**：标题、一句话定位、3–4 个功能点（含说明）、外链（GitHub / README / llms.txt）、CTA 文案。
  - 构建脚本：从 `landing-data.json` + 复用 `public/llms.txt` 渲染成静态 HTML（**HTML 不写死内容**）。
- **机器可读入口（agent 可发现）**：页面注入 JSON-LD（描述 bwvault 能力），并链出 `agent-harness/skills/SKILL.md`，让其他 agent 能发现并接入。
- 发布形态：
  - 主产品 CF Pages 项目在 `/about/` 挂载同一份静态产物；独立 `bitwardenagents-landing.pages.dev` 作为 CF 预览镜像。
  - **GitHub Pages** 从 `gh-pages` 分支或 `docs/` 发布，永久常驻。

## 3. 红线 / 硬约束
- **gh-pages 没有 `functions/` 代理能力**：该镜像上的 CTA「打开保险库」必须 `<a href="https://bitwardenagents.itycon.cn">` **链回 CF 主站**；「试用演示」可用 `src/demo-data.js` + `enterDemoMode()` 本地跑假数据，但真实登录必须跳 CF。
- **动效预算**：signature moment 只用 **CSS-native**（keyframes / transition），**禁止**引入 GSAP / Lenis / Three.js，避免 `app.js` 膨胀、Docker 镜像变重。
- **SEO**：单页静态、弱 SEO 可接受；只需在落地页 HTML 补 OG / meta 做社交预览，canonical 指向 CF。
- **不伪造截图**：README 自述「截图待补充」。可信证据面用「试用演示」按钮调 `enterDemoMode()` 把**真实 UI** 亮出来，比静态图更有说服力；无真素材不编。

## 4. 执行流程（严格按 gh-pages-landing A→E）
- **A 考古**：读 `README.md`、`style.css`（先确认 `design/tokens.css` 是否存在并取其实际路径）、`src/i18n.js`、`src/demo-data.js`，产出 evidence dossier（feature→收益、语气、可复用素材）。
- **B 方向（硬门槛）**：先出 2–3 个创意方向（叙事弧 + 声音 + 交互概念 + signature moment），**停下来等用户拍板，不要直接实现**。方向草拟见 §6。
- **C 设计系统**：直接复用现有 tokens，明暗主题统一，不与工具本体割裂。
- **D 动效**：CSS-native signature moment。
- **E 可信证据**：真 UI（`enterDemoMode`）而非假截图。
- **发布（双发）**：产出静态站 → 配 CI 一次 push 双站更新（见 §5）。

## 5. CI 双发（关键工程，必须做）
仓库 push `main` 触发：
- (a) 构建落地页静态产物 → 发 **GitHub Pages**（`gh-pages` 分支或 `docs/`）。
- (b) `wrangler pages deploy` → **CF Pages** 项目（主平面）。
- 两份来自**同一构建**，绝不做两份手工维护。
- **agent 工作闭环**：改 `landing-data.json` / `llms.txt` → `commit` → `push` → CI 双发。agent 只动数据，不碰部署。

## 6. Stage B 三个方向（供用户选，未执行）
1. **「保险库体检报告」**：首屏预演 0–100 健康分，CTA「打开真实保险库 / 试用演示」。冷静数据感，signature = 分数滚动动画。
2. **「Agent 安全接管」**（最贴 agent 管理主题）：突出 bwvault 四条护栏（不进 argv / 默认脱敏 / dry-run / 软删）+ SKILL.md 入口。终端 + 卡片风，signature = 命令流打字机。
3. **「零知识」信任**：主打「解密全在浏览器、服务端只代理」，锁 / 本地图标强化信任。极简留白，signature = 密钥本地生成可视化。
> 三者均从 `landing-data.json` 渲染，agent 改数据即双发。

## 7. 交付物 Checklist
- [ ] `landing/landing-data.json`（SSOT）
- [ ] 静态落地页 HTML（构建产出，数据驱动，非写死）
- [ ] 复用现有 design tokens，明暗主题正常
- [ ] JSON-LD + agent-harness 链接已注入
- [ ] GitHub Pages 常驻可访问
- [ ] CF Pages 子域可访问，`canonical` 指向 CF
- [ ] CI 双发配置生效（一次 push 双站更新）
- [ ] gh 站 CTA 链回 CF；演示走 demo 数据

## 8. gotchas（前人踩过的坑）
- **别把落地屏做成 `app.js` 内 view（即方案 A）** —— 那无法独立发 gh-pages。本方案是**独立静态站**，必须能被 gh-pages 单独托管。
- **gh-pages 路径带仓库名**（`/bitwardenagents/`），资源引用用相对路径或适配 `base`，否则样式/脚本 404。
- **双站同步靠单一构建 + CI**，绝不让两份内容手工漂移。
- CF Pages 项目名沿用 `bitwardenagents` 系列命名（如 `bitwardenagents-landing`），勿用无关名。
