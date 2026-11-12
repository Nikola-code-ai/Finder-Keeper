'use client';

// A reading flow drawn as a map: steps as cards, wires between them, the main path along the top lane and
// detours dropping below. Beside it, the same flow as a checklist, and a pane for whichever step is in hand.
import { useMemo, type ReactNode } from 'react';
import { ArrowRight, Check, GitFork } from 'lucide-react';
import { isCheckable, layoutFlow, NODE, progressOf, readingOrder } from '@/lib/flow-layout';
import { authorsLine, KIND_LABEL } from '@/lib/commons';
import type { FlowGraph, FlowStep } from '@/lib/types';
import s from './commons.module.css';

function subline(step: FlowStep) {
  if (step.kind === 'read') return [authorsLine(step.document, ''), step.location].filter(Boolean).join(' · ') || 'A reading';
  if (step.kind === 'choice') return 'Two ways on';
  if (step.kind === 'synthesize') return 'Ask the library';
  if (step.kind === 'start') return 'Where the path begins';
  return 'A note to yourself';
}

export function FlowMap({ graph, done, selected, onSelect }: { graph: FlowGraph; done: Iterable<string>; selected: string | null; onSelect: (id: string) => void }) {
  const layout = useMemo(() => layoutFlow(graph), [graph]);
  const doneKey = [...done].join('|');
  const progress = useMemo(() => progressOf(graph, doneKey ? doneKey.split('|') : []), [graph, doneKey]);
  return <div className={s.map} role="group" aria-label="Flow map">
    <div className={s.canvas} style={{ width: layout.width, height: layout.height }}>
      <svg className={s.wires} width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
        {layout.wires.map((w, i) => <g key={i} className={s.wire} data-live={progress.satisfied.has(w.from.step.id)} data-walked={progress.satisfied.has(w.from.step.id) && progress.satisfied.has(w.to.step.id)}>
          <path d={w.path} />
          {w.edge.label && <text x={w.mid.x} y={w.mid.y - 8} textAnchor="middle">{w.edge.label}</text>}
        </g>)}
      </svg>
      {layout.nodes.map(n => {
        const step = n.step, ticked = progress.done.has(step.id), open = progress.available.has(step.id), next = progress.next.includes(step.id);
        return <button key={step.id} type="button" className={s.node} data-kind={step.kind} data-done={ticked} data-open={open} data-next={next} data-detour={!!step.detour} aria-pressed={selected === step.id}
          aria-label={`${KIND_LABEL[step.kind]}: ${step.title}${ticked ? ', done' : ''}`} style={{ left: n.x, top: n.y, width: NODE.w, height: NODE.h }} onClick={() => onSelect(step.id)}>
          <span className={s.nodeKind}>{step.kind === 'choice' ? <GitFork size={11} aria-hidden="true" /> : null}{KIND_LABEL[step.kind]}{step.detour ? ' · detour' : ''}</span>
          <strong className={s.nodeTitle}>{step.title}</strong>
          <small className={s.nodeSub}>{subline(step)}</small>
          {isCheckable(step) && <span className={s.tick} aria-hidden="true">{ticked ? <Check size={12} strokeWidth={3} /> : null}</span>}
        </button>;
      })}
    </div>
  </div>;
}

export function FlowLegend() {
  return <div className={s.legend} aria-hidden="true">
    <span><i data-kind="read" /> Main path</span><span><i data-kind="detour" /> Detour</span><span><i data-kind="choice" /> Fork</span><span><i data-kind="done" /> Done</span><span><i data-kind="next" /> Next up</span>
  </div>;
}

export function FlowChecklist({ graph, done, selected, canTick, onSelect, onToggle }: { graph: FlowGraph; done: Iterable<string>; selected: string | null; canTick: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  const order = useMemo(() => readingOrder(graph), [graph]);
  const ticked = new Set(done);
  const progress = progressOf(graph, ticked);
  return <ol className={s.checklist} aria-label="Steps">
    {order.map(step => {
      const isDone = ticked.has(step.id), next = progress.next.includes(step.id);
      return <li key={step.id} data-kind={step.kind} data-detour={!!step.detour} data-selected={selected === step.id} data-done={isDone}>
        {isCheckable(step)
          ? <button type="button" className={s.check} role="checkbox" aria-checked={isDone} aria-label={`${isDone ? 'Undo' : 'Mark done'}: ${step.title}`} disabled={!canTick} onClick={() => onToggle(step.id)}>{isDone && <Check size={13} strokeWidth={3} />}</button>
          : <span className={s.forkMark} aria-hidden="true"><GitFork size={13} /></span>}
        <button type="button" className={s.checkBody} aria-current={selected === step.id ? 'true' : undefined} onClick={() => onSelect(step.id)}>
          <strong>{step.title}</strong><small>{subline(step)}</small>
        </button>
        {next && !isDone && <span className={s.nextTag}>Next</span>}
      </li>;
    })}
  </ol>;
}

export function StepDetail({ graph, step, done, canTick, onToggle, onSelect, children }: { graph: FlowGraph; step: FlowStep; done: boolean; canTick: boolean; onToggle: (id: string) => void; onSelect: (id: string) => void; children?: ReactNode }) {
  const doc = step.document;
  const exits = graph.edges.filter(e => e.from === step.id).map(e => ({ label: e.label, target: graph.steps.find(st => st.id === e.to) })).filter(e => e.target);
  return <article className={s.detail} aria-live="polite">
    <header className={s.detailHead}>
      <div className={s.badges}><span className={s.kindBadge} data-kind={step.kind}>{KIND_LABEL[step.kind]}</span>{step.detour && <span className={s.kindBadge} data-kind="detour">Detour</span>}{done && <span className={s.kindBadge} data-kind="done"><Check size={11} /> Done</span>}</div>
      <h3>{step.title}</h3>
      {doc && <p className={s.muted}>{[authorsLine(doc), doc.year, step.location, doc.license].filter(Boolean).join(' · ')}</p>}
    </header>
    {step.note && <p className={s.why}>{step.note}</p>}
    {step.excerpt && <blockquote className={s.excerpt}>“{step.excerpt}”</blockquote>}
    {step.kind === 'choice' && exits.length > 0 && <div className={s.exits}>{exits.map((e, i) => <button key={i} type="button" onClick={() => onSelect(e.target!.id)}><span>{e.label || 'Then'}</span><strong>{e.target!.title}</strong><ArrowRight size={14} /></button>)}</div>}
    <div className={s.actions}>
      {children}
      {isCheckable(step) && <button type="button" className={done ? s.ghost : s.primary} disabled={!canTick} onClick={() => onToggle(step.id)}>{done ? 'Undo' : step.kind === 'start' ? <>Begin <ArrowRight size={14} /></> : <><Check size={14} /> Mark done</>}</button>}
    </div>
  </article>;
}
