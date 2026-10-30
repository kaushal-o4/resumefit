# ResumeFit Architecture

ResumeFit is a static web app. All work happens in the browser, so it needs no backend, database or API key, and hosting on GitHub Pages is free.

## Flow

```
 Resume (paste / PDF / TXT) ─┐
                             ├─► analyzer.js ─► report object ─► app.js renders UI
 Job description (paste) ────┘        ▲
                                      │
                                  skills.js (dictionary)
```

## Modules

### `src/skills.js`
A dictionary of `Category → Skill → [aliases]`. Adding a skill takes one line:

```js
Svelte: ["svelte", "sveltekit"],
```

### `src/analyzer.js`
Pure functions with no DOM access, so they can be unit-tested in Node.

| Function | Purpose |
|---|---|
| `findSkills(text)` | Returns every dictionary skill whose alias appears in `text`. Each alias is a regex with custom boundaries `(?<![a-z0-9+#])alias(?![a-z0-9+#])`, which matches `c++` and `node.js` but not `java` inside `javascript`. |
| `tokenize(text)` | Lowercases, splits into words and removes stopwords. |
| `topKeywords(jd)` | Ranks job-description words that aren't skills by frequency, then length, and keeps the top 12. Words are stemmed to a 7-character prefix so word forms match. |
| `qualityChecks(resume)` | 7 checks: email, phone, LinkedIn/GitHub, sections, metrics, action verbs, length. |
| `analyze(resume, jd)` | Combines the above into a weighted score (60 / 25 / 15) and a list of suggestions. |

### `src/app.js`
Handles input events, PDF extraction with pdf.js (loaded from cdnjs), and renders the score ring, chips, category bars, checks and suggestions. Opening `index.html?demo` loads the sample and runs it immediately.

## Design decisions

- **No AI/LLM dependency.** The tool is instant, free, works offline after first load, and gives deterministic, explainable results.
- **Privacy first.** Resumes contain personal data, so nothing is uploaded.
- **No build step.** Plain JS keeps the project easy to read, fork and extend.

## Testing

`npm test` runs `tests/analyzer.test.js` with Node's built-in test runner. GitHub Actions runs it on every push.
