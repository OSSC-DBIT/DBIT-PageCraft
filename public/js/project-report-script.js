// ── Project Report Generator Script ─────────────────────────────────────────

// ── Analytics - records are posted to this server's /api/generations ──
function logGeneration(type) {
  const students = getStudents();
  const record = {
    page: 'project-report',
    type,
    student_name: students[0]?.name || '',
    usn: students[0]?.usn || '',
    subject: document.getElementById('f-project-title')?.value || '',
    semester: getVal('semester'),
    branch: getVal('branch'),
  };
  if (window.Analytics) Analytics.log(record);
}

// ── Required-field validation (shared by every export path) ──
const generatorForm = document.getElementById('generator-form');
function validateRequiredFields() {
  if (!generatorForm.checkValidity()) {
    generatorForm.reportValidity();
    return false;
  }
  return true;
}

// Ask for email on the first export, then remember it (see js/email-gate.js)
if (window.EmailGate) {
  EmailGate.gate('#btn-download, #btn-merge, #btn-export-docx, #btn-export-doc');
}

// ── "Other" fields ──
const otherFields = {
  phase:    { select: document.getElementById('f-phase'),    input: document.getElementById('f-phase-other') },
  degree:   { select: document.getElementById('f-degree'),   input: document.getElementById('f-degree-other') },
  branch:   { select: document.getElementById('f-branch'),   input: document.getElementById('f-branch-other') },
  semester: { select: document.getElementById('f-semester'),  input: document.getElementById('f-semester-other') },
};

function getVal(key) {
  if (otherFields[key]) {
    const { select, input } = otherFields[key];
    return select.value === '__other__' ? input.value : select.value;
  }
  return '';
}

Object.entries(otherFields).forEach(([key, { select, input }]) => {
  select.addEventListener('input', () => {
    input.style.display = select.value === '__other__' ? 'block' : 'none';
    input.required = select.value === '__other__';
    updatePreview();
  });
  input.addEventListener('input', updatePreview);
});

// ── Students ──
const studentsContainer = document.getElementById('students-container');

