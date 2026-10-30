// UI wiring: reads inputs, calls ResumeFit.analyze, renders the report.
(function () {
  const $ = (id) => document.getElementById(id);
  const resumeEl = $("resume");
  const jdEl = $("jd");

  const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;
  const updateCounts = () => {
    $("resumeCount").textContent = `${wordCount(resumeEl.value)} words`;
    $("jdCount").textContent = `${wordCount(jdEl.value)} words`;
  };
  resumeEl.addEventListener("input", updateCounts);
  jdEl.addEventListener("input", updateCounts);

  $("sampleBtn").addEventListener("click", () => {
    resumeEl.value = window.SAMPLE.resume;
    jdEl.value = window.SAMPLE.jd;
    updateCounts();
    run();
  });

  $("resumeFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showError("");
    try {
      resumeEl.value = file.name.toLowerCase().endsWith(".pdf") ? await readPdf(file) : await file.text();
      updateCounts();
    } catch (err) {
      showError("Couldn't read that file. Try copying the text and pasting it instead.");
    }
    e.target.value = "";
  });

  async function readPdf(file) {
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error("pdf.js not loaded");
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
    }
    return pages.join("\n");
  }

  $("analyzeBtn").addEventListener("click", run);

  // index.html?demo opens straight into a filled-in sample report.
  if (new URLSearchParams(location.search).has("demo")) $("sampleBtn").click();

  function showError(msg) {
    $("error").textContent = msg;
  }

  function run() {
    if (wordCount(resumeEl.value) < 30) return showError("Please paste your full resume (at least 30 words).");
    if (wordCount(jdEl.value) < 15) return showError("Please paste the job description (at least 15 words).");
    showError("");
    render(window.ResumeFit.analyze(resumeEl.value, jdEl.value));
  }

  function chips(el, items, cls, empty) {
    el.innerHTML = "";
    if (!items.length) {
      el.innerHTML = `<span class="muted">${empty}</span>`;
      return;
    }
    for (const text of items) {
      const span = document.createElement("span");
      span.className = `chip ${cls}`;
      span.textContent = text;
      el.appendChild(span);
    }
  }

  function render(r) {
    $("results").hidden = false;

    const color = r.score >= 75 ? "var(--good)" : r.score >= 50 ? "var(--warn)" : "var(--bad)";
    const ring = $("ring");
    ring.style.setProperty("--c", color);
    animateNumber($("scoreNum"), r.score, (v) => ring.style.setProperty("--p", v));
    $("verdict").textContent = r.verdict;
    $("verdict").style.color = color;

    const fmt = (v) => (v === null ? "n/a" : `${v}%`);
    $("breakdown").innerHTML =
      `<li>Skills match <b>${fmt(r.breakdown.skills)}</b> <em>60% weight</em></li>` +
      `<li>Keyword match <b>${fmt(r.breakdown.keywords)}</b> <em>25% weight</em></li>` +
      `<li>Resume quality <b>${fmt(r.breakdown.quality)}</b> <em>15% weight</em></li>`;

    chips($("matched"), r.matchedSkills, "good", "No required skills found in your resume yet.");
    chips($("missing"), r.missingSkills, "bad", "Nothing missing. Nice!");
    $("keywords").innerHTML = "";
    chips($("keywords"), [...r.keywordsFound, ...r.keywordsMissing], "", "No keywords detected.");
    [...$("keywords").children].forEach((c, i) => c.classList.add(i < r.keywordsFound.length ? "good" : "bad"));

    const cat = $("categories");
    cat.innerHTML = "";
    const entries = Object.entries(r.byCategory);
    if (!entries.length) cat.innerHTML = `<span class="muted">No known skills in this job description.</span>`;
    for (const [name, { matched, total }] of entries) {
      const pct = Math.round((matched / total) * 100);
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `<span>${name}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${matched}/${total}</b>`;
      cat.appendChild(row);
    }

    $("checks").innerHTML = "";
    for (const c of r.checks) {
      const li = document.createElement("li");
      li.className = c.ok ? "ok" : "fail";
      li.textContent = c.label;
      $("checks").appendChild(li);
    }

    $("suggestions").innerHTML = "";
    for (const s of r.suggestions) {
      const li = document.createElement("li");
      li.textContent = s;
      $("suggestions").appendChild(li);
    }

    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function animateNumber(el, target, onStep) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / 800, 1);
      const v = Math.round(target * (1 - Math.pow(1 - t, 3)));
      el.textContent = v;
      onStep(v);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
})();
