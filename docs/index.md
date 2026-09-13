---
layout: page
sidebar: false
outline: false
---

<div class="home-hero">
  <p class="hero-kicker">开源知识库 · 全部署名出处</p>
  <h1 class="hero-title">LLM 应用开发完全学习路线</h1>
  <p class="hero-tagline">从 Python 零基础到 LLM 应用开发者，一条路线走完</p>
  <p class="hero-sub">
    199 篇文章 · 3 大板块 · 12 个模块 · 40+ 来源站点，内容抓取/翻译自网络优质教程，逐篇署名出处
  </p>
  <div class="hero-actions">
    <a class="hero-btn primary" href="/llm-study/00-python-basics/">🚀 从 Python 基础开始</a>
    <a class="hero-btn alt" href="/llm-study/04-llm-basics/">直接进入 LLM 部分</a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🧱 第一部分 · 开发者内功</h2>
  <p class="section-desc">补齐编程语言、算法、计算机基础与工程化能力，非科班也能跟上</p>
  <div class="cards">
    <a class="card" href="/llm-study/00-python-basics/">
      <div class="card-head"><span class="card-icon">🐍</span><span class="card-name">Python 基础</span><span class="card-count">22 篇</span></div>
      <p class="card-desc">环境搭建、语法、数据结构类型、面向对象、异常与文件处理，为零基础打底</p>
      <p class="card-tags">列表推导式 · 深浅拷贝 · .env 密钥管理</p>
    </a>
    <a class="card" href="/llm-study/01-dsa/">
      <div class="card-head"><span class="card-icon">🧮</span><span class="card-name">数据结构与算法</span><span class="card-count">21 篇</span></div>
      <p class="card-desc">数组链表到图论：哈希表、树、堆、拓扑排序，源自 hello-algo 开源书</p>
      <p class="card-tags">拓扑排序 · DFS/BFS · 动态规划</p>
    </a>
    <a class="card" href="/llm-study/02-cs-fundamentals/">
      <div class="card-head"><span class="card-icon">💻</span><span class="card-name">计算机基础</span><span class="card-count">23 篇</span></div>
      <p class="card-desc">Linux、Git、操作系统与网络，全部译自 OSTEP、Pro Git、MDN 等英文一手资料</p>
      <p class="card-tags">进程线程 · TCP/HTTP · SSE 流式</p>
    </a>
    <a class="card" href="/llm-study/03-python-advanced/">
      <div class="card-head"><span class="card-icon">⚙️</span><span class="card-name">Python 进阶与框架</span><span class="card-count">17 篇</span></div>
      <p class="card-desc">并发编程、asyncio、Pydantic 与 FastAPI 服务端开发，加上 Docker 容器化</p>
      <p class="card-tags">GIL · FastAPI · Docker · pytest</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🤖 第二部分 · LLM 应用开发</h2>
  <p class="section-desc">从调用 API 到上线 RAG 与 Agent 应用的完整技能树</p>
  <div class="cards">
    <a class="card" href="/llm-study/04-llm-basics/">
      <div class="card-head"><span class="card-icon">🧠</span><span class="card-name">LLM 基础</span><span class="card-count">10 篇</span></div>
      <p class="card-desc">注意力机制、Token 与上下文窗口、训练范式总览，理解模型为何这样工作</p>
      <p class="card-tags">Transformer · BPE · RLHF/DPO</p>
    </a>
    <a class="card" href="/llm-study/05-prompt-engineering/">
      <div class="card-head"><span class="card-icon">💬</span><span class="card-name">Prompt 工程</span><span class="card-count">10 篇</span></div>
      <p class="card-desc">从提示词结构到思维链、结构化输出与注入防护的系统方法论</p>
      <p class="card-tags">Few-shot · CoT · 提示注入防护</p>
    </a>
    <a class="card" href="/llm-study/06-api-development/">
      <div class="card-head"><span class="card-icon">🔌</span><span class="card-name">API 与应用开发</span><span class="card-count">14 篇</span></div>
      <p class="card-desc">Responses API、流式输出、Function Calling、Prompt Caching 与成本优化实战</p>
      <p class="card-tags">Tool Use · 流式 · LiteLLM · FastAPI 封装</p>
    </a>
    <a class="card" href="/llm-study/07-databases/">
      <div class="card-head"><span class="card-icon">🗄️</span><span class="card-name">数据库</span><span class="card-count">16 篇</span></div>
      <p class="card-desc">SQL 建模查询、Redis 缓存、MongoDB 文档库，以及 Milvus/Qdrant/pgvector 向量库</p>
      <p class="card-tags">事务与索引 · SQLAlchemy · 向量库选型</p>
    </a>
    <a class="card" href="/llm-study/08-rag/">
      <div class="card-head"><span class="card-icon">📚</span><span class="card-name">RAG</span><span class="card-count">15 篇</span></div>
      <p class="card-desc">文档解析、分块、检索、重排到评估：企业级检索增强生成全链路</p>
      <p class="card-tags">分块策略 · 混合检索 · GraphRAG · Text2SQL</p>
    </a>
    <a class="card" href="/llm-study/09-agents/">
      <div class="card-head"><span class="card-icon">🤖</span><span class="card-name">Agent 智能体</span><span class="card-count">18 篇</span></div>
      <p class="card-desc">ReAct、MCP、多智能体与 LangGraph，含 Tracing 可观测与生产化</p>
      <p class="card-tags">MCP 实战 · LangGraph · Computer Use</p>
    </a>
    <a class="card" href="/llm-study/10-finetuning-deployment/">
      <div class="card-head"><span class="card-icon">🛠️</span><span class="card-name">微调与部署</span><span class="card-count">17 篇</span></div>
      <p class="card-desc">GPU 环境、LoRA/QLoRA、DPO 偏好优化，到 Ollama 与 vLLM 高吞吐部署</p>
      <p class="card-tags">LoRA · DPO · 量化 · vLLM</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">✨ 第三部分 · AI 时代工作方式</h2>
  <p class="section-desc">用 AI 编程工具把学习成果真正做成产品</p>
  <div class="cards">
    <a class="card" href="/llm-study/11-vibe-coding/">
      <div class="card-head"><span class="card-icon">✨</span><span class="card-name">Vibe Coding</span><span class="card-count">16 篇</span></div>
      <p class="card-desc">Claude Code / Cursor 工作流、AGENTS.md 规范、Spec 驱动开发与上下文工程</p>
      <p class="card-tags">Claude Code · Spec 驱动 · 多智能体协作</p>
    </a>
  </div>
