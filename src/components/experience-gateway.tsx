"use client";

import { Activity, ArrowRight, BarChart3, Gauge, Radar, ShieldCheck, Swords, Users, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ImmersiveFieldLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    type FieldParticle = { x: number; y: number; vx: number; vy: number; radius: number; phase: number };

    let width = 0;
    let height = 0;
    let frame = 0;
    let particles: FieldParticle[] = [];
    const pointer = { x: 0, y: 0, active: false };

    const reseed = () => {
      const count = Math.max(18, Math.min(finePointer ? 46 : 24, Math.floor(width / 25)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.22,
        radius: 0.8 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2
      }));
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(density, 0, 0, density, 0, 0);
      reseed();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (pointer.active) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 145) {
            const force = (145 - distance) / 1450;
            particle.vx += (dx / distance) * force;
            particle.vy += (dy / distance) * force;
          }
        }

        particle.vx *= 0.992;
        particle.vy *= 0.992;
        particle.vx = Math.max(-0.46, Math.min(0.46, particle.vx));
        particle.vy = Math.max(-0.38, Math.min(0.38, particle.vy));
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;
      });

      for (let left = 0; left < particles.length; left += 1) {
        for (let right = left + 1; right < particles.length; right += 1) {
          const first = particles[left];
          const second = particles[right];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance > 92) continue;
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(second.x, second.y);
          ctx.strokeStyle = `rgba(184, 232, 181, ${(1 - distance / 92) * 0.18})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      particles.forEach((particle) => {
        const pulse = 0.72 + Math.sin(time * 0.0014 + particle.phase) * 0.28;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(214, 255, 184, ${0.28 + pulse * 0.36})`;
        ctx.fill();
      });

      if (pointer.active) {
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 26 + Math.sin(time * 0.004) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(196, 241, 154, 0.26)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    if (finePointer) {
      host.addEventListener("pointermove", handlePointerMove);
      host.addEventListener("pointerleave", handlePointerLeave);
    }
    resize();
    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return <canvas className="field-particle-canvas" ref={canvasRef} aria-hidden="true" />;
}

type ExperienceGatewayProps = {
  onEnter: () => void;
};

