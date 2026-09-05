# Bitwarden Vault Manager — 新设备快速上手

## 前置条件
- Node.js ≥ 20
- 一个 Bitwarden 账户
- 一个 Personal API Key（推荐，绕过 CAPTCHA）

## 1. 获取 API Key

1. 登录 https://vault.bitwarden.com
2. 左侧菜单 → **设置** → **安全** → **密钥**
3. 点击 **查看 API 密钥**
4. 复制 `client_id`（格式：`user.xxxx-xxxx-xxxx`）和 `client_secret`

## 2. 克隆项目

```bash
git clone https://github.com/yancongya/bitwarden-vault-manager.git
cd bitwarden-vault-manager
```

## 3. CLI 登录

### 方式一：API Key（推荐，全自动）

```bash
echo "你的主密码" | node agent-harness/bin/bwvault.js auth login \
  --api-key \
  --client-id "user.你的client-id" \
  --client-secret "你的client_secret" \
  --email 你的邮箱@example.com
```

### 方式二：环境变量

```bash
export BWVAULT_PASSWORD="你的主密码"
node agent-harness/bin/bwvault.js auth login \
  --api-key \
  --client-id "user.你的client-id" \
  --client-secret "你的client_secret" \
  --email 你的邮箱@example.com
```

登录成功后会话自动保存到 `~/.bwvault/session.json`（权限 0600），
下次使用无需重复登录。

## 4. 常用命令

```bash
# 检查登录状态
node agent-harness/bin/bwvault.js auth status

# 同步并查看所有条目（密码已隐藏）
node agent-harness/bin/bwvault.js vault list --json

# 搜索特定条目
node agent-harness/bin/bwvault.js vault search github

# 健康检查
node agent-harness/bin/bwvault.js analyze health

# 重复检测（dry-run）
node agent-harness/bin/bwvault.js manage dedup --json

# 交互式 REPL
node agent-harness/bin/bwvault.js
```

## 5. Docker 用法

```bash
# 构建
docker build -t bwvault .

# 登录（挂载数据卷持久化）
echo "主密码" | docker run --rm -i \
  -v bwvault-data:/data \
  bwvault auth login \
  --api-key \
  --client-id "user.xxxx" \
  --client-secret "xxx" \
  --email 你的邮箱

# 日常使用
docker run --rm -v bwvault-data:/data bwvault vault list --json
docker run --rm -v bwvault-data:/data bwvault analyze health
```

## 6. Agent 自动化示例

```bash
# agent 可以这样组合命令：
node agent-harness/bin/bwvault.js analyze health --json | jq '.score'
node agent-harness/bin/bwvault.js vault list --json | jq '[.items[] | select(.password == "••••••••")] | length'
node agent-harness/bin/bwvault.js manage dedup --json | jq '.summary'
```

## 7. 安全须知

- **主密码永远不会被存储**，只用于本地密钥派生
- 所有输出默认 **隐藏密码/TOTP/卡号**
- 需要看明文时加 `--reveal`
- 管理操作默认 **dry-run**，加 `--apply` 才执行
- 会话文件权限为 `0600`（仅当前用户可读）
