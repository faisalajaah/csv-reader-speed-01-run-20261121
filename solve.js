// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program).
//
// run(input) answers exactly what csv-reader's readCsv returns for
// {text, header}: {columns, rows, errors}. The reference reads one character
// at a time and builds every field a character at a time; this version reads
// the same text once, left to right, with the same broken-row policy, but
// finds each field's end by scanning code units and cuts fields out with
// slice() instead of concatenating them, so a field costs one slice (plus a
// join only when a stray CR, a doubled quote or a CR inside quotes splits
// it). The field scanners are inlined in the record loop: no call and no
// return value per field, so the only per-field allocation is the field
// string itself (which the answer has to hold anyway).
//
// Policy (csv-reader 1.0.0, as its vendor code reads it):
// - a U+FEFF at the very start of the text is dropped;
// - a record ends at LF or CRLF, and a line left with no characters is no
//   record;
// - outside a quoted field a CR not followed by LF is dropped (stray_cr);
// - a field that opens with a quote runs to the next quote that is not
//   doubled, "" inside it one quote, and each CRLF or lone CR inside it is
//   read as LF; what follows its closing quote, up to the next comma or line
//   break, is appended as it stands (quote_junk, when the field ends); a
//   quote that never closes is a literal character, and the text after it is
//   read again as an unquoted field (unterminated_quote);
// - a quote inside an unquoted field is a literal character; fields stay
//   strings, never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds
//   the records after it (every record when header is false), each padded
//   with "" (short_row, with fields: its count) or cut (long_row, with
//   extra: the cut fields) to the first record's width;
// - each error is {code, line, row}: line the 1-based line its record starts
//   on (every LF, CRLF and lone CR inside a quoted field counted), row its
//   record's index in rows (null for the header), in the order met, a
//   field's quote_junk when the field ends and a record's short_row or
//   long_row when the record ends.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // Scans an unquoted field starting at `s`, with `prefix` already part of
  // its value. Only the rare paths use this (quote junk, an unterminated
  // quote re-read); the common unquoted field is inlined in the record loop
  // below so it pays no call or return value. Returns [value, ended,
  // endPos, lineAfter, kept], where ended is COMMA, LINE_BREAK or END and
  // kept is how many characters this scan appended (only the quote-junk
  // path reads it: junk counts only when kept > 0). `recLine`/`recRow` are
  // the current record's line and row, which stray_cr errors are charged to.
  function scanU(s, prefix, ln, recLine, recRow) {
    let i = s;
    let segStart = s;
    let parts = prefix === '' ? null : [prefix];
    let stray = 0;
    let end = END;
    let fieldEnd = n;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44) {
        end = COMMA;
        fieldEnd = i;
        i += 1;
        break;
      }
      if (c === 10) {
        end = LINE_BREAK;
        fieldEnd = i;
        ln += 1;
        i += 1;
        break;
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          end = LINE_BREAK;
          fieldEnd = i;
          ln += 1;
          i += 2;
          break;
        }
        errors.push({ code: 'stray_cr', line: recLine, row: recRow });
        stray += 1;
        if (parts === null) parts = [text.slice(segStart, i)];
        else parts.push(text.slice(segStart, i));
        i += 1;
        segStart = i;
        continue;
      }
      i += 1;
    }
    let value;
    if (parts === null) value = text.slice(segStart, fieldEnd);
    else {
      parts.push(text.slice(segStart, fieldEnd));
      value = parts.join('');
    }
    return [value, end, i, ln, fieldEnd - s - stray];
  }

  for (;;) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recLine = line;
    const recRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = COMMA;
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        let i = pos + 1;
        let segStart = i;
        let parts = null;
        let value = '';
        let closed = false;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 34) {
            if (text.charCodeAt(i + 1) === 34) {
              if (parts === null) parts = [text.slice(segStart, i)];
              else parts.push(text.slice(segStart, i));
              parts.push('"');
              i += 2;
              segStart = i;
              continue;
            }
            if (parts === null) value = text.slice(segStart, i);
            else {
              parts.push(text.slice(segStart, i));
              value = parts.join('');
            }
            closed = true;
            const j = i + 1;
            if (j >= n) {
              ended = END;
              pos = j;
            } else {
              const d = text.charCodeAt(j);
              if (d === 44) {
                ended = COMMA;
                pos = j + 1;
              } else if (d === 10) {
                ended = LINE_BREAK;
                line += 1;
                pos = j + 1;
              } else if (d === 13 && text.charCodeAt(j + 1) === 10) {
                ended = LINE_BREAK;
                line += 1;
                pos = j + 2;
              } else {
                const junk = scanU(j, value, line, recLine, recRow);
                if (junk[4] > 0) errors.push({ code: 'quote_junk', line: recLine, row: recRow });
                value = junk[0];
                ended = junk[1];
                pos = junk[2];
                line = junk[3];
              }
            }
            break;
          }
          if (c === 13) {
            if (parts === null) parts = [text.slice(segStart, i)];
            else parts.push(text.slice(segStart, i));
            parts.push('\n');
            line += 1;
            i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
            segStart = i;
            continue;
          }
          if (c === 10) line += 1;
          i += 1;
        }
        if (!closed) {
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          const u = scanU(open + 1, '"', openLine, recLine, recRow);
          value = u[0];
          ended = u[1];
          pos = u[2];
          line = u[3];
        }
        fields.push(value);
      } else {
        quoted = false;
        let i = pos;
        let segStart = pos;
        let parts = null;
        let fieldEnd = n;
        ended = END;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 44) {
            ended = COMMA;
            fieldEnd = i;
            i += 1;
            break;
          }
          if (c === 10) {
            ended = LINE_BREAK;
            fieldEnd = i;
            line += 1;
            i += 1;
            break;
          }
          if (c === 13) {
            if (text.charCodeAt(i + 1) === 10) {
              ended = LINE_BREAK;
              fieldEnd = i;
              line += 1;
              i += 2;
              break;
            }
            errors.push({ code: 'stray_cr', line: recLine, row: recRow });
            if (parts === null) parts = [text.slice(segStart, i)];
            else parts.push(text.slice(segStart, i));
            i += 1;
            segStart = i;
            continue;
          }
          i += 1;
        }
        let value;
        if (parts === null) value = text.slice(segStart, fieldEnd);
        else {
          parts.push(text.slice(segStart, fieldEnd));
          value = parts.join('');
        }
        pos = i;
        fields.push(value);
      }
    } while (ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
