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
        text: '开发者内功',
        items: [
          { text: '🐍 Python 基础', link: '/00-python-basics/' },
          { text: '🧮 数据结构与算法', link: '/01-dsa/' },
          { text: '💻 计算机基础', link: '/02-cs-fundamentals/' },
          { text: '⚙️ Python 进阶与框架', link: '/03-python-advanced/' }
        ]
      },
      {
        text: 'LLM 应用开发',
        items: [
          { text: '🧠 LLM 基础', link: '/04-llm-basics/' },
          { text: '💬 Prompt 工程', link: '/05-prompt-engineering/' },
          { text: '🔌 API 与应用开发', link: '/06-api-development/' },
          { text: '🗄️ 数据库', link: '/07-databases/' },
          { text: '📚 RAG', link: '/08-rag/' },
          { text: '🤖 Agent 智能体', link: '/09-agents/' },
          { text: '🛠️ 微调与部署', link: '/10-finetuning-deployment/' }
        ]
      },
      { text: '✨ Vibe Coding', link: '/11-vibe-coding/' },
      {
        text: '☕ Java 设计模式',
        items: [
          { text: '专栏导读与模式总览', link: '/13-design-patterns-java/' },
          { text: '创建型模式', link: '/13-design-patterns-java/creational' },
          { text: '结构型模式', link: '/13-design-patterns-java/structural' },
          { text: '行为型模式', link: '/13-design-patterns-java/behavioral' },
          { text: '企业级架构模式', link: '/13-design-patterns-java/enterprise' }
        ]
      },
      {
        text: '🔍 项目源码分析',
        items: [
          { text: '🏗️ Dify 工作流引擎', link: '/12-project-analysis/' },
          { text: '⚙️ n8n 执行引擎', link: '/12-project-analysis/n8n' },
          { text: '📚 RAGFlow 检索管线', link: '/12-project-analysis/ragflow' },
          { text: '🌐 browser-use Agent 循环', link: '/12-project-analysis/browser-use' }
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
