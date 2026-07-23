'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type LangCode = 'en' | 'si' | 'ta' | 'ar' | 'es';

type Language = {
  code: LangCode;
  label: string;
  dir: 'ltr' | 'rtl';
};

const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'si', label: 'සිංහල', dir: 'ltr' },
  { code: 'ta', label: 'தமிழ்', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Español', dir: 'ltr' },
];

// Currency follows the language, not the business.
const PRICES: Record<'cake' | 'food' | 'slip', Record<LangCode, string>> = {
  cake: { en: 'LKR 6,500', si: 'රු. 6,500', ta: 'ரூ. 6,500', ar: 'AED 80', es: '$22' },
  food: { en: 'LKR 1,850', si: 'රු. 1,850', ta: 'ரூ. 1,850', ar: 'AED 23', es: '$6' },
  slip: { en: 'LKR 8,900', si: 'රු. 8,900', ta: 'ரூ. 8,900', ar: 'AED 110', es: '$30' },
};

const localize = (text: string, lang: LangCode) =>
  text
    .replaceAll('{cake}', PRICES.cake[lang])
    .replaceAll('{food}', PRICES.food[lang])
    .replaceAll('{slip}', PRICES.slip[lang]);

type StepType = 'c' | 'ai' | 'voice' | 'photo' | 'card' | 'handoff' | 'result';

type ResultView = 'calendar' | 'orderbook';

type Step = {
  t: StepType;
  text?: string;
  view?: ResultView;
};

type Scenario = {
  business: string;
  avatarLetter: string;
  avatarColor: string;
  chip: string;
  steps: Record<LangCode, Step[]>;
};

const HANDOFF_TEXT =
  '🤖→👤 Complex question? It hands off to your team with a full summary.';

