# 🪐 Biliverse: 🛡️ ADBlock
哔哩哔哩app去广告

## 设置面板

接入模板只包含版本对应的 BoxJS JSON Mock 与 ADBlock 自己的 PreferencePanes latest `api.js` 规则。dev 的 JSON、纯配置响应和订阅与业务脚本一次性发布到同一个 Gist；正式版 JSON 固定到对应 Release tag。通用设置前端由 Enhanced 唯一安装，ADBlock 不携带 `web.js` 或任何 `/settings/**` 规则。

配置探测的响应头 `X-PreferencePanes-Version` 与本次脚本构建版本一致：dev 为 `dev.<commit>`，正式版为发布版本。主页只发送 HEAD，不读取设置。Loon 使用原生 `rewrite_v2` Mock 与响应头动作，需要 Loon 3.5.1 或更新版本。

ADBlock 只匹配 `biliverse.github.io` 与 `app.bilibili.com` 的 `/configs/ADBlock`、`/api/ADBlock` 及其动作。官方域名仅作为本机代理映射地址，配置仍由本模块的同版 Gist / Release 提供；主页、通用模块页面和公共静态资源均由 Enhanced 安装。
