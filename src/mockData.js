export const steps = [
  '输入材料',
  'JD解析',
  '简历诊断',
  '匹配分析',
  '经历追问',
  '简历优化',
  '面试准备',
  '补强建议',
  '简历导出',
];

export const exampleInput = {
  targetRole: 'AI产品经理',
  targetIndustry: 'AI应用 / 企业服务',
  targetCompanyType: 'ToB SaaS公司 / AI创业公司',
  jobStage: '3-5年经验，产品经理转AI产品经理',
  highlightSkills: 'AI产品能力、ToB SaaS业务理解、项目推进、需求分析、数据驱动、客户沟通',
  jd: `岗位职责：\n1. 负责AI产品从需求调研、方案设计到上线迭代的全流程管理；\n2. 深入理解企业客户场景，抽象业务问题并设计AI能力落地方案；\n3. 协同算法、工程、设计、销售与实施团队推进项目交付；\n4. 结合数据分析和用户反馈，持续优化产品体验与业务价值；\n5. 关注大模型、Agent、知识库、RAG等AI技术趋势，推动产品创新。\n\n任职要求：\n1. 3年以上产品经理经验，有ToB SaaS、ERP、WMS、数据产品经验优先；\n2. 具备优秀的需求分析、业务抽象和跨团队推动能力；\n3. 对大模型应用、Prompt、Agent、工作流、知识库等方向有理解；\n4. 能独立输出PRD、原型、流程图，并推进开发上线；\n5. 具备较强的数据分析和客户沟通能力。\n\n加分项：\n1. 有AI应用、Copilot、智能问答、BI分析等项目经验；\n2. 有从0到1或复杂B端流程优化经验。`,
  resume: `张晨\n产品经理｜5年B端产品经验\n\n职业摘要：\n有ERP、WMS、经营分析报表相关产品经验，负责过需求调研、原型设计、项目推进和上线支持，希望转向AI产品方向。\n\n工作经历：\nA科技有限公司  产品经理  2021.03-至今\n- 负责ERP/WMS相关模块的需求收集和产品设计\n- 跟进研发测试进度，推动功能上线\n- 与实施、销售沟通客户需求，支持项目交付\n- 做过经营数据报表相关功能\n\nB软件有限公司  产品专员  2019.07-2021.02\n- 参与企业管理系统需求整理和文档撰写\n- 协助项目经理推进客户需求落地\n\n项目经历：\n1. WMS库存管理项目\n- 参与出入库、库存预警等流程设计\n\n2. 经营分析报表项目\n- 参与报表需求整理和页面设计\n\n技能：\nAxure、Figma、SQL、XMind、Visio、墨刀\n了解：Prompt Engineering、Coze、Dify、RAG、Agent工作流\n\n教育背景：\nXX大学 信息管理与信息系统 本科`,
  extras: `代表项目：ERP/WMS模块、经营分析报表\n工具技能：Axure、Figma、SQL、Prompt Engineering、Coze、Dify、Cursor\n可量化结果：暂未系统整理\n不希望被夸大的地方：不把“参与”写成“主导”；不虚构AI上线结果\n简历长度目标：一页`,
};

const defaultKeywords = ['AI产品', 'ToB SaaS', '需求分析', '业务抽象', '跨团队推进', '大模型应用', 'Prompt', 'Agent', 'RAG', '数据分析', '客户沟通'];
const skillHints = ['Axure', 'Figma', 'SQL', 'XMind', 'Visio', '墨刀', 'Prompt', 'Prompt Engineering', 'Coze', 'Dify', 'RAG', 'Agent', 'Cursor'];
const actionHints = ['负责', '主导', '推进', '设计', '优化', '分析', '协调', '落地', '支持', '梳理', '搭建', '跟进'];
const valueHints = ['效率', '成本', '转化', '上线', '交付', '流程', '报表', '库存', '客户', '数据', '协同', '满意度'];

export function buildMockAnalysis(input, answers = {}) {
  const derived = deriveResumeContent(input, answers);
  const keywordList = buildKeywordList(input);
  const askItems = buildAskItems();

  return {
    summary: {
      name: '简历专家',
      role: input.targetRole || derived.targetRole || 'AI产品经理',
      generatedAt: derived.resumeBased ? '已基于输入简历生成优化结果' : '本地 Mock AI 已生成完整分析结果',
      fitScore: derived.fitScore,
      scoreLabel: derived.scoreLabel,
    },
    jdAnalysis: buildJdAnalysis(input, keywordList, derived),
    diagnosis: buildDiagnosis(input, derived),
    evidenceMap: buildEvidenceMap(input, derived),
    askItems,
    strategy: {
      positioning: derived.positioning,
      emphasize: derived.emphasize,
      downplay: derived.downplay,
      keywords: keywordList,
      heroProjects: derived.heroProjects,
      tone: derived.tone,
    },
    rewriteTable: derived.rewriteTable,
    finalResume: derived.finalResume,
    interviewPrep: buildInterviewPrep(derived, answers),
    enhancement: buildEnhancement(input, derived),
  };
}

