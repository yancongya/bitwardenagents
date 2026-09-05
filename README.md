# 🔐 Bitwarden Vault Manager

一个功能强大的 Bitwarden 密码库管理面板，支持去重合并、健康分析、URL 失效检测、批量操作等高级功能。

🌐 **在线演示**: [bitwarden.xuebz.com](https://bitwarden.xuebz.com/)（点击「演示模式」免登录体验）

**所有加密解密均在浏览器本地完成，服务端仅做 API 代理转发，不接触任何明文数据。**

---

## 快速上手

### 前置条件
- Node.js ≥ 20
- 一个 Bitwarden 账户
- 一个 Personal API Key（推荐，绕过 CAPTCHA）

### 获取 API Key

1. 登录 https://vault.bitwarden.com
2. 左侧菜单 → **设置** → **安全** → **密钥**
3. 点击 **查看 API 密钥**
4. 复制 `client_id`（格式：`user.xxxx-xxxx-xxxx`）和 `client_secret`

### 克隆并运行

```bash
git clone https://github.com/yancongya/bitwarden-vault-manager.git
cd bitwarden-vault-manager

# Web 开发模式
npm install && npm run dev

# 或 CLI 模式
echo "你的主密码" | node agent-harness/bin/bwvault.js auth login \
  --api-key \
  --client-id "user.你的client-id" \
  --client-secret "你的client_secret" \
  --email 你的邮箱@example.com
```

登录成功后会话自动保存到 `~/.bwvault/session.json`（权限 0600），下次无需重复登录。

### CLI 常用命令

```bash
node agent-harness/bin/bwvault.js auth status          # 检查登录状态
node agent-harness/bin/bwvault.js vault list --json     # 列出所有条目（密码已隐藏）
node agent-harness/bin/bwvault.js vault search github   # 搜索特定条目
node agent-harness/bin/bwvault.js analyze health        # 健康检查
node agent-harness/bin/bwvault.js manage dedup --json   # 重复检测（dry-run）
node agent-harness/bin/bwvault.js                       # 交互式 REPL
```

### Docker

```bash
docker build -t bwvault .

# 登录（挂载数据卷持久化）
echo "主密码" | docker run --rm -i -v bwvault-data:/data bwvault \
  auth login --api-key \
  --client-id "user.xxxx" --client-secret "xxx" --email 你的邮箱

# 日常使用
docker run --rm -v bwvault-data:/data bwvault vault list --json
docker run --rm -v bwvault-data:/data bwvault analyze health
```

### Agent 自动化示例

```bash
node agent-harness/bin/bwvault.js analyze health --json | jq '.score'
node agent-harness/bin/bwvault.js vault list --json | jq '.items[].name'
node agent-harness/bin/bwvault.js manage dedup --json | jq '.summary'
```

### 安全须知

- **主密码永远不会被存储**，只用于本地密钥派生
- 所有输出默认 **隐藏密码/TOTP/卡号**，需要明文时加 `--reveal`
- 管理操作默认 **dry-run**，加 `--apply` 才执行
- 会话文件权限为 `0600`（仅当前用户可读）

---

## ✨ 功能特性

### 📊 总览仪表板
- 密码库概览统计
- 重复项/弱密码/空密码一目了然

### 🔗 URL 失效检测
- **一次性全量扫描**：登录后自动检测所有条目的 URL 连通性
- **多策略探测**：fetch (no-cors) + `<img>` favicon 双策略，智能识别 Cloudflare 等 Bot 防护
- **大厂白名单**：内置 ~200 个主流域名（Google、Apple、Microsoft、Amazon、Meta、Netflix 等），自动跳过，支持父域名匹配
- **实时进度条**：渐变动画进度条 + 域名计数，检测过程可视
- **ID 去重**：同一条目绝不重复展示
- **批量处理**：支持全选、批量删除、批量移动

### 🔍 智能去重
- **完全重复检测**：URI + 用户名 + 密码三重匹配
- **同站重复检测**：相同站点不同凭据（支持 Android/iOS App URI 同站识别）
- **深度字段比较**：名称、TOTP、备注、自定义字段、通行密钥、收藏状态
- **AB 两路合并策略**：
  - **Path A (纯删除)**：100% 完全一致 → 保留一个，删除其余
  - **Path B (Create-Then-Delete)**：有差异 → 合并数据后新建条目 → 验证成功后删除所有原条目（含通行密钥条目：保留 per-cipher Key + Fido2Credentials）
- **智能标题选择**：中文优先，最短优先，淘汰标题保存到备注
- **URL 精简**：自动去除 `www.` 前缀和多余路径
- **安全保障**：全部软删除（30天可恢复），Path B 新建失败时原条目不删除

### 🏥 健康分析
- 弱密码检测
- 空密码检测（排除通行密钥条目）
- 密码重复使用检测
- 过期密码检测（>1年）
- 不安全 URI 检测（http://）

### 📝 条目管理
- 查看/编辑所有字段（含自定义字段解密）
- 批量移动文件夹
- 批量删除
- 文件夹创建/重命名/删除
- 高级搜索和过滤
- **按类型浏览**：支付卡 💳 / 身份 🪪 / 安全笔记 📝 / SSH 密钥 🔑 独立侧栏入口
- **已损坏条目**：自动识别解密失败的条目

### ⚡ 乐观热更新
- **即时 UI 反馈**：所有操作（删除、编辑、移动、文件夹管理）瞬间更新界面
- **后台静默同步**：服务端操作在后台异步执行
- **失败自动回滚**：服务端失败时 Toast 通知 + 自动 resync 恢复数据
- **永久删除例外**：不可逆操作保持悲观模式（先确认服务端成功再更新 UI）

### 🗑️ 回收站
- 恢复已删除条目到指定文件夹
- 永久删除
- 批量操作

### 🔒 安全特性
- 支持密码登录 + API Key 登录
- 支持 PBKDF2 + Argon2 密钥派生
- 全端加密/解密（浏览器本地执行）
- 会话持久化（sessionStorage）

---

## 🏗️ 技术架构

### Web 面板

- **前端**：纯 HTML + CSS + JavaScript（无框架依赖）
- **构建**：Vite
- **加密**：Web Crypto API + argon2-browser
- **部署**：Cloudflare Pages（静态站点 + Pages Functions 代理）

### CLI 工具（`agent-harness/`）

```
agent-harness/
├── bin/bwvault.js          # CLI 入口
├── core/
│   ├── bridge.js           # 桥接层：复用 src/ 加密引擎，Node 原生 Argon2
│   ├── session.js          # 会话持久化（0600 权限）
│   ├── security.js         # 明文防护（默认 redact, --reveal 授权）
│   ├── vault.js            # 同步 + 解密条目/文件夹
│   └── display.js          # 表格/JSON/KV 渲染
├── commands/
│   ├── auth.js             # login / logout / status
│   ├── vault.js            # sync / list / search / get / folders / export
│   ├── analyze.js          # health / duplicates / urls
│   └── manage.js           # dedup / trash / folders
├── utils/
│   ├── secrets.js          # 安全密钥输入（TTY/stdin/env）
│   └── repl.js             # 交互式 REPL
├── tests/run.js            # 核心单元测试
└── skills/SKILL.md         # Agent 可发现的技能文档
```

### 安全模型

- **零知识**：所有解密在本地完成，主密码不离开设备
- **默认 redact**：密码/TOTP/卡号/私钥默认显示 `••••••••`
- **Digest 去重**：重复检测基于 SHA-256 摘要，不持明文
- **Soft delete**：所有删除可恢复（~30 天），永久删除需双重确认
- **会话文件**：只存储派生后的对称密钥，权限 0600

### 项目结构

```
src/
├── app.js              # 主应用逻辑（含 URL 检测、乐观热更新）
├── bitwarden-api.js    # Bitwarden API 客户端
├── crypto.js           # 加密/解密引擎
├── dedup-engine.js     # 去重检测与合并引擎
├── health-engine.js    # 健康分析引擎
├── search-engine.js    # 搜索与过滤引擎
└── style.css           # 样式

agent-harness/          # CLI 工具（详见上文）
Dockerfile              # 多阶段构建，非 root
docker-compose.yml      # 容器编排
```

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件
