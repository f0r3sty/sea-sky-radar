# sea-sky-radar — 桌面小挂件（Electron）

船舶雷达 桌面小挂件：OpenSeaFeed AIS 全球船舶实时位置，船型分色 + 航向小帆船 + 最快/航行统计

- 420×292 单窗挂件，透明无边框、可拖动、置顶/沉底、开机自启
- 数据每 60s/5min 自动刷新

## 数据源
见上方描述。运行需 Electron；
> sea-sky-radar@1.0.0 start
> electron . 开发运行。

## 打包
`CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --win --x64`
（国内网络请在 .npmrc 配置 npmmirror 镜像）

## License
MIT
