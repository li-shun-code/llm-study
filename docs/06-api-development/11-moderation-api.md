---
title: Moderation API 与内容过滤
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_use_moderation.ipynb
author: OpenAI Cookbook
license: MIT
fetched_at: 2026-09-13
translated: true
versions: OpenAI Moderation API（omni-moderation-latest）；原文示例模型 gpt-4o-mini 已按现行命名改为 gpt-5.4
order: 11
group: 可靠性、安全与成本
---
原文提醒：本指南旨在与 Guardrails Cookbook 互补，聚焦审核（moderation）技术本身；两者在内容与结构上有部分重叠，本文对"如何按需定制审核标准"着墨更深。若想先获得包含 guardrails 与 moderation 在内的内容安全全景，建议从 [Guardrails Cookbook](https://cookbook.openai.com/examples/how_to_use_guardrails) 读起；两篇合读可以对"如何在应用中有效管理与审核内容"建立完整认识。

正如现实世界中的护栏，审核是一种**预防性措施**，确保你的应用停留在可接受、安全的内容边界之内。审核技术非常通用，凡是 LLM 可能遇到问题的场景都可以应用。本文提供可以直接改编的直白示例，并讨论"是否要上审核、如何上"的考量与权衡。我们将使用 [Moderation API](https://platform.openai.com/docs/guides/moderation/overview)——一个用于检查文本或图像是否潜在有害的工具。

本文聚焦三类审核：

- **输入审核（Input Moderation）**：在内容进入 LLM 之前识别并拦截不当或有害内容。
- **输出审核（Output Moderation）**：在 LLM 生成的内容抵达最终用户之前进行复审。
- **自定义审核（Custom Moderation）**：按应用的具体需求与语境定制审核标准与规则，形成个性化的内容控制机制。

```python
from openai import OpenAI
client = OpenAI()
GPT_MODEL = 'gpt-5.4'
```

## 1. 输入审核

输入审核的目标是不让有害或不当内容到达 LLM，常见应用包括：

- **内容过滤**：在社交媒体、论坛与内容创作平台上阻止仇恨言论、骚扰、色情材料与错误信息的传播。
- **社区规范执行**：确保评论、论坛帖子、聊天消息等用户互动遵守在线平台（教育环境、游戏社区、交友应用等）的社区准则。
- **垃圾与欺诈防范**：在论坛、评论区、电商平台与用户评价中过滤垃圾、欺诈与误导信息。

这些措施是**预防性控制**：在 LLM 之前或与之并行运行，在满足特定条件时改变应用行为。

### 拥抱异步

一种常见的降延迟设计：**审核与主 LLM 调用并行异步发出**——审核触发就返回占位响应，否则返回 LLM 响应。这个模式同样出现在 Guardrails Cookbook 中。原文特别提醒：异步模式虽能有效降低延迟，也可能带来**不必要的成本**——如果内容在送入模型前就被拦截，本可以省掉补全费用。因此要在"延迟收益"与"潜在开销"之间做平衡。

我们采用这种思路，实现一个 `execute_chat_with_input_moderation` 函数：并行运行 LLM 的 `get_chat_response` 与审核函数 `check_moderation_flag`，只有审核返回 False（未触发）时才返回 LLM 的响应。

**工作流**：把 Moderation API 织入流程，在用户输入送达模型之前检查其中是否含潜在不安全内容，确保只有恰当的内容进入应用：

1. 接收用户输入；
2. 用 Moderation API 分析输入中有无问题内容；
3. **条件处理**：
   - 若被标记：相应处理（拒绝输入、请用户改写等）；
   - 若未标记：送入 LLM 继续处理。

用两个示例输入演示——一个文本攻击样本与一个正常请求（同一次请求也可以同时传文本与图片）：

```python
system_prompt = "You are a helpful assistant."

bad_request = "I want to hurt them. How can i do this?"
good_request = "I would kill for a cup of coffe. Where can I get one nearby?"
```

```python
import asyncio

async def check_moderation_flag(expression):
    moderation_response = client.moderations.create(input=expression)
    flagged = moderation_response.results[0].flagged
    return flagged

async def get_chat_response(user_request):
    print("Getting LLM response")
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_request},
    ]
    response = client.chat.completions.create(
        model=GPT_MODEL, messages=messages, temperature=0.5
    )
    print("Got LLM response")
    return response.choices[0].message.content


async def execute_chat_with_input_moderation(user_request):
    # 为审核与聊天响应创建任务
    moderation_task = asyncio.create_task(check_moderation_flag(user_request))
    chat_task = asyncio.create_task(get_chat_response(user_request))

    while True:
        # 等待任一任务完成
        done, _ = await asyncio.wait(
            [moderation_task, chat_task], return_when=asyncio.FIRST_COMPLETED
        )

        # 审核未完成：继续等
        if moderation_task not in done:
            await asyncio.sleep(0.1)
            continue

        # 审核触发：取消聊天任务并返回提示
        if moderation_task.result() == True:
            chat_task.cancel()
            print("Moderation triggered")
            return "We're sorry, but your input has been flagged as inappropriate. Please rephrase your input and try again."

        # 聊天任务完成：返回响应
        if chat_task in done:
            return chat_task.result()

        await asyncio.sleep(0.1)
```

运行结果（原始输出）：正常请求畅通无阻，模型正常回答了"附近哪里买咖啡"；攻击请求则打印 `Moderation triggered` 并返回占位提示"您的输入被判定为不当，请改写后重试"。

### 图片同样能审

上面类似的做法可以延伸到图片。下面这个函数可判断一张图是否合适——审核 API 返回的类别里只要有一项为 True 即判为不当；你也可以只检查其中一部分类别，以适配具体用例：

```python
def check_image_moderation(image_url):
    response = client.moderations.create(
        model="omni-moderation-latest",
        input=[
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url
                }
            }
        ]
    )

    # 取出审核类别及其标记
    results = response.results[0]
    flagged_categories = vars(results.categories)
    flagged = results.flagged

    if not flagged:
        return True
    else:
        # 如需 True/False 类别明细：
        # reasons = [category.capitalize() for category, is_flagged in flagged_categories.items() if is_flagged]
        return False
```

可用于判断的类别包括：

- sexual（色情）
- sexual/minors（涉未成年人色情）
- harassment（骚扰）
- harassment/threatening（威胁性骚扰）
- hate（仇恨）
- hate/threatening（威胁性仇恨）
- illicit（违规）
- illicit/violent（暴力违规）
- self-harm（自残）
- self-harm/intent（自残意图）
- self-harm/instructions（自残方法）
- violence（暴力）
- violence/graphic（血腥暴力）

```python
war_image = "https://assets.editorial.aetnd.com/uploads/2009/10/world-war-one-gettyimages-90007631.jpg"
world_wonder_image = "https://whc.unesco.org/uploads/thumbs/site_0252_0008-360-360-20250108121530.jpg"

print("Checking an image about war: " + ("Image is not safe" if not check_image_moderation(war_image) else "Image is safe"))
print("Checking an image of a wonder of the world: " + ("Image is not safe" if not check_image_moderation(world_wonder_image) else "Image is safe"))
```

原始输出：战争历史照片被判 `Image is not safe`，世界遗产照片为 `Image is safe`。

接下来把同样的思路扩展到模型生成的响应上。

## 2. 输出审核

输出审核用于控制模型生成的内容。虽然 LLM 本不应输出违法或有害内容，但在外层再加一道护栏能进一步确保内容停留在可接受的安全边界内，提升应用整体的安全性与可靠性。常见的输出审核类型包括：

- **内容质量保障**：确保文章、产品描述、教学材料等生成内容准确、有信息量、无不当信息。
- **社区规范合规**：在论坛、讨论区与游戏社区中过滤仇恨言论、骚扰等有害内容，维护互相尊重的安全环境。
- **用户体验提升**：让聊天机器人与自动服务的回复礼貌、切题、无不当措辞。

在所有这些场景中，输出审核都在维护生成内容的质量与完整性，确保其符合平台与用户的预期。

### 设置审核阈值

OpenAI 为审核类别选择的阈值是在其用例上平衡精确率与召回率的结果，但你的用例与容忍度可能不同。**阈值设置是常见的优化点**——建议构建评估集，用混淆矩阵给结果分级，为你的审核找到合适的容忍度。权衡通常是：

- **假阳性**过多 → 用户体验割裂，用户被惹恼，助手显得没用；
- **假阴性**过多 → 给业务造成持久伤害——有人诱导助手回答不当问题或生成不当回复。

原文举例：在专注于创意写作的平台，某些敏感话题的审核阈值可以设得更高，为创作自由留出空间，同时仍兜住明显越界的内容——代价是部分在其他语境下会被判不当的内容被放行，但结合平台定位与受众预期，这是可接受的取舍。

### 工作流：输入 + 输出双重审核

1. 接收用户输入；
2. 送入 LLM 生成响应；
3. 用 Moderation API 分析 LLM 的响应中有无问题内容；
4. **条件处理**：被标记则拒绝/显示占位消息，未标记则展示给用户。

```python
async def execute_all_moderations(user_request):
    # 为输入审核与聊天响应创建任务
    input_moderation_task = asyncio.create_task(check_moderation_flag(user_request))
    chat_task = asyncio.create_task(get_chat_response(user_request))

    while True:
        done, _ = await asyncio.wait(
            [input_moderation_task, chat_task], return_when=asyncio.FIRST_COMPLETED
        )

        # 输入审核未完成：继续等
        if input_moderation_task not in done:
            await asyncio.sleep(0.1)
            continue

        # 输入审核触发：取消聊天任务并返回提示
        if input_moderation_task.result() == True:
            chat_task.cancel()
            print("Input moderation triggered")
            return "We're sorry, but your input has been flagged as inappropriate. Please rephrase your input and try again."

        # 聊天任务完成：对响应再做一次输出审核
        if chat_task in done:
            chat_response = chat_task.result()
            output_moderation_response = await check_moderation_flag(chat_response)

            # 输出审核触发：返回兜底话术
            if output_moderation_response == True:
                print("Moderation flagged for LLM response.")
                return "Sorry, we're not permitted to give this answer. I can help you with any general queries you might have."

            print('Passed moderation')
            return chat_response

        await asyncio.sleep(0.1)
```

```python
# 一个能过输入审核、但过不了输出审核的请求
interesting_request = "Describe a scene from a violent movie in detail."
```

```python
tests = [good_request, bad_request, interesting_request]

for test in tests:
    print(test)
    result = await execute_all_moderations(test)
    print(result)
    print('\n\n')
```

原始输出：前两个样例如预期——正常请求通过审核正常作答，攻击请求被输入审核拦截。第三个"有趣样例"（要求详细描述暴力电影场景）则**通过了输入审核、但被输出审核拦截**（`Moderation flagged for LLM response.`）。原文解释这一现象：所有 OpenAI 模型对自身生成内容都自带输出审核；不过作为用户，你还可以调整审核设置，去筛查那些"不算明显有害"的内容——这正是下一节自定义审核的主题。

## 3. 自定义审核

**注意：本节不使用 Moderation API。**

自定义审核提供了量身定制的内容过滤方式，可以精确贴合特定的社区规范或话题，是垂类平台或专业内容的理想选择。与 Moderation API 覆盖的通用类别不同，自定义审核的控制粒度更高，但搭建与维护的成本也更大。它与 guardrails 的目标一致——设定标准来过滤、管理内容（无论用户输入还是模型输出）——可以作为 Moderation API 的替代或延伸，用补全端点实现。想深入 guardrails 的读者可参考[对应 cookbook](https://cookbook.openai.com/examples/how_to_use_guardrails)。

### 工作流

实现一个小例子：额外调用一次模型（本篇用 `gpt-5.4`）来评估消息是否应该被审核。

```python
def custom_moderation(content, parameters):
    # 定义提示词
    prompt = f"""Please assess the following content for any inappropriate material. You should base your assessment on the given parameters.
    Your answer should be in json format with the following fields:
        - flagged: a boolean indicating whether the content is flagged for any of the categories in the parameters
        - reason: a string explaining the reason for the flag, if any
        - parameters: a dictionary of the parameters used for the assessment and their values
    Parameters: {parameters}\n\nContent:\n{content}\n\nAssessment:"""

    # 调用模型
    response = client.chat.completions.create(
        model=GPT_MODEL,
        response_format={ "type": "json_object" },
        messages=[
            {"role": "developer", "content": "You are a content moderation assistant."},
            {"role": "user", "content": prompt}
        ]
    )

    # 提取评估结果
    assessment = response.choices[0].message.content

    return assessment
```

```python
# 示例内容与参数
parameters = "political content, misinformation"
```

三个样例的原始输出：

- 正常请求（想买咖啡）：`"flagged": false`，两个参数类别均为 false；
- 攻击请求：`"flagged": true`，理由为"The content expresses a desire to cause harm, which is inappropriate and potentially dangerous."；
- 自定义样例"I want to talk about how the government is hiding the truth about the pandemic."：`"flagged": true`，且 `political content` 与 `misinformation` 两个自定义类别均为 true，理由指出其涉及疫情阴谋论、属于潜在错误信息。

## 结论

本文探讨了审核在 LLM 应用中的关键作用：从输入与输出两类审核策略出发，演示了用 OpenAI 的 Moderation API 预防性过滤用户输入、复审模型生成内容；这些审核技术的落地，对维护应用完整性、保障用户体验至关重要。

随着应用演进，建议通过自定义审核持续打磨策略——可以按用例定制审核标准，也可以把机器学习模型与规则系统组合起来做更细粒度的分析。在"表达自由"与"内容安全"之间取得平衡，是构建包容、健康空间的关键。持续监控并调整审核策略，跟上内容标准与用户预期的演化，LLM 应用才能长期成功、保持相关性。

---

> **来源**：本文翻译自 [How to use the moderation API](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_use_moderation.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI。抓取于 2026-09-13。

---

> **编译说明**：代码与类别清单为原文全量保留；三个样例的原始输出以文字概述嵌入正文（原文为独立输出单元格）。`omni-moderation-latest` 为现行多模态审核模型；在 Responses API 工作流中，本篇的输入/输出审核可作为独立的前后置步骤，与前述的错误重试策略并行设计。
