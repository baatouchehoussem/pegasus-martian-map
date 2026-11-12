import { useCallback, useEffect, useRef, useState } from 'react';
import MarsScene from './components/MarsScene';
import { DEFAULT_LAYERS, LAYER_IDS, LAYER_META, SITES } from './data/sites';
import type { LayerId, Layers, RouteStats, SiteId } from './data/sites';

const fmt = (n: number | undefined, d = 0) => (n === undefined ? '—' : n.toFixed(d));

function Legend({ id }: { id: LayerId }) {
  if (id === 'slope')
    return (
      <div className="legend">
        <span><i style={{ background: '#3cdc78' }} />&lt;10° safe</span>
        <span><i style={{ background: '#f5b828' }} />10–18° caution</span>
        <span><i style={{ background: '#f04038' }} />&gt;18° hazard</span>
      </div>
    );
  if (id === 'radiation')
    return (
      <div className="legend">
        <div className="gradbar" />
        <div className="gradlabels"><span>Low dose / cold</span><span>High dose / warm</span></div>
      </div>
    );
  if (id === 'spectral')
    return (
      <div className="legend">
        <span><i style={{ background: '#5af0ff' }} />Sulfate</span>
        <span><i style={{ background: '#ff5adc' }} />Clay</span>
        <span><i style={{ background: '#ffc43c' }} />Hematite</span>
      </div>
    );
  return null;
}

export default function App() {
  const [siteId, setSiteId] = useState<SiteId>('sharp');
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [follow, setFollow] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const [stats, setStats] = useState<RouteStats | undefined>();
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 720);
  const timers = useRef<number[]>([]);

  const site = SITES[siteId];
  const onFinish = useCallback(() => setPlaying(false), []);
  const onReady = useCallback(() => setReady(true), []);

  const setLayer = (id: LayerId, patch: Partial<Layers[LayerId]>) =>
    setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const chooseSite = (id: SiteId) => {
    if (id === siteId) return;
    clearTimers();
    setReady(false);
    setPlaying(false);
    setProgress(0);
    setFollow(false);
    setSiteId(id);
  };

  const togglePlay = () => {
    if (!playing && progress >= 0.999) setProgress(0);
    setPlaying((p) => !p);
  };
  const reset = () => {
    setPlaying(false);
    setProgress(0);
  };

  const runDemo = () => {
    clearTimers();
    if (siteId !== 'sharp') chooseSite('sharp');
    setFollow(false);
    setPlaying(false);
    setProgress(0);
    setCamKey((k) => k + 1);
    setLayers({
      optical: { on: true, opacity: 1 },
      slope: { on: false, opacity: 0.78 },
      radiation: { on: false, opacity: 0.7 },
      spectral: { on: false, opacity: 0.65 },
    });
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(1500, () => setLayer('slope', { on: true }));
    at(3300, () => setLayer('radiation', { on: true }));
    at(5100, () => setLayer('spectral', { on: true }));
    at(6500, () => setLayer('radiation', { on: false }));
    at(7000, () => setPlaying(true));
  };

  const active = LAYER_IDS.filter((id) => layers[id].on).length;

  return (
    <div className="app">
      <MarsScene camKey={camKey} follow={follow} layers={layers} onFinish={onFinish} onProgress={setProgress} onReady={onReady} onStats={setStats} playing={playing} progress={progress} siteId={siteId}/>

      {!ready && (
        <div className="loader glass">
          <span className="spinner" />
          Generating Martian terrain…
        </div>
      )}

      <header className="topbar glass">
        <div className="brand">
          <div className="eyebrow">Interplanetary Survival Guide / NASA Space Apps</div>
          <h1>
            Martian Map <span>/ EVA Operations</span>
          </h1>
        </div>
        <div className="actions">
          <button className="icon-btn" title="Recenter camera" onClick={() => setCamKey((k) => k + 1)}>⌖</button>
          <button className={'icon-btn' + (follow ? ' on' : '')} title="Follow rover" onClick={() => setFollow((f) => !f)}>◎</button>
          <button className="pill" onClick={runDemo}>▶ Demo</button>
          <button className="icon-btn menu" title="Layers" onClick={() => setPanelOpen((o) => !o)}>☰</button>
        </div>
      </header>

      <aside className={'sidebar glass' + (panelOpen ? '' : ' collapsed')}>
        <div className="section-title">Mission area / 01</div>
        <div className="sites">
          {(Object.keys(SITES) as SiteId[]).map((id) => (
            <button key={id} className={'site' + (id === siteId ? ' on' : '')} onClick={() => chooseSite(id)}>
              <strong>{SITES[id].name}</strong>
              <small>{SITES[id].region} · {SITES[id].lat}, {SITES[id].lon}</small>
            </button>
          ))}
        </div>
        <p className="note">{site.note}</p>

        <div className="section-title row">
          <span>Science layers</span>
          <span>{active} / 4 active</span>
        </div>
        {LAYER_IDS.map((id) => {
          const m = LAYER_META[id];
          const st = layers[id];
          return (
            <div className={'layer' + (st.on ? '' : ' off')} key={id}>
              <div className="layer-head">
                <span className="dot" style={{ color: m.color, borderColor: m.color }}>{m.icon}</span>
                <div className="layer-text">
                  <div className="layer-name">{m.label}</div>
                  <div className="layer-src">{m.source}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={st.on}
                  className={'switch' + (st.on ? ' on' : '')}
                  onClick={() => setLayer(id, { on: !st.on })}
                />
              </div>
              <div className="layer-slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(st.opacity * 100)}
                  onChange={(e) => setLayer(id, { opacity: Number(e.target.value) / 100 })}
                />
                <span>{Math.round(st.opacity * 100)}%</span>
              </div>
              {st.on && <Legend id={id}/>}
            </div>
          );
        })}

        <div className="section-title">EVA route</div>
        <div className="chips">
          {site.waypoints.map((w, i) => (
            <span key={w} className="chip">{i + 1} · {w}</span>
          ))}
        </div>
        <p className="note small">Rover and suit sizes are exaggerated so they stay visible on a 2.4 km terrain patch.</p>
      </aside>

      <footer className="dock glass">
        <div className="sim">
          <div className="section-title">Traverse simulation</div>
          <div className="controls">
            <button className="play" onClick={togglePlay}>{playing ? '❚❚ Pause' : '▶ Play EVA'}</button>
            <button className="icon-btn sm" title="Reset" onClick={reset}>↺</button>
          </div>
        </div>
        <input
          className="timeline"
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setProgress(Number(e.target.value) / 1000);
          }}
        />
        <div className="stats">
          <div><label>Distance</label><b>{fmt(stats?.distance)} m</b></div>
          <div><label>Elev gain / loss</label><b>+{fmt(stats?.gain)} / −{fmt(stats?.loss)} m</b></div>
          <div><label>Max slope</label><b>{fmt(stats?.maxSlope, 1)}°</b></div>
          <div><label>EVA duration</label><b>{fmt(stats?.duration, 1)} h</b></div>
          <div><label>O₂ used</label><b>{fmt(stats ? stats.o2 * progress : undefined)}% / {fmt(stats?.o2)}%</b></div>
        </div>
      </footer>
    </div>
  );
}