function deriveResumeContent(input, answers) {
  const parsedResume = parseResume(input.resume);
  const lines = splitLines(input.resume);
  const allBullets = parsedResume.experience.flatMap((item) => item.bullets);
  const projectBullets = parsedResume.projects.flatMap((item) => item.bullets);
  const sourceBullets = [...allBullets, ...projectBullets];
  const mergedSkills = unique([
    ...parsedResume.skills,
    ...extractSkills(input.highlightSkills),
    ...extractSkills(input.extras),
  ]).slice(0, 12);
  const targetRole = input.targetRole || inferTargetRole(input.jd, input.resume) || 'AI产品经理';
  const fitScore = computeFitScore(input, parsedResume, mergedSkills);
  const roleSummary = [targetRole, input.targetIndustry, input.targetCompanyType].filter(Boolean).join(' / ');
  const optimizedExperience = parsedResume.experience.length
    ? parsedResume.experience.map((item, index) => optimizeExperience(item, index === 0 ? input : { ...input, jd: '' }, answers))
    : fallbackExperience(lines, input, answers);
  const optimizedProjects = parsedResume.projects.length
    ? parsedResume.projects.map((item) => optimizeProject(item, input, answers))
    : fallbackProjects(input, answers, sourceBullets);
  const summary = buildSummary(input, parsedResume, mergedSkills, optimizedExperience, answers);
  // 从原始简历中提取联系信息
  const contactInfo = extractContact(lines);
  const basic = [
    parsedResume.name || contactInfo.name || '候选人',
    contactInfo.phone ? `电话：${contactInfo.phone}` : '',
    contactInfo.email ? `邮箱：${contactInfo.email}` : '',
    contactInfo.location ? `所在地：${contactInfo.location}` : '',
    `目标岗位：${roleSummary || targetRole}`,
    buildHeadline(parsedResume, input),
  ].filter(Boolean);
  const education = parsedResume.education || extractEducation(lines) || '教育背景待补充';
  const heroProjects = optimizedProjects.map((item) => item.name).slice(0, 3);
  const rewriteTable = buildRewriteTable(sourceBullets, optimizedExperience, optimizedProjects);
  const quantifiedCount = countQuantifiedBullets([...optimizedExperience.flatMap((item) => item.bullets), ...optimizedProjects.flatMap((item) => item.bullets)]);
  const aiSignal = hasAiSignal(input, parsedResume, mergedSkills);

  return {
    resumeBased: Boolean(input.resume?.trim()),
    targetRole,
    fitScore,
    scoreLabel: fitScore >= 80 ? '匹配度较高，建议重点补强证据与结果' : fitScore >= 65 ? '中等匹配，可通过重构表达显著提升' : '基础匹配存在缺口，建议先补定位与项目证据',
    positioning: `定位为“${buildPositioning(parsedResume, input, aiSignal)}”。`,
    emphasize: '优先展示与你目标岗位最相关的业务场景、方法论动作、跨团队协作与结果证据。',
    downplay: '弱化空泛职责、重复事务性描述，以及没有证据支撑的夸张表达。',
    heroProjects,
    tone: aiSignal ? '业务型 + 专业型 + AI转型型' : '业务型 + 结果导向型',
    finalResume: {
      basic,
      jobIntention: `${targetRole}｜${input.targetIndustry || '目标行业待填写'}｜${input.targetCompanyType || '公司类型待填写'}`,
      summary,
      skills: mergedSkills.length ? mergedSkills : ['需求分析', '业务流程梳理', '跨团队协作'],
      tools: extractTools(input),
      experience: optimizedExperience,
      projects: optimizedProjects,
      education,
      extras: [],
    },
    rewriteTable,
    quantifiedCount,
    aiSignal,
    parsedResume,
  };
}

