# Bitwardenagents 安全审核报告

> 状态：生产部署后版本。已部署到 NAS 并完成线上只读验证。

## 范围

- 应用：`server.js`、Cloudflare Functions、`agent-harness`、会话与 PIN 逻辑
- 部署：Dockerfile、Compose、NAS 线上容器暴露面
- 方法：OWASP WSTG/ASVS、CIS Docker Benchmark、低风险动态验证
- 限制：未读取或展示真实密码、API key、access token；未执行线上写操作、删除、解锁或压力测试

## 当前结论

修复前版本不建议直接暴露到不可信网络。当前代码已收紧 session 写入、按客户端隔离 PIN 解锁状态、使用 scrypt 和失败限速、校验静态路径边界，并完成基础容器加固；本次已完成生产部署与上线验证。

## 发现摘要

| 等级 | 问题 | 证据 | 状态 |
| --- | --- | --- | --- |
| 严重 | `POST /api/session` 未认证即可覆盖 session 文件 | 已增加同源、解锁 cookie 和 schema 校验 | 已修复并线上验证 |
| 高危 | PIN 解锁状态是进程级全局状态 | 已改为客户端绑定解锁 cookie | 已修复并线上验证 |
| 高危 | HTTP 3000 对外发布并处理会话 API | 已绑定 localhost，远程访问失败 | 已修复并线上验证 |
| 中高 | PIN 使用单次 SHA-256 且无限速/锁定 | 新 PIN 使用 scrypt，失败 5 次限速 | 已修复并线上验证 |
| 中 | 静态路径缺少明确的 `DIST` 边界校验 | 已做 URL 解码和目录边界校验 | 已修复并线上验证 |
| 中 | 容器 root filesystem 可写 | 已启用 read-only 和 cap_drop | 已修复并线上验证 |
| 中高 | 永久删除主端点的任意错误都会触发另一条删除接口 | 备用路由现仅在主端点明确返回 405 时调用；401/403/404 直接失败 | 已修复并部署；未执行真实删除请求 |

## 已完成验证

- `npm run build` 通过
- `node agent-harness/tests/run.js`：23/23 通过
- `git diff --check` 通过
- 隔离环境：无 `Origin` 或跨源 `Origin` 的 session 写入返回 403；合法同源请求仍返回 200
- scrypt PIN：正确 PIN 验证成功，错误 PIN 失败；失败次数达到阈值后返回 429
- 静态路径：请求路径经过解码、规范化和 `DIST` 边界校验
- 线上容器：`healthy`、用户为 `node`、只读 rootfs、`cap_drop=ALL`、`no-new-privileges=true`
- 线上接口：HTTPS 3443 正常；远程 HTTP 3000 不可达；未授权 session 写入返回 403；未解锁 session 读取返回 401
- NAS 线上 `/api/pin`、HTTPS/HTTP 端口和容器非秘密配置完成只读确认
- 本机默认 npm 镜像不支持 advisory endpoint；改用官方 npm registry 审计。2026-10-08 修复构建依赖后，全量及 `--omit=dev` 审计均为 0 项告警

## 2026-10-08 发布复核

- 源码已推送到 `main`，构建依赖修复提交为 `000ccc8`；CLI 测试 23/23、Web 构建、`git diff --check` 通过。
- NAS 上新容器的镜像 ID 与本机构建一致：`sha256:bebeba518bcde7505aa681f4a21d2626dfaeda3cc182dbe2c35947c709d29158`。容器 `healthy`，运行用户 `node`，只读 rootfs、`cap_drop=ALL`、`no-new-privileges=true`，数据挂载仍为 `/vol1/1000/services/data/bwvault:/data`。
- 实际 HTTPS 入口返回 200；未解锁 session 读取返回 401，未授权 session 写入返回 403，远程 HTTP 3000 不可达。本机 `bwvault auth status --json` 通过新容器返回有效会话，仅核对安全元数据，未输出密值。
- NAS 页面在真实浏览器中显示 PIN 验证界面；首次加载时登录页与面板均隐藏。公开落地页在浏览器中先显示引导层，结束后才显示主内容。
- 本轮未执行线上解锁、密码读取、凭据写入、删除或压力测试；这些业务路径不属于此次只读发布验收。

