import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowRight, Check, CheckCheck, CheckCircle2, ChevronDown,
  Clock3, Copy, FileText, GraduationCap, HeartHandshake, LifeBuoy, LoaderCircle,
  LockKeyhole, LogOut, MessageCircle, MessageSquare, Search,
  ShieldCheck, Sparkles, UserRound, UsersRound, X,
} from 'lucide-react';
import './styles.css';

const categories = ['Infraestrutura', 'Atendimento', 'Acadêmico', 'Financeiro', 'Outro'];
const date = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Não foi possível conectar à ouvidoria. Tente novamente.'); }
  if (!response.ok) {
    const error = new Error(typeof result.error === 'string' ? result.error : result.message || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function Brand({ footer = false }) {
  return <span className={`brand ${footer ? 'brand-footer' : ''}`}>
    <span className="brand-mark"><MessageSquare size={24} strokeWidth={1.8} /><i /></span>
    <span><strong>ouvidoria<span>.</span></strong><small>COMUNIDADE ACADÊMICA</small></span>
  </span>;
}

function Button({ children, busy, className = '', ...props }) {
  return <button className={`button ${className}`} disabled={busy || props.disabled} {...props}>
    {busy ? <LoaderCircle size={18} className="spin" /> : null}{children}
  </button>;
}

function ErrorNotice({ message }) {
  return message ? <div className="notice error" role="alert"><LifeBuoy size={19} /><span>{message}</span></div> : null;
}

function Status({ status }) {
  return <span className={`status ${status === 'resolved' ? 'resolved' : 'open'}`}>
    {status === 'resolved' ? <CheckCheck size={13} /> : <Clock3 size={13} />}
    {status === 'resolved' ? 'Resolvido' : 'Em aberto'}
  </span>;
}

function App() {
  const [view, setView] = useState(window.location.hash === '#admin' ? 'admin' : 'public');
  const [tab, setTab] = useState(window.location.hash === '#acompanhar' ? 'track' : 'new');
  const contentRef = useRef(null);

  const navigate = (destination, scroll = false) => {
    if (destination === 'admin') {
      setView('admin');
      window.history.replaceState(null, '', '#admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setView('public');
      setTab(destination === 'track' ? 'track' : 'new');
      window.history.replaceState(null, '', destination === 'track' ? '#acompanhar' : destination === 'home' ? '#' : '#registrar');
      if (scroll) requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return <>
    <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <div className="topline"><div className="container"><GraduationCap size={14} /><span>Um canal de diálogo para uma faculdade melhor.</span><span className="topline-right">Escuta com respeito. Cuidado com você.</span></div></div>
    <header className="header"><div className="container header-inner">
      <a href="#" onClick={event => { event.preventDefault(); navigate('home'); }} aria-label="Ouvidoria, início"><Brand /></a>
      <nav aria-label="Navegação principal">
        <button className={view === 'public' && tab === 'new' ? 'nav-active' : ''} onClick={() => navigate('new', true)}>Registrar manifestação</button>
        <button className={view === 'public' && tab === 'track' ? 'nav-active' : ''} onClick={() => navigate('track', true)}>Acompanhar protocolo</button>
      </nav>
      <button aria-label="Área administrativa" className={`admin-nav ${view === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}><LockKeyhole size={15} /><span>Área administrativa</span><ArrowRight size={14} /></button>
    </div></header>

    {view === 'public' ? <main id="conteudo">
      <section className="hero"><div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> SUA VOZ TEM ESPAÇO AQUI</span>
          <h1>Ouvir você.<br />Transformar <em>juntos.</em></h1>
          <p>Uma faculdade melhor começa com o diálogo. Compartilhe o que precisa mudar e ajude a construir a comunidade que queremos.</p>
          <div className="hero-actions"><Button onClick={() => navigate('new', true)}>Quero ser ouvido <ArrowRight size={18} /></Button><button className="text-button" onClick={() => navigate('track', true)}>Já tenho um protocolo <ArrowRight size={16} /></button></div>
          <div className="hero-assurance"><ShieldCheck size={17} /><span>Envio seguro</span><i /><span>Anônimo, se você preferir</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-grid" /><div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-spark"><Sparkles size={30} strokeWidth={1.4} /></div>
          <div className="art-label"><span className="live-dot" /> UM ESPAÇO DE ESCUTA</div>
          <div className="speech-card"><span className="quote-symbol">“</span><p>Todo diálogo<br />é um novo<br /><em>começo.</em></p><div className="speech-bottom"><span /><span /><span /></div></div>
          <div className="small-speech"><HeartHandshake size={27} strokeWidth={1.5} /><span>Você fala.<br /><strong>A gente acolhe.</strong></span></div>
          <div className="art-note"><span className="tiny-line" /> SUA PARTICIPAÇÃO FAZ A DIFERENÇA</div>
        </div>
      </div></section>

      <section className="principles" aria-label="Princípios da ouvidoria"><div className="container principles-grid">
        <div><span className="principle-icon"><ShieldCheck size={21} /></span><span><strong>Privacidade em primeiro lugar</strong><small>Você escolhe como se identificar.</small></span></div>
        <div><span className="principle-icon"><MessageCircle size={21} /></span><span><strong>Um canal para toda a comunidade</strong><small>Estudantes, docentes e colaboradores.</small></span></div>
        <div><span className="principle-icon"><FileText size={21} /></span><span><strong>Acompanhe cada passo</strong><small>Consulte seu chamado pelo protocolo.</small></span></div>
      </div></section>

      <section className="workspace container" ref={contentRef} aria-labelledby="workspace-title">
        <div className="section-heading"><div><span className="eyebrow">DIÁLOGO QUE GERA MUDANÇA</span><h2 id="workspace-title">Como podemos ajudar?</h2></div><span className="section-note">Sua experiência importa para nós.</span></div>
        <div className="public-layout">
          <div className="form-card">
            <div className="tabs" role="tablist" aria-label="Serviços da ouvidoria">
              <button id="new-tab" role="tab" aria-selected={tab === 'new'} aria-controls="new-panel" className={tab === 'new' ? 'selected' : ''} onClick={() => setTab('new')}><MessageSquare size={17} />Registrar manifestação</button>
              <button id="track-tab" role="tab" aria-selected={tab === 'track'} aria-controls="track-panel" className={tab === 'track' ? 'selected' : ''} onClick={() => setTab('track')}><Search size={17} />Acompanhar protocolo</button>
            </div>
            {tab === 'new' ? <div role="tabpanel" id="new-panel" aria-labelledby="new-tab"><ComplaintForm onTrack={() => setTab('track')} /></div> : <div role="tabpanel" id="track-panel" aria-labelledby="track-tab"><TrackForm /></div>}
          </div>
          <aside className="public-sidebar">
            <div className="privacy-card"><span className="sidebar-icon"><ShieldCheck size={24} strokeWidth={1.6} /></span><h3>Sua identidade,<br />sua escolha.</h3><p>Você pode se manifestar sem informar seu nome ou e-mail. O importante é que sua voz chegue até nós.</p><div className="privacy-divider" /><span className="privacy-small"><LockKeyhole size={15} /> Acesso restrito à equipe da ouvidoria</span></div>
            <div className="steps-card"><h3>O que acontece depois?</h3><ol><li><span>01</span><div><strong>Você registra</strong><p>Conte o que aconteceu com os detalhes que considerar importantes.</p></div></li><li><span>02</span><div><strong>A ouvidoria acompanha</strong><p>A equipe recebe sua manifestação e avalia o encaminhamento.</p></div></li><li><span>03</span><div><strong>Você consulta a resposta</strong><p>Use seu protocolo e sua chave de acesso para acompanhar a solução.</p></div></li></ol></div>
          </aside>
        </div>
      </section>
      <section className="closing-note container"><span><UsersRound size={23} strokeWidth={1.6} /></span><p><strong>Um ambiente melhor se constrói com participação.</strong><br />Cada manifestação é uma oportunidade de aprender, cuidar e evoluir.</p><span className="closing-dots" aria-hidden="true">· · ·</span></section>
    </main> : <main id="conteudo" className="admin-main container"><AdminArea /></main>}

    <footer className="footer"><div className="container footer-inner"><Brand footer /><p>Escuta, acolhimento e compromisso<br />com a nossa comunidade acadêmica.</p><span>Feito para aproximar pessoas.</span></div><div className="container footer-bottom"><span>Ouvidoria institucional</span><span>Respeito em cada conversa.</span></div></footer>
  </>;
}

function ComplaintForm({ onTrack }) {
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState(0);

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const result = await api('/complaints', { method: 'POST', body: { ...values, anonymous, ...anonymous ? { name: undefined, email: undefined } : {} } });
      setReceipt(result);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  const receiptText = receipt ? `Ouvidoria institucional\nProtocolo: ${receipt.protocol}\nChave de acesso: ${receipt.accessKey}\nRegistro: ${date(receipt.createdAt)}\nGuarde estes dados para acompanhar sua manifestação.` : '';

  if (receipt) return <div className="receipt form-body" role="status"><span className="success-icon"><Check size={30} /></span><span className="eyebrow">SUA VOZ CHEGOU ATÉ NÓS</span><h3>Manifestação registrada!</h3><p>Guarde o protocolo e a chave de acesso abaixo. Você precisará dos dois para consultar o andamento e a resposta.</p><div className="receipt-data"><span>PROTOCOLO</span><strong>{receipt.protocol}</strong><span>CHAVE DE ACESSO</span><strong className="access-key">{receipt.accessKey}</strong><small>Registrado em {date(receipt.createdAt)}</small></div><div className="notice"><LockKeyhole size={18} /><span>A chave é pessoal e não pode ser recuperada. Guarde-a em um lugar seguro, mesmo se você informou seu nome e e-mail.</span></div><div className="receipt-actions"><Button className="button-outline" onClick={async () => {
    try { await navigator.clipboard.writeText(receiptText); setCopied(true); } catch { setError('A cópia não está disponível neste navegador. Use a opção de baixar comprovante.'); }
  }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Dados copiados' : 'Copiar dados'}</Button><Button className="button-outline" onClick={() => {
    const url = URL.createObjectURL(new Blob([receiptText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${receipt.protocol}.txt`; link.click(); URL.revokeObjectURL(url);
  }}><ArrowDown size={17} />Baixar comprovante</Button></div><ErrorNotice message={error} /><button className="text-button" onClick={onTrack}>Acompanhar manifestação <ArrowRight size={16} /></button><button className="new-record" onClick={() => { setReceipt(null); setDescriptionLength(0); setCopied(false); }}>Registrar outra manifestação</button></div>;

  return <form className="form-body" onSubmit={submit}>
    <div className="form-intro"><h3>Estamos aqui para ouvir.</h3><p>Conte sua experiência. Os campos com <span aria-label="obrigatório">*</span> são obrigatórios.</p></div>
    <fieldset className="identity-fieldset"><legend>Como deseja se manifestar?</legend><div className="identity-options"><label className={`identity-option ${anonymous ? 'chosen' : ''}`}><input type="radio" name="identity" checked={anonymous} onChange={() => setAnonymous(true)} /><span className="identity-icon"><ShieldCheck size={20} /></span><span><strong>De forma anônima</strong><small>Sem informar meus dados</small></span><span className="radio-indicator">{anonymous && <Check size={11} />}</span></label><label className={`identity-option ${!anonymous ? 'chosen' : ''}`}><input type="radio" name="identity" checked={!anonymous} onChange={() => setAnonymous(false)} /><span className="identity-icon"><UserRound size={20} /></span><span><strong>Quero me identificar</strong><small>Com nome e e-mail</small></span><span className="radio-indicator">{!anonymous && <Check size={11} />}</span></label></div></fieldset>
    {!anonymous && <div className="field-row"><label className="field">Nome completo <span>*</span><input name="name" autoComplete="name" placeholder="Como podemos chamar você?" minLength={2} maxLength={120} required /></label><label className="field">E-mail <span>*</span><input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" maxLength={254} required /></label></div>}
    <div className="anonymous-hint"><LockKeyhole size={14} /><span>{anonymous ? 'Nome e e-mail não são solicitados no envio anônimo.' : 'Seus dados ficam disponíveis apenas para a equipe da ouvidoria.'}</span></div>
    <label className="field">Sobre o que você quer falar? <span>*</span><div className="select-wrap"><select name="category" required defaultValue=""><option value="" disabled>Selecione uma categoria</option>{categories.map(category => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></div></label>
    <label className="field">Assunto <span>*</span><input name="subject" placeholder="Resuma o motivo da sua manifestação" minLength={5} maxLength={120} required /></label>
    <label className="field">Descreva sua manifestação <span>*</span><textarea name="description" placeholder="Conte o que aconteceu, onde e quando. Quanto mais detalhes, melhor poderemos ajudar." minLength={20} maxLength={5000} rows={5} required onChange={event => setDescriptionLength(event.target.value.length)} /><span className="field-help"><span>Inclua pelo menos 20 caracteres. Evite dados pessoais de terceiros.</span><span>{descriptionLength}/5.000</span></span></label>
    <ErrorNotice message={error} />
    <div className="form-submit"><p><ShieldCheck size={15} /><span>Seu relato será tratado com respeito<br className="desktop-break" /> e responsabilidade.</span></p><Button type="submit" busy={busy}>{busy ? 'Registrando...' : 'Enviar manifestação'}{!busy && <ArrowRight size={17} />}</Button></div>
  </form>;
}

function TrackForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true); setRecord(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { setRecord(await api(`/complaints/${encodeURIComponent(values.protocol.trim().toUpperCase())}?key=${encodeURIComponent(values.key.trim())}`)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="form-body"><div className="form-intro"><span className="track-icon"><Search size={24} /></span><h3>Acompanhe sua manifestação.</h3><p>Informe os dados do comprovante recebido no momento do registro.</p></div><form onSubmit={submit}><label className="field">Número do protocolo <span>*</span><input name="protocol" placeholder="OUV-2026-XXXXXXXXXXXX" autoComplete="off" required maxLength={40} /></label><label className="field">Chave de acesso <span>*</span><input name="key" placeholder="Chave recebida ao registrar" type="password" autoComplete="off" required maxLength={100} /></label><div className="notice"><LockKeyhole size={18} /><span>A chave protege sua privacidade. Apenas o protocolo não permite acessar o conteúdo da manifestação.</span></div><ErrorNotice message={error} /><Button type="submit" busy={busy} className="track-submit">{busy ? 'Consultando...' : 'Consultar manifestação'}{!busy && <Search size={17} />}</Button></form>{record && <article className="tracked-record"><div className="record-top"><span className="eyebrow">{record.protocol}</span><Status status={record.status} /></div><h3>{record.subject}</h3><div className="record-meta"><span>{record.category}</span><span>Registrado em {date(record.createdAt)}</span></div><p className="record-description">{record.description}</p><div className="record-response"><h4>{record.status === 'resolved' ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}{record.status === 'resolved' ? 'Resposta da ouvidoria' : 'Sua manifestação está em aberto'}</h4><p>{record.status === 'resolved' ? record.resolution : 'A equipe da ouvidoria recebeu seu relato. Consulte este espaço para acompanhar o andamento e a resposta.'}</p>{record.resolvedAt && <small>Resolvido em {date(record.resolvedAt)}</small>}</div></article>}</div>;
}

function AdminArea() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; api('/admin/session').then(result => { if (live) setAdmin(result.admin); }).catch(failure => { if (live && failure.status !== 401) setError(failure.message); }).finally(() => { if (live) setChecking(false); }); return () => { live = false; }; }, []);
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    try { const result = await api('/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) }); form.reset(); setAdmin(result.admin); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setError(''); setBusy(true);
    try { await api('/admin/logout', { method: 'POST' }); setAdmin(null); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  if (checking) return <div className="loading-screen" role="status"><LoaderCircle className="spin" size={24} />Verificando acesso...</div>;
  if (!admin) return <div className="login-layout"><div className="login-copy"><span className="eyebrow">CUIDADO QUE SE TRANSFORMA EM AÇÃO</span><h1>Do outro lado<br />da escuta,<br /><em>está você.</em></h1><p>Acesse o painel para acompanhar as manifestações da comunidade e dar continuidade a cada conversa.</p><div className="login-quote"><HeartHandshake size={25} /><span>Uma resposta atenciosa também<br />faz parte da transformação.</span></div></div><form className="login-card" onSubmit={login}><span className="login-lock"><LockKeyhole size={25} /></span><h2>Área administrativa</h2><p>Acesso exclusivo à equipe da ouvidoria.</p><label className="field">E-mail <span>*</span><input name="email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={event => setEmail(event.target.value)} required /></label><label className="field">Senha <span>*</span><input name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required /></label><ErrorNotice message={error} /><Button type="submit" busy={busy}>{busy ? 'Entrando...' : 'Entrar no painel'}{!busy && <ArrowRight size={17} />}</Button><div className="login-note"><ShieldCheck size={15} /> Ambiente de acesso restrito</div></form></div>;
  return <><ErrorNotice message={error} /><Dashboard admin={admin} logout={logout} loggingOut={busy} onExpired={() => { setAdmin(null); setError('Sua sessão expirou. Entre novamente para continuar.'); }} /></>;
}

function DetailDialog({ children, busy, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="modal-shell" aria-labelledby="detail-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    {children}
  </dialog>;
}

function Dashboard({ admin, logout, loggingOut, onExpired }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const result = await api('/admin/complaints'); setRecords(result.complaints); }
    catch (failure) { if (failure.status === 401) onExpired(); else setError(failure.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function select(record) { setSelected(record); setResolution(record.resolution || ''); setError(''); setSaved(''); }
  async function update(event, status = 'resolved') {
    event?.preventDefault(); setSaving(true); setError(''); setSaved('');
    try {
      const result = await api(`/admin/complaints/${selected.id}`, { method: 'PATCH', body: { status, resolution: status === 'resolved' ? resolution : '' } });
      setRecords(previous => previous.map(item => item.id === selected.id ? result.complaint : item));
      setSelected(result.complaint); setResolution(result.complaint.resolution || '');
      setSaved(status === 'resolved' ? 'Manifestação resolvida. A resposta já está disponível na consulta por protocolo.' : 'Manifestação reaberta.');
    } catch (failure) { if (failure.status === 401) onExpired(); else setError(failure.message); }
    finally { setSaving(false); }
  }
  const filtered = records.filter(record => (filter === 'all' || record.status === filter) && `${record.protocol} ${record.subject} ${record.category}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <div className="dashboard"><div className="dashboard-heading"><div><span className="eyebrow">PAINEL DA OUVIDORIA</span><h1>Escutar. Acompanhar. Resolver.</h1><p>Um olhar atento para cada manifestação.</p></div><div className="admin-account"><span><UserRound size={16} />{admin.email}</span><button onClick={logout} disabled={loggingOut}><LogOut size={15} />Sair</button></div></div><div className="stats-grid"><div><span><FileText size={20} />Total de manifestações</span><strong>{records.length}</strong><small>Todos os registros recebidos</small></div><div><span><Clock3 size={20} />Em aberto</span><strong>{records.filter(record => record.status === 'open').length}</strong><small>Aguardando uma solução</small></div><div><span><CheckCheck size={20} />Resolvidas</span><strong>{records.filter(record => record.status === 'resolved').length}</strong><small>Conversas que viraram ação</small></div></div><div className="dashboard-panel"><div className="dashboard-toolbar"><div><h2>Manifestações</h2><p>Acompanhe e gerencie os chamados.</p></div><Button className="button-outline small-button" onClick={load} busy={loading}>Atualizar lista</Button></div><div className="list-controls"><div className="filter-tabs" aria-label="Filtrar por situação">{[['all', 'Todas'], ['open', 'Em aberto'], ['resolved', 'Resolvidas']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>)}</div><label className="search-field"><Search size={17} /><input aria-label="Buscar manifestação por protocolo, assunto ou categoria" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar protocolo ou assunto" /></label></div><ErrorNotice message={!selected ? error : ''} />{loading ? <div className="empty-state" role="status"><LoaderCircle className="spin" size={24} /><h3>Carregando manifestações...</h3></div> : filtered.length ? <div className="records-table"><div className="table-head"><span>PROTOCOLO / ASSUNTO</span><span>CATEGORIA</span><span>RECEBIDO EM</span><span>SITUAÇÃO</span><span /></div>{filtered.map(record => <button className="table-row" key={record.id} onClick={() => select(record)}><span className="table-subject"><small>{record.protocol}</small><strong>{record.subject}</strong><span>{record.anonymous ? <><ShieldCheck size={12} /> Anônimo</> : <><UserRound size={12} /> Identificado</>}</span></span><span className="table-category">{record.category}</span><span className="table-date">{date(record.createdAt)}</span><Status status={record.status} /><ArrowRight size={17} className="row-arrow" /></button>)}</div> : <div className="empty-state"><span><MessageSquare size={30} /></span><h3>{records.length ? 'Nenhuma manifestação encontrada.' : 'Tudo começa com uma conversa.'}</h3><p>{records.length ? 'Tente outro termo ou selecione outro filtro.' : 'As manifestações recebidas aparecerão aqui para acompanhamento.'}</p></div>}<div className="list-footer">{loading ? 'Consultando registros...' : `${filtered.length} ${filtered.length === 1 ? 'manifestação' : 'manifestações'} nesta visualização`}<span><LockKeyhole size={12} /> Acesso restrito</span></div></div>{selected && <DetailDialog busy={saving} onClose={() => setSelected(null)}><div className="detail-modal"><button className="modal-close" aria-label="Fechar detalhes" onClick={() => setSelected(null)} disabled={saving}><X size={21} /></button><div className="record-top"><span className="eyebrow">{selected.protocol}</span><Status status={selected.status} /></div><h2 id="detail-title">{selected.subject}</h2><div className="record-meta"><span>{selected.category}</span><span>{date(selected.createdAt)}</span></div><div className="identity-summary">{selected.anonymous ? <><ShieldCheck size={19} /><div><strong>Manifestação anônima</strong><span>Nenhum dado de identificação foi solicitado.</span></div></> : <><UserRound size={19} /><div><strong>{selected.name}</strong><span>{selected.email}</span></div></>}</div><h3 className="detail-label">RELATO DA MANIFESTAÇÃO</h3><p className="detail-description">{selected.description}</p><ErrorNotice message={error} />{saved && <div className="notice success" role="status"><CheckCircle2 size={18} /><span>{saved}</span></div>}{selected.status === 'open' ? <form className="resolution-form" onSubmit={update}><label className="field">Resposta e solução <span>*</span><textarea value={resolution} onChange={event => setResolution(event.target.value)} rows={4} minLength={10} maxLength={3000} placeholder="Descreva o encaminhamento e como a manifestação foi solucionada." required /><small className="field-help">Esta resposta será exibida para quem consultar o protocolo.</small></label><Button type="submit" busy={saving}>{saving ? 'Salvando...' : 'Marcar como resolvida'}{!saving && <CheckCheck size={17} />}</Button></form> : <div className="resolved-section"><div className="record-response"><h4><CheckCircle2 size={18} />Solução registrada</h4><p>{selected.resolution}</p>{selected.resolvedAt && <small>Resolvido em {date(selected.resolvedAt)}</small>}</div><Button className="button-outline" onClick={() => update(null, 'open')} busy={saving}>Reabrir manifestação</Button></div>}</div></DetailDialog>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
