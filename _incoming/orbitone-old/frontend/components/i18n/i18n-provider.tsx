"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Locale = "en" | "si" | "ta";

type Dictionary = Record<string, string>;

const en: Dictionary = {
  createCard: "Create your free card",
  demoProfile: "See a demo profile",
  login: "Log in",
  getStarted: "Get started free",
  heroTitle: "Turn every introduction into an opportunity",
  heroSubtitle:
    "Create your profile, share your QR code, and turn new contacts into opportunities — all in one place.",
  noCreditCard: "No credit card required.",
  trustedBy: "Trusted by professionals at",
  featureTitle: "Everything you need to network smarter",
  featureSubtitle:
    "A digital business card that does more than share contact info.",
  shareQR: "Share with QR",
  shareQRDesc:
    "Generate a scannable QR code that links directly to your public profile.",
  growNetwork: "Grow your network",
  growNetworkDesc:
    "Let people add you to their network with one tap from your profile.",
  saveContact: "Save as contact",
  saveContactDesc:
    "Visitors can download your details as a vCard and add you to their phone.",
  trackAnalytics: "Track analytics",
  trackAnalyticsDesc:
    "See profile views, QR scans, and network growth at a glance.",
  useCasesTitle: "Built for how you network",
  useCasesSubtitle: "OrbitOne works wherever you meet people.",
  events: "Events & conferences",
  eventsDesc:
    "Share your card in seconds and keep track of everyone you meet.",
  sales: "Sales & partnerships",
  salesDesc:
    "Give prospects a professional way to save your details and book a meeting.",
  freelancers: "Freelancers & founders",
  freelancersDesc: "One link for your portfolio, calendar, and contact info.",
  howItWorks: "How it works",
  step1: "Create your profile",
  step1Desc: "Add your details, photo, and links in under a minute.",
  step2: "Share your card",
  step2Desc: "Use your QR code, link, or vCard at events and meetings.",
  step3: "Grow opportunities",
  step3Desc:
    "Track engagement and manage your network from your dashboard.",
  testimonials: "Loved by professionals",
  ctaTitle: "Ready to turn introductions into opportunities?",
  ctaSubtitle: "Join professionals who use OrbitOne to network smarter.",
  footerCopy: "© {year} OrbitOne.",
  welcomeBack: "Welcome back",
  signInSubtitle: "Sign in to manage your profile and network.",
  createAccount: "Create your account",
  registerSubtitle:
    "Start building your digital business card today.",
  fullName: "Full name",
  email: "Email",
  password: "Password",
  signIn: "Sign in",
  createAccountBtn: "Create account",
  alreadyHaveAccount: "Already have an account?",
  noAccount: "Don’t have an account?",
  getStartedFree: "Get started free",
  networkTagline: "Your network is your net worth.",
  networkDescription:
    "OrbitOne helps you turn every introduction into an opportunity with a smart digital business card, QR sharing, and lightweight CRM.",
  benefitQR: "Share your card with a QR code",
  benefitNetwork: "Grow and manage your network",
  benefitVCard: "Export contacts as vCard",
  benefitAnalytics: "Track profile engagement",
  views: "Views",
  saves: "Saves",
  network: "Network",
  scanToConnect: "Scan to connect",
  quote1:
    "I no longer fumble with paper cards. My QR code goes everywhere with me.",
  quote2:
    "The booking integration means prospects can grab time on my calendar right from my profile.",
  quote3: "Clean, professional, and easy to share. Exactly what I needed.",
};