</div>

<div class="home-footer">
  <p>本站内容为学习用途，转载/翻译自网络公开资料，版权归原作者所有；每篇文章文首均标注原文出处与许可。</p>
</div>

<style scoped>
.home-hero {
  text-align: center;
  padding: 64px 24px 48px;
  background: linear-gradient(180deg, var(--vp-c-brand-soft) 0%, transparent 100%);
  border-radius: 0 0 20px 20px;
}
.hero-kicker {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  padding: 2px 14px;
  margin-bottom: 18px;
}
.hero-title {
  font-size: 44px;
  line-height: 1.25;
  font-weight: 800;
  margin: 0 0 14px;
  color: var(--vp-c-text-1);
}
.hero-tagline {
  font-size: 22px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0 0 10px;
}
.hero-sub {
  font-size: 15px;
  color: var(--vp-c-text-2);
  margin: 0 0 26px;
}
.hero-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.hero-btn {
  display: inline-block;
  padding: 10px 26px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.hero-btn.primary {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.hero-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px var(--vp-c-brand-soft);
}
.hero-btn.alt {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}
.hero-btn.alt:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.section {
  max-width: 1152px;
  margin: 0 auto;
  padding: 40px 24px 8px;
}
.section-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 6px;
  padding-left: 12px;
  border-left: 4px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.section-desc {
  color: var(--vp-c-text-2);
  font-size: 14px;
  margin: 0 0 20px;
  padding-left: 16px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.card {
  display: block;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 18px 20px;
  transition: all 0.2s ease;
}
.card:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.card-icon {
  font-size: 22px;
}
.card-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.card-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  padding: 2px 10px;
}
.card-desc {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin: 0 0 10px;
}
.card-tags {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin: 0;
}
.home-footer {
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 13px;
  padding: 48px 24px 32px;
}
@media (max-width: 719px) {
  .hero-title { font-size: 30px; }
  .hero-tagline { font-size: 17px; }
}
</style>
