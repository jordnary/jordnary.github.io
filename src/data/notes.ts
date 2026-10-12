export const noteTopics = ['全部主题', '数据库', '机器学习', 'LLM', '前端工程化', '学习方法'] as const
export const noteProgresses = ['全部进度', '已实践', '正在整理'] as const
export const noteDifficulties = ['全部难度', '入门', '进阶'] as const

export type NoteTopic = Exclude<(typeof noteTopics)[number], '全部主题'>
export type NoteProgress = Exclude<(typeof noteProgresses)[number], '全部进度'>
export type NoteDifficulty = Exclude<(typeof noteDifficulties)[number], '全部难度'>

export type LearningNote = {
  difficulty: NoteDifficulty
  keyPoints: string[]
  example: {
    title: string
    code?: string
    language?: string
    explanation: string
  }
  id: string
  pitfalls: string[]
  practice: string
  progress: NoteProgress
  question: string
  reference: {
    href: string
    label: string
  }
  summary: string
  review: { question: string; answer: string }
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
    keyPoints: ['实体描述独立存在的对象，关联表描述多对多关系；不要把标签拼成一个逗号分隔字段。', '主键、外键、NOT NULL 与 UNIQUE 各自回答身份、关联、必填和去重问题。', '第三范式关注非键属性对键的依赖；有意识的冗余需要同时设计一致性维护方式。'],
    example: {
      title: '让一篇笔记可以关联多个标签', language: 'SQL',
      code: `CREATE TABLE note_tags (\n  note_id bigint REFERENCES notes(id),\n  tag_id bigint REFERENCES tags(id),\n  PRIMARY KEY (note_id, tag_id)\n);`,
      explanation: '假设 notes 与 tags 已有主键 id。复合主键同时保证两个字段非空，并阻止同一篇笔记重复关联同一个标签。删除策略应按业务选择 CASCADE、RESTRICT 或默认行为。',
    },
    pitfalls: ['只在前端判断重复，无法阻止并发请求写入重复关系。', '用主题名称直接做关联键，会让重命名影响多处记录。'],
    review: { question: '为什么 note_tags 不需要再存一份标签名称？', answer: '名称已经由 tags 维护。重复保存会使标签改名变成多处更新，产生不一致；需要名称时通过 JOIN 读取即可。' },
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
    keyPoints: ['先明确预测目标、样本单位与部署场景，再选择随机、分组或时间切分。', '类别不平衡时同时检查 precision、recall、F1、混淆矩阵，以及简单基线。', '交叉验证用于比较方案；最终测试集应在方案确定后再使用。'],
    example: {
      title: '99% 准确率可能只是预测了多数类',
      explanation: '若 1,000 个样本里只有 10 个正例，始终预测负类也能得到 99% 准确率，但正类召回率为 0。此时应根据漏报与误报成本评估阈值，并查看 precision-recall 曲线。',
    },
    pitfalls: ['反复根据测试集分数改模型，相当于把测试集用于验证。', '比较两个模型时改变数据切分或预处理，无法确认提升来自哪里。'],
    review: { question: '验证分数更高就一定更适合上线吗？', answer: '还要检查误差类型、推理成本和部署分布。离线平均分数无法覆盖每类样本的表现，也无法证明上线后数据没有变化。' },
    reference: {
      label: 'scikit-learn · Model evaluation',
      href: 'https://scikit-learn.org/stable/modules/model_evaluation.html',
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
    keyPoints: ['用目标、材料、约束与验收标准描述任务，明确哪些内容来自原文。', '示例能说明格式与边界，但要避免示例中的事实被误当作当前问题的证据。', '对资料不足的问题，允许回答“无法从现有材料判断”，再列出缺失证据。'],
    example: {
      title: '把“帮我总结”变成可以检查的任务', language: 'TEXT',
      code: `目标：整理材料中的三个核心概念。\n材料：<source>课程原文</source>\n约束：只依据材料；缺少证据时明确标注。\n输出：概念 / 一句话解释 / 对应原文摘录。\n验收：逐条核对摘录是否支持解释。`,
      explanation: '明确分隔材料有助于表达边界，但不构成安全保证。材料内出现的指令仍应被当作待分析内容，不能取代用户任务或工具权限。',
    },
    pitfalls: ['把模型流畅的语气当作正确性的证据。', '一次同时更改任务、示例和材料，难以定位输出变化的原因。'],
    review: { question: '为什么要求附上原文摘录比只要求“准确”更有用？', answer: '摘录提供了可以人工核对的证据链。“准确”只是目标，不能证明事实正确；引用同样需要检查，不能自动信任。' },
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
    keyPoints: ['数据层保存事实，页面层组织顺序，组件层处理稳定的展示与交互。', '通过明确的类型约束必填字段，让缺失内容尽早暴露。', '筛选结果可以由数据与条件计算，不必额外保存一份同步状态。'],
    example: {
      title: '用类型检查内容的完整性', language: 'TypeScript',
      code: `type Note = {\n  id: string\n  title: string\n  topic: '数据库' | '机器学习'\n}\n\nconst notes = [\n  { id: 'sql', title: '理解索引', topic: '数据库' },\n] satisfies Note[]`,
      explanation: 'satisfies 检查对象是否符合约定，同时保留对象自身的类型推断。运行时从网络取得的数据仍需校验，TypeScript 不会自动验证外部输入。',
    },
    pitfalls: ['为了复用提前设计过度通用的组件，让简单内容更新更困难。', '用数组下标作为可筛选列表的 key，可能导致状态跟错条目。'],
    review: { question: '标题变化时，笔记的 id 需要跟着变吗？', answer: '通常不需要。稳定 id 表达内容身份，标题表达可修改的文字；这也便于保留关联、搜索入口与组件状态。' },
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
    keyPoints: ['先记录一个具体困惑，让笔记有明确的解释对象。', '用自己的话复述，并补上成立条件与反例。', '通过一个小练习检查理解，再记录错误与下一次复习的问题。'],
    example: {
      title: '一条可以继续生长的笔记',
      explanation: '问题：为什么索引没有被使用？理解：规划器比较的是预计成本。验证：对比低选择性和高选择性的查询计划。修订：记录统计信息与数据规模，避免得出“索引无效”的泛化结论。',
    },
    pitfalls: ['复制大量原文却没有自己的问题和推理。', '把“阅读完成”当作“能够独立解释与应用”。'],
    review: { question: '怎样判断一页笔记有用，而不只是写得很多？', answer: '隔一段时间后，能否不看原文解释核心概念、指出适用边界，并完成一个小任务。笔记应帮助检索与验证，而不只统计字数。' },
    reference: {
      label: 'The Learning Scientists · Six Strategies for Effective Learning',
      href: 'https://www.learningscientists.org/downloadable-materials',
    },
  },
  {
    id: 'sql-indexes', title: '索引不是越多越好：从一条查询看懂执行计划',
    topic: '数据库', progress: '正在整理', difficulty: '进阶',
    summary: '从过滤、排序和数据分布出发，判断一条索引是否真的值得。',
    question: '给字段加了索引，查询却没有明显变快，应该从哪里开始排查？',
    understanding: 'B-tree 索引提供有序的查找路径，但数据库不会承诺每条查询都使用索引。规划器会根据统计信息估计扫描、回表和排序的成本。匹配行过多、表很小或统计信息过时，都可能让顺序扫描更合理。复合索引需要围绕常用过滤与排序设计，而不是孤立地为每个字段建一条索引。',
    practice: '练习：准备 notes(topic_id, created_at) 数据，对比创建索引前后的 EXPLAIN (ANALYZE, BUFFERS)。记录行数估计、实际返回行数、排序方式与缓冲区访问，并用不同主题的数据占比重复检查。',
    keyPoints: ['索引收益取决于选择性、表规模和访问模式，也会增加写入与存储成本。', '复合 B-tree 索引通常在约束前导列时更有效，不能把所有列组合都当作等价。', 'ANALYZE 收集统计信息；EXPLAIN ANALYZE 则实际执行语句。'],
    example: {
      title: '按主题取最新的 20 篇笔记', language: 'SQL',
      code: `CREATE INDEX notes_topic_created_idx\nON notes (topic_id, created_at DESC);\n\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT id, title, created_at\nFROM notes\nWHERE topic_id = 3\nORDER BY created_at DESC\nLIMIT 20;`,
      explanation: '这是针对等值过滤加时间排序的候选索引。是否采用以及是否更快，要根据真实数据和执行计划判断；SELECT title 也不意味着必然可以仅扫描索引。',
    },
    pitfalls: ['只看总耗时的一次测量，忽略缓存、数据分布与噪声。', '对 UPDATE 或 DELETE 随意执行 EXPLAIN ANALYZE；它会真正修改数据。'],
    review: { question: '为什么 SELECT 返回表里大多数行时可能不用索引？', answer: '大量随机访问和回表可能比顺序读取整张表更贵。选择顺序扫描可以是合理的成本决策，而非索引失效。' },
    reference: { label: 'PostgreSQL · Using EXPLAIN', href: 'https://www.postgresql.org/docs/current/using-explain.html' },
  },
  {
    id: 'transactions-isolation', title: '两个人同时修改数据：事务到底保护了什么？',
    topic: '数据库', progress: '正在整理', difficulty: '进阶',
    summary: '把原子性、隔离级别与并发冲突放回具体的业务操作中理解。',
    question: '两个请求都读到库存为 1，再分别扣减，为什么只加 BEGIN 与 COMMIT 还不够？',
    understanding: '事务把多个操作组织为一个提交或回滚的单位；隔离级别规定并发事务能够观察到什么。PostgreSQL 默认的 Read Committed 为每条语句获取新的快照，不自动保证应用层“先读再算再写”的逻辑安全。防止超卖可以采用带条件的原子更新，再根据受影响行数判断成功；复杂不变量还可能需要行锁或 Serializable，并处理重试。',
    practice: '练习：在两个数据库会话中交错执行库存读取与更新。分别比较普通读写、带条件更新和 SELECT FOR UPDATE，记录等待、受影响行数以及最终库存。',
    keyPoints: ['原子性处理整组操作的提交边界，隔离性处理并发观察与冲突，两者不是同一个问题。', '用数据库条件与约束表达业务不变量，比仅在请求里先检查更可靠。', '更高隔离级别可能产生需要重试的错误，重试要覆盖整个事务并保持幂等。'],
    example: {
      title: '把检查和扣减放在一条语句里', language: 'SQL',
      code: `UPDATE inventory\nSET stock = stock - 1\nWHERE product_id = 42 AND stock > 0\nRETURNING stock;`,
      explanation: '返回一行表示本次扣减成功，零行表示商品不存在或库存不足。在 PostgreSQL Read Committed 下，并发更新等待后会重新检查条件；创建订单等关联操作仍需放进同一事务。',
    },
    pitfalls: ['以为开启事务就能消除所有并发问题。', '持锁期间调用耗时网络服务，放大等待与死锁风险。'],
    review: { question: '库存更新成功后，订单写入失败该怎样处理？', answer: '把两步放进同一事务，让订单失败时回滚库存扣减；外部支付等跨系统行为还需要独立设计幂等与补偿。' },
    reference: { label: 'PostgreSQL · Transaction Isolation', href: 'https://www.postgresql.org/docs/current/transaction-iso.html' },
  },
  {
    id: 'data-leakage', title: '数据泄漏：模型怎么提前看到了答案？',
    topic: '机器学习', progress: '正在整理', difficulty: '进阶',
    summary: '从预处理与数据切分开始，建立一条可信的评估流水线。',
    question: '先对整个数据集标准化，再做交叉验证，为什么会让结果偏乐观？',
    understanding: '只要训练流程使用了评估阶段原本不可见的信息，就可能发生数据泄漏。标准化的均值、缺失值填补规则和特征选择也属于从数据学习的步骤，必须只在当前训练折拟合。Pipeline 将这些步骤与模型绑定，使交叉验证在每一折内重新拟合。时间序列、同一用户的重复记录或目标相关字段，还需要从样本关系与业务可见性检查泄漏。',
    practice: '练习：对比“全量标准化后交叉验证”与“Pipeline 内标准化”两种流程。再构造同一用户的重复样本，比较随机切分与 GroupKFold；不要预设分差，先记录结果和原因。',
    keyPoints: ['先划分数据，再在训练数据上拟合预处理参数。', 'Pipeline 保护变换步骤的拟合边界，但不能自动修复错误的特征或样本切分。', '每个字段都要问：真正预测的那一刻，能否拿到它？'],
    example: {
      title: '让标准化在每个训练折内发生', language: 'Python',
      code: `from sklearn.pipeline import make_pipeline\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import cross_val_score\n\nmodel = make_pipeline(\n    StandardScaler(), LogisticRegression(max_iter=1000)\n)\nscores = cross_val_score(model, X, y, cv=5)`,
      explanation: 'X 与 y 表示已准备好的特征和标签。该示例适合普通独立样本；存在用户分组或时间顺序时，应显式传入适合场景的切分器。',
    },
    pitfalls: ['在切分前用标签筛选特征，然后声称测试数据未参与训练。', '把同一对象的近重复样本分到训练集和测试集。'],
    review: { question: '用了 Pipeline 就一定没有数据泄漏了吗？', answer: '不能保证。预测未来才知道的字段、错误的时间切分与跨集合重复样本，都需要单独检查。Pipeline 只管理放进其中的变换与模型。' },
    reference: { label: 'scikit-learn · Common pitfalls', href: 'https://scikit-learn.org/stable/common_pitfalls.html' },
  },
  {
    id: 'gradient-descent', title: '损失下降的那一步：梯度与学习率在做什么？',
    topic: '机器学习', progress: '正在整理', difficulty: '入门',
    summary: '先手算一个参数更新，再理解训练曲线里的震荡与停滞。',
    question: '为什么沿负梯度方向更新参数，学习率却大到一定程度就会让训练发散？',
    understanding: '梯度描述当前位置上损失随参数变化的局部趋势。梯度下降沿负梯度做一步近似更新，学习率决定这一步的长度。局部下降方向不保证任意步长都降低损失；步子太大可能越过低点，太小则推进缓慢。神经网络的曲线还受初始化、批次噪声、归一化与优化器状态影响，不能把每次震荡都归因于同一个原因。',
    practice: '练习：先用 L(w) = (w - 3)² 手算三步更新，再比较学习率 0.1、0.9 与 1.1 的轨迹。随后检查真实训练中是否在每轮反向传播前清空旧梯度。',
    keyPoints: ['基本更新式是 w ← w - η∇L(w)，η 是学习率。', 'loss.backward() 计算梯度；optimizer.step() 使用梯度更新参数。', '小批次训练会产生噪声，关注总体趋势与独立验证曲线。'],
    example: {
      title: '从 w = 0 走向最小点 w = 3', language: 'Python',
      code: `w = 0.0\nlearning_rate = 0.1\nfor _ in range(3):\n    gradient = 2 * (w - 3)\n    w -= learning_rate * gradient\n    print(round(w, 3))\n# 0.6, 1.08, 1.464`,
      explanation: '对这个特定二次函数，误差每步乘以 1 - 2η，0 < η < 1 时收敛；这个范围不能直接推广到任意模型。',
    },
    pitfalls: ['忘记清空梯度，导致本次更新混入前几个批次的梯度。', '训练损失下降就停止看验证损失，忽略过拟合。'],
    review: { question: '这个例子里 η = 1 时会怎样？', answer: '参数在 0 与 6 之间振荡，误差符号交替而幅度不变。负梯度方向正确，但步长没有带来收敛。' },
    reference: { label: 'PyTorch · Optimizing Model Parameters', href: 'https://pytorch.org/tutorials/beginner/basics/optimization_tutorial.html' },
  },
  {
    id: 'rag-grounding', title: '让回答有出处：RAG 的检索与生成如何分工？',
    topic: 'LLM', progress: '正在整理', difficulty: '进阶',
    summary: '从切块、召回到引用验证，把“找到资料”和“答对问题”分别检查。',
    question: '知识库里已经有答案，为什么接入检索的模型仍然可能答错？',
    understanding: 'RAG 在生成前检索相关材料，并把材料作为上下文交给模型。失败可能出在不同阶段：文档切块丢失上下文、嵌入无法匹配问题、召回缺少关键证据，或生成时忽略材料。增加检索数量并不总能改善回答；无关文本会挤占上下文。应分别评估检索覆盖、答案是否受证据支持，以及模型是否能在材料不足时承认缺口。',
    practice: '练习：为十个课程问题手工标出支持答案的文档段落。记录 top-k 检索结果是否包含证据，再核对回答里的每条事实与引用，分别统计检索失败和生成失败。',
    keyPoints: ['切块保留标题、段落关系、来源标识和版本信息。', '向量相似度衡量相关性，不等于事实可靠性。', '引用必须能定位到原文，还应检查原文是否真的支持答案。'],
    example: {
      title: '一条可追踪的回答流水线', language: 'TEXT',
      code: `问题 → 检索候选 → 选择证据 → 组织上下文 → 生成\n\n证据：[doc-03 / §2] 默认隔离级别是 Read Committed。\n回答：默认采用 Read Committed。[doc-03 / §2]\n检查：来源存在？原文支持结论？版本一致？`,
      explanation: '来源标识让核对有明确目标。这个流程仍需处理文档权限、时效和检索内容中的恶意指令，不能把检索到的文字当作系统指令。',
    },
    pitfalls: ['只看回答是否通顺，没有单独测量证据是否被召回。', '引用标题存在，就认定引用内容支持答案。'],
    review: { question: '证据已经召回，但回答仍然错误，应该先查哪里？', answer: '检查证据在上下文中的位置、提示约束与生成内容。此时单纯换嵌入模型可能无法解决问题，要区分检索质量与证据使用能力。' },
    reference: { label: 'Hugging Face · Retrieval Augmented Generation', href: 'https://huggingface.co/docs/transformers/model_doc/rag' },
  },
  {
    id: 'attention-tokenization', title: '从 token 到 attention：文字如何进入模型？',
    topic: 'LLM', progress: '正在整理', difficulty: '入门',
    summary: '理解分词、向量与注意力的边界，少把模型行为想成逐字阅读。',
    question: '同样长度的中英文文字，为什么可能消耗不同数量的 token？attention 又在关联什么？',
    understanding: 'Tokenizer 按自己的词表与规则把文本映射为 token ID；一个 token 不一定是一个字或一个词。模型把 ID 映射为嵌入向量，再通过多层运算建立上下文关系。缩放点积注意力可以写成 softmax(QKᵀ/√dₖ)V。decoder-only 自回归模型通常使用因果掩码，当前位置不能看到未来 token。注意力权重反映某层某头的计算关系，不能直接视为完整的因果解释。',
    practice: '练习：用同一个 tokenizer 编码中文句子、英文句子、代码和包含空格的数字。比较 token ID 与解码结果，再在短序列上画出因果掩码，检查哪些位置可以互相访问。',
    keyPoints: ['token 数由模型对应的 tokenizer 决定，不能用字符数固定换算。', 'Q、K、V 是可学习投影形成的向量，注意力输出是对 V 的加权组合。', '标准稠密注意力的分数矩阵大小随序列长度平方增长，实际内存还依赖具体实现。'],
    example: {
      title: '看清四个位置的因果可见性', language: 'TEXT',
      code: `      key 1  2  3  4\nquery 1  ✓  ×  ×  ×\n      2  ✓  ✓  ×  ×\n      3  ✓  ✓  ✓  ×\n      4  ✓  ✓  ✓  ✓`,
      explanation: '这是因果自注意力的可见性示意，不是注意力权重。编码器或其他注意力结构可能采用不同掩码。',
    },
    pitfalls: ['换了模型却继续用旧 tokenizer 估计上下文预算。', '认为 attention 数值大，就能证明该位置是输出的唯一原因。'],
    review: { question: '序列从 1,000 增长到 2,000，标准注意力分数矩阵扩大多少？', answer: '元素数量从 1,000² 变成 2,000²，即四倍。计算与显存的实际增长还取决于批量大小、头数和高效注意力实现。' },
    reference: { label: 'Hugging Face · Tokenizers', href: 'https://huggingface.co/learn/llm-course/chapter2/4' },
  },
  {
    id: 'react-state-effects', title: '哪些值值得成为 state，哪些事情才需要 Effect？',
    topic: '前端工程化', progress: '正在整理', difficulty: '进阶',
    summary: '从筛选列表出发，避免重复状态与难以追踪的同步链。',
    question: '筛选条件和筛选结果都存在 state 里，为什么容易出现更新顺序问题？',
    understanding: 'React state 保存随交互改变且无法直接推导的最小信息。能由现有数据和状态计算出的值，通常在渲染中派生即可。Effect 用于与外部系统同步，例如事件监听、浏览器 API 或网络连接，不应默认用来把一个 state 复制到另一个 state。依赖项与清理函数一起定义同步的生命周期。',
    practice: '练习：把一份通过 Effect 更新 filteredNotes 的实现改为渲染时过滤。再为窗口事件监听补上成对清理，检查开发模式的重复设置与清理是否会留下多个监听器。',
    keyPoints: ['一次交互发生的动作放在事件处理函数中；外部同步才考虑 Effect。', '派生数据优先直接计算，确有昂贵计算时再评估 useMemo。', '异步请求要考虑过期响应和卸载后的清理，不能只考虑正常完成路径。'],
    example: {
      title: '只保存用户选择的主题', language: 'TSX',
      code: `const [topic, setTopic] = useState('全部主题')\nconst visibleNotes = notes.filter(note =>\n  topic === '全部主题' || note.topic === topic\n)`,
      explanation: 'visibleNotes 与当前渲染使用的是同一份 topic，无需再创建 Effect 和第二个 state 来保持一致。',
    },
    pitfalls: ['为了消除依赖警告而省略依赖，导致读取旧值。', '把所有计算都放进 useMemo，却没有测量计算成本。'],
    review: { question: '根据两个输入框算出全名，需要 Effect 吗？', answer: '通常不需要。在渲染时由 firstName 与 lastName 直接组合即可；只有与外部系统同步时才需要额外 Effect。' },
    reference: { label: 'React · You Might Not Need an Effect', href: 'https://react.dev/learn/you-might-not-need-an-effect' },
  },
  {
    id: 'web-performance', title: '图片很好看，页面也要轻：从加载到动效的性能预算',
    topic: '前端工程化', progress: '正在整理', difficulty: '入门',
    summary: '把图片体积、布局稳定性和动效成本一起放进页面设计。',
    question: '为什么大图、懒加载和动画各自看起来合理，组合后却可能让首屏变慢？',
    understanding: '浏览器要下载资源、解码图片、计算布局并绘制页面。首屏关键图片若使用 lazy loading，可能延迟最大内容绘制；首屏外图片则可以按需加载。显式设置尺寸或 aspect-ratio 有助于减少布局偏移。transform 与 opacity 通常比频繁修改布局属性更适合动画，但过多合成层也有内存成本。性能优化应先测量具体瓶颈，而不是只勾选最佳实践。',
    practice: '练习：用浏览器性能面板比较原图与 WebP、即时加载与懒加载。观察网络请求和布局偏移，再模拟慢网络及减少动态效果偏好，检查内容是否仍然可读可操作。',
    keyPoints: ['根据实际展示尺寸准备图片，必要时提供 srcset 与 sizes。', '首屏关键图片与首屏外图片采用不同加载优先级。', '尊重 prefers-reduced-motion，并避免同时播放大量不可见动画。'],
    example: {
      title: '为首屏外的封面预留尺寸', language: 'HTML',
      code: `<img\n  src="/images/learning/coding.webp"\n  width="960" height="1280"\n  loading="lazy" decoding="async"\n  alt="显示代码的笔记本电脑"\n/>`,
      explanation: '示例图片用于首屏外区域。实际首屏的主视觉应评估 eager 与 fetchpriority，而不是照搬 lazy；绝对定位的背景图也需由容器提供稳定尺寸。',
    },
    pitfalls: ['把所有图片都设为高优先级，造成关键资源之间竞争。', '为每个元素长期添加 will-change，产生多余的合成层。'],
    review: { question: '为什么设置图片 width 与 height 不等于固定显示尺寸？', answer: '它们提供固有尺寸与比例，CSS 仍可用 width: 100% 等规则响应式显示。比例信息帮助浏览器在下载完成前安排空间。' },
    reference: { label: 'web.dev · Optimize images', href: 'https://web.dev/learn/performance/image-performance' },
  },
  {
    id: 'active-recall', title: '合上笔记以后：用主动回忆检验理解',
    topic: '学习方法', progress: '正在整理', difficulty: '入门',
    summary: '用短问题与及时反馈，把熟悉感变成能独立说出的知识。',
    question: '读笔记时觉得每句话都懂，为什么遇到新题却想不起来？',
    understanding: '重复阅读容易带来熟悉感，但主动回忆要求在缺少提示时重新提取知识。可以合上材料回答问题、画出概念关系或解释一个反例，再对照资料纠正遗漏。间隔复习把提取练习分散在不同时间；间隔应根据掌握程度和任务调整，没有对所有知识都通用的固定日程。',
    practice: '练习：读完每篇笔记先回答文末自测，再展开参考答案。隔几天重新回答，把错误分为概念混淆、条件遗漏和无法应用，并据此安排下一次练习。',
    keyPoints: ['先尝试提取，再看答案，避免答案本身成为过强提示。', '问题覆盖“是什么、为什么、什么时候不成立”，而不只背定义。', '反馈应纠正错误；只反复练错的答案不会自动形成正确理解。'],
    example: {
      title: '把一句定义变成三个自测问题',
      explanation: '围绕数据库索引提问：它加速了哪类访问？为什么大比例扫描可能不用它？给定一个按主题排序的查询，你会如何验证索引方案？三个问题分别检查概念、边界和应用。',
    },
    pitfalls: ['先看答案再判断“这题我会”，没有实际进行回忆。', '卡片只有零散名词，缺少条件与关联，无法迁移到真实任务。'],
    review: { question: '答错自测题是否说明这次学习没有价值？', answer: '错误暴露了理解缺口。先努力回忆，再获得正确反馈并在之后重试，可以让练习变成诊断与修正的过程。' },
    reference: { label: 'The Learning Scientists · Retrieval Practice', href: 'https://www.learningscientists.org/blog/2016/6/23-1' },
  },
  {
    id: 'experiment-notebook', title: '让一次实验可以重来：记录假设、变量与失败',
    topic: '学习方法', progress: '正在整理', difficulty: '进阶',
    summary: '让实验记录解释结果从哪里来，也说明结果不能证明什么。',
    question: '隔一个月想复现一次实验，却不知道当时改了什么，怎样改善记录方式？',
    understanding: '一份可复现记录应包括问题、假设、数据版本、配置、代码版本、评价方法和原始观察。尽量一次只改变一个主要因素，并区分测量结果与解释。随机种子有助于追踪，但不保证跨设备和跨版本得到完全相同结果。失败记录同样有价值：它说明当前证据不支持哪些假设，也避免以后重复无效尝试。',
    practice: '练习：为一个小模型或页面优化建立实验卡片。先写验收指标，再记录基线与唯一主要改动；结束时填写结果、局限和下一步验证，不用事后选择的指标替代原先标准。',
    keyPoints: ['先明确假设与评价方式，避免得到结果后再挑有利指标。', '保留足够的配置与版本信息，并对可能的隐私数据做脱敏。', '重复测量区分稳定改善与随机波动，比较时保持其他条件一致。'],
    example: {
      title: '一张最小实验卡片', language: 'TEXT',
      code: `问题：减小封面体积是否改善加载？\n基线：相同页面、尺寸、网络条件。\n改动：仅替换为同尺寸 WebP。\n记录：图片字节数、LCP、重复测量范围。\n结论：观察到什么；还不能证明什么。\n下一步：检查慢网络和手机端。`,
      explanation: '保留真实测量数据后才能填写改善程度。模板只定义比较方法，不提前宣称 WebP 在每种内容和环境下都更好。',
    },
    pitfalls: ['同时修改模型、数据与指标，却把变化归因于其中一个因素。', '只保留最佳一次结果，删除不理想的运行记录。'],
    review: { question: '设置了随机种子，为什么仍可能无法完全复现？', answer: '底层算子、硬件、并行调度和依赖版本可能带来非确定性。应记录这些条件，并区分数值完全一致与结论在容许波动内一致。' },
    reference: { label: 'PyTorch · Reproducibility', href: 'https://pytorch.org/docs/stable/notes/randomness.html' },
  },
]
