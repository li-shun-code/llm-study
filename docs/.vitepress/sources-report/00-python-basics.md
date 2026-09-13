# 模块 0 · Python 基础 — 来源抓取报告

抓取日期：2026-09-13。目标 22 篇，实际完成 22 篇，无最终失败项。

## 来源结构

| 来源域名 | 使用篇数 | 许可 |
| --- | --- | --- |
| liaoxuefeng.com（廖雪峰 Python 教程） | 11（01/02/03/04/09/10/12/13/14/17/18，另 19 的主来源） | © 廖雪峰（转载署名） |
| runoob.com（菜鸟教程 Python3） | 5（05/06/07/08/11） | © 菜鸟教程（转载署名） |
| docs.python.org/zh-cn/3（Python 官方中文文档，3.14） | 4（15/16/20/22） | PSF 许可证第 2 版 |
| github.com/theskumar/python-dotenv（raw README） | 1（21，英文已翻译） | MIT |

## 抓取失败与替代记录

| 主题 | 原候选 URL | 失败原因 | 最终采用文章 |
| --- | --- | --- | --- |
| （无抓取失败项。以下为执行时的选源决策记录） | | | |
| 多篇基础主题（05/06/07/08/11） | jackfrued/Python-100-Days（GitHub raw 批量） | 仓库 license 为 null（无开源许可），转载存在版权风险，主动放弃 | 改用菜鸟教程 runoob.com 对应页面（05-08、11），内容完整可抓 |
| 多篇基础主题（02-04、09/10/13/14/17/18） | datawhalechina/learn-python-the-smart-way | 仓库为 ipynb 格式且许可为 CC BY-NC-SA（禁商用），且未按文章组织 | 改用廖雪峰教程对应章节，质量与结构更佳 |
| 可变/不可变与深浅拷贝（15） | 曾考虑 CSDN/知乎专栏中文文章 | 抓取稳定性差且转载许可不明 | 采用 Python 官方中文文档 copy 模块页 + 官方 FAQ 节选（同站双源，文内分别署名） |
| JSON 与时间日期（19） | 无单页同时覆盖 JSON 与 datetime 的来源 | 知识点为合并主题 | 采用廖雪峰《序列化》为主 + 同书《datetime》章节省选（文内分别署名） |

## 时效性处理记录

- 全部内容为 Python 3.x 现代写法，无 Python 2 遗风。
- 01 篇：原文"目前 Python 有 2.x 与 3.x 两个版本"的表述按 Python 2 已于 2020 年停止维护的事实做了最小改写。
- 19 篇：原文使用已弃用的 `datetime.utcnow()`/`utcfromtimestamp()`，保留原文并加"编者注"给出 3.12+ 推荐写法（`datetime.now(timezone.utc)`）。
- 20 篇：文末加"编者注"提示 uv 等现代工具作为 pip/venv 工作流的补充。
- 03 篇：f-string 注明为当前推荐的字符串格式化方式。

## 2026-09-13 补缺追加（22 → 25 篇 + 2 处并入 + 04/05 顺序对调）

| 序号 | 主题 | 来源 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| 09（新增） | collections 标准库容器 | [docs.python.org/zh-cn/3/library/collections.html](https://docs.python.org/zh-cn/3/library/collections.html) | PSF 许可证第 2 版 | 官方中文文档整页转载（ChainMap/Counter/deque/defaultdict/namedtuple/OrderedDict/UserDict/UserList/UserString 全部章节），仅删除版本注记与导航样板、绝对化链接、代码块转为围栏；`translated: false`（原文即中文） |
| 19（新增） | 调试入门（pdb 与断点） | [docs.python.org/zh-cn/3/library/pdb.html](https://docs.python.org/zh-cn/3/library/pdb.html) + [functions.html#breakpoint](https://docs.python.org/zh-cn/3/library/functions.html#breakpoint) | PSF 许可证第 2 版 | pdb 页面全文转载（模块介绍/命令行接口/Pdb 类/调试器命令全部条目），原文两段英文导语由本站完整翻译为中文；文末补充官方 `breakpoint()` 内置函数一节（文内分别署名） |
| 21（新增） | pathlib 现代路径处理 | [docs.python.org/zh-cn/3/library/pathlib.html](https://docs.python.org/zh-cn/3/library/pathlib.html) | PSF 许可证第 2 版 | 官方中文文档整页转载（基础使用/异常/纯路径/具体路径/模式语言/与 glob 和 os.path 比较/相关工具映射表全部章节），继承关系图指向官方图片绝对地址 |
| 05（并入） | 列表推导式 · 追加「字典与集合推导式」 | [docs.python.org/zh-cn/3/tutorial/datastructures.html](https://docs.python.org/zh-cn/3/tutorial/datastructures.html) 5.4 集合与 5.5 字典两节 | PSF 许可证第 2 版 | 官方教程对应两节全文节选，插入在原文小结之后、文末署名块之前，以「补充」引用块注明来源 |
| 12（并入） | 函数 · 追加「任意实参列表与解包（*args / **kwargs）」 | [docs.python.org/zh-cn/3/tutorial/controlflow.html#arbitrary-argument-lists](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#arbitrary-argument-lists) 4.9.4 与 4.9.5 两节 | PSF 许可证第 2 版 | 官方教程两节全文节选（含 write_multiple_items、concat、range(*args)、parrot(**d) 全部示例），插入在「强制位置参数」之后，以「补充」引用块注明来源 |
| 04 ↔ 05（对调） | 先「列表」后「列表推导式」 | — | — | 应编排要求对调：文件改名 04-list.md / 05-list-comprehension.md，frontmatter order 同步，index.md 与 manifest 已同步；两篇正文内容未改动（05 篇仅追加上述补充节） |

格式转换说明（对本次 3 篇官方文档新文与 2 处并入统一适用）：Sphinx 导航/页脚/目录样板删除；`Added in version x.y`/`在 x.y 版本发生变更` 等版本注记删除（按任务约定）；`[¶](#anchor)` 标题锚点删除；站内相对链接改写为 docs.python.org/zh-cn/3 绝对地址（仅保留链接文本或指向原文对应页）；doctest/REPL 代码以 ```plain 围栏、可执行片段以 ```python 围栏呈现；头部位（head）不放置任何署名内容，署名块统一位于文末。