const si: Dictionary = {
  createCard: "ඔබේ නොමිලේ කාඩ්පත සාදන්න",
  demoProfile: "ආදර්ශ පැතිකඩ බලන්න",
  login: "පිවිසෙන්න",
  getStarted: "නොමිලේ ආරම්භ කරන්න",
  heroTitle: "සෑම හැඳින්වීමක්ම අවස්ථාවක් බවට පරිවර්තනය කරන්න",
  heroSubtitle:
    "ඔබේ පැතිකඩ සාදන්න, ඔබේ QR කේතය බෙදාගන්න, සහ නව සම්බන්ධතා අවස්ථා බවට පරිවර්තනය කරන්න — සියල්ල එකම ස්ථානයකින්.",
  noCreditCard: "ණය පත අවශ්‍ය නැත.",
  trustedBy: "වෘත්තීයයන් විසින් විශ්වාස කර ඇත",
  featureTitle: "වඩාත් බුද්ධිමත්ව ජාලගත වීමට අවශ්‍ය සියලු දේ",
  featureSubtitle:
    "සම්බන්ධතා තොරතුරු පමණක් බෙදා නොගන්නා ඩිජිටල් ව්‍යාපාර කාඩ්පතක්.",
  shareQR: "QR සමඟ බෙදාගන්න",
  shareQRDesc:
    "ඔබේ පොදු පැතිකඩට සෘජුවම සම්බන්ධ වන ස්කෑන් කළ හැකි QR කේතයක් ජනනය කරන්න.",
  growNetwork: "ඔබේ ජාලය වර්ධනය කරන්න",
  growNetworkDesc:
    "ඔබේ පැතිකඩෙන් එක් තට්ටුවකින් ඔබව ඔවුන්ගේ ජාලයට එකතු කිරීමට ඉඩ දෙන්න.",
  saveContact: "සම්බන්ධතාවයක් ලෙස සුරකින්න",
  saveContactDesc:
    "පරිශීලකයින්ට ඔබේ විස්තර vCard ලෙස බාගත කර දුරකථනයට එකතු කළ හැක.",
  trackAnalytics: "විශ්ලේෂණ ලුහුඬු කරන්න",
  trackAnalyticsDesc:
    "පැතිකඩ දසුන්, QR ස්කෑන් සහ ජාල වර්ධනය එක දෘෂ්‍යයෙන් බලන්න.",
  useCasesTitle: "ඔබ ජාලගත වන ආකාරයට සකසා ඇත",
  useCasesSubtitle: "OrbitOne ඔබ මිනිසුන් හමුවන සෑම තැනකම ක්‍රියා කරයි.",
  events: "උත්සව සහ සම්මේලන",
  eventsDesc:
    "තත්පර කිහිපයකින් ඔබේ කාඩ්පත බෙදාගෙන ඔබ හමුවන සියලු දෙනා ලුහුඬු කරන්න.",
  sales: "විකුණුම් සහ හවුල්කාරිත්වය",
  salesDesc:
    "ඉඳුරන්නන්ට ඔබේ විස්තර සුරකින සහ හමුවීමක් වෙන්කරවා ගැනීමේ වෘත්තීය ක්‍රමයක් ලබා දෙන්න.",
  freelancers: "ස්වාධීන ශිල්පීන් සහ ආරම්භකයින්",
  freelancersDesc:
    "ඔබගේ කෘති එකතුව, දින දර්ශනය සහ සම්බන්ධතා තොරතුරු සඳහා එක් සබැඳියක්.",
  howItWorks: "එය ක්‍රියාත්මක වන්නේ කෙසේද",
  step1: "ඔබේ පැතිකඩ සාදන්න",
  step1Desc:
    "මිනිත්තුවකට වඩා අඩු කාලයකින් ඔබේ විස්තර, ඡායාරූපය සහ සබැඳි එකතු කරන්න.",
  step2: "ඔබේ කාඩ්පත බෙදාගන්න",
  step2Desc:
    "උත්සව සහ හමුවීම්වලදී ඔබේ QR කේතය, සබැඳිය හෝ vCard භාවිතා කරන්න.",
  step3: "අවස්ථා වර්ධනය කරන්න",
  step3Desc:
    "ඔබගේ ඩැෂ්බෝඩ් එකෙන් සම්බන්ධතාවය ලුහුඬු කර ජාලය කළමනාකරණය කරන්න.",
  testimonials: "වෘත්තීයයන් විසින් ප්‍රිය කරයි",
  ctaTitle: "හැඳින්වීම් අවස්ථා බවට පරිවර්තනය කිරීමට සූදානම්ද?",
  ctaSubtitle:
    "OrbitOne භාවිතයෙන් බුද්ධිමත්ව ජාලගත වන වෘත්තීයයන් සමඟ එක්වන්න.",
  footerCopy: "© {year} OrbitOne.",
  welcomeBack: "නැවත සාදරයෙන්",
  signInSubtitle: "ඔබේ පැතිකඩ සහ ජාලය කළමනාකරණය කිරීමට පිවිසෙන්න.",
  createAccount: "ඔබේ ගිණුම සාදන්න",
  registerSubtitle:
    "අද ඔබේ ඩිජිටල් ව්‍යාපාර කාඩ්පත ගොඩනැගීම ආරම්භ කරන්න.",
  fullName: "සම්පූර්ණ නම",
  email: "ඊමේල්",
  password: "මුරපදය",
  signIn: "පිවිසෙන්න",
  createAccountBtn: "ගිණුම සාදන්න",
  alreadyHaveAccount: "දැනටමත් ගිණුමක් තිබේද?",
  noAccount: "ගිණුමක් නැද්ද?",
  getStartedFree: "නොමිලේ ආරම්භ කරන්න",
  networkTagline: "ඔබේ ජාලය ඔබේ ශුද්ධ වටිනාකමයි.",
  networkDescription:
    "OrbitOne ඔබට සෑම හැඳින්වීමක්ම බුද්ධිමත් ඩිජිටල් ව්‍යාපාර කාඩ්පතක්, QR බෙදාහැරීමක් සහ සැහැල්ලු CRM එකක් සමඟ අවස්ථාවක් බවට පරිවර්තනය කිරීමට උදව් කරයි.",
  benefitQR: "QR කේතයක් සමඟ ඔබේ කාඩ්පත බෙදාගන්න",
  benefitNetwork: "ඔබේ ජාලය වර්ධනය කර කළමනාකරණය කරන්න",
  benefitVCard: "සම්බන්ධතා vCard ලෙස නිර්යාත කරන්න",
  benefitAnalytics: "පැතිකඩ සම්බන්ධතාවය ලුහුඬු කරන්න",
  views: "දසුන්",
  saves: "සුරැකීම්",
  network: "ජාලය",
  scanToConnect: "සම්බන්ධ වීමට ස්කෑන් කරන්න",
  quote1:
    "මම තවදුරටත් කඩදාසි කාඩ් සමඟ අරගල නොකරමි. මගේ QR කේතය මා සමඟ සෑම තැනකටම යයි.",
  quote2:
    "වෙන්කරවා ගැනීමේ ඒකාබද්ධ කිරීම නිසා ඉඳුරන්නන්ට මාගේ දින දර්ශනයෙන් කාලය ග්‍රහණය කර ගත හැකිය.",
  quote3:
    "පිරිසිදු, වෘත්තීයමය, සහ බෙදාහැරීමට පහසුය. මට හරියටම අවශ්‍ය වූයේ එයයි.",
};