function buildAskItems() {
  return [
    {
      id: 'q1',
      title: '项目背景与场景',
      question: '你的核心项目主要服务什么客户或业务场景？典型流程、角色或复杂环节是什么？',
      bullet: '服务于[客户/业务场景]，围绕[核心流程]拆解问题并输出产品方案。',
    },
    {
      id: 'q2',
      title: '个人职责边界',
      question: '你在项目里独立负责哪些环节？例如调研、PRD、原型、评审、推进、验收等。',
      bullet: '独立承担[调研/PRD/原型/推进/验收]等环节，并协同相关团队推动落地。',
    },
    {
      id: 'q3',
      title: '产出成果与数据',
      question: '上线后有无业务结果、效率提升、客户反馈、范围扩大等证据？具体数字是多少？',
      bullet: '项目上线后带来[效率/流程/协同]改善，结果为[待补充量化结果]。',
    },
    {
      id: 'q4',
      title: 'AI探索深度',
      question: '你是否做过 Prompt、知识库、Coze/Dify 工作流、智能问答、自动化流程等实际探索？',
      bullet: '基于[Prompt/Coze/Dify/RAG/Agent]开展AI探索，并沉淀对[业务场景]的理解。',
    },
    {
      id: 'q5',
      title: '协作对象与难点',
      question: '你主要和哪些角色协作（研发/设计/销售/实施）？遇到过什么难点，如何解决的？',
      bullet: '协同[研发/设计/销售/实施]团队，解决[难点]，最终[解决方式与结果]。',
    },
    {
      id: 'q6',
      title: '用户/客户规模',
      question: '你的产品/项目服务多少用户或客户？覆盖哪些行业或场景？',
      bullet: '服务[数量]家客户/[数量]用户，覆盖[行业/场景]。',
    },
  ];
}

function buildJdAnalysis(input, keywordList, derived) {
  const jdLines = splitLines(input.jd);
  const dutyLines = jdLines.filter((line) => /职责|负责|协同|推进|优化|设计/.test(line)).slice(0, 4);
  const requirementLines = jdLines.filter((line) => /要求|具备|优先|能够|能/.test(line)).slice(0, 4);

  return [
    { item: '岗位核心职责', detail: dutyLines.length ? compressText(dutyLines.join('；')) : '围绕目标岗位的核心职责进行需求分析、方案设计、协作推进与结果交付。' },
    { item: '岗位硬性要求', detail: requirementLines.length ? compressText(requirementLines.join('；')) : '需要具备与你目标岗位相关的产品经验、协作推进能力与行业理解。' },
    { item: '岗位隐性要求', detail: derived.aiSignal ? '除了基础产品能力，还需要证明你能把既有业务经验迁移到AI或更复杂的目标场景。' : '招聘方更看重你能否把过往经验转化为与目标岗位贴合的场景能力。' },
    { item: '高频关键词', detail: keywordList.join('、') },
    { item: '招聘方真正想找的人', detail: `${derived.targetRole}方向上，既能理解业务问题，也能把需求转成可执行方案的人。` },
    { item: '最看重的5项能力', detail: pickTopCapabilities(keywordList).join('、') },
  ];
}

function buildDiagnosis(input, derived) {
  const hasSummary = Boolean(derived.finalResume.summary);
  const hasProjects = derived.finalResume.projects.length > 0;
  const roleMatch = derived.aiSignal ? 82 : 72;
  const resultScore = Math.min(90, 40 + derived.quantifiedCount * 12);

  return {
    overall: derived.fitScore,
    dimensions: [
      { name: '岗位匹配度', score: roleMatch },
      { name: '简历结构', score: hasSummary && hasProjects ? 80 : 66 },
      { name: '职业定位', score: derived.targetRole ? 84 : 62 },
      { name: '工作经历表达', score: Math.min(88, 68 + derived.finalResume.experience.length * 4) },
      { name: '项目经历表达', score: hasProjects ? 78 : 58 },
      { name: '成果量化', score: resultScore },
      { name: '关键词覆盖', score: Math.min(88, 58 + buildKeywordList(input).length * 2) },
      { name: '差异化亮点', score: derived.aiSignal ? 76 : 60 },
      { name: '可信度与面试风险', score: derived.aiSignal ? 72 : 82 },
    ],
    issues: buildIssues(derived),
    priorities: buildPriorities(derived),
    deductionReason: derived.quantifiedCount === 0
      ? '扣分主要来自量化结果缺失、职责边界不够清晰，以及部分表述仍偏职责罗列。'
      : '主要扣分项集中在AI直接证据深度、项目结果完整性和关键场景的细节展开。',
  };
}

