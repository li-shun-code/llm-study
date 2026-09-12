import { defineConfig } from 'vitepress'
import sidebar from './sidebar.generated.mjs'

export default defineConfig({
  lang: 'zh-CN',
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
