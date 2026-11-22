# WebHomeTV 站点列表 PWA 独立版

从 WebHomeTV Windows v0.20.0 的站点列表功能独立整理，并升级为可安装的 PWA。

- GitHub Pages 静态部署，无需 Python / Node.js / 数据库
- 安卓 Chrome / Edge 可安装到主屏幕；iOS Safari 可“添加到主屏幕”
- Service Worker 缓存网页外壳，离线时可重新打开界面；API 请求仍需联网
- 导入配置只在当前页面内存中处理；请求设置保存在当前浏览器 localStorage

## GitHub Pages 部署
1. 将项目全部文件上传到仓库根目录，保留 `.github/workflows/pages.yml`。
2. Settings → Pages → Source 选择 **GitHub Actions**。
3. Actions → Deploy Site List to GitHub Pages → Run workflow。
4. 成功后从 Pages 页面打开 HTTPS 网址。

## 安卓安装
1. 安卓 Chrome / Edge 打开 GitHub Pages 的 HTTPS 地址。
2. 页面顶部出现“安装到手机”时点击并确认。
3. 若按钮没有出现，打开浏览器右上角菜单，选择“安装应用”或“添加到主屏幕”。

## iPhone / iPad 安装
使用 Safari 打开 HTTPS 地址 → 分享 → 添加到主屏幕。

## 离线能力
首次联网访问后缓存网页入口、清单和图标。离线时可以打开界面，但远程配置获取、API 测试和下载仍需要网络。浏览器可能因存储策略清理缓存。

## 请求头 / CORS
浏览器禁止网页自行设置 User-Agent、Cookie 等受限请求头。未配置 Worker 时，页面只发送浏览器允许的常规请求头；若站点需要 UA、Referer、Cookie 或跨域代理，请部署 `worker/worker.js`。

### Cloudflare Worker（可选）
1. Cloudflare Dashboard → Workers & Pages → Create Worker。
2. 粘贴 `worker/worker.js` 并部署。
3. Worker Settings → Variables and Secrets 添加 Secret `PROXY_TOKEN`。
4. 网页网络请求设置中填写 Worker URL 和相同令牌，保存并测试连接。

**安全提醒：** Worker 是外部请求代理，必须配置随机令牌。令牌保存在当前浏览器 localStorage。只用于你有权访问的站点。

## 兼容范围
- type=0/1/2/4：展示 API 并测试接口返回。
- type=3：展示 Spider 地址并可下载脚本；不执行 Spider。
- 不包含 Python / QuickJS Spider 运行时、Android 专有运行时及完整站点播放执行。
- 验证码、动态签名、JS 挑战等复杂机制不能仅靠普通代理自动解决。

## 缓存与本地数据管理（v1.2.0）

页面底部新增“缓存与本地数据管理”：

- “检测可清理数据”会枚举当前网站来源可访问的 Cache Storage、localStorage、sessionStorage、IndexedDB 和 Service Worker 注册。
- 每个检测到的缓存/数据库/存储键单独列出，可单独勾选；支持全选和取消全选。
- 对可读取的缓存响应、本地存储值及部分 IndexedDB 数据显示估算占用空间；浏览器不允许读取大小时显示“无法准确估算”。
- 执行删除前会显示完整项目清单并要求确认；删除后自动重新检测并报告成功/失败结果。
- `whtv_worker`、`whtv_token`、`whtv_ua`、`whtv_ref`、`whtv_cookie` 以及名称疑似包含 Worker、Token、UA、Referer、Cookie、认证信息的存储键默认保护且不勾选。
- Service Worker 注册默认保护且不勾选，因为注销会影响离线能力。若确实需要，可在“全选”后确认删除。
- “全选”会包含默认保护项目；请务必查看二次确认清单。只想清理普通缓存时，建议手动勾选 Cache Storage / IndexedDB 等项目。

**范围说明：** 浏览器网页只能管理当前来源（协议、域名和端口组合）且浏览器允许访问的数据，不能清理其他网站的数据、浏览器历史记录、下载记录或系统级缓存。浏览器可能限制 IndexedDB 枚举、响应体读取和存储大小估算；显示的空间仅为估算，不等同于浏览器存储配额统计。


## 手动添加链接下载（v1.3.0）

在左侧“导入站点配置”下方新增“手动添加链接下载”，不依赖先导入站点配置：

- 单个下载：粘贴 HTTP/HTTPS 文件直链，可选填写自定义保存文件名；留空时优先从响应的 Content-Disposition 或 URL 路径推断文件名。
- 批量下载：每行填写一个 HTTP/HTTPS URL，支持空行和以 `#` 开头的注释行；重复链接自动去重，按顺序逐个下载并显示进度、成功/失败详情。
- 请求优先级：填写了 Cloudflare Worker 地址时通过 Worker 获取文件；未填写时尝试浏览器直连，目标服务器必须允许 CORS。请求会沿用当前默认 UA、Referer、Cookie 设置（浏览器直连仍受浏览器请求头限制）。
- 文件会先读入浏览器 Blob 再触发下载；大文件会占用浏览器内存。批量下载时浏览器可能要求允许多个文件下载。
- 此功能只下载用户有权访问的 HTTP/HTTPS 直链，不执行下载内容；不能绕过登录、权限控制、验证码、动态签名或防盗链。

