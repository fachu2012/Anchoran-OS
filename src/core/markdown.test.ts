import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings at the right level", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
    expect(renderMarkdown("### Subheading")).toBe("<h3>Subheading</h3>");
  });

  it("renders bold, italic and inline code", () => {
    expect(renderMarkdown("**bold** and *italic* and `code`")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>"
    );
  });

  it("renders a link with target/rel for safety", () => {
    expect(renderMarkdown("[Anchoran](https://example.com)")).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Anchoran</a></p>'
    );
  });

  it("renders a bullet list", () => {
    expect(renderMarkdown("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a fenced code block verbatim, without inline formatting applied inside it", () => {
    const out = renderMarkdown("```\n**not bold**\n```");
    expect(out).toContain("<pre><code>");
    expect(out).toContain("**not bold**");
    expect(out).not.toContain("<strong>");
  });

  it("escapes raw HTML in the source instead of rendering it live", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("renders a blockquote", () => {
    expect(renderMarkdown("> quoted text")).toBe("<blockquote>quoted text</blockquote>");
  });
});
