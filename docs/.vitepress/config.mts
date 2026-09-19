import { defineConfig } from 'vitepress'
import sidebar from './sidebar.generated.mjs'

export default defineConfig({
  lang: 'zh-CN',
  base: '/llm-study/',
  title: 'LLM 应用开发完全学习路线',
  description:
    '从 Python 零基础到 LLM 应用开发：抓取全网优质教程的中文学习路线',
  head: [['meta', { name: 'theme-color', content: '#0e9f6e' }]],
  // 教程正文中的 localhost 示例链接（如 Gradio/FastAPI demo）不是站点死链
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  markdown: {
    // 语法高亮主题：亮色 one-light，暗色 one-dark-pro（Atom One 系配色，鲜艳统一）
    theme: { light: 'one-light', dark: 'one-dark-pro' },
    lineNumbers: true
  },
  themeConfig: {
    siteTitle: 'LLM 学习路线',
    nav: [
      { text: '首页', link: '/' },
      {
        text: '① 开发内功',
        items: [
          { text: '🐍 Python 基础', link: '/00-python-basics/' },
          { text: '⚙️ Python 进阶与工程化', link: '/01-python-advanced/' },
          { text: '🧮 数据结构与算法', link: '/02-dsa/' },
          { text: '💻 计算机基础', link: '/03-cs-fundamentals/' }
        ]
      },
      {
        text: '② 原理与提示',
        items: [
          { text: '🧠 LLM 原理与模型生态', link: '/04-llm-basics/' },
          { text: '💬 提示工程与上下文工程', link: '/05-prompt-engineering/' }
        ]
      },
      {
        text: '③ LLM 应用开发',
        items: [
          { text: '🔌 模型 API 与应用开发', link: '/06-api-development/' },
          { text: '🗄️ 数据库与向量存储', link: '/07-databases/' },
          { text: '📚 RAG 检索增强生成', link: '/08-rag/' },
          { text: '🤖 Agent 智能体', link: '/09-agents/' },
          { text: '🛠️ 微调与部署', link: '/10-finetuning-deployment/' }
        ]
      },
      {
        text: '④ AI 编程实战',
        items: [
          { text: '🧰 AI 编程工具与环境', link: '/11-ai-coding-tools/' },
          { text: '📐 规范、上下文与技能', link: '/12-ai-coding-context/' },
          { text: '🛡️ AI 工程实践与质量安全', link: '/13-ai-coding-engineering/' },
          { text: '📚 名篇与视野', link: '/14-ai-coding-classics/' }
        ]
      },
      {
        text: '⑤ 源码与延伸',
        items: [
          { text: '🔍 优质项目源码分析', link: '/15-project-analysis/' },
          { text: '☕ Java 设计模式专栏', link: '/16-design-patterns-java/' }
        ]
      }
    ],
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