升级后若已安装 PWA，请联网重新打开页面；Service Worker 缓存版本已更新为 v1.3.0。




## 解析历史记录（v1.4.0，v1.5.0 保留）

- 自动记录配置解析成功/失败、远程配置获取失败、站点 API 测试成功/失败、手动下载成功/失败以及坚果云同步结果。
- 历史保存在当前浏览器 `localStorage`，最多保留最近 500 条；可搜索、筛选、单条删除、清空和导出 JSON。
- 清空本机历史不会自动删除云端历史；下一次双向同步时，本机和云端保留的记录会按唯一 ID 合并。

## 坚果云 WebDAV 跨设备同步（v1.5.0）

1. 在坚果云「账户信息 → 安全选项 → 第三方应用管理」创建应用密码。使用坚果云注册邮箱和此应用密码，不要使用网页登录密码。
2. 更新并重新部署 `worker/worker.js` 到你自己的 Cloudflare Worker。原有 `/health` 与 `/fetch` 保留，`/sync` 增加自定义目录和自动创建能力。
3. 确认 Worker Secret `PROXY_TOKEN` 仍然存在；网页网络请求设置中的 Worker 地址和 Token 必须正确。
4. 页面“坚果云跨设备配置同步”填写 WebDAV 地址 `https://dav.jianguoyun.com/dav/`、坚果云同步目录、同步文件名、账号邮箱、第三方应用密码和同步主密码。目录默认 `WebHomeTV`，可以改成其他目录或多级目录（例如 `备份/站点列表`）；目录不存在时，Worker 会逐级自动创建。电脑和手机必须使用完全相同的目录、文件名和同步主密码。同步主密码至少 6 位。
5. 点击“测试坚果云连接”，成功后点击“立即双向同步”。第一次同步若本机与云端配置不同，会询问采用哪一端。
6. 默认自动同步间隔 24 小时。静态 PWA 无法在浏览器完全关闭或手机系统休眠时保证定时执行；页面重新打开后会检查是否到期并补同步。

### 同步安全与冲突规则

- 配置文件在浏览器端使用 PBKDF2-SHA256（250,000 次迭代）派生 AES-256-GCM 密钥后加密；坚果云保存的是密文 JSON。
- 坚果云第三方应用密码在本设备先使用同步主密码加密后保存在浏览器 localStorage；Worker 仅在单次 HTTPS 请求中接收凭据并转发，不写入 Worker 环境变量或日志。请只使用自己控制的 Worker，并保护 `PROXY_TOKEN`。
- 同步主密码不会上传；忘记主密码将无法解密云端数据。电脑和手机必须输入同一主密码。
- 双端配置都变化时会提示选择“本机”或“云端”，取消则不覆盖。解析历史按记录 ID 合并，最多保留 500 条。
- WebDAV 地址由 Worker 限定为坚果云官方 HTTPS 主机；目录路径逐级校验，禁止 `.`、`..`、反斜杠、百分号和控制字符；文件名限定为单个 JSON 文件名，避免任意 URL 代理。
- 每次测试、读取或写入前，Worker 使用 WebDAV `PROPFIND` 检查目录；目录不存在时使用 `MKCOL` 逐级创建，并再次确认。目录已存在时不会重复创建。
- 自动同步仅在页面打开期间定时检查；浏览器关闭或系统休眠时无法保证 24 小时准点运行。

官方说明：<https://help.jianguoyun.com/?p=2064>


## v1.5.0 升级说明

- 坚果云同步设置新增“坚果云同步目录”，默认 `WebHomeTV`；升级后若新目录中还没有同步文件，Worker 会兼容读取 v1.4.0 留在 WebDAV 根目录中的旧文件，后续上传时写入新目录。
- 可设置单层或多层目录，例如 `WebHomeTV`、`个人备份/WebHomeTV`。同一组设备必须使用相同目录和文件名。
- Worker `/health`、`/fetch` 的功能和调用方式保留；`/sync` 在读写前自动检查并创建目录。
- 更新 GitHub Pages 项目文件后重新部署；同时必须将新版 `worker/worker.js` 完整替换到 Cloudflare Worker 并部署。只更新网页、不更新 Worker，会因旧 Worker 不认识 `dir` 字段而无法获得自动建目录功能。
- 升级后请先在网页保存设置，再点击“测试坚果云连接”。测试会检查并在必要时创建所选目录。


## v1.5.1 手机端坚果云下载修复

- 修复手机端 AES-GCM 解密异常时错误提示为空的问题，显示可识别的错误原因。
- 解密失败时使用当前输入的同步主密码重新派生密钥并重试，避免 IndexedDB 中异常/过期缓存密钥导致持续解密失败。
- 解密成功后更新本地密钥缓存；不修改 Worker 的 `/health`、`/fetch`、`/sync` 接口和坚果云目录规则。
- 更新 PWA Service Worker 缓存版本，避免手机继续使用旧版页面缓存。
