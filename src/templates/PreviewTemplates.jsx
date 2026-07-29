import React from 'react';

/**
 * HTML 预览三套模板。CSS 内联在每个组件内，
 * 与 .resume-preview 容器配合，达到与最终 PDF/DOCX 高度一致的视觉效果。
 */

const baseStyle = {
  fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  background: '#ffffff',
  color: '#111827',
  width: '100%',
  aspectRatio: '210 / 297',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  overflowY: 'auto',
  position: 'relative',
};

const serifStyle = {
  fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif',
};

const SECTION_LABELS = {
  zh: {
    contact: '联系方式',
    objective: '求职意向',
    profile: '职业摘要',
    skills: '核心能力',
    tools: '技能工具',
    experience: '工作经历',
    projects: '项目经历',
    education: '教育背景',
    extras: '其他信息',
  },
  en: {
    contact: 'Contact',
    objective: 'Career Objective',
    profile: 'Profile',
    skills: 'Core Skills',
    tools: 'Tools',
    experience: 'Experience',
    projects: 'Selected Projects',
    education: 'Education',
    extras: 'Additional Information',
  },
};

function labelsFor(language) {
  return SECTION_LABELS[language === 'en' ? 'en' : 'zh'];
}

/* ============================================================
 * 1. Classic → Editorial Signal 编辑出版型
 * ============================================================ */
export function ClassicPreview({ view, role, language = 'zh' }) {
  if (!view) return null;
  const labels = labelsFor(language);
  const contacts = [view.phone, view.email, view.location].filter(Boolean);

  return (
    <div
      className="tpl-editorial"
      style={{
        ...baseStyle,
        ...serifStyle,
        padding: '26px 28px 22px',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 18,
          paddingBottom: 14,
          borderBottom: '1px solid #1c2534',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: '#141b27',
              fontSize: 27,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              overflowWrap: 'anywhere',
            }}
          >
            {view.name}
          </div>
          <div
            style={{
              marginTop: 7,
              color: '#9B4F36',
              fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.14em',
              lineHeight: 1.35,
              textTransform: 'uppercase',
            }}
          >
            {role || view.headline || ''}
          </div>
        </div>
        {contacts.length ? (
          <div
            aria-label={labels.contact}
            style={{
              flexShrink: 0,
              maxWidth: '42%',
              textAlign: 'right',
              color: '#606a79',
              fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
              fontSize: 7.5,
              lineHeight: 1.65,
              overflowWrap: 'anywhere',
            }}
          >
            {contacts.map((contact) => <div key={contact}>{contact}</div>)}
          </div>
        ) : null}
      </header>

      {view.summary ? (
        <EditorialSection label={labels.profile} lead>
          <p style={editorialParagraph}>{view.summary}</p>
        </EditorialSection>
      ) : null}

      {view.jobIntention ? (
        <EditorialSection label={labels.objective}>
          <p style={editorialParagraph}>{view.jobIntention}</p>
        </EditorialSection>
      ) : null}

      {view.experience.length ? (
        <EditorialSection label={labels.experience}>
          {view.experience.map((item, idx) => (
            <EditorialItem
              key={idx}
              title={item.title}
              meta={item.period}
              organization={item.company}
              bullets={item.bullets}
            />
          ))}
        </EditorialSection>
      ) : null}

      {view.projects.length ? (
        <EditorialSection label={labels.projects}>
          {view.projects.map((item, idx) => (
            <EditorialItem
              key={idx}
              title={item.name}
              meta={item.period}
              bullets={item.bullets}
            />
          ))}
        </EditorialSection>
      ) : null}

      {view.skills.length ? (
        <EditorialSection label={labels.skills}>
          <EditorialTags values={view.skills} />
        </EditorialSection>
      ) : null}

      {view.tools.length ? (
        <EditorialSection label={labels.tools}>
          <EditorialTags values={view.tools} />
        </EditorialSection>
      ) : null}

      {view.education ? (
        <EditorialSection label={labels.education}>
          <p style={editorialParagraph}>{view.education}</p>
        </EditorialSection>
      ) : null}

      {view.extras.length ? (
        <EditorialSection label={labels.extras}>
          <p style={editorialParagraph}>{view.extras.join(language === 'en' ? ' · ' : '、')}</p>
        </EditorialSection>
      ) : null}
    </div>
  );
}

