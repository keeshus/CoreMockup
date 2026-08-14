import { parse } from 'parse5';

const MAX_ISSUES = 30;

export function validateHtml(html) {
  if (!html || !html.trim()) {
    return [{ severity: 'error', code: 'empty-document', message: 'Mockup is empty. Use write_mockup to create one.' }];
  }

  const issues = [];

  let doc;
  try {
    doc = parse(html, {
      onParseError: (err) => {
        if (issues.length < MAX_ISSUES) {
          issues.push({
            severity: 'error',
            code: err.code,
            message: `${err.code} at line ${err.startLine}, column ${err.startCol}`,
          });
        }
      },
    });
  } catch {
    return issues.length > 0 ? issues : [{ severity: 'error', code: 'parse-failed', message: 'Failed to parse the mockup HTML.' }];
  }

  const ids = new Map();
  let hasTitle = false;

  function walk(node) {
    if (!node || !node.childNodes) return;
    for (const child of node.childNodes) {
      if (child.tagName === 'title') hasTitle = true;
      if (child.attrs) {
        for (const attr of child.attrs) {
          if (attr.name === 'id') {
            const id = attr.value;
            if (ids.has(id)) {
              if (issues.length < MAX_ISSUES) {
                issues.push({ severity: 'error', code: 'duplicate-id', message: `Duplicate id "${id}" on <${child.tagName}>` });
              }
            } else {
              ids.set(id, true);
            }
          }
        }
      }
      if (child.childNodes) walk(child);
    }
  }

  walk(doc);

  const htmlContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const textContent = htmlContent.replace(/<[^>]+>/g, '').trim();

  if (!hasTitle && issues.length < MAX_ISSUES) {
    issues.push({ severity: 'warning', code: 'missing-title', message: 'No <title> tag found in the <head>.' });
  }
  if (!textContent && issues.length < MAX_ISSUES) {
    issues.push({ severity: 'warning', code: 'empty-body', message: 'The mockup has no visible text content.' });
  }
  if (html.length > 200000 && issues.length < MAX_ISSUES) {
    issues.push({ severity: 'warning', code: 'large-file', message: `Mockup is very large (${html.length} chars); consider splitting it.` });
  }

  return issues;
}
