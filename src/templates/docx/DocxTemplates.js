import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  PageOrientation,
} from 'docx';

// docx 库使用系统字体，这里声明 Word 会用到的字体名（macOS / Windows / Linux 都覆盖）
const FONT_CN = 'Microsoft YaHei';
const FONT_EN = 'Calibri';

/* ============================================================
 * Classic DOCX
 * ============================================================ */
export async function buildClassicDocx(view, role) {
  const children = [];

  // 顶部居中姓名 + 角色
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: view.name, bold: true, size: 36, font: FONT_CN }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: (role || '').toUpperCase(), size: 18, color: '6B7280', font: FONT_EN }),
      ],
    }),
    new Paragraph({
      border: { bottom: { color: '111827', space: 1, style: BorderStyle.SINGLE, size: 12 } },
      spacing: { after: 200 },
    }),
  );

  if (view.jobIntention) {
    children.push(makeHeading('求职意向'), makeParagraph(view.jobIntention));
  }
  if (view.summary) {
    children.push(makeHeading('职业摘要'), makeParagraph(view.summary));
  }
  if (view.skills.length) {
    children.push(makeHeading('核心能力'), makeParagraph(view.skills.join(' · ')));
  }
  if (view.tools.length) {
    children.push(makeHeading('技能工具'), makeParagraph(view.tools.join(' · ')));
  }

  if (view.experience.length) {
    children.push(makeHeading('工作经历'));
    view.experience.forEach((item) => {
      children.push(makeExpHead(`${item.company} · ${item.title}`, item.period));
      item.bullets.forEach((b) => children.push(makeBullet(b, '•')));
    });
  }

  if (view.projects.length) {
    children.push(makeHeading('项目经历'));
    view.projects.forEach((item) => {
      children.push(makeParagraph(item.name, { bold: true, size: 22 }));
      item.bullets.forEach((b) => children.push(makeBullet(b, '•')));
    });
  }

  if (view.education) {
    children.push(makeHeading('教育背景'), makeParagraph(view.education));
  }

  if (view.extras.length) {
    children.push(makeHeading('其他加分项'), makeParagraph(view.extras.join('、')));
  }

  const doc = new Document({
    creator: '简历优化大师',
    title: `${view.name} - 简历`,
    styles: { default: { document: { run: { font: FONT_CN, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

/* ============================================================
 * Modern DOCX（用 2 列表格实现左右双栏）
 * ============================================================ */
export async function buildModernDocx(view, role, accent = '2563EB') {
  const leftChildren = [];

  leftChildren.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: view.name, bold: true, size: 32, color: 'FFFFFF', font: FONT_CN })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: role || '', size: 18, color: '9CA3AF', font: FONT_EN })],
    }),
  );

  const pushLeftHeading = (text) => {
    leftChildren.push(new Paragraph({
      spacing: { before: 200, after: 80 },
      border: { left: { color: accent, space: 6, style: BorderStyle.SINGLE, size: 18 } },
      indent: { left: 120 },
      children: [new TextRun({ text, bold: true, size: 18, color: '93C5FD', font: FONT_EN })],
    }));
  };

  const pushLeftItem = (text) => {
    leftChildren.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text, size: 18, color: 'E5E7EB', font: FONT_CN })],
    }));
  };

  pushLeftHeading('联系');
  if (view.email) pushLeftItem(`✉  ${view.email}`);
  if (view.phone) pushLeftItem(`☎  ${view.phone}`);
  if (view.location) pushLeftItem(`⌖  ${view.location}`);

  if (view.skills.length) {
    pushLeftHeading('核心能力');
    pushLeftItem(view.skills.slice(0, 10).join(' · '));
  }
  if (view.tools.length) {
    pushLeftHeading('技能工具');
    pushLeftItem(view.tools.slice(0, 8).join(' · '));
  }
  if (view.education) {
    pushLeftHeading('教育');
    pushLeftItem(view.education);
  }

  const rightChildren = [];

  rightChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: view.name, bold: true, size: 32, color: '111827', font: FONT_CN })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: role ? `${role} · 优化版简历` : '优化版简历', bold: true, size: 18, color: accent, font: FONT_CN })],
    }),
  );

  const pushRightHeading = (text) => {
    rightChildren.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      border: { left: { color: accent, space: 6, style: BorderStyle.SINGLE, size: 18 } },
      indent: { left: 120 },
      children: [new TextRun({ text, bold: true, size: 18, color: '111827', font: FONT_EN })],
    }));
  };

  const pushRightItem = (text, opts = {}) => {
    rightChildren.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text, size: opts.size || 20, color: opts.color || '374151', font: FONT_CN })],
    }));
  };

  if (view.summary) {
    pushRightHeading('个人简介');
    pushRightItem(view.summary);
  }
  if (view.jobIntention) {
    pushRightHeading('求职意向');
    pushRightItem(view.jobIntention);
  }
  if (view.experience.length) {
    pushRightHeading('工作经历');
    view.experience.forEach((item) => {
      rightChildren.push(makeExpHead(`${item.company} · ${item.title}`, item.period));
      item.bullets.forEach((b) => rightChildren.push(makeBullet(b, '▸', accent)));
    });
  }
  if (view.projects.length) {
    pushRightHeading('关键项目');
    view.projects.forEach((item) => {
      rightChildren.push(makeParagraph(item.name, { bold: true, size: 22 }));
      item.bullets.forEach((b) => rightChildren.push(makeBullet(b, '▸', accent)));
    });
  }
  if (view.extras.length) {
    pushRightHeading('其他加分项');
    pushRightItem(view.extras.join('、'));
  }

  // 左右双栏表格
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: '111827' },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: '简历优化大师',
    title: `${view.name} - 简历`,
    styles: { default: { document: { run: { font: FONT_CN, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [table],
    }],
  });

  return Packer.toBlob(doc);
}

