# 🪐 Biliverse: 🛡️ ADBlock
哔哩哔哩app去广告

## 设置面板

接入模板只将版本对应的 BoxJS JSON Mock 到 `/api/ADBlock`。dev 的 JSON、纯配置响应和订阅与业务脚本一次性发布到同一个 Gist；正式版 JSON 固定到对应 Release tag。通用设置前端与固定存储 API 由 Enhanced 唯一安装，ADBlock 不携带 PreferencePanes `web.js`、`api.js` 或任何 `/settings/**` 规则。

配置探测的响应头 `X-PreferencePanes-Version` 与本次脚本构建版本一致：dev 为 `dev.<commit>`，正式版为发布版本。主页只发送 HEAD，不读取设置。Loon 使用原生 `rewrite_v2` Mock 与响应头动作，需要 Loon 3.5.1 或更新版本。

ADBlock 只匹配 `biliverse.github.io` 与 `app.bilibili.com` 的精确 `/api/ADBlock`。官方域名仅作为本机代理映射地址，BoxJS 仍由本模块的同版 Gist / Release 提供；主页、通用模块页面、固定存储 API 和公共静态资源均由 Enhanced 安装。