function buildEvidenceMap(input, derived) {
  const keywords = buildKeywordList(input);
  const resumeText = [input.resume, input.highlightSkills, input.extras].filter(Boolean).join('\n');

  return pickTopCapabilities(keywords).map((keyword) => {
    const matched = resumeText.includes(keyword.replace('AI产品', 'AI')) || resumeText.includes(keyword);
    return {
      jd: keyword,
      evidence: matched ? `输入简历中已出现与“${keyword}”相关的经历或技能表述` : `当前输入中尚未明确体现“${keyword}”的直接证据`,
      strength: matched ? (keyword.includes('AI') ? '中' : '强') : '弱',
      supplement: matched ? '视情况补充' : '是',
      advice: matched
        ? `建议继续补充“${keyword}”对应的场景、动作和结果。`
        : `建议在经历或项目中补充“${keyword}”的具体实践证据。`,
    };
  });
}

function buildInterviewPrep(derived, answers) {
  const aiAnswer = cleanAnswer(answers.q4);
  const firstProject = derived.finalResume.projects[0]?.name || '核心项目';

  return {
    questions: [
      { q: `为什么你适合应聘${derived.targetRole}？`, support: '中' },
      { q: `你在${firstProject}中具体负责了哪些环节？`, support: '强' },
      { q: '你如何做需求优先级判断与跨团队推进？', support: '中' },
      { q: '你最能体现业务抽象能力的一次经历是什么？', support: '弱' },
      { q: derived.aiSignal ? '你做过哪些 AI 方向的实际探索？' : '如果转向目标岗位，你最先能复用的能力是什么？', support: derived.aiSignal ? '中' : '弱' },
      { q: '简历中哪一段最容易被面试官追问细节？', support: '中' },
      { q: '你提到的项目成果如何验证真实性？', support: '弱' },
      { q: '如果入职后第一个月，你会如何开展工作？', support: '无' },
    ],
    proofs: [
      'PRD、原型、流程图或需求文档示例',
      '项目评审、上线、验收相关记录',
      '能证明业务结果的截图、数据、客户反馈',
      aiAnswer ? `AI探索补充材料：${aiAnswer}` : '若有 AI 探索，请准备 Demo、流程图或实践说明',
    ],
    riskyClaims: [
      '没有直接证据支撑时，不要把“参与”写成“主导”',
      '没有结果数据时，不要硬写明确提升百分比',
      'AI探索若仍是学习阶段，建议如实表述为“实践/探索/验证”',
    ],
    missingData: [
      '客户/用户规模',
      '上线范围或覆盖模块',
      '效率、成本、交付周期等结果数据',
      '你本人独立负责的具体环节',
    ],
    answerTips: [
      '回答追问时用 STAR 结构：情境(Situation)→任务(Task)→行动(Action)→结果(Result)',
      '没有数据时可以说“当时没有系统理，但大致是…”并表明后续会补充',
      '被问到不确定的细节时，诚实说“这部分我需要确认后回复”比硬编更好',
      '准备 2-3 个能体现核心能力的项目故事，每个 2 分钟内讲完',
    ],
    intro: buildIntro(derived),
  };
}

function parseResume(text = '') {
  const lines = splitLines(text);
  const name = lines[0] || '';
  const headline = lines[1] || '';
  const sections = collectSections(lines.slice(2));

  return {
    name,
    headline,
    summary: (sections['职业摘要'] || sections['个人简介'] || []).join(' '),
    experience: parseExperienceSection(sections['工作经历'] || []),
    projects: parseProjectSection(sections['项目经历'] || []),
    skills: extractSkillsFromSections(sections),
    education: (sections['教育背景'] || []).join(' '),
  };
}

function collectSections(lines) {
  const sections = {};
  let current = 'default';
  sections[current] = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (isSectionHeader(line)) {
      current = normalizeHeader(line);
      sections[current] = sections[current] || [];
      return;
    }
    sections[current] = sections[current] || [];
    sections[current].push(line);
  });

  return sections;
}

function parseExperienceSection(lines) {
  const items = [];
  let current = null;

  lines.forEach((line) => {
    if (isBullet(line)) {
      if (!current) {
        current = { company: '未命名经历', title: '经历待补充', period: '', bullets: [] };
        items.push(current);
      }
      current.bullets.push(stripBullet(line));
      return;
    }

    const header = splitJobHeader(line);
    if (header) {
      current = { ...header, bullets: [] };
      items.push(current);
      return;
    }

    if (!current) {
      current = { company: line, title: '经历待补充', period: '', bullets: [] };
      items.push(current);
    } else {
      current.bullets.push(line);
    }
  });

  return items;
}

function parseProjectSection(lines) {
  const items = [];
  let current = null;

  lines.forEach((line) => {
    if (isBullet(line)) {
      if (!current) {
        current = { name: '项目待补充', bullets: [] };
        items.push(current);
      }
      current.bullets.push(stripBullet(line));
      return;
    }

    if (/^\d+[.、]/.test(line) || (!line.includes('：') && !line.includes(':') && line.length <= 30)) {
      current = { name: line.replace(/^\d+[.、]\s*/, '').trim(), bullets: [] };
      items.push(current);
      return;
    }

    if (!current) {
      current = { name: line, bullets: [] };
      items.push(current);
    } else {
      current.bullets.push(line);
    }
  });

  return items;
}

function optimizeExperience(item, input, answers) {
  const bullets = item.bullets.length ? item.bullets : ['负责相关工作内容'];
  const optimizedBullets = bullets.map((bullet, index) => optimizeBullet(bullet, input, index === 0 ? cleanAnswer(answers.q2) : ''));

  if (input.highlightSkills && optimizedBullets.length < 4) {
    optimizedBullets.push(`结合${input.highlightSkills.split(/[、,，]/).filter(Boolean).slice(0, 3).join('、')}等能力支持项目推进与方案落地。`);
  }

  if (input.extras && /量化|结果|效率|成本/.test(input.extras) && !optimizedBullets.some((bullet) => hasNumber(bullet))) {
    optimizedBullets.push(`结合补充信息持续校准结果表达，建议进一步补充可量化数据或上线成效。`);
  }

  return {
    company: item.company,
    title: item.title,
    period: item.period,
    bullets: unique(optimizedBullets).slice(0, 4),
  };
}

function optimizeProject(item, input, answers) {
  const answer = cleanAnswer(answers.q1) || cleanAnswer(answers.q3);
  const bullets = item.bullets.length ? item.bullets : ['项目内容待补充'];
  const optimized = bullets.map((bullet) => optimizeBullet(bullet, input));

  if (answer && optimized.length < 3) {
    optimized.push(`补充项目背景与结果：${answer}`);
  }

  if (!optimized.some((bullet) => /结果|效率|上线|价值|改善/.test(bullet))) {
    optimized.push('建议补充该项目的业务目标、协作对象与最终结果，提升说服力。');
  }

  return {
    name: item.name,
    bullets: unique(optimized).slice(0, 3),
  };
}

function fallbackExperience(lines, input, answers) {
  const chunks = lines.filter((line) => line.length > 8 && !isPersonalInfoLine(line)).slice(0, 2);
  return chunks.length
    ? chunks.map((line, index) => ({
        company: index === 0 ? '核心经历提炼' : '补充经历提炼',
        title: input.targetRole || '目标岗位相关经历',
        period: '',
        bullets: [optimizeBullet(line, input), cleanAnswer(answers.q2) ? `职责边界补充：${cleanAnswer(answers.q2)}` : '建议补充职责边界、协作对象与输出物。'],
      }))
    : [{
        company: '核心经历待补充',
        title: input.targetRole || '目标岗位相关经历',
        period: '',
        bullets: ['请先输入原始简历内容，我会基于真实输入进行优化输出。'],
      }];
}

function fallbackProjects(input, answers, sourceBullets) {
  const candidateLines = sourceBullets.length ? sourceBullets : splitLines(input.extras).filter((line) => line.length > 6);
  return [{
    name: '项目经验提炼',
    bullets: [
      candidateLines[0] ? optimizeBullet(candidateLines[0], input) : '请补充至少一个项目场景，便于生成更可信的优化版表达。',
      cleanAnswer(answers.q1) ? `项目场景补充：${cleanAnswer(answers.q1)}` : '建议补充项目背景、对象与关键流程。',
      cleanAnswer(answers.q3) ? `结果补充：${cleanAnswer(answers.q3)}` : '建议补充结果数据、上线范围或客户反馈。',
    ],
  }];
}

function buildSummary(input, parsedResume, skills, optimizedExperience, answers) {
  const base = parsedResume.summary || parsedResume.headline || `具备与${input.targetRole || '目标岗位'}相关的产品经验。`;
  const experienceFocus = optimizedExperience[0]?.bullets[0] || '';
  const aiAnswer = cleanAnswer(answers.q4);
  const aiClause = hasAiSignal(input, parsedResume, skills)
    ? `同时持续补充AI相关认知与实践，涉及${pickAiSkills(skills).join('、') || 'Prompt、Agent、工作流'}等方向。`
    : '';
  const answerClause = aiAnswer ? `当前额外补充的实践包括：${aiAnswer}。` : '';

  return compressText(`${base} ${experienceFocus} ${aiClause} ${answerClause}`.trim());
}

function buildHeadline(parsedResume, input) {
  const parts = [parsedResume.headline, input.targetIndustry, input.jobStage].filter(Boolean);
  return compressText(parts.join('｜'));
}

