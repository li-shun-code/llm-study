// 自定义主题入口：扩展默认主题，挂载全站 AI 学习助手
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AiAssistant from './components/AiAssistant.vue'
// 自托管 Noto Sans SC（思源黑体）：不走 gstatic，加载稳定
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(AiAssistant)
    })
  }
}
