import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  Wand2,
  X,
  Brain,
} from 'lucide-react';
import { steps, exampleInput } from './mockData';
import { useResumeAnalysis } from './hooks/useResumeAnalysis';
import { parseFile } from './services/fileParser';
import { STYLE_LABELS } from './services/prompts';
import { ExportPanel } from './components/ExportPanel';

const THEMES = [
  { key: 'light', label: '白', dot: '#ffffff' },
  { key: 'kraft', label: '牛皮纸', dot: '#ede0c8' },
  { key: 'dark', label: '深色', dot: '#1a1e29' },
];

const STEP_ICONS = [FileText, FileSearch, Target, GitCompare, MessageSquare, Sparkles, ClipboardList, Brain, Download];
const STEP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DISABLED: 'disabled',
};

const COMPANY_TYPE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'ToB SaaS公司', label: 'ToB SaaS 公司' },
  { value: 'AI创业公司', label: 'AI 创业公司' },
  { value: '互联网大厂', label: '互联网大厂' },
  { value: '传统软件企业', label: '传统软件企业' },
  { value: '外企', label: '外企' },
  { value: '国企/央企', label: '国企 / 央企' },
];

const JOB_STAGE_OPTIONS = [
  { value: '', label: '不限' },
  { value: '校招', label: '应届毕业生 / 校招' },
  { value: '社招-1-3年', label: '1-3 年经验' },
  { value: '社招-3-5年', label: '3-5 年经验' },
  { value: '社招-5年以上', label: '5 年以上经验' },
  { value: '转行', label: '转行 / 转型' },
];

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('resume-theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('resume-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return [theme, setTheme];
}

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [input, setInput] = useState({
    targetRole: '',
    targetIndustry: '',
    targetCompanyType: '',
    jobStage: '',
    highlightSkills: '',
    jd: '',
    resume: '',
    extras: '',
  });
  const [answers, setAnswers] = useState({});
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [variant, setVariant] = useState('balanced');
  const { analyze, reset, generateFollowUpBullet, regenerateOptimizedItems, loading, error: analysisError, data: analysis, engine } = useResumeAnalysis();
  const [theme, setTheme] = useTheme();
  const [uploadState, setUploadState] = useState({ loading: false, msg: '', error: false });
  // 记录用于生成当前分析结果的输入快照，便于检测输入是否被修改
  const [analyzedInput, setAnalyzedInput] = useState(null);
  // 追问 AI 生成的 bullet 缓存（按追问 id）
  const [followUpBullets, setFollowUpBullets] = useState({});
  const [bulletLoadingId, setBulletLoadingId] = useState(null);
  const [bulletError, setBulletError] = useState('');
  // 优化风格重新生成的 rewriteTable 覆盖
  const [rewriteOverride, setRewriteOverride] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  // 复制 / Dialog 状态
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 派生状态：输入是否完全是示例数据
  const inputIsExample =
    input.targetRole === exampleInput.targetRole &&
    input.targetIndustry === exampleInput.targetIndustry &&
    input.targetCompanyType === exampleInput.targetCompanyType &&
    input.jobStage === exampleInput.jobStage &&
    input.highlightSkills === exampleInput.highlightSkills &&
    input.jd === exampleInput.jd &&
    input.resume === exampleInput.resume &&
    input.extras === exampleInput.extras;

  const inputHasContent =
    Boolean(
      input.targetRole ||
        input.targetIndustry ||
        input.targetCompanyType ||
        input.jobStage ||
        input.highlightSkills ||
        input.jd ||
        input.resume ||
        input.extras,
    );

  // 当前输入是否与生成分析时一致
  const inputMatchesAnalyzed = (() => {
    if (!analyzedInput) return false;
    return (
      input.targetRole === analyzedInput.targetRole &&
      input.targetIndustry === analyzedInput.targetIndustry &&
      input.targetCompanyType === analyzedInput.targetCompanyType &&
      input.jobStage === analyzedInput.jobStage &&
      input.highlightSkills === analyzedInput.highlightSkills &&
      input.jd === analyzedInput.jd &&
      input.resume === analyzedInput.resume &&
      input.extras === analyzedInput.extras
    );
  })();

  const handleUseExample = () => {
    if (analysisStarted) {
      const ok = window.confirm(
        '使用示例数据会覆盖当前输入与已生成的分析结果，后续步骤的回答也会被清空。确定继续吗？',
      );
      if (!ok) return;
    }
    reset();
    setInput(exampleInput);
    setAnalysisStarted(false);
    setActiveStep(0);
    setAnswers({});
    setVariant('balanced');
    setAnalyzedInput(null);
    setFollowUpBullets({});
    setRewriteOverride(null);
    setBulletError('');
    setRewriteError('');
    setCopied(false);
    setDialogOpen(false);
  };

  const handleClearInput = () => {
    const hasContent =
      input.targetRole ||
      input.targetIndustry ||
      input.targetCompanyType ||
      input.jobStage ||
      input.highlightSkills ||
      input.jd ||
      input.resume ||
      input.extras;
    if (!hasContent) return;
    const ok = window.confirm(
      analysisStarted
        ? '清空表单仅重置输入框，不会清空已生成的分析结果与追问回答。确定继续吗？'
        : '确定清空所有输入框？',
    );
    if (!ok) return;
    setInput({
      targetRole: '',
      targetIndustry: '',
      targetCompanyType: '',
      jobStage: '',
      highlightSkills: '',
      jd: '',
      resume: '',
      extras: '',
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({ loading: true, msg: `正在解析 ${file.name}…`, error: false });
    try {
      const text = await parseFile(file);
      if (!text.trim()) {
        throw new Error('文件内容为空，请检查文件是否正确');
      }
      setInput((prev) => ({ ...prev, resume: text }));
      setUploadState({ loading: false, msg: `✅ 已从 ${file.name} 提取 ${text.length} 字`, error: false });
    } catch (err) {
      setUploadState({ loading: false, msg: err.message || '解析失败', error: true });
    }
    // 清空 input 让同一文件可重复选择
    e.target.value = '';
  };

 const handleAnalyze = async () => {
    if (loading) return;
    if (!input.resume.trim() && !input.jd.trim()) {
      alert('请至少填写"目标岗位JD"或"原始简历"后再开始分析');
      return;
    }
    setAnalysisStarted(true);
    setActiveStep(1);
    setAnalyzedInput({ ...input }); // 记录生成分析时的输入快照
    setFollowUpBullets({});
    setRewriteOverride(null);
    await analyze(input, answers);
  };

  // 追问 AI 生成专业 bullet
  const handleGenerateBullet = async (askItem) => {
    const userAnswer = answers[askItem.id] || '';
    if (!userAnswer.trim()) {
      setBulletError(`请先填写【${askItem.title}】的回答`);
      return;
    }
    setBulletLoadingId(askItem.id);
    setBulletError('');
    try {
      const bullet = await generateFollowUpBullet(input, askItem, userAnswer);
      setFollowUpBullets((prev) => ({ ...prev, [askItem.id]: bullet }));
    } catch (err) {
      setBulletError(err?.message || 'Bullet 生成失败');
    } finally {
      setBulletLoadingId(null);
    }
  };

  // 优化风格切换：仅在 minimax 引擎下重新生成
  const handleVariantChange = async (nextVariant) => {
    setVariant(nextVariant);
    if (engine !== 'minimax-m3' || !analysis) {
      setRewriteOverride(null);
      return;
    }
    if (nextVariant === 'balanced') {
      setRewriteOverride(null);
      return;
    }
    setRewriteLoading(true);
    setRewriteError('');
    try {
      const items = await regenerateOptimizedItems(input, nextVariant, analysis.rewriteTable);
      if (Array.isArray(items) && items.length) {
        setRewriteOverride(items);
      }
    } catch (err) {
      setRewriteError(err?.message || '该风格的优化结果生成失败');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleCopyResume = async () => {
    if (!analysis) {
      alert('请先生成分析结果后再复制');
      return;
    }
    const text = buildResumeText(analysis);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  // 当前展示的 rewriteTable（优化风格重新生成后的覆盖版本）
  const rewriteTable = useMemo(() => {
    if (rewriteOverride && variant !== 'balanced') return rewriteOverride;
    return analysis?.rewriteTable || [];
  }, [rewriteOverride, variant, analysis]);

  // 步骤状态：input 始终可点；其余步骤未生成分析时禁用
  const getStepStatus = (index) => {
    if (index === 0) return activeStep === 0 ? STEP_STATUS.ACTIVE : STEP_STATUS.COMPLETED;
    if (!analysis && !analysisStarted) return STEP_STATUS.PENDING;
    if (!analysis) return STEP_STATUS.DISABLED;
    if (index < activeStep) return STEP_STATUS.COMPLETED;
    if (index === activeStep) return STEP_STATUS.ACTIVE;
    return STEP_STATUS.PENDING;
  };

  const canNavigateTo = (index) => {
    if (index === 0) return true;
    return Boolean(analysis);
  };

  const handleStepNav = (index) => {
    if (!canNavigateTo(index)) return;
    setActiveStep(index);
  };

  const renderStepContent = () => {
    if (!analysisStarted && activeStep !== 0) {
      return <EmptyState title="请先开始分析" description="先填写信息或使用示例数据，然后点击“开始分析”。" />;
    }

    if (loading && !analysis && activeStep !== 0) {
      return (
        <section className="panel-stack">
          <div className="card loading-state">
            <div className="loading-spinner" aria-hidden="true" />
            <h3>正在调用 MiniMax 生成分析…</h3>
            <p className="muted">预计需要 10–30 秒，生成期间你可以继续浏览其他面板。</p>
          </div>
        </section>
      );
    }

    if (!analysis && analysisStarted && activeStep !== 0) {
      return (
        <section className="panel-stack">
          <div className="card error-state">
            <h3>未能生成分析结果</h3>
            <p className="muted">{analysisError || '请检查网络与 .env 配置后重试。'}</p>
            <div className="action-row">
              <button className="primary-button" onClick={handleAnalyze}>重试</button>
              <button className="secondary-button" onClick={handleUseExample}>使用示例数据</button>
            </div>
          </div>
        </section>
      );
    }

    switch (activeStep) {
      case 0:
        return (
          <section className="panel-grid input-grid">
            <Card title="求职目标">
              <Field label="目标岗位" value={input.targetRole} onChange={(value) => setInput({ ...input, targetRole: value })} placeholder="例如：AI产品经理" />
              <Field label="目标行业" value={input.targetIndustry} onChange={(value) => setInput({ ...input, targetIndustry: value })} placeholder="例如：AI应用 / 企业服务" />
              <SelectField
                label="目标公司类型"
                value={input.targetCompanyType}
                onChange={(value) => setInput({ ...input, targetCompanyType: value })}
                options={COMPANY_TYPE_OPTIONS}
              />
              <SelectField
                label="当前求职阶段"
                value={input.jobStage}
                onChange={(value) => setInput({ ...input, jobStage: value })}
                options={JOB_STAGE_OPTIONS}
              />
              <TextArea label="希望突出能力" value={input.highlightSkills} onChange={(value) => setInput({ ...input, highlightSkills: value })} placeholder="例如：AI产品能力、项目推进、业务抽象、数据分析" rows={4} />
            </Card>

            <Card title="岗位JD">
              <TextArea label="目标岗位JD" value={input.jd} onChange={(value) => setInput({ ...input, jd: value })} placeholder="请粘贴完整岗位JD" rows={20} />
            </Card>

            <Card title="原始简历">
              <div className="upload-row">
                <input
                  type="file"
                  accept=".docx,.pdf,.txt"
                  onChange={handleFileUpload}
                  disabled={uploadState.loading}
                />
                {uploadState.msg && (
                  <span className={`upload-status${uploadState.error ? ' error' : ''}`}>
                    {uploadState.loading ? '⏳ ' : ''}{uploadState.msg}
                  </span>
                )}
              </div>
              <TextArea label="原始简历" value={input.resume} onChange={(value) => setInput({ ...input, resume: value })} placeholder="可上传 .docx / .pdf 文件，或直接粘贴原始简历全文" rows={24} />
            </Card>

            <Card title="补充信息">
              <TextArea label="补充信息，可选" value={input.extras} onChange={(value) => setInput({ ...input, extras: value })} placeholder="代表项目、技能工具、可量化结果、不希望夸大的地方、目标长度等" rows={14} />
            </Card>
          </section>
        );
      case 1:
        return (
          <section className="panel-stack">
            <HeaderBlock title="JD解析" subtitle="基于目标岗位输出职责、要求、关键词与理想候选人画像。" />
            <DataTable
              columns={['分析维度', '解析结果']}
              rows={analysis.jdAnalysis.map((item) => [item.item, item.detail])}
            />
          </section>
        );
      case 2:
        return (
          <section className="panel-stack">
            <HeaderBlock title="简历诊断" subtitle="先看匹配度，再看最优先修改项。" />
            <div className="stats-row">
              <Card compact>
                <div className="card-title">匹配度评分</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  <ScoreRing score={analysis.diagnosis.overall} size={120} />
                  <div>
                    <strong style={{ fontSize: 18 }}>{analysis.summary.scoreLabel}</strong>
                    <p className="score-comment">{analysis.diagnosis.deductionReason}</p>
                  </div>
                </div>
              </Card>
              <MetricCard label="目标岗位" value={analysis.summary.role} hint={input.targetIndustry || '目标行业待填写'} />
              <MetricCard label="主要短板" value="成果量化 / AI证据" hint={analysis.diagnosis.deductionReason} />
            </div>
            <Card title="维度评分">
              <div className="score-list">
                {analysis.diagnosis.dimensions.map((item) => (
                  <div className="score-item" key={item.name}>
                    <div className="score-head">
                      <span>{item.name}</span>
                      <strong>{item.score}</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${item.score}%` }} />
                    </div>
                    {item.comment ? <p className="score-comment">{item.comment}</p> : null}
                  </div>
                ))}
              </div>
            </Card>
            <div className="two-column">
              <Card title="主要问题">
                <BulletList items={analysis.diagnosis.issues} />
              </Card>
              <Card title="优先修改建议">
                <BulletList items={analysis.diagnosis.priorities} />
              </Card>
            </div>
          </section>
        );
      case 3:
        return (
          <section className="panel-stack">
            <HeaderBlock title="JD-简历匹配分析" subtitle="用证据强度判断哪些内容可以直接打，哪些必须补证据。" />
            <DataTable
              columns={['JD要求', '简历已有证据', '证据强度', '是否需要补充', '优化建议']}
              rows={analysis.evidenceMap.map((item) => [item.jd, item.evidence, item.strength, item.supplement, item.advice])}
            />
          </section>
        );
      case 4:
        return (
          <section className="panel-stack">
            <HeaderBlock title="经历追问" subtitle="这些问题决定你能否把经历改成可信的能力证据。" />
            {bulletError ? (
              <div className="card error-state" style={{ minHeight: 'auto', padding: 14 }}>
                <p style={{ margin: 0 }}>{bulletError}</p>
              </div>
            ) : null}
            <div className="ask-grid">
              {analysis.askItems.map((item) => {
                const aiBullet = followUpBullets[item.id];
                const isLoadingBullet = bulletLoadingId === item.id;
                return (
                  <Card key={item.id} title={item.title} compact>
                    <p className="muted">{item.question}</p>
                    <TextArea
                      label="你的补充回答"
                      value={answers[item.id] || ''}
                      onChange={(value) => setAnswers({ ...answers, [item.id]: value })}
                      placeholder="请输入真实补充信息"
                      rows={4}
                    />
                    <div className="followup-actions">
                      <button
                        type="button"
                        className="followup-action-btn primary"
                        onClick={() => handleGenerateBullet(item)}
                        disabled={isLoadingBullet || !(answers[item.id] || '').trim()}
                      >
                        {isLoadingBullet ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            生成简历 bullet
                          </>
                        )}
                      </button>
                      {(answers[item.id] || '').trim() ? (
                        <span className="status-hint">已填写 · 可生成</span>
                      ) : (
                        <span className="status-hint">待填写</span>
                      )}
                    </div>
                    {aiBullet ? (
                      <div className="bullet-ai-result">
                        <div className="bullet-ai-label">AI 生成的 bullet</div>
                        <p className="bullet-ai-text">{aiBullet}</p>
                      </div>
                    ) : (
                      <div className="bullet-preview">
                        <span className="badge">参考表达</span>
                        <p>{answers[item.id] ? item.bullet.replace(/\[[^\]]*\]/g, answers[item.id]) : item.bullet}</p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      case 5:
        return (
          <section className="panel-stack">
            <HeaderBlock
              title="简历优化"
              subtitle="展示逐条修改逻辑，并支持不同优化倾向。"
              right={engine === 'minimax-m3' ? (
                <span className="status-hint" style={{ alignSelf: 'center' }}>
                  {rewriteLoading ? '重新生成中…' : '点击风格按钮可重新生成对照表'}
                </span>
              ) : null}
            />
            <div className="variant-row">
              {[
                ['balanced', '默认平衡'],
                ['concise', '更简洁'],
                ['conservative', '降低夸张'],
                ['ai', '更偏AI产品'],
                ['tob', '更偏ToB SaaS'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip-button ${variant === key ? 'active' : ''}`}
                  onClick={() => handleVariantChange(key)}
                  disabled={rewriteLoading}
                >
                  {rewriteLoading && variant === key ? (
                    <Loader2 size={12} className="spin" style={{ marginRight: 4 }} />
                  ) : null}
                  {label}
                </button>
              ))}
            </div>
            <div className="note-card">
              当前风格：<strong>{STYLE_LABELS[variant] || variantLabel(variant)}</strong>。
              {engine === 'minimax-m3'
                ? '当前结果由 MiniMax-M3 生成，切换风格会自动调用大模型重新生成。'
                : engine === 'mock'
                  ? '当前结果为本地 Mock 兜底输出，配置 .env 中的 VITE_MINIMAX_API_KEY 后将自动调用 MiniMax-M3。'
                  : '等待生成结果后可在此查看修改对照。'}
            </div>
            {rewriteError ? (
              <div className="card error-state" style={{ minHeight: 'auto', padding: 14 }}>
                <p style={{ margin: 0 }}>{rewriteError}</p>
              </div>
            ) : null}
            <DataTable
              columns={['板块', '修改前', '修改后', '修改理由', '风险提示']}
              rows={rewriteTable.map((item) => [
                <span key="section" className="section-badge">{item.section || '其他'}</span>,
                item.before,
                variantTransform(item.after, variant),
                item.reason,
                item.risk,
              ])}
            />
          </section>
        );
      case 6:
        return (
          <section className="panel-stack">
            <HeaderBlock title="面试准备" subtitle="把简历里的潜在风险，提前变成可准备的回答。" />
            <div className="two-column">
              <Card title="高频追问">
                <BulletList items={analysis.interviewPrep.questions} />
              </Card>
              <Card title="需要准备的证据">
                <BulletList items={analysis.interviewPrep.proofs} />
              </Card>
            </div>
            <div className="two-column">
              <Card title="可能夸大的表达">
                <BulletList items={analysis.interviewPrep.riskyClaims} />
              </Card>
              <Card title="建议补充的数据">
                <BulletList items={analysis.interviewPrep.missingData} />
              </Card>
            </div>
            <Card title="回答追问的建议">
              <BulletList items={analysis.interviewPrep.answerTips} />
            </Card>
            <Card title="自我介绍草稿">
              <p className="long-text">{analysis.interviewPrep.intro}</p>
            </Card>
          </section>
        );
      case 7:
        return (
          <section className="panel-stack">
            <HeaderBlock title="补强建议" subtitle="告诉你还能做什么来提高命中率。" />
            <div className="two-column">
              <Card title="建议补充的项目/经历">
                <BulletList items={analysis.enhancement.additionalProjects} />
              </Card>
              <Card title="作品集建议">
                <p className="muted" style={{ marginBottom: 8 }}>是否需要作品集：<strong>{analysis.enhancement.portfolioNeeded}</strong></p>
                <BulletList items={analysis.enhancement.portfolioContent} />
              </Card>
            </div>
            <div className="two-column">
              <Card title="简历版本建议">
                <BulletList items={analysis.enhancement.resumeVersions} />
              </Card>
              <Card title="多版本策略">
                <p className="long-text">{analysis.enhancement.multiVersionAdvice}</p>
              </Card>
            </div>
          </section>
        );
      case 8:
        return (
          <section className="panel-stack">
            <HeaderBlock
              title="导出结果"
              subtitle="选择模板、预览效果，一键导出 PDF 或 Word 版本。"
            />
            <div className="summary-grid">
              <div className="summary-tile">
                <div className="summary-tile-label">匹配度评分</div>
                <div className="summary-tile-value">
                  {analysis.diagnosis.overall}<small>/ 100</small>
                </div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile-label">匹配项分析</div>
                <div className="summary-tile-value">
                  {analysis.evidenceMap?.length || 0}<small>条</small>
                </div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile-label">优化修改</div>
                <div className="summary-tile-value">
                  {rewriteTable.length}<small>处</small>
                </div>
              </div>
            </div>

            <ExportPanel analysis={analysis} role={analysis.summary?.role || input.targetRole} />

            <div className="action-row" style={{ justifyContent: 'flex-end', paddingTop: 4 }}>
              <button className="secondary-button" onClick={handleCopyResume}>
                <CopyFeedback copied={copied} label="复制纯文本简历" />
              </button>
              <button className="secondary-button" onClick={() => setDialogOpen(true)}>
                预览纯文本
              </button>
            </div>
            <Dialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              title="简历预览（纯文本）"
              maxWidth={720}
              footer={
                <>
                  <button className="secondary-button" onClick={() => setDialogOpen(false)}>关闭</button>
                  <button className="primary-button" onClick={handleCopyResume}>
                    <CopyFeedback copied={copied} label="复制内容" />
                  </button>
                </>
              }
            >
              <textarea
                className="dialog-textarea"
                readOnly
                value={buildResumeText(analysis)}
              />
              <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                以上为最终优化版简历纯文本。如需精美排版，请在上方选择模板后导出 PDF 或 Word。
              </p>
            </Dialog>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">简历优化大师</div>
          <div className="subbrand">JD 定制简历优化 Agent</div>
        </div>
        <div className="topbar-actions">
          <div className="theme-switcher" role="group" aria-label="主题切换">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={theme === t.key ? 'active' : ''}
                onClick={() => setTheme(t.key)}
                title={t.label}
              >
                <span className="theme-dot" style={{ background: t.dot }} />
                {t.label}
              </button>
            ))}
          </div>
          <button className="secondary-button" onClick={handleUseExample} disabled={loading}>使用示例数据</button>
          <button className="secondary-button" onClick={handleClearInput} disabled={loading}>清空表单</button>
          <button className="primary-button" onClick={handleAnalyze} disabled={loading}>
            {loading ? '分析中…' : analysisStarted ? '重新生成' : '开始分析'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-group">
            <div className="sidebar-title">流程导航</div>
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              const Icon = STEP_ICONS[index] || Circle;
              const isDisabled = status === STEP_STATUS.DISABLED;
              return (
                <button
                  key={step}
                  className={`step-item ${status === STEP_STATUS.ACTIVE ? 'active' : ''} ${status === STEP_STATUS.COMPLETED ? 'completed' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => handleStepNav(index)}
                  disabled={isDisabled}
                  title={step}
                >
                  <span className="step-icon">
                    {status === STEP_STATUS.COMPLETED ? <Check size={16} /> : <Icon size={16} />}
                  </span>
                  <span style={{ flex: 1 }}>{step}</span>
                  <span className="step-index">{index + 1}</span>
                </button>
              );
            })}
          </div>
          <Card title="当前状态" compact>
            <div className="status-list">
              <div><span>产品定位</span><strong>JD定制优化</strong></div>
              <div><span>分析引擎</span><strong>{engineLabel(engine)}</strong></div>
              <div><span>适配方向</span><strong>{input.targetRole || '待填写'}</strong></div>
              <div>
                <span>数据来源</span>
                <strong>
                  {inputIsExample
                    ? '示例数据'
                    : inputHasContent
                    ? '真实填写'
                    : '未填写'}
                </strong>
              </div>
              {analysisStarted ? (
                <div className="status-hint">
                  <span>分析状态</span>
                  <strong>{inputMatchesAnalyzed ? '已同步' : '需重新生成'}</strong>
                </div>
              ) : null}
              {analysisError && engine === 'mock' ? (
                <div className="status-hint"><span>提示</span><strong>已回退 Mock</strong></div>
              ) : null}
            </div>
          </Card>
        </aside>

        <main className="workspace">
          <section className="workspace-header card">
            <div>
              <div className="eyebrow">Resume Optimization Flow</div>
              <h1>{steps[activeStep]}</h1>
              <p>围绕目标 JD，把普通经历重构为招聘方认可的能力证据。</p>
            </div>
            <div className="workspace-meta">
              {analysis ? (
                <>
                  <span className="badge">{analysis.summary.generatedAt}</span>
                  <span className="badge subtle">Fit Score {analysis.summary.fitScore}</span>
                </>
              ) : loading ? (
                <span className="badge subtle">正在调用 MiniMax…</span>
              ) : analysisStarted ? (
                <span className="badge subtle">本次未生成结果</span>
              ) : (
                <span className="badge subtle">待生成</span>
              )}
            </div>
          </section>

          {renderStepContent()}
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field select-field">
      <span>{label}</span>
      <span className="select-wrapper">
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
      </span>
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 6 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />
    </label>
  );
}

function Card({ title, children, compact = false }) {
  return (
    <section className={`card ${compact ? 'compact' : ''}`}>
      {title ? <div className="card-title">{title}</div> : null}
      {children}
    </section>
  );
}

function HeaderBlock({ title, subtitle, right }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap card">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card card compact">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-hint">{hint}</span>
    </div>
  );
}

/**
 * 评分环 (SVG)
 */
function ScoreRing({ score = 0, size = 140 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const offset = circumference * (1 - safeScore / 100);
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="score-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="score-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-value">
        <span className="score-ring-number">{safeScore}</span>
        <span className="score-ring-suffix">/ 100</span>
      </div>
    </div>
  );
}

/**
 * 轻量 Dialog 模态框（不依赖 Radix）
 */
function Dialog({ open, onClose, title, children, footer, maxWidth = 720 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * 复制反馈：2 秒内显示 ✓
 */
function CopyFeedback({ copied, label = '复制最终简历' }) {
  if (copied) {
    return (
      <span className="copy-feedback">
        <Check size={14} /> 已复制
      </span>
    );
  }
  return <span>{label}</span>;
}

function BulletList({ items }) {
  return (
    <ul className="bullet-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="card empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function ResumeSection({ title, content }) {
  return (
    <section className="resume-section">
      <h3>{title}</h3>
      {content}
    </section>
  );
}

/**
 * 把最终简历拼成纯文本，供复制/预览使用
 */
function buildResumeText(analysis) {
  if (!analysis) return '';
  const { finalResume } = analysis;
  return [
    ...(finalResume.basic || []),
    '',
    finalResume.jobIntention ? `求职意向：${finalResume.jobIntention}` : '',
    '',
    '职业摘要',
    finalResume.summary || '',
    '',
    '核心能力',
    (finalResume.skills || []).join('｜'),
    '',
    finalResume.tools?.length ? `技能工具：${finalResume.tools.join('｜')}` : '',
    '',
    '工作经历',
    ...(finalResume.experience || []).flatMap((item) => [
      `${item.company}｜${item.title}｜${item.period}`,
      ...(item.bullets || []).map((bullet) => `- ${bullet}`),
      '',
    ]),
    '项目经历',
    ...(finalResume.projects || []).flatMap((item) => [
      item.name,
      ...(item.bullets || []).map((bullet) => `- ${bullet}`),
      '',
    ]),
    '教育背景',
    finalResume.education || '',
    '',
    finalResume.extras?.length ? `其他加分项：${finalResume.extras.join('、')}` : '',
  ].filter(Boolean).join('\n');
}

function variantLabel(variant) {
  return {
    balanced: '默认平衡',
    concise: '更简洁',
    conservative: '降低夸张',
    ai: '更偏AI产品',
    tob: '更偏ToB SaaS',
  }[variant];
}

function engineLabel(engine) {
  if (engine === 'minimax-m3') return 'MiniMax-M3';
  if (engine === 'mock') return '本地 Mock（兜底）';
  return '未启动';
}

function variantTransform(text, variant) {
  if (variant === 'concise') return text.replace('围绕', '').replace('开展', '').replace('相关', '');
  if (variant === 'conservative') return text.replace('推动', '参与推动').replace('完善', '支持完善');
  if (variant === 'ai') return text.includes('AI') ? text : `${text} [可进一步补充AI视角]`;
  if (variant === 'tob') return text.includes('B端') || text.includes('客户') ? text : `${text} [突出企业客户场景]`;
  return text;
}

export default App;
