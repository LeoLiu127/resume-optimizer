import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

// 中文字体：通过 jsdelivr CDN 加载思源黑体（subset OTF，支持 CJK 字符）
// 注册为全局字体，三个模板共用同一字体名以减小体积
Font.register({
  family: 'NotoSansSC',
  src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf',
  fontStyle: 'normal',
});
Font.register({
  family: 'NotoSansSC',
  src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf',
  fontStyle: 'bold',
});
Font.registerHyphenationCallback((word) => [word]);

const FONT = 'NotoSansSC';

const baseStyles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontSize: 10,
    color: '#111827',
    lineHeight: 1.5,
  },
});

/* ============================================================
 * Classic PDF
 * ============================================================ */
export function ClassicPdfDocument({ view, role }) {
  return (
    <Document>
      <Page size="A4" style={baseStyles.page} wrap>
        {/* 顶部居中姓名 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: FONT, fontWeight: 'bold' }}>{view.name}</Text>
          <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 4, letterSpacing: 1.2 }}>
            {(role || '').toUpperCase()}
          </Text>
        </View>
        <View style={{ borderBottom: '2pt solid #111827', marginVertical: 10 }} />

        {view.jobIntention ? <ClassicSection title="求职意向">
          <Text style={styles.p}>{view.jobIntention}</Text>
        </ClassicSection> : null}

        {view.summary ? <ClassicSection title="职业摘要">
          <Text style={styles.p}>{view.summary}</Text>
        </ClassicSection> : null}

        {view.skills.length ? <ClassicSection title="核心能力">
          <Text style={styles.p}>{view.skills.join(' · ')}</Text>
        </ClassicSection> : null}

        {view.tools.length ? <ClassicSection title="技能工具">
          <Text style={styles.p}>{view.tools.join(' · ')}</Text>
        </ClassicSection> : null}

        {view.experience.length ? <ClassicSection title="工作经历">
          {view.experience.map((item, idx) => (
            <View key={idx} style={{ marginBottom: 8 }} wrap={false}>
              <View style={styles.rowBetween}>
                <Text style={styles.headStrong}>{item.company} · {item.title}</Text>
                <Text style={styles.muted}>{item.period}</Text>
              </View>
              {item.bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </ClassicSection> : null}

        {view.projects.length ? <ClassicSection title="项目经历">
          {view.projects.map((item, idx) => (
            <View key={idx} style={{ marginBottom: 6 }} wrap={false}>
              <Text style={styles.headStrong}>{item.name}</Text>
              {item.bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </ClassicSection> : null}

        {view.education ? <ClassicSection title="教育背景">
          <Text style={styles.p}>{view.education}</Text>
        </ClassicSection> : null}

        {view.extras.length ? <ClassicSection title="其他加分项">
          <Text style={styles.p}>{view.extras.join('、')}</Text>
        </ClassicSection> : null}
      </Page>
    </Document>
  );
}

function ClassicSection({ title, children }) {
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <Text style={{
        fontSize: 12,
        fontWeight: 'bold',
        color: '#111827',
        borderBottom: '0.5pt solid #e5e7eb',
        paddingBottom: 2,
        marginBottom: 5,
      }}>{title}</Text>
      {children}
    </View>
  );
}

/* ============================================================
 * Modern PDF（左侧栏深色 + 右侧浅色）
 * 注意：@react-pdf/renderer 的 Page 自身是白色背景，需要用一个 flex Row 来实现左右栏
 * ============================================================ */
export function ModernPdfDocument({ view, role, accent = '#2563eb' }) {
  return (
    <Document>
      <Page size="A4" style={baseStyles.page} wrap>
        <View style={{ flexDirection: 'row', minHeight: '100%' }} wrap={false}>
          {/* 左侧深色栏 */}
          <View style={{
            width: '34%',
            backgroundColor: '#111827',
            color: '#f3f4f6',
            padding: 14,
            marginLeft: -36,
            paddingLeft: 22,
            marginRight: 12,
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ffffff' }}>{view.name}</Text>
            <Text style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>{role || ''}</Text>

            <ModernLH accent={accent}>联系</ModernLH>
            {view.email ? <ModernLItem icon="✉">{view.email}</ModernLItem> : null}
            {view.phone ? <ModernLItem icon="☎">{view.phone}</ModernLItem> : null}
            {view.location ? <ModernLItem icon="⌖">{view.location}</ModernLItem> : null}

            {view.skills.length ? (
              <>
                <ModernLH accent={accent}>核心能力</ModernLH>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {view.skills.slice(0, 10).map((s, i) => (
                    <Text key={i} style={{
                      fontSize: 8.5,
                      backgroundColor: '#1f2937',
                      color: '#e5e7eb',
                      borderRadius: 2,
                      padding: 2,
                      marginRight: 3,
                      marginBottom: 3,
                    }}>{s}</Text>
                  ))}
                </View>
              </>
            ) : null}

            {view.tools.length ? (
              <>
                <ModernLH accent={accent}>技能工具</ModernLH>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {view.tools.slice(0, 8).map((s, i) => (
                    <Text key={i} style={{
                      fontSize: 8.5,
                      backgroundColor: '#1f2937',
                      color: '#e5e7eb',
                      borderRadius: 2,
                      padding: 2,
                      marginRight: 3,
                      marginBottom: 3,
                    }}>{s}</Text>
                  ))}
                </View>
              </>
            ) : null}

            {view.education ? (
              <>
                <ModernLH accent={accent}>教育</ModernLH>
                <Text style={{ fontSize: 9, color: '#e5e7eb', lineHeight: 1.5 }}>{view.education}</Text>
              </>
            ) : null}
          </View>

          {/* 右侧浅色栏 */}
          <View style={{ flex: 1, paddingTop: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>{view.name}</Text>
            <Text style={{ fontSize: 9, color: accent, fontWeight: 'bold', marginBottom: 8 }}>
              {role ? `${role} · 优化版简历` : '优化版简历'}
            </Text>

            {view.summary ? (
              <>
                <ModernRH accent={accent}>个人简介</ModernRH>
                <Text style={styles.p}>{view.summary}</Text>
              </>
            ) : null}

            {view.jobIntention ? (
              <>
                <ModernRH accent={accent}>求职意向</ModernRH>
                <Text style={styles.p}>{view.jobIntention}</Text>
              </>
            ) : null}

            {view.experience.length ? (
              <>
                <ModernRH accent={accent}>工作经历</ModernRH>
                {view.experience.map((item, idx) => (
                  <View key={idx} style={{ marginBottom: 6, paddingBottom: 3, borderBottom: '0.5pt dashed #e5e7eb' }} wrap={false}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.headStrong}>{item.company} · {item.title}</Text>
                      <Text style={styles.muted}>{item.period}</Text>
                    </View>
                    {item.bullets.map((b, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={{ ...styles.bulletDot, color: accent }}>▸</Text>
                        <Text style={styles.bulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            ) : null}

            {view.projects.length ? (
              <>
                <ModernRH accent={accent}>关键项目</ModernRH>
                {view.projects.map((item, idx) => (
                  <View key={idx} style={{ marginBottom: 4 }} wrap={false}>
                    <Text style={styles.headStrong}>{item.name}</Text>
                    {item.bullets.map((b, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={{ ...styles.bulletDot, color: accent }}>▸</Text>
                        <Text style={styles.bulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            ) : null}

            {view.extras.length ? (
              <>
                <ModernRH accent={accent}>其他加分项</ModernRH>
                <Text style={styles.p}>{view.extras.join('、')}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

function ModernLH({ accent, children }) {
  return (
    <Text style={{
      fontSize: 9,
      color: '#93c5fd',
      marginTop: 10,
      marginBottom: 4,
      fontWeight: 'bold',
      borderLeft: `1.5pt solid ${accent}`,
      paddingLeft: 4,
    }}>{children}</Text>
  );
}

function ModernLItem({ icon, children }) {
  return (
    <Text style={{ fontSize: 8.5, color: '#e5e7eb', marginBottom: 2, lineHeight: 1.45 }}>
      {icon ? `${icon} ` : ''}{children}
    </Text>
  );
}

function ModernRH({ accent, children }) {
  return (
    <Text style={{
      fontSize: 9,
      color: '#111827',
      marginTop: 8,
      marginBottom: 3,
      fontWeight: 'bold',
      borderLeft: `1.5pt solid ${accent}`,
      paddingLeft: 4,
    }}>{children}</Text>
  );
}

/* ============================================================
 * Minimal PDF（极简留白）
 * ============================================================ */
export function MinimalPdfDocument({ view, role }) {
  return (
    <Document>
      <Page size="A4" style={{ ...baseStyles.page, paddingHorizontal: 50 }} wrap>
        <Text style={{ fontSize: 26, fontWeight: 300, color: '#111111' }}>{view.name}</Text>
        <Text style={{ fontSize: 9, color: '#888888', marginTop: 5 }}>
          {[role, view.location].filter(Boolean).join(' · ')}
        </Text>

        {view.summary ? (
          <Text style={{ ...styles.p, marginTop: 16, fontSize: 10.5, lineHeight: 1.75 }}>
            {view.summary}
          </Text>
        ) : null}

        {view.experience.length ? (
          <>
            <MinimalHeader>Experience</MinimalHeader>
            {view.experience.map((item, idx) => (
              <View key={idx} style={{ marginBottom: 10 }} wrap={false}>
                <Text style={{ fontSize: 11.5, color: '#111', fontWeight: 'bold' }}>
                  {item.title} · {item.company}
                </Text>
                <Text style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{item.period}</Text>
                {item.bullets.map((b, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Text style={{ width: 10, color: '#999' }}>—</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#374151', lineHeight: 1.55 }}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {view.projects.length ? (
          <>
            <MinimalHeader>Selected Projects</MinimalHeader>
            {view.projects.map((item, idx) => (
              <View key={idx} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={{ fontSize: 11.5, color: '#111', fontWeight: 'bold' }}>{item.name}</Text>
                {item.bullets.map((b, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Text style={{ width: 10, color: '#999' }}>—</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#374151', lineHeight: 1.55 }}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {view.skills.length ? (
          <>
            <MinimalHeader>Skills</MinimalHeader>
            <Text style={{ ...styles.p, fontSize: 10 }}>{view.skills.join(' · ')}</Text>
          </>
        ) : null}

        {view.education ? (
          <>
            <MinimalHeader>Education</MinimalHeader>
            <Text style={{ ...styles.p, fontSize: 10.5, fontWeight: 'bold', color: '#111' }}>
              {view.education}
            </Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

function MinimalHeader({ children }) {
  return (
    <Text style={{
      fontSize: 9,
      color: '#888',
      marginTop: 16,
      marginBottom: 6,
      fontWeight: 'bold',
      letterSpacing: 2,
    }}>{children.toUpperCase()}</Text>
  );
}

const styles = StyleSheet.create({
  p: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headStrong: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#111827',
  },
  muted: {
    fontSize: 9,
    color: '#6b7280',
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    color: '#6b7280',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
});