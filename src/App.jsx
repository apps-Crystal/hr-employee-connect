import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { getDashboard, submitWeek1, submitWeek234, addIssues, updateStatus } from './api';

// ─── FLAG TOOLTIPS ──────────────────────────────────────────────────
const FLAG_TOOLTIPS = {
  Red: '🔴 Critical — Employee cannot perform job / at risk of leaving. Requires immediate HR intervention.',
  Orange: '🟠 At-Risk — Productivity blocked or benefits pending. Needs follow-up within 48 hours.',
  Yellow: '🟡 Monitoring — Minor concerns noted. Employee adjusting, may need support if situation persists.'
};
const getFlagTooltip = (flag) => FLAG_TOOLTIPS[flag] || '';

// ─── FORMAT DOJ HELPER ──────────────────────────────────────────────
function formatDOJ(raw) {
  if (!raw) return '—';
  const str = String(raw);
  // Try to parse date strings and return DD-MM-YYYY
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch { /* ignore */ }
  return str;
}

function formatShortDate(raw) {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
  } catch { /* ignore */ }
  return String(raw).split(',')[0];
}

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const loadAll = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getDashboard();
      setEmployees(res.employees || []);
      setIssues(res.issues || []);
    } catch (e) { alert('Load error: ' + e.message); }
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => loadAll()); }, [loadAll]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'week1', label: '📝 Week 1 Form' },
    { id: 'week234', label: '📋 Week 2-4 Form' },
    { id: 'tracker', label: '🎯 Issue Tracker' },
    { id: 'raise', label: '➕ Raise Issues / Support Tickets' },
  ];

  return (
    <>
      {/* Header */}
      <header className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="flex-between">
          <div>
            <h1 className="gradient-text" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>HR Employee Connect</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem', letterSpacing: '0.01em' }}>Issue Tracking & Resolution System</p>
          </div>
        </div>
        <div className="nav-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`nav-tab ${page === t.id ? 'active' : ''}`} onClick={() => setPage(t.id)}>{t.label}</button>
          ))}
        </div>
      </header>

      {/* Loading */}
      {loading && <div className="flex-center" style={{ flex: 1 }}><div className="spinner" /></div>}

      {/* Pages */}
      {!loading && page === 'dashboard' && <Dashboard issues={issues} onStatusChange={async (tid, st) => { await updateStatus(tid, st, ''); showToast(`🔄 ${tid} → ${st}`); loadAll(); }} onResolve={(tid, notes) => updateStatus(tid, 'Resolved', notes).then(() => { showToast(`✅ ${tid} Resolved!`); loadAll(); })} />}
      {!loading && page === 'week1' && <Week1Form employees={employees} onSubmit={async (d) => { await submitWeek1(d); showToast('✅ Week 1 response saved!'); }} />}
      {!loading && page === 'week234' && <Week234Form employees={employees} onSubmit={async (d) => { await submitWeek234(d); showToast('✅ Week 2-4 response saved!'); }} />}
      {!loading && page === 'tracker' && <IssueTracker issues={issues} onStatusChange={async (tid, st) => { await updateStatus(tid, st, ''); showToast(`🔄 ${tid} → ${st}`); loadAll(); }} onResolve={(tid, notes) => updateStatus(tid, 'Resolved', notes).then(() => { showToast(`✅ ${tid} Resolved!`); loadAll(); })} />}
      {!loading && page === 'raise' && <RaiseIssue employees={employees} onSubmit={async (data) => { const res = await addIssues(data); showToast(`🎫 ${res.count} ticket(s) created: ${res.ticketIDs.join(', ')}`); loadAll(); }} />}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────
function Dashboard({ issues, onStatusChange, onResolve }) {
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [activeFilter, setActiveFilter] = useState('Needs Attention');
  const [search, setSearch] = useState('');

  const matchesSearch = (issue) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (issue['Employee Name'] || '').toLowerCase().includes(q) ||
      (issue['Ticket ID'] || '').toLowerCase().includes(q) ||
      (issue['Screening ID'] || '').toLowerCase().includes(q) ||
      (issue.Description || '').toLowerCase().includes(q)
    );
  };

  const getFilteredIssues = () => {
    let result;
    switch (activeFilter) {
      case 'Total Tickets': result = issues; break;
      case 'Red': result = issues.filter(i => i['Flag Level'] === 'Red' && i.Status !== 'Resolved'); break;
      case 'Orange': result = issues.filter(i => i['Flag Level'] === 'Orange' && i.Status !== 'Resolved'); break;
      case 'Yellow': result = issues.filter(i => i['Flag Level'] === 'Yellow' && i.Status !== 'Resolved'); break;
      case 'Open': result = issues.filter(i => i.Status === 'Open'); break;
      case 'Resolved': result = issues.filter(i => i.Status === 'Resolved'); break;
      default: result = issues.filter(i => i.Status !== 'Resolved');
    }
    return result.filter(matchesSearch);
  };

  const displayIssues = getFilteredIssues();

  return (
    <div className="space-y">
      <div className="stat-grid">
        <div className="glass stat-card hover-card" style={{ cursor: 'pointer', border: activeFilter === 'Total Tickets' ? '1px solid var(--purple-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Total Tickets' ? 'Needs Attention' : 'Total Tickets')}><p className="stat-value">{issues.length}</p><p className="stat-label">Total Tickets</p></div>
        <div className="glass stat-card hover-card" style={{ cursor: 'pointer', border: activeFilter === 'Open' ? '1px solid var(--orange-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Open' ? 'Needs Attention' : 'Open')}><p className="stat-value" style={{ color: 'var(--orange-400)' }}>{issues.filter(i => i.Status === 'Open').length}</p><p className="stat-label">⏳ Open</p></div>
        <div className="glass stat-card hover-card" title={FLAG_TOOLTIPS.Red} style={{ cursor: 'pointer', border: activeFilter === 'Red' ? '1px solid var(--red-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Red' ? 'Needs Attention' : 'Red')}><p className="stat-value" style={{ color: 'var(--red-400)' }}>{issues.filter(i => i['Flag Level'] === 'Red' && i.Status !== 'Resolved').length}</p><p className="stat-label">🔴 Critical</p></div>
        <div className="glass stat-card hover-card" title={FLAG_TOOLTIPS.Orange} style={{ cursor: 'pointer', border: activeFilter === 'Orange' ? '1px solid var(--orange-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Orange' ? 'Needs Attention' : 'Orange')}><p className="stat-value" style={{ color: 'var(--orange-400)' }}>{issues.filter(i => i['Flag Level'] === 'Orange' && i.Status !== 'Resolved').length}</p><p className="stat-label">🟠 At-Risk</p></div>
        <div className="glass stat-card hover-card" title={FLAG_TOOLTIPS.Yellow} style={{ cursor: 'pointer', border: activeFilter === 'Yellow' ? '1px solid var(--yellow-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Yellow' ? 'Needs Attention' : 'Yellow')}><p className="stat-value" style={{ color: 'var(--yellow-400)' }}>{issues.filter(i => i['Flag Level'] === 'Yellow' && i.Status !== 'Resolved').length}</p><p className="stat-label">🟡 Monitoring</p></div>
        <div className="glass stat-card hover-card" style={{ cursor: 'pointer', border: activeFilter === 'Resolved' ? '1px solid var(--emerald-400)' : '' }} onClick={() => setActiveFilter(activeFilter === 'Resolved' ? 'Needs Attention' : 'Resolved')}><p className="stat-value" style={{ color: 'var(--emerald-400)' }}>{issues.filter(i => i.Status === 'Resolved').length}</p><p className="stat-label">✅ Resolved</p></div>
      </div>

      <div className="glass" style={{ padding: '1.25rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>⚡ {activeFilter === 'Needs Attention' ? 'Open Issues (Needs Attention)' : activeFilter + ' Issues'} <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>({displayIssues.length})</span></h2>
          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '320px', flex: '0 1 320px' }}>
            <input className="g-input" style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ticket ID, description..." />
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', pointerEvents: 'none' }}>🔍</span>
            {search && <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>}
          </div>
        </div>
        <div className="space-y-sm">
          {displayIssues.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>🎉 No issues found for this filter!</p>}
          {displayIssues.slice(0, 20).map(issue => (
            <div key={issue['Ticket ID']} className="ticket-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div className="flex-gap" style={{ marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--purple-400)' }}>{issue['Ticket ID']}</span>
                  <span className={`badge badge-${issue['Flag Level'] === 'Red' ? 'red' : issue['Flag Level'] === 'Orange' ? 'orange' : 'yellow'}`} title={getFlagTooltip(issue['Flag Level'])}>{issue['Flag Level']}</span>
                  <span className={`badge ${issue.Type === 'Issue' ? 'badge-red' : 'badge-blue'}`}>{issue.Type}</span>
                </div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{issue['Employee Name']}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.375rem', lineHeight: 1.5 }}>{issue.Description}</p>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingTop: '0.125rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatShortDate(issue['Date Raised'])}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', minWidth: '130px', maxWidth: '280px' }}>
                {issue.Status !== 'Resolved' ? (
                  <>
                    <button className="btn btn-xs" style={{ background: 'rgba(250,204,21,0.2)', color: 'var(--yellow-400)', width: '100%' }} onClick={() => onStatusChange(issue['Ticket ID'], 'In Progress')}>🔄 In Progress</button>
                    <button className="btn btn-xs" style={{ background: 'rgba(52,211,153,0.2)', color: 'var(--emerald-400)', width: '100%' }} onClick={() => { setResolveModal(issue); setResolveNotes(''); }}>✅ Resolve</button>
                  </>
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--emerald-400)', textAlign: 'right', lineHeight: 1.4 }}>{issue['Resolution Notes'] || 'Resolved'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="modal-overlay" onClick={() => setResolveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--emerald-400)', marginBottom: '1rem' }}>✅ Resolve: {resolveModal['Ticket ID']}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{resolveModal['Employee Name']}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{resolveModal.Description}</p>
            <label className="label">Resolution Notes *</label>
            <textarea className="g-input" rows={3} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="How was this resolved?" />
            <div className="flex-gap" style={{ marginTop: '1rem' }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { if (!resolveNotes) return alert('Add notes'); onResolve(resolveModal['Ticket ID'], resolveNotes); setResolveModal(null); }}>Mark Resolved</button>
              <button className="btn btn-ghost" onClick={() => setResolveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMPLOYEE SELECT + AUTOFILL HOOK ────────────────────────────────
function useEmployeeSelect() {
  const empty = { screeningID: '', name: '', designation: '', doj: '' };
  const [selected, setSelected] = useState(empty);

  const selectEmployee = (emp) => {
    setSelected({ screeningID: emp.screeningID, name: emp.name, designation: emp.designation, doj: emp.doj });
  };

  const reset = () => setSelected({ ...empty });

  return { selected, selectEmployee, reset };
}

// ─── SEARCHABLE EMPLOYEE DROPDOWN (Search by Name) ──────────────────
function EmployeeSearchDropdown({ employees, selected, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (emp) => {
    onSelect(emp);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery('');
    setIsOpen(false);
  };

  // If employee is already selected, show their name with a clear button
  if (selected.screeningID) {
    return (
      <div>
        <label className="label">Search Employee *</label>
        <div className="g-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontWeight: 500 }}>{selected.name}</span>
          <button type="button" onClick={handleClear} style={{ background: 'none', border: 'none', color: 'var(--red-400)', cursor: 'pointer', fontSize: '0.9375rem', padding: '0 0.25rem' }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <label className="label">Search Employee by Name *</label>
      <div style={{ position: 'relative' }}>
        <input
          className="g-input"
          style={{ paddingRight: '2rem' }}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Click to browse or type to search..."
          autoComplete="off"
        />
        <span
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', userSelect: 'none'
          }}
        >{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          maxHeight: '260px', overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.97)', border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '0.75rem', marginTop: '0.25rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''} {query ? 'matching' : 'available'}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No matches found</div>
          )}
          {filtered.map(emp => (
            <div
              key={emp.screeningID}
              onClick={() => handleSelect(emp)}
              style={{
                padding: '0.625rem 1rem', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#fff' }}>{emp.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{emp.screeningID} • {emp.designation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EMPLOYEE AUTO-FILLED INFO ──────────────────────────────────────
function EmployeeInfo({ data }) {
  return (
    <div className="grid-4">
      <div><label className="label">Screening ID</label><p className="info-value" style={{ fontFamily: 'monospace', color: 'var(--purple-400)', fontSize: '0.8125rem' }}>{data.screeningID || '—'}</p></div>
      <div><label className="label">Name</label><p className="info-value">{data.name || '—'}</p></div>
      <div><label className="label">Designation</label><p className="info-value">{data.designation || '—'}</p></div>
      <div><label className="label">DOJ</label><p className="info-value">{formatDOJ(data.doj)}</p></div>
    </div>
  );
}

// ─── WEEK 1 FORM ────────────────────────────────────────────────────
function Week1Form({ employees, onSubmit }) {
  const { selected: emp, selectEmployee, reset: resetEmp } = useEmployeeSelect();
  const [day, setDay] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [comfort, setComfort] = useState('');
  const [support, setSupport] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emp.screeningID || !day) return alert('Select employee and day.');
    setSubmitting(true);
    try {
      await onSubmit({ ...emp, day, jobRole, comfort, support, location });
      resetEmp(); setDay(''); setJobRole(''); setComfort(''); setSupport(''); setLocation('');
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="glass" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--purple-400)', marginBottom: '1rem' }}>📝 Week 1 Daily Touchpoint Form</h2>
      <form onSubmit={handleSubmit} className="space-y-sm">
        <div className="grid-3">
          <EmployeeSearchDropdown employees={employees} selected={emp} onSelect={selectEmployee} onClear={resetEmp} />
          <div>
            <label className="label">Day *</label>
            <select className="g-input" value={day} onChange={e => setDay(e.target.value)} required>
              <option value="">-- Select Day --</option>
              <option value="Day 1">Day 1 — Basics & IT</option>
              <option value="Day 2">Day 2 — Role Clarity</option>
              <option value="Day 3">Day 3 — Comfort & Travel</option>
              <option value="Day 4">Day 4 — System & Process</option>
              <option value="Day 5">Day 5 — Workload Review</option>
              <option value="Day 6">Day 6 — Week 1 Summary</option>
            </select>
          </div>
          <div><label className="label">Location</label>
            <select className="g-input" value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">— Select Location —</option>
              <option value="KOLKATA">Kolkata</option>
              <option value="MUMBAI">Mumbai</option>
              <option value="DETROJ">Detroj</option>
              <option value="DHULAGARH">Dhulagarh</option>
              <option value="BHUBANESWAR">Bhubaneswar</option>
              <option value="PUNE">Pune</option>
              <option value="NOIDA">Noida</option>
              <option value="KHEDA">Kheda</option>
              <option value="DANKUNI">Dankuni</option>
            </select>
          </div>
        </div>
        <EmployeeInfo data={emp} />
        <div className="grid-2">
          <div><label className="label">Discussion on Job Role</label><textarea className="g-input" rows={2} value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="Responsibilities, clarity, team coordination..." /></div>
          <div><label className="label">Personal Comfort / Discomfort</label><textarea className="g-input" rows={2} value={comfort} onChange={e => setComfort(e.target.value)} placeholder="Travel, accommodation, food, workspace..." /></div>
        </div>
        <div><label className="label">Additional Support / Clarity / System Needed</label><textarea className="g-input" rows={2} value={support} onChange={e => setSupport(e.target.value)} placeholder="Laptop, email ID, software, mediclaim..." /></div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Week 1 Response'}</button>
      </form>
    </div>
  );
}

// ─── WEEK 2-4 FORM ──────────────────────────────────────────────────
function Week234Form({ employees, onSubmit }) {
  const { selected: emp, selectEmployee, reset: resetEmp } = useEmployeeSelect();
  const [weekNumber, setWeekNumber] = useState('');
  const [roleClarity, setRoleClarity] = useState('');
  const [workEnv, setWorkEnv] = useState('');
  const [supportReq, setSupportReq] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emp.screeningID || !weekNumber) return alert('Select employee and week.');
    setSubmitting(true);
    try {
      await onSubmit({ ...emp, weekNumber, roleClarity, workEnvironment: workEnv, supportRequired: supportReq });
      resetEmp(); setWeekNumber(''); setRoleClarity(''); setWorkEnv(''); setSupportReq('');
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="glass" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--pink-500)', marginBottom: '1rem' }}>📋 Week 2 / 3 / 4 Review Form</h2>
      <form onSubmit={handleSubmit} className="space-y-sm">
        <div className="grid-2">
          <EmployeeSearchDropdown employees={employees} selected={emp} onSelect={selectEmployee} onClear={resetEmp} />
          <div>
            <label className="label">Week Number *</label>
            <select className="g-input" value={weekNumber} onChange={e => setWeekNumber(e.target.value)} required>
              <option value="">-- Select --</option>
              <option value="Week 2">Week 2</option>
              <option value="Week 3">Week 3</option>
              <option value="Week 4">Week 4</option>
            </select>
          </div>
        </div>
        <EmployeeInfo data={emp} />
        <div className="grid-2">
          <div><label className="label">Role Clarity & Workload</label><textarea className="g-input" rows={2} value={roleClarity} onChange={e => setRoleClarity(e.target.value)} placeholder="Clear about roles? Occupied enough?" /></div>
          <div><label className="label">Work Environment & Comfort</label><textarea className="g-input" rows={2} value={workEnv} onChange={e => setWorkEnv(e.target.value)} placeholder="Comfortable? Infrastructure? Conversations with RM?" /></div>
        </div>
        <div><label className="label">Support Required</label><textarea className="g-input" rows={2} value={supportReq} onChange={e => setSupportReq(e.target.value)} placeholder="What support does the employee need?" /></div>
        <button className="btn btn-pink" style={{ width: '100%' }} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Week 2-4 Response'}</button>
      </form>
    </div>
  );
}

// ─── ISSUE TRACKER ──────────────────────────────────────────────────
function IssueTracker({ issues, onStatusChange, onResolve }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [search, setSearch] = useState('');

  const filtered = issues.filter(i => {
    if (statusFilter && i.Status !== statusFilter) return false;
    if (flagFilter && i['Flag Level'] !== flagFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        (i['Employee Name'] || '').toLowerCase().includes(q) ||
        (i['Ticket ID'] || '').toLowerCase().includes(q) ||
        (i['Screening ID'] || '').toLowerCase().includes(q) ||
        (i.Description || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y">
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="flex-gap">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Filter:</span>
          {['', 'Open', 'In Progress', 'Resolved'].map(s => (
            <button key={s} className={`pill ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s || 'All'}</button>
          ))}
          <span style={{ margin: '0 0.25rem', color: 'rgba(255,255,255,0.1)' }}>|</span>
          {['', 'Red', 'Orange', 'Yellow'].map(f => (
            <button key={f} className={`pill ${flagFilter === f ? 'active' : ''}`} onClick={() => setFlagFilter(f)}>{f ? (f === 'Red' ? '🔴' : f === 'Orange' ? '🟠' : '🟡') : 'All Flags'}</button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: '220px', maxWidth: '300px', flex: '0 1 300px' }}>
          <input className="g-input" style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ticket, description..." />
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', pointerEvents: 'none' }}>🔍</span>
          {search && <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>}
        </div>
      </div>

      <div className="glass" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table className="tracker-table">
          <thead>
            <tr>
              <th>Ticket</th><th>Employee</th><th>Type</th><th>Description</th><th>Flag</th><th>Owner</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(issue => (
              <tr key={issue['Ticket ID']}>
                <td>
                  <span style={{ fontFamily: 'monospace', color: 'var(--purple-400)', fontSize: '0.8125rem' }}>{issue['Ticket ID']}</span><br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatShortDate(issue['Date Raised'])}</span>
                </td>
                <td><span style={{ fontSize: '0.875rem' }}>{issue['Employee Name']}</span><br /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{issue['Screening ID']}</span></td>
                <td><span className={`badge ${issue.Type === 'Issue' ? 'badge-red' : 'badge-blue'}`}>{issue.Type}</span></td>
                <td style={{ maxWidth: '240px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{issue.Description}</td>
                <td><span className={`badge badge-${issue['Flag Level'] === 'Red' ? 'red' : issue['Flag Level'] === 'Yellow' ? 'yellow' : 'orange'}`} title={getFlagTooltip(issue['Flag Level'])}>{issue['Flag Level']}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{issue['Action Owner'] || '—'}</td>
                <td><span className={`badge ${issue.Status === 'Resolved' ? 'badge-green' : issue.Status === 'In Progress' ? 'badge-yellow' : 'badge-orange'}`}>{issue.Status}</span></td>
                <td>
                  {issue.Status !== 'Resolved' ? (
                    <div className="flex-gap">
                      <button className="btn btn-xs" style={{ background: 'rgba(250,204,21,0.2)', color: 'var(--yellow-400)' }} onClick={() => onStatusChange(issue['Ticket ID'], 'In Progress')}>🔄</button>
                      <button className="btn btn-xs" style={{ background: 'rgba(52,211,153,0.2)', color: 'var(--emerald-400)' }} onClick={() => { setResolveModal(issue); setResolveNotes(''); }}>✅</button>
                    </div>
                  ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{issue['Resolution Notes'] || 'Done'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No issues matching this filter.</p>}
      </div>

      {resolveModal && (
        <div className="modal-overlay" onClick={() => setResolveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--emerald-400)', marginBottom: '1rem' }}>✅ Resolve: {resolveModal['Ticket ID']}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{resolveModal['Employee Name']}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{resolveModal.Description}</p>
            <label className="label">Resolution Notes *</label>
            <textarea className="g-input" rows={3} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="How was this resolved?" />
            <div className="flex-gap" style={{ marginTop: '1rem' }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { if (!resolveNotes) return alert('Add notes'); onResolve(resolveModal['Ticket ID'], resolveNotes); setResolveModal(null); }}>Mark Resolved</button>
              <button className="btn btn-ghost" onClick={() => setResolveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RAISE ISSUE (MULTIPLE) ─────────────────────────────────────────
function RaiseIssue({ employees, onSubmit }) {
  const { selected: emp, selectEmployee, reset: resetEmp } = useEmployeeSelect();
  const [sourceWeek, setSourceWeek] = useState('Week 1');
  const [rows, setRows] = useState([{ type: 'Issue', description: '', flagLevel: 'Yellow', actionOwner: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setRows([...rows, { type: 'Issue', description: '', flagLevel: 'Yellow', actionOwner: '' }]);
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx, field, val) => { const nr = [...rows]; nr[idx] = { ...nr[idx], [field]: val }; setRows(nr); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emp.screeningID) return alert('Select an employee first.');
    const valid = rows.filter(r => r.description.trim());
    if (!valid.length) return alert('Add at least one issue with a description.');
    setSubmitting(true);
    try {
      const payload = valid.map(r => ({ ...r, screeningID: emp.screeningID, name: emp.name, designation: emp.designation, sourceWeek }));
      await onSubmit(payload);
      resetEmp(); setSourceWeek('Week 1'); setRows([{ type: 'Issue', description: '', flagLevel: 'Yellow', actionOwner: '' }]);
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="glass" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--orange-400)', marginBottom: '1rem' }}>➕ Raise Issues / Support Tickets</h2>
      <form onSubmit={handleSubmit} className="space-y-sm">
        <div className="grid-2">
          <EmployeeSearchDropdown employees={employees} selected={emp} onSelect={selectEmployee} onClear={resetEmp} />
          <div>
            <label className="label">Source Week</label>
            <select className="g-input" value={sourceWeek} onChange={e => setSourceWeek(e.target.value)}>
              <option value="Week 1">Week 1</option><option value="Week 2">Week 2</option><option value="Week 3">Week 3</option><option value="Week 4">Week 4</option>
            </select>
          </div>
        </div>
        <EmployeeInfo data={emp} />

        <div className="flex-between">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Issues / Support Items</h3>
          <button type="button" className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.2)', color: 'var(--purple-400)' }} onClick={addRow}>+ Add Row</button>
        </div>

        {rows.map((row, idx) => (
          <div key={idx} className="issue-row" style={{ padding: '0.75rem' }}>
            <div className="grid-5" style={{ alignItems: 'end' }}>
              <div>
                <label className="label label-xs">#{idx + 1} Type</label>
                <select className="g-input" value={row.type} onChange={e => updateRow(idx, 'type', e.target.value)}>
                  <option value="Issue">🔴 Issue</option><option value="Support">🔵 Support</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="label label-xs">Description *</label>
                <input className="g-input" value={row.description} onChange={e => updateRow(idx, 'description', e.target.value)} required placeholder="No laptop, 60km commute..." />
              </div>
              <div>
                <label className="label label-xs">Flag Level</label>
                <select className="g-input" value={row.flagLevel} onChange={e => updateRow(idx, 'flagLevel', e.target.value)}>
                  <option value="Red" title={FLAG_TOOLTIPS.Red}>🔴 Red — Critical</option><option value="Orange" title={FLAG_TOOLTIPS.Orange}>🟠 Orange — At-Risk</option><option value="Yellow" title={FLAG_TOOLTIPS.Yellow}>🟡 Yellow — Monitoring</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label className="label label-xs">Action Owner</label>
                  <input className="g-input" value={row.actionOwner} onChange={e => updateRow(idx, 'actionOwner', e.target.value)} placeholder="IT, Admin..." />
                </div>
                {rows.length > 1 && <button type="button" style={{ fontSize: '0.75rem', color: 'var(--red-400)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 0.25rem' }} onClick={() => removeRow(idx)}>✕</button>}
              </div>
            </div>
          </div>
        ))}

        <button className="btn btn-danger" style={{ width: '100%' }} disabled={submitting}>{submitting ? 'Creating tickets...' : `🎫 Create ${rows.length} Ticket(s)`}</button>
      </form>
    </div>
  );
}
