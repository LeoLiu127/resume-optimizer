import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const FONT_CN = 'Microsoft YaHei';
const FONT_EN = 'Arial';
const EDITORIAL_ACCENT = '9B4F36';
const PRECISION_ACCENT = '32B7A4';
const NONE_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
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

function fontFor(language) {
  return language === 'en' ? FONT_EN : FONT_CN;
}

function fontForText(value, fallback) {
  if (!/[\u3400-\u9FFF]/.test(String(value || ''))) return fallback;
  return {
    ascii: fallback,
    hAnsi: fallback,
    eastAsia: FONT_CN,
    cs: fallback,
  };
}

function monogramForName(value) {
  const name = String(value || 'CV');
  const latinWords = name.match(/[A-Za-z]+/g) || [];
  if (latinWords.length) {
    return latinWords.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  }
  return name.replace(/\s/g, '').slice(0, 2).toUpperCase();
}

function joinFacts(values, language) {
  return values.join(language === 'en' ? ' | ' : '、');
}

function makeDocument(view, language, margins, children) {
  const font = fontFor(language);
  return new Document({
    creator: '简历优化大师',
    title: `${view.name} - ${language === 'en' ? 'Resume' : '简历'}`,
    styles: {
      default: {
        document: {
          run: { font, size: 19, color: '263244' },
          paragraph: { spacing: { line: 276, after: 60 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: margins,
        },
      },
      children,
    }],
  });
}

/* ============================================================
 * Classic -> Editorial Signal 编辑出版型
 * ============================================================ */
export async function buildClassicDocx(view, role, accent, language = 'zh') {
  const labels = labelsFor(language);
  const font = fontFor(language);
  const nameFont = fontForText(view.name, font);
  const contacts = [view.phone, view.email, view.location].filter(Boolean);
  void accent;

  const header = new Table({
    width: { size: 9900, type: WidthType.DXA },
    columnWidths: [5700, 4200],
    layout: TableLayoutType.FIXED,
    borders: NONE_BORDERS,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 5700, type: WidthType.DXA },
            margins: { top: 0, right: 160, bottom: 0, left: 0 },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                spacing: { after: 70 },
                children: [new TextRun({
                  text: view.name,
                  size: 46,
                  color: '141B27',
                  font: nameFont,
                })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: role || view.headline || '',
                    bold: true,
                    size: 17,
                    color: EDITORIAL_ACCENT,
                    font,
                    characterSpacing: 80,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4200, type: WidthType.DXA },
            margins: { top: 0, right: 0, bottom: 0, left: 160 },
            verticalAlign: VerticalAlign.TOP,
            children: contacts.length
              ? contacts.map((contact) => new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 28 },
                  children: [new TextRun({ text: contact, size: 15, color: '606A79', font })],
                }))
              : [new Paragraph({})],
          }),
        ],
      }),
    ],
  });

  const children = [
    header,
    new Paragraph({
      border: { bottom: { color: '1C2534', space: 1, style: BorderStyle.SINGLE, size: 7 } },
      spacing: { after: 120 },
    }),
  ];

  if (view.summary) children.push(editorialSectionTable(labels.profile, [bodyParagraph(view.summary, font)], font, true));
  if (view.jobIntention) children.push(editorialSectionTable(labels.objective, [bodyParagraph(view.jobIntention, font)], font));
  if (view.experience.length) {
    children.push(editorialItemsTable(
      labels.experience,
      view.experience.map((item) => editorialItemContent(item, font)),
      font,
    ));
  }
  if (view.projects.length) {
    children.push(editorialItemsTable(
      labels.projects,
      view.projects.map((item) => editorialItemContent(item, font, true)),
      font,
    ));
  }
  if (view.skills.length) children.push(editorialSectionTable(labels.skills, [tagParagraph(view.skills, font)], font));
  if (view.tools.length) children.push(editorialSectionTable(labels.tools, [tagParagraph(view.tools, font)], font));
  if (view.education) children.push(editorialSectionTable(labels.education, [bodyParagraph(view.education, font)], font));
  if (view.extras.length) {
    children.push(editorialSectionTable(labels.extras, [bodyParagraph(joinFacts(view.extras, language), font)], font));
  }

  return Packer.toBlob(makeDocument(
    view,
    language,
    { top: 850, right: 1000, bottom: 850, left: 1000 },
    children,
  ));
}

function editorialSectionTable(label, content, font, lead = false) {
  return editorialTable([
    new TableRow({
      cantSplit: true,
      children: [
        editorialLabelCell(label, font, lead),
        editorialContentCell(content, lead),
      ],
    }),
  ]);
}

function editorialItemsTable(label, items, font) {
  return editorialTable(items.map((content, index) => new TableRow({
    cantSplit: true,
    children: [
      editorialLabelCell(index === 0 ? label : '', font),
      editorialContentCell(content),
    ],
  })));
}

function editorialTable(rows) {
  return new Table({
    width: { size: 9900, type: WidthType.DXA },
    columnWidths: [2250, 7650],
    layout: TableLayoutType.FIXED,
    borders: NONE_BORDERS,
    rows,
  });
}

function editorialLabelCell(text, font, lead = false) {
  return new TableCell({
    width: { size: 2250, type: WidthType.DXA },
    margins: { top: 120, right: 180, bottom: 60, left: 0 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        keepNext: true,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            size: 16,
            color: lead ? EDITORIAL_ACCENT : '151D2A',
            font,
            characterSpacing: 60,
          }),
        ],
      }),
    ],
  });
}

function editorialContentCell(children, lead = false) {
  return new TableCell({
    width: { size: 7650, type: WidthType.DXA },
    margins: { top: 110, right: 0, bottom: lead ? 100 : 55, left: 100 },
    verticalAlign: VerticalAlign.TOP,
    borders: lead
      ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8D5CF' } }
      : undefined,
    children,
  });
}

function editorialItemContent(item, font, project = false) {
  const paragraphs = [
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 35 },
      children: [
        new TextRun({
          text: project ? item.name : item.title,
          bold: true,
          size: 19,
          color: '1C2534',
          font,
        }),
        ...(!project && item.period
          ? [
              new TextRun({ text: '    ', size: 15, font }),
              new TextRun({ text: item.period, size: 15, color: '8B6455', font }),
            ]
          : []),
      ],
    }),
  ];
  if (!project && item.company) {
    paragraphs.push(new Paragraph({
      keepNext: item.bullets.length > 0,
      spacing: { after: 45 },
      children: [new TextRun({ text: item.company, size: 15, color: '7B8491', font })],
    }));
  }
  item.bullets.forEach((bullet) => paragraphs.push(bulletParagraph(bullet, font, EDITORIAL_ACCENT)));
  paragraphs.push(new Paragraph({
    border: { bottom: { color: 'E8E5DF', style: BorderStyle.SINGLE, size: 3, space: 1 } },
    spacing: { after: 55 },
  }));
  return paragraphs;
}

function tagParagraph(values, font) {
  return new Paragraph({
    keepLines: true,
    spacing: { after: 20 },
    children: values.flatMap((value, index) => [
      new TextRun({ text: value, size: 16, color: '394150', font, underline: { color: 'C77D62' } }),
      ...(index < values.length - 1 ? [new TextRun({ text: '   ', size: 16, font })] : []),
    ]),
  });
}

/* ============================================================
 * Modern -> Precision Grid 精准网格型
 * ============================================================ */