## 修复顺序

1. 保护或移除未认证的 `POST /api/session`。
2. 将解锁状态改为短期、客户端绑定、可撤销的 HttpOnly 会话。
3. 关闭对外 HTTP 3000，仅通过可信 HTTPS 反向代理提供服务。
4. 使用 Argon2id/scrypt，并加入 PIN 失败限速、退避和锁定。
5. 对静态文件路径做 `realpath`/目录边界校验。
6. 启用只读 rootfs、`cap_drop: [ALL]`，并进行镜像扫描。

## 后续建议

后续可继续接入镜像漏洞扫描、反向代理审计、日志告警和定期依赖更新；任何涉及认证、会话或部署的改动都必须重新执行本报告中的回归检查。

## 2026-10-09 部署入口加固与 NAS 验收

- `build-and-deploy.sh` 默认显示计划；仅 `apply --yes` 才构建并连接 NAS。
- 部署要求 Git 工作区干净，镜像标签由源码 HEAD 生成；当前通过 `~/.config/agent-ops/runtime.json` 中的非秘密 `nasSshTarget` 使用非交互密钥 SSH 传输，不依赖 SkillDo `infra-ops` wrapper，也不拼接凭据。
- NAS 侧先验证现有 `/data` bind mount 与固定数据目录一致。新容器必须通过 Docker healthcheck；失败时保留失败容器并尝试恢复先前容器，不删除容器或数据卷。
- Agent Ops 已登记该更新适配器。提交 `35790bb20a773c0b4a289ce35ae041794293d1aa` 已推送并部署；NAS 容器镜像为 `bwvault:release-35790bb20a773c0b`，运行和 Docker healthcheck 均为 healthy，`/data` 仍绑定到 `/vol1/1000/services/data/bwvault`，HTTPS 首页返回 200。
- 历史部署曾使用 `infra-ops` SSH wrapper，并修复过其输入转发缺陷；当前部署入口已改为直连系统 SSH，仍以独立回归验证镜像流和远端脚本的标准输入。

## 2026-10-10 NAS 原生构建部署入口

- 更新适配器不再调用 Mac 本地 Docker Buildx；它从干净 Git revision 创建源码归档并通过 Agent Ops 配置的 SSH 目标流式发送给 NAS。
- 镜像构建在 NAS 的 Docker Engine 上完成，部署前验证候选镜像存在；保留既有 `/data` bind mount、健康检查和旧容器恢复逻辑。
- 回归覆盖源码流、远端构建命令、无本地 Docker 调用、脏工作树阻断和健康验收失败恢复；自动化测试通过不等于 NAS 实际部署验收。

## 2026-10-10 CLI 写入会话续期修复（生产已验证）

- 发现：CLI 只读操作可复用 10 分钟加密缓存；若写入前命中缓存，访问令牌可能已过期，而写请求路径不会触发 API Key 自动续期，导致合法 `credential set` 等操作返回 401。
- 修复：所有带 `--apply` 的密码库变更先强制进行远端同步；同步 401 时使用持久化 API Key 凭据续期并重试。远端同步或续期失败时不回退缓存，写操作保持失败关闭。只读查询继续复用缓存。
- 验证：新增隔离测试验证只读缓存命中不访问网络、强制远端模式遇到 401 不回退缓存、持久 API Key 可续期并重试；Agent Harness 23 项基础测试与会话缓存测试、npm 包 smoke test、Web 构建均通过。
- 生产验证：提交 `b232a6b` 已推送并由 Agent Ops 在 NAS 构建部署为 `bwvault:release-b232a6b4ab555668`；容器运行且 Docker healthcheck 为 healthy，`/data` 持久挂载匹配。随后经 CLI 强制远端同步成功创建 `fnos.tunnel.skilldo.appkey`，输出仅报告别名与保存状态，没有返回密值。
- 状态：写入续期路径已在生产凭据服务上验证。WebDAV HTTPS 路由仍待具备 Cloudflare Tunnel 与 DNS 权限的 API Token；该外部入口未计入本次验收。

