import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("football identities preserve the original name and add a secondary translation", () => {
  const page = source("../app/page.tsx");
  const localization = source("../src/lib/football-localization.ts");
  assert.match(page, /<span>\{name\}<\/span>/);
  assert.match(page, /translation \? <small>\{translation\}<\/small>/);
  assert.match(localization, /"Manchester City": "曼城"/);
  assert.match(localization, /"Real Madrid": "皇家马德里"/);
  assert.match(localization, /"Al Hilal": "利雅得新月"/);
  assert.match(localization, /"Shanghai Port": "上海海港"/);
  assert.match(localization, /NEC: "奈梅亨"/);
  assert.match(localization, /"Telstar 1963": "特尔斯达"/);
  assert.match(localization, /"Willem II Tilburg": "威廉二世"/);
  assert.match(localization, /"Deportivo de A Coruña": "拉科鲁尼亚"/);
  assert.match(localization, /"PSV Eindhoven": "埃因霍温"/);
  assert.match(localization, /"FC Internazionale Milano": "国际米兰"/);
  assert.match(localization, /"Vitória SC": "吉马良斯"/);
  assert.match(localization, /"CAR Independiente del Valle": "山谷独立"/);
  assert.match(localization, /中文译名待补充/);
  assert.match(localization, /chinesePlayerName\(name: string, verifiedTranslation = ""\)/);
  assert.match(localization, /if \(containsChinese\(supplied\)\) return supplied/);
  assert.match(localization, /if \(playerTranslations\[name\]\) return playerTranslations\[name\]/);
  assert.match(localization, /return "";\s*\n}/);
});

test("Chinese helper text stays visually subordinate to the original name", () => {
  const css = source("../app/globals.css");
  assert.match(css, /\.football-name > small/);
  assert.match(css, /font-size: 0\.68em/);
  assert.match(css, /font-weight: 500/);
  assert.match(css, /letter-spacing: 0/);
});

test("club and national-team labels have a distinct high-emphasis treatment", () => {
  const page = source("../app/page.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /team-kind-label \$\{team\.kind\}/);
  assert.match(css, /\.team-kind-label\.national/);
  assert.match(css, /\.team-kind-label \.ui-bilingual > span/);
  assert.match(css, /font-weight: 900/);
});

test("primary navigation and major workspaces expose Chinese and English together", () => {
  const page = source("../app/page.tsx");
  assert.match(page, /zh="赛前情报" en="Pre-match Intelligence"/);
  assert.match(page, /label: "选比赛", english: "Fixtures"/);
  assert.match(page, /zh="球队选择" en="Team Selection"/);
  assert.match(page, /zh="数据可视化" en="Data Visualization"/);
  assert.match(page, /zh="分析报告" en="Analysis Report"/);
});
