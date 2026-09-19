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
    257 篇文章 · 5 大板块 · 17 个模块，内容抓取/翻译自网络优质教程，逐篇署名出处
  </p>
  <div class="hero-actions">
    <a class="hero-btn primary" href="/llm-study/00-python-basics/">🚀 从 Python 基础开始</a>
    <a class="hero-btn alt" href="/llm-study/06-api-development/">直接进入应用开发</a>
    <a class="hero-btn alt" href="/llm-study/11-ai-coding-tools/">AI 编程实战</a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🧱 第一部分 · 开发内功</h2>
  <p class="section-desc">补齐语言、算法与计算机底层，让后面的 LLM 内容不再有隐性门槛</p>
  <div class="cards">
    <a class="card" href="/llm-study/00-python-basics/">
      <div class="card-head"><span class="card-icon">🐍</span><span class="card-name">Python 基础</span><span class="card-count">25 篇</span></div>
      <p class="card-desc">环境搭建、类型与容器、控制流、函数与面向对象，为零基础读者打好语言地基</p>
      <p class="card-tags">列表推导式 · 深浅拷贝 · .env 密钥管理</p>
    </a>
    <a class="card" href="/llm-study/01-python-advanced/">
      <div class="card-head"><span class="card-icon">⚙️</span><span class="card-name">Python 进阶与工程化</span><span class="card-count">22 篇</span></div>
      <p class="card-desc">语言机制、并发与异步、Pydantic 校验、FastAPI 服务化与工具链</p>
      <p class="card-tags">asyncio · Pydantic · FastAPI · uv/Ruff</p>
    </a>
    <a class="card" href="/llm-study/02-dsa/">
      <div class="card-head"><span class="card-icon">🧮</span><span class="card-name">数据结构与算法</span><span class="card-count">25 篇</span></div>
      <p class="card-desc">以 Python 实现为主线：线性结构、树与堆、图、查找排序与算法策略</p>
      <p class="card-tags">拓扑排序 · DFS/BFS · 堆与 Trie · 动态规划</p>
    </a>
    <a class="card" href="/llm-study/03-cs-fundamentals/">
      <div class="card-head"><span class="card-icon">💻</span><span class="card-name">计算机基础</span><span class="card-count">27 篇</span></div>
      <p class="card-desc">Linux 与 Shell、Git 协作、操作系统原理与网络协议栈，全部译自英文一手资料</p>
      <p class="card-tags">进程线程 · epoll · TCP/HTTP · SSE</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🧠 第二部分 · LLM 原理与提示</h2>
  <p class="section-desc">先理解模型，再学会把意图喂给模型</p>
  <div class="cards">
    <a class="card" href="/llm-study/04-llm-basics/">
      <div class="card-head"><span class="card-icon">🧠</span><span class="card-name">LLM 原理与模型生态</span><span class="card-count">10 篇</span></div>
      <p class="card-desc">架构与训练范式如何决定 API 侧的每个行为与旋钮</p>
      <p class="card-tags">Transformer · BPE · RLHF/DPO · 推理模型</p>
    </a>
    <a class="card" href="/llm-study/05-prompt-engineering/">
      <div class="card-head"><span class="card-icon">💬</span><span class="card-name">提示工程与上下文工程</span><span class="card-count">9 篇</span></div>
      <p class="card-desc">把意图写成可稳定执行的指令，并管理模型每一步能看到的信息</p>
      <p class="card-tags">Few-shot · CoT · 上下文工程 · 注入防护</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🤖 第三部分 · LLM 应用开发</h2>
  <p class="section-desc">从调用 API 到上线 RAG 与 Agent 应用的完整技能树</p>
  <div class="cards">
    <a class="card" href="/llm-study/06-api-development/">
      <div class="card-head"><span class="card-icon">🔌</span><span class="card-name">模型 API 与应用开发</span><span class="card-count">16 篇</span></div>
      <p class="card-desc">请求契约、流式、工具调用、结构化输出、可靠性、成本与多模态</p>
      <p class="card-tags">Responses API · Tool Use · Prompt Caching · LiteLLM</p>
    </a>
    <a class="card" href="/llm-study/07-databases/">
      <div class="card-head"><span class="card-icon">🗄️</span><span class="card-name">数据库与向量存储</span><span class="card-count">19 篇</span></div>
      <p class="card-desc">SQL 建模与查询、PostgreSQL 工程化、缓存与文档存储、向量库原理与选型</p>
      <p class="card-tags">索引与事务 · SQLAlchemy · Redis · pgvector</p>
    </a>
    <a class="card" href="/llm-study/08-rag/">
      <div class="card-head"><span class="card-icon">📚</span><span class="card-name">RAG 检索增强生成</span><span class="card-count">19 篇</span></div>
      <p class="card-desc">先跑通最小链路，再逐层解决摄取、检索、进阶范式与生产化</p>
      <p class="card-tags">分块策略 · 混合检索 · GraphRAG · RAGAS</p>
    </a>
    <a class="card" href="/llm-study/09-agents/">
      <div class="card-head"><span class="card-icon">🤖</span><span class="card-name">Agent 智能体</span><span class="card-count">22 篇</span></div>
      <p class="card-desc">规划、工具与协议、记忆与上下文、编排框架、行动型 Agent 与生产化</p>
      <p class="card-tags">MCP · LangGraph · 多智能体 · Tracing</p>
    </a>
    <a class="card" href="/llm-study/10-finetuning-deployment/">
      <div class="card-head"><span class="card-icon">🛠️</span><span class="card-name">微调与部署</span><span class="card-count">20 篇</span></div>
      <p class="card-desc">训练与对齐、量化与推理原理、模型服务化，以及评测与合规</p>
      <p class="card-tags">LoRA/QLoRA · DPO/GRPO · vLLM · 评测</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">✨ 第四部分 · AI 编程实战</h2>
  <p class="section-desc">把 AI 纳入工程纪律：工具、规范、实践与视野</p>
  <div class="cards">
    <a class="card" href="/llm-study/11-ai-coding-tools/">
      <div class="card-head"><span class="card-icon">🧰</span><span class="card-name">AI 编程工具与环境</span><span class="card-count">11 篇</span></div>
      <p class="card-desc">概念边界与工具全景，Claude Code 与 Cursor 上手、权限与成本</p>
      <p class="card-tags">Claude Code · Cursor · SWE-bench · 成本管理</p>
    </a>
    <a class="card" href="/llm-study/12-ai-coding-context/">
      <div class="card-head"><span class="card-icon">📐</span><span class="card-name">规范、上下文与技能</span><span class="card-count">7 篇</span></div>
      <p class="card-desc">让 AI 看懂你的仓库：规范文件、Skills、规格驱动与 MCP 工具生态</p>
      <p class="card-tags">AGENTS.md · Skills · Spec 驱动 · MCP</p>
    </a>
    <a class="card" href="/llm-study/13-ai-coding-engineering/">
      <div class="card-head"><span class="card-icon">🛡️</span><span class="card-name">AI 工程实践与质量安全</span><span class="card-count">11 篇</span></div>
      <p class="card-desc">结对、调试、重构、TDD 与评审，加上安全、供应链、合规与团队落地</p>
      <p class="card-tags">TDD with AI · 代码评审 · 幻觉包 · 团队推广</p>
    </a>
    <a class="card" href="/llm-study/14-ai-coding-classics/">
      <div class="card-head"><span class="card-icon">📖</span><span class="card-name">名篇与视野</span><span class="card-count">5 篇</span></div>
      <p class="card-desc">一线实践者长文原文翻译，配 2026 年回看注记</p>
      <p class="card-tags">Harper Reed · Steve Yegge · Ralph 循环</p>
    </a>
  </div>
