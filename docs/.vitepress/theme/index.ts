// 自定义主题入口：扩展默认主题，挂载全站 AI 学习助手与语音朗读
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AiAssistant from './components/AiAssistant.vue'
import TtsPlayer from './components/TtsPlayer.vue'
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp(ctx) {
    ctx.app.config.errorHandler = (err, _inst, info) => {
      window.__vueErrors = (window.__vueErrors || [])
      window.__vueErrors.push(String((err && err.message) || err) + ' @' + info)
    }
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h('div', { class: 'floating-widgets' }, [h(AiAssistant), h(TtsPlayer)])
    })
  }
}