/* ============================================================
 * 2. Modern → Precision Grid 精准网格型
 * ============================================================ */
export function ModernPreview({ view, role, accent, language = 'zh' }) {
  if (!view) return null;
  const labels = labelsFor(language);
  const precisionAccent = '#32B7A4';
  const monogram = String(view.name || 'CV').replace(/\s/g, '').slice(0, 2).toUpperCase();
  const contacts = [view.phone, view.email, view.location].filter(Boolean);
  void accent;

  return (
    <div
      className="tpl-precision-grid"
      style={{
        ...baseStyle,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: '31% 69%',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      }}
    >
      <aside
        style={{
          minWidth: 0,
          background: '#11233F',
          color: '#ffffff',
          padding: '25px 15px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid rgba(255,255,255,0.38)',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            marginBottom: 18,
          }}
        >
          {monogram}
        </div>

        {contacts.length ? (
          <>
            <RailHeading>{labels.contact}</RailHeading>
            {contacts.map((value) => (
              <div
                key={value}
                style={{
                  marginBottom: 4,
                  color: '#d6dfeb',
                  fontSize: 7.5,
                  lineHeight: 1.5,
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </div>
            ))}
          </>
        ) : null}

        {view.skills.length ? (
          <>
            <RailHeading>{labels.skills}</RailHeading>
            <RailChips values={view.skills} accent={precisionAccent} />
          </>
        ) : null}

        {view.tools.length ? (
          <>
            <RailHeading>{labels.tools}</RailHeading>
            <RailChips values={view.tools} accent={precisionAccent} />
          </>
        ) : null}

        {view.education ? (
          <>
            <RailHeading>{labels.education}</RailHeading>
            <div
              style={{
                color: '#d6dfeb',
                fontSize: 7.5,
                lineHeight: 1.55,
                overflowWrap: 'anywhere',
              }}
            >
              {view.education}
            </div>
          </>
        ) : null}
      </aside>

      <main
        style={{
          minWidth: 0,
          padding: '26px 22px 20px',
          boxSizing: 'border-box',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            color: '#0f1d33',
            fontSize: 24,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
            overflowWrap: 'anywhere',
          }}
        >
          {view.name}
        </div>
        <div
          style={{
            color: '#157d75',
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.13em',
            lineHeight: 1.4,
            textTransform: 'uppercase',
            marginTop: 5,
          }}
        >
          {role || view.headline || ''}
        </div>

        {view.summary ? (
          <div
            style={{
              background: '#eff8f6',
              borderLeft: `3px solid ${precisionAccent}`,
              padding: '8px 10px',
              margin: '13px 0 12px',
              fontSize: 8,
              lineHeight: 1.55,
              color: '#344258',
              overflowWrap: 'anywhere',
            }}
          >
            {view.summary}
          </div>
        ) : null}

        {view.jobIntention ? (
          <>
            <PrecisionHeading>{labels.objective}</PrecisionHeading>
            <p style={precisionParagraph}>{view.jobIntention}</p>
          </>
        ) : null}

        {view.experience.length ? (
          <>
            <PrecisionHeading>{labels.experience}</PrecisionHeading>
            {view.experience.map((item, idx) => (
              <PrecisionItem
                key={idx}
                title={item.title}
                period={item.period}
                organization={item.company}
                bullets={item.bullets}
                accent={precisionAccent}
              />
            ))}
          </>
        ) : null}

        {view.projects.length ? (
          <>
            <PrecisionHeading>{labels.projects}</PrecisionHeading>
            {view.projects.map((item, idx) => (
              <PrecisionItem
                key={idx}
                title={item.name}
                period={item.period}
                bullets={item.bullets}
                accent={precisionAccent}
              />
            ))}
          </>
        ) : null}

        {view.extras.length ? (
          <>
            <PrecisionHeading>{labels.extras}</PrecisionHeading>
            <p style={precisionParagraph}>{view.extras.join(language === 'en' ? ' · ' : '、')}</p>
          </>
        ) : null}
      </main>
    </div>
  );
}

/* ============================================================
 * 3. Minimal 极简留白（保留原布局，仅本地化章节标题）
 * ============================================================ */
export function MinimalPreview({ view, role, language = 'zh' }) {
  if (!view) return null;
  const labels = labelsFor(language);

  return (
    <div
      className="tpl-minimal"
      style={{
        ...baseStyle,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 300, color: '#111111', letterSpacing: '-0.01em' }}>
        {view.name}
      </div>
      <div style={{ fontSize: 10, color: '#888888', marginTop: 6, letterSpacing: '0.04em' }}>
        {[role, view.location].filter(Boolean).join(' · ')}
      </div>

      {view.summary ? (
        <p style={{ ...paragraph, marginTop: 18, fontSize: 11, lineHeight: 1.75, fontWeight: 300 }}>
          {view.summary}
        </p>
      ) : null}

      {view.experience.length ? (
        <>
          <MHeader>{labels.experience}</MHeader>
          {view.experience.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#111', fontWeight: 500 }}>
                {item.title} · {item.company}
              </div>
              <div style={{ fontSize: 9.5, color: '#888', marginTop: 2 }}>{item.period}</div>
              <ul style={{ margin: '5px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {item.bullets.map((bullet, index) => (
                  <li
                    key={index}
                    style={{
                      ...bulletLi,
                      fontWeight: 300,
                      fontSize: 10,
                      paddingLeft: 12,
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, color: '#999' }}>—</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {view.projects.length ? (
        <>
          <MHeader>{labels.projects}</MHeader>
          {view.projects.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#111', fontWeight: 500 }}>{item.name}</div>
              {item.period ? (
                <div style={{ fontSize: 9.5, color: '#888', marginTop: 2 }}>{item.period}</div>
              ) : null}
              <ul style={{ margin: '5px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {item.bullets.map((bullet, index) => (
                  <li
                    key={index}
                    style={{
                      ...bulletLi,
                      fontWeight: 300,
                      fontSize: 10,
                      paddingLeft: 12,
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, color: '#999' }}>—</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {view.skills.length ? (
        <>
          <MHeader>{labels.skills}</MHeader>
          <p style={{ ...paragraph, fontWeight: 300, fontSize: 10 }}>{view.skills.join(' · ')}</p>
        </>
      ) : null}

      {view.tools.length ? (
        <>
          <MHeader>{labels.tools}</MHeader>
          <p style={{ ...paragraph, fontWeight: 300, fontSize: 10 }}>{view.tools.join(' · ')}</p>
        </>
      ) : null}

      {view.education ? (
        <>
          <MHeader>{labels.education}</MHeader>
          <div style={{ fontSize: 11, color: '#111', fontWeight: 500 }}>{view.education}</div>
        </>
      ) : null}

      {view.extras.length ? (
        <>
          <MHeader>{labels.extras}</MHeader>
          <p style={{ ...paragraph, fontWeight: 300, fontSize: 10 }}>
            {view.extras.join(language === 'en' ? ' · ' : '、')}
          </p>
        </>
      ) : null}
    </div>
  );
}

/* ============ 通用内部小组件 ============ */
const paragraph = {
  margin: 0,
  fontSize: 10.5,
  color: '#374151',
  lineHeight: 1.55,
};

const bulletLi = {
  lineHeight: 1.5,
  marginBottom: 3,
  color: '#374151',
};

const editorialParagraph = {
  margin: 0,
  color: '#323946',
  fontSize: 8,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
};

const precisionParagraph = {
  margin: '0 0 8px',
  color: '#45536a',
  fontSize: 7.5,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
};

function EditorialSection({ label, lead = false, children }) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '24% minmax(0, 1fr)',
        gap: 12,
        padding: lead ? '14px 0 11px' : '11px 0 0',
        borderBottom: lead ? '1px solid #d8d5cf' : 0,
      }}
    >
      <h3
        style={{
          margin: 0,
          color: lead ? '#9B4F36' : '#151d2a',
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: lead ? 7.5 : 8,
          fontWeight: 800,
          letterSpacing: '0.1em',
          lineHeight: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </h3>
      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}

function EditorialItem({ title, meta, organization, bullets = [] }) {
  return (
    <article
      style={{
        paddingBottom: 8,
        marginBottom: 8,
        borderBottom: '1px solid #e8e5df',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <strong style={{ color: '#1c2534', fontSize: 9, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          {title}
        </strong>
        {meta ? (
          <span
            style={{
              flexShrink: 0,
              color: '#8b6455',
              fontFamily: 'Arial, sans-serif',
              fontSize: 6.5,
              lineHeight: 1.35,
            }}
          >
            {meta}
          </span>
        ) : null}
      </div>
      {organization ? (
        <div
          style={{
            margin: '3px 0 4px',
            color: '#7b8491',
            fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
            fontSize: 7,
            lineHeight: 1.35,
          }}
        >
          {organization}
        </div>
      ) : null}
      {bullets.length ? (
        <ul style={{ margin: 0, paddingLeft: 12 }}>
          {bullets.map((bullet, index) => (
            <li
              key={index}
              style={{
                marginBottom: 2,
                color: '#424b59',
                fontSize: 7.3,
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
              }}
            >
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function EditorialTags({ values }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 9px' }}>
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          style={{
            borderBottom: '2px solid #c77d62',
            padding: '1px 0',
            color: '#394150',
            fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
            fontSize: 7.2,
            lineHeight: 1.35,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function RailHeading({ children }) {
  return (
    <h3
      style={{
        margin: '16px 0 7px',
        color: '#75e6d1',
        fontSize: 7.5,
        fontWeight: 800,
        letterSpacing: '0.15em',
        lineHeight: 1.4,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </h3>
  );
}

function RailChips({ values, accent }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          style={{
            maxWidth: '100%',
            padding: '3px 5px',
            border: `1px solid ${accent}6b`,
            borderRadius: 3,
            color: '#e8f3f1',
            background: `${accent}1f`,
            fontSize: 6.8,
            lineHeight: 1.3,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function PrecisionHeading({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '11px 0 6px',
        color: '#10213c',
        fontSize: 8.5,
        fontWeight: 800,
        letterSpacing: '0.02em',
        lineHeight: 1.35,
        textTransform: 'uppercase',
      }}
    >
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: '#cfd8e4' }} />
    </div>
  );
}

function PrecisionItem({ title, period, organization, bullets = [], accent }) {
  return (
    <article style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          color: '#172033',
          fontSize: 8,
          fontWeight: 800,
          lineHeight: 1.35,
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
        {period ? <span style={{ flexShrink: 0, fontSize: 6.5 }}>{period}</span> : null}
      </div>
      {organization ? (
        <div style={{ color: '#157d75', fontWeight: 700, fontSize: 7, margin: '2px 0 4px' }}>
          {organization}
        </div>
      ) : null}
      {bullets.length ? (
        <ul style={{ margin: 0, paddingLeft: 11 }}>
          {bullets.map((bullet, index) => (
            <li
              key={index}
              style={{
                margin: '0 0 2px',
                color: accent,
                fontSize: 7,
                lineHeight: 1.42,
                overflowWrap: 'anywhere',
              }}
            >
              <span style={{ color: '#45536a' }}>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function MHeader({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        margin: '18px 0 8px',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
