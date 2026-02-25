# 🤖 Jarvis – 企业微信个人秘书

> 通过企业微信自建应用 + 微信插件，在微信中使用的个人秘书回调服务。
> 部署到 [Render](https://render.com) 即可使用。

---

## 目录

1. [功能概览](#功能概览)
2. [技术架构](#技术架构)
3. [快速开始](#快速开始)
   - [A. 企业微信侧配置](#a-企业微信侧配置)
   - [B. Render 部署](#b-render-部署)
   - [C. 回调 URL 验证](#c-回调-url-验证)
   - [D. 微信插件启用](#d-微信插件启用)
4. [消息处理逻辑](#消息处理逻辑)
5. [指令手册](#指令手册)
6. [AI Provider 配置](#ai-provider-配置)
7. [回复格式](#回复格式)
8. [限制与未来计划](#限制与未来计划)
9. [截图参考](#截图参考)

---

## 功能概览

| 功能 | 描述 |
|------|------|
| 📨 消息分类 | 自动判别 text / link / mp_article |
| 🏷️ 双层标签 | major_tag (content/action) + minor_tag |
| ✅ 待办管理 | 发 `1` 查看、`完成 N` 标记、`延期 N 日期` 修改 |
| 📅 ICS 日历 | 含截止日期的任务自动生成 .ics 文本 |
| 🤖 AI 摘要 | 可选 GitHub Models / OpenAI / 规则模板 |
| 🔐 自实现加密 | 纯 Node.js crypto，无第三方 wecom 包 |

---

## 技术架构

```
微信 → 企业微信(微信插件) → WeCom Server
                                ↓ HTTPS POST (encrypted XML)
                         Render (Node.js)
                           ├─ wecom-crypto.js  ← AES-256-CBC 解密/加密
                           ├─ classifier.js    ← 消息分类
                           ├─ commands.js      ← 指令路由
                           ├─ store.js         ← 内存存储
                           ├─ ics.js           ← 日历生成
                           ├─ provider.js      ← AI 回复
                           └─ formatter.js     ← 输出格式化
```

**依赖**：仅 `express` + `xml2js`。加解密完全使用 Node.js 内置 `crypto` 模块。

---

## 快速开始

### A. 企业微信侧配置

> 个人即可免费注册企业微信（无需真实企业）。

#### A1. 注册 / 登录企业微信管理后台

1. 前往 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/loginpage_wx)
2. 用微信扫码登录（或注册一个新企业）

#### A2. 获取企业 ID (CorpID)

1. 进入后台 → 左下角「我的企业」
2. 页面底部找到 **企业ID**
3. 复制保存，格式类似：`ww1a2b3c4d5e6f7890`

> 📸 **截图位置①**：「我的企业」页面底部，企业ID 区域

#### A3. 创建自建应用

1. 后台 → 「应用管理」 → 「自建」区域 → 「创建应用」
2. 填写应用名：`Jarvis`
3. 可见范围：选择**仅自己**
4. 创建后进入应用详情页

#### A4. 获取 AgentID 和 Secret

1. 应用详情页顶部可见 **AgentID**
2. 点击 Secret 后面的「查看」
3. Secret 会发送到「企业微信团队」的会话中，打开企业微信 App 查看

> 📸 **截图位置②**：自建应用详情页（显示 AgentID + Secret 入口；Secret 值不要截图！）

#### A5. 配置接收消息服务器（先部署后再来）

1. 应用详情页 → 下滑到「接收消息」→「设置API接收」
2. 填写：
   - **URL**: `https://<your-service>.onrender.com/wecom/callback`
   - **Token**: 随机字符串（32位推荐，自己生成）
   - **EncodingAESKey**: 点「随机获取」自动生成 43 位字符串
3. 先不要点保存（URL 必须在线才能验证通过）

> 📸 **截图位置③**：「接收消息服务器配置」页面（URL/Token/AESKey 需打码）

---

### B. Render 部署

#### B1. Fork / 导入仓库

1. 前往 [Render Dashboard](https://dashboard.render.com)
2. 「New +」→「Web Service」
3. 连接 GitHub →  选择 `laleoarrow/Jarvis` 仓库

#### B2. 配置构建

| 设置项 | 值 |
|-------|-----|
| Name | `jarvis-wecom` (或自定义) |
| Region | Singapore (离中国最近) |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

#### B3. 设置环境变量

在 Render 的 Environment 页面添加：

| Key | Value | 说明 |
|-----|-------|------|
| `WECOM_CORP_ID` | `ww...` | A2 步骤获取的企业ID |
| `WECOM_TOKEN` | `abc...` | A5 步骤填写的 Token（必须一致） |
| `WECOM_AES_KEY` | `xyz...` | A5 步骤的 EncodingAESKey（43位，必须一致） |
| `AI_PROVIDER` | `none` | 可选: `github` / `openai` / `none` |

> 📸 **截图位置④**：Render 环境变量配置页（值打码）

#### B4. 部署

1. 点击 「Create Web Service」
2. 等待构建完成
3. 部署成功后，Render 分配域名：`https://<service>.onrender.com`

> 📸 **截图位置⑤**：Render Logs 显示 "Jarvis is live" 的页面

#### B5. ⚠️ 免费实例休眠

Render 免费实例 **15 分钟无请求后会休眠**。

在企业微信验证 URL 之前，**先手动访问一次**唤醒服务：

```
curl https://<service>.onrender.com/
# 应返回: ok – Jarvis is alive 🤖
```

---

### C. 回调 URL 验证

1. 确保 Render 服务已唤醒（访问 `/` 返回 ok）
2. 回到企业微信后台 → A5 步骤的「接收消息」配置页面
3. 确认 URL / Token / EncodingAESKey 均正确
4. 点击「保存」→ 企业微信会发一个 GET 请求验证
5. 如果一切正确，会提示「保存成功」

**常见问题**：
- ❌ "URL 超时"：免费实例休眠了，先访问 `/` 唤醒再保存
- ❌ "签名错误"：Token 或 EncodingAESKey 不一致，请检查
- ❌ "解密失败"：CorpID 环境变量填错，或 AES Key 有误

---

### D. 微信插件启用

> 此步骤让你在**微信**（不是企业微信 App）中使用 Jarvis。

1. 企业微信后台 → 「微信插件」（左侧菜单）
2. 页面会显示一个二维码
3. 用**微信**扫描该二维码 → 关注
4. 之后在微信中，你会在消息列表看到一个「企业微信」入口
5. 点进去即可与 Jarvis 对话

> 📸 **截图位置⑥**：企业微信后台「微信插件」二维码页面
> 📸 **截图位置⑦**：微信侧出现的企业微信入口截图

---

## 消息处理逻辑

### 消息类型判别

| 条件 | type |
|------|------|
| 企微消息类型为 `link` | `link` |
| 内容含 `mp.weixin.qq.com` 链接 | `mp_article` |
| 内容含其他 URL | `link` |
| 其他 | `text` |

### 标签体系

固定二级标签，每条消息必选：

| major_tag | minor_tag | 触发关键词 |
|-----------|-----------|-----------|
| `content` | `bio` | 医学 · 临床 · 基因 · 蛋白 |
| `content` | `ai` | AI · 大模型 · LLM · Agent |
| `content` | `other` | 长文本默认 |
| `action` | `todo` | 提交 · 完成 · 安排 · 任务 |
| `action` | `reminder` | 截止 · DDL · 之前 · 到期 或 含日期 |
| `action` | `note` | 短文本默认 (≤100字) |
| `action` | `other` | (预留) |

**优先级**：action 关键词 > content 关键词 > 长度判断

---

## 指令手册

| 指令 | 效果 | 示例 |
|------|------|------|
| `1` 或 `今日待办` | 列出所有未完成待办 | `1` |
| `完成 N` 或 `完成N` | 标记第 N 项为已完成 | `完成 3` / `完成3` |
| `延期 N YYYY-MM-DD HH:mm` | 更新第 N 项的截止时间 | `延期 3 2026-03-01 18:00` |
| 其他任意文本 | 自动分类入库 | `提交论文初稿 截止明天 17:00` |

---

## AI Provider 配置

Jarvis 的回复摘要支持三种 provider，通过环境变量 `AI_PROVIDER` 切换：

### 1. `none`（默认 – 规则模板）

不调用任何外部 API，使用内置模板生成摘要。

```env
AI_PROVIDER=none
```

### 2. `github`（GitHub Models / Copilot）

使用 GitHub Models 的 `gpt-4o-mini`。

```env
AI_PROVIDER=github
GITHUB_TOKEN=ghp_your_github_token
```

**获取 Token**：GitHub → Settings → Developer Settings → Personal Access Tokens

### 3. `openai`（OpenAI 兼容 API）

支持任何 OpenAI 兼容的 API（OpenAI / Azure / 本地模型）。

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### Fallback 行为

当配置的 provider 不可用（key 无效、API 超时等），Jarvis **自动降级到规则模板**，不会报错或中断服务。

---

## 回复格式

所有 Jarvis 回复均使用以下固定结构（纯文本）：

```
TYPE: text
TAGS: action/todo
TITLE: 提交论文初稿
DUE: 2026-02-27 17:00
TODO_ID: 1
ICS:
BEGIN:VCALENDAR
VERSION:2.0
...
END:VCALENDAR
SUMMARY: 已收录 [action/todo]：提交论文初稿 截止明天 17:00
NEXT: 回复 完成 1 / 延期 1 YYYY-MM-DD HH:mm / 1
```

| 字段 | 说明 |
|------|------|
| `TYPE` | 消息类型 |
| `TAGS` | 大类/小类 |
| `TITLE` | ≤40字短标题 |
| `DUE` | 截止时间（可为空） |
| `TODO_ID` | 待办编号（可为空） |
| `ICS` | 完整 .ics 文本，用户可复制导入 Apple 日历（可为空） |
| `SUMMARY` | 1-3 行摘要 |
| `NEXT` | 建议的下一步指令 |

---

## 限制与未来计划

### 当前限制

- ⚠️ **内存存储**：数据保存在进程内存中，Render 免费实例重启后数据丢失
- ⚠️ **免费实例休眠**：15 分钟无请求后休眠，首次消息可能延迟
- ⚠️ **不发送文件**：ICS 以文本形式返回，用户需手动复制导入

### 后续扩展

- [ ] 持久化存储（SQLite / Supabase / Google Sheets）
- [ ] access_token 获取 + 主动推送消息
- [ ] ICS 文件附件发送（需上传素材接口）
- [ ] 定时提醒（Cron job）
- [ ] 语音消息识别
- [ ] 更丰富的公众号文章摘要（抓取 + 总结）

---

## 截图参考

> 以下截图在部署过程中需要获取，用于确认配置正确。

| # | 截图内容 | 位置 |
|---|---------|------|
| ① | 企业ID (CorpID) | 企业微信后台 → 我的企业 → 页面底部 |
| ② | 自建应用详情页 | 应用管理 → Jarvis 应用 → AgentID + Secret 入口 |
| ③ | 接收消息服务器配置 | 应用详情 → 接收消息 → API 接收（URL/Token/AESKey 打码）|
| ④ | Render 环境变量 | Render Dashboard → Environment（值打码）|
| ⑤ | Render 部署成功日志 | Render Dashboard → Logs → "Jarvis is live" |
| ⑥ | 微信插件二维码 | 企业微信后台 → 微信插件 → 邀请关注 |
| ⑦ | 微信侧入口 | 微信消息列表 → 企业微信入口 |

---

## 本地开发

```bash
# 克隆
git clone https://github.com/laleoarrow/Jarvis.git
cd Jarvis

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写你的 CorpID / Token / AES Key

# 启动（支持 hot reload, Node >= 18）
npm run dev
```

本地调试时可配合 [ngrok](https://ngrok.com) 暴露 HTTPS URL：

```bash
ngrok http 3000
# 将 ngrok 提供的 https URL 填入企业微信回调配置
```

---

## License

MIT © [laleoarrow](https://github.com/laleoarrow)
