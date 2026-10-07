# v0.7.0

### 🆕 New Features

  * 新增 Hono 云端转发运行方式，代理脚本与云端 API 共用请求、响应处理能力，并提供 Workers 转发配置和模块参数支持。 @001ProMax @VirgilClyne
  * 新增 grpc-web 响应处理，云端转发保留二进制请求体、客户端参数和所需响应头。 @001ProMax @VirgilClyne
  * 新增弹幕空降助手，可将 SponsorBlock 跳过片段转换为提示弹幕，默认关闭。 @001ProMax @ClydeTime
  * 新增 Story 商业按钮过滤、推荐与评论链接追踪参数清理，以及可选的商业上报阻断、第三方广告归因阻断和严格隐私模式。 @giveup @VirgilClyne
  * 扩展动态视频页、旧版与新版播放页的广告过滤，覆盖关联推荐、广告标签、播放器下方广告、播放引导、暂停广告和结束页广告；保留正常推荐与播放数据。 @ClydeTime
  * 新增可选的搜索响应追踪清理、直播推荐回调与预载链接追踪清理、评论商业跳转及编辑器商品能力过滤；各项可独立配置。 @giveup @ClydeTime
  * 新增个人动态流广告过滤开关，默认关闭。 @ClydeTime

### 🛠️ Bug Fixes

  * 修复 Story 中仅因包含 ad_info 就被当作广告删除的问题，按广告卡片类型判断并保留正常视频。 @giveup @ClydeTime
  * 修复请求缺少 User-Agent 时响应头处理抛错的问题，保持不同客户端所需的 gRPC 状态头行为。 @giveup
  * 默认搜索词拦截改为返回最小合法空 gRPC 响应，避免直接拒绝请求。 @giveup @VirgilClyne

### ‼️ Breaking Changes

  * 品牌及模块名称统一为 Biliverse；设置页面由 Enhanced 统一提供，ADBlock 模块提供自身配置响应。 @VirgilClyne
  * 配置优先级固定为项目默认值、模块参数、BoxJS 依次覆盖，BoxJS 优先；日志等级使用最终合并后的设置。 @ClydeTime