function buildPositioning(parsedResume, input, aiSignal) {
  const base = parsedResume.headline || input.jobStage || '具备相关经验的候选人';
  if (aiSignal && input.targetRole) {
    return `${base}，正在向${input.targetRole}方向强化场景与AI表达`;
  }
  return `${base}，可围绕${input.targetRole || '目标岗位'}进一步强化结果与项目证据`;
}

// 过滤个人信息行（手机/邮箱/姓名/婚姻/地址等）
const PERSONAL_INFO_RE = /^(手机|电话|邮箱|微信|婚姻|户籍|所在地|地址|性别|年龄|出生|政治面貌|身份证|求职意向|期望薪资|到岗时间|目前状态|自我评价|个人简介|个人评价|职业目标|联系方式|基本信息|个人信息)|目前|在职|离职|到岗|期望|意向|[\d]{3}[-\s]?\d{4}[-\s]?\d{4}|[\w.+-]+@[\w-]+\.[\w.-]+/;

// 是否像个人信息行（需要过滤）
function isPersonalInfoLine(line) {
  if (!line || line.length < 2) return true;
  if (PERSONAL_INFO_RE.test(line)) return true;
  // 姓名行：2-4 个中文字 + 可选分隔符 + 其他描述
  if (/^[\u4e00-\u9fa5]{2,4}\s*[|｜]/.test(line)) return true;
  // 姓名行：纯 2-4 个中文字
  if (/^[\u4e00-\u9fa5]{2,4}$/.test(line.trim())) return true;
  // 节标题行
  if (/^[\u4e00-\u9fa5]{2,8}[:：]?$/.test(line.trim())) return true;
  // 纯数字日期
  if (/^\d{4}[.年-]\d{1,2}/.test(line.trim())) return true;
  return false;
}

function buildRewriteTable(sourceBullets, optimizedExperience, optimizedProjects) {
  const optimizedBullets = [...optimizedExperience.flatMap((item) => item.bullets), ...optimizedProjects.flatMap((item) => item.bullets)];
  // 仅使用结构化 bullets（工作经历 + 项目经历），严格过滤个人信息
  const beforeList = sourceBullets.filter((b) => b && !isPersonalInfoLine(b));

  if (!beforeList.length) {
    // 无有效经历时返回引导性提示
    return [{
      section: '提示',
      before: '未检测到有效的工作经历或项目经历内容',
      after: '请在简历中补充“工作经历”或“项目经历”章节，每条以“-”或“•”开头描述职责与结果。',
      reason: '简历优化对照需要基于真实经历才能生成有效建议。',
      risk: '请避免将个人信息（手机/邮箱/地址）当作工作经历内容。',
    }];
  }

  return beforeList.slice(0, 6).map((before, index) => ({
    section: '工作经历',
    before,
    after: optimizedBullets[index] || optimizeBullet(before, { targetRole: '', jd: '', extras: '' }),
    reason: '把原始表述补充为更明确的动作、场景与结果导向表达。',
    risk: hasNumber(before) ? '请确认量化数据真实可追溯。' : '若实际职责有限，建议保守使用“参与/支持/协同”等措辞。',
  }));
}

function buildIssues(derived) {
  const issues = [];

  if (!derived.aiSignal) {
    issues.push('当前简历与目标岗位之间的迁移逻辑还不够清晰，建议明确说明为什么你的经验适合该方向。');
  }
  if (derived.quantifiedCount === 0) {
    issues.push('大多数经历仍缺少可量化结果，面试中容易被追问“最终带来了什么价值”。');
  }
  if (derived.finalResume.projects.length === 0) {
    issues.push('项目经历缺失或过于简略，不利于展示方法论和业务复杂度。');
  }
  issues.push('部分表达仍可继续补充职责边界、协作对象和业务目标，让内容更可信。');

  return issues.slice(0, 4);
}

function buildPriorities(derived) {
  const priorities = [];

  priorities.push('优先把最相关的工作经历改写成“场景 + 动作 + 结果”的结构。');
  if (derived.quantifiedCount === 0) {
    priorities.push('补充至少 2-3 条可验证的结果或业务反馈，提升说服力。');
  }
  priorities.push('在职业摘要中明确你的转型逻辑、差异化能力和目标岗位匹配点。');
  if (!derived.aiSignal) {
    priorities.push('如果目标是 AI/智能化岗位，补充真实探索案例而不是只列工具名。');
  }

  return priorities.slice(0, 4);
}

