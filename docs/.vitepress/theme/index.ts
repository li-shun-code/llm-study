// 自定义主题入口：扩展默认主题，后续 AI 助手等全局组件在此挂载
import DefaultTheme from 'vitepress/theme'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 全局组件在后续任务中注册
  }
}
