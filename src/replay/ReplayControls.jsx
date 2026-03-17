import React from 'react';

const btnStyle = {
    padding: '4px 12px', borderRadius: '4px', border: '1px solid #bbb',
    background: '#f0f0f0', color: '#333', cursor: 'pointer', fontSize: '13px',
    fontWeight: 'bold',
};
const btnDisabled = { ...btnStyle, opacity: 0.4, cursor: 'default' };

export const ReplayControls = ({ engine, onExit, onStateChange, onPlayFromHere }) => {
    const [step, setStep] = React.useState(-1);
    const [playing, setPlaying] = React.useState(false);
    const [speed, setSpeed] = React.useState(500); // ms per step

    const total = engine.totalSteps;
    const actionInfo = engine.getCurrentActionInfo();

    const doStep = React.useCallback((dir) => {
        const ok = dir > 0 ? engine.stepForward() : engine.stepBack();
        if (ok) {
            setStep(engine.currentStep);
            onStateChange?.();
        }
        return ok;
    }, [engine, onStateChange]);

    const doJump = React.useCallback((target) => {
        engine.jumpTo(target);
        setStep(engine.currentStep);
        onStateChange?.();
    }, [engine, onStateChange]);

    // Auto-play — use chained setTimeout to avoid double-dispatch from setInterval
    React.useEffect(() => {
        if (!playing) return;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            const ok = engine.stepForward();
            if (ok) {
                setStep(engine.currentStep);
                onStateChange?.();
                timerRef.current = setTimeout(tick, speed);
            } else {
                setPlaying(false);
            }
        };
        const timerRef = { current: setTimeout(tick, speed) };
        return () => { cancelled = true; clearTimeout(timerRef.current); };
    }, [playing, speed, engine, onStateChange]);

    const state = engine.getState();
    const round = state?.G?.round;
    const turn = state?.ctx?.turn;
    const currentPlayer = state?.ctx?.currentPlayer;
    const gameOver = engine.isGameOver();
    const atEnd = engine.isAtEnd();

    return (
        <div style={{
            background: '#2c3e50', color: 'white', padding: '8px 16px',
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            fontSize: '13px', borderBottom: '2px solid #1a252f',
        }}>
            <span style={{ fontWeight: 'bold', color: '#f39c12' }}>REPLAY</span>

            <button style={step <= -1 ? btnDisabled : btnStyle}
                onClick={() => doJump(-1)} disabled={step <= -1} title="Jump to start">⏮</button>
            <button style={step <= -1 ? btnDisabled : btnStyle}
                onClick={() => doStep(-1)} disabled={step <= -1} title="Step back">◀</button>
            <button style={btnStyle}
                onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'}>
                {playing ? '⏸' : '▶'}
            </button>
            <button style={step >= total - 1 ? btnDisabled : btnStyle}
                onClick={() => doStep(1)} disabled={step >= total - 1} title="Step forward">▶</button>
            <button style={step >= total - 1 ? btnDisabled : btnStyle}
                onClick={() => doJump(total - 1)} disabled={step >= total - 1} title="Jump to end">⏭</button>

            <input
                type="range" min={-1} max={total - 1} value={step}
                onChange={(e) => doJump(Number(e.target.value))}
                style={{ flex: '1 1 120px', minWidth: '80px', cursor: 'pointer' }}
                title={`Step ${step + 1} of ${total}`}
            />

            <span style={{ minWidth: '80px', textAlign: 'center' }}>
                {step + 1} / {total}
            </span>

            <span style={{ color: '#aaa', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {actionInfo.description}
            </span>

            <span style={{ color: '#7fb3d3' }}>
                Rd {(round ?? 0) + 1} · Turn {turn ?? 0} · P{currentPlayer ?? '?'}
            </span>

            <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                <option value={1000}>1s/step</option>
                <option value={500}>0.5s</option>
                <option value={200}>0.2s</option>
                <option value={50}>Fast</option>
            </select>

            {!gameOver && (
                <button
                    style={{ ...btnStyle, background: '#27ae60', color: 'white', border: 'none' }}
                    onClick={() => { setPlaying(false); onPlayFromHere?.(); }}
                    title="Take over and play from this point"
                >
                    {atEnd ? 'Continue Play' : 'Play from Here'}
                </button>
            )}

            <button style={{ ...btnStyle, background: '#e74c3c', color: 'white', border: 'none' }}
                onClick={onExit}>Exit Replay</button>
        </div>
    );
};