const SCENARIOS: Scenario[] = [
  {
    business: 'City Clinic',
    avatarLetter: 'C',
    avatarColor: 'bg-indigo-500',
    chip: 'Booking',
    steps: {
      en: [
        { t: 'c', text: 'Hi! Do you have any slots available this Friday?' },
        {
          t: 'ai',
          text: 'Yes! Dr. Perera has slots at 6:45pm and 7:30pm Friday. Which works for you?',
        },
        { t: 'c', text: '7:30 please' },
        {
          t: 'ai',
          text: "Booked ✅ Friday 7:30pm with Dr. Perera. I'll remind you a day before!",
        },
        { t: 'handoff' },
        { t: 'result', view: 'calendar' },
      ],
      si: [
        { t: 'c', text: 'Hi! Friday වලට appointment එකක් ගන්න පුළුවන්ද?' },
        {
          t: 'ai',
          text: 'පුළුවන්! Dr. Perera Friday 6:45pm සහ 7:30pm වලට available. කොච්චර වෙලාවට ඕනද?',
        },
        { t: 'c', text: '7:30ට ඕන' },
        {
          t: 'ai',
          text: 'Booked ✅ Friday 7:30pm Dr. Perera එක්ක. දවසකට කලින් reminder එකක් එවන්නම්!',
        },
        { t: 'handoff' },
        { t: 'result', view: 'calendar' },
      ],
      ta: [
        { t: 'c', text: 'Hi! வெள்ளிக்கு appointment கிடைக்குமா?' },
        {
          t: 'ai',
          text: 'கிடைக்கும்! Dr. Perera வெள்ளி 6:45pm மற்றும் 7:30pm-க்கு available. எது சரியாகும்?',
        },
        { t: 'c', text: '7:30 சரி' },
        {
          t: 'ai',
          text: 'Booked ✅ வெள்ளி 7:30pm Dr. Perera. ஒரு நாள் முன் reminder அனுப்புவேன்!',
        },
        { t: 'handoff' },
        { t: 'result', view: 'calendar' },
      ],
      ar: [
        { t: 'c', text: 'مرحباً! هل يوجد موعد متاح يوم الجمعة؟' },
        {
          t: 'ai',
          text: 'نعم! الدكتور بيريرا متاح الجمعة 6:45 و 7:30 مساءً. أيهما يناسبك؟',
        },
        { t: 'c', text: '7:30 من فضلك' },
        {
          t: 'ai',
          text: 'تم الحجز ✅ الجمعة 7:30 مساءً مع الدكتور بيريرا. سأذكّرك قبلها بيوم!',
        },
        { t: 'handoff' },
        { t: 'result', view: 'calendar' },
      ],
      es: [
        { t: 'c', text: '¡Hola! ¿Hay citas disponibles el viernes?' },
        {
          t: 'ai',
          text: '¡Sí! El Dr. Perera tiene horas a las 6:45pm y 7:30pm el viernes. ¿Cuál te viene bien?',
        },
        { t: 'c', text: '7:30 por favor' },
        {
          t: 'ai',
          text: '¡Reservado ✅ Viernes 7:30pm con el Dr. Perera. Te recordaré un día antes!',
        },
        { t: 'handoff' },
        { t: 'result', view: 'calendar' },
      ],
    },
  },
  {
    business: 'Sweet Layers Bakery',
    avatarLetter: 'S',
    avatarColor: 'bg-rose-500',
    chip: 'Pricing',
    steps: {
      en: [
        { t: 'c', text: 'Hi, how much is a 2kg ribbon cake?' },
        {
          t: 'ai',
          text: 'Our 2kg ribbon cake is {cake} 🎂 Most customers add a free message card — want one?',
        },
        { t: 'c', text: 'Yes please, add the card' },
        {
          t: 'ai',
          text: 'Done! 2kg ribbon cake + message card — {cake}. Shall I book it for Saturday?',
        },
      ],
      si: [
        { t: 'c', text: 'Hi, 2kg ribbon cake එකක් කීයද?' },
        {
          t: 'ai',
          text: '2kg ribbon cake එක {cake} 🎂 බොහොමයක් අය free message card එකක් add කරගන්නවා — ඕනද?',
        },
        { t: 'c', text: 'ඔව්, card එකත් දාන්න' },
        {
          t: 'ai',
          text: 'හරි! 2kg ribbon cake + message card — {cake}. Saturdayට book කරන්නද?',
        },
      ],
      ta: [
        { t: 'c', text: 'Hi, 2kg ribbon cake எவ்வளவு?' },
        {
          t: 'ai',
          text: '2kg ribbon cake {cake} 🎂 பலர் இலவச message card சேர்ப்பார்கள் — வேண்டுமா?',
        },
        { t: 'c', text: 'ஆம், card-ஐயும் சேருங்கள்' },
        {
          t: 'ai',
          text: 'சரி! 2kg ribbon cake + message card — {cake}. சனிக்கு book செய்யட்டுமா?',
        },
      ],
      ar: [
        { t: 'c', text: 'مرحباً، كم سعر كيكة الريبون ٢ كجم؟' },
        {
          t: 'ai',
          text: 'كيكة الريبون ٢ كجم بـ{cake} 🎂 معظم العملاء يضيفون بطاقة رسالة مجانية — هل تريد واحدة؟',
        },
        { t: 'c', text: 'نعم، أضف البطاقة' },
        {
          t: 'ai',
          text: 'تم! كيكة ريبون ٢ كجم + بطاقة رسالة — {cake}. هل أحجزها ليوم السبت؟',
        },
      ],
      es: [
        { t: 'c', text: 'Hola, ¿cuánto cuesta una torta de 2kg?' },
        {
          t: 'ai',
          text: 'Nuestra torta de 2kg cuesta {cake} 🎂 La mayoría añade una tarjeta de mensaje gratis — ¿quieres una?',
        },
        { t: 'c', text: 'Sí, añade la tarjeta' },
        {
          t: 'ai',
          text: '¡Listo! Torta 2kg + tarjeta — {cake}. ¿La reservo para el sábado?',
        },
      ],
    },
  },
  {
    business: 'Spice Route Kitchen',
    avatarLetter: 'S',
    avatarColor: 'bg-amber-500',
    chip: 'Food order',
    steps: {
      en: [
        { t: 'voice' },
        { t: 'ai', text: 'Got it! One chicken kottu and one lime juice — anything else?' },
        { t: 'c', text: "That's all, deliver to Dehiwala" },
        { t: 'card', text: '{food}' },
        { t: 'ai', text: 'Order #78 confirmed! Arriving in ~35 mins 🛵' },
        { t: 'result', view: 'orderbook', text: '#78 · Kottu + juice · {food} · Confirmed ✅' },
      ],
      si: [
        { t: 'voice' },
        { t: 'ai', text: 'හරි! chicken kottu එකක් සහ lime juice එකක් — තව මොනවාහරිද?' },
        { t: 'c', text: 'ඒවා විතරයි, Dehiwalaට deliver කරන්න' },
        { t: 'card', text: '{food}' },
        { t: 'ai', text: 'Order #78 confirm! විනාඩි 35කින් විතර එනවා 🛵' },
        { t: 'result', view: 'orderbook', text: '#78 · Kottu + juice · {food} · Confirmed ✅' },
      ],
      ta: [
        { t: 'voice' },
        { t: 'ai', text: 'சரி! ஒரு chicken kottu, ஒரு lime juice — வேறு ஏதும்?' },
        { t: 'c', text: 'அவ்வளவுதான், Dehiwala-க்கு deliver செய்யுங்கள்' },
        { t: 'card', text: '{food}' },
        { t: 'ai', text: 'Order #78 உறுதி! ~35 நிமிடங்களில் வரும் 🛵' },
        { t: 'result', view: 'orderbook', text: '#78 · Kottu + juice · {food} · Confirmed ✅' },
      ],
      ar: [
        { t: 'voice' },
        { t: 'ai', text: 'تم! كوتو دجاج واحد وعصير ليمون — شيء آخر؟' },
        { t: 'c', text: 'هذا كل شيء، التوصيل إلى ديهيوالا' },
        { t: 'card', text: '{food}' },
        { t: 'ai', text: 'تم تأكيد الطلب #78! يصل خلال ~35 دقيقة 🛵' },
        { t: 'result', view: 'orderbook', text: '#78 · Kottu + juice · {food} · Confirmed ✅' },
      ],
      es: [
        { t: 'voice' },
        { t: 'ai', text: '¡Anotado! Un kottu de pollo y un jugo de lima — ¿algo más?' },
        { t: 'c', text: 'Eso es todo, entrega en Dehiwala' },
        { t: 'card', text: '{food}' },
        { t: 'ai', text: '¡Pedido #78 confirmado! Llega en ~35 min 🛵' },
        { t: 'result', view: 'orderbook', text: '#78 · Kottu + juice · {food} · Confirmed ✅' },
      ],
    },
  },
  {
    business: 'QuickMart Stores',
    avatarLetter: 'Q',
    avatarColor: 'bg-teal-500',
    chip: 'Tracking',
    steps: {
      en: [
        { t: 'c', text: 'Where is my order?' },
        { t: 'ai', text: 'Your order #1042 is out for delivery 🚚 Arriving today before 4pm.' },
        { t: 'c', text: 'Great, thanks!' },
        { t: 'ai', text: "You're welcome! Message me anytime for updates." },
      ],
      si: [
        { t: 'c', text: 'මගේ order එක කොහෙද?' },
        { t: 'ai', text: 'ඔබේ order #1042 deliveryට නික්මුණා 🚚 අද 4pmට කලින් එනවා.' },
        { t: 'c', text: 'බොහොම ස්තූතියි!' },
        { t: 'ai', text: 'සුභ පැතුම්! Updates ඕන විටෙක message කරන්න.' },
      ],
      ta: [
        { t: 'c', text: 'என் order எங்கே?' },
        { t: 'ai', text: 'உங்கள் order #1042 delivery-க்கு புறப்பட்டது 🚚 இன்று 4pm முன் வரும்.' },
        { t: 'c', text: 'நன்றி!' },
        { t: 'ai', text: 'வரவேற்கிறோம்! எப்போது வேண்டுமானாலும் message செய்யுங்கள்.' },
      ],
      ar: [
        { t: 'c', text: 'أين طلبي؟' },
        { t: 'ai', text: 'طلبك #1042 خرج للتوصيل 🚚 يصل اليوم قبل 4 مساءً.' },
        { t: 'c', text: 'شكراً!' },
        { t: 'ai', text: 'على الرحب! راسلني في أي وقت للتحديثات.' },
      ],
      es: [
        { t: 'c', text: '¿Dónde está mi pedido?' },
        { t: 'ai', text: 'Tu pedido #1042 está en reparto 🚚 Llega hoy antes de las 4pm.' },
        { t: 'c', text: '¡Genial, gracias!' },
        { t: 'ai', text: '¡De nada! Escríbeme cuando quieras.' },
      ],
    },
  },
  {
    business: 'Style Hub Clothing',
    avatarLetter: 'S',
    avatarColor: 'bg-violet-500',
    chip: 'Payment',
    steps: {
      en: [
        { t: 'c', text: "I've just paid via bank transfer" },
        { t: 'photo', text: 'bank-slip.jpg 🧾' },
        {
          t: 'ai',
          text: 'Payment received ✅ {slip} via bank transfer. Your order is confirmed!',
        },
        { t: 'c', text: 'When will it arrive?' },
        {
          t: 'ai',
          text: "Ships tomorrow — delivery in 2–3 days 📦 I'll send you the tracking link.",
        },
        { t: 'result', view: 'orderbook', text: '#79 · Dress ×1 · {slip} · Paid ✅' },
      ],
      si: [
        { t: 'c', text: 'Bank transfer එකක් ගෙව්වා' },
        { t: 'photo', text: 'bank-slip.jpg 🧾' },
        { t: 'ai', text: 'Payment ලැබුණා ✅ {slip} bank transfer එකෙන්. ඔබේ order එක confirm!' },
        { t: 'c', text: 'කවදාද එන්නේ?' },
        {
          t: 'ai',
          text: 'හෙට ship කරනවා — දවස් 2–3කින් deliver වෙනවා 📦 tracking link එක එවන්නම්.',
        },
        { t: 'result', view: 'orderbook', text: '#79 · Dress ×1 · {slip} · Paid ✅' },
      ],
      ta: [
        { t: 'c', text: 'Bank transfer செய்துவிட்டேன்' },
        { t: 'photo', text: 'bank-slip.jpg 🧾' },
        { t: 'ai', text: 'Payment வந்துவிட்டது ✅ {slip} bank transfer மூலம். உங்கள் order உறுதி!' },
        { t: 'c', text: 'எப்போது வரும்?' },
        {
          t: 'ai',
          text: 'நாளை ship ஆகும் — 2–3 நாட்களில் delivery 📦 tracking link அனுப்புவேன்.',
        },
        { t: 'result', view: 'orderbook', text: '#79 · Dress ×1 · {slip} · Paid ✅' },
      ],
      ar: [
        { t: 'c', text: 'لقد دفعت عبر تحويل بنكي' },
        { t: 'photo', text: 'bank-slip.jpg 🧾' },
        { t: 'ai', text: 'تم استلام الدفعة ✅ {slip} عبر تحويل بنكي. تم تأكيد طلبك!' },
        { t: 'c', text: 'متى سيصل؟' },
        { t: 'ai', text: 'يُشحن غداً — التوصيل خلال 2–3 أيام 📦 سأرسل رابط التتبع.' },
        { t: 'result', view: 'orderbook', text: '#79 · Dress ×1 · {slip} · Paid ✅' },
      ],
      es: [
        { t: 'c', text: 'Ya pagué por transferencia' },
        { t: 'photo', text: 'bank-slip.jpg 🧾' },
        { t: 'ai', text: 'Pago recibido ✅ {slip} por transferencia. ¡Tu pedido está confirmado!' },
        { t: 'c', text: '¿Cuándo llega?' },
        {
          t: 'ai',
          text: 'Sale mañana — entrega en 2–3 días 📦 Te envío el link de seguimiento.',
        },
        { t: 'result', view: 'orderbook', text: '#79 · Dress ×1 · {slip} · Paid ✅' },
      ],
    },
  },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Typewriter({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      // prefers-reduced-motion: render the full message instantly
      setN(text.length);
      return;
    }
    setN(0);
    const iv = setInterval(() => {
      setN((v) => (v >= text.length ? v : v + 2));
    }, 24);
    return () => clearInterval(iv);
  }, [text, reduceMotion]);

  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse text-teal-brand">▍</span>}
    </>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#8696a0]"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </motion.div>
  );
}

