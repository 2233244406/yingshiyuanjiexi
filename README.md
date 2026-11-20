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
