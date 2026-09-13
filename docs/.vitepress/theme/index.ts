// 自定义主题入口：扩展默认主题，挂载全站 AI 学习助手
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AiAssistant from './components/AiAssistant.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(AiAssistant)
    })
  }
}