const WAVEFORM_HEIGHTS = [7, 11, 15, 9, 13, 17, 8, 12, 16, 10, 14, 8];

function VoiceBubble() {
  return (
    <div className="w-[180px]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a884]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        </span>
        <span className="flex flex-1 items-center gap-[2.5px]" aria-hidden="true">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-full bg-[#5a8a72]"
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="text-[10px] text-[#667781]">0:12</span>
      </div>
      <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#667781]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z"
            fill="currentColor"
          />
        </svg>
        now
      </span>
    </div>
  );
}

function PhotoBubble({ caption }: { caption: string }) {
  return (
    <div className="w-[200px]">
      <div className="flex h-[120px] w-[200px] items-center justify-center rounded-lg bg-gradient-to-br from-teal-brand/25 to-indigo-brand/25">
        <span className="text-2xl" aria-hidden="true">
          🧾
        </span>
      </div>
      <span className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-[#111b21]">
        <span className="truncate">{caption}</span>
        <span className="shrink-0 text-[9px] text-[#667781]">now</span>
      </span>
    </div>
  );
}

function OrderCard({ total }: { total: string }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-[#e6e8f5] bg-white text-left shadow-sm">
      <span aria-hidden className="w-1 shrink-0 bg-gradient-to-b from-teal-brand to-indigo-brand" />
      <div className="px-3.5 py-2.5">
        <p className="text-[12px] font-semibold text-[#12142b]">🧾 Order summary</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#5a5e7a]">
          Chicken kottu ×1
          <br />
          Lime juice ×1
        </p>
        <p className="mt-1 text-[11px] font-bold text-[#12142b]">Total: {total}</p>
        <span className="mt-1.5 inline-flex rounded-full bg-brand-gradient px-3 py-1 text-[10px] font-semibold text-white">
          Confirm ✅
        </span>
      </div>
    </div>
  );
}

// July 2026 starts on a Wednesday (Mon-first grid → 2 leading blanks); the 24th is a Friday.
const CALENDAR_CELLS: (number | null)[] = [
  null,
  null,
  ...Array.from({ length: 31 }, (_, d) => d + 1),
];

function CalendarView() {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="rounded-xl border border-[#e6e8f5] bg-white p-3.5 shadow-sm">
        <p className="text-[12px] font-semibold text-[#12142b]">📅 July 2026</p>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="text-[9px] font-semibold text-[#8696a0]">
              {d}
            </span>
          ))}
          {CALENDAR_CELLS.map((d, i) =>
            d === 24 ? (
              <span
                key={i}
                className="flex h-7 items-center justify-center rounded-md bg-gradient-to-br from-teal-brand to-indigo-brand text-[10px] font-bold text-white"
              >
                24
              </span>
            ) : (
              <span
                key={i}
                className="flex h-7 items-center justify-center rounded-md text-[10px] text-[#667781]"
              >
                {d ?? ''}
              </span>
            ),
          )}
        </div>
        <div className="mt-2 flex justify-center">
          <span className="rounded-full bg-gradient-to-r from-teal-brand/15 to-indigo-brand/15 px-2.5 py-1 text-[9px] font-semibold text-[#12142b]">
            Fri 24 · 7:30 · Dr. Perera
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold">
        <span className="text-gradient">Booked on the calendar ✅</span>
      </p>
    </div>
  );
}