/* ============================================================
 * Minimal DOCX（极简留白）
 * ============================================================ */
export async function buildMinimalDocx(view, role) {
  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: view.name, size: 52, color: '111111', font: FONT_CN, light: true })],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: [role, view.location].filter(Boolean).join(' · '), size: 18, color: '888888', font: FONT_CN })],
    }),
  );

  if (view.summary) {
    children.push(new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: view.summary, size: 22, color: '374151', font: FONT_CN, light: true })],
    }));
  }

  const pushMinimalHeading = (text) => {
    children.push(new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: '888888', font: FONT_EN, characterSpacing: 80 })],
    }));
  };

  const pushMinimalBullet = (text) => {
    children.push(new Paragraph({
      spacing: { after: 60 },
      indent: { left: 240 },
      children: [
        new TextRun({ text: '— ', size: 20, color: '999999', font: FONT_EN }),
        new TextRun({ text, size: 20, color: '374151', font: FONT_CN, light: true }),
      ],
    }));
  };

  if (view.experience.length) {
    pushMinimalHeading('Experience');
    view.experience.forEach((item) => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: `${item.title} · ${item.company}`, size: 22, color: '111111', font: FONT_CN })],
      }));
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: item.period, size: 18, color: '888888', font: FONT_EN })],
      }));
      item.bullets.forEach(pushMinimalBullet);
    });
  }

  if (view.projects.length) {
    pushMinimalHeading('Selected Projects');
    view.projects.forEach((item) => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: item.name, size: 22, color: '111111', font: FONT_CN })],
      }));
      item.bullets.forEach(pushMinimalBullet);
    });
  }

  if (view.skills.length) {
    pushMinimalHeading('Skills');
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: view.skills.join(' · '), size: 20, color: '374151', font: FONT_CN, light: true })],
    }));
  }

  if (view.education) {
    pushMinimalHeading('Education');
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: view.education, size: 22, color: '111111', font: FONT_CN })],
    }));
  }

  const doc = new Document({
    creator: '简历优化大师',
    title: `${view.name} - 简历`,
    styles: { default: { document: { run: { font: FONT_CN, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 1200, right: 1500, bottom: 1200, left: 1500 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

/* ============ 内部辅助 ============ */
function makeHeading(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { color: 'E5E7EB', space: 1, style: BorderStyle.SINGLE, size: 4 } },
    children: [new TextRun({ text, bold: true, size: 22, color: '111827', font: FONT_CN })],
  });
}

function makeParagraph(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({
      text,
      bold: opts.bold,
      size: opts.size || 20,
      color: opts.color || '374151',
      font: FONT_CN,
    })],
  });
}

function makeExpHead(left, right) {
  return new Paragraph({
    spacing: { before: 80, after: 40 },
    tabStops: [{ type: 'right', position: 9000 }],
    children: [
      new TextRun({ text: left, bold: true, size: 22, color: '111827', font: FONT_CN }),
      new TextRun({ text: '\t', size: 22 }),
      new TextRun({ text: right, size: 18, color: '6B7280', font: FONT_EN }),
    ],
  });
}

function makeBullet(text, marker = '•', color = '6B7280') {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 240 },
    children: [
      new TextRun({ text: `${marker} `, size: 20, color, font: FONT_EN }),
      new TextRun({ text, size: 20, color: '374151', font: FONT_CN }),
    ],
  });
}