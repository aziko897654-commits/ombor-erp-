import { zodResolver } from '@hookform/resolvers/zod';
import {
  Boxes,
  Building2,
  ChevronDown,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

const loginSchema = z.object({
  phone: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length >= 9, t('auth.invalidPhone')),
  password: z.string().min(1, t('auth.passwordRequired')),
});

type LoginForm = z.infer<typeof loginSchema>;

const featureIcons = [TrendingUp, Boxes, Wallet, Users, ShieldCheck];
const features = [1, 2, 3, 4, 5].map((i) => t(`login.feature${i}`));
const facts = [1, 2, 3, 4, 5].map((i) => t(`login.fact${i}`));
const stats = [
  { value: 24, suffix: '+', label: t('login.statModules') },
  { value: 5, suffix: '', label: t('login.statRoles') },
  { value: 100, suffix: '%', label: t('login.statSecure') },
];

const demoAccounts = [
  { role: t('login.roleDirector'), phone: '+998901234567', password: 'narco123' },
  { role: t('login.roleAccountant'), phone: '+998901112233', password: 'Demo1234!' },
  { role: t('login.roleWarehouse'), phone: '+998902223344', password: 'Demo1234!' },
  { role: t('login.roleSales'), phone: '+998903334455', password: 'Demo1234!' },
  { role: t('login.roleHr'), phone: '+998904445566', password: 'Demo1234!' },
];

/** Count-up animation for a number, runs once on mount. */
function AnimatedNumber({
  value,
  suffix = '',
  duration = 1400,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return (
    <span>
      {n}
      {suffix}
    </span>
  );
}

/** Rotating "did you know" line that fades between facts. */
function RotatingFact() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % facts.length), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-300">
        <Sparkles className="h-3.5 w-3.5" />
        {t('login.factLabel')}
      </div>
      <p key={idx} className="animate-fade-up text-sm text-slate-200">
        {facts[idx]}
      </p>
    </div>
  );
}