## 2026-10-12 CLI 单条目密钥解密兼容（本地已验证）

- 发现：Bitwarden 条目可带独立 `Key`，其名称、登录字段和自定义字段由该条目密钥加密。旧版 CLI 始终使用账户对称密钥，导致此类条目字段无法解密，稳定凭据别名也无法匹配。
- 修复：读取条目时先用账户密钥解开其 `Key`，再用条目密钥解密所有字段；若条目密钥损坏则仅将该条目标为解密失败，不错误回退到账户密钥。无独立 `Key` 的旧条目行为保持不变。
- 验证：覆盖独立条目密钥、旧格式条目及损坏条目密钥的 CLI 回归测试通过；Agent Harness 测试、npm 包 smoke test、Web 构建和 `git diff --check` 通过。
- 状态：本地源码已修复；尚未提交、推送或部署到 NAS，生产 CLI 暂未包含此修复。

## 2026-10-13 永久删除权限错误失败关闭（本地已验证）

- 发现：Web 端永久删除调用 `/ciphers/delete-admin` 遇到任意非成功响应时，都会自动再调用 `/ciphers/delete`。这会把 401/403 权限或认证拒绝当成端点兼容问题，并继续尝试另一条不可逆删除接口。
- 修复：仅当主端点明确返回 HTTP 405（方法不支持）时才尝试旧方法兼容路由；401、403、404 等响应直接失败并保留状态码。回退路由若返回权限拒绝，同样立即失败。
- 验证：新增无网络 mock 测试覆盖 401/403/404 不回退、405 兼容回退、首端点成功不回退，以及备用端点 403 失败关闭。
- 部署：提交 `01838c9c6b15ff20a0d6541ba851fc99568c88f8` 已推送并部署为 `bwvault:release-01838c9c6b15ff20`。部署脚本及 Agent Ops 只读状态均确认容器运行、health 为 healthy、`/data` 挂载与预期匹配。
- 限制：这项修复不会增加 Bitwarden 账户权限，也不能让上游拒绝的操作通过；线上验收只核对镜像、健康状态和持久挂载，没有向真实保险库发起删除请求。

## 2026-10-13 Web Bitwarden 代理最小权限（生产已部署）

- 发现：生产 Web 代理此前会把匹配 `/bw-api`、`/bw-identity` 前缀的任意路径、方法、请求头和请求体转发到 Bitwarden，服务端没有检查当前会话、PIN 解锁状态或操作路径；仅靠 Web UI 隐藏按钮无法限制代理能力。
- 修复：代理现在只允许同源 `accounts/prelogin` / `connect/token` 登录请求，以及 Web UI 使用的同步、条目和文件夹 API；保险库调用必须携带当前 session 中的 Bearer token，或由本进程短期登记的同源登录 token，PIN 已配置时还要求客户端解锁，写请求额外要求同源。条目/文件夹 ID 路径只接受 UUID 格式，避免保留路由名被误识别为条目 ID。未列出的操作失败关闭。
- 验证：Agent Harness 50 项全部通过，覆盖未列出路由、方法错配、真实 Web UI 批量操作、其他 Bearer token、锁定状态、跨源写入、同源登录和首次同步 token；CLI package smoke test、Web 生产构建、语法检查和 `git diff --check` 通过。
- 部署：提交 `d277936bebba2a746ae6da9f5486f55827b8f19f` 已推送并在 NAS 上构建部署为 `bwvault:release-d277936bebba2a74`。Agent Ops 确认容器 `running` / `healthy`，`/data` bind mount 仍匹配预期；NAS 内网 HTTPS 首屏返回 200，未带授权的 `/bw-api/sync` 返回 401，未列出的 `/bw-api/unknown` 与 `/bw-identity/admin/users` 均返回 403。接口检查使用 NAS IP 和跳过自签证书验证，没有完成浏览器真实登录后的完整交互验收。
- 限制：这个代理白名单是本应用的操作边界，不更改 Bitwarden 账户权限；Web UI 当前列出的批量写操作仍由已解锁会话执行，后续若需要操作级审批，应新增独立窄 API/确认流程，不开放任意上游代理。

