# PocketSub

PocketSub 是一个面向移动端的字幕翻译编辑器网站。它的目标是让用户可以在手机浏览器里导入字幕文件、查看视频画面、逐行翻译字幕，并同时管理翻译计划和收入统计。

项目使用 React + Vite + JavaScript 实现。登录、注册、邮箱验证和忘记密码由 Firebase Authentication 提供；字幕项目、计划和收入相关数据保存在 Cloud Firestore；本地视频文件仍保存在当前设备的 IndexedDB 中，避免上传大文件。

## 主要功能

- 导入 `.srt` 字幕文件并解析为逐行字幕。
- 字幕总览页面显示所有 line，点击某条字幕可以进入编辑。
- 编辑页面支持原文、译文、上下文查看和 `\N` 换行符插入。
- 支持本地视频上传和 YouTube 链接绑定。
- 播放视频时根据当前时间自动高亮对应字幕。
- 点击字幕可以跳转到对应视频时间。
- 支持字幕开始时间、结束时间的微调。
- 支持任务计划、截止日期、日历和结算日显示。
- 支持收入统计、工作时段筛选、收入图表和 CSV 导出。
- 支持 Firebase 邮箱注册、登录、退出、邮箱验证和忘记密码。
- 支持云端保存字幕项目、计划、收入数据和个人设置。
- 支持设置、语言切换、默认单价和结算规则配置。
- 针对手机端做了专门布局优化。

## 技术栈

- React
- Vite
- JavaScript
- CSS
- Firebase Authentication
- Cloud Firestore
- IndexedDB
- lucide-react 图标库
- Oxlint 代码检查

## 运行环境

需要先安装 Node.js。建议使用较新的 LTS 版本。

## 安装依赖

```bash
npm install
```

## Firebase 配置

在 Firebase Console 中创建项目后，需要开启：

- Authentication：Email/Password 登录方式
- Cloud Firestore
- Firebase Hosting

复制 `.env.example` 为 `.env`，填入 Firebase Web App 配置：

```bash
cp .env.example .env
```

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firestore 安全规则在 `firestore.rules` 中，核心规则是用户只能读写自己的数据：

```text
users/{uid}/...
```

## 本地开发运行

```bash
npm run dev
```

运行后在浏览器打开终端显示的地址，通常是：

```text
http://localhost:5173/
```

如果 5173 端口已被占用，Vite 会自动使用其他端口。

## 构建项目

```bash
npm run build
```

构建结果会输出到 `dist/` 目录。

## 预览构建结果

```bash
npm run preview
```

## 代码检查

```bash
npm run lint
```

## 数据保存说明

PocketSub V1 使用 Firebase 作为后端服务。

- 未登录：数据只保存在当前页面状态中，刷新后不会保留。
- 登录后：字幕项目、账户设置、计划和收入相关数据会保存到 Firestore。
- 登录后：注册、登录、退出、邮箱验证和忘记密码使用 Firebase Authentication。
- 本地视频：视频文件不会上传到云端，只保存在当前设备的 IndexedDB 中。换设备登录后，字幕项目会同步，但视频需要重新选择。

## 字幕和视频说明

- 字幕文件支持标准 SRT 格式。
- 本地视频通过浏览器读取，并缓存在当前设备，不会上传到 Firebase。
- YouTube 链接会转换为嵌入播放器进行预览。

## 部署

安装 Firebase CLI：

```bash
npm install -g firebase-tools
```

登录并初始化/部署：

```bash
firebase login
npm run build
firebase deploy
```

项目已包含 `firebase.json` 和 `firestore.rules`，Hosting 的发布目录为 `dist/`。

## 项目结构

```text
src/
  components/   通用组件
  pages/        页面组件
  styles/       全局样式
  utils/        字幕解析、导出、时间轴、收入统计等工具函数
```

## 适用场景

这个项目适合作为字幕翻译工作台原型，也适合作为 JavaScript / React 课程项目展示。它重点展示移动端字幕编辑、视频预览、任务计划和收入统计等与字幕翻译流程相关的功能。
