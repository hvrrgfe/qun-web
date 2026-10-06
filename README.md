# 群数据看板

高中生学习群的公开数据看板。纯静态页面，直接读 Supabase 里**对匿名角色开放**的视图。

线上地址：**https://hvrrgfe.github.io/qun-web/**

## 页面

| 文件 | 用途 | 谁能看 |
|---|---|---|
| `index.html` | 首页：活跃榜、活跃时段、成员卡片 | 任何人 |
| `me.html` | 成员自助注册 + 查看自己的画像 | 登录后（QQ号 + 密码） |
| `admin.html` | 群主视图：全部画像 | 仅群主账号 |

## 数据来源与隐私边界

页面用 **publishable key**（匿名级）访问 Supabase，所有敏感数据由数据库端的
行级安全（RLS）和受限视图拦住——**密钥公开是安全的**，能读到什么完全由数据库决定。

公开视图 `v_member_cards` / `v_leaderboard` / `v_group_overview` 只包含：

- 发言数、图片数、被回复数、被 @ 数、积分
- 活跃时段、由数据推断的年级与特长

以下字段**永不出现在任何公开视图里**，仅本人和群主可见：

- 性格标签 `persona_tags`
- 薄弱知识点 `weak_topics`
- 大模型摘要 `llm_summary`

`/退出统计` 走物理删除；撤回的消息会把正文置空。

## 部署

推送到 `main` 分支后 GitHub Pages 自动发布（约 1 分钟）。

```bash
git add -A && git commit -m "update" && git push
```

## 本地预览

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/
```

> 注意：页面直接请求 Supabase，所以必须在**能访问 `*.supabase.co`** 的网络下才能看到数据。

## 与主仓库的关系

网站源码同时存在于主仓库 `hvrrgfe/qq-group-bot` 的 `web/` 目录
（那边还有 nginx 配置和 Dockerfile，用于 Railway 上的容器部署）。
这个仓库只放 Pages 需要的静态文件。

改动时记得两边同步，或者以这边为准再拷回主仓库。
