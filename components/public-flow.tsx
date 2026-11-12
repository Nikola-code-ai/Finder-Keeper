'use client';

// A reading flow's own page: the map, the checklist, the step in hand. Anyone can read it; a signed-in reader
// keeps their own ticks and the flow then appears among the flows they walk.
import { useEffect, useState } from 'react';
import { BookOpen, Check, ExternalLink, Globe2, LoaderCircle, Sparkles, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { progressOf } from '@/lib/flow-layout';
import { ago, askHref, findHref } from '@/lib/commons';
import { useViewer } from '@/lib/viewer';
import type { Flow, FlowStep } from '@/lib/types';
import CommentThread from './comment-thread';
import { FlowChecklist, FlowLegend, FlowMap, StepDetail } from './flow-map';
import PublicShell from './public-shell';
import TextReader from './text-reader';
import s from './commons.module.css';

export default function PublicFlow({ id }: { id: string }) {
  const viewer = useViewer();
  const [flow, setFlow] = useState<Flow | null>(null), [error, setError] = useState(''), [stepId, setStepId] = useState<string | null>(null);
  const [reading, setReading] = useState<{ id: string; title: string; page?: number; excerpt?: string } | null>(null);
  useEffect(() => {
    if (!viewer.ready) return;
    let live = true;
    api<Flow>(`/flows/${encodeURIComponent(id)}`).then(v => { if (live) setFlow(v); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'This flow is not open.'); });
    return () => { live = false; };
  }, [id, viewer.ready, viewer.signedIn]);
  useEffect(() => {
    if (!flow || (stepId && flow.graph.steps.some(st => st.id === stepId))) return;
    const progress = progressOf(flow.graph, flow.progress);
    setStepId(progress.next.find(n => n !== 'start') || progress.next[0] || flow.graph.steps[0]?.id || null);
  }, [flow, stepId]);
  const toggle = async (step: string) => {
    if (!flow || !viewer.signedIn) return;
    try { const next = await api<Flow & { done: boolean }>(`/flows/${flow.id}/steps/${step}/toggle`, { method: 'POST' }); setFlow(next); }
    catch (e) { setError(e instanceof Error ? e.message : 'The step could not be ticked.'); }
  };
  const step: FlowStep | null = flow?.graph.steps.find(st => st.id === stepId) || null;
  const progress = flow ? progressOf(flow.graph, flow.progress) : null;
  const mine = !!flow && !!viewer.handle && flow.author.handle === viewer.handle;
  const actions = (st: FlowStep) => {
    if (st.kind === 'read' && st.document) return <>
      {st.document.readable && <button type="button" className={s.amber} onClick={() => setReading({ id: st.document!.id, title: st.document!.title, page: st.page, excerpt: st.excerpt })}><BookOpen size={14} /> Read</button>}
      <a className={s.ghost} href={findHref(st.document.title)}><Globe2 size={14} /> Find it for my library</a>
      {st.document.source_url && <a className={s.ghost} href={st.document.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Source</a>}
    </>;
    if (st.kind === 'synthesize') return <a className={s.amber} href={askHref(st.query || flow?.goal || '')}><Sparkles size={14} /> Ask my library</a>;
    return null;
  };
  return <PublicShell section="flows">
    {error && <p className={s.inlineError} role="alert">{error}</p>}
    {!flow && !error && <p className={s.muted}><LoaderCircle size={14} className="spin" /> Unrolling the map…</p>}
    {flow && progress && <>
      <header className={s.flowHead}>
        <div className={s.flowHeadText}>
          <span className={s.cardKind}>Reading flow{!flow.published && ' · private, only you see it'}</span>
          <h1>{flow.title}</h1>
          <p className={s.goalLine}><Sparkles size={13} aria-hidden="true" /> {flow.goal}</p>
          {flow.description && <p className={s.muted}>{flow.description}</p>}
          <p className={s.metaLine}><span>By {flow.author.handle ? <a href={`/u/${flow.author.handle}`}>{flow.author.display_name}</a> : flow.author.display_name}{flow.published_at ? ` · published ${ago(flow.published_at)}` : ''}</span><span>{flow.step_count} steps · {flow.graph.steps.filter(st => st.kind === 'choice').length} forks · <Users size={12} aria-hidden="true" /> {flow.reader_count} {flow.reader_count === 1 ? 'reader' : 'readers'}</span></p>
        </div>
        <div className={s.flowTools}>{mine && <a className={s.ghost} href="/?view=flows">Open in your Flows</a>}</div>
      </header>
      {viewer.signedIn
        ? <div className={s.progressRow}><span className={s.bar} data-large="true" role="img" aria-label={`${progress.completed} of ${progress.total} steps done`}><i style={{ width: `${progress.total ? Math.round(100 * progress.completed / progress.total) : 0}%` }} /></span>{progress.complete ? <span className={s.complete}><Check size={13} /> Path complete</span> : <span className={s.muted}>{progress.completed} of {progress.total} done</span>}</div>
        : viewer.ready ? <p className={s.muted}><a href="/sign-in">Sign in</a> to walk this flow and keep your ticks.</p> : null}
      <FlowMap graph={flow.graph} done={flow.progress} selected={stepId} onSelect={setStepId} />
      <FlowLegend />
      <div className={s.stepSplit}>
        <FlowChecklist graph={flow.graph} done={flow.progress} selected={stepId} canTick={viewer.signedIn} onSelect={setStepId} onToggle={toggle} />
        {step && <StepDetail graph={flow.graph} step={step} done={flow.progress.includes(step.id)} canTick={viewer.signedIn} onToggle={toggle} onSelect={setStepId}>{actions(step)}</StepDetail>}
      </div>
      <CommentThread kind="flow" id={flow.id} canPost={viewer.signedIn} canModerate={mine} viewerHandle={viewer.handle} signInHref="/sign-in" onError={setError} />
    </>}
    {reading && <TextReader documentId={reading.id} title={reading.title} page={reading.page} excerpt={reading.excerpt} onClose={() => setReading(null)} />}
  </PublicShell>;
}