</div>

<div class="section">
  <h2 class="section-title">🔍 第五部分 · 源码研读与延伸</h2>
  <p class="section-desc">读真实工程如何落地，以及写给 Java 工程师的延伸支线</p>
  <div class="cards">
    <a class="card" href="/llm-study/15-project-analysis/">
      <div class="card-head"><span class="card-icon">🔍</span><span class="card-name">优质项目源码分析</span><span class="card-count">4 篇</span></div>
      <p class="card-desc">Dify、n8n、RAGFlow、browser-use 四个开源项目核心引擎源码精读</p>
      <p class="card-tags">工作流引擎 · 执行模型 · 检索管线 · Agent 循环</p>
    </a>
    <a class="card" href="/llm-study/16-design-patterns-java/">
      <div class="card-head"><span class="card-icon">☕</span><span class="card-name">Java 设计模式专栏</span><span class="card-count">5 篇</span></div>
      <p class="card-desc">写给 Java 工程师的延伸支线，以 iluwatar 仓库真实代码讲解模式</p>
      <p class="card-tags">创建型 · 结构型 · 行为型 · 企业级模式</p>
    </a>
  </div>
</div>

<div class="home-footer">
  <p>本站内容为学习用途，转载/翻译自网络公开资料，版权归原作者所有；每篇文章文末均标注原文出处与许可。</p>
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
