'use client';
import { useEffect, useState, useCallback } from 'react';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const b64 = s => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...r].map(c => c.charCodeAt(0)));
};

export default function Home() {
  const [pin, setPin] = useState(null);
  const [pinIn, setPinIn] = useState('');
  const [tab, setTab] = useState('p');
  const [days, setDays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [guides, setGuides] = useState(null);
  const [arch, setArch] = useState(false);
  const [search, setSearch] = useState('');
  const [nn, setNn] = useState('');
  const [np, setNp] = useState('');
  const [push, setPush] = useState('off');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  const api = useCallback(async (url, opt = {}) => {
    const r = await fetch(url, {
      ...opt,
      headers: {
        'content-type': 'application/json',
        'x-pin': pin || '',
        ...(opt.headers || {})
      }
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      localStorage.removeItem('pin');
      setPin('');
      throw new Error(j.error || 'الرقم السري غلط');
    }
    if (!r.ok) throw new Error(j.error || 'حصل خطأ');
    return j;
  }, [pin]);

  useEffect(() => {
    setPin(localStorage.getItem('pin') || '');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPush('unsupported');
    } else if (Notification.permission === 'granted') {
      setPush('on');
    }

    const onBIP = e => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    window.onafterprint = () => {
      document.body.classList.remove('one');
      document.querySelectorAll('.printing').forEach(el => el.classList.remove('printing'));
    };

    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setDays((await api('/api/permits')).days);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (!pin) return;
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (q && q.get('start')) start();
  }, [pin, start]);

  const loadGuides = useCallback(async () => {
    try {
      setGuides((await api('/api/guides')).guides);
    } catch (e) {
      setErr(e.message);
    }
  }, [api]);

  useEffect(() => {
    if (tab === 'g' && pin && !guides) loadGuides();
  }, [tab, pin, guides, loadGuides]);

  const gpost = async body => {
    try {
      setGuides((await api('/api/guides', { method: 'POST', body: JSON.stringify(body) })).guides);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  };

  async function enablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== 'granted') return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64(VAPID)
      });
      await api('/api/push', { method: 'POST', body: JSON.stringify(sub) });
      setPush('on');
    } catch (e) {
      setErr('تفعيل الإشعارات فشل: ' + e.message);
    }
  }

  async function doInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setInstallPrompt(null);
  }

  function logout() {
    localStorage.removeItem('pin');
    setPin('');
    setDays(null);
    setGuides(null);
    setErr('');
  }

  const printDay = i => {
    document.body.classList.add('one');
    document.getElementById('d' + i)?.classList.add('printing');
    window.print();
  };
  const printAll = () => {
    document.body.classList.remove('one');
    window.print();
  };

  if (pin === null) return null;

  if (!pin) {
    return (
      <main>
        <div className="pin">
          <h1 className="pin-title">تصاريح الغردقة</h1>
          <input
            type="password"
            inputMode="numeric"
            placeholder="الرقم السري"
            value={pinIn}
            onChange={e => setPinIn(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && pinIn) {
                localStorage.setItem('pin', pinIn);
                setPin(pinIn);
                setErr('');
              }
            }}
            autoFocus
          />
          <button
            className="btn pri"
            onClick={() => {
              if (!pinIn) return;
              localStorage.setItem('pin', pinIn);
              setPin(pinIn);
              setErr('');
            }}
          >
            دخول
          </button>
          {err && <p className="msg err">{err}</p>}
        </div>
      </main>
    );
  }

  const list = (guides || []).filter(
    g => g.archived === arch && g.name.toLowerCase().includes(search.toLowerCase())
  );
  const isIOS =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <>
      <header>
        <div className="top">
          <h1>تصاريح الغردقة</h1>
          <div className="top-actions">
            {push !== 'unsupported' && VAPID && (
              <button
                className={'bell' + (push === 'on' ? ' on' : '')}
                onClick={push === 'on' ? undefined : enablePush}
              >
                {push === 'on' ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}
              </button>
            )}
            <button className="bell logout" onClick={logout} title="خروج">
              خروج
            </button>
          </div>
        </div>
        <nav>
          <button className={tab === 'p' ? 'on' : ''} onClick={() => setTab('p')}>
            التصاريح
          </button>
          <button className={tab === 'g' ? 'on' : ''} onClick={() => setTab('g')}>
            المرشدين
          </button>
        </nav>
      </header>

      <main>
        {err && <p className="msg err">{err}</p>}

        {showInstall && (
          <div className="install-banner">
            <span>ثبّت التطبيق على الشاشة الرئيسية لسهولة الوصول</span>
            <div>
              <button className="btn pri" onClick={doInstall}>تثبيت</button>
              <button className="btn" onClick={() => setShowInstall(false)}>لاحقاً</button>
            </div>
          </div>
        )}

        {push === 'unsupported' && isIOS && (
          <p className="msg">
            للإشعارات على الآيفون: Share ← Add to Home Screen وافتح التطبيق من الأيقونة.
          </p>
        )}

        {tab === 'p' && (
          <section>
            {!days && (
              <button className="start" disabled={loading} onClick={start}>
                {loading ? 'جاري التحميل…' : 'ابدأ'}
              </button>
            )}
            {days && (
              <>
                <div className="bar">
                  <button className="btn pri" onClick={printAll}>
                    طباعة الـ 7 أيام
                  </button>
                  <button className="btn" onClick={start} disabled={loading}>
                    {loading ? 'جاري التحديث…' : 'تحديث'}
                  </button>
                </div>
                {days.map((d, i) => (
                  <div className="day" id={'d' + i} key={d.tab}>
                    <div className="ptitle">تصاريح {d.label}</div>
                    <div className="dh">
                      <h2>
                        {d.label} <small>({d.rows.length})</small>
                      </h2>
                      <button className="btn" onClick={() => printDay(i)}>
                        طباعة
                      </button>
                    </div>
                    {!d.found ? (
                      <p className="empty">تاب {d.tab} مش موجود في الشيت</p>
                    ) : !d.rows.length ? (
                      <p className="empty">لا توجد تشغيلات</p>
                    ) : (
                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>م</th>
                              <th>رقم الملف</th>
                              <th>العدد</th>
                              <th>الاتجاه</th>
                              <th>الفنادق</th>
                              <th>المرشد</th>
                              <th>تليفون المرشد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.rows.map((r, k) => (
                              <tr key={k}>
                                <td>{k + 1}</td>
                                <td>{r.file}</td>
                                <td>{r.pax}</td>
                                <td>
                                  <span className={'dir ' + r.dir}>{r.dirLabel}</span>
                                </td>
                                <td>{r.hotel}</td>
                                <td>{r.guide}</td>
                                <td className="ph">{r.phone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {tab === 'g' && (
          <section className="guides">
            <div className="bar">
              <button className="btn" onClick={() => setArch(!arch)}>
                {arch ? 'عرض النشطين' : 'عرض الأرشيف'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setGuides(null);
                  gpost({ action: 'import' });
                }}
              >
                سحب المرشدين من الشيت
              </button>
            </div>
            <div className="add">
              <input
                placeholder="اسم المرشد"
                value={nn}
                onChange={e => setNn(e.target.value)}
              />
              <input
                className="p"
                placeholder="التليفون"
                inputMode="tel"
                value={np}
                onChange={e => setNp(e.target.value)}
              />
              <button
                className="btn pri"
                onClick={async () => {
                  if (!nn.trim()) return;
                  await gpost({ action: 'save', oldName: '', name: nn, phone: np });
                  setNn('');
                  setNp('');
                }}
              >
                إضافة
              </button>
            </div>
            <input
              className="search"
              placeholder="بحث"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {!guides ? (
              <p className="msg">جاري التحميل…</p>
            ) : !list.length ? (
              <p className="msg">
                {arch
                  ? 'الأرشيف فاضي'
                  : 'مفيش مرشدين. اضغط "سحب المرشدين من الشيت".'}
              </p>
            ) : (
              list.map(g => (
                <div className="g" key={g.name + '|' + g.phone}>
                  <input
                    defaultValue={g.name}
                    onBlur={e =>
                      e.target.value !== g.name &&
                      gpost({
                        action: 'save',
                        oldName: g.name,
                        name: e.target.value,
                        phone: g.phone
                      })
                    }
                  />
                  <input
                    className="p"
                    defaultValue={g.phone}
                    inputMode="tel"
                    onBlur={e =>
                      e.target.value !== g.phone &&
                      gpost({
                        action: 'save',
                        oldName: g.name,
                        name: g.name,
                        phone: e.target.value
                      })
                    }
                  />
                  <button
                    className="btn"
                    onClick={() =>
                      gpost({ action: 'archive', name: g.name, flag: !arch })
                    }
                  >
                    {arch ? 'استرجاع' : 'أرشفة'}
                  </button>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </>
  );
}