/** Types out text character-by-character (with a blinking caret). */
function useTypewriter(text: string, speed = 55, startDelay = 350) {
  const [out, setOut] = useState('');
  useEffect(() => {
    setOut('');
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);
  return out;
}

/** Floating background particles that drift upward. */
function Particles() {
  const items = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: -Math.random() * 16,
        duration: 10 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.5,
      })),
    [],
  );
  return (
    <>
      {items.map((p, i) => (
        <span
          key={i}
          className="erp-particle absolute rounded-full bg-white"
          style={{
            left: `${p.left}%`,
            bottom: '-6px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const heroTitle = t('login.heroTitle');
  const typedTitle = useTypewriter(heroTitle);
  const bgRef = useRef<HTMLDivElement>(null);

  if (user) return <Navigate to="/" replace />;

  const doLogin = async (phone: string, password: string) => {
    setServerError(null);
    try {
      await login(phone, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      if (status === 401 && typeof message === 'string') {
        setServerError(message); // haqiqiy "parol noto'g'ri"
      } else if (!err?.response) {
        // javob yo'q: tarmoq / timeout / server uxlagan (cold start)
        setServerError(t('auth.serverWaking'));
      } else {
        setServerError(
          typeof message === 'string' ? message : t('auth.loginFailed'),
        );
      }
    }
  };

  const onSubmit = (values: LoginForm) => doLogin(values.phone, values.password);

  const quickLogin = async (acc: (typeof demoAccounts)[number]) => {
    setValue('phone', acc.phone);
    setValue('password', acc.password);
    setPending(true);
    await doLogin(acc.phone, acc.password);
    setPending(false);
  };

  const busy = isSubmitting || pending;
  const iconField =
    'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground';
  const inputFx =
    'pl-9 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500/40';

  const handleParallax = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    if (bgRef.current) {
      bgRef.current.style.transform = `translate3d(${x * 26}px, ${y * 26}px, 0)`;
    }
  };

  return (
    <div
      onMouseMove={handleParallax}
      className="animate-gradient relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950"
    >
      {/* Dekorativ animatsiyali fon */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Sichqonchaga ergashuvchi bloblar (parallax) */}
        <div ref={bgRef} className="erp-parallax absolute inset-0">
          <div className="animate-blob absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="animate-blob absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl [animation-delay:3s]" />
          <div className="animate-float absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl" />
        </div>
        {/* Panjara naqsh */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        {/* Suzuvchi zarrachalar */}
        <Particles />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Chap: jonli taqdimot paneli */}
        <div className="hidden flex-col justify-center gap-8 px-12 py-16 text-white lg:flex lg:w-1/2">
          <div className="animate-fade-up flex items-center gap-3">
            <div className="animate-shine relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20">
              <Building2 className="h-6 w-6" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              {t('login.brand')}
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="min-h-[5.5rem] text-4xl font-bold leading-tight">
              {typedTitle}
              {typedTitle.length < heroTitle.length && (
                <span className="animate-blink ml-0.5 font-normal text-indigo-400">
                  |
                </span>
              )}
            </h1>
            <p className="animate-fade-up max-w-md text-slate-300 [animation-delay:0.2s]">
              {t('login.heroSubtitle')}
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f, i) => {
              const Icon = featureIcons[i];
              return (
                <li
                  key={f}
                  className="animate-fade-up flex items-center gap-3 text-slate-200"
                  style={{ animationDelay: `${0.3 + i * 0.1}s` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  {f}
                </li>
              );
            })}
          </ul>

          <div className="animate-fade-up grid grid-cols-3 gap-4 [animation-delay:0.8s]">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur"
              >
                <div className="text-2xl font-bold text-white">
                  <AnimatedNumber value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="animate-fade-up [animation-delay:0.9s]">
            <RotatingFact />
          </div>
        </div>

        {/* O'ng: login kartasi */}
        <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
          <div className="animate-fade-up relative w-full max-w-sm">
            {/* Mobil brend */}
            <div className="mb-6 flex items-center justify-center gap-2 text-white lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="text-base font-semibold">{t('login.brand')}</span>
            </div>

            {/* Nurli chegara */}
            <div
              aria-hidden
              className="animate-float absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-sky-500/40 opacity-60 blur-lg"
            />

            <Card className="force-light relative z-10 border-white/10 bg-white/95 text-card-foreground shadow-2xl backdrop-blur">
              <CardHeader className="items-center text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                  <Building2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{t('auth.loginTitle')}</CardTitle>
                <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4"
                  noValidate
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">{t('auth.phone')}</Label>
                    <div className="relative">
                      <Phone className={`${iconField} h-4 w-4`} />
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder={t('auth.phonePlaceholder')}
                        autoComplete="tel"
                        className={inputFx}
                        {...register('phone')}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-destructive">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className={`${iconField} z-10 h-4 w-4`} />
                      <PasswordInput
                        id="password"
                        autoComplete="current-password"
                        className={inputFx}
                        {...register('password')}
                      />
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                  {serverError && (
                    <p className="text-sm text-destructive">{serverError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
                    disabled={busy}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? t('auth.loggingIn') : t('auth.loginButton')}
                  </Button>
                </form>

                {/* Demo bilan tez kirish — faqat dev rejimida.
                    Production build'da bu blok (va demoAccounts'dagi parollar)
                    tree-shake bo'ladi, shunda hisob ma'lumotlari bundle'ga tushmaydi. */}
                {import.meta.env.DEV && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowDemo((v) => !v)}
                      className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('login.demoToggle')}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showDemo ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {showDemo && (
                      <div className="animate-fade-up mt-3">
                        <p className="mb-2 text-center text-[11px] text-muted-foreground">
                          {t('login.demoHint')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {demoAccounts.map((acc) => (
                            <button
                              key={acc.phone}
                              type="button"
                              disabled={busy}
                              onClick={() => quickLogin(acc)}
                              className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                            >
                              {acc.role}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  {t('login.footer')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
