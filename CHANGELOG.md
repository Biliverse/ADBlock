### 🔄 Other Changes
  * 设置页面资源与模块 API 分离，分别使用 PreferencePanes 1.0.0 的 `web.js` 和 `api.js`

### 🛠️ Bug Fixes
  * 修复 grpc 响应头缺失的问题 by @VirgilClyne

### 🔣 Dependencies
  * 升级了 `@nsnanocat/url`
  * 升级了 `@nsnanocat/util`
    * `Lodash` polyfill 新增 `merge` 能力
    * 现在来自`插件`与`模块`等的 `$argument` 配置将深层合并覆盖 `$persistentStore (BoxJs)` 的配置
    * 即，有相同键名时，`$argument` 的值会覆盖 `$persistentStore (BoxJs)` 的值
    * 用户在未更新 `$persistentStore (BoxJs)` 的情况下也不会影响新功能的配置字段