const ta: Dictionary = {
  createCard: "உங்கள் இலவச அட்டையை உருவாக்கவும்",
  demoProfile: "செயல்முறை சுயவிவரத்தைக் காண்க",
  login: "உள்நுழையவும்",
  getStarted: "இலவசமாகத் தொடங்குங்கள்",
  heroTitle: "ஒவ்வொரு அறிமுகத்தையும் வாய்ப்பாக மாற்றுங்கள்",
  heroSubtitle:
    "உங்கள் சுயவிவரத்தை உருவாக்குங்கள், உங்கள் QR குறியீட்டைப் பகிர்ந்து கொள்ளுங்கள், மற்றும் புதிய தொடர்புகளை வாய்ப்புகளாக மாற்றுங்கள் — அனைத்தும் ஒரே இடத்தில்.",
  noCreditCard: "கடனட்டை தேவையில்லை.",
  trustedBy: "தொழில்முறையாளர்களால் நம்பப்பட்டது",
  featureTitle: "புத்திசாலித்தனமாக நெட்வொர்க் செய்ய தேவையான அனைத்தும்",
  featureSubtitle:
    "தொடர்புத் தகவலை மட்டும் பகிராத டிஜிட்டல் வணிக அட்டை.",
  shareQR: "QR மூலம் பகிரவும்",
  shareQRDesc:
    "உங்கள் பொது சுயவிவரத்திற்கு நேரடியாக இணைக்கும் ஸ்கேன் செய்யக்கூடிய QR குறியீட்டை உருவாக்கவும்.",
  growNetwork: "உங்கள் நெட்வொர்க்கை வளர்க்கவும்",
  growNetworkDesc:
    "உங்கள் சுயவிவரத்தில் ஒரு தட்டலுடன் உங்களை அவர்களின் நெட்வொர்க்கில் சேர்க்க அனுமதிக்கவும்.",
  saveContact: "தொடர்பாகச் சேமிக்கவும்",
  saveContactDesc:
    "பார்வையாளர்கள் உங்கள் விவரங்களை vCard ஆகப் பதிவிறக்கி தங்கள் தொலைபேசியில் சேர்க்கலாம்.",
  trackAnalytics: "பகுப்பாய்வுகளைக் கண்காணிக்கவும்",
  trackAnalyticsDesc:
    "சுயவிவரக் காட்சிகள், QR ஸ்கேன்கள் மற்றும் நெட்வொர்க் வளர்ச்சியை ஒரு பார்வையில் காண்க.",
  useCasesTitle: "நீங்கள் நெட்வொர்க் செய்யும் வகைக்காக உருவாக்கப்பட்டது",
  useCasesSubtitle: "OrbitOne நீங்கள் மக்களைச் சந்திக்கும் எல்லா இடத்திலும் வேலை செய்கிறது.",
  events: "நிகழ்வுகள் & மாநாடுகள்",
  eventsDesc:
    "விநாடிகளில் உங்கள் அட்டையைப் பகிர்ந்து, நீங்கள் சந்திக்கும் அனைவரையும் கண்காணிக்கவும்.",
  sales: "விற்பனை & கூட்டாண்மைகள்",
  salesDesc:
    "வாய்ப்புகளுக்கு உங்கள் விவரங்களைச் சேமிக்கவும், சந்திப்பை முன்பதிவு செய்யவும் ஒரு தொழில்முறை வழியை வழங்கவும்.",
  freelancers: "சுய தொழிலாளர்கள் & நிறுவனர்கள்",
  freelancersDesc:
    "உங்கள் போர்ட்ஃபோலியோ, காலெண்டர் மற்றும் தொடர்புத் தகவலுக்கு ஒரு இணைப்பு.",
  howItWorks: "இது எவ்வாறு செயல்படுகிறது",
  step1: "உங்கள் சுயவிவரத்தை உருவாக்கவும்",
  step1Desc:
    "ஒரு நிமிடத்திற்கும் குறைவான நேரத்தில் உங்கள் விவரங்கள், புகைப்படம் மற்றும் இணைப்புகளைச் சேர்க்கவும்.",
  step2: "உங்கள் அட்டையைப் பகிரவும்",
  step2Desc:
    "நிகழ்வுகள் மற்றும் சந்திப்புகளில் உங்கள் QR குறியீடு, இணைப்பு அல்லது vCard-ஐப் பயன்படுத்தவும்.",
  step3: "வாய்ப்புகளை வளர்க்கவும்",
  step3Desc:
    "உங்கள் டாஷ்போர்டிலிருந்து ஈடுபாட்டைக் கண்காணித்து உங்கள் நெட்வொர்க்கை நிர்வகிக்கவும்.",
  testimonials: "தொழில்முறையாளர்களால் விரும்பப்படுகிறது",
  ctaTitle: "அறிமுகங்களை வாய்ப்புகளாக மாற்றத் தயாரா?",
  ctaSubtitle:
    "OrbitOne மூலம் புத்திசாலித்தனமாக நெட்வொர்க் செய்யும் தொழில்முறையாளர்களுடன் இணைந்து கொள்ளுங்கள்.",
  footerCopy: "© {year} OrbitOne.",
  welcomeBack: "மீண்டும் வருக",
  signInSubtitle:
    "உங்கள் சுயவிவரம் மற்றும் நெட்வொர்க்கை நிர்வகிக்க உள்நுழையவும்.",
  createAccount: "உங்கள் கணக்கை உருவாக்கவும்",
  registerSubtitle:
    "இன்றே உங்கள் டிஜிட்டல் வணிக அட்டையைக் கட்டத் தொடங்குங்கள்.",
  fullName: "முழு பெயர்",
  email: "மின்னஞ்சல்",
  password: "கடவுச்சொல்",
  signIn: "உள்நுழையவும்",
  createAccountBtn: "கணக்கை உருவாக்கவும்",
  alreadyHaveAccount: "ஏற்கனவே கணக்கு உள்ளதா?",
  noAccount: "கணக்கு இல்லையா?",
  getStartedFree: "இலவசமாகத் தொடங்குங்கள்",
  networkTagline: "உங்கள் நெட்வொர்க் தான் உங்கள் நிகர மதிப்பு.",
  networkDescription:
    "OrbitOne ஒவ்வொரு அறிமுகத்தையும் ஒரு ஸ்மார்ட் டிஜிட்டல் வணிக அட்டை, QR பகிர்வு மற்றும் இலகு CRM மூலம் வாய்ப்பாக மாற்ற உதவுகிறது.",
  benefitQR: "QR குறியீட்டுடன் உங்கள் அட்டையைப் பகிரவும்",
  benefitNetwork: "உங்கள் நெட்வொர்க்கை வளர்த்து நிர்வகிக்கவும்",
  benefitVCard: "தொடர்புகளை vCard ஆக ஏற்றுமதி செய்யவும்",
  benefitAnalytics: "சுயவிவர ஈடுபாட்டைக் கண்காணிக்கவும்",
  views: "காட்சிகள்",
  saves: "சேமிப்புகள்",
  network: "நெட்வொர்க்",
  scanToConnect: "இணைக்க ஸ்கேன் செய்யவும்",
  quote1:
    "நான் இனி காகித அட்டைகளுடன் போராடுவதில்லை. என் QR குறியீடு என்னுடன் எல்லா இடங்களுக்கும் செல்கிறது.",
  quote2:
    "முன்பதிவு ஒருங்கிணைப்பு காரணமாக வாய்ப்புகள் என் சுயவிவரத்திலிருந்தே என் காலெண்டரில் நேரத்தை எடுக்க முடியும்.",
  quote3:
    "சுத்தமான, தொழில்முறை, மற்றும் பகிர்வதற்கு எளிதானது. எனக்கு துல்லியமாக தேவையானது.",
};

const dictionaries: Record<Locale, Dictionary> = { en, si, ta };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("orbitone-locale") as Locale | null;
  if (saved && dictionaries[saved]) return saved;
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (next: Locale) => {
    if (!dictionaries[next]) return;
    setLocaleState(next);
    localStorage.setItem("orbitone-locale", next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: string) => {
    return dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