function buildIntro(derived) {
  const firstExperience = derived.finalResume.experience[0];
  const firstProject = derived.finalResume.projects[0];
  const summary = derived.finalResume.summary;

  return compressText([
    summary,
    firstExperience ? `过往经历中，我主要在${firstExperience.company}负责与目标岗位相关的工作，重点包括${firstExperience.bullets[0] || '需求分析与项目推进'}。` : '',
    firstProject ? `其中${firstProject.name}是比较能体现我能力的项目，我会重点展开场景、职责与结果。` : '',
  ].filter(Boolean).join(' '));
}

function extractTools(input) {
  const text = [input.highlightSkills, input.extras, input.resume].filter(Boolean).join(' ');
  const toolHints = ['Axure', 'Figma', 'SQL', 'Python', 'XMind', 'Visio', '墨刀', 'Prompt Engineering', 'Coze', 'Dify', 'Cursor', 'RAG', 'Agent', 'Jira', 'Notion', 'Excel', 'PPT'];
  return unique(toolHints.filter((tool) => text.includes(tool)));
}

function buildEnhancement(input, derived) {
  const aiSignal = derived.aiSignal;
  return {
    additionalProjects: [
      aiSignal ? '补充一个完整的 AI 应用 Demo（如智能问答、知识库、Agent 工作流），并写成项目经历' : '补充一个与目标岗位强相关的完整项目，突出“场景+动作+结果”',
      '整理 1-2 个可量化的业务结果（效率提升、成本降低、用户增长等）',
      '如果有跨团队协作经验，补充一个体现推动力的案例',
    ],
    portfolioNeeded: aiSignal ? '建议准备（AI 产品方向作品集能显著提升竞争力）' : '视情况（如果目标岗位看重作品展示则建议准备）',
    portfolioContent: [
      'PRD / 原型 / 流程图示例（脱敏后）',
      aiSignal ? 'AI 探索 Demo 截图或录屏（Coze/Dify/Prompt 工作流）' : '项目上线截图或数据看板',
      '简历优化前后对比（体现方法论）',
    ],
    resumeVersions: [
      '针对目标岗位的精简版（一页）',
      '包含更多项目细节的完整版（两页）',
      aiSignal ? '突出 AI 能力的版本' : '突出业务结果的版本',
    ],
    multiVersionAdvice: `建议针对不同公司类型（${input.targetCompanyType || '大厂/创业公司/ToB企业'}）微调简历侧重点，核心经历不变，但摘要和关键词应匹配各自 JD。`,
  };
}

function buildKeywordList(input) {
  const text = [input.targetRole, input.targetIndustry, input.jd, input.highlightSkills, input.resume].filter(Boolean).join(' ');
  const matched = defaultKeywords.filter((keyword) => text.includes(keyword) || (keyword === 'AI产品' && /AI|大模型|智能/.test(text)));
  // 仅返回用户输入中实际出现的关键词，不填充无关默认词
  return matched.length ? unique(matched).slice(0, 11) : ['AI产品'];
}

function pickTopCapabilities(keywords) {
  return unique(keywords.filter((keyword) => !['Prompt', 'Agent', 'RAG'].includes(keyword)).slice(0, 5));
}

function computeFitScore(input, parsedResume, skills) {
  let score = 58;
  if (input.targetRole) score += 6;
  if (input.jd) score += 6;
  if (parsedResume.experience.length) score += 8;
  if (parsedResume.projects.length) score += 6;
  if (skills.length >= 5) score += 6;
  if (hasAiSignal(input, parsedResume, skills)) score += 8;
  return Math.min(90, score);
}

function inferTargetRole(jd, resume) {
  const text = [jd, resume].join(' ');
  if (/AI产品经理|AI 产品经理/.test(text)) return 'AI产品经理';
  if (/产品经理/.test(text)) return '产品经理';
  if (/运营/.test(text)) return '运营';
  return '';
}

function hasAiSignal(input, parsedResume, skills) {
  const text = [input.targetRole, input.jd, input.highlightSkills, input.extras, parsedResume.summary, parsedResume.headline, skills.join(' ')].join(' ');
  return /AI|大模型|Prompt|Agent|RAG|Coze|Dify|智能/.test(text);
}

function pickAiSkills(skills) {
  return skills.filter((skill) => /AI|Prompt|Agent|RAG|Coze|Dify|Cursor/.test(skill)).slice(0, 4);
}