## 2026-10-13 凭据文件夹移动回执核验

- 发现：密码库分类移动时，CLI 把上游 HTTP 成功响应直接计为已移动；实际强制远端同步后，部分条目仍留在未归档状态，之前的 CLI 汇总不足以证明最终状态。
- 修复：`manage move --apply` 在写入后再强制远端同步，逐条核对实际 `folderId`；只有回读匹配目标才计为 moved，写入未生效或无法核验会进入脱敏失败类别，不会宣称完成。
- 验证：Agent Harness 55 项通过，覆盖远端归属一致、上游返回成功但回读未变、核验同步失败等路径；package smoke test、cache-sync、语法检查和 `git diff --check` 通过。提交 `8c3be157462056c665f6dfdc9c9f2561c795ece3` 已推送并部署为 `bwvault:release-8c3be157462056c6`；部署脚本确认容器健康且 `/data` 挂载保持不变，Agent Ops 二次检查确认新镜像正在运行。SkillDo 中央 `bwvault-cli` 已更新到同一提交，远端 Skill 内容哈希匹配。
- 后续：库中仍有 485 条未分类记录；本轮未再批量重试旧的分类移动请求，避免基于不完整的旧条目清单误操作。后续按清晰线索分批预览并用新版本回读验证。

## 2026-10-13 Web 代理能力 scope 配置（已合并，NAS 待部署验收）

- 变更：增加服务端 `BWVAULT_PROXY_SCOPES` 进程级能力配置。允许值为 `vault:read`、`vault:secrets`、`vault:write`、`vault:delete`；授权只从服务端配置、已保存 session token 或进程签发的短期 token 状态解析，不读取客户端 header/query 作为 scope 来源。未设置变量时保留既有 Web 会话行为。
- 路由边界：`/folders` 元数据读取使用 `vault:read`；`/sync`、密码库条目读取使用 `vault:secrets`；新增/修改使用 `vault:write`；删除路由以及 `DELETE` 请求使用 `vault:delete`。
- 限制：配置是进程级全局能力上限，不是用户/角色授权系统，也不更改 Bitwarden 上游账号权限；NAS 未配置变量时不会启用 scope 限制。源码已合并到 `main`，NAS 部署和线上验收仍待完成。
- 验证：PR Verify 与 Cloudflare Pages 检查通过；本地 `node --check server.js`、Agent Harness 与 `git diff --check` 通过。

## 2026-10-13 Cloudflare Pages 与 Vite 代理策略（本地待验证）

- 范围：`functions/[[path]].js` 的 Cloudflare Pages Functions 代理、Vite 开发代理及共享 `agent-harness/core/proxy-policy.js`。
- 修复：Pages 与 Vite 使用同一方法/路径白名单；API 请求要求格式正确的 Bearer 头；身份登录与写操作要求精确同源；Pages 移除标准转发、Cloudflare 来源地址及常见客户端路由头。Vite 同源判断同时比较协议与 Host。
- 认证边界：Cloudflare Pages 与 Vite 不持有自托管 Node session/PIN 状态，只检查 Bearer 头格式；这不能证明 token 属于 NAS session。上游 Bitwarden 仍执行 token 认证。需要 session/PIN 策略时必须使用自托管 Node 入口。
- 本地验证：Agent Harness 93/93 通过，覆盖 Pages 未知路由、方法错配、缺失/格式错误 Bearer、跨源写入、常见转发头剥离及保留 Bitwarden 客户端头；Vite middleware 用例覆盖缺失 Bearer、未知路由、协议错配写入和正常同源同步。npm package smoke test、删除兼容回归、cache-sync、cipher 解密、请求超时回归、Web 构建与 `git diff --check` 均通过。
- 部署状态：尚未部署或推送；本地测试通过后再经项目发布流程审批和独立验收。
