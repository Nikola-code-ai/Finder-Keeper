'use client';

// The Flows screen: ask the Keeper for a path through your shelf, then walk it. Each flow is a small map with forks;
// tick steps off as you read. Publish a flow and other readers can walk it too, keeping their own ticks.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, ExternalLink, Globe2, GitFork, Link as LinkIcon, LoaderCircle, Lock, Pencil, Route, Sparkles, Trash2, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { progressOf } from '@/lib/flow-layout';
import { ago } from '@/lib/commons';
import type { Document, Flow, FlowStep, Folder, SearchResult } from '@/lib/types';
import CommentThread from './comment-thread';
import { FlowChecklist, FlowLegend, FlowMap, StepDetail } from './flow-map';
import TextReader from './text-reader';
import { Dangler, SpiderGlyph, WebCorner } from './spider-bits';
import s from './commons.module.css';
import ws from './workspace.module.css';

export interface FlowsViewProps {
  folders: Folder[]; documents: Document[]; blocked: boolean; gate: ReactNode; embeddingReady: boolean; viewerHandle: string | null;
  onOpen: (doc: Document, match?: SearchResult) => void; onFind: (title: string) => void; onAsk: (query: string) => void;
  onCopy: (text: string) => void; notify: (message: string) => void; onError: (message: string) => void;
}

const EXAMPLES = ['how semantic search finds a passage by meaning', 'what makes an interface feel calm', 'how to read a long book and remember it'];
const forksLabel = (flow: Flow) => { const n = flow.graph.steps.filter(st => st.kind === 'choice').length; return `${n} ${n === 1 ? 'fork' : 'forks'}`; };

