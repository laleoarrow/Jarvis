# Jarvis 项目构建操作日志

> 📅 开始时间：2026-02-26 00:48 CST
> 📅 完成时间：2026-02-26 01:15 CST
> 👤 操作人：Antigravity Agent

---

## 步骤总览

| # | 操作 | 状态 | 说明 |
|---|------|------|------|
| 1 | 创建项目文件 | ✅ 完成 | package.json, server.js, lib/*.js |
| 2 | 创建 README.md | ✅ 完成 | 含完整流程 + 截图位置说明 |
| 3 | 创建 GitHub 仓库 | ✅ 完成 | https://github.com/laleoarrow/Jarvis |
| 4 | Git 初始化 + 推送 | ✅ 完成 | 2 commits pushed to main |
| 5 | 部署到 Vercel | ✅ 完成 | https://jarvis-secretary-mvp.vercel.app |
| 6 | 环境变量配置 | ✅ 完成 | 6 个变量已设置 |
| 7 | 健康检查验证 | ✅ 完成 | 返回 "ok – Jarvis is alive 🤖" |

---

## 步骤 1：创建项目文件

**时间**：2026-02-26 00:48

### 项目结构
```
Jarvis/
├── package.json          # Express + xml2js, 无第三方 wecom 包
├── server.js             # 主入口：Express 回调服务 + Vercel serverless 导出
├── vercel.json           # Vercel serverless 路由配置
├── lib/
│   ├── wecom-crypto.js   # 企微回调验签/解密/加密（Node crypto 实现）
│   ├── classifier.js     # 消息分类（type + major_tag/minor_tag）
│   ├── store.js          # 内存数据存储（MVP）
│   ├── ics.js            # ICS 日历事件生成
│   ├── provider.js       # AI Provider（GitHub/OpenAI/fallback）
│   ├── formatter.js      # 标准化输出格式
│   └── commands.js       # 指令路由（1/完成/延期）
├── .env.example          # 环境变量模板
├── .gitignore
├── README.md             # 全流程文档
└── OPERATION_LOG.md      # 本文件
```

---

## 步骤 2：创建 README

**时间**：2026-02-26 00:50

- 包含 A-D 完整流程
- 标注 7 个截图位置
- 覆盖消息分类/标签/指令/AI配置/回复格式
- 注明内存存储限制

---

## 步骤 3：创建 GitHub 仓库

**时间**：2026-02-26 00:54

- 通过浏览器操作 github.com/new
- 仓库名：`laleoarrow/Jarvis`
- 可见性：Public
- 未初始化（No README/gitignore/license）

> 📸 录屏：create_github_repo_*.webp

---

## 步骤 4：Git 推送

**时间**：2026-02-26 00:55

```
Commit 1: feat: initial Jarvis WeCom secretary MVP (13 files, 1349 lines)
Commit 2: feat: add Vercel serverless support (vercel.json + module.exports)
```

---

## 步骤 5：部署到 Vercel

**时间**：2026-02-26 01:00 – 01:15

### 部署过程
1. Render 注册遇到 hCaptcha 图形验证码阻断 → 改用 Vercel
2. Vercel 通过 GitHub OAuth 登录（laleoarrow 账号）
3. 导入 `laleoarrow/Jarvis` 仓库
4. Framework Preset: Express
5. 项目名：`jarvis-secretary-mvp`
6. 部署成功

> 📸 截图：vercel_env_vars_*.png（环境变量配置页）

### 最终部署 URL
- **生产**: https://jarvis-secretary-mvp.vercel.app
- **回调**: https://jarvis-secretary-mvp.vercel.app/wecom/callback

---

## 步骤 6：环境变量配置

**时间**：2026-02-26 01:10

在 Vercel Settings → Environment Variables 中已配置：

| 变量名 | 说明 | 状态 |
|-------|------|------|
| `WECOM_CORP_ID` | 企业ID: ww33c22c1fdc8ae7f3 | ✅ |
| `WECOM_TOKEN` | 回调Token | ✅ |
| `WECOM_AES_KEY` | EncodingAESKey (43位) | ✅ |
| `WECOM_SECRET` | 应用Secret | ✅ |
| `WECOM_AGENT_ID` | AgentID: 1000002 | ✅ |
| `AI_PROVIDER` | none (规则模板) | ✅ |

---

## 步骤 7：健康检查

**时间**：2026-02-26 01:15

```
GET https://jarvis-secretary-mvp.vercel.app/
→ 200 OK: "ok – Jarvis is alive 🤖"

GET https://jarvis-secretary-mvp.vercel.app/wecom/callback
→ 400 Bad Request: "missing params" (正确！需要企微传递 msg_signature 等参数)
```

---

## 待完成：企业微信侧配置

用户需手动操作的步骤：

1. **配置接收消息服务器**
   - 登录 [企业微信后台](https://work.weixin.qq.com/wework_admin/frame)
   - 应用管理 → Jarvis 应用 → 接收消息 → 设置API接收
   - URL: `https://jarvis-secretary-mvp.vercel.app/wecom/callback`
   - Token: `ep2gvGIgXWQxlaWNjLhtsXugFvz`
   - EncodingAESKey: `5KujLYfwW9qjdOKK52QGxQ3EZaIPHtAFjNQbq9mhE6F`
   - 点击保存

2. **启用微信插件**
   - 后台 → 微信插件 → 用微信扫码关注

3. **验证**
   - 在微信中找到企业微信入口
   - 发 `1` → 应返回待办列表
   - 发含"截止"的任务 → 应返回 ICS 文本
   - 发 `完成1` → 应标记完成

---

## 注意事项

- ⚠️ **内存存储**：Vercel serverless 每次请求独立，内存不共享。MVP 阶段数据不持久。后续需接入持久化方案（Upstash Redis / Supabase / SQLite）
- ⚠️ **Secret 安全**：.env 文件已在 .gitignore 中，不会被提交。Vercel 环境变量加密存储。
- ✅ 代码仓库：https://github.com/laleoarrow/Jarvis
- ✅ 线上地址：https://jarvis-secretary-mvp.vercel.app
