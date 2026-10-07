# 🪐 Biliverse: 🛡️ ADBlock
哔哩哔哩app去广告

## Protobuf

运行时协议及其 JavaScript、TypeScript 类型由 `@biliverse/protobuf` package 统一提供，源码维护在 [Biliverse/protobuf](https://github.com/Biliverse/protobuf)。ADBlock 直接导入 package，不再保存本地协议或生成文件。完整版定义以 BACNext 和 Apifox 为对照来源。

AIRelate 使用共享 `Module` 的 `data.oneofKind` 与 `data.relates.cards`，卡片直接以 `RelateCard` 结构判定广告。未发生删除时保留原响应字节；发生删除时保留正常数据和未知字段。旧 View 广告标签使用 `TabOtype.CmURI`，广告消息使用真实 `Any` 类型，`VideoGuide` 按整条消息删除。正式依赖为 `@biliverse/protobuf ^1.1.0`。

## 设置面板

接入模板只将版本对应的 BoxJS JSON Mock 到 `/api/ADBlock`。dev 的 JSON、纯配置响应和订阅与业务脚本一次性发布到同一个 Gist；正式版 JSON 固定到对应 Release tag。通用设置前端与固定存储 API 由 Enhanced 唯一安装，ADBlock 不携带 PreferencePanes `web.js`、`api.js` 或任何 `/settings/**` 规则。

配置探测的响应头 `X-PreferencePanes-Version` 与本次脚本构建版本一致：dev 为 `dev.<commit>`，正式版为发布版本。主页只发送 HEAD，不读取设置。Loon 使用原生 `rewrite_v2` Mock 与响应头动作，需要 Loon 3.5.1 或更新版本。

`arguments-builder.full.config.ts` 按业务分组定义全部参数，并汇总生成完整 BoxJS 设置与类型声明；`arguments-builder.release.config.ts` 和 `arguments-builder.dev.config.ts` 分别导入并组合所需参数组，生成各版本模板与 BoxJS JSON。当前正式版与开发版均选用全部参数组，保留现有选项、默认值与顺序。`Storage` 仅提供给模板 argument，不写入 BoxJS、设置面板或 `Settings` 类型。默认 `PersistentStore` 按默认配置 → 模块参数 → 持久化设置合并；`Argument` 按默认配置 → 持久化设置 → 模块参数合并；`database` 只读取默认配置。配置合并直接使用 `@nsnanocat/util` 的 `getStorage`。

ADBlock 只匹配 `biliverse.github.io` 与 `app.bilibili.com` 的精确 `/api/ADBlock`。官方域名仅作为本机代理映射地址，BoxJS 仍由本模块的同版 Gist / Release 提供；主页、通用模块页面、固定存储 API 和公共静态资源均由 Enhanced 安装。
