'use client';

import { ArrowUpRight, BookOpen, Check, ChevronDown, Globe2, Plus } from 'lucide-react';
import type { Discovery } from '@/lib/types';

// Provider URLs remain data. Only ordinary web links can become clickable controls.
function webLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export default function DiscoveryResults({ results, unavailable, showUnavailable, onToggle, disabled, onKeep, onPermission }: {
  results: Discovery[];
  unavailable: Discovery[];
  showUnavailable: boolean;
  onToggle: () => void;
  disabled: boolean;
  onKeep: (item: Discovery) => void;
  onPermission: (item: Discovery) => void;
}) {
  const available = results.filter(item => item.access_status === 'verified_full_text' && webLink(item.read_url));
  const other = [...unavailable, ...results.filter(item => !available.includes(item))];

  const card = (item: Discovery, verified: boolean) => {
    const readUrl = webLink(item.read_url);
    const sourceUrl = webLink(item.source_url);
    const importUrl = webLink(item.import_url);
    const version = item.version === 'submittedVersion' ? 'Preprint' : item.version === 'acceptedVersion' ? 'Accepted manuscript' : '';
    return <article data-keeper-anchor={verified ? `result:${item.id}` : undefined} key={item.id} className={`discovery-card ${verified ? 'verified-card' : 'catalog-card'}`}>
      <div className="discovery-card-top"><span className="source-tag"><Globe2 size={12} /> {item.source}{item.year ? ` · ${item.year}` : ''}</span>{item.format && verified && <span className="format-badge">{item.format}</span>}</div>
      <h3>{item.title}</h3>
      <p>{item.authors?.slice(0, 3).join(', ') || 'Author information unavailable'}{item.authors?.length > 3 ? ' & others' : ''}</p>
      {version && <span className="version-note">{version}</span>}
      <div className="discovery-access"><span className={`access-label ${verified ? 'available' : ''}`}>{verified ? <><Check size={12} /> Full text checked</> : item.access_reason || 'Free full text has not been verified.'}</span>{verified && !item.importable && <small>{importUrl ? 'Saving a copy needs your permission confirmation.' : item.access_reason || 'This copy can be read at its source.'}</small>}</div>
      <div className="discovery-actions">
        {verified && readUrl ? <a className="text-button read-link" href={readUrl} target="_blank" rel="noopener noreferrer" aria-label={`Read free: ${item.title}`}><BookOpen size={13} /> Read free <ArrowUpRight size={13} /></a> : sourceUrl && <a className="text-button catalog-link" href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Catalog entry: ${item.title}`}>Catalog entry <ArrowUpRight size={13} /></a>}
        {verified && importUrl && (item.importable ? <button className="button small-button" disabled={disabled} onClick={() => onKeep(item)}><Plus size={13} /> Keep it</button> : <button className="text-button" disabled={disabled} onClick={() => onPermission(item)}>Save with permission</button>)}
      </div>
    </article>;
  };

  return <>
    {available.length > 0 ? <><p className="verified-summary"><Check size={12} /> {available.length} free {available.length === 1 ? 'full text' : 'full texts'} checked · any format</p>{available.map(item => card(item, true))}</> : <div className="empty-state discovery-empty"><BookOpen size={27} /><h3>No free full text verified.</h3><p>The copies checked didn’t give us a usable full text. Try another title or a broader subject. A catalog match alone won’t appear as a free find.</p></div>}
    {other.length > 0 && <div className="other-matches"><button className="other-matches-toggle" aria-expanded={showUnavailable} onClick={onToggle}><span>{showUnavailable ? 'Hide' : 'Show'} {other.length} other {other.length === 1 ? 'match' : 'matches'}</span><ChevronDown size={15} className={showUnavailable ? 'turned' : ''} /></button><p>Catalog entries, previews, or copies we couldn’t verify. These may require payment or sign-in.</p>{showUnavailable && <div className="other-matches-list">{other.map(item => card(item, false))}</div>}</div>}
  </>;
}
