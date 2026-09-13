// 自定义主题入口：基于 Teek 主题，挂载全站 AI 学习助手
import { h } from 'vue'
import Teek from 'vitepress-theme-teek'
import 'vitepress-theme-teek/index.css'
import AiAssistant from './components/AiAssistant.vue'

export default {
  extends: Teek,
  Layout() {
    return h(Teek.Layout, null, {
      'layout-bottom': () => h(AiAssistant)
    })
  }
}
