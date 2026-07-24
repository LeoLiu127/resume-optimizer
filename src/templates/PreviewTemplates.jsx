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
  overflow: 'hidden',
  position: 'relative',
};

const serifStyle = {
  fontFamily: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif',
};

/* ============================================================
 * 1. Classic 经典单栏
 * ============================================================ */
export function ClassicPreview({ view, role }) {
  if (!view) return null;
  return (
    <div className="tpl-classic" style={{ ...baseStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...serifStyle, fontSize: 22, fontWeight: 600, letterSpacing: '0.04em' }}>{view.name}</div>
        <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.12em', marginTop: 4 }}>
          {(role || '').toUpperCase()}
        </div>
      </div>
      <hr style={{ border: 0, borderTop: '2px solid #111827', margin: '10px 0 12px' }} />

      {view.jobIntention ? (
        <Section title="求职意向">
          <p style={paragraph}>{view.jobIntention}</p>
        </Section>
      ) : null}

      {view.summary ? (
        <Section title="职业摘要">
          <p style={paragraph}>{view.summary}</p>
        </Section>
      ) : null}

      {view.skills.length ? (
        <Section title="核心能力">
          <p style={paragraph}>{view.skills.join(' · ')}</p>
        </Section>
      ) : null}

      {view.tools.length ? (
        <Section title="技能工具">
          <p style={paragraph}>{view.tools.join(' · ')}</p>
        </Section>
      ) : null}

      {view.experience.length ? (
        <Section title="工作经历">
          {view.experience.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11 }}>
                <strong style={{ color: '#111827' }}>
                  {item.company} · {item.title}
                </strong>
                <span style={{ color: '#6b7280', fontSize: 10 }}>{item.period}</span>
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, listStyle: 'none' }}>
                {item.bullets.map((b, i) => (
                  <li key={i} style={{ ...bulletLi, position: 'relative', paddingLeft: 10 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#6b7280' }}>•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {view.projects.length ? (
        <Section title="项目经历">
          {view.projects.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#111827', fontWeight: 600 }}>
                {item.name}
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, listStyle: 'none' }}>
                {item.bullets.map((b, i) => (
                  <li key={i} style={{ ...bulletLi, position: 'relative', paddingLeft: 10 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#6b7280' }}>•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {view.education ? (
        <Section title="教育背景">
          <p style={paragraph}>{view.education}</p>
        </Section>
      ) : null}

      {view.extras.length ? (
        <Section title="其他加分项">
          <p style={paragraph}>{view.extras.join('、')}</p>
        </Section>
      ) : null}
    </div>
  );
}

/* ============================================================
 * 2. Modern 左侧栏双栏
 * ============================================================ */
export function ModernPreview({ view, role, accent = '#2563eb' }) {
  if (!view) return null;
  return (
    <div
      className="tpl-modern"
      style={{
        ...baseStyle,
        padding: 0,
        display: 'flex',
      }}
    >
      {/* 左侧深色栏 */}
      <div
        style={{
          width: '34%',
          background: '#111827',
          color: '#f3f4f6',
          padding: '22px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
          {view.name}
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{role || ''}</div>

        <LH accent={accent}>联系</LH>
        {view.email ? <LItem label="📧" value={view.email} /> : null}
        {view.phone ? <LItem label="📱" value={view.phone} /> : null}
        {view.location ? <LItem label="📍" value={view.location} /> : null}

        {view.skills.length ? (
          <>
            <LH accent={accent}>核心能力</LH>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {view.skills.slice(0, 10).map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 9,
                    background: '#1f2937',
                    color: '#e5e7eb',
                    borderRadius: 3,
                    padding: '2px 6px',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {view.tools.length ? (
          <>
            <LH accent={accent}>技能工具</LH>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {view.tools.slice(0, 8).map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 9,
                    background: '#1f2937',
                    color: '#e5e7eb',
                    borderRadius: 3,
                    padding: '2px 6px',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {view.education ? (
          <>
            <LH accent={accent}>教育</LH>
            <div style={{ fontSize: 10, color: '#e5e7eb', lineHeight: 1.5 }}>{view.education}</div>
          </>
        ) : null}
      </div>

      {/* 右侧内容栏 */}
      <div style={{ flex: 1, padding: '22px 18px', background: '#ffffff', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{view.name}</div>
        <div style={{ fontSize: 10, color: accent, fontWeight: 600, marginBottom: 10 }}>
          {role ? `${role} · 优化版简历` : '优化版简历'}
        </div>

        {view.summary ? (
          <>
            <RH accent={accent}>个人简介</RH>
            <p style={{ ...paragraph, fontSize: 10 }}>{view.summary}</p>
          </>
        ) : null}

        {view.jobIntention ? (
          <>
            <RH accent={accent}>求职意向</RH>
            <p style={{ ...paragraph, fontSize: 10 }}>{view.jobIntention}</p>
          </>
        ) : null}

        {view.experience.length ? (
          <>
            <RH accent={accent}>工作经历</RH>
            {view.experience.map((item, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 8,
                  paddingBottom: 4,
                  borderBottom: '1px dashed #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 11, color: '#111827' }}>
                    {item.company} · {item.title}
                  </strong>
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{item.period}</span>
                </div>
                <ul style={{ margin: '3px 0 0', paddingLeft: 16, listStyle: 'none' }}>
                  {item.bullets.map((b, i) => (
                    <li
                      key={i}
                      style={{
                        ...bulletLi,
                        position: 'relative',
                        paddingLeft: 10,
                        fontSize: 9.5,
                      }}
                    >
                      <span style={{ position: 'absolute', left: 0, color: accent }}>▸</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : null}

        {view.projects.length ? (
          <>
            <RH accent={accent}>关键项目</RH>
            {view.projects.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 11, color: '#111827' }}>{item.name}</strong>
                <ul style={{ margin: '3px 0 0', paddingLeft: 16, listStyle: 'none' }}>
                  {item.bullets.map((b, i) => (
                    <li
                      key={i}
                      style={{
                        ...bulletLi,
                        position: 'relative',
                        paddingLeft: 10,
                        fontSize: 9.5,
                      }}
                    >
                      <span style={{ position: 'absolute', left: 0, color: accent }}>▸</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : null}

        {view.extras.length ? (
          <>
            <RH accent={accent}>其他加分项</RH>
            <p style={{ ...paragraph, fontSize: 10 }}>{view.extras.join('、')}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
 * 3. Minimal 极简留白
 * ============================================================ */
export function MinimalPreview({ view, role }) {
  if (!view) return null;
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
          <MHeader>Experience</MHeader>
          {view.experience.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#111', fontWeight: 500 }}>
                {item.title} · {item.company}
              </div>
              <div style={{ fontSize: 9.5, color: '#888', marginTop: 2 }}>{item.period}</div>
              <ul style={{ margin: '5px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {item.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      ...bulletLi,
                      fontWeight: 300,
                      fontSize: 10,
                      paddingLeft: 12,
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, color: '#999' }}>—</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {view.projects.length ? (
        <>
          <MHeader>Selected Projects</MHeader>
          {view.projects.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#111', fontWeight: 500 }}>{item.name}</div>
              <ul style={{ margin: '5px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {item.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      ...bulletLi,
                      fontWeight: 300,
                      fontSize: 10,
                      paddingLeft: 12,
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, color: '#999' }}>—</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {view.skills.length ? (
        <>
          <MHeader>Skills</MHeader>
          <p style={{ ...paragraph, fontWeight: 300, fontSize: 10 }}>{view.skills.join(' · ')}</p>
        </>
      ) : null}

      {view.education ? (
        <>
          <MHeader>Education</MHeader>
          <div style={{ fontSize: 11, color: '#111', fontWeight: 500 }}>{view.education}</div>
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

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 10 }}>
      <h3
        style={{
          ...serifStyle,
          margin: 0,
          paddingBottom: 3,
          marginBottom: 6,
          fontSize: 12,
          color: '#111827',
          borderBottom: '1px solid #e5e7eb',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function LH({ accent, children }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#93c5fd',
        margin: '12px 0 6px',
        fontWeight: 600,
        borderLeft: `2px solid ${accent}`,
        paddingLeft: 6,
      }}
    >
      {children}
    </div>
  );
}

function LItem({ label, value }) {
  return (
    <div style={{ fontSize: 9.5, color: '#e5e7eb', marginBottom: 3, lineHeight: 1.45 }}>
      <span style={{ marginRight: 4 }}>{label}</span>
      {value}
    </div>
  );
}

function RH({ accent, children }) {
  return (
    <h3
      style={{
        fontSize: 10,
        color: '#111827',
        margin: '10px 0 4px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderLeft: `2px solid ${accent}`,
        paddingLeft: 6,
      }}
    >
      {children}
    </h3>
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