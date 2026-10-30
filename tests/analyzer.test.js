const test = require("node:test");
const assert = require("node:assert");
const { analyze, findSkills } = require("../src/analyzer.js");

const names = (text) => findSkills(text).map((s) => s.name);

test("detects skills with special characters", () => {
  const found = names("Worked with C++, C# and Node.js daily.");
  assert.ok(found.includes("C++"));
  assert.ok(found.includes("C#"));
  assert.ok(found.includes("Node.js"));
});

test("java does not match inside javascript", () => {
  const found = names("I write JavaScript.");
  assert.ok(found.includes("JavaScript"));
  assert.ok(!found.includes("Java"));
});

test("aliases map to one canonical skill", () => {
  assert.deepStrictEqual(names("Built models with sklearn"), ["scikit-learn"]);
});

test("missing skills are reported", () => {
  const r = analyze("Python developer with Flask experience.", "Need Python, Django and Docker.");
  assert.deepStrictEqual(r.matchedSkills, ["Python"]);
  assert.deepStrictEqual(r.missingSkills.sort(), ["Django", "Docker"]);
});

test("score stays within 0-100 and rewards a better resume", () => {
  const jd = "React developer with JavaScript, TypeScript, Git and Docker experience.";
  const weak = analyze("I like cooking and travelling.", jd);
  const strong = analyze(
    "Experience: Built React and TypeScript apps in JavaScript. Projects use Git and Docker. " +
      "Skills: React. Education: B.E. Improved speed by 40% for 500 users. Developed, deployed, optimized, led.",
    jd
  );
  for (const r of [weak, strong]) assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(strong.score > weak.score);
});

test("quality checks flag missing contact info", () => {
  const r = analyze("Just some words about me.", "Python role");
  const email = r.checks.find((c) => c.id === "email");
  assert.strictEqual(email.ok, false);
});
