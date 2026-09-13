function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline markdown spans — code, bold, italic, links — applied within a single already-HTML-escaped line. */
function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * A compact, self-written markdown renderer — headers, bold/italic,
 * inline and fenced code, links, lists, blockquotes and rules —
 * rather than adding an external markdown library, matching how
 * icons/wallpapers/sounds elsewhere in Anchoran are generated in code
 * instead of pulled in as assets. Shared by Notes' Preview mode and
 * Settings' "What's new" release notes. The source text is
 * HTML-escaped before any markdown syntax is applied (per line, after
 * its structural markers — #, >, -, ``` — are recognized on the raw
 * text; escaping the whole source up front would turn ">" into
 * "&gt;" before the blockquote check ever saw it), so pasted HTML
 * renders as literal text, not live markup.
 */
export function renderMarkdown(source: string): string {
  const lines = source.split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  // Plain text lines accumulate here until a blank line or a block-level
  // marker ends the paragraph — matching real markdown's "soft wrap"
  // convention, where consecutive non-blank lines are one paragraph, not
  // one each. Without this, hand-wrapped prose (like CHANGELOG.md, wrapped
  // at ~72 columns for plain-text/diff readability) rendered as a separate
  // `<p>` per source line, turning every paragraph into a tall stack of
  // one-line blocks.
  let paragraph: string[] = [];
  function flushParagraph() {
    if (paragraph.length === 0) return;
    html += `<p>${renderInline(escapeHtml(paragraph.join(" ")))}</p>`;
    paragraph = [];
  }
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      flushParagraph();
      inCode = !inCode;
      html += inCode ? "<pre><code>" : "</code></pre>";
      continue;
    }
    if (inCode) {
      html += `${escapeHtml(raw)}\n`;
      continue;
    }
    const heading = raw.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      flushParagraph();
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const level = heading[1].length;
      html += `<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`;
      continue;
    }
    if (/^\s*>\s?/.test(raw)) {
      flushParagraph();
      html += `<blockquote>${renderInline(escapeHtml(raw.replace(/^\s*>\s?/, "")))}</blockquote>`;
      continue;
    }
    if (/^\s*([-*+])\s+/.test(raw)) {
      flushParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${renderInline(escapeHtml(raw.replace(/^\s*([-*+])\s+/, "")))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(raw)) {
      flushParagraph();
      html += "<hr/>";
      continue;
    }
    if (raw.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(raw.trim());
    }
  }
  flushParagraph();
  if (inList) html += "</ul>";
  if (inCode) html += "</code></pre>";
  return html;
}