const ORDERBOOK_COLS = 'grid grid-cols-[2.4rem_1fr_auto_auto] gap-x-2';

function OrderBookView({ row }: { row: string }) {
  const cells = row.split(' · ');
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="rounded-xl border border-[#e6e8f5] bg-white p-3.5 shadow-sm">
        <p className="text-[12px] font-semibold text-[#12142b]">🧾 Order book</p>
        <div className="mt-2 text-[10px]">
          <div
            className={`${ORDERBOOK_COLS} border-b border-[#eef0f8] pb-1 font-semibold uppercase tracking-wide text-[#8696a0]`}
          >
            <span>Order</span>
            <span>Items</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          <div className={`${ORDERBOOK_COLS} py-1.5 text-[#a0a4bd]`}>
            <span>#77</span>
            <span>Sandwich ×2</span>
            <span>LKR 1,200</span>
            <span>Delivered</span>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.35, ease: 'easeOut' }}
            className={`${ORDERBOOK_COLS} rounded-lg bg-teal-brand/10 px-1.5 py-1.5 font-semibold text-[#12142b]`}
          >
            {cells.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </motion.div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold">
        <span className="text-gradient">Logged in the order book ✅</span>
      </p>
    </div>
  );
}

type Msg = {
  id: number;
  kind: StepType;
  text: string;
};