function optimizeBullet(text, input, extra = '') {
  const cleaned = text.replace(/[；;。]+$/g, '').trim();
  if (!cleaned) return '建议补充更具体的项目动作与结果。';

  const action = actionHints.find((item) => cleaned.includes(item));
  const value = valueHints.find((item) => cleaned.includes(item));
  const context = inferContext(cleaned, input);
  const suffix = extra ? `；补充说明：${extra}` : '';

  if (hasNumber(cleaned)) {
    return compressText(`${cleaned}，并围绕${context}持续推进落地与复盘${suffix}`);
  }

  if (action && value) {
    return compressText(`围绕${context}${action}${value}相关工作，输出方案并协同推进落地${suffix}`);
  }

  if (action) {
    return compressText(`${action}${context}相关工作，补充需求分析、方案输出与跨团队协作动作${suffix}`);
  }

  return compressText(`围绕${context}开展${cleaned}，建议进一步补充具体动作、协作对象与结果${suffix}`);
}

function inferContext(text, input) {
  if (/WMS|库存|仓储/.test(text)) return '仓储与库存管理场景';
  if (/ERP/.test(text)) return 'ERP业务流程';
  if (/报表|数据|经营/.test(text)) return '经营分析与数据决策场景';
  if (/客户|实施|销售/.test(text)) return '客户需求与交付协同场景';
  if (input.targetRole) return input.targetRole;
  return '相关业务场景';
}

function extractSkills(text = '') {
  return unique(skillHints.filter((skill) => text.includes(skill)));
}

function extractSkillsFromSections(sections) {
  const skillText = [
    ...(sections['技能'] || []),
    ...(sections['专业技能'] || []),
    ...(sections['default'] || []).filter((line) => /技能|工具|了解|熟悉/.test(line)),
  ].join(' ');

  return extractSkills(skillText);
}

function extractEducation(lines) {
  return lines.find((line) => /大学|学院|本科|硕士|博士/.test(line)) || '';
}

function splitJobHeader(line) {
  const periodMatch = line.match(/(20\d{2}[./-]\d{1,2}\s*[~-—至]\s*(?:20\d{2}[./-]\d{1,2}|至今))/);
  if (!periodMatch) return null;
  const period = periodMatch[1].replace(/\s+/g, ' ');
  const before = line.replace(periodMatch[0], ' ').trim();
  const parts = before.split(/\s{2,}|[｜|]/).map((part) => part.trim()).filter(Boolean);
  return {
    company: parts[0] || before || '公司待补充',
    title: parts[1] || '岗位待补充',
    period,
  };
}

function splitLines(text = '') {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function isSectionHeader(line) {
  return /^(职业摘要|个人简介|个人总结|工作经历|工作经验|工作履历|项目经历|项目经验|技能|专业技能|技能清单|教育背景|教育经历|自我评价|个人信息|基本信息|联系方式)[:：]?$/.test(line);
}

function normalizeHeader(line) {
  const cleaned = line.replace(/[:：]$/, '');
  // 将变体标题统一映射
  const map = {
    '工作经验': '工作经历',
    '工作履历': '工作经历',
    '项目经验': '项目经历',
    '专业技能': '技能',
    '技能清单': '技能',
    '教育经历': '教育背景',
    '个人总结': '职业摘要',
    '个人简介': '职业摘要',
  };
  return map[cleaned] || cleaned;
}

function isBullet(line) {
  return /^[-•·]/.test(line);
}

function stripBullet(line) {
  return line.replace(/^[-•·]\s*/, '').trim();
}

function cleanAnswer(text) {
  const value = text?.trim();
  return value ? value : '';
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

/** 从简历文本行中提取联系信息 */
function extractContact(lines) {
  const text = lines.join('\n');
  const phoneMatch = text.match(/1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const locMatch = text.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|重庆|天津|厦门|青岛|远程|广东|浙江|江苏|四川|湖北|湖南|福建|山东|河南|河北|辽宁|吉林|黑龙江|安徽|江西|广西|云南|贵州|山西|陕西|甘肃|青海|内蒙古|新疆|西藏|海南|宁夏)[^\n]{0,6}/);
  // 姓名通常是第一行（排除包含“简历”“求职”等字样的行）
  const nameLine = lines.find((l) => l.trim().length >= 2 && l.trim().length <= 10 && !/简历|求职|目标|岗位|电话|邮箱|手机/.test(l));
  const name = nameLine ? nameLine.replace(/[|｜].*$/, '').trim() : '';
  return {
    name,
    phone: phoneMatch ? phoneMatch[0] : '',
    email: emailMatch ? emailMatch[0] : '',
    location: locMatch ? locMatch[0] : '',
  };
}

function compressText(text = '') {
  return text.replace(/\s+/g, ' ').replace(/([，。；！？])\1+/g, '$1').trim();
}

function hasNumber(text = '') {
  return /\d/.test(text);
}

function countQuantifiedBullets(items) {
  return items.filter((item) => hasNumber(item) || /提升|降低|缩短|优化|增长/.test(item)).length;
}
