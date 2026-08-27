window.__ModuleLoader__.load({
  id: "@syncended/dsh-usage",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } = React;
    const inject = ["slots"];
    const API_PREFIX = "/api/usage";
    const RANGES = [
      { id: "30d", label: "30D" },
      { id: "90d", label: "90D" },
      { id: "365d", label: "1Y" },
      { id: "all", label: "All" },
    ];
    const METRICS = [
      { id: "totalTokens", label: "Tokens" },
      { id: "cost", label: "Cost" },
      { id: "calls", label: "Calls" },
    ];

    const STYLE_CSS = String.raw`
.dsh-usage-sidebar{box-sizing:border-box;width:100%;height:42px;display:flex;align-items:center;margin:4px 0 0}
.dsh-usage-sidebar-button{box-sizing:border-box;appearance:none;width:calc(100% + 4px);height:42px;margin:0 -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#101318);display:flex;align-items:center;gap:8px;overflow:hidden;font:500 14px/22px inherit;cursor:pointer}
.dsh-usage-sidebar-button:hover,.dsh-usage-sidebar-button[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}
.dsh-usage-sidebar-button:focus-visible,.dsh-usage-button:focus-visible,.dsh-usage-segment button:focus-visible{outline:2px solid var(--dsh-usage-accent,#5d73e6);outline-offset:2px}
.dsh-usage-sidebar-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-usage-sidebar-rail{width:36px;height:36px;margin:0}.dsh-usage-sidebar-rail .dsh-usage-sidebar-button{width:36px;height:36px;margin:0;padding:0;justify-content:center;border-radius:50%}
.dsh-usage-workspace{--dsh-usage-accent:#5d73e6;--dsh-usage-accent-2:#8a6de9;--dsh-usage-green:#27a56b;--dsh-usage-amber:#d68a22;--dsh-usage-text:var(--dsw-alias-label-primary,#15171b);--dsh-usage-muted:var(--dsw-alias-label-tertiary,#747984);--dsh-usage-border:var(--dsw-alias-border-l2,rgba(15,17,21,.12));--dsh-usage-card:var(--dsw-alias-bg-layer-2,#fff);--dsh-usage-soft:var(--dsw-alias-bg-layer-1,#f7f8fa);box-sizing:border-box;width:100%;height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsh-usage-text);background:var(--dsw-alias-bg-base,#fff);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dsh-usage-workspace *,.dsh-usage-workspace *::before,.dsh-usage-workspace *::after{box-sizing:border-box}
.dsh-usage-toolbar{height:54px;flex:none;display:flex;align-items:center;gap:10px;padding:0 18px;border-bottom:1px solid var(--dsh-usage-border);background:color-mix(in srgb,var(--dsw-alias-bg-base,#fff) 90%,transparent);backdrop-filter:blur(14px)}
.dsh-usage-brand{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#fff;background:linear-gradient(145deg,var(--dsh-usage-accent),var(--dsh-usage-accent-2));box-shadow:0 8px 20px color-mix(in srgb,var(--dsh-usage-accent) 24%,transparent)}
.dsh-usage-title{min-width:0;flex:1}.dsh-usage-title strong{display:block;font-size:14px;line-height:19px}.dsh-usage-title span{display:block;color:var(--dsh-usage-muted);font-size:11px;line-height:15px}
.dsh-usage-button{appearance:none;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsh-usage-border);border-radius:9px;padding:0 10px;color:var(--dsh-usage-text);background:var(--dsh-usage-card);font:500 12px/18px inherit;cursor:pointer}.dsh-usage-button:hover{background:var(--dsh-usage-soft)}.dsh-usage-button:disabled{cursor:progress;opacity:.55}
.dsh-usage-scroll{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;padding:28px clamp(18px,4vw,52px) 52px}
.dsh-usage-dashboard{width:min(1180px,100%);margin:0 auto;display:flex;flex-direction:column;gap:18px}
.dsh-usage-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}.dsh-usage-heading h1{margin:0;font-size:26px;line-height:1.2;letter-spacing:-.035em}.dsh-usage-heading p{margin:5px 0 0;color:var(--dsh-usage-muted);font-size:13px}.dsh-usage-segment{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--dsh-usage-border);border-radius:10px;background:var(--dsh-usage-soft)}.dsh-usage-segment button{appearance:none;height:28px;border:0;border-radius:7px;padding:0 10px;color:var(--dsh-usage-muted);background:transparent;font:600 11px/18px inherit;cursor:pointer}.dsh-usage-segment button[data-active="true"]{color:var(--dsh-usage-text);background:var(--dsh-usage-card);box-shadow:0 1px 3px rgba(15,17,21,.1)}
.dsh-usage-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.dsh-usage-card{position:relative;min-width:0;border:1px solid var(--dsh-usage-border);border-radius:16px;padding:16px;background:var(--dsh-usage-card);box-shadow:0 1px 2px color-mix(in srgb,var(--dsh-usage-text) 4%,transparent)}.dsh-usage-card::after{content:"";position:absolute;left:16px;right:16px;bottom:-1px;height:2px;border-radius:2px;background:var(--card-accent,var(--dsh-usage-accent));opacity:.85}.dsh-usage-card-label{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--dsh-usage-muted);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}.dsh-usage-card-value{margin-top:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:24px;font-weight:650;line-height:30px;letter-spacing:-.035em;font-variant-numeric:tabular-nums}.dsh-usage-card-detail{margin-top:3px;color:var(--dsh-usage-muted);font-size:11px;line-height:17px}
.dsh-usage-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,.85fr);gap:12px}.dsh-usage-panel{min-width:0;border:1px solid var(--dsh-usage-border);border-radius:16px;padding:17px;background:var(--dsh-usage-card)}.dsh-usage-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}.dsh-usage-panel-title{margin:0;font-size:14px;line-height:20px}.dsh-usage-panel-sub{margin:2px 0 0;color:var(--dsh-usage-muted);font-size:11px;line-height:16px}
.dsh-usage-chart{width:100%;height:auto;display:block;overflow:visible;touch-action:pan-y}.dsh-usage-chart:focus{outline:none}.dsh-usage-chart:focus-visible{outline:2px solid var(--dsh-usage-accent);outline-offset:4px;border-radius:8px}.dsh-usage-chart-grid{stroke:var(--dsh-usage-border);stroke-width:1}.dsh-usage-chart-line{fill:none;stroke:var(--dsh-usage-accent);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.dsh-usage-chart-dot{fill:var(--dsh-usage-card);stroke:var(--dsh-usage-accent);stroke-width:2}.dsh-usage-chart-hit{fill:transparent;cursor:crosshair}.dsh-usage-chart-crosshair{stroke:var(--dsh-usage-muted);stroke-width:1;stroke-dasharray:3 4;pointer-events:none}.dsh-usage-chart-active-dot{fill:var(--dsh-usage-accent);stroke:var(--dsh-usage-card);stroke-width:2.5;pointer-events:none}.dsh-usage-chart-label{fill:var(--dsh-usage-muted);font:10px Inter,system-ui,sans-serif}.dsh-usage-chart-tooltip{pointer-events:none;filter:drop-shadow(0 6px 12px rgba(15,17,21,.16))}.dsh-usage-chart-tooltip rect{fill:var(--dsh-usage-card);stroke:var(--dsh-usage-border)}.dsh-usage-chart-tooltip-title{fill:var(--dsh-usage-muted);font:10px Inter,system-ui,sans-serif}.dsh-usage-chart-tooltip-value{fill:var(--dsh-usage-text);font:600 12px Inter,system-ui,sans-serif}.dsh-usage-chart-tooltip-meta{fill:var(--dsh-usage-muted);font:10px Inter,system-ui,sans-serif}.dsh-usage-chart-empty{height:212px;display:grid;place-items:center;color:var(--dsh-usage-muted);font-size:12px}
.dsh-usage-mix{display:flex;align-items:center;gap:18px;min-height:215px}.dsh-usage-donut{position:relative;width:132px;height:132px;flex:none;border-radius:50%;background:conic-gradient(var(--dsh-usage-accent) 0 var(--mix-input),var(--dsh-usage-accent-2) var(--mix-input) var(--mix-output),var(--dsh-usage-green) var(--mix-output) var(--mix-cache),var(--dsh-usage-border) var(--mix-cache) 100%)}.dsh-usage-donut::after{content:"";position:absolute;inset:19px;border-radius:50%;background:var(--dsh-usage-card)}.dsh-usage-donut-center{position:absolute;z-index:1;inset:0;display:grid;place-content:center;text-align:center}.dsh-usage-donut-center strong{font-size:18px;line-height:22px}.dsh-usage-donut-center span{color:var(--dsh-usage-muted);font-size:10px}.dsh-usage-legend{min-width:0;flex:1;display:flex;flex-direction:column;gap:10px}.dsh-usage-legend-row{display:grid;grid-template-columns:9px minmax(0,1fr) auto;align-items:center;gap:8px;font-size:11px}.dsh-usage-legend-dot{width:8px;height:8px;border-radius:3px}.dsh-usage-legend-value{font-variant-numeric:tabular-nums;font-weight:600}
.dsh-usage-heat-interactive{position:relative}.dsh-usage-heat-wrap{overflow-x:auto;padding:3px 2px 5px}.dsh-usage-heat-layout{min-width:760px;display:flex;gap:9px}.dsh-usage-day-labels{width:24px;flex:none;display:grid;grid-template-rows:repeat(7,11px);gap:3px;padding-top:0;color:var(--dsh-usage-muted);font-size:8px;line-height:11px}.dsh-usage-heatmap{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;grid-auto-columns:11px;gap:3px}.dsh-usage-heat-cell{appearance:none;display:block;width:11px;height:11px;border:0;border-radius:2.5px;padding:0;background:var(--dsh-usage-heat-0)}button.dsh-usage-heat-cell{position:relative;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}button.dsh-usage-heat-cell:hover{z-index:1;transform:scale(1.28)}button.dsh-usage-heat-cell:focus{outline:none}button.dsh-usage-heat-cell:focus-visible,button.dsh-usage-heat-cell[data-active="true"]{z-index:2;box-shadow:0 0 0 2px var(--dsh-usage-card),0 0 0 4px var(--dsh-usage-accent-2)}.dsh-usage-heat-cell[data-level="1"]{background:color-mix(in srgb,var(--dsh-usage-green) 42%,var(--dsh-usage-card))}.dsh-usage-heat-cell[data-level="2"]{background:color-mix(in srgb,var(--dsh-usage-accent) 58%,var(--dsh-usage-card))}.dsh-usage-heat-cell[data-level="3"]{background:var(--dsh-usage-accent)}.dsh-usage-heat-cell[data-level="4"]{background:var(--dsh-usage-accent-2)}.dsh-usage-workspace{--dsh-usage-heat-0:color-mix(in srgb,var(--dsh-usage-muted) 10%,transparent)}.dsh-usage-heat-tooltip{position:absolute;z-index:5;width:220px;transform:translate(-50%,calc(-100% - 8px));pointer-events:none;border:1px solid var(--dsh-usage-border);border-radius:10px;padding:9px 11px;color:var(--dsh-usage-text);background:var(--dsh-usage-card);box-shadow:0 8px 22px rgba(15,17,21,.16)}.dsh-usage-heat-tooltip strong,.dsh-usage-heat-tooltip span{display:block}.dsh-usage-heat-tooltip strong{font-size:11px;line-height:16px}.dsh-usage-heat-tooltip span{color:var(--dsh-usage-muted);font-size:10px;line-height:15px}.dsh-usage-heat-tooltip b{color:var(--dsh-usage-text);font-weight:650}.dsh-usage-heat-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;color:var(--dsh-usage-muted);font-size:10px}.dsh-usage-heat-key{display:flex;align-items:center;gap:4px}.dsh-usage-heat-key b{margin-right:3px;color:var(--dsh-usage-text);font-weight:600}.dsh-usage-heat-key i{display:block;width:10px;height:10px;border-radius:2px}
.dsh-usage-model-list{display:flex;flex-direction:column}.dsh-usage-model-head,.dsh-usage-model-row{display:grid;grid-template-columns:minmax(170px,1.4fr) minmax(170px,1fr) 100px 82px;gap:14px;align-items:center}.dsh-usage-model-head{padding:0 9px 9px;color:var(--dsh-usage-muted);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.dsh-usage-model-row{min-height:58px;padding:9px;border-top:1px solid var(--dsh-usage-border);font-size:11px}.dsh-usage-model-name{min-width:0}.dsh-usage-model-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.dsh-usage-model-name span{display:block;margin-top:2px;color:var(--dsh-usage-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-usage-model-meter{height:5px;margin-top:6px;border-radius:3px;background:var(--dsh-usage-soft);overflow:hidden}.dsh-usage-model-meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--dsh-usage-accent),var(--dsh-usage-accent-2))}.dsh-usage-num{text-align:right;font-variant-numeric:tabular-nums}.dsh-usage-unpriced{color:var(--dsh-usage-amber);font-size:9px}
.dsh-usage-notice{border:1px solid color-mix(in srgb,var(--dsh-usage-amber) 30%,var(--dsh-usage-border));border-radius:12px;padding:10px 12px;color:var(--dsh-usage-muted);background:color-mix(in srgb,var(--dsh-usage-amber) 7%,transparent);font-size:11px;line-height:17px}.dsh-usage-loading,.dsh-usage-error{min-height:360px;display:grid;place-content:center;justify-items:center;gap:12px;color:var(--dsh-usage-muted);text-align:center}.dsh-usage-spinner{width:24px;height:24px;border:2px solid var(--dsh-usage-border);border-top-color:var(--dsh-usage-accent);border-radius:50%;animation:dsh-usage-spin .8s linear infinite}@keyframes dsh-usage-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){button.dsh-usage-heat-cell{transition:none}}
@media(max-width:900px){.dsh-usage-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-usage-grid{grid-template-columns:1fr}.dsh-usage-mix{min-height:170px}.dsh-usage-model-head,.dsh-usage-model-row{grid-template-columns:minmax(160px,1.3fr) minmax(150px,1fr) 90px}.dsh-usage-model-head>:last-child,.dsh-usage-model-row>:last-child{display:none}}
@media(max-width:560px){.dsh-usage-toolbar{padding:0 10px}.dsh-usage-title span{display:none}.dsh-usage-button-label{display:none}.dsh-usage-scroll{padding:20px 12px 36px}.dsh-usage-heading{align-items:flex-start;flex-direction:column}.dsh-usage-heading h1{font-size:22px}.dsh-usage-cards{grid-template-columns:1fr 1fr;gap:8px}.dsh-usage-card{padding:13px}.dsh-usage-card-value{font-size:20px}.dsh-usage-panel{padding:14px}.dsh-usage-panel-head{flex-wrap:wrap}.dsh-usage-mix{align-items:flex-start;flex-direction:column}.dsh-usage-donut{align-self:center}.dsh-usage-heat-footer{align-items:flex-start;flex-direction:column}.dsh-usage-model-head{display:none}.dsh-usage-model-row{grid-template-columns:minmax(0,1fr) auto;gap:10px}.dsh-usage-model-row>:nth-child(2){display:none}}
`;

    function UsageGlyph({ size = 18 }) {
      return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
        h("path", { d: "M4 19V9m5 10V5m5 14v-7m5 7V3" }),
        h("path", { d: "M2.5 19.5h18" }),
      );
    }

    function RefreshGlyph() {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, h("path", { d: "M20 6v5h-5M4 18v-5h5" }), h("path", { d: "M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5L20 15" }));
    }

    function createDisclosureStore() {
      let open = false;
      const listeners = new Set();
      const notify = () => listeners.forEach((listener) => listener());
      return {
        getSnapshot: () => open,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        toggle() { open = !open; notify(); },
        close() { if (open) { open = false; notify(); } },
        dispose() { open = false; listeners.clear(); },
      };
    }

    function formatCompact(value) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: value >= 1000000 ? 1 : 0 }).format(value);
    }
    function formatCost(value) {
      if (!Number.isFinite(value)) return "—";
      if (value === 0) return "$0.00";
      if (value < .01) return "<$0.01";
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
    }
    function formatMetric(value, metric) {
      if (metric === "cost") return formatCost(value);
      return formatCompact(value);
    }
    function formatExact(value) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
    }
    function formatDetailedCost(value) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: value < .01 ? 4 : 2 }).format(value);
    }
    function metricLabel(metric) {
      return metric === "cost" ? "Cost" : metric === "calls" ? "Calls" : "Tokens";
    }
    function formatMetricExact(value, metric) {
      return metric === "cost" ? formatDetailedCost(value) : formatExact(value);
    }
    function formatDate(date) {
      try { return new Date(date + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }); }
      catch { return date; }
    }
    function formatLongDate(date) {
      try { return new Date(date + "T00:00:00Z").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); }
      catch { return date; }
    }
    function dayDetails(day, metric) {
      if (metric === "totalTokens") return `${formatExact(day.calls || 0)} calls · ${formatDetailedCost(day.cost || 0)}`;
      if (metric === "calls") return `${formatExact(day.totalTokens || 0)} tokens · ${formatDetailedCost(day.cost || 0)}`;
      return `${formatExact(day.totalTokens || 0)} tokens · ${formatExact(day.calls || 0)} calls`;
    }
    function rangeDescription(snapshot) {
      if (!snapshot) return "Durable session analytics";
      return formatDate(snapshot.startDate) + " – " + formatDate(snapshot.endDate) + " · " + snapshot.timeZone;
    }

    function Segment({ values, selected, onChange, label }) {
      return h("div", { className: "dsh-usage-segment", role: "group", "aria-label": label }, values.map((value) => h("button", { key: value.id, type: "button", "data-active": value.id === selected ? "true" : undefined, "aria-pressed": value.id === selected, onClick: () => onChange(value.id) }, value.label)));
    }

    function StatCard({ label, value, detail, accent }) {
      return h("article", { className: "dsh-usage-card", style: { "--card-accent": accent } },
        h("div", { className: "dsh-usage-card-label" }, label),
        h("div", { className: "dsh-usage-card-value", title: value }, value),
        h("div", { className: "dsh-usage-card-detail" }, detail),
      );
    }

    function TrendChart({ days, metric }) {
      const width = 760, height = 220, left = 48, right = 10, top = 12, bottom = 28;
      const gradientId = "dsh-usage-area-" + useId().replace(/:/g, "");
      const [activeIndex, setActiveIndex] = useState(null);
      useEffect(() => setActiveIndex(null), [days, metric]);
      const values = days.map((day) => Number(day[metric]) || 0);
      const max = Math.max(1, ...values);
      if (!days.length) return h("div", { className: "dsh-usage-chart-empty" }, "No usage in this range");
      const x = (index) => left + (days.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (days.length - 1));
      const y = (value) => top + (height - top - bottom) * (1 - value / max);
      const points = values.map((value, index) => [x(index), y(value)]);
      const line = points.map((point, index) => (index === 0 ? "M" : "L") + point[0].toFixed(2) + " " + point[1].toFixed(2)).join(" ");
      const area = line + " L " + x(days.length - 1) + " " + (height - bottom) + " L " + x(0) + " " + (height - bottom) + " Z";
      const labels = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((value, index, all) => all.indexOf(value) === index);
      const selectAtPointer = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = (event.clientX - bounds.left) * width / Math.max(1, bounds.width);
        const ratio = Math.max(0, Math.min(1, (localX - left) / (width - left - right)));
        setActiveIndex(Math.round(ratio * (days.length - 1)));
      };
      const onKeyDown = (event) => {
        let next = activeIndex ?? days.length - 1;
        if (event.key === "ArrowLeft") next = Math.max(0, next - 1);
        else if (event.key === "ArrowRight") next = Math.min(days.length - 1, next + 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = days.length - 1;
        else if (event.key === "Escape") { setActiveIndex(null); return; }
        else return;
        event.preventDefault();
        setActiveIndex(next);
      };
      const activeDay = activeIndex === null ? null : days[activeIndex];
      const activePoint = activeIndex === null ? null : points[activeIndex];
      const tooltipWidth = 196, tooltipHeight = 61;
      const tooltipX = activePoint ? Math.max(left, Math.min(width - right - tooltipWidth, activePoint[0] - tooltipWidth / 2)) : 0;
      const tooltipY = activePoint ? (activePoint[1] < top + tooltipHeight + 14 ? activePoint[1] + 12 : activePoint[1] - tooltipHeight - 12) : 0;
      return h("svg", {
        className: "dsh-usage-chart", viewBox: `0 0 ${width} ${height}`, role: "img", tabIndex: 0,
        "aria-label": `Interactive ${metricLabel(metric).toLowerCase()} usage trend. Use left and right arrow keys to inspect days.`,
        onPointerMove: selectAtPointer, onPointerDown: selectAtPointer, onPointerLeave: () => setActiveIndex(null),
        onFocus: () => setActiveIndex((value) => value ?? days.length - 1), onBlur: () => setActiveIndex(null), onKeyDown,
      },
        h("defs", null, h("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1" }, h("stop", { offset: "0%", stopColor: "var(--dsh-usage-accent)", stopOpacity: ".28" }), h("stop", { offset: "100%", stopColor: "var(--dsh-usage-accent)", stopOpacity: "0" }))),
        [0, .5, 1].map((ratio) => h("g", { key: ratio }, h("line", { className: "dsh-usage-chart-grid", x1: left, x2: width - right, y1: y(max * ratio), y2: y(max * ratio) }), h("text", { className: "dsh-usage-chart-label", x: left - 8, y: y(max * ratio) + 3, textAnchor: "end" }, formatMetric(max * ratio, metric)))),
        h("path", { d: area, fill: `url(#${gradientId})` }),
        h("path", { d: line, className: "dsh-usage-chart-line" }),
        points.length <= 45 ? points.map((point, index) => h("circle", { key: index, className: "dsh-usage-chart-dot", cx: point[0], cy: point[1], r: 2.7, "aria-hidden": "true" })) : null,
        labels.map((index) => h("text", { key: index, className: "dsh-usage-chart-label", x: x(index), y: height - 6, textAnchor: index === 0 ? "start" : index === days.length - 1 ? "end" : "middle" }, formatDate(days[index].date))),
        h("rect", { className: "dsh-usage-chart-hit", x: left, y: top, width: width - left - right, height: height - top - bottom }),
        activeDay && activePoint ? h(React.Fragment, null,
          h("line", { className: "dsh-usage-chart-crosshair", x1: activePoint[0], x2: activePoint[0], y1: top, y2: height - bottom }),
          h("circle", { className: "dsh-usage-chart-active-dot", cx: activePoint[0], cy: activePoint[1], r: 4.8 }),
          h("g", { className: "dsh-usage-chart-tooltip", transform: `translate(${tooltipX} ${tooltipY})` },
            h("rect", { width: tooltipWidth, height: tooltipHeight, rx: 9 }),
            h("text", { className: "dsh-usage-chart-tooltip-title", x: 11, y: 16 }, formatLongDate(activeDay.date)),
            h("text", { className: "dsh-usage-chart-tooltip-value", x: 11, y: 34 }, `${metricLabel(metric)}: ${formatMetricExact(values[activeIndex], metric)}`),
            h("text", { className: "dsh-usage-chart-tooltip-meta", x: 11, y: 51 }, dayDetails(activeDay, metric)),
          ),
        ) : null,
      );
    }

    function TokenMix({ summary }) {
      const input = summary.input || 0, output = summary.output || 0, cache = (summary.cacheRead || 0) + (summary.cacheWrite || 0);
      const total = Math.max(1, input + output + cache);
      const inputEnd = input / total * 100;
      const outputEnd = (input + output) / total * 100;
      const cacheEnd = (input + output + cache) / total * 100;
      const rows = [
        { label: "Input", value: input, color: "var(--dsh-usage-accent)" },
        { label: "Output", value: output, color: "var(--dsh-usage-accent-2)" },
        { label: "Cache", value: cache, color: "var(--dsh-usage-green)" },
      ];
      return h("div", { className: "dsh-usage-mix" },
        h("div", { className: "dsh-usage-donut", style: { "--mix-input": inputEnd + "%", "--mix-output": outputEnd + "%", "--mix-cache": cacheEnd + "%" } }, h("div", { className: "dsh-usage-donut-center" }, h("strong", null, formatCompact(summary.totalTokens)), h("span", null, "tokens"))),
        h("div", { className: "dsh-usage-legend" }, rows.map((row) => h("div", { key: row.label, className: "dsh-usage-legend-row" }, h("i", { className: "dsh-usage-legend-dot", style: { background: row.color } }), h("span", null, row.label), h("span", { className: "dsh-usage-legend-value" }, formatCompact(row.value))))),
      );
    }

    function Heatmap({ days, metric }) {
      const hostRef = useRef(null);
      const [active, setActive] = useState(null);
      const [focusIndex, setFocusIndex] = useState(Math.max(0, days.length - 1));
      useEffect(() => {
        setActive(null);
        setFocusIndex((value) => Math.max(0, Math.min(value, days.length - 1)));
      }, [days, metric]);
      const metricValue = (day) => Number(day[metric]) || 0;
      const positive = days.map(metricValue).filter((value) => value > 0).sort((a, b) => a - b);
      const quantile = (ratio) => positive[Math.floor((positive.length - 1) * ratio)] || 0;
      const thresholds = [quantile(.25), quantile(.5), quantile(.75)];
      const levelFor = (value) => value <= 0 ? 0 : value <= thresholds[0] ? 1 : value <= thresholds[1] ? 2 : value <= thresholds[2] ? 3 : 4;
      const firstOffset = days.length ? new Date(days[0].date + "T00:00:00Z").getUTCDay() : 0;
      const showCell = (event, day, index, level, pinned = false) => {
        const hostBounds = hostRef.current?.getBoundingClientRect();
        const cellBounds = event.currentTarget.getBoundingClientRect();
        if (!hostBounds) return;
        const center = cellBounds.left - hostBounds.left + cellBounds.width / 2;
        const left = Math.max(112, Math.min(Math.max(112, hostBounds.width - 112), center));
        setActive({ day, index, level, left, top: cellBounds.top - hostBounds.top, pinned });
      };
      const moveFocus = (event, index) => {
        let next = index;
        if (event.key === "ArrowLeft") next = index - 1;
        else if (event.key === "ArrowRight") next = index + 1;
        else if (event.key === "ArrowUp") next = index - 7;
        else if (event.key === "ArrowDown") next = index + 7;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = days.length - 1;
        else if (event.key === "Escape") { setActive(null); event.currentTarget.blur(); return; }
        else return;
        event.preventDefault();
        next = Math.max(0, Math.min(days.length - 1, next));
        setFocusIndex(next);
        requestAnimationFrame(() => hostRef.current?.querySelector(`[data-day-index="${next}"]`)?.focus());
      };
      const cells = Array.from({ length: firstOffset }, (_, index) => h("i", { key: "blank-" + index, "aria-hidden": "true" }));
      days.forEach((day, index) => {
        const value = metricValue(day);
        const level = levelFor(value);
        const selected = active?.day.date === day.date;
        cells.push(h("button", {
          key: day.date, type: "button", className: "dsh-usage-heat-cell", "data-level": level, "data-active": selected ? "true" : undefined,
          "data-day-index": index, tabIndex: index === focusIndex ? 0 : -1,
          "aria-label": `${formatLongDate(day.date)}. ${metricLabel(metric)} ${formatMetricExact(value, metric)}. ${formatExact(day.totalTokens || 0)} tokens, ${formatExact(day.calls || 0)} calls, ${formatDetailedCost(day.cost || 0)}.`,
          onPointerEnter: (event) => showCell(event, day, index, level),
          onPointerLeave: () => setActive((value) => value?.pinned ? value : null),
          onFocus: (event) => { setFocusIndex(index); showCell(event, day, index, level); },
          onBlur: () => setActive((value) => value?.pinned ? value : null),
          onClick: (event) => active?.day.date === day.date && active.pinned ? setActive(null) : showCell(event, day, index, level, true),
          onKeyDown: (event) => moveFocus(event, index),
        }));
      });
      return h(React.Fragment, null,
        h("div", { ref: hostRef, className: "dsh-usage-heat-interactive" },
          h("div", { className: "dsh-usage-heat-wrap" }, h("div", { className: "dsh-usage-heat-layout" },
            h("div", { className: "dsh-usage-day-labels", "aria-hidden": "true" }, h("span"), h("span", null, "M"), h("span"), h("span", null, "W"), h("span"), h("span", null, "F"), h("span")),
            h("div", { className: "dsh-usage-heatmap", role: "grid", "aria-label": `${metricLabel(metric)} activity over the last year` }, cells),
          )),
          active ? h("div", { className: "dsh-usage-heat-tooltip", role: "tooltip", style: { left: active.left, top: active.top } },
            h("strong", null, formatLongDate(active.day.date)),
            h("span", null, h("b", null, `${metricLabel(metric)}: ${formatMetricExact(metricValue(active.day), metric)}`), " · level " + active.level + " of 4"),
            h("span", null, dayDetails(active.day, metric)),
          ) : null,
        ),
        h("div", { className: "dsh-usage-heat-footer" },
          h("span", null, days.filter((day) => day.calls > 0).length + " active days in the last year"),
          h("span", { className: "dsh-usage-heat-key", "aria-label": `${metricLabel(metric)} per day, quartile color scale from less to more` }, h("b", null, metricLabel(metric) + " / day"), "Less", [0,1,2,3,4].map((level) => h("i", { key: level, className: "dsh-usage-heat-cell", "data-level": level, "aria-hidden": "true" })), "More"),
        ),
      );
    }

    function ModelTable({ models }) {
      const max = Math.max(1, ...models.map((model) => model.totalTokens));
      return h("div", { className: "dsh-usage-model-list" },
        h("div", { className: "dsh-usage-model-head" }, h("span", null, "Model"), h("span", null, "Volume"), h("span", { className: "dsh-usage-num" }, "Calls"), h("span", { className: "dsh-usage-num" }, "Cost")),
        models.length ? models.map((model) => h("div", { key: model.route, className: "dsh-usage-model-row" },
          h("div", { className: "dsh-usage-model-name" }, h("strong", { title: model.model }, model.model), h("span", { title: model.provider }, model.provider + " · " + model.sessions + " sessions")),
          h("div", null, h("div", null, formatCompact(model.totalTokens) + " tokens"), h("div", { className: "dsh-usage-model-meter" }, h("i", { style: { width: (model.totalTokens / max * 100).toFixed(1) + "%" } }))),
          h("div", { className: "dsh-usage-num" }, formatCompact(model.calls)),
          h("div", { className: "dsh-usage-num" }, model.pricedTokens ? formatCost(model.cost) : h("span", { className: "dsh-usage-unpriced", title: "Add a pricing rule for this route" }, "UNPRICED")),
        )) : h("div", { className: "dsh-usage-chart-empty" }, "No model usage in this range"),
      );
    }

    function Dashboard({ snapshot, range, setRange, metric, setMetric }) {
      const [heatMetric, setHeatMetric] = useState("totalTokens");
      const summary = snapshot.summary;
      const coverage = Math.round(summary.pricingCoverage * 100);
      return h("div", { className: "dsh-usage-dashboard" },
        h("div", { className: "dsh-usage-heading" }, h("div", null, h("h1", null, "Usage overview"), h("p", null, rangeDescription(snapshot))), h(Segment, { values: RANGES, selected: range, onChange: setRange, label: "Analytics range" })),
        h("section", { className: "dsh-usage-cards", "aria-label": "Usage summary" },
          h(StatCard, { label: "Estimated spend", value: formatCost(summary.cost), detail: coverage + "% of tokens priced", accent: "var(--dsh-usage-green)" }),
          h(StatCard, { label: "Total tokens", value: formatCompact(summary.totalTokens), detail: formatCompact(summary.output) + " output · " + formatCompact(summary.cacheRead) + " cache read", accent: "var(--dsh-usage-accent)" }),
          h(StatCard, { label: "Model calls", value: formatCompact(summary.calls), detail: summary.sessions + " sessions", accent: "var(--dsh-usage-accent-2)" }),
          h(StatCard, { label: "Active days", value: String(summary.activeDays), detail: snapshot.trend.length + " calendar days", accent: "var(--dsh-usage-amber)" }),
        ),
        h("section", { className: "dsh-usage-grid" },
          h("article", { className: "dsh-usage-panel" }, h("header", { className: "dsh-usage-panel-head" }, h("div", null, h("h2", { className: "dsh-usage-panel-title" }, "Usage trend"), h("p", { className: "dsh-usage-panel-sub" }, "Provider-reported durable usage")), h(Segment, { values: METRICS, selected: metric, onChange: setMetric, label: "Chart metric" })), h(TrendChart, { days: snapshot.trend, metric })),
          h("article", { className: "dsh-usage-panel" }, h("header", { className: "dsh-usage-panel-head" }, h("div", null, h("h2", { className: "dsh-usage-panel-title" }, "Token mix"), h("p", { className: "dsh-usage-panel-sub" }, "Input, output, and cache"))), h(TokenMix, { summary })),
        ),
        h("article", { className: "dsh-usage-panel" }, h("header", { className: "dsh-usage-panel-head" }, h("div", null, h("h2", { className: "dsh-usage-panel-title" }, "Activity"), h("p", { className: "dsh-usage-panel-sub" }, `Daily color shows ${metricLabel(heatMetric).toLowerCase()} volume`)), h(Segment, { values: METRICS, selected: heatMetric, onChange: setHeatMetric, label: "Activity color metric" })), h(Heatmap, { days: snapshot.heatmap, metric: heatMetric })),
        h("article", { className: "dsh-usage-panel" }, h("header", { className: "dsh-usage-panel-head" }, h("div", null, h("h2", { className: "dsh-usage-panel-title" }, "Models"), h("p", { className: "dsh-usage-panel-sub" }, "Usage and estimated cost by provider route"))), h(ModelTable, { models: snapshot.models })),
        coverage < 100 ? h("div", { className: "dsh-usage-notice" }, "Cost is an estimate. " + (100 - coverage) + "% of tokens use routes without a matching pricing rule. Override pricing in the usage row of cordis.patch.yml for exact internal or negotiated rates.") : null,
        snapshot.errors ? h("div", { className: "dsh-usage-notice" }, snapshot.errors + " session logs could not be read. Their last cached values are shown when available.") : null,
      );
    }

    function UsageWorkspace({ disclosure }) {
      const titleId = useId();
      const rootRef = useRef(null);
      const [range, setRange] = useState("30d");
      const [metric, setMetric] = useState("totalTokens");
      const [snapshot, setSnapshot] = useState(null);
      const [error, setError] = useState(null);
      const [refreshKey, setRefreshKey] = useState(0);
      const [loading, setLoading] = useState(true);
      const timeZone = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } }, []);
      const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

      useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null); setSnapshot(null);
        fetch(API_PREFIX + "?range=" + encodeURIComponent(range) + "&timeZone=" + encodeURIComponent(timeZone), { signal: controller.signal })
          .then(async (response) => {
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.error?.message || "Usage request failed (" + response.status + ")");
            return body;
          })
          .then((body) => { setSnapshot(body); setLoading(false); })
          .catch((cause) => { if (cause.name !== "AbortError") { setError(cause instanceof Error ? cause.message : String(cause)); setLoading(false); } });
        return () => controller.abort();
      }, [range, timeZone, refreshKey]);

      useEffect(() => {
        const frame = requestAnimationFrame(() => rootRef.current?.querySelector('[data-dsh-usage-exit="true"]')?.focus());
        const keydown = (event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); disclosure.close(); } };
        window.addEventListener("keydown", keydown);
        return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", keydown); };
      }, [disclosure]);

      return h("section", { ref: rootRef, className: "dsh-usage-workspace", "aria-labelledby": titleId },
        h("header", { className: "dsh-usage-toolbar" }, h("span", { className: "dsh-usage-brand" }, h(UsageGlyph, { size: 17 })), h("div", { className: "dsh-usage-title" }, h("strong", { id: titleId }, "Usage"), h("span", null, snapshot ? "Updated " + new Date(snapshot.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "Reading durable sessions")), h("button", { type: "button", className: "dsh-usage-button", disabled: loading, onClick: refresh }, h(RefreshGlyph), h("span", { className: "dsh-usage-button-label" }, "Refresh")), h("button", { type: "button", className: "dsh-usage-button", "data-dsh-usage-exit": "true", onClick: disclosure.close }, "Close")),
        h("div", { className: "dsh-usage-scroll" }, loading && !snapshot ? h("div", { className: "dsh-usage-loading" }, h("i", { className: "dsh-usage-spinner" }), h("span", null, "Scanning session usage…")) : error && !snapshot ? h("div", { className: "dsh-usage-error" }, h("strong", null, "Usage unavailable"), h("span", null, error), h("button", { type: "button", className: "dsh-usage-button", onClick: refresh }, "Try again")) : h(Dashboard, { snapshot, range, setRange, metric, setMetric })),
      );
    }

    function SidebarAction({ wide, disclosure }) {
      const open = useSyncExternalStore(disclosure.subscribe, disclosure.getSnapshot, disclosure.getSnapshot);
      return h("div", { className: "dsh-usage-sidebar" + (wide ? "" : " dsh-usage-sidebar-rail") }, h("button", { type: "button", className: "dsh-usage-sidebar-button", title: wide ? undefined : "Usage", "aria-label": open ? "Close Usage" : "Open Usage", "aria-pressed": open, "data-active": open ? "true" : undefined, onClick: disclosure.toggle }, h(UsageGlyph, { size: wide ? 16 : 18 }), wide ? h("span", { className: "dsh-usage-sidebar-label" }, "Usage") : null));
    }

    function apply(ctx) {
      const disclosure = createDisclosureStore();
      let centerDeclared = false;
      let disposeCenter = null;
      const unmount = () => { if (disposeCenter) { const dispose = disposeCenter; disposeCenter = null; dispose(); } };
      const mount = () => {
        if (!centerDeclared || !disclosure.getSnapshot() || disposeCenter) return;
        try { disposeCenter = ctx.slots.register({ name: "conversation", priority: -190, inject: () => ({ disclosure }) }, UsageWorkspace); }
        catch (error) { console.error("dsh usage: could not mount center workspace", error); disclosure.close(); }
      };
      ctx.effect(() => { const tag = document.createElement("style"); tag.setAttribute("data-plugin", "@syncended/dsh-usage"); tag.textContent = STYLE_CSS; document.head.appendChild(tag); return () => tag.remove(); }, "@syncended/dsh-usage: client styles");
      ctx.effect(() => {
        const dismissOnExternalNavigation = (event) => {
          if (!disclosure.getSnapshot() || !(event.target instanceof Element)) return;
          if (event.target.closest(".dsh-usage-sidebar,.dsh-usage-workspace")) return;
          disclosure.close();
        };
        document.addEventListener("pointerdown", dismissOnExternalNavigation, true);
        return () => document.removeEventListener("pointerdown", dismissOnExternalNavigation, true);
      }, "@syncended/dsh-usage: dismiss on external navigation");
      ctx.effect(() => ctx.slots.inject("conversation", () => { centerDeclared = true; mount(); return () => { centerDeclared = false; unmount(); }; }), "@syncended/dsh-usage: center workspace");
      ctx.effect(() => { const unsubscribe = disclosure.subscribe(() => disclosure.getSnapshot() ? mount() : unmount()); return () => { unsubscribe(); unmount(); disclosure.dispose(); }; }, "@syncended/dsh-usage: workspace state");
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({ name: "sidebar.footer.action", id: "usage", order: 45, label: "Usage", inject: () => ({ disclosure }) }, SidebarAction));
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
