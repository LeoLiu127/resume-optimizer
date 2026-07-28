import { useEffect, useMemo, useRef, useState } from 'react';
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
  Shield,
  Sparkles,
  Target,
  Wand2,
  X,
  Brain,
} from 'lucide-react';
import { steps, exampleInput } from './mockData';
import { useResumeAnalysis } from './hooks/useResumeAnalysis';
import { useResumes } from './hooks/useResumes';
import { usePersistentAnswers } from './hooks/usePersistentAnswers';
import { parseFile } from './services/fileParser';
import { STYLE_LABELS } from './services/prompts';
import {
  isExactExampleInput,
  resumeRecordToEditorState,
  shouldAutoSaveDraft,
} from './services/resumeDraft';
import {
  buildPositionPayload,
  mergeBilingualTranslationIntoInput,
  mergeJdExtractionIntoInput,
} from './services/jdFieldMapping';
import { needsBilingualTranslation } from './services/bilingualJd';
import {
  canUseAnalysis,
  createAnalysisContextKey,
  isAnalysisCurrent,
} from './services/analysisContext';
import { ExportPanel } from './components/ExportPanel';
import { AuthGate } from './components/AuthGate';
import { AdminPanel } from './components/AdminPanel';
import { PositionPanel } from './components/PositionPanel';
import { getStoredUser, positions as positionsApi, jd as jdApi } from './services/api';

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
  { value: '', label: '未填写' },
  { value: 'ToB SaaS公司', label: 'ToB SaaS 公司' },
  { value: 'AI创业公司', label: 'AI 创业公司' },
  { value: '互联网大厂', label: '互联网大厂' },
  { value: '传统软件企业', label: '传统软件企业' },
  { value: '外企', label: '外企' },
  { value: '国企/央企', label: '国企 / 央企' },
];

