'use client';

import { ArrowRight, BookOpen, Check, ChevronDown, Globe2, MessageSquareText, Search } from 'lucide-react';
import type { SearchMode } from '@/lib/types';
import styles from './request-guide.module.css';

const MODES = [
  {
    id: 'discover',
    label: 'Find online',
    icon: Globe2,
    scope: 'Outside your library',
    description: 'Bring something new into your room.',
    purpose: 'The spider looks for free full text on public sources. You choose what to keep.',
    example: 'Papers about how coral reefs recover',
    steps: [
      { title: 'Follow the question', body: 'Look up your title, author, or topic across public book and research sources.' },
      { title: 'Check the copy', body: 'Check whether a candidate has usable full text. A catalog listing alone is not a free find.' },
      { title: 'Choose what stays', body: 'Open a source, or keep an eligible copy in your library so it can be searched later.' },
    ],
    concept: 'Discovery finds new sources. A checked full text means it was accessible; it does not establish the quality of its claims.',
  },
  {
    id: 'search',
    label: 'Search my library',
    icon: Search,
    scope: 'Your saved documents',
    description: 'Find the passage you almost remember.',
    purpose: 'Keeper follows words and meaning through your saved documents, then points to the passage.',
    example: 'Why do threads slow each other down?',
    steps: [
      { title: 'Describe the idea', body: 'Use the wording you remember, an exact title, or a description in your own words.' },
      { title: 'Match words + meaning', body: 'Compare your question with passage embeddings, then combine that with matching words and titles.' },
      { title: 'Open the source page', body: 'Open a matching passage in its document. A selected collection narrows the search to that collection.' },
    ],
    concept: 'An embedding is a numerical representation of meaning. It can connect “threads slow down” with “false sharing.” Similarity helps rank passages; it is not a certainty score.',
  },
  {
    id: 'ask',
    label: 'Ask my library',
    icon: MessageSquareText,
    scope: 'Answers with sources',
    description: 'Connect ideas, with the evidence beside them.',
    purpose: 'Keeper gathers relevant passages for an answer you can trace back to your own sources.',
    example: 'How can I reduce false sharing?',
    steps: [
      { title: 'Gather the evidence', body: 'Search your saved passages by words and meaning. A selected collection limits the sources.' },
      { title: 'Build a grounded answer', body: 'When the answer model is available, it writes from those passages and links its sources with numbered citations.' },
      { title: 'Read, then verify', body: 'Open each citation to check the context. If generation is unavailable or fails validation, you get labeled source extracts instead.' },
    ],
    concept: 'Retrieval-augmented generation means finding evidence before writing. If the library has too little evidence, Keeper should say so. Always check the cited passages.',
  },
] as const;

export interface RequestGuideProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  disabled?: boolean;
  onExample?: (query: string) => void;
  compact?: boolean;
}

export default function RequestGuide({ mode, onModeChange, disabled = false, onExample, compact = false }: RequestGuideProps) {
  if (compact) {
    return <div className={styles.compact} role="group" aria-label="Request mode" data-keeper-obstacle>
      {MODES.map(item => <button
        key={item.id}
        type="button"
        aria-pressed={mode === item.id}
        disabled={disabled}
        onClick={() => onModeChange(item.id)}
      >{item.id === 'discover' ? 'Find online' : item.id === 'search' ? 'Search library' : 'Ask library'}</button>)}
    </div>;
  }

  const selected = MODES.find(item => item.id === mode)!;

  return <section className={styles.guide} aria-label="Choose Keeper’s job" data-keeper-obstacle>
    <div className={styles.heading}>
      <span className={styles.eyebrow}>Give Keeper a job</span>
      <span className={styles.scope}>{selected.scope}</span>
    </div>
    <div className={styles.modes} role="group" aria-label="Request mode">
      {MODES.map((item, index) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return <button
          key={item.id}
          type="button"
          className={`${styles.mode} ${active ? styles.selected : ''}`}
          aria-pressed={active}
          disabled={disabled}
          onClick={() => onModeChange(item.id)}
        >
          <span className={styles.cardTop}><Icon size={17} strokeWidth={1.6} aria-hidden="true" /><span className={styles.number} aria-hidden="true">{active ? <Check size={12} /> : `0${index + 1}`}</span></span>
          <strong>{item.label}</strong>
          <span className={styles.description}>{item.description}</span>
        </button>;
      })}
    </div>
    <p className={styles.purpose}>{selected.purpose}</p>
    <details className={styles.explainer}>
      <summary><span><BookOpen size={14} aria-hidden="true" />How it works</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className={styles.lesson}>
        <ol className={styles.steps}>
          {selected.steps.map((step, index) => <li key={step.title}>
            <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
            <div><strong>{step.title}</strong><p>{step.body}</p></div>
          </li>)}
        </ol>
        <p className={styles.concept}>{selected.concept}</p>
        {onExample && <button className={styles.example} type="button" disabled={disabled} onClick={() => onExample(selected.example)}>
          <span><small>Try a question</small>{selected.example}</span><ArrowRight size={16} aria-hidden="true" />
        </button>}
      </div>
    </details>
  </section>;
}
