本压缩包是 Windows x64 绿色版构建工程，不是已经编译好的 EXE 发布包。

无需在你的本机安装 Python、Node.js、QuickJS 或项目依赖。Windows EXE 由 GitHub Actions 云端 Windows 构建机生成。

操作步骤：
1. 在 GitHub 网站新建一个空仓库（例如 webhtv-site-list-portable）。
2. 解压本 ZIP，将里面“WebHomeTV-站点列表独立版-精简版”文件夹中的全部内容上传到仓库根目录。必须包含 .github/workflows/build-windows.yml 工作流文件。
3. 打开该仓库的 Actions 页面，选择“构建 Windows x64 绿色文件夹版”，点击 Run workflow。
4. 等待工作流显示绿色成功状态后，打开本次运行记录，在 Artifacts 区域下载“WebHomeTV-站点列表-Windows-x64-绿色文件夹版”。
5. 将最终 ZIP 下载到本机并解压，双击“启动站点列表.exe”。

最终发布包内应包含：启动站点列表.exe、_internal 运行库目录、data 数据目录、停止站点列表.bat 和 README.txt。运行时不需要在本机安装 Python 或项目依赖。