const JOB_STAGE_OPTIONS = [
  { value: '', label: '未填写' },
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
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [variant, setVariant] = useState('balanced');
  const { analyze, reset, generateFollowUpBullet, regenerateOptimizedItems, loading, error: analysisError, data: analysis, engine } = useResumeAnalysis();
  const [theme, setTheme] = useTheme();
  const [uploadState, setUploadState] = useState({ loading: false, msg: '', error: false });
  // 记录用于生成当前分析结果的输入快照，便于检测输入是否被修改
  const [analyzedInput, setAnalyzedInput] = useState(null);
  const [bulletLoadingId, setBulletLoadingId] = useState(null);
  const [bulletError, setBulletError] = useState('');
  // 优化风格重新生成的 rewriteTable 覆盖
  const [rewriteOverride, setRewriteOverride] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  // 复制 / Dialog 状态
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // 当前登录用户（用于数据隔离与管理后台入口）
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  // 简历库（云端）
  const resumes = useResumes(currentUser?.id || '');
  // 当前编辑中的简历名称（重命名 / 新建用）
  const [resumeTitle, setResumeTitle] = useState('');
  // 防抖加载远端列表，避免刷新闪烁
  const [resumeListLoaded, setResumeListLoaded] = useState(false);
  // 管理后台视图开关（仅 admin 可见入口）
  const [adminView, setAdminView] = useState(false);
  // 岗位管理面板开关
  const [positionView, setPositionView] = useState(false);
  // 当前绑定的岗位 ID
  const [boundPositionId, setBoundPositionId] = useState('');
  const [boundPositionTitle, setBoundPositionTitle] = useState('');
  // URL 提取状态
  const [jdUrl, setJdUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);
  const [loginAssistMsg, setLoginAssistMsg] = useState('');
  const [preparingAnalysis, setPreparingAnalysis] = useState(false);
  const [translationWarning, setTranslationWarning] = useState('');

  // 经历追问记忆（持久化回答 + AI bullet + 跨 JD 记忆库）
  const {
    answers,
    setAnswer,
    saveToMemory,
    isInMemory,
    followUpBullets,
    saveBullet,
    mergeWithMemory,
    newItemIds,
    clearCurrent: clearCurrentAnswers,
    ensureContext: ensureAnswerContext,
    memoryCount,
  } = usePersistentAnswers(currentUser?.id || '');
  const [savedTip, setSavedTip] = useState('');

  const invalidateAnalysisContext = ({ clearTransientAnswers = true } = {}) => {
    reset();
    setAnalyzedInput(null);
    setAnalysisStarted(false);
    setRewriteOverride(null);
    setBulletError('');
    setRewriteError('');
    setTranslationWarning('');
    if (clearTransientAnswers) clearCurrentAnswers();
  };

  // 分析完成后，将新追问与记忆库合并（自动预填充已回答过的问题）
  const prevAskItemsRef = useRef(null);
  useEffect(() => {
    if (analysis?.askItems && analysis.askItems !== prevAskItemsRef.current) {
      prevAskItemsRef.current = analysis.askItems;
      mergeWithMemory(analysis.askItems);
    }
  }, [analysis, mergeWithMemory]);

  // 同步登录状态（监听 AuthGate 派发的事件 + storage 事件兜底）
  useEffect(() => {
    const refresh = () => setCurrentUser(getStoredUser());
    window.addEventListener('resume:login', refresh);
    window.addEventListener('resume:logout', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('resume:login', refresh);
      window.removeEventListener('resume:logout', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // 登出时重置 adminView
  useEffect(() => {
    if (!currentUser) {
      setAdminView(false);
      setPositionView(false);
    }
  }, [currentUser]);

  // 岗位面板：应用岗位到输入表单
  const handleApplyPosition = (positionInput, positionId, positionTitle) => {
    invalidateAnalysisContext();
    setInput((prev) => ({
      ...prev,
      ...positionInput,
      resume: prev.resume, // 保留已有简历内容
    }));
    setBoundPositionId(positionId || '');
    setBoundPositionTitle(positionTitle || '');
    setPositionView(false);
    setActiveStep(0);
  };

  // 解除岗位绑定
  const handleUnbindPosition = () => {
    setBoundPositionId('');
    setBoundPositionTitle('');
  };

  // URL 提取 JD
  const handleExtractJd = async () => {
    if (!jdUrl.trim() || extracting) return;
    setExtracting(true);
    setExtractResult(null);
    setLoginAssistMsg('');
    try {
      const result = await jdApi.extract(jdUrl.trim());
      setExtractResult(result);
      if (result.success) {
        invalidateAnalysisContext();
        // 本次提取是派生字段的唯一来源；未提取到时清空，避免残留上一岗位的数据。
        setInput((prev) => mergeJdExtractionIntoInput(prev, result));
        // 异步保存为岗位，不阻塞 UI
        handleSaveAsPosition(result);
      }
    } catch (err) {
      setExtractResult({ success: false, message: err.message || '提取失败' });
    } finally {
      setExtracting(false);
    }
  };

  // 把当前输入或提取结果保存为岗位
  const handleSaveAsPosition = async (extractedData) => {
    const payload = buildPositionPayload({
      input,
      extractedData,
      jdUrl,
      sourceSite: detectSite(jdUrl),
    });
    try {
      const created = await positionsApi.create(payload);
      const newId = created.id;
      setBoundPositionId(newId);
      setBoundPositionTitle(payload.title);
    } catch (err) {
      console.error('保存岗位失败:', err);
    }
  };

  // 辅助登录
  const handleLoginAssist = async () => {
    try {
      const res = await jdApi.loginAssist(detectSite(jdUrl));
      setLoginAssistMsg(res.message || '浏览器已打开');
    } catch (err) {
      setLoginAssistMsg(`登录辅助失败：${err.message}`);
    }
  };

  // 派生状态：输入是否完全是示例数据
  const inputIsExample =
    isExactExampleInput(input, exampleInput);

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
  const inputMatchesAnalyzed = isAnalysisCurrent(input, analyzedInput);
  const analysisIsCurrent = canUseAnalysis(analysis, input, analyzedInput);

  // 登录用户变化后加载对应简历列表与用户级本地草稿
  useEffect(() => {
    if (!currentUser?.id) {
      setResumeListLoaded(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await resumes.refresh();
        if (cancelled) return;
        setResumeListLoaded(true);
        const draft = resumes.readLocalDraft();
        const restoredId = resumes.readActiveId() || draft?.id || '';
        if (restoredId) {
          try {
            const remote = await resumes.loadResume(restoredId);
            if (!cancelled && remote) {
              const restored = resumeRecordToEditorState(remote);
              setInput(restored.input);
              setResumeTitle(restored.title);
              setBoundPositionId(restored.positionId);
              setBoundPositionTitle(restored.positionTitle);
            }
          } catch {
            // 服务端恢复失败，回退到本地草稿
            if (!cancelled && draft?.input) {
              setInput(draft.input);
              setResumeTitle(draft.name || '');
              setBoundPositionId(draft.positionId || '');
              setBoundPositionTitle(draft.positionId ? draft.input.targetRole || '当前岗位' : '');
            }
          }
        } else {
          // 无 activeId 但有当前用户的本地草稿
          if (!cancelled && draft?.input) {
            setInput(draft.input);
            setResumeTitle(draft.name || '');
            setBoundPositionId(draft.positionId || '');
            setBoundPositionTitle(draft.positionId ? draft.input.targetRole || '当前岗位' : '');
          }
        }
      } catch {
        // 未登录或后端不可达，尝试本地草稿
        const draft = resumes.readLocalDraft();
        if (!cancelled && draft?.input) {
          setInput(draft.input);
          setResumeTitle(draft.name || '');
          setBoundPositionId(draft.positionId || '');
          setBoundPositionTitle(draft.positionId ? draft.input.targetRole || '当前岗位' : '');
        }
        setResumeListLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 数据访问函数由 userId 派生；只在登录用户变化时恢复
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // 监听登出事件（来自 AuthGate）
  useEffect(() => {
    const onLogout = () => {
      resumes.clearLocal();
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
      setResumeTitle('');
      setResumeListLoaded(false);
      reset();
      setAnalyzedInput(null);
      clearCurrentAnswers();
      setAnalysisStarted(false);
      setActiveStep(0);
    };
    window.addEventListener('resume:logout', onLogout);
    return () => window.removeEventListener('resume:logout', onLogout);
  }, [clearCurrentAnswers, reset, resumes.clearLocal]);

  // input 变化时自动保存到当前简历（防抖在 hook 内）
  useEffect(() => {
    if (!shouldAutoSaveDraft(input, exampleInput, resumeListLoaded)) return;
    const targetRole = input.targetRole || '未命名目标';
    const name = resumeTitle || targetRole;
    resumes.scheduleAutoSave({
      id: resumes.activeId || '',
      name,
      content: input.resume,
      targetRole,
      input,
      positionId: boundPositionId || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, resumeTitle, boundPositionId]);

  const handleUseExample = () => {
    if (analysisStarted) {
      const ok = window.confirm(
        '使用示例数据会覆盖当前输入与已生成的分析结果，后续步骤的回答也会被清空。确定继续吗？',
      );
      if (!ok) return;
    }
    resumes.beginEditingSession();
    invalidateAnalysisContext();
    setInput(exampleInput);
    setActiveStep(0);
    setVariant('balanced');
    setCopied(false);
    setDialogOpen(false);
    setBoundPositionId('');
    setBoundPositionTitle('');
    // 旧草稿后台落盘，但迟到请求不能重新激活当前简历
    resumes.setActiveId('');
    setResumeTitle('');
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
        ? '清空表单会同时清除当前分析结果和临时追问回答，但不会删除长期追问记忆。确定继续吗？'
        : '确定清空所有输入框？',
    );
    if (!ok) return;
    resumes.beginEditingSession();
    invalidateAnalysisContext();
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
    setResumeTitle('');
    // 切换为空草稿，让自动保存创建一条新简历
    resumes.setActiveId('');
  };

  const handleSelectResume = async (id) => {
    resumes.beginEditingSession();
    if (!id) {
      // 新建空草稿
      setResumeTitle('');
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
      resumes.setActiveId('');
      setBoundPositionId('');
      setBoundPositionTitle('');
      invalidateAnalysisContext();
      setActiveStep(0);
      return;
    }
    try {
      const remote = await resumes.loadResume(id);
      if (remote) {
        const restored = resumeRecordToEditorState(remote);
        setInput(restored.input);
        setResumeTitle(restored.title);
        setBoundPositionId(restored.positionId);
        setBoundPositionTitle(restored.positionTitle);
        invalidateAnalysisContext();
        setActiveStep(0);
      }
    } catch (err) {
      alert(err.message || '加载简历失败');
    }
  };

  const handleRenameResume = (name) => {
    setResumeTitle(name);
  };

  const handleDeleteResume = async (id) => {
    if (!id) return;
    const ok = window.confirm('确认删除该简历？此操作不可恢复。');
    if (!ok) return;
    try {
      const deletingActiveResume = resumes.activeId === id;
      if (deletingActiveResume) await resumes.beginEditingSession();
      await resumes.removeResume(id);
      if (deletingActiveResume) {
        setResumeTitle('');
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
        setBoundPositionId('');
        setBoundPositionTitle('');
        invalidateAnalysisContext();
        setActiveStep(0);
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
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
    if (loading || preparingAnalysis) return;
    if (!input.resume.trim() && !input.jd.trim()) {
      alert('请至少填写"目标岗位JD"或"原始简历"后再开始分析');
      return;
    }
    reset();
    setAnalyzedInput(null);
    setAnalysisStarted(true);
    setActiveStep(1);
    setRewriteOverride(null);
    setPreparingAnalysis(true);
    setTranslationWarning('');
    let analysisInput = input;
    try {
      if (needsBilingualTranslation(input.targetRole, input.jd)) {
        try {
          const translation = await jdApi.translate({
            title: input.targetRole,
            jdContent: input.jd,
          });
          analysisInput = mergeBilingualTranslationIntoInput(input, translation);
          setInput(analysisInput);
          if (needsBilingualTranslation(analysisInput.targetRole, analysisInput.jd)) {
            setTranslationWarning(
              `中英双语转换未完成：${translation.reason || '模型未返回有效中文译文'}`,
            );
          }
        } catch (error) {
          setTranslationWarning(`中英双语转换失败：${error.message || '未知错误'}`);
        }
      }
      const answerContextChanged = ensureAnswerContext(
        createAnalysisContextKey(
          analysisInput,
          resumes.activeId || '',
          boundPositionId || '',
        ),
      );
      const result = await analyze(
        analysisInput,
        answerContextChanged ? {} : answers,
      );
      if (result) {
        setAnalyzedInput({ ...analysisInput });
      }
    } finally {
      setPreparingAnalysis(false);
    }
  };

  // 追问 AI 生成专业 bullet
  const handleGenerateBullet = async (askItem) => {
    if (!analysisIsCurrent) {
      setBulletError('当前输入已变化，请先重新解析后再生成追问表达。');
      return;
    }
    const userAnswer = answers[askItem.id] || '';
    if (!userAnswer.trim()) {
      setBulletError(`请先填写【${askItem.title}】的回答`);
      return;
    }
    setBulletLoadingId(askItem.id);
    setBulletError('');
    try {
      const bullet = await generateFollowUpBullet(input, askItem, userAnswer);
      saveBullet(askItem, bullet);
    } catch (err) {
      setBulletError(err?.message || 'Bullet 生成失败');
    } finally {
      setBulletLoadingId(null);
    }
  };

  // 手动保存追问回答到记忆库
  const handleSaveMemory = (askItem) => {
    const ok = saveToMemory(askItem);
    if (ok) {
      setSavedTip(`【${askItem.title}】已保存到记忆`);
      setTimeout(() => setSavedTip(''), 2000);
    }
  };

  // 优化风格切换：仅在 minimax 引擎下重新生成
  const handleVariantChange = async (nextVariant) => {
    setVariant(nextVariant);
    if (!analysisIsCurrent) {
      setRewriteOverride(null);
      setRewriteError('当前输入已变化，请先重新解析后再切换优化风格。');
      return;
    }
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
    if (!analysisIsCurrent) {
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
    if (!analysisIsCurrent && !analysisStarted) return STEP_STATUS.PENDING;
    if (!analysisIsCurrent) return STEP_STATUS.DISABLED;
    if (index < activeStep) return STEP_STATUS.COMPLETED;
    if (index === activeStep) return STEP_STATUS.ACTIVE;
    return STEP_STATUS.PENDING;
  };

  const canNavigateTo = (index) => {
    if (index === 0) return true;
    return analysisIsCurrent;
  };

  const handleStepNav = (index) => {
    if (!canNavigateTo(index)) return;
    setActiveStep(index);
  };

  const renderStepContent = () => {
    if (!analysisStarted && activeStep !== 0) {
      return <EmptyState title="请先开始分析" description="先填写信息或使用示例数据，然后点击“岗位解析”。" />;
    }

    if ((loading || preparingAnalysis) && !analysis && activeStep !== 0) {
      return (
        <section className="panel-stack">
          <div className="card loading-state">
            <div className="loading-spinner" aria-hidden="true" />
            <h3>
              {preparingAnalysis && !loading
                ? '正在生成中英双语 JD…'
                : '正在调用 MiniMax 生成分析…'}
            </h3>
            <p className="muted">复杂简历预计需要 30–120 秒，请勿重复点击。</p>
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
          <section className="panel-stack">
            <Card title="简历库" compact>
              <div className="resume-library">
                <div className="resume-library-row">
                  <label className="field resume-library-select">
                    <span>选择已保存简历</span>
                    <select
                      value={resumes.activeId || ''}
                      onChange={(e) => handleSelectResume(e.target.value)}
                    >
                      <option value="">＋ 新建空草稿</option>
                      {resumes.list.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.targetRole || '未设目标'}
                          {r.updatedAt ? ` · ${new Date(r.updatedAt).toLocaleString('zh-CN', { hour12: false })}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field resume-library-name">
                    <span>当前简历名</span>
                    <input
                      type="text"
                      value={resumeTitle}
                      onChange={(e) => handleRenameResume(e.target.value)}
                      placeholder={input.targetRole || '留空将使用目标岗位命名'}
                      maxLength={64}
                    />
                  </label>
                  {resumes.activeId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDeleteResume(resumes.activeId)}
                      title="删除当前选中简历"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
                <div className="resume-library-meta">
                  {resumes.loading ? (
                    <span className="muted">加载中…</span>
                  ) : resumes.error ? (
                    <span className="muted" style={{ color: 'var(--text-error)' }}>
                      ⚠ {resumes.error}
                    </span>
                  ) : resumes.lastSavedAt ? (
                    <span className="muted">
                      上次自动保存：{resumes.lastSavedAt.toLocaleTimeString('zh-CN', { hour12: false })}
                    </span>
                  ) : (
                    <span className="muted">
                      {resumes.list.length
                        ? `已保存 ${resumes.list.length} 份简历 · 修改后会自动保存`
                        : '尚未保存任何简历 · 填写后会自动创建一条'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="link-btn"
                    style={{ marginLeft: 'auto' }}
                    disabled={!input.targetRole && !input.jd}
                    onClick={() => handleSaveAsPosition()}
                    title="把当前输入保存为目标岗位"
                  >
                    + 保存为岗位
                  </button>
                </div>
              </div>
            </Card>
            <section className="panel-grid input-grid">
              {/* 目标岗位卡片：URL 提取 + 绑定提示 */}
              <div className="card position-input-card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-title">🎯 目标岗位</div>
                {boundPositionId ? (
                  <div className="bound-position-row">
                    <div className="bound-info">
                      <span className="bound-label">已绑定：</span>
                      <strong>{boundPositionTitle || '当前岗位'}</strong>
                      <span className="muted" style={{ marginLeft: 8 }}>本份简历将自动关联到该岗位</span>
                    </div>
                    <button className="link-btn" onClick={handleUnbindPosition}>解除绑定</button>
                  </div>
                ) : (
                  <>
                    <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                      粘贴招聘链接，自动提取 JD 并保存为岗位。也可手动填写下方表单后点「保存为岗位」。
                    </p>
                    <div className="jd-extract-row">
                      <input
                        type="url"
                        className="jd-url-input"
                        placeholder="粘贴 Boss直聘 / 拉勾 / 猎聘 等招聘链接"
                        value={jdUrl}
                        onChange={(e) => { setJdUrl(e.target.value); setExtractResult(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleExtractJd(); }}
                      />
                      <button
                        className="primary-button small"
                        onClick={handleExtractJd}
                        disabled={extracting || !jdUrl.trim()}
                      >
                        {extracting ? '⏳ 提取中…' : '提取 JD'}
                      </button>
                    </div>
                    {extractResult && !extractResult.success && (
                      <div className="jd-extract-fail">
                        <span>{extractResult.message}</span>
                        <button className="link-btn" onClick={handleLoginAssist}>
                          需要登录？点击辅助登录
                        </button>
                      </div>
                    )}
                    {extractResult && extractResult.success && (
                      <div className="jd-extract-success">✅ 已提取并保存为岗位，下方表单已自动填充</div>
                    )}
                    {loginAssistMsg && (
                      <div className="jd-extract-fail" style={{ color: 'var(--text-secondary)' }}>
                        {loginAssistMsg}
                      </div>
                    )}
                  </>
                )}
              </div>

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
          </section>
        );
      case 1:
        return (
          <section className="panel-stack">
            <HeaderBlock title="JD解析" subtitle="基于目标岗位输出职责、要求、关键词与理想候选人画像。" />
            <DataTable
              wideFirstCol
              columns={['分析维度', '解析结果']}
              rows={analysis.jdAnalysis.map((item) => [
                <strong key="dim">{item.item}</strong>,
                <span key="detail" className="jd-detail">{formatJdDetail(item.detail)}</span>,
              ])}
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
                {[...analysis.diagnosis.dimensions].sort((a, b) => a.score - b.score).map((item) => (
                  <div className="score-item" key={item.name}>
                    <div className="score-head">
                      <span>{item.name}</span>
                      <strong className={item.score < 70 ? 'score-low' : item.score < 80 ? 'score-mid' : 'score-high'}>{item.score}</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${item.score < 70 ? 'fill-low' : item.score < 80 ? 'fill-mid' : 'fill-high'}`}
                        style={{ width: `${item.score}%` }}
                      />
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
            <HeaderBlock
              title="经历追问"
              subtitle="这些问题决定你能否把经历改成可信的能力证据。点击「保存记忆」后，切换 JD 无需重复填写。"
              right={memoryCount > 0 ? (
                <span className="status-hint" style={{ alignSelf: 'center' }}>
                  📝 已记忆 {memoryCount} 条回答
                </span>
              ) : null}
            />
            {bulletError ? (
              <div className="card error-state" style={{ minHeight: 'auto', padding: 14 }}>
                <p style={{ margin: 0 }}>{bulletError}</p>
              </div>
            ) : null}
            {savedTip ? (
              <div className="note-card" style={{ padding: '10px 14px' }}>✅ {savedTip}</div>
            ) : null}
            <div className="note-card" style={{ padding: '10px 14px', fontSize: 12 }}>
              💡 填写回答后点击顶部「重新解析」按钮，即可将补充信息融入最终简历优化结果。
            </div>
            <div className="ask-grid">
              {analysis.askItems.map((item) => {
                const aiBullet = followUpBullets[item.id];
                const isLoadingBullet = bulletLoadingId === item.id;
                const isNew = newItemIds.has(item.id);
                const hasAnswer = (answers[item.id] || '').trim();
                const remembered = isInMemory(item);
                return (
                  <Card key={item.id} title={item.title} compact>
                    <div className="ask-item-header">
                      <p className="muted">{item.question}</p>
                      {isNew ? (
                        <span className="badge badge-new">新增追问</span>
                      ) : remembered ? (
                        <span className="badge badge-remembered">已记忆</span>
                      ) : null}
                    </div>
                    <TextArea
                      label="你的补充回答"
                      value={answers[item.id] || ''}
                      onChange={(value) => setAnswer(item, value)}
                      placeholder="请输入真实补充信息"
                      rows={4}
                    />
                    <div className="followup-actions">
                      <button
                        type="button"
                        className="followup-action-btn primary"
                        onClick={() => handleGenerateBullet(item)}
                        disabled={isLoadingBullet || !hasAnswer}
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
                      <button
                        type="button"
                        className="followup-action-btn"
                        onClick={() => handleSaveMemory(item)}
                        disabled={!hasAnswer}
                        title="保存回答到记忆，下次分析新 JD 时自动预填"
                      >
                        {remembered ? '更新记忆' : '保存记忆'}
                      </button>
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
                  ? '当前结果为本地 Mock 兜底输出，配置服务端 .env 中的 MINIMAX_API_KEY 后将自动调用 MiniMax-M3。'
                  : '等待生成结果后可在此查看修改对照。'}
            </div>
            {rewriteError ? (
              <div className="card error-state" style={{ minHeight: 'auto', padding: 14 }}>
                <p style={{ margin: 0 }}>{rewriteError}</p>
              </div>
            ) : null}
            <DataTable
              tableClass="rewrite-table"
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
                <QuestionList items={analysis.interviewPrep.questions} />
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
    <AuthGate>
      <div className="app-shell">
        {adminView ? (
          <AdminPanel
            currentUser={currentUser}
            onBack={() => setAdminView(false)}
          />
        ) : positionView ? (
          <div className="position-view-wrapper">
            <PositionPanel
              onApplyPosition={handleApplyPosition}
              onBack={() => setPositionView(false)}
              onOpenResume={async (resumeId) => {
                try {
                  resumes.beginEditingSession();
                  const remote = await resumes.loadResume(resumeId);
                  if (remote) {
                    setInput(remote.input || {
                      targetRole: remote.targetRole || '',
                      targetIndustry: '',
                      targetCompanyType: '',
                      jobStage: '',
                      highlightSkills: '',
                      jd: '',
                      resume: remote.content || '',
                      extras: '',
                    });
                    setResumeTitle(remote.name || '');
                    setBoundPositionId(remote.positionId || '');
                    if (remote.positionId) {
                      try {
                        const pos = await positionsApi.get(remote.positionId);
                        setBoundPositionTitle(pos.title || '');
                      } catch { /* ignore */ }
                    }
                    invalidateAnalysisContext();
                    setPositionView(false);
                    setActiveStep(0);
                  }
                } catch (err) {
                  alert(err.message || '加载简历失败');
                }
              }}
              currentUser={currentUser}
            />
          </div>
        ) : (
          <>
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
          <button className="secondary-button small" onClick={handleUseExample} disabled={loading}>使用示例数据</button>
          <button className="secondary-button small" onClick={handleClearInput} disabled={loading}>清空表单</button>
          <button
            className={`secondary-button small ${positionView ? 'active' : ''}`}
            onClick={() => { setPositionView((v) => !v); setAdminView(false); }}
            title="目标岗位管理"
          >
            <Target size={12} /> {positionView ? '返回' : '岗位'}
          </button>
          {currentUser && currentUser.role === 'admin' ? (
            <button
              className={`secondary-button small ${adminView ? 'active' : ''}`}
              onClick={() => setAdminView((v) => !v)}
              title={adminView ? '返回工作区' : '进入管理后台'}
            >
              <Shield size={12} /> {adminView ? '返回' : '管理'}
            </button>
          ) : null}
        </div>
        <div className="topbar-main-action">
          <button className="primary-button" onClick={handleAnalyze} disabled={loading || preparingAnalysis}>
            {loading || preparingAnalysis ? '解析中…' : activeStep === 0 ? '岗位解析' : '重新解析'}
          </button>
          {activeStep !== 0 && analysisStarted ? (
            <span className="main-action-hint">更新输入或追问回答后，点击重新解析刷新全部结果</span>
          ) : null}
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
              <div><span>引擎</span><strong>{engineLabel(engine)}</strong></div>
              <div><span>方向</span><strong>{input.targetRole || '待填写'}</strong></div>
              <div>
                <span>数据</span>
                <strong>
                  {inputIsExample
                    ? '示例'
                    : inputHasContent
                    ? '真实'
                    : '未填写'}
                </strong>
              </div>
              {analysisStarted ? (
                <div>
                  <span>分析</span>
                  <strong>{inputMatchesAnalyzed ? '已同步' : '需重新生成'}</strong>
                </div>
              ) : null}
              {engine === 'mock' ? (
                <div><span>提示</span><strong>演示 Mock（非 AI）</strong></div>
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
              {analysisIsCurrent ? (
                <>
                  <span className="badge">
                    {engine === 'mock' ? '示例演示结果（非 AI 分析）' : analysis.summary.generatedAt}
                  </span>
                  <span className="badge subtle">Fit Score {analysis.summary.fitScore}</span>
                </>
              ) : loading || preparingAnalysis ? (
                <span className="badge subtle">正在调用 MiniMax…</span>
              ) : analysisStarted ? (
                <span className="badge subtle">
                  {analysis ? '输入已变化，需重新生成' : '本次未生成结果'}
                </span>
              ) : (
                <span className="badge subtle">待生成</span>
              )}
            </div>
          </section>

          {translationWarning ? (
            <div className="note-card" style={{ marginBottom: 12 }}>
              ⚠️ {translationWarning}；已保留原始 JD 并继续分析。
            </div>
          ) : null}

          {renderStepContent()}
      </main>
    </div>
          </>
        )}
      </div>
    </AuthGate>
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

/**
 * 将 JD 解析结果拆分为多行显示，突出重点
 */
function formatJdDetail(text) {
  if (!text) return text;
  // 按“；”“、”“\n”拆分，每项单独一行
  const parts = text.split(/[；;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return text;
  return (
    <span className="jd-detail-lines">
      {parts.map((p, i) => <span key={i} className="jd-detail-line">{p}</span>)}
    </span>
  );
}

function DataTable({ columns, rows, wideFirstCol, tableClass }) {
  const cls = [tableClass, wideFirstCol ? 'wide-first-col' : ''].filter(Boolean).join(' ');
  return (
    <div className="table-wrap card">
      <table className={cls || undefined}>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className={cellIndex === 0 && wideFirstCol ? 'dim-cell' : 'detail-cell'}>
                  {cell}
                </td>
              ))}
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
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return <p className="muted">暂无内容</p>;
  return (
    <ul className="bullet-list">
      {list.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

const SUPPORT_CLASS = { '强': 'support-strong', '中': 'support-mid', '弱': 'support-weak', '无': 'support-none' };
function QuestionList({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return <p className="muted">暂无内容</p>;
  return (
    <ul className="bullet-list question-list">
      {list.map((item, i) => {
        const q = typeof item === 'string' ? item : item.q;
        const support = typeof item === 'string' ? '' : item.support;
        return (
          <li key={i} className="question-item">
            <span>{q}</span>
            {support && <em className={`support-badge ${SUPPORT_CLASS[support] || ''}`}>{support}</em>}
          </li>
        );
      })}
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
  }[variant];
}

function engineLabel(engine) {
  if (engine === 'minimax-m3') return 'MiniMax-M3';
  if (engine === 'mock') return '本地 Mock';
  return '未启动';
}

function variantTransform(text, variant) {
  if (variant === 'concise') return text.replace('围绕', '').replace('开展', '').replace('相关', '');
  if (variant === 'conservative') return text.replace('推动', '参与推动').replace('完善', '支持完善');
  if (variant === 'ai') return text.includes('AI') ? text : `${text} [可进一步补充AI视角]`;
  return text;
}

function detectSite(url) {
  if (!url) return '';
  if (/zhipin\.com/i.test(url)) return 'boss';
  if (/lagou\.com/i.test(url)) return 'lagou';
  if (/liepin\.com/i.test(url)) return 'liepin';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/51job\.com/i.test(url)) return '51job';
  if (/zhaopin\.com/i.test(url)) return 'zhaopin';
  return 'other';
}

export default App;