export async function buildModernDocx(view, role, accent, language = 'zh') {
  const labels = labelsFor(language);
  const font = fontFor(language);
  const nameFont = fontForText(view.name, font);
  const contacts = [view.phone, view.email, view.location].filter(Boolean);
  const monogram = monogramForName(view.name);
  const monogramFont = fontForText(monogram, font);
  void accent;

  const leftChildren = [
    new Paragraph({
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: monogram,
          bold: true,
          size: 28,
          color: 'FFFFFF',
          font: monogramFont,
        }),
      ],
    }),
  ];
  if (contacts.length) {
    leftChildren.push(railHeading(labels.contact, font));
    contacts.forEach((contact) => leftChildren.push(railFact(contact, font)));
  }
  if (view.skills.length) {
    leftChildren.push(railHeading(labels.skills, font));
    leftChildren.push(railChipParagraph(view.skills, font));
  }
  if (view.tools.length) {
    leftChildren.push(railHeading(labels.tools, font));
    leftChildren.push(railChipParagraph(view.tools, font));
  }
  if (view.education) {
    leftChildren.push(railHeading(labels.education, font));
    leftChildren.push(railFact(view.education, font));
  }

  const rightChildren = [
    new Paragraph({
      keepNext: true,
      spacing: { after: 60 },
      children: [new TextRun({
        text: view.name,
        bold: true,
        size: 44,
        color: '0F1D33',
        font: nameFont,
      })],
    }),
    new Paragraph({
      keepNext: Boolean(view.summary),
      spacing: { after: 130 },
      children: [
        new TextRun({
          text: role || view.headline || '',
          bold: true,
          size: 17,
          color: '157D75',
          font,
          characterSpacing: 70,
        }),
      ],
    }),
  ];
  if (view.summary) {
    rightChildren.push(new Paragraph({
      border: { left: { style: BorderStyle.SINGLE, size: 22, color: PRECISION_ACCENT, space: 8 } },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EFF8F6' },
      indent: { left: 120, right: 80 },
      spacing: { before: 40, after: 150 },
      children: [new TextRun({ text: view.summary, size: 17, color: '344258', font })],
    }));
  }
  if (view.jobIntention) {
    rightChildren.push(precisionHeading(labels.objective, font), bodyParagraph(view.jobIntention, font));
  }
  if (view.experience.length) {
    rightChildren.push(precisionHeading(labels.experience, font));
    view.experience.forEach((item) => rightChildren.push(...precisionItemContent(item, font)));
  }
  if (view.projects.length) {
    rightChildren.push(precisionHeading(labels.projects, font));
    view.projects.forEach((item) => rightChildren.push(...precisionItemContent(item, font, true)));
  }
  if (view.extras.length) {
    rightChildren.push(
      precisionHeading(labels.extras, font),
      bodyParagraph(joinFacts(view.extras, language), font),
    );
  }

  const table = new Table({
    width: { size: 10700, type: WidthType.DXA },
    columnWidths: [3317, 7383],
    layout: TableLayoutType.FIXED,
    borders: NONE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3317, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: '11233F' },
            margins: { top: 340, right: 240, bottom: 320, left: 240 },
            verticalAlign: VerticalAlign.TOP,
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 7383, type: WidthType.DXA },
            margins: { top: 340, right: 260, bottom: 320, left: 340 },
            verticalAlign: VerticalAlign.TOP,
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  return Packer.toBlob(makeDocument(
    view,
    language,
    { top: 600, right: 600, bottom: 600, left: 600 },
    [table],
  ));
}

function railHeading(text, font) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 190, after: 80 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 15,
        color: '75E6D1',
        font,
        characterSpacing: 80,
      }),
    ],
  });
}

function railFact(text, font) {
  return new Paragraph({
    keepLines: true,
    spacing: { after: 45 },
    children: [new TextRun({ text, size: 15, color: 'D6DFEB', font })],
  });
}

function railChipParagraph(values, font) {
  return new Paragraph({
    keepLines: true,
    spacing: { after: 40 },
    children: values.flatMap((value, index) => [
      new TextRun({
        text: value,
        size: 14,
        color: 'E8F3F1',
        font,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: '173B50' },
      }),
      ...(index < values.length - 1 ? [new TextRun({ text: '  ', size: 14, font })] : []),
    ]),
  });
}

function precisionHeading(text, font) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 180, after: 75 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CFD8E4', space: 3 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 17, color: '10213C', font }),
    ],
  });
}

function precisionItemContent(item, font, project = false) {
  const paragraphs = [
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { before: 30, after: 30 },
      children: [
        new TextRun({
          text: project ? item.name : item.title,
          bold: true,
          size: 18,
          color: '172033',
          font,
        }),
        ...(!project && item.period
          ? [
              new TextRun({ text: '    ', size: 14, font }),
              new TextRun({ text: item.period, size: 14, color: '172033', font }),
            ]
          : []),
      ],
    }),
  ];
  if (!project && item.company) {
    paragraphs.push(new Paragraph({
      keepNext: item.bullets.length > 0,
      spacing: { after: 40 },
      children: [new TextRun({ text: item.company, bold: true, size: 15, color: '157D75', font })],
    }));
  }
  item.bullets.forEach((bullet) => paragraphs.push(bulletParagraph(bullet, font, PRECISION_ACCENT)));
  return paragraphs;
}

