// ── Shared Word (.doc / .docx) Export Helper ─────────────────────────────────
// Produces editable Microsoft Word output from Word-compatible HTML.
//   • .doc  → MSO-flavoured HTML saved with the application/msword MIME type.
//   • .docx → real OOXML package via html-docx-js (htmlDocx.asBlob), which embeds
//             the same HTML as an editable altChunk. Inlined base64 images only.
// Both formats share ONE HTML builder per document, sized to A4 via the standard
// Word "Section1" page-setup mechanism so fonts/margins match in either format.
// Exposed as window.WordExport.
window.WordExport = (function () {
  'use strict';

  // ── HTML escaping for raw user values ──
  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Convert an already-loaded <img> element to a base64 PNG data URI ──
  // Reuses images the browser has already fetched (same-origin → untainted canvas),
  // avoiding a second network request. Results are cached by element src.
  const _imgCache = {};
  function imgElToDataURL(img) {
    if (!img) return '';
    const key = img.src || img.currentSrc || '';
    if (_imgCache[key]) return _imgCache[key];
    try {
      // Already a data URI (e.g. onerror SVG fallback) - use directly.
      if (key.startsWith('data:')) { _imgCache[key] = key; return key; }
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return '';
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL('image/png');
      _imgCache[key] = data;
      return data;
    } catch (e) {
      console.warn('WordExport: could not rasterize logo', e);
      return '';
    }
  }

  // Look up a logo <img> by CSS selector and return its data URI.
  function getLogoDataURL(selector) {
    return imgElToDataURL(document.querySelector(selector));
  }

  // ── Paragraph builder with Times New Roman + point sizing ──
  // opts: { size(pt), bold, italic, color, align, mt(pt), mb(pt), lh, spacing(pt) }
  function p(content, opts) {
    const o = opts || {};
    const styles = [
      "font-family:'Times New Roman',Times,serif",
      'font-size:' + (o.size != null ? o.size : 12) + 'pt',
      'text-align:' + (o.align || 'center'),
      'margin:' + (o.mt != null ? o.mt : 0) + 'pt 0 ' + (o.mb != null ? o.mb : 4) + 'pt 0',
      'line-height:' + (o.lh != null ? o.lh : 1.3)
    ];
    if (o.bold) styles.push('font-weight:bold');
    if (o.italic) styles.push('font-style:italic');
    if (o.color) styles.push('color:' + o.color);
    if (o.spacing) styles.push('letter-spacing:' + o.spacing + 'pt');
    return '<p style="' + styles.join(';') + '">' + (content || '&nbsp;') + '</p>';
  }

  // ── Centered image ──
  function img(dataUrl, heightPt) {
    if (!dataUrl) return '';
    return '<p align="center" style="margin:6pt 0;text-align:center;">' +
      '<img src="' + dataUrl + '" style="height:' + heightPt + 'pt;" /></p>';
  }

  // Hard page break inside a Word section.
  const pageBreak = "<br clear='all' style='mso-special-character:line-break;page-break-before:always'>";

  // ── Build the full MSO HTML document (A4, Times New Roman) ──
  function buildShell(bodyHtml, opts) {
    const o = opts || {};
    const title = esc(o.title || 'DBIT PageCraft Document');
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + title + '</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument>' +
      '<w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>' +
      '</w:WordDocument></xml><![endif]-->' +
      '<style>' +
      '@page Section1 { size:595.3pt 841.9pt; margin:1.4cm 1.6cm 1.4cm 1.6cm; mso-page-orientation:portrait; }' +
      'div.Section1 { page:Section1; }' +
      "body { font-family:'Times New Roman',Times,serif; color:#000; font-size:12pt; }" +
      'p { margin:0 0 4pt 0; }' +
      'table { border-collapse:collapse; }' +
      '</style></head><body><div class="Section1">' +
      bodyHtml +
      '</div></body></html>';
  }

  // ── Trigger a browser download for a Blob ──
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ── Build an MHTML (multipart/related) package from a full HTML document ──
  // Inline base64 images are split into separate MIME parts referenced by a
  // relative Content-Location, so Microsoft Word renders them (Word's plain
  // HTML-as-.doc renderer cannot display data: URIs).
  function buildMhtml(html) {
    const boundary = '----=_NextPart_DBIT_' + Date.now();
    const images = [];
    let idx = 0;
    const htmlWithRefs = html.replace(
      /src="data:image\/(png|jpe?g);base64,([^"]+)"/g,
      function (m, ext, data) {
        idx++;
        const type = (ext === 'jpg' ? 'jpeg' : ext);
        const name = 'image' + String(idx).padStart(3, '0') + '.' + type;
        images.push({ name: name, type: type, data: data });
        return 'src="' + name + '"';
      }
    );

    const b64utf8 = function (str) { return btoa(unescape(encodeURIComponent(str))); };
    const wrap76 = function (b64) { return b64.replace(/(.{76})/g, '$1\r\n'); };
    const base = 'file:///C:/dbit/';

    let out = '';
    out += 'MIME-Version: 1.0\r\n';
    out += 'Content-Type: multipart/related; boundary="' + boundary + '"\r\n\r\n';
    // HTML part (base64 to stay binary-safe with UTF-8 content)
    out += '--' + boundary + '\r\n';
    out += 'Content-Location: ' + base + 'main.htm\r\n';
    out += 'Content-Type: text/html; charset="utf-8"\r\n';
    out += 'Content-Transfer-Encoding: base64\r\n\r\n';
    out += wrap76(b64utf8(htmlWithRefs)) + '\r\n';
    // Image parts
    images.forEach(function (im) {
      out += '--' + boundary + '\r\n';
      out += 'Content-Location: ' + base + im.name + '\r\n';
      out += 'Content-Type: image/' + im.type + '\r\n';
      out += 'Content-Transfer-Encoding: base64\r\n\r\n';
      out += wrap76(im.data) + '\r\n';
    });
    out += '--' + boundary + '--\r\n';
    return out;
  }

  // ── Public: save as .doc (editable Word) ──
  // Uses MHTML packaging when images are present so logos render; falls back to
  // plain MSO HTML otherwise.
  function downloadDoc(filenameBase, bodyHtml, opts) {
    const html = buildShell(bodyHtml, opts);
    let blob;
    if (/src="data:image\//.test(html)) {
      blob = new Blob([buildMhtml(html)], { type: 'application/msword' });
    } else {
      blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    }
    saveBlob(blob, filenameBase + '.doc');
  }

  // ── Public: save as .docx (real OOXML via html-docx-js) ──
  // html-docx-js defaults to US Letter; if JSZip is available we patch the
  // section page size to A4 (210×297mm = 11906×16838 twips).
  async function downloadDocx(filenameBase, bodyHtml, opts) {
    if (typeof htmlDocx === 'undefined' || !htmlDocx.asBlob) {
      throw new Error('html-docx-js (htmlDocx) is not loaded.');
    }
    const html = buildShell(bodyHtml, opts);
    let blob = htmlDocx.asBlob(html, { orientation: 'portrait' });

    if (typeof JSZip !== 'undefined') {
      try {
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const docFile = zip.file('word/document.xml');
        if (docFile) {
          let xml = await docFile.async('string');
          xml = xml.replace(/<w:pgSz\b[^>]*\/>/g, '<w:pgSz w:w="11906" w:h="16838" w:orient="portrait" />');
          zip.file('word/document.xml', xml);
          blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
        }
      } catch (e) {
        console.warn('WordExport: A4 page-size patch skipped (using Letter):', e);
      }
    }
    saveBlob(blob, filenameBase + '.docx');
  }

  return {
    esc: esc,
    p: p,
    img: img,
    pageBreak: pageBreak,
    getLogoDataURL: getLogoDataURL,
    imgElToDataURL: imgElToDataURL,
    buildShell: buildShell,
    saveBlob: saveBlob,
    downloadDoc: downloadDoc,
    downloadDocx: downloadDocx
  };
})();
