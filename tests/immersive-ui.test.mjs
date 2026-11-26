import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("immersive hero uses a bounded canvas particle field with complete cleanup", () => {
  const page = source("../app/page.tsx");
  const gateway = source("../src/components/experience-gateway.tsx");
  assert.match(page, /ImmersiveFieldLayer/);
  assert.match(gateway, /function ImmersiveFieldLayer\(\)/);
  assert.match(gateway, /className="field-particle-canvas"/);
  assert.match(gateway, /Math\.min\(finePointer \? 46 : 24/);
  assert.match(gateway, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(gateway, /new ResizeObserver\(resize\)/);
  assert.match(gateway, /window\.cancelAnimationFrame\(frame\)/);
  assert.match(gateway, /observer\.disconnect\(\)/);
});

test("the first-open gateway owns the immersive interaction", () => {
  const page = source("../app/page.tsx");
  const gateway = source("../src/components/experience-gateway.tsx");
  assert.match(page, /ExperienceGateway/);
  assert.match(gateway, /function ExperienceGateway/);
  assert.match(gateway, /className={`experience-gateway\$\{leaving \? " is-leaving" : ""\}`}/);
  assert.match(gateway, /进入分析台/);
  assert.match(gateway, /Enter workspace/);
  assert.match(page, /hasEnteredWorkspace/);
  assert.match(gateway, /gateway\.addEventListener\("pointermove", handlePointerMove\)/);
  assert.match(gateway, /--gateway-pointer-x/);
  assert.match(gateway, /window\.matchMedia\("\(pointer: coarse\)"\)\.matches/);
  assert.match(gateway, /window\.requestAnimationFrame\(applyPointer\)/);
});

test("gateway exposes three accessible tactical visualization lenses", () => {
  const page = source("../app/page.tsx");
  const gateway = source("../src/components/experience-gateway.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /ExperienceGateway/);
  assert.match(gateway, /activeLens/);
  assert.match(gateway, /阵型/);
  assert.match(gateway, /对位/);
  assert.match(gateway, /压迫/);
  assert.match(gateway, /role="group" aria-label="分析视图 Analysis view"/);
  assert.match(gateway, /aria-pressed={activeLens === lens\.id}/);
  assert.match(gateway, /data-lens={activeLens}/);
  assert.match(css, /\.gateway-pitch\[data-lens="matchups"\]/);
  assert.match(css, /\.gateway-pitch\[data-lens="pressure"\]/);
  assert.match(css, /\.gateway-player-node/);
});

test("workspace keeps scoped card spotlight and button magnetism without a custom cursor", () => {
  const page = source("../app/page.tsx");
  assert.match(page, /const workspaceInteractionRef = useRef/);
  assert.match(page, /classList\.add\("pointer-reactive"\)/);
  assert.match(page, /--magnet-x/);
  assert.match(page, /\.fixture-refresh-button/);
  assert.match(page, /const stadiumHeroRef = useRef/);
  assert.match(page, /hero\.addEventListener\("pointermove", handlePointerMove\)/);
  assert.match(page, /ref={stadiumHeroRef}/);
  assert.doesNotMatch(page, /appShellRef/);
  assert.doesNotMatch(page, /immersive-cursor/);
  assert.doesNotMatch(page, /--cursor-/);
});

test("motion styling includes a gateway, scoped hero scene, and reduced-motion fallback", () => {
  const css = source("../app/globals.css");
  assert.match(css, /\.experience-gateway/);
  assert.match(css, /@keyframes gatewaySceneReveal/);
  assert.match(css, /@keyframes workspaceReveal/);
  assert.match(css, /\.field-particle-canvas/);
  assert.match(css, /\.stadium-hero-inner[\s\S]*--scene-x/);
  assert.match(css, /\.pointer-reactive::before/);
  assert.match(css, /translate: var\(--magnet-x/);
  assert.match(css, /@media \(max-width: 760px\), \(pointer: coarse\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.immersive-cursor/);
  assert.doesNotMatch(css, /--cursor-/);
});