/* ============================================================
 * Minimal 极简留白（保留原布局，仅本地化章节标题）
 * ============================================================ */
export async function buildMinimalDocx(view, role, accent, language = 'zh') {
  const labels = labelsFor(language);
  const font = fontFor(language);
  const nameFont = fontForText(view.name, font);
  const children = [
    new Paragraph({
      keepNext: true,
      spacing: { after: 80 },
      children: [new TextRun({
        text: view.name,
        size: 52,
        color: '111111',
        font: nameFont,
      })],
    }),
    new Paragraph({
      keepNext: Boolean(view.summary),
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: [role, view.location].filter(Boolean).join(' | '),
          size: 18,
          color: '888888',
          font,
        }),
      ],
    }),
  ];
  void accent;

  if (view.summary) {
    children.push(new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: view.summary, size: 22, color: '374151', font })],
    }));
  }
  if (view.experience.length) {
    children.push(minimalHeading(labels.experience, font));
    view.experience.forEach((item) => {
      children.push(
        new Paragraph({
          keepNext: true,
          keepLines: true,
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: `${item.title} | ${item.company}`, size: 22, color: '111111', font }),
          ],
        }),
        new Paragraph({
          keepNext: item.bullets.length > 0,
          spacing: { after: 60 },
          children: [new TextRun({ text: item.period, size: 18, color: '888888', font })],
        }),
      );
      item.bullets.forEach((bullet) => children.push(minimalBullet(bullet, font)));
    });
  }
  if (view.projects.length) {
    children.push(minimalHeading(labels.projects, font));
    view.projects.forEach((item) => {
      children.push(new Paragraph({
        keepNext: item.bullets.length > 0,
        keepLines: true,
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: item.name, size: 22, color: '111111', font })],
      }));
      item.bullets.forEach((bullet) => children.push(minimalBullet(bullet, font)));
    });
  }
  if (view.skills.length) {
    children.push(
      minimalHeading(labels.skills, font),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: view.skills.join(' | '), size: 20, color: '374151', font })],
      }),
    );
  }
  if (view.tools.length) {
    children.push(
      minimalHeading(labels.tools, font),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: view.tools.join(' | '), size: 20, color: '374151', font })],
      }),
    );
  }
  if (view.education) {
    children.push(
      minimalHeading(labels.education, font),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: view.education, size: 22, color: '111111', font })],
      }),
    );
  }
  if (view.extras.length) {
    children.push(
      minimalHeading(labels.extras, font),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({
          text: joinFacts(view.extras, language),
          size: 20,
          color: '374151',
          font,
        })],
      }),
    );
  }

  return Packer.toBlob(makeDocument(
    view,
    language,
    { top: 1200, right: 1500, bottom: 1200, left: 1500 },
    children,
  ));
}

function minimalHeading(text, font) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: '888888',
        font,
        characterSpacing: 80,
      }),
    ],
  });
}

function minimalBullet(text, font) {
  return new Paragraph({
    keepLines: true,
    bullet: { level: 0 },
    spacing: { after: 60 },
    indent: { left: 300, hanging: 180 },
    children: [new TextRun({ text, size: 20, color: '374151', font })],
  });
}

/* ============ shared document helpers ============ */
function bodyParagraph(text, font) {
  return new Paragraph({
    keepLines: true,
    spacing: { after: 65 },
    children: [new TextRun({ text, size: 17, color: '323946', font })],
  });
}

function bulletParagraph(text, font, markerColor) {
  return new Paragraph({
    keepLines: true,
    bullet: { level: 0 },
    spacing: { after: 35 },
    indent: { left: 280, hanging: 160 },
    children: [new TextRun({ text, size: 16, color: markerColor === PRECISION_ACCENT ? '45536A' : '424B59', font })],
  });
}
