# v0.7.3

### 🆕 New Features

  * 新增视频页 AIRelateAsync 异步广告过滤，移除广告栏与推荐广告卡片，保留正常推荐和其他模块；遵循 View.AD 设置，并补齐各平台及 Workers 的接口匹配规则。 @leetingo @VirgilClyne
  * 模板参数新增 Storage，可选择模块参数或持久化设置优先，也可只使用默认配置；默认仍优先读取持久化设置，设置面板不提供此选项。 @VirgilClyne

### 🛠️ Bug Fixes

  * 补齐 Egern 插件下载文件，可直接安装对应版本的去广告规则与配置。 @VirgilClyne

### 🔄 Other Changes

  * 异步推荐按真实模块、卡片及 oneof 语义处理，保留未使用的响应字段；没有删除操作时保持响应字节不变。 @VirgilClyne
