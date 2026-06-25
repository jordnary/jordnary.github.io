export const noteTopics = ['全部主题', '数据库', '机器学习', 'LLM', '前端工程化', '学习方法'] as const
export const noteProgresses = ['全部进度', '已实践', '正在整理'] as const
export const noteDifficulties = ['全部难度', '入门', '进阶'] as const

export type NoteTopic = Exclude<(typeof noteTopics)[number], '全部主题'>
export type NoteProgress = Exclude<(typeof noteProgresses)[number], '全部进度'>
export type NoteDifficulty = Exclude<(typeof noteDifficulties)[number], '全部难度'>

export type LearningNote = {
  difficulty: NoteDifficulty
  id: string
  practice: string
  progress: NoteProgress
  question: string
  reference: {
    href: string
    label: string
  }
  summary: string
  title: string
  topic: NoteTopic
  understanding: string
}

export const learningNotes: LearningNote[] = [
  {
    id: 'relational-modeling',
    title: '从业务规则到关系模型：表要怎样才算设计清楚？',
    topic: '数据库',
    progress: '已实践',
    difficulty: '入门',
    summary: '把“多建几张表”换成对实体、约束与查询语义的明确表达。',
    question:
      '一个学习笔记系统里，笔记、主题与标签应如何建模，才能既避免重复数据，又能支持“按主题找笔记”和“一篇笔记有多个标签”？',
    understanding:
      '先区分稳定实体和它们之间的关系：笔记与主题通常是一对多，笔记与标签则是多对多。主键保证每条记录可识别，外键表达关联，唯一约束则把“不能重复”写进数据层。范式不是为了把表拆得越细越好，而是让每个事实只在一个可信的位置维护。',
    practice:
      '我用 notes、topics、tags 和 note_tags 四张表画出简化 ER 图，再分别写出按主题筛选、按标签聚合的查询。这个过程让我发现：先写出要回答的问题，再定字段和关系，比先盯着表格命名更稳。',
    reference: {
      label: 'PostgreSQL · Constraints',
      href: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
  },
  {
    id: 'model-evaluation',
    title: '模型分数变好了，为什么还不能立刻相信它？',
    topic: '机器学习',
    progress: '正在整理',
    difficulty: '入门',
    summary: '把训练结果和泛化能力分开看，是比调参更早的一步。',
    question:
      '当一个分类模型在训练集上准确率很高时，怎样判断它真的学到了规律，而不是记住了样本？',
    understanding:
      '训练集负责让模型学习，验证集帮助比较方案，测试集只用于最后一次相对独立的检查。若在同一份测试数据上反复调参，测试集也会被“看见”。因此，评估不只是一个分数，而是一套控制信息泄漏、比较基线和观察误差模式的过程。',
    practice:
      '我用一个小型分类数据集分别比较训练分数与交叉验证分数，并记录特征处理、随机种子和评价指标。即使没有复杂模型，这份实验记录也能把“为什么这次结果可信”说得更清楚。',
    reference: {
      label: 'scikit-learn · Supervised learning',
      href: 'https://scikit-learn.org/stable/supervised_learning.html',
    },
  },
  {
    id: 'prompt-context',
    title: '提示词不是咒语：如何给 LLM 足够而不过量的上下文？',
    topic: 'LLM',
    progress: '正在整理',
    difficulty: '进阶',
    summary: '将任务、约束、材料和验收标准拆开，才能观察输出为什么变化。',
    question:
      '同一个问题在不同提示下得到相差很大的回答时，应该如何分析是任务描述、上下文材料还是输出约束在起作用？',
    understanding:
      '提示可以被看作一份任务说明：先说明目标，再给必要材料，最后定义输出格式和检查标准。更长的上下文不必然更好；无关材料会增加歧义，也更难发现模型是依据哪一部分作答。对学习场景而言，要求模型标出假设和不确定处，往往比要求“给出完美答案”更有价值。',
    practice:
      '我针对同一段课程材料写了“直接总结”和“先列概念关系、再指出证据来源”两版提示，比较回答的可核对性。下一步会继续记录何时需要检索资料，以及如何避免把模型输出当作未经验证的事实。',
    reference: {
      label: 'Hugging Face · LLM Course',
      href: 'https://huggingface.co/learn/llm-course/chapter1/1',
    },
  },
  {
    id: 'content-driven-frontend',
    title: '页面能跑以后，怎样让内容不被组件代码绑住？',
    topic: '前端工程化',
    progress: '已实践',
    difficulty: '进阶',
    summary: '将内容数据、页面组合与可复用展示组件分开，降低更新成本。',
    question:
      '个人网站会不断增加笔记和项目案例，怎样避免每次改一段文案都要在多个组件里寻找和复制？',
    understanding:
      '页面负责组织阅读顺序，组件负责稳定的展示结构，数据文件负责可变内容。三者分开后，新增一篇笔记不需要改动筛选逻辑的核心结构；类型也能提前约束标题、标签、链接等字段是否完整。工程化并不等于堆工具，而是让重复的维护动作变得可预期。',
    practice:
      '这个网站已经把个人叙事、学习分类、笔记、阶段计划和项目案例拆到对应的数据文件中；学习页基于这些数据提供主题、进度和难度筛选。我把每一次信息架构调整都当作一次组件边界的检验。',
    reference: {
      label: 'React · Thinking in React',
      href: 'https://react.dev/learn/thinking-in-react',
    },
  },
  {
    id: 'learning-loop',
    title: '怎样把“看过了”变成以后还能接着用的知识？',
    topic: '学习方法',
    progress: '已实践',
    difficulty: '入门',
    summary: '用问题驱动的记录方式，为理解留下可检查、可继续的入口。',
    question:
      '面对一章课程或一篇技术文章，怎样避免笔记只剩下原文摘抄，过几周后却不知道自己当时理解了什么？',
    understanding:
      '我更愿意把笔记看成一次和未来自己的交接：先留下原本困惑的问题，再写下当前理解、一个能验证的实践，以及需要回看的参考来源。这样笔记不要求一次写完，而是能在新的经验出现后继续修订。',
    practice:
      '本站的学习笔记统一采用“问题—理解—实践—参考”结构。每次记录至少补一个小练习、一次比较或一个待验证假设，让它不只是一张知识清单。',
    reference: {
      label: 'Vite · Why Vite',
      href: 'https://vite.dev/guide/why.html',
    },
  },
]