// Single builder for a student row. Values are assigned through DOM properties
// (never string-interpolated into HTML) so names from the URL API, the cache
// or the demo button can never inject markup.
function addStudentEntry(name, usn) {
  const n = studentsContainer.children.length + 1;
  const div = document.createElement('div');
  div.className = 'student-entry';
  const row = document.createElement('div');
  row.className = 'form-row';

  function group(labelText, cls, value, placeholder) {
    const g = document.createElement('div');
    g.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = cls;
    input.required = true;
    input.placeholder = placeholder;
    input.value = value || '';
    input.addEventListener('input', updatePreview);
    g.append(label, input);
    return g;
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn-remove-student';
  remove.title = 'Remove';
  remove.textContent = '×';
  remove.addEventListener('click', () => { div.remove(); updatePreview(); });

  row.append(group('Name', 's-name', name, `Student ${n} Name`), group('USN', 's-usn', usn, 'USN'), remove);
  div.appendChild(row);
  studentsContainer.appendChild(div);
  return div;
}

document.getElementById('btn-add-student').addEventListener('click', () => { addStudentEntry('', ''); });
studentsContainer.querySelectorAll('input').forEach(i => i.addEventListener('input', updatePreview));
studentsContainer.querySelectorAll('.btn-remove-student').forEach(btn => {
  btn.addEventListener('click', () => { btn.closest('.student-entry').remove(); updatePreview(); });
});

function getStudents() {
  const entries = studentsContainer.querySelectorAll('.student-entry');
  const students = [];
  entries.forEach(e => {
    const name = e.querySelector('.s-name').value.trim();
    const usn = e.querySelector('.s-usn').value.trim();
    if (name || usn) students.push({ name, usn });
  });
  return students;
}

// ── Bind all inputs ──
document.querySelectorAll('#generator-form input[type="text"], #generator-form select').forEach(el => {
  el.addEventListener('input', updatePreview);
});

// ── Update Preview ──
function updatePreview() {
  const projectTitle = document.getElementById('f-project-title').value.trim();
  const phase = getVal('phase');
  const degree = getVal('degree');
  const branch = getVal('branch');
  const semester = getVal('semester');
  const academicYear = document.getElementById('f-academic-year').value.trim();
  const department = document.getElementById('f-department').value.trim();
  const departmentFull = document.getElementById('f-department-full').value.trim();
  const guideName = document.getElementById('f-guide-name').value.trim();
  const guideTitle = document.getElementById('f-guide-title').value.trim();
  const hodName = document.getElementById('f-hod-name').value.trim();
  const hodQualification = document.getElementById('f-hod-qualification').value.trim();
  const hodTitle = document.getElementById('f-hod-title').value.trim();
  const principalName = document.getElementById('f-principal-name').value.trim();
  const principalQualification = document.getElementById('f-principal-qualification').value.trim();
  const coordinatorName = document.getElementById('f-coordinator-name').value.trim();
  const coordinatorTitle = document.getElementById('f-coordinator-title').value.trim();
  const students = getStudents();
  const deptUpper = departmentFull.toUpperCase();

  // ══════════ PAGE 1: TITLE PAGE ══════════
  setText('t-phase', phase);
  setText('t-project-title', projectTitle ? `\u201C${projectTitle}\u201D` : '');
  setText('t-degree', degree);
  setText('t-branch', branch);
  setText('t-academic-year', academicYear);
  setText('t-department-upper', deptUpper);
  setText('t-guide-name-p1', guideName.toUpperCase());
  setText('t-guide-title-p1', guideTitle);
  setText('t-guide-dept-p1', `Department of ${department}`);

  // Students table on title page
  const tableEl = document.getElementById('t-students-table');
  if (students.length) {
    tableEl.innerHTML = '<table>' + students.map(s =>
      `<tr><td>${esc(s.name.toUpperCase())}</td><td>${esc(s.usn)}</td></tr>`
    ).join('') + '</table>';
  } else {
    tableEl.innerHTML = '';
  }

  // ══════════ PAGE 2: CERTIFICATE ══════════
  setText('t2-department-upper', deptUpper);
  setText('t2-guide-name', guideName);
  setText('t2-guide-title-cert', guideTitle);
  setText('t2-guide-dept', `Department of ${department}`);
  setText('t2-hod-name', hodName);
  setText('t2-hod-qualification', hodQualification);
  setText('t2-hod-title', hodTitle);
  setText('t2-hod-dept', `Department of ${department}`);
  setText('t2-principal-name', principalName);
  setText('t2-principal-qualification', principalQualification);

  // Certificate body - exact wording from PDF
  const studentsStrCert = students.map(s => `<strong>${esc(s.name)} (${esc(s.usn)})</strong>`).join(', ');
  document.getElementById('t-cert-body').innerHTML =
    `<p>This is to certify that the Project Work \u201C<strong>${esc(projectTitle)}</strong>\u201D has been carried out by ${studentsStrCert || '________'} the bonafide students of <strong>Don Bosco Institute of Technology, Bengaluru</strong>, in the partial fulfillment for award of Degree of <strong>${esc(degree)} in ${esc(branch)}</strong> of <strong>Visvesvaraya Technological University, Belagavi</strong>, during the academic year ${esc(academicYear)}. The Project Work has been approved as it satisfies the academic requirements in respect of the Project Work prescribed for the ${esc(degree)} Degree.</p>`;

  // ══════════ PAGE 3: DECLARATION ══════════
  setText('t3-department-upper', deptUpper);

  // Declaration body - exact wording from PDF
  const studentsStrDecl = students.map(s => `<strong>${esc(s.name)} (${esc(s.usn)})</strong>`).join(', ');
  document.getElementById('t-decl-body').innerHTML =
    `<p>We, ${studentsStrDecl || '________'} students of ${esc(semester)} semester B.E, at the Department of ${esc(branch)}, Don Bosco Institute of Technology, Bengaluru, declare that the Project Work entitled \u201C<strong>${esc(projectTitle)}</strong>\u201D has been carried out by us and submitted in partial fulfillment of the course requirements for the award of degree in <strong>${esc(degree)}</strong> in <strong>${esc(branch)}</strong> of <strong>Visvesvaraya Technological University, Belagavi</strong> during the academic year <strong>${esc(academicYear)}</strong>. The Project Work has been approved as it satisfies the academic requirements for the award of ${esc(degree)} Degree.</p>`;

  // Declaration student signatures
  const declSigs = document.getElementById('t-decl-students');
  if (students.length) {
    declSigs.innerHTML = '<table>' + students.map(s =>
      `<tr><td>${esc(s.name)}</td><td>(${esc(s.usn)})</td></tr>`
    ).join('') + '</table>';
  } else {
    declSigs.innerHTML = '';
  }

  // ══════════ PAGE 4: ACKNOWLEDGEMENT ══════════
  document.getElementById('t-ack-body').innerHTML = `
    <p>The satisfaction and euphoria that accompany the successful completion of any project is incomplete without mention of the people who made it possible and under whose constant guidance and encouragement the task was complete.</p>
    <p>We express our sincere gratitude to <strong>${esc(principalName)}, Principal and Management, Don Bosco Institute of Technology, Bengaluru</strong> for his timely help and inspiration during tenure of the course.</p>
    <p>We express our profuse gratitude to <strong>${esc(hodName)}</strong>, Professor and <strong>Head of the Department of ${esc(departmentFull)}</strong>, for his timely co-operation while carrying the Project Work.</p>
    <p>We express our profuse gratitude to <strong>${esc(guideName)}, ${esc(guideTitle)}, Department of ${esc(departmentFull)}</strong>, Don Bosco Institute of Technology, Bengaluru, for guiding us with numerous helpful discussions. We also thank our guide for valuable guidance, encouragement and inspiration for carrying out the Project Work.${coordinatorName ? ` We express our acknowledgement to our project coordinator <strong>${esc(coordinatorName)}, ${esc(coordinatorTitle)},</strong> ${esc(department)} Dept. for extending her direction and support during the completion of Project.` : ''}</p>
    <p>We would like to express our heartfelt gratitude to Teaching Faculty Members &amp; Non-Teaching staff members, who have directly or indirectly helped us in completion of the Project Work successfully.</p>
  `;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Zoom Controls ──
let zoomLevel = window.innerWidth <= 768 ? 0.3 : 0.55;
const templateRoot = document.getElementById('template-root');
const zoomLevelText = document.getElementById('zoom-level');

function updateZoom() {
  templateRoot.style.transform = `scale(${zoomLevel})`;
  zoomLevelText.textContent = `${Math.round(zoomLevel * 100)}%`;
}
document.getElementById('btn-zoom-in').addEventListener('click', () => { if (zoomLevel < 1.5) { zoomLevel += 0.1; updateZoom(); } });
document.getElementById('btn-zoom-out').addEventListener('click', () => { if (zoomLevel > 0.2) { zoomLevel -= 0.1; updateZoom(); } });
updateZoom();

// ── Desktop-mode capture ──
async function capturePageDesktopMode(pageEl, renderScale) {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const originalViewport = viewportMeta ? viewportMeta.content : null;
  const originalTransform = templateRoot.style.transform;

  try {
    if (viewportMeta) viewportMeta.content = 'width=1200, initial-scale=1';
    templateRoot.style.transform = 'scale(1)';
    templateRoot.style.transformOrigin = 'top center';
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(pageEl, {
      scale: renderScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      scrollX: 0, scrollY: 0,
      windowWidth: 1200, windowHeight: 900,
    });
    return canvas;
  } finally {
    if (viewportMeta && originalViewport) viewportMeta.content = originalViewport;
    templateRoot.style.transform = originalTransform;
    updateZoom();
  }
}

// ── Get selected page indices ──
function getSelectedPages() {
  return [...document.querySelectorAll('.page-cb:checked')].map(cb => parseInt(cb.value));
}

// ── PDF Generation (selected pages) ──
document.getElementById('btn-download').addEventListener('click', async () => {
  const selected = getSelectedPages();
  if (!selected.length) { alert('Select at least one page to download.'); return; }
  if (!validateRequiredFields()) return;

  const btn = document.getElementById('btn-download');
  const originalText = btn.innerHTML;
  btn.innerText = 'Generating PDF...';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();

    const pages = document.querySelectorAll('#template-root .page');
    let first = true;
    for (const idx of selected) {
      if (!first) pdf.addPage();
      first = false;
      const canvas = await capturePageDesktopMode(pages[idx], 2);
      const imgData = canvas.toDataURL('image/png');
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    const students = getStudents();
    const fileName = `Project_Report_${(students[0]?.name || 'Report').replace(/\s+/g, '_')}.pdf`;
    pdf.save(fileName);
    logGeneration('REPORT_PDF');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

// ── PDF Merge ──
const uploadInput = document.getElementById('f-upload-pdf');
const uploadFilename = document.getElementById('upload-filename');
const uploadLabel = document.getElementById('upload-label');
const mergeBtn = document.getElementById('btn-merge');

uploadInput.addEventListener('change', () => {
  const file = uploadInput.files[0];
  if (file) {
    uploadFilename.textContent = file.name.length > 28 ? file.name.slice(0, 25) + '...' : file.name;
    uploadLabel.classList.add('has-file');
    mergeBtn.disabled = false;
  } else {
    uploadFilename.textContent = 'Click to upload PDF';
    uploadLabel.classList.remove('has-file');
    mergeBtn.disabled = true;
  }
});

mergeBtn.addEventListener('click', async () => {
  const file = uploadInput.files[0];
  if (!file) return;
  // Respect the page checkboxes, same as the plain PDF download.
  const selected = getSelectedPages();
  if (!selected.length) { alert('Select at least one page to include before merging.'); return; }
  if (!validateRequiredFields()) return;

  const originalText = mergeBtn.innerHTML;
  mergeBtn.innerText = 'Merging...';
  mergeBtn.disabled = true;

  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    const a4 = { width: 595.28, height: 841.89 };

    const pages = document.querySelectorAll('#template-root .page');
    for (const idx of selected) {
      const pageEl = pages[idx];
      if (!pageEl) continue;
      const canvas = await capturePageDesktopMode(pageEl, 2);
      const imgData = canvas.toDataURL('image/png');
      const base64 = imgData.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const tempDoc = await PDFDocument.create();
      const pngImage = await tempDoc.embedPng(imgBytes);
      const p = tempDoc.addPage([a4.width, a4.height]);
      p.drawImage(pngImage, { x: 0, y: 0, width: a4.width, height: a4.height });
      const [copied] = await merged.copyPages(tempDoc, [0]);
      merged.addPage(copied);
    }

    const uploadedBytes = await file.arrayBuffer();
    const uploadedPdf = await PDFDocument.load(uploadedBytes);
    const indices = Array.from({ length: uploadedPdf.getPageCount() }, (_, i) => i);
    const copiedPages = await merged.copyPages(uploadedPdf, indices);
    copiedPages.forEach(p => merged.addPage(p));

    const mergedBytes = await merged.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const students = getStudents();
    a.download = `Project_Report_Full_${(students[0]?.name || 'Report').replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logGeneration('REPORT_MERGE');
  } catch (err) {
    console.error('Merge failed:', err);
    alert('Failed to merge PDFs. Please try again.');
  } finally {
    mergeBtn.innerHTML = originalText;
    mergeBtn.disabled = false;
  }
});

// Initial render
updatePreview();

// ── Fill Demo Data ──
document.getElementById('btn-fill-demo').addEventListener('click', () => {
  document.getElementById('f-project-title').value = 'GESTURE2SPEECH: AI POWERED SIGN LANGUAGE INTERPRETATION SYSTEM';
  document.getElementById('f-phase').value = 'Phase-1';
  document.getElementById('f-degree').value = 'Bachelor of Engineering';
  document.getElementById('f-branch').value = 'Computer Science and Engineering';
  document.getElementById('f-semester').value = 'sixth';
  document.getElementById('f-academic-year').value = '2025-2026';
  document.getElementById('f-department').value = 'CS&E';
  document.getElementById('f-department-full').value = 'Computer Science & Engineering';
  document.getElementById('f-guide-name').value = 'HEMALATHA M';
  document.getElementById('f-guide-title').value = 'Assistant Professor';
  document.getElementById('f-hod-name').value = 'Dr. K B ShivaKumar';
  document.getElementById('f-hod-qualification').value = 'B.E, M.E, M.B.A, M.Phil, Ph.D';
  document.getElementById('f-hod-title').value = 'Professor and Head';
  document.getElementById('f-principal-name').value = 'Dr. Naghabhushana B S';
  document.getElementById('f-principal-qualification').value = 'B.E, M.Tech, Ph.D';
  document.getElementById('f-coordinator-name').value = 'Dr. Hemanth Kumar N P';
  document.getElementById('f-coordinator-title').value = 'Associate Professor';

  // Students
  const demoStudents = [
    { name: 'MAHESH KUMAR G', usn: '1DB23CS124' },
    { name: 'HRITTIK M', usn: '1DB23CS085' },
    { name: 'MITHUN N', usn: '1DB23CS131' },
    { name: 'JAYANTH K', usn: '1DB23CS091' },
  ];
  studentsContainer.innerHTML = '';
  demoStudents.forEach(s => addStudentEntry(s.name, s.usn));

  updatePreview();
});

// ─── Word Export (.doc / .docx) ───────────────────────────────────────────────
// Builds editable, Word-compatible HTML for the selected report pages (A4, Times
// New Roman) and exports via the shared WordExport helper. Reuses the already
// generated certificate/declaration/acknowledgement body HTML from the live DOM.
function frameReportPage(innerHtml) {
  // Blue frame approximating the on-screen page border (rounded corners and the
  // corner squares can't render in Word, so a solid blue border is used).
  return '<table width="100%" cellspacing="0" cellpadding="0" style="border:4pt solid #010080;">' +
    '<tr><td style="padding:22pt 26pt;">' + innerHtml + '</td></tr></table>';
}

function reportValues() {
  return {
    projectTitle: document.getElementById('f-project-title').value.trim(),
    phase: getVal('phase'),
    degree: getVal('degree'),
    branch: getVal('branch'),
    semester: getVal('semester'),
    academicYear: document.getElementById('f-academic-year').value.trim(),
    department: document.getElementById('f-department').value.trim(),
    departmentFull: document.getElementById('f-department-full').value.trim(),
    guideName: document.getElementById('f-guide-name').value.trim(),
    guideTitle: document.getElementById('f-guide-title').value.trim(),
    hodName: document.getElementById('f-hod-name').value.trim(),
    hodQualification: document.getElementById('f-hod-qualification').value.trim(),
    hodTitle: document.getElementById('f-hod-title').value.trim(),
    principalName: document.getElementById('f-principal-name').value.trim(),
    principalQualification: document.getElementById('f-principal-qualification').value.trim(),
    students: getStudents()
  };
}

function reportBodyBlock(html) {
  // Wrap a generated body (cert/decl/ack) with justified, double-spaced styling.
  return '<div style="font-family:\'Times New Roman\',Times,serif;font-size:12pt;' +
    'line-height:2;text-align:justify;">' + html + '</div>';
}

function reportPageNumber(numeral) {
  return '<table align="center" cellspacing="0" cellpadding="0" style="margin-top:24pt;width:150pt;">' +
    '<tr><td style="border-bottom:1pt solid #000;"></td></tr></table>' +
    WordExport.p(numeral, { size: 11, mt: 3 });
}

// PAGE 1 - Title page
function buildReportTitlePageWord(v) {
  const E = WordExport.esc, P = WordExport.p;
  const deptUpper = v.departmentFull.toUpperCase();
  let s = '';
  s += P('VISVESVARAYA TECHNOLOGICAL UNIVERSITY', { size: 18, bold: true, mb: 2 });
  s += P('\u201CJnana Sangama\u201D, Belagavi-590018', { size: 12, mb: 6 });
  s += WordExport.img(WordExport.getLogoDataURL('img.vtu-logo'), 80);
  s += P('A Project Report (' + E(v.phase) + ')', { size: 14, mt: 6, mb: 2 });
  s += P('on', { size: 14, bold: true, mb: 2 });
  s += P('\u201C' + E(v.projectTitle) + '\u201D', { size: 14, bold: true, color: '#ff0000', mb: 8 });
  s += P('Submitted in partial fulfilment of the requirements for the award of the Degree of', { size: 12, italic: true, mb: 3 });
  s += P(E(v.degree), { size: 14, color: '#b90000', mb: 2 });
  s += P('in', { size: 14, mb: 2 });
  s += P(E(v.branch), { size: 14, mb: 2 });
  s += P('by', { size: 14, mb: 4 });
  // Students table
  if (v.students.length) {
    s += '<table align="center" cellspacing="0" cellpadding="0" style="width:62%;font-family:\'Times New Roman\',Times,serif;font-size:14pt;">' +
      v.students.map(st =>
        '<tr><td style="text-align:left;padding:1pt 6pt;">' + E(st.name.toUpperCase()) + '</td>' +
        '<td style="text-align:right;padding:1pt 6pt;">' + E(st.usn) + '</td></tr>'
      ).join('') + '</table>';
  }
  s += P('Under the Guidance of', { size: 14, italic: true, color: '#006cb9', mt: 14, mb: 4 });
  s += P(E(v.guideName.toUpperCase()), { size: 14, bold: true, mb: 2 });
  s += P(E(v.guideTitle), { size: 12, mb: 2 });
  s += P('Department of ' + E(v.department), { size: 12, mb: 6 });
  s += WordExport.img(WordExport.getLogoDataURL('#page-1 img.dbit-logo, img.dbit-logo'), 70);
  s += P('DON BOSCO INSTITUTE OF TECHNOLOGY', { size: 14, bold: true, mt: 8, mb: 2 });
  s += P('DEPARTMENT OF ' + E(deptUpper), { size: 14, bold: true, color: '#006cb9', mb: 2 });
  s += P('Kumbalagodu,Mysuru Road, Bengaluru-560074', { size: 12, bold: true, mb: 2 });
  s += P(E(v.academicYear), { size: 12, bold: true });
  return frameReportPage(s);
}

// PAGE 2 - Certificate
function buildReportCertPageWord(v) {
  const E = WordExport.esc, P = WordExport.p;
  const deptUpper = v.departmentFull.toUpperCase();
  let s = '';
  s += P('DON BOSCO INSTITUTE OF TECHNOLOGY', { size: 16, bold: true, mb: 2 });
  s += P('Kumbalagodu, Mysore Road, Bangalore-560 074', { size: 12, bold: true, mb: 6 });
  s += P('DEPARTMENT OF ' + E(deptUpper), { size: 14, bold: true, mb: 6 });
  s += WordExport.img(WordExport.getLogoDataURL('img.dbit-logo'), 80);
  s += P('CERTIFICATE', { size: 16, mt: 12, mb: 2, spacing: 1 });
  s += '<table align="center" cellspacing="0" cellpadding="0" style="width:90pt;margin-bottom:14pt;">' +
    '<tr><td style="border-bottom:2pt solid #000;"></td></tr></table>';
  s += reportBodyBlock(document.getElementById('t-cert-body').innerHTML);
  // Signatures (3 columns)
  s += '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30pt;font-family:\'Times New Roman\',Times,serif;"><tr>' +
    '<td width="33%" style="text-align:center;vertical-align:top;">' +
      P('Signature of Guide', { size: 12, bold: true, mb: 26 }) +
      P('...................................', { size: 12, bold: true, mb: 4 }) +
      P(E(v.guideName), { size: 10, bold: true, mb: 1 }) +
      P(E(v.guideTitle), { size: 10, bold: true, mb: 1 }) +
      P('Department of ' + E(v.department), { size: 10, bold: true }) +
    '</td>' +
    '<td width="34%" style="text-align:center;vertical-align:top;">' +
      P('Signature of HOD', { size: 12, bold: true, mb: 26 }) +
      P('..................................', { size: 12, bold: true, mb: 4 }) +
      P(E(v.hodName), { size: 10, bold: true, mb: 1 }) +
      P(E(v.hodQualification), { size: 9, italic: true, mb: 1 }) +
      P(E(v.hodTitle), { size: 10, bold: true, mb: 1 }) +
      P('Department of ' + E(v.department), { size: 10, bold: true }) +
    '</td>' +
    '<td width="33%" style="text-align:center;vertical-align:top;">' +
      P('Signature of Principal', { size: 12, bold: true, mb: 26 }) +
      P('................................', { size: 12, bold: true, mb: 4 }) +
      P(E(v.principalName), { size: 10, bold: true, mb: 1 }) +
      P(E(v.principalQualification), { size: 9, italic: true, mb: 1 }) +
      P('Principal, DBIT', { size: 10, bold: true }) +
    '</td>' +
    '</tr></table>';
  return frameReportPage(s);
}

// PAGE 3 - Declaration
function buildReportDeclPageWord(v) {
  const E = WordExport.esc, P = WordExport.p;
  const deptUpper = v.departmentFull.toUpperCase();
  let s = '';
  s += P('DON BOSCO INSTITUTE OF TECHNOLOGY', { size: 16, bold: true, mb: 2 });
  s += P('Kumbalagodu, Mysuru Road, Bengaluru-560074', { size: 12, mb: 6 });
  s += P('DEPARTMENT OF ' + E(deptUpper), { size: 14, bold: true, mb: 6 });
  s += WordExport.img(WordExport.getLogoDataURL('img.dbit-logo'), 80);
  s += P('DECLARATION', { size: 16, bold: true, mt: 12, mb: 12 });
  s += reportBodyBlock(document.getElementById('t-decl-body').innerHTML);
  // Footer: Place left, student signatures right
  let sigs = '';
  if (v.students.length) {
    sigs = '<table align="right" cellspacing="0" cellpadding="0" style="font-family:\'Times New Roman\',Times,serif;font-size:12pt;font-weight:bold;">' +
      v.students.map(st =>
        '<tr><td style="text-align:left;padding:1pt 8pt;">' + E(st.name) + '</td>' +
        '<td style="text-align:left;padding:1pt 8pt;">(' + E(st.usn) + ')</td></tr>'
      ).join('') + '</table>';
  }
  s += '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30pt;"><tr>' +
    '<td width="40%" style="vertical-align:bottom;">' +
      P('Place: Bengaluru', { size: 12, bold: true, align: 'left' }) +
    '</td>' +
    '<td width="60%" style="vertical-align:bottom;text-align:right;">' + sigs + '</td>' +
    '</tr></table>';
  s += reportPageNumber('i');
  return frameReportPage(s);
}

// PAGE 4 - Acknowledgement
function buildReportAckPageWord(v) {
  const P = WordExport.p;
  let s = '';
  s += P('ACKNOWLEDGEMENT', { size: 18, bold: true, mb: 14 });
  s += reportBodyBlock(document.getElementById('t-ack-body').innerHTML);
  s += reportPageNumber('ii');
  return frameReportPage(s);
}

function buildReportWordBody() {
  updatePreview(); // ensure cert/decl/ack bodies are current in the DOM
  const v = reportValues();
  const builders = [
    buildReportTitlePageWord,
    buildReportCertPageWord,
    buildReportDeclPageWord,
    buildReportAckPageWord
  ];
  const selected = getSelectedPages();
  const pages = selected.map(idx => builders[idx](v));
  return pages.join(WordExport.pageBreak);
}

function exportReportWord(kind) {
  const selected = getSelectedPages();
  if (!selected.length) { alert('Select at least one page to download.'); return; }
  if (!validateRequiredFields()) return;
  const body = buildReportWordBody();
  const students = getStudents();
  const base = `Project_Report_${(students[0]?.name || 'Report').replace(/\s+/g, '_')}`;
  const title = document.getElementById('f-project-title').value || 'Project Report';
  if (kind === 'docx') {
    WordExport.downloadDocx(base, body, { title });
    logGeneration('REPORT_DOCX');
  } else {
    WordExport.downloadDoc(base, body, { title });
    logGeneration('REPORT_DOC');
  }
}

document.getElementById('btn-export-docx').addEventListener('click', () => {
  try { exportReportWord('docx'); }
  catch (e) { console.error('DOCX export failed:', e); alert('Failed to export .docx. Please try again.'); }
});
document.getElementById('btn-export-doc').addEventListener('click', () => {
  try { exportReportWord('doc'); }
  catch (e) { console.error('DOC export failed:', e); alert('Failed to export .doc. Please try again.'); }
});

// ─── Form Auto-Save (localStorage) ────────────────────────────────────────────
(function setupReportCache() {
  const KEY = 'dbit_pagecraft_report';
  const form = document.getElementById('generator-form');

  function collect() {
    const s = { fields: {}, students: getStudents(), pages: [] };
    form.querySelectorAll('input[type="text"], select').forEach(el => {
      if (el.id) s.fields[el.id] = el.value;
    });
    document.querySelectorAll('.page-cb').forEach(cb => s.pages.push({ v: cb.value, c: cb.checked }));
    return s;
  }

  function rebuildStudents(list) {
    if (!list || !list.length) return;
    studentsContainer.innerHTML = '';
    list.forEach(st => addStudentEntry(st.name, st.usn));
  }

  function apply(s) {
    if (!s) return;
    if (s.fields) {
      Object.keys(s.fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = s.fields[id];
      });
    }
    rebuildStudents(s.students);
    if (s.pages) {
      s.pages.forEach(p => {
        const cb = document.querySelector('.page-cb[value="' + p.v + '"]');
        if (cb) cb.checked = p.c;
      });
    }
    // Fire select listeners so "Other" inputs show/hide, then refresh preview
    form.querySelectorAll('select').forEach(el => el.dispatchEvent(new Event('input')));
    updatePreview();
  }

  apply(FormCache.load(KEY));

  const save = FormCache.debounce(() => FormCache.save(KEY, collect()));
  form.addEventListener('input', save);
  form.addEventListener('change', save);
  // Catch student add/remove (which don't fire form input/change)
  if (window.MutationObserver) {
    new MutationObserver(save).observe(studentsContainer, { childList: true });
  }
})();

// ── URL Parameters API ──
// Usage: /project-report?title=...&phase=...&degree=...&branch=...&semester=...&year=...&dept=...&deptFull=...&guide=...&guideTitle=...&hod=...&hodQual=...&hodTitle=...&principal=...&principalQual=...&coordinator=...&coordinatorTitle=...&students=Name1:USN1,Name2:USN2&download=true&pages=0,1,2,3
(function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('title') && !params.has('download')) return;

  const fieldMap = {
    title: 'f-project-title',
    phase: 'f-phase',
    degree: 'f-degree',
    branch: 'f-branch',
    semester: 'f-semester',
    year: 'f-academic-year',
    dept: 'f-department',
    deptFull: 'f-department-full',
    guide: 'f-guide-name',
    guideTitle: 'f-guide-title',
    hod: 'f-hod-name',
    hodQual: 'f-hod-qualification',
    hodTitle: 'f-hod-title',
    principal: 'f-principal-name',
    principalQual: 'f-principal-qualification',
    coordinator: 'f-coordinator-name',
    coordinatorTitle: 'f-coordinator-title',
  };

  // Fill fields
  for (const [param, elId] of Object.entries(fieldMap)) {
    const val = params.get(param);
    if (!val) continue;
    const el = document.getElementById(elId);
    if (!el) continue;
    if (el.tagName === 'SELECT') {
      // Try to match an option, otherwise use __other__
      const opt = [...el.options].find(o => o.value === val);
      if (opt) { el.value = val; }
      else {
        el.value = '__other__';
        const otherInput = document.getElementById(elId + '-other');
        if (otherInput) { otherInput.style.display = 'block'; otherInput.value = val; }
      }
    } else {
      el.value = val;
    }
  }

  // Students: format "Name1:USN1,Name2:USN2"
  const studentsParam = params.get('students');
  if (studentsParam) {
    studentsContainer.innerHTML = '';
    studentsParam.split(',').forEach(s => {
      const [name, usn] = s.split(':');
      if (!name || !name.trim()) return;
      addStudentEntry(name.trim(), (usn || '').trim());
    });
  }

  // Pages selection
  const pagesParam = params.get('pages');
  if (pagesParam) {
    const selected = pagesParam.split(',').map(Number);
    document.querySelectorAll('.page-cb').forEach(cb => {
      cb.checked = selected.includes(parseInt(cb.value));
    });
  }

  updatePreview();

  // Auto-download
  const dl = params.get('download');
  if (dl === 'true' || dl === 'pdf') {
    setTimeout(() => document.getElementById('btn-download').click(), 1000);
  } else if (dl === 'doc') {
    setTimeout(() => document.getElementById('btn-export-doc').click(), 1000);
  } else if (dl === 'docx') {
    setTimeout(() => document.getElementById('btn-export-docx').click(), 1000);
  }
})();