export default function ChatMockup() {
  const [cycle, setCycle] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<{ view: ResultView; text: string } | null>(null);
  const idRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = reduceMotion ?? false;
  }, [reduceMotion]);

  // Pause the demo while the phone is scrolled out of view or the tab is hidden.
  useEffect(() => {
    let inView = true;
    const update = () => {
      pausedRef.current = document.hidden || !inView;
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        update();
      },
      { threshold: 0.1 },
    );
    if (rootRef.current) io.observe(rootRef.current);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const push = (m: Omit<Msg, 'id'>) => {
      if (cancelled) return;
      idRef.current += 1;
      setMessages((prev) => [...prev.slice(-5), { ...m, id: idRef.current }]);
    };

    // Pause-aware sleep: freezes while paused and resumes exactly where it stopped.
    const wait = async (ms: number) => {
      let left = ms;
      while (!cancelled && left > 0) {
        if (pausedRef.current) {
          await sleep(250);
          continue;
        }
        const slice = Math.min(100, left);
        await sleep(slice);
        left -= slice;
      }
    };

    async function run() {
      let i = 0;
      while (!cancelled) {
        const reduced = reducedRef.current;
        const langIdx = i % LANGUAGES.length;
        const scenIdx = (i * 3) % SCENARIOS.length;
        const lang = LANGUAGES[langIdx];
        const scenario = SCENARIOS[scenIdx];
        setCycle(i);
        setMessages([]);
        setTyping(false);
        setResult(null);
        await wait(reduced ? 250 : 600);
        let showedResult = false;
        for (const step of scenario.steps[lang.code]) {
          if (cancelled) return;
          const text = step.text ? localize(step.text, lang.code) : '';
          if (step.t === 'ai' || step.t === 'card') {
            if (reduced) {
              push({ kind: step.t, text });
              await wait(400);
            } else {
              setTyping(true);
              await wait(950);
              if (cancelled) return;
              setTyping(false);
              push({ kind: step.t, text });
              // keep pace with the Typewriter reveal (~12ms/char) plus a beat
              await wait(step.t === 'ai' ? 450 + text.length * 12 : 1400);
            }
          } else if (step.t === 'handoff') {
            push({ kind: 'handoff', text: HANDOFF_TEXT });
            await wait(reduced ? 500 : 1400);
          } else if (step.t === 'result' && step.view) {
            await wait(reduced ? 200 : 500);
            if (cancelled) return;
            setResult({ view: step.view, text });
            showedResult = true;
            await wait(reduced ? 1500 : 3000);
          } else {
            push({ kind: step.t, text });
            await wait(reduced ? 400 : 1150);
          }
        }
        if (cancelled) return;
        // the result view already held the screen for ~3s, so cut the end pause short
        await wait(reduced ? 1000 : showedResult ? 800 : 4000);
        i += 1;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const lang = LANGUAGES[cycle % LANGUAGES.length];
  const scenario = SCENARIOS[(cycle * 3) % SCENARIOS.length];

  return (
    <div ref={rootRef} className="relative w-full max-w-[min(400px,90vw)]">
      {/* Floating orbs */}
      <motion.div
        aria-hidden
        className="absolute -left-16 -top-12 h-36 w-36 rounded-full bg-teal-brand/20 blur-[60px] will-change-transform md:h-56 md:w-56 md:blur-[90px]"
        animate={reduceMotion ? undefined : { x: [0, 20, 0], y: [0, -16, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-14 -right-16 h-44 w-44 rounded-full bg-indigo-brand/20 blur-[70px] will-change-transform md:h-64 md:w-64 md:blur-[100px]"
        animate={reduceMotion ? undefined : { x: [0, -24, 0], y: [0, 18, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[2rem] border border-[#e6e8f5] bg-white shadow-[0_30px_80px_-24px_rgba(74,66,252,0.28)]">
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#008069] px-4 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.business}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${scenario.avatarColor} text-sm font-bold text-white`}
            >
              {scenario.avatarLetter}
            </motion.div>
          </AnimatePresence>
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.p
                key={scenario.business}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="truncate text-sm font-semibold text-white"
              >
                {scenario.business}
              </motion.p>
            </AnimatePresence>
            <p className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d9fdd3]" />
              online
            </p>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={scenario.chip}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white"
            >
              {scenario.chip}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.span
              key={lang.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white"
            >
              {lang.label}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Chat area */}
        <div
          className="relative flex h-[380px] flex-col justify-end gap-2 overflow-hidden bg-[#efeae2] px-3 pb-4 pt-8 [mask-image:linear-gradient(to_bottom,transparent,black_14%)]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(18,20,43,0.055) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={`result-${cycle}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.4 } }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col justify-center gap-2"
                dir={lang.dir}
              >
                {result.view === 'calendar' ? (
                  <CalendarView />
                ) : (
                  <OrderBookView row={result.text} />
                )}
              </motion.div>
            ) : (
            <motion.div
              key={cycle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              className="flex flex-col justify-end gap-2"
              dir={lang.dir}
            >
              {messages.map((m) => {
                if (m.kind === 'handoff') {
                  return (
                    <motion.div
                      key={m.id}
                      dir="ltr"
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="mx-auto flex max-w-[85%] items-stretch overflow-hidden rounded-xl border border-[#e6e8f5] bg-white text-left shadow-sm"
                    >
                      <span aria-hidden className="w-1 shrink-0 bg-gradient-to-b from-teal-brand to-indigo-brand" />
                      <span className="px-3.5 py-2.5 text-[11px] leading-relaxed text-[#5a5e7a]">
                        {m.text}
                      </span>
                    </motion.div>
                  );
                }
                if (m.kind === 'card') {
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 16, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="w-fit max-w-[82%]"
                    >
                      <OrderCard total={m.text} />
                    </motion.div>
                  );
                }
                const isAi = m.kind === 'ai';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`w-fit max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-[#111b21] shadow-sm ${
                      isAi
                        ? 'rounded-bl-md bg-white'
                        : 'self-end rounded-br-md bg-[#d9fdd3]'
                    }`}
                  >
                    {m.kind === 'voice' ? (
                      <VoiceBubble />
                    ) : m.kind === 'photo' ? (
                      <PhotoBubble caption={m.text} />
                    ) : isAi ? (
                      <>
                        <Typewriter text={m.text} />
                        <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#667781]">
                          <span className="rounded bg-teal-brand/15 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-[#009e90]">
                            AI
                          </span>
                          now
                        </span>
                      </>
                    ) : (
                      <>
                        {m.text}
                        <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#667781]">
                          now
                        </span>
                      </>
                    )}
                  </motion.div>
                );
              })}
              {typing && <TypingIndicator />}
            </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar (decorative) */}
        <div className="flex items-center gap-2 border-t border-[#e6e8f5] bg-[#f0f2f5] px-3 py-2.5">
          <div className="h-9 flex-1 rounded-full bg-white px-4 text-xs leading-9 text-[#8696a0]">
            Message
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-brand/90">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5 21 3l-6.5 18-2.7-7.8L3 11.5Z" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