export default function FlowsView(p: FlowsViewProps) {
  const [flows, setFlows] = useState<Flow[] | null>(null), [following, setFollowing] = useState<Flow[]>([]), [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null), [stepId, setStepId] = useState<string | null>(null);
  const [goal, setGoal] = useState(''), [scope, setScope] = useState(''), [building, setBuilding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false), [renaming, setRenaming] = useState(false), [draftTitle, setDraftTitle] = useState(''), [saving, setSaving] = useState(false);
  const [reading, setReading] = useState<{ id: string; title: string; page?: number; excerpt?: string } | null>(null);

  const load = useCallback(async () => {
    try { const value = await api<{ flows: Flow[]; following: Flow[] }>('/flows'); setFlows(value.flows); setFollowing(value.following); setLoadError(''); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Your flows could not be read.'); setFlows([]); }
  }, []);
  useEffect(() => { if (!p.blocked) load(); }, [p.blocked, load]);

  const all = useMemo(() => [...(flows || []), ...following], [flows, following]);
  const flow = all.find(f => f.id === selectedId) || all[0] || null;
  const mine = !!flow && (flows || []).some(f => f.id === flow.id);
  useEffect(() => { if (flow && !selectedId) setSelectedId(flow.id); }, [flow, selectedId]);
  useEffect(() => {
    // Open on the next thing to do, so the pane is never empty.
    if (!flow) { setStepId(null); return; }
    if (stepId && flow.graph.steps.some(st => st.id === stepId)) return;
    const progress = progressOf(flow.graph, flow.progress);
    setStepId(progress.next.find(id => id !== 'start') || progress.next[0] || flow.graph.steps[0]?.id || null);
  }, [flow, stepId]);
  const step: FlowStep | null = flow?.graph.steps.find(st => st.id === stepId) || null;
  const progress = flow ? progressOf(flow.graph, flow.progress) : null;

  const replace = (next: Flow) => { setFlows(list => (list || []).map(f => f.id === next.id ? next : f)); setFollowing(list => list.map(f => f.id === next.id ? next : f)); };

  const build = async (text = goal) => {
    const wanted = text.trim(); if (!wanted || building) return;
    setBuilding(true);
    try {
      const made = await api<Flow>('/flows', { method: 'POST', body: JSON.stringify({ goal: wanted, folder_id: scope || null }) });
      setFlows(list => [made, ...(list || [])]); setSelectedId(made.id); setStepId(null); setGoal('');
      const forks = made.graph.steps.filter(st => st.kind === 'choice').length;
      p.notify(`The Keeper laid out ${made.step_count} steps${forks ? ` with ${forks} ${forks === 1 ? 'fork' : 'forks'}` : ''}.`);
      window.scrollTo({ top: 0 });
    } catch (e) { p.onError(e instanceof Error ? e.message : 'The flow could not be built.'); }
    finally { setBuilding(false); }
  };
  const toggle = async (id: string) => {
    if (!flow) return;
    try {
      const next = await api<Flow & { done: boolean }>(`/flows/${flow.id}/steps/${id}/toggle`, { method: 'POST' });
      replace(next);
      if (next.done && id === 'finish') p.notify('Path complete. Well walked.');
      else if (next.done) { const after = progressOf(next.graph, next.progress).next.find(n => n !== 'start' && n !== id); if (after) setStepId(after); }
    } catch (e) { p.onError(e instanceof Error ? e.message : 'The step could not be ticked.'); }
  };
  const publish = async (published: boolean) => {
    if (!flow) return; setSaving(true);
    try {
      const next = await api<Flow>(`/flows/${flow.id}`, { method: 'PATCH', body: JSON.stringify({ published }) }); replace(next);
      if (published) { try { await navigator.clipboard.writeText(`${location.origin}${next.href}`); p.notify('Published to the commons. Link copied.'); } catch { p.notify('Published to the commons.'); } }
      else p.notify('Taken back. Only you can see this flow now.');
    } catch (e) { p.onError(e instanceof Error ? e.message : 'Could not change who sees this flow.'); } finally { setSaving(false); }
  };
  const rename = async () => {
    if (!flow || !draftTitle.trim()) return; setSaving(true);
    try { replace(await api<Flow>(`/flows/${flow.id}`, { method: 'PATCH', body: JSON.stringify({ title: draftTitle.trim() }) })); setRenaming(false); }
    catch (e) { p.onError(e instanceof Error ? e.message : 'Could not rename the flow.'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!flow) return; setSaving(true);
    try { await api(`/flows/${flow.id}`, { method: 'DELETE' }); setFlows(list => (list || []).filter(f => f.id !== flow.id)); setSelectedId(null); setStepId(null); setConfirmDelete(false); p.notify('Flow removed.'); }
    catch (e) { p.onError(e instanceof Error ? e.message : 'Could not remove the flow.'); } finally { setSaving(false); }
  };

  const owned = (st: FlowStep) => st.document ? p.documents.find(d => d.id === st.document!.id) : undefined;
  const stepActions = (st: FlowStep) => {
    if (st.kind === 'read' && st.document) {
      const doc = owned(st);
      if (doc) return <button type="button" className={s.amber} onClick={() => p.onOpen(doc, { document: doc, page_number: st.page || 1, excerpt: st.excerpt || '', score: 0, match_type: 'flow', location_label: st.location })}><BookOpen size={14} /> Open in reader</button>;
      return <>
        {st.document.readable && <button type="button" className={s.amber} onClick={() => setReading({ id: st.document!.id, title: st.document!.title, page: st.page, excerpt: st.excerpt })}><BookOpen size={14} /> Read</button>}
        <button type="button" className={s.ghost} onClick={() => p.onFind(st.document!.title)}><Globe2 size={14} /> Find online</button>
        {st.document.source_url && <a className={s.ghost} href={st.document.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Source</a>}
        {!mine && !st.document.readable && <span className={s.muted}>Not in your library.</span>}
      </>;
    }
    if (st.kind === 'synthesize') return <button type="button" className={s.amber} onClick={() => p.onAsk(st.query || flow?.goal || '')}><Sparkles size={14} /> Ask the library</button>;
    return null;
  };

  const card = (f: Flow) => {
    const pr = progressOf(f.graph, f.progress);
    return <li key={f.id}><button type="button" className={s.flowCard} aria-current={flow?.id === f.id ? 'true' : undefined} onClick={() => { setSelectedId(f.id); setStepId(null); setConfirmDelete(false); setRenaming(false); }}>
      <span className={s.flowCardTop}><strong>{f.title}</strong>{f.published ? <Globe2 size={13} aria-label="Published" /> : <Lock size={13} aria-label="Private" />}</span>
      <small>{f.author.handle && f.author.handle !== p.viewerHandle ? `by ${f.author.display_name} · ` : ''}{f.step_count} steps · {forksLabel(f)} · {ago(f.updated_at)}</small>
      <span className={s.bar} aria-hidden="true"><i style={{ width: `${pr.total ? Math.round(100 * pr.completed / pr.total) : 0}%` }} /></span>
    </button></li>;
  };

  const composer = <section className={s.build} aria-labelledby="build-title">
    <div className={s.buildText}><h2 id="build-title"><Route size={18} aria-hidden="true" /> Ask the Keeper for a reading flow</h2><p>Name what you want to understand. The Keeper recalls the passages that speak to it, lays the documents out as a path, and adds a fork wherever a passage opens onto something worth a detour.</p></div>
    <form className={s.buildRow} onSubmit={e => { e.preventDefault(); build(); }}>
      <label className="visually-hidden" htmlFor="flow-goal">What do you want to understand?</label>
      <input id="flow-goal" className={s.goal} value={goal} onChange={e => setGoal(e.target.value)} placeholder="What do you want to understand?" maxLength={500} disabled={p.blocked || building} />
      <label className="visually-hidden" htmlFor="flow-scope">Where to look</label>
      <select id="flow-scope" className={s.scope} value={scope} onChange={e => setScope(e.target.value)} disabled={p.blocked || building}><option value="">Whole library</option>{p.folders.filter(f => !f.parent_id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      <button type="submit" className={s.primary} disabled={p.blocked || building || !goal.trim() || !p.embeddingReady}>{building ? <><LoaderCircle size={15} className="spin" /> Reading the shelf…</> : <>Build the flow <ArrowRight size={15} /></>}</button>
    </form>
    <div className={s.examples}><span>Try</span>{EXAMPLES.map(ex => <button key={ex} type="button" disabled={p.blocked || building} onClick={() => { setGoal(ex); build(ex); }}>{ex}</button>)}{!p.embeddingReady && <em>The semantic index is warming up.</em>}</div>
  </section>;

  const empty = <div className={ws.empty}><WebCorner corner="top-left" size={60} className={ws.emptyWeb} /><SpiderGlyph size={22} eyes={false} /><h3>No flows yet.</h3><p>Ask the Keeper above. A flow is a path through what you keep, with forks you may take or skip, that you tick off as you read.</p></div>;

  return <div className={s.screen} data-screen="flows">
    {composer}
    {p.gate || (flows === null ? <div className={ws.skeleton} aria-label="Loading your flows">{[0, 1, 2].map(n => <span key={n} />)}</div>
      : building && !all.length ? <div className={ws.working} role="status"><Dangler className={ws.descend} drop={60} size={20} /><h3>Reading the shelf.</h3><p>Recalling the passages that speak to your goal and following their words to find detours.</p></div>
      : !all.length ? <>{loadError && <p className={s.inlineError}>{loadError}</p>}{empty}</>
      : <div className={s.flowsSplit}>
        <aside className={s.flowsAside} aria-label="Your flows">
          <div className={ws.paneHead}><h2>Your flows</h2><span>{(flows || []).length}</span></div>
          <ul className={s.flowList}>{(flows || []).map(card)}</ul>
          {following.length > 0 && <><div className={ws.paneHead}><h2>Flows you walk</h2><span>{following.length}</span></div><ul className={s.flowList}>{following.map(card)}</ul></>}
        </aside>
        {flow && progress && <section className={s.flowMain} aria-labelledby="flow-title">
          <header className={s.flowHead}>
            <div className={s.flowHeadText}>
              {renaming ? <form className={s.renameRow} onSubmit={e => { e.preventDefault(); rename(); }}><input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} maxLength={200} autoFocus aria-label="Flow title" /><button type="submit" className={s.primary} disabled={saving || !draftTitle.trim()}><Check size={14} /></button><button type="button" className={s.ghost} onClick={() => setRenaming(false)} aria-label="Cancel"><X size={14} /></button></form>
                : <h1 id="flow-title">{flow.title}{mine && <button type="button" className={s.iconLink} aria-label="Rename the flow" onClick={() => { setDraftTitle(flow.title); setRenaming(true); }}><Pencil size={14} /></button>}</h1>}
              <p className={s.goalLine}><Sparkles size={13} aria-hidden="true" /> {flow.goal}</p>
              {flow.description && <p className={s.muted}>{flow.description}</p>}
              <p className={s.metaLine}>
                <span>{mine ? 'Laid out by the Keeper' : <>By <a href={`/u/${flow.author.handle}`}>{flow.author.display_name}</a></>}{flow.folder_name ? ` from ${flow.folder_name}` : ''}{flow.model ? ` · notes by ${flow.model}` : ''}</span>
                <span>{progress.completed} of {progress.total} done · {forksLabel(flow)}{flow.published ? <> · <Users size={12} aria-hidden="true" /> {flow.reader_count} {flow.reader_count === 1 ? 'reader' : 'readers'}</> : ''}</span>
              </p>
            </div>
            <div className={s.flowTools}>
              {mine && (flow.published
                ? <><button type="button" className={s.ghost} disabled={saving} onClick={() => p.onCopy(`${location.origin}${flow.href}`)}><LinkIcon size={14} /> Copy link</button><button type="button" className={s.ghost} disabled={saving} onClick={() => publish(false)}><Lock size={14} /> Unpublish</button></>
                : <button type="button" className={s.amber} disabled={saving} onClick={() => publish(true)}><Globe2 size={14} /> Publish to the commons</button>)}
              {!mine && <a className={s.ghost} href={flow.href}>Open its page <ArrowRight size={14} /></a>}
              {mine && (confirmDelete
                ? <span className={s.confirm}>Remove this flow? <button type="button" className={s.danger} disabled={saving} onClick={remove}>Remove</button><button type="button" className={s.ghost} onClick={() => setConfirmDelete(false)}>Keep</button></span>
                : <button type="button" className={s.iconLink} aria-label="Remove the flow" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /></button>)}
            </div>
          </header>
          <div className={s.progressRow}><span className={s.bar} data-large="true" aria-label={`${progress.completed} of ${progress.total} steps done`} role="img"><i style={{ width: `${progress.total ? Math.round(100 * progress.completed / progress.total) : 0}%` }} /></span>{progress.complete ? <span className={s.complete}><Check size={13} /> Path complete</span> : progress.next.length ? <span className={s.muted}><GitFork size={12} aria-hidden="true" /> {progress.next.length === 1 ? 'One step open' : `${progress.next.length} steps open`}</span> : null}</div>
          <FlowMap graph={flow.graph} done={flow.progress} selected={stepId} onSelect={setStepId} />
          <FlowLegend />
          <div className={s.stepSplit}>
            <FlowChecklist graph={flow.graph} done={flow.progress} selected={stepId} canTick={!p.blocked} onSelect={setStepId} onToggle={toggle} />
            {step && <StepDetail graph={flow.graph} step={step} done={flow.progress.includes(step.id)} canTick={!p.blocked} onToggle={toggle} onSelect={setStepId}>{stepActions(step)}</StepDetail>}
          </div>
          {(flow.published || mine) && <CommentThread kind="flow" id={flow.id} canPost={!p.blocked} canModerate={mine} viewerHandle={p.viewerHandle} onError={p.onError} />}
        </section>}
      </div>)}
    {reading && <TextReader documentId={reading.id} title={reading.title} page={reading.page} excerpt={reading.excerpt} onClose={() => setReading(null)} />}
  </div>;
}