export function ExperienceGateway({ onEnter }: ExperienceGatewayProps) {
  const gatewayRef = useRef<HTMLElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [activeLens, setActiveLens] = useState<"formation" | "matchups" | "pressure">("formation");
  const gatewayLenses = [
    { id: "formation" as const, zh: "阵型", en: "Formation", icon: Workflow, detail: "空间结构与站位层次", detailEn: "Shape and positional structure" },
    { id: "matchups" as const, zh: "对位", en: "Matchups", icon: Swords, detail: "关键球员攻防关系", detailEn: "Key player duels and links" },
    { id: "pressure" as const, zh: "压迫", en: "Pressure", icon: Activity, detail: "推进通道与高压区域", detailEn: "Progression lanes and pressure zones" }
  ];
  const selectedLens = gatewayLenses.find((lens) => lens.id === activeLens) ?? gatewayLenses[0];

  useEffect(() => {
    const gateway = gatewayRef.current;
    if (!gateway || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let pendingPointer: { x: number; y: number } | null = null;

    const applyPointer = () => {
      frame = 0;
      if (!pendingPointer) return;
      const bounds = gateway.getBoundingClientRect();
      const localX = pendingPointer.x - bounds.left;
      const localY = pendingPointer.y - bounds.top;
      const xRatio = Math.max(-0.5, Math.min(0.5, localX / Math.max(1, bounds.width) - 0.5));
      const yRatio = Math.max(-0.5, Math.min(0.5, localY / Math.max(1, bounds.height) - 0.5));
      gateway.style.setProperty("--gateway-pointer-x", `${localX}px`);
      gateway.style.setProperty("--gateway-pointer-y", `${localY}px`);
      gateway.style.setProperty("--gateway-shift-x", `${xRatio * 18}px`);
      gateway.style.setProperty("--gateway-shift-y", `${yRatio * 12}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(applyPointer);
    };

    const resetPointer = () => {
      pendingPointer = null;
      gateway.style.setProperty("--gateway-shift-x", "0px");
      gateway.style.setProperty("--gateway-shift-y", "0px");
    };

    gateway.addEventListener("pointermove", handlePointerMove);
    gateway.addEventListener("pointerleave", resetPointer);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      gateway.removeEventListener("pointermove", handlePointerMove);
      gateway.removeEventListener("pointerleave", resetPointer);
    };
  }, []);

  useEffect(() => () => {
    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
  }, []);

  const enterWorkspace = () => {
    if (leaving) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onEnter();
      return;
    }
    setLeaving(true);
    enterTimerRef.current = window.setTimeout(onEnter, 620);
  };

  return (
    <main className={`experience-gateway${leaving ? " is-leaving" : ""}`} ref={gatewayRef}>
      <ImmersiveFieldLayer />
      <div className="gateway-atmosphere" aria-hidden="true" />

      <header className="gateway-topbar">
        <div className="gateway-brand">
          <span><Gauge size={20} aria-hidden="true" /></span>
          <div>
            <strong>PRE-MATCH INTELLIGENCE</strong>
            <small>赛前情报分析</small>
          </div>
        </div>
        <div className="gateway-live-status">
          <i aria-hidden="true" />
          DATA WORKSPACE · 数据工作台
        </div>
      </header>

      <section className="gateway-stage" aria-labelledby="gateway-title">
        <div className="gateway-copy">
          <p className="gateway-kicker"><span aria-hidden="true" /> EVIDENCE BEFORE OPINION · 数据先于结论</p>
          <h1 id="gateway-title">
            <span>FOOTBALL</span>
            <span>INTELLIGENCE</span>
            <small>足球赛前情报与概率预测</small>
          </h1>
          <p className="gateway-description">
            从实时赛程、球队状态、球员对位到 AI 概率分析，在一个工作台完成赛前判断。
            <small>Fixtures, squads, matchups and evidence-based probability analysis in one workspace.</small>
          </p>
          <button className="gateway-enter" type="button" onClick={enterWorkspace} disabled={leaving}>
            <span>
              <strong>{leaving ? "正在进入" : "进入分析台"}</strong>
              <small>{leaving ? "Opening workspace" : "Enter workspace"}</small>
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="gateway-pitch-scene">
          <div className="gateway-lens-control">
            <div>
              <small>VISUAL LENS</small>
              <strong>{selectedLens.zh} <span>{selectedLens.en}</span></strong>
            </div>
            <div className="gateway-lens-switch" role="group" aria-label="分析视图 Analysis view">
              {gatewayLenses.map((lens) => {
                const LensIcon = lens.icon;
                return (
                  <button
                    key={lens.id}
                    type="button"
                    className={activeLens === lens.id ? "active" : ""}
                    aria-pressed={activeLens === lens.id}
                    title={`${lens.zh} / ${lens.en}`}
                    onClick={() => setActiveLens(lens.id)}
                  >
                    <LensIcon size={14} aria-hidden="true" />
                    <span>{lens.zh}<small>{lens.en}</small></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gateway-pitch" data-lens={activeLens} aria-hidden="true">
            <i className="gateway-halfway" />
            <i className="gateway-center-circle" />
            <i className="gateway-box gateway-box-left" />
            <i className="gateway-box gateway-box-right" />
            <div className="gateway-player-nodes">
              {Array.from({ length: 10 }, (_, index) => (
                <i className={`gateway-player-node ${index < 5 ? "home" : "away"}`} key={index}>
                  <span>{(index % 5) + 1}</span>
                </i>
              ))}
            </div>
            <div className="gateway-matchup-links">
              <i /><i /><i /><i />
            </div>
            <div className="gateway-pressure-zones">
              <i /><i /><i />
            </div>
            <span className="gateway-scan"><Radar size={30} /></span>
          </div>
          <div className="gateway-lens-caption" aria-live="polite">
            <span><i aria-hidden="true" /> {selectedLens.zh}</span>
            <div><strong>{selectedLens.detail}</strong><small>{selectedLens.detailEn}</small></div>
          </div>
        </div>
      </section>

      <footer className="gateway-capabilities" aria-label="核心能力">
        <div><Activity size={17} aria-hidden="true" /><span><b>实时赛程</b><small>Live fixtures</small></span></div>
        <div><Users size={17} aria-hidden="true" /><span><b>球员对位</b><small>Player matchups</small></span></div>
        <div><ShieldCheck size={17} aria-hidden="true" /><span><b>来源校验</b><small>Source verification</small></span></div>
        <div><BarChart3 size={17} aria-hidden="true" /><span><b>概率分析</b><small>Probability model</small></span></div>
      </footer>
    </main>
  );
}
