import { C, FONT, FOOTER, SLIDE } from './theme.mjs';

export class BboxTracker {
  constructor() {
    this.slides = [];
    this.current = [];
    this.slideNum = 0;
  }

  nextSlide() {
    if (this.current.length) this.slides.push([...this.current]);
    this.current = [];
    this.slideNum += 1;
  }

  track(x, y, w, h, name) {
    const box = { x, y, w, h, x2: x + w, y2: y + h, name, slide: this.slideNum };
    this.current.push(box);
    return box;
  }

  overlaps(a, b) {
    return a.x < b.x2 && a.x2 > b.x && a.y < b.y2 && a.y2 > b.y;
  }

  findOverlaps() {
    const issues = [];
    const ignore = /^(bg|footer-|arrow)$/;
    for (const slideBoxes of this.slides) {
      for (let i = 0; i < slideBoxes.length; i++) {
        for (let j = i + 1; j < slideBoxes.length; j++) {
          const a = slideBoxes[i];
          const b = slideBoxes[j];
          if (ignore.test(a.name) || ignore.test(b.name)) continue;
          if (this.overlaps(a, b)) {
            const area = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x, b.x))
              * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y, b.y));
            if (area > 0.08) {
              issues.push({ slide: a.slide, a: a.name, b: b.name, area: +area.toFixed(3) });
            }
          }
        }
      }
    }
    return issues;
  }
}

export function footer(slide, num, tracker) {
  const y = SLIDE.h - 0.32;
  tracker?.track(0.45, y, 6.5, 0.22, `footer-left-${num}`);
  tracker?.track(8.8, y, 0.9, 0.22, `footer-num-${num}`);
  slide.addText(FOOTER, {
    x: 0.45, y, w: 6.5, h: 0.22, fontSize: 7, color: C.muted, fontFace: FONT,
  });
  slide.addText(String(num).padStart(2, '0'), {
    x: 9.1, y, w: 0.45, h: 0.22, fontSize: 7, color: C.muted, align: 'right', fontFace: FONT,
  });
}

export function kicker(slide, text, y = 0.42, tracker, name) {
  tracker?.track(0.55, y, 8.5, 0.22, name || 'kicker');
  slide.addText(text.toUpperCase(), {
    x: 0.55, y, w: 8.5, h: 0.22, fontSize: 9, bold: true, color: C.green, charSpacing: 1.2, fontFace: FONT,
  });
}

export function title(slide, text, y = 0.68, w = 8.9, size = 28, color = C.text, tracker, name) {
  const h = size >= 30 ? 0.55 : 0.45;
  tracker?.track(0.55, y, w, h, name || 'title');
  slide.addText(text, {
    x: 0.55, y, w, h, fontSize: size, bold: true, color, fontFace: FONT, valign: 'top',
  });
}

export function body(slide, text, x, y, w, h, opts = {}, tracker, name) {
  tracker?.track(x, y, w, h, name || 'body');
  slide.addText(text, {
    x, y, w, h, fontSize: opts.size || 10, color: opts.color || C.muted, fontFace: FONT, ...opts,
  });
}

export function darkSlide(slide) {
  slide.background = { color: C.navy };
}

export function lightSlide(slide) {
  slide.background = { color: C.white };
}

export function offWhiteSlide(slide) {
  slide.background = { color: C.offWhite };
}

export function tag(slide, text, x, y, tracker) {
  const w = Math.min(1.6, 0.18 * text.length + 0.35);
  tracker?.track(x, y, w, 0.28, `tag-${text}`);
  slide.addShape('roundRect', {
    x, y, w, h: 0.28, fill: { color: C.lightGreen }, line: { color: C.green2, width: 0.5 }, rectRadius: 0.08,
  });
  slide.addText(text, {
    x, y: y + 0.04, w, h: 0.22, fontSize: 7, bold: true, color: C.green, align: 'center', fontFace: FONT,
  });
}

export function metricCard(slide, { x, y, w, h, num, label, tracker, name }) {
  tracker?.track(x, y, w, h, name);
  slide.addShape('roundRect', {
    x, y, w, h, fill: { color: C.white }, line: { color: 'D8E3DC', width: 0.75 }, rectRadius: 0.08,
  });
  slide.addText(num, {
    x, y: y + 0.12, w, h: 0.42, fontSize: 26, bold: true, color: C.green, align: 'center', fontFace: FONT,
  });
  slide.addText(label, {
    x, y: y + 0.52, w, h: 0.35, fontSize: 8, color: C.text, align: 'center', fontFace: FONT,
  });
}

export function phoneMock(slide, { x, y, w, h, title: cap, lines, badge, tracker, name, imagePath }) {
  tracker?.track(x, y, w, h + 0.22, name);
  slide.addShape('roundRect', {
    x, y, w, h, fill: { color: C.navy }, rectRadius: 0.12,
  });
  const pad = 0.06;
  slide.addShape('roundRect', {
    x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 - 0.08,
    fill: { color: C.white }, rectRadius: 0.08,
  });
  if (imagePath) {
    slide.addImage({ path: imagePath, x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 - 0.08 });
  } else {
    const ix = x + pad + 0.08;
    const iy = y + pad + 0.1;
    slide.addShape('roundRect', {
      x: ix, y: iy, w: w - pad * 2 - 0.16, h: 0.22, fill: { color: C.lightGreen }, rectRadius: 0.04,
    });
    slide.addText('NyumbaSearch', {
      x: ix, y: iy + 0.03, w: w - pad * 2 - 0.16, h: 0.18, fontSize: 6, bold: true, color: C.green, fontFace: FONT,
    });
    lines.forEach((line, i) => {
      slide.addText(line, {
        x: ix, y: iy + 0.3 + i * 0.2, w: w - pad * 2 - 0.16, h: 0.18,
        fontSize: 6.5, color: C.text, fontFace: FONT,
      });
    });
    if (badge) {
      slide.addShape('roundRect', {
        x: ix, y: iy + 0.3 + lines.length * 0.2, w: 0.75, h: 0.16,
        fill: { color: C.green }, rectRadius: 0.04,
      });
      slide.addText(badge, {
        x: ix, y: iy + 0.31 + lines.length * 0.2, w: 0.75, h: 0.14,
        fontSize: 5.5, bold: true, color: C.white, align: 'center', fontFace: FONT,
      });
    }
  }
  slide.addText(cap, {
    x, y: y + h + 0.04, w, h: 0.16, fontSize: 7, bold: true, color: C.text, align: 'center', fontFace: FONT,
  });
}

export function arrowRight(slide, x, y, tracker) {
  tracker?.track(x, y, 0.35, 0.2, 'arrow');
  slide.addText('→', { x, y, w: 0.35, h: 0.2, fontSize: 16, color: C.green, align: 'center', fontFace: FONT });
}

export function footnote(slide, text, y, tracker) {
  tracker?.track(0.55, y, 8.9, 0.2, 'footnote');
  slide.addText(text, {
    x: 0.55, y, w: 8.9, h: 0.2, fontSize: 7, italic: true, color: C.muted, fontFace: FONT,
  });
}
