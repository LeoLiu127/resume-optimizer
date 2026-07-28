import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

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

const FONT_CN = 'NotoSansSC';
const FONT_EN = 'Helvetica';
const FONT_SERIF_EN = 'Times-Roman';
const EDITORIAL_ACCENT = '#9B4F36';
const PRECISION_ACCENT = '#32B7A4';

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

function fontFor(language) {
  return language === 'en' ? FONT_EN : FONT_CN;
}

function serifFor(language) {
  return language === 'en' ? FONT_SERIF_EN : FONT_CN;
}

function joinFacts(values, language) {
  return values.join(language === 'en' ? ' | ' : '、');
}

/* ============================================================
 * Classic -> Editorial Signal 编辑出版型
 * ============================================================ */
export function ClassicPdfDocument({ view, role, language = 'zh' }) {
  const labels = labelsFor(language);
  const font = fontFor(language);
  const serif = serifFor(language);
  const contacts = [view.phone, view.email, view.location].filter(Boolean);

  return (
    <Document>
      <Page
        size="A4"
        wrap
        style={{
          fontFamily: serif,
          paddingTop: 34,
          paddingBottom: 34,
          paddingHorizontal: 36,
          fontSize: 9,
          color: '#1C2534',
          lineHeight: 1.5,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: 12,
            borderBottom: '0.8pt solid #1C2534',
          }}
          wrap={false}
        >
          <View style={{ width: '55%' }}>
            <Text style={{ fontSize: 24, lineHeight: 1, color: '#141B27' }}>{view.name}</Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: font,
                fontSize: 8,
                fontWeight: 'bold',
                color: EDITORIAL_ACCENT,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {role || view.headline || ''}
            </Text>
          </View>
          {contacts.length ? (
            <View style={{ width: '40%', alignItems: 'flex-end' }}>
              {contacts.map((contact) => (
                <Text
                  key={contact}
                  style={{
                    fontFamily: font,
                    fontSize: 7.5,
                    color: '#606A79',
                    lineHeight: 1.55,
                    textAlign: 'right',
                  }}
                >
                  {contact}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {view.summary ? (
          <EditorialRow label={labels.profile} font={font} lead>
            <Text style={editorialStyles.paragraph}>{view.summary}</Text>
          </EditorialRow>
        ) : null}
        {view.jobIntention ? (
          <EditorialRow label={labels.objective} font={font}>
            <Text style={editorialStyles.paragraph}>{view.jobIntention}</Text>
          </EditorialRow>
        ) : null}
        {view.experience.length
          ? view.experience.map((item, index) => (
              <EditorialRow
                key={`experience-${index}`}
                label={index === 0 ? labels.experience : ''}
                font={font}
                block
              >
                <EditorialItem item={item} font={font} />
              </EditorialRow>
            ))
          : null}
        {view.projects.length
          ? view.projects.map((item, index) => (
              <EditorialRow
                key={`project-${index}`}
                label={index === 0 ? labels.projects : ''}
                font={font}
                block
              >
                <EditorialItem item={item} font={font} project />
              </EditorialRow>
            ))
          : null}
        {view.skills.length ? (
          <EditorialRow label={labels.skills} font={font}>
            <EditorialTags values={view.skills} font={font} />
          </EditorialRow>
        ) : null}
        {view.tools.length ? (
          <EditorialRow label={labels.tools} font={font}>
            <EditorialTags values={view.tools} font={font} />
          </EditorialRow>
        ) : null}
        {view.education ? (
          <EditorialRow label={labels.education} font={font}>
            <Text style={editorialStyles.paragraph}>{view.education}</Text>
          </EditorialRow>
        ) : null}
        {view.extras.length ? (
          <EditorialRow label={labels.extras} font={font}>
            <Text style={editorialStyles.paragraph}>{joinFacts(view.extras, language)}</Text>
          </EditorialRow>
        ) : null}
      </Page>
    </Document>
  );
}

function EditorialRow({ label, font, lead = false, block = false, children }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingTop: lead ? 12 : 9,
        paddingBottom: lead ? 10 : block ? 0 : 2,
        borderBottom: lead ? '0.6pt solid #D8D5CF' : undefined,
      }}
      wrap={!block}
    >
      <Text
        style={{
          width: '24%',
          paddingRight: 10,
          fontFamily: font,
          fontSize: 7.5,
          fontWeight: 'bold',
          color: lead ? EDITORIAL_ACCENT : '#151D2A',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View style={{ width: '76%' }}>{children}</View>
    </View>
  );
}

function EditorialItem({ item, font, project = false }) {
  return (
    <View
      style={{
        paddingBottom: 7,
        marginBottom: 1,
        borderBottom: '0.5pt solid #E8E5DF',
      }}
      wrap={false}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, paddingRight: 7, fontSize: 9.5, fontWeight: 'bold', color: '#1C2534' }}>
          {project ? item.name : item.title}
        </Text>
        {!project && item.period ? (
          <Text style={{ fontFamily: font, flexShrink: 0, fontSize: 7, color: '#8B6455' }}>
            {item.period}
          </Text>
        ) : null}
      </View>
      {!project && item.company ? (
        <Text style={{ fontFamily: font, marginTop: 2, marginBottom: 3, fontSize: 7.5, color: '#7B8491' }}>
          {item.company}
        </Text>
      ) : null}
      {item.bullets.map((bullet, index) => (
        <View key={index} style={editorialStyles.bulletRow}>
          <Text style={{ width: 9, color: EDITORIAL_ACCENT }}>-</Text>
          <Text style={{ flex: 1, fontSize: 8, color: '#424B59', lineHeight: 1.45 }}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
}

function EditorialTags({ values, font }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {values.map((value, index) => (
        <Text
          key={`${value}-${index}`}
          style={{
            fontFamily: font,
            marginRight: 10,
            marginBottom: 4,
            paddingBottom: 1,
            borderBottom: '1.3pt solid #C77D62',
            fontSize: 7.5,
            color: '#394150',
          }}
        >
          {value}
        </Text>
      ))}
    </View>
  );
}

const editorialStyles = StyleSheet.create({
  paragraph: {
    fontSize: 8.5,
    color: '#323946',
    lineHeight: 1.6,
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
});

/* ============================================================
 * Modern -> Precision Grid 精准网格型
 * The rail is fixed per page while the main column remains fully wrappable.
 * ============================================================ */
export function ModernPdfDocument({ view, role, accent, language = 'zh' }) {
  const labels = labelsFor(language);
  const font = fontFor(language);
  const contacts = [view.phone, view.email, view.location].filter(Boolean);
  const monogram = String(view.name || 'CV').replace(/\s/g, '').slice(0, 2).toUpperCase();
  void accent;

  return (
    <Document>
      <Page
        size="A4"
        wrap
        style={{
          fontFamily: font,
          paddingTop: 32,
          paddingRight: 30,
          paddingBottom: 32,
          paddingLeft: 210,
          fontSize: 9,
          color: '#172033',
          lineHeight: 1.5,
        }}
      >
        <View
          fixed
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 184,
            paddingTop: 30,
            paddingHorizontal: 18,
            paddingBottom: 24,
            backgroundColor: '#11233F',
            color: '#FFFFFF',
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              border: '0.7pt solid #718096',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 15,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }}>{monogram}</Text>
          </View>

          {contacts.length ? (
            <>
              <RailHeading>{labels.contact}</RailHeading>
              {contacts.map((value) => (
                <Text key={value} style={precisionStyles.railFact}>{value}</Text>
              ))}
            </>
          ) : null}
          {view.skills.length ? (
            <>
              <RailHeading>{labels.skills}</RailHeading>
              <RailChips values={view.skills} />
            </>
          ) : null}
          {view.tools.length ? (
            <>
              <RailHeading>{labels.tools}</RailHeading>
              <RailChips values={view.tools} />
            </>
          ) : null}
          {view.education ? (
            <>
              <RailHeading>{labels.education}</RailHeading>
              <Text style={precisionStyles.railFact}>{view.education}</Text>
            </>
          ) : null}
        </View>

        <Text style={{ fontSize: 24, fontWeight: 'bold', lineHeight: 1.05, color: '#0F1D33' }}>
          {view.name}
        </Text>
        <Text
          style={{
            marginTop: 5,
            fontSize: 8,
            fontWeight: 'bold',
            letterSpacing: 1,
            color: '#157D75',
            textTransform: 'uppercase',
          }}
        >
          {role || view.headline || ''}
        </Text>

        {view.summary ? (
          <View
            style={{
              marginTop: 12,
              marginBottom: 7,
              paddingVertical: 7,
              paddingHorizontal: 9,
              borderLeft: `2.5pt solid ${PRECISION_ACCENT}`,
              backgroundColor: '#EFF8F6',
            }}
            wrap={false}
          >
            <Text style={{ fontSize: 8.5, color: '#344258', lineHeight: 1.55 }}>{view.summary}</Text>
          </View>
        ) : null}
        {view.jobIntention ? (
          <>
            <PrecisionHeading>{labels.objective}</PrecisionHeading>
            <Text style={precisionStyles.paragraph}>{view.jobIntention}</Text>
          </>
        ) : null}
        {view.experience.length ? (
          <>
            <PrecisionHeading>{labels.experience}</PrecisionHeading>
            {view.experience.map((item, index) => (
              <PrecisionItem key={index} item={item} />
            ))}
          </>
        ) : null}
        {view.projects.length ? (
          <>
            <PrecisionHeading>{labels.projects}</PrecisionHeading>
            {view.projects.map((item, index) => (
              <PrecisionItem key={index} item={item} project />
            ))}
          </>
        ) : null}
        {view.extras.length ? (
          <>
            <PrecisionHeading>{labels.extras}</PrecisionHeading>
            <Text style={precisionStyles.paragraph}>{joinFacts(view.extras, language)}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

function RailHeading({ children }) {
  return (
    <Text
      style={{
        marginTop: 12,
        marginBottom: 5,
        fontSize: 7.5,
        fontWeight: 'bold',
        letterSpacing: 1.1,
        color: '#75E6D1',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

function RailChips({ values }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {values.map((value, index) => (
        <Text
          key={`${value}-${index}`}
          style={{
            maxWidth: '100%',
            marginRight: 3,
            marginBottom: 3,
            paddingVertical: 2,
            paddingHorizontal: 4,
            border: '0.6pt solid #397A77',
            borderRadius: 2,
            fontSize: 6.8,
            color: '#E8F3F1',
            backgroundColor: '#173B50',
          }}
        >
          {value}
        </Text>
      ))}
    </View>
  );
}

function PrecisionHeading({ children }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 5,
      }}
      minPresenceAhead={24}
    >
      <Text
        style={{
          marginRight: 7,
          fontSize: 8.5,
          fontWeight: 'bold',
          color: '#10213C',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      <View style={{ flex: 1, height: 0.7, backgroundColor: '#CFD8E4' }} />
    </View>
  );
}

function PrecisionItem({ item, project = false }) {
  return (
    <View style={{ marginBottom: 7 }} wrap={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, paddingRight: 8, fontSize: 8.5, fontWeight: 'bold', color: '#172033' }}>
          {project ? item.name : item.title}
        </Text>
        {!project && item.period ? (
          <Text style={{ flexShrink: 0, fontSize: 6.8, color: '#172033' }}>{item.period}</Text>
        ) : null}
      </View>
      {!project && item.company ? (
        <Text style={{ marginTop: 1, marginBottom: 2, fontSize: 7.2, fontWeight: 'bold', color: '#157D75' }}>
          {item.company}
        </Text>
      ) : null}
      {item.bullets.map((bullet, index) => (
        <View key={index} style={{ flexDirection: 'row', marginTop: 2 }}>
          <Text style={{ width: 9, color: PRECISION_ACCENT }}>-</Text>
          <Text style={{ flex: 1, fontSize: 7.5, lineHeight: 1.45, color: '#45536A' }}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
}

const precisionStyles = StyleSheet.create({
  railFact: {
    marginBottom: 3,
    fontSize: 7.2,
    lineHeight: 1.5,
    color: '#D6DFEB',
  },
  paragraph: {
    marginBottom: 6,
    fontSize: 7.8,
    lineHeight: 1.5,
    color: '#45536A',
  },
});

/* ============================================================
 * Minimal 极简留白（保留原布局，仅本地化章节标题）
 * ============================================================ */
export function MinimalPdfDocument({ view, role, language = 'zh' }) {
  const labels = labelsFor(language);
  const font = fontFor(language);

  return (
    <Document>
      <Page
        size="A4"
        wrap
        style={{
          fontFamily: font,
          paddingTop: 36,
          paddingBottom: 36,
          paddingHorizontal: 50,
          fontSize: 10,
          color: '#111827',
          lineHeight: 1.5,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: 300, color: '#111111' }}>{view.name}</Text>
        <Text style={{ marginTop: 20, fontSize: 9, color: '#888888' }}>
          {[role, view.location].filter(Boolean).join(' | ')}
        </Text>

        {view.summary ? (
          <Text style={{ marginTop: 16, fontSize: 10.5, lineHeight: 1.75, color: '#374151' }}>
            {view.summary}
          </Text>
        ) : null}
        {view.experience.length ? (
          <>
            <MinimalHeader>{labels.experience}</MinimalHeader>
            {view.experience.map((item, index) => (
              <View key={index} style={{ marginBottom: 10 }} wrap={false}>
                <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: '#111111' }}>
                  {item.title} | {item.company}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 9, color: '#888888' }}>{item.period}</Text>
                {item.bullets.map((bullet, bulletIndex) => (
                  <View key={bulletIndex} style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Text style={{ width: 10, color: '#999999' }}>-</Text>
                    <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: '#374151' }}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}
        {view.projects.length ? (
          <>
            <MinimalHeader>{labels.projects}</MinimalHeader>
            {view.projects.map((item, index) => (
              <View key={index} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: '#111111' }}>{item.name}</Text>
                {item.bullets.map((bullet, bulletIndex) => (
                  <View key={bulletIndex} style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Text style={{ width: 10, color: '#999999' }}>-</Text>
                    <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: '#374151' }}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}
        {view.skills.length ? (
          <>
            <MinimalHeader>{labels.skills}</MinimalHeader>
            <Text style={{ fontSize: 10, lineHeight: 1.5, color: '#374151' }}>{view.skills.join(' | ')}</Text>
          </>
        ) : null}
        {view.education ? (
          <>
            <MinimalHeader>{labels.education}</MinimalHeader>
            <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: '#111111' }}>{view.education}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

function MinimalHeader({ children }) {
  return (
    <Text
      style={{
        marginTop: 16,
        marginBottom: 6,
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 2,
        color: '#888888',
        textTransform: 'uppercase',
      }}
      minPresenceAhead={24}
    >
      {children}
    </Text>
  );
}
