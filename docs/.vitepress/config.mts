import { defineConfig } from 'vitepress'
import { defineTeekConfig } from 'vitepress-theme-teek/config'
import sidebar from './sidebar.generated.mjs'

const teekConfig = defineTeekConfig({
  // 首页 Banner：深色纯底 + 轮播描述
  banner: {
    enabled: true,
    name: 'LLM 应用开发完全学习路线',
    bgStyle: 'pure',
    pureBgColor: '#1b2432',
    descStyle: 'switch',
    switchTime: 4200,
    description: [
      '从 Python 零基础到 LLM 应用开发者，一条路线走完',
      '3 大板块 · 12 个模块 · 199 篇文章，全部署名出处',
      '内置 AI 学习助手，随时解答你的疑问',
    ],
    features: [
      { title: '🧱 开发者内功', details: 'Python · 数据结构 · 计算机基础 · 框架', link: '/00-python-basics/' },
      { title: '🤖 LLM 应用开发', details: 'Prompt · API · 数据库 · RAG · Agent · 微调', link: '/04-llm-basics/' },
      { title: '✨ AI 时代工作方式', details: 'Vibe Coding · Claude Code · Spec 驱动', link: '/11-vibe-coding/' },
    ],
  },
  blogger: {
    name: 'LLM 学习路线',
    slogan: '抓取全网优质教程的中文学习路线',
  },
  // 右侧只保留站点信息卡片（文章数/字数统计），分类/标签/友链本站未用
  category: { enabled: false },
  tag: { enabled: false },
  friendLink: { enabled: false },
  // 文章列表不用封面图（多数文章无首图，占位图标难看）
  post: { showCapture: false },
  docAnalysis: {
    createTime: '2026-09-13',
    wordCount: true,
    readingTime: true,
  },
  footerInfo: {
    copyright: {
      show: true,
      createYear: 2026,
      suffix: 'LLM 应用开发完全学习路线 · 内容转载/翻译自网络公开资料，版权归原作者所有',
    },
  },
  sidebarTrigger: true,
})

export default defineConfig({
  extends: teekConfig,
  lang: 'zh-CN',
  base: '/llm-study/',
  title: 'LLM 应用开发完全学习路线',
  description:
    '从 Python 零基础到 LLM 应用开发：抓取全网优质教程的中文学习路线',
  head: [['meta', { name: 'theme-color', content: '#3eaf7c' }]],
  // 教程正文中的 localhost 示例链接（如 Gradio/FastAPI demo）不是站点死链
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    siteTitle: 'LLM 学习路线',
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
          modal: {
            noResultsText: '没有结果',
            resetButtonTitle: '清空',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    sidebar
  }
})
