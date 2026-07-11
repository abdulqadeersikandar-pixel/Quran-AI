import React, { useState, useRef, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';

// --- CSS & Premium Styles ---
const premiumStyles = `
  @keyframes pulseRecord {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }
  @keyframes pulseSpeaker {
    0% { box-shadow: 0 0 0 0 rgba(27, 67, 50, 0.5); }
    70% { box-shadow: 0 0 0 10px rgba(27, 67, 50, 0); }
    100% { box-shadow: 0 0 0 0 rgba(27, 67, 50, 0); }
  }
  @keyframes slideUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes popIn {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  body {
    margin: 0;
    font-family: 'Inter', sans-serif;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 0.3s;
  }
  .nav-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  }
  .nav-item.active { color: var(--text-heading); }
  .nav-icon { font-size: 22px; margin-bottom: 4px; }

  .speaker-btn {
    width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border-color);
    background-color: var(--track-bg); color: var(--text-heading); font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;
  }
  .speaker-btn:hover { background-color: var(--accent-soft); border-color: #16A34A; }
  .speaker-btn.playing { background-color: #1B4332; color: white; animation: pulseSpeaker 1.5s infinite; }
  .speaker-btn.loading { animation: spin 1s linear infinite; }

  /* Modal Styles */
  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  }
  .modal-content {
    background: var(--card-bg); color: var(--text-body); padding: 25px 20px; border-radius: 24px; width: 90%; max-width: 420px;
    text-align: center; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-height: 85vh; overflow-y: auto;
  }

  /* --- Light / Dark theme tokens --- */
  .app-shell {
    max-width: 600px;
    margin: 0 auto;
    min-height: 100vh;
    position: relative;
    transition: background-color 0.3s, color 0.3s;

    --bg-app: #FAF8F5;
    --card-bg: #FFFFFF;
    --track-bg: #F9FAFB;
    --border-color: #E5E7EB;
    --text-heading: #1B4332;
    --text-secondary: #6B7280;
    --text-body: #374151;
    --text-muted: #9CA3AF;
    --accent-soft: #F0FDF4;

    background-color: var(--bg-app);
    color: var(--text-body);
  }
  .app-shell[data-theme="dark"] {
    --bg-app: #0F1712;
    --card-bg: #182620;
    --track-bg: #1E2E27;
    --border-color: #2C3D35;
    --text-heading: #ECFDF5;
    --text-secondary: #A3B3AC;
    --text-body: #D7E0DB;
    --text-muted: #7C8B84;
    --accent-soft: #1C3A2C;
  }

  .bottom-nav {
    max-width: 600px;
    background-color: var(--card-bg) !important;
    border-top: 1px solid var(--border-color) !important;
  }
  @media (min-width: 640px) {
    .app-shell { max-width: 700px; }
    .bottom-nav { max-width: 700px; }
  }
  @media (min-width: 900px) {
    .app-shell { max-width: 880px; box-shadow: 0 0 50px rgba(0,0,0,0.05); }
    .bottom-nav { max-width: 880px; }
  }
  @media (min-width: 1280px) {
    .app-shell { max-width: 1080px; }
    .bottom-nav { max-width: 1080px; }
  }

  /* Card lists: mobile par ek column, tablet/desktop par 2 (ya 3) columns mein reflow */
  @media (min-width: 720px) {
    .grid-list { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; align-items: start; }
  }
  @media (min-width: 1100px) {
    .grid-list-3 { grid-template-columns: repeat(3, 1fr) !important; }
  }
`;

const toArabicNumber = (num) => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(digit => arabicNumbers[digit]).join('');
};

// islamic.network CDN — reciter edition + bitrate + global ayah number ke through recitation milti hai
const ayahAudioUrl = (globalAyahNumber, edition = 'ar.alafasy', bitrate = 128) =>
  `https://cdn.islamic.network/quran/audio/${bitrate}/${edition}/${globalAyahNumber}.mp3`;

// Har CDN edition har bitrate par available nahi hoti, is liye fallback order try karte hain
const AUDIO_BITRATE_FALLBACKS = [128, 64, 192, 48, 32];

const RECITERS = [
  { id: 'ar.alafasy', name_en: 'Mishary Rashid Alafasy', name_ur: 'مشاری راشد العفاسی' },
  { id: 'ar.husary', name_en: 'Mahmoud Khalil Al-Husary', name_ur: 'محمود خلیل الحصری' },
  { id: 'ar.abdulbasitmurattal', name_en: 'Abdul Basit (Murattal)', name_ur: 'عبد الباسط (مرتل)' },
  { id: 'ar.minshawi', name_en: 'Mohamed Siddiq Al-Minshawi', name_ur: 'محمد صدیق المنشاوی' },
  { id: 'ar.abdurrahmaansudais', name_en: 'Abdur-Rahman As-Sudais', name_ur: 'عبد الرحمن السدیس' },
];

// Translation language filter — poori app mein (Ayah of the Day waghera) yehi translation dikhegi
const TRANSLATIONS = [
  { code: 'en', edition: 'en.sahih', name_en: 'English', name_native: 'English' },
  { code: 'ur', edition: 'ur.jalandhry', name_en: 'Urdu', name_native: 'اردو' },
  { code: 'ps', edition: 'ps.abdulwali', name_en: 'Pashto', name_native: 'پښتو' },
  { code: 'hi', edition: 'hi.hindi', name_en: 'Hindi', name_native: 'हिन्दी' },
  { code: 'bn', edition: 'bn.bengali', name_en: 'Bengali', name_native: 'বাংলা' },
  { code: 'fa', edition: 'fa.makarem', name_en: 'Persian', name_native: 'فارسی' },
  { code: 'tr', edition: 'tr.diyanet', name_en: 'Turkish', name_native: 'Türkçe' },
  { code: 'fr', edition: 'fr.hamidullah', name_en: 'French', name_native: 'Français' },
  { code: 'id', edition: 'id.indonesian', name_en: 'Indonesian', name_native: 'Bahasa Indonesia' },
  { code: 'ms', edition: 'ms.basmeih', name_en: 'Malay', name_native: 'Bahasa Melayu' },
  { code: 'es', edition: 'es.cortes', name_en: 'Spanish', name_native: 'Español' },
  { code: 'de', edition: 'de.aburida', name_en: 'German', name_native: 'Deutsch' },
  { code: 'ru', edition: 'ru.kuliev', name_en: 'Russian', name_native: 'Русский' },
  { code: 'zh', edition: 'zh.jian', name_en: 'Chinese', name_native: '中文' },
  { code: 'so', edition: 'so.abduh', name_en: 'Somali', name_native: 'Soomaali' },
];
const DEFAULT_TRANSLATION_CODE = 'en';

// --- Poori app ki UI strings, 15 languages mein — App Language yehi control karti hai ---
const UI_STRINGS = {
  en: {
    nav_home: 'Home', nav_learn: 'Learn', nav_recite: 'Recite', nav_progress: 'Progress', nav_profile: 'Profile',
    header_home: 'Tajweed AI', header_recite: 'Recitation Practice', header_learn: 'Learn Tajweed', header_progress: 'My Progress', header_profile: 'Profile & Settings',
    home_greeting: 'Welcome!', home_subtitle: 'Improve your recitation today, with correct Tajweed.',
    ayah_of_day: 'Ayah of the Day', practice_this_surah: 'Practice this Surah →', ayaat_practiced: 'Ayahs practiced (this Surah)', avg_accuracy: 'Average Accuracy',
    action_recite_title: 'Recitation Practice', action_recite_sub: 'Check your Tajweed with AI',
    action_learn_title: 'Learn Tajweed Rules', action_learn_sub: 'All rules with audio, in your language',
    loading: 'Loading...', continue_practice: 'Continue Practice',
    streak_label: 'Day Streak', overall_avg: 'Overall Average', best_score: 'Best Score', week_performance: 'Last 7 Days Performance',
    recent_sessions: 'Recent Sessions', no_sessions: 'No practice sessions yet. Start from the Recite tab! 🎤',
    guest_banner: 'Guest mode — this data is only on this browser. Log in to save it forever.', login_cta: 'Login →',
    reciter_title: 'Recitation Voice', reciter_sub: 'This reciter will be used for 🔊 buttons across the app',
    language_title: 'App Language', language_sub: 'This language is used for translations and app text',
    theme_title: 'Appearance', theme_sub: 'Choose how the app looks', theme_light: 'Light', theme_dark: 'Dark',
    data_privacy: 'Data & Privacy', data_privacy_sub_cloud: 'Your progress is now saved in the cloud — synced across devices', data_privacy_sub_guest: 'Your practice history is only saved on this device (browser)',
    clear_history: 'Clear Progress History', logout: 'Logout',
    login_title: 'Login', signup_title: 'Create a New Account', login_subtitle: 'Log in to sync your progress and preferences across every device',
    email_label: 'Email', password_label: 'Password (at least 6 characters)', name_label: 'Your name',
    login_btn: 'Login', signup_btn: 'Sign Up', or_divider: '— or —', google_login: 'Continue with Google',
    no_account: "Don't have an account?", have_account: 'Already have an account?',
  },
  ur: {
    nav_home: 'ہوم', nav_learn: 'سیکھیں', nav_recite: 'تلاوت', nav_progress: 'پیش رفت', nav_profile: 'پروفائل',
    header_home: 'تجوید اے آئی', header_recite: 'تلاوت کی مشق', header_learn: 'تجوید سیکھیں', header_progress: 'میری پیش رفت', header_profile: 'پروفائل اور ترتیبات',
    home_greeting: 'خوش آمدید!', home_subtitle: 'آج اپنی تلاوت کو صحیح تجوید کے ساتھ بہتر بنائیں۔',
    ayah_of_day: 'آج کی آیت', practice_this_surah: 'اسی سورت کی مشق کریں ←', ayaat_practiced: 'مشق کی گئی آیات (اس سورت میں)', avg_accuracy: 'اوسط درستگی',
    action_recite_title: 'تلاوت کی مشق', action_recite_sub: 'اے آئی سے اپنی تجوید چیک کروائیں',
    action_learn_title: 'تجوید کے قواعد سیکھیں', action_learn_sub: 'تمام قواعد آواز کے ساتھ، آپ کی زبان میں',
    loading: 'لوڈ ہو رہا ہے...', continue_practice: 'مشق جاری رکھیں',
    streak_label: 'دن کا تسلسل', overall_avg: 'مجموعی اوسط', best_score: 'بہترین اسکور', week_performance: 'پچھلے 7 دن کی کارکردگی',
    recent_sessions: 'حالیہ سیشنز', no_sessions: 'ابھی تک کوئی مشق نہیں ہوئی۔ تلاوت ٹیب سے شروع کریں! 🎤',
    guest_banner: 'مہمان موڈ — یہ ڈیٹا صرف اسی براؤزر میں ہے۔ ہمیشہ کے لیے محفوظ کرنے کے لیے لاگ ان کریں۔', login_cta: 'لاگ ان ←',
    reciter_title: 'تلاوت کی آواز', reciter_sub: 'یہ قاری پوری ایپ میں 🔊 بٹنز کے لیے استعمال ہوگا',
    language_title: 'ایپ کی زبان', language_sub: 'یہ زبان ترجمے اور ایپ کے متن کے لیے استعمال ہوگی',
    theme_title: 'ظاہری شکل', theme_sub: 'ایپ کیسی نظر آئے، منتخب کریں', theme_light: 'لائٹ', theme_dark: 'ڈارک',
    data_privacy: 'ڈیٹا اور پرائیویسی', data_privacy_sub_cloud: 'آپ کی پیش رفت اب کلاؤڈ میں محفوظ ہو رہی ہے — تمام آلات پر سنک ہوگی', data_privacy_sub_guest: 'آپ کی مشق کی تاریخ صرف اسی ڈیوائس (براؤزر) میں محفوظ ہے',
    clear_history: 'پیش رفت کی تاریخ صاف کریں', logout: 'لاگ آؤٹ',
    login_title: 'لاگ ان کریں', signup_title: 'نیا اکاؤنٹ بنائیں', login_subtitle: 'ہر ڈیوائس پر اپنی پیش رفت اور ترجیحات سنک کرنے کے لیے لاگ ان کریں',
    email_label: 'ای میل', password_label: 'پاس ورڈ (کم از کم 6 حروف)', name_label: 'آپ کا نام',
    login_btn: 'لاگ ان', signup_btn: 'سائن اپ', or_divider: '— یا —', google_login: 'گوگل سے جاری رکھیں',
    no_account: 'اکاؤنٹ نہیں ہے؟', have_account: 'پہلے سے اکاؤنٹ ہے؟',
  },
  ps: {
    nav_home: 'کور', nav_learn: 'زده کړه', nav_recite: 'تلاوت', nav_progress: 'پرمختګ', nav_profile: 'پېژندنه',
    header_home: 'تجوید AI', header_recite: 'د تلاوت تمرین', header_learn: 'تجوید زده کړه', header_progress: 'زما پرمختګ', header_profile: 'پېژندنه او امستنې',
    home_greeting: 'ښه راغلاست!', home_subtitle: 'نن ورځ خپله تلاوت د سمې تجوید سره ښه کړئ.',
    ayah_of_day: 'د ورځې آیت', practice_this_surah: 'د دې سورت تمرین وکړئ ←', ayaat_practiced: 'تمرین شوي آیتونه (په دې سورت کې)', avg_accuracy: 'منځنۍ سموالی',
    action_recite_title: 'د تلاوت تمرین', action_recite_sub: 'خپل تجوید د AI سره وګورئ',
    action_learn_title: 'د تجوید قواعد زده کړئ', action_learn_sub: 'ټول قواعد د غږ سره، ستاسو په ژبه',
    loading: 'بار کیږي...', continue_practice: 'تمرین ته دوام ورکړئ',
    streak_label: 'د ورځو لړۍ', overall_avg: 'ټولیزه منځنۍ', best_score: 'غوره نمره', week_performance: 'د تیرو ۷ ورځو فعالیت',
    recent_sessions: 'وروستي ناستې', no_sessions: 'تر اوسه هیڅ تمرین نه دی شوی. د تلاوت ټب څخه پیل کړئ! 🎤',
    guest_banner: 'میلمه حالت — دا معلومات یوازې په دې براوزر کې دي. تل پاتې کولو لپاره ننوځئ.', login_cta: 'ننوتل ←',
    reciter_title: 'د تلاوت غږ', reciter_sub: 'دا قاري به په ټوله اپلیکیشن کې د 🔊 تڼیو لپاره کارول کیږي',
    language_title: 'د اپ ژبه', language_sub: 'دا ژبه به د ژباړو او متن لپاره وکارول شي',
    theme_title: 'بڼه', theme_sub: 'غوره کړئ چې اپ څنګه ښکاري', theme_light: 'رڼا', theme_dark: 'تیاره',
    data_privacy: 'معلومات او محرمیت', data_privacy_sub_cloud: 'ستاسو پرمختګ اوس په کلاوډ کې خوندي کیږي — د ټولو وسایلو تر منځ همغږي کیږي', data_privacy_sub_guest: 'ستاسو د تمرین تاریخ یوازې پدې وسیله (براوزر) کې خوندي دی',
    clear_history: 'د پرمختګ تاریخ پاک کړئ', logout: 'وتل',
    login_title: 'ننوتل', signup_title: 'نوی حساب جوړ کړئ', login_subtitle: 'خپل پرمختګ او غوراوي په ټولو وسایلو کې همغږي کولو لپاره ننوځئ',
    email_label: 'بریښنالیک', password_label: 'پټنوم (لږترلږه ۶ توري)', name_label: 'ستاسو نوم',
    login_btn: 'ننوتل', signup_btn: 'ثبت نوم', or_divider: '— یا —', google_login: 'د ګوګل سره دوام ورکړئ',
    no_account: 'حساب نه لرئ؟', have_account: 'مخکې حساب لرئ؟',
  },
  hi: {
    nav_home: 'होम', nav_learn: 'सीखें', nav_recite: 'तिलावत', nav_progress: 'प्रगति', nav_profile: 'प्रोफ़ाइल',
    header_home: 'तजवीद AI', header_recite: 'तिलावत अभ्यास', header_learn: 'तजवीद सीखें', header_progress: 'मेरी प्रगति', header_profile: 'प्रोफ़ाइल और सेटिंग्स',
    home_greeting: 'स्वागत है!', home_subtitle: 'आज सही तजवीद के साथ अपनी तिलावत सुधारें।',
    ayah_of_day: 'आज की आयत', practice_this_surah: 'इस सूरह का अभ्यास करें ←', ayaat_practiced: 'अभ्यास की गई आयतें (इस सूरह में)', avg_accuracy: 'औसत सटीकता',
    action_recite_title: 'तिलावत अभ्यास', action_recite_sub: 'AI से अपनी तजवीद जांचें',
    action_learn_title: 'तजवीद के नियम सीखें', action_learn_sub: 'सभी नियम ऑडियो के साथ, आपकी भाषा में',
    loading: 'लोड हो रहा है...', continue_practice: 'अभ्यास जारी रखें',
    streak_label: 'दिन की लगातार', overall_avg: 'कुल औसत', best_score: 'सर्वश्रेष्ठ स्कोर', week_performance: 'पिछले 7 दिनों का प्रदर्शन',
    recent_sessions: 'हाल के सत्र', no_sessions: 'अभी तक कोई अभ्यास सत्र नहीं हुआ। तिलावत टैब से शुरू करें! 🎤',
    guest_banner: 'गेस्ट मोड — यह डेटा केवल इसी ब्राउज़र में है। हमेशा के लिए सहेजने हेतु लॉगिन करें।', login_cta: 'लॉगिन ←',
    reciter_title: 'तिलावत की आवाज़', reciter_sub: 'यह क़ारी पूरे ऐप में 🔊 बटनों के लिए उपयोग होगा',
    language_title: 'ऐप की भाषा', language_sub: 'यह भाषा अनुवाद और ऐप के टेक्स्ट के लिए उपयोग होगी',
    theme_title: 'दिखावट', theme_sub: 'चुनें कि ऐप कैसा दिखे', theme_light: 'लाइट', theme_dark: 'डार्क',
    data_privacy: 'डेटा और गोपनीयता', data_privacy_sub_cloud: 'आपकी प्रगति अब क्लाउड में सहेजी जा रही है — हर डिवाइस पर सिंक होगी', data_privacy_sub_guest: 'आपका अभ्यास इतिहास केवल इसी डिवाइस (ब्राउज़र) में सहेजा गया है',
    clear_history: 'प्रगति इतिहास साफ़ करें', logout: 'लॉगआउट',
    login_title: 'लॉगिन करें', signup_title: 'नया खाता बनाएं', login_subtitle: 'हर डिवाइस पर अपनी प्रगति और प्राथमिकताएं सिंक करने के लिए लॉगिन करें',
    email_label: 'ईमेल', password_label: 'पासवर्ड (कम से कम 6 अक्षर)', name_label: 'आपका नाम',
    login_btn: 'लॉगिन', signup_btn: 'साइन अप', or_divider: '— या —', google_login: 'Google से जारी रखें',
    no_account: 'खाता नहीं है?', have_account: 'पहले से खाता है?',
  },
  bn: {
    nav_home: 'হোম', nav_learn: 'শিখুন', nav_recite: 'তিলাওয়াত', nav_progress: 'অগ্রগতি', nav_profile: 'প্রোফাইল',
    header_home: 'তাজবীদ AI', header_recite: 'তিলাওয়াত অনুশীলন', header_learn: 'তাজবীদ শিখুন', header_progress: 'আমার অগ্রগতি', header_profile: 'প্রোফাইল ও সেটিংস',
    home_greeting: 'স্বাগতম!', home_subtitle: 'আজ সঠিক তাজবীদ দিয়ে আপনার তিলাওয়াত উন্নত করুন।',
    ayah_of_day: 'আজকের আয়াত', practice_this_surah: 'এই সূরাটি অনুশীলন করুন ←', ayaat_practiced: 'অনুশীলিত আয়াত (এই সূরায়)', avg_accuracy: 'গড় নির্ভুলতা',
    action_recite_title: 'তিলাওয়াত অনুশীলন', action_recite_sub: 'AI দিয়ে আপনার তাজবীদ যাচাই করুন',
    action_learn_title: 'তাজবীদের নিয়ম শিখুন', action_learn_sub: 'সব নিয়ম অডিওসহ, আপনার ভাষায়',
    loading: 'লোড হচ্ছে...', continue_practice: 'অনুশীলন চালিয়ে যান',
    streak_label: 'দিনের ধারাবাহিকতা', overall_avg: 'সামগ্রিক গড়', best_score: 'সর্বোচ্চ স্কোর', week_performance: 'গত ৭ দিনের কার্যক্ষমতা',
    recent_sessions: 'সাম্প্রতিক সেশন', no_sessions: 'এখনো কোনো অনুশীলন সেশন হয়নি। তিলাওয়াত ট্যাব থেকে শুরু করুন! 🎤',
    guest_banner: 'গেস্ট মোড — এই ডেটা শুধু এই ব্রাউজারে আছে। চিরস্থায়ীভাবে সংরক্ষণ করতে লগইন করুন।', login_cta: 'লগইন ←',
    reciter_title: 'তিলাওয়াতের কণ্ঠ', reciter_sub: 'এই ক্বারী পুরো অ্যাপে 🔊 বাটনের জন্য ব্যবহৃত হবে',
    language_title: 'অ্যাপের ভাষা', language_sub: 'এই ভাষা অনুবাদ এবং অ্যাপের টেক্সটের জন্য ব্যবহৃত হবে',
    theme_title: 'চেহারা', theme_sub: 'অ্যাপ কেমন দেখাবে তা বেছে নিন', theme_light: 'লাইট', theme_dark: 'ডার্ক',
    data_privacy: 'ডেটা ও গোপনীয়তা', data_privacy_sub_cloud: 'আপনার অগ্রগতি এখন ক্লাউডে সংরক্ষিত হচ্ছে — সব ডিভাইসে সিঙ্ক হবে', data_privacy_sub_guest: 'আপনার অনুশীলনের ইতিহাস শুধু এই ডিভাইসে (ব্রাউজার) সংরক্ষিত আছে',
    clear_history: 'অগ্রগতির ইতিহাস মুছুন', logout: 'লগআউট',
    login_title: 'লগইন করুন', signup_title: 'নতুন অ্যাকাউন্ট তৈরি করুন', login_subtitle: 'প্রতিটি ডিভাইসে আপনার অগ্রগতি ও পছন্দ সিঙ্ক করতে লগইন করুন',
    email_label: 'ইমেইল', password_label: 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)', name_label: 'আপনার নাম',
    login_btn: 'লগইন', signup_btn: 'সাইন আপ', or_divider: '— অথবা —', google_login: 'Google দিয়ে চালিয়ে যান',
    no_account: 'অ্যাকাউন্ট নেই?', have_account: 'আগে থেকে অ্যাকাউন্ট আছে?',
  },
  fa: {
    nav_home: 'خانه', nav_learn: 'آموزش', nav_recite: 'تلاوت', nav_progress: 'پیشرفت', nav_profile: 'پروفایل',
    header_home: 'تجوید AI', header_recite: 'تمرین تلاوت', header_learn: 'آموزش تجوید', header_progress: 'پیشرفت من', header_profile: 'پروفایل و تنظیمات',
    home_greeting: 'خوش آمدید!', home_subtitle: 'امروز تلاوت خود را با تجوید صحیح بهبود دهید.',
    ayah_of_day: 'آیه روز', practice_this_surah: 'تمرین همین سوره ←', ayaat_practiced: 'آیات تمرین‌شده (در این سوره)', avg_accuracy: 'میانگین دقت',
    action_recite_title: 'تمرین تلاوت', action_recite_sub: 'تجوید خود را با هوش مصنوعی بررسی کنید',
    action_learn_title: 'قوانین تجوید را بیاموزید', action_learn_sub: 'تمام قوانین همراه با صدا، به زبان شما',
    loading: 'در حال بارگذاری...', continue_practice: 'ادامه تمرین',
    streak_label: 'روزهای پیاپی', overall_avg: 'میانگین کلی', best_score: 'بهترین امتیاز', week_performance: 'عملکرد ۷ روز گذشته',
    recent_sessions: 'جلسات اخیر', no_sessions: 'هنوز هیچ تمرینی انجام نشده. از تب تلاوت شروع کنید! 🎤',
    guest_banner: 'حالت مهمان — این داده فقط در همین مرورگر است. برای ذخیره دائمی وارد شوید.', login_cta: 'ورود ←',
    reciter_title: 'صدای تلاوت', reciter_sub: 'این قاری برای دکمه‌های 🔊 در سراسر برنامه استفاده می‌شود',
    language_title: 'زبان برنامه', language_sub: 'این زبان برای ترجمه‌ها و متن برنامه استفاده می‌شود',
    theme_title: 'ظاهر', theme_sub: 'انتخاب کنید برنامه چگونه به نظر برسد', theme_light: 'روشن', theme_dark: 'تیره',
    data_privacy: 'داده و حریم خصوصی', data_privacy_sub_cloud: 'پیشرفت شما اکنون در ابر ذخیره می‌شود — در همه دستگاه‌ها همگام می‌شود', data_privacy_sub_guest: 'تاریخچه تمرین شما فقط در همین دستگاه (مرورگر) ذخیره شده است',
    clear_history: 'پاک کردن تاریخچه پیشرفت', logout: 'خروج',
    login_title: 'ورود', signup_title: 'ایجاد حساب جدید', login_subtitle: 'برای همگام‌سازی پیشرفت و تنظیمات در همه دستگاه‌ها وارد شوید',
    email_label: 'ایمیل', password_label: 'رمز عبور (حداقل ۶ کاراکتر)', name_label: 'نام شما',
    login_btn: 'ورود', signup_btn: 'ثبت‌نام', or_divider: '— یا —', google_login: 'ادامه با Google',
    no_account: 'حساب ندارید؟', have_account: 'قبلاً حساب دارید؟',
  },
  tr: {
    nav_home: 'Ana Sayfa', nav_learn: 'Öğren', nav_recite: 'Okuma', nav_progress: 'İlerleme', nav_profile: 'Profil',
    header_home: 'Tecvid AI', header_recite: 'Kıraat Alıştırması', header_learn: 'Tecvid Öğren', header_progress: 'İlerlemem', header_profile: 'Profil ve Ayarlar',
    home_greeting: 'Hoş geldiniz!', home_subtitle: 'Bugün kıraatinizi doğru tecvid ile geliştirin.',
    ayah_of_day: 'Günün Ayeti', practice_this_surah: 'Bu sureyi çalış ←', ayaat_practiced: 'Çalışılan ayetler (bu surede)', avg_accuracy: 'Ortalama Doğruluk',
    action_recite_title: 'Kıraat Alıştırması', action_recite_sub: 'Tecvidinizi yapay zeka ile kontrol edin',
    action_learn_title: 'Tecvid Kurallarını Öğren', action_learn_sub: 'Tüm kurallar sesli, kendi dilinizde',
    loading: 'Yükleniyor...', continue_practice: 'Alıştırmaya Devam Et',
    streak_label: 'Gün Serisi', overall_avg: 'Genel Ortalama', best_score: 'En İyi Skor', week_performance: 'Son 7 Günün Performansı',
    recent_sessions: 'Son Oturumlar', no_sessions: 'Henüz alıştırma yapılmadı. Okuma sekmesinden başlayın! 🎤',
    guest_banner: 'Misafir modu — bu veriler sadece bu tarayıcıda. Kalıcı kaydetmek için giriş yapın.', login_cta: 'Giriş Yap ←',
    reciter_title: 'Kıraat Sesi', reciter_sub: 'Bu kari, uygulama genelinde 🔊 düğmeleri için kullanılacak',
    language_title: 'Uygulama Dili', language_sub: 'Bu dil çeviriler ve uygulama metni için kullanılır',
    theme_title: 'Görünüm', theme_sub: 'Uygulamanın nasıl görüneceğini seçin', theme_light: 'Açık', theme_dark: 'Koyu',
    data_privacy: 'Veri ve Gizlilik', data_privacy_sub_cloud: 'İlerlemeniz artık bulutta kaydediliyor — tüm cihazlarda senkronize olur', data_privacy_sub_guest: 'Alıştırma geçmişiniz yalnızca bu cihazda (tarayıcıda) kayıtlı',
    clear_history: 'İlerleme Geçmişini Temizle', logout: 'Çıkış Yap',
    login_title: 'Giriş Yap', signup_title: 'Yeni Hesap Oluştur', login_subtitle: 'İlerlemenizi ve tercihlerinizi tüm cihazlarda senkronize etmek için giriş yapın',
    email_label: 'E-posta', password_label: 'Şifre (en az 6 karakter)', name_label: 'Adınız',
    login_btn: 'Giriş Yap', signup_btn: 'Kaydol', or_divider: '— veya —', google_login: 'Google ile devam et',
    no_account: 'Hesabınız yok mu?', have_account: 'Zaten hesabınız var mı?',
  },
  fr: {
    nav_home: 'Accueil', nav_learn: 'Apprendre', nav_recite: 'Réciter', nav_progress: 'Progrès', nav_profile: 'Profil',
    header_home: 'Tajweed IA', header_recite: 'Pratique de récitation', header_learn: 'Apprendre le Tajweed', header_progress: 'Mes progrès', header_profile: 'Profil et paramètres',
    home_greeting: 'Bienvenue !', home_subtitle: 'Améliorez votre récitation aujourd\'hui, avec un Tajweed correct.',
    ayah_of_day: 'Verset du jour', practice_this_surah: 'Pratiquer cette sourate →', ayaat_practiced: 'Versets pratiqués (dans cette sourate)', avg_accuracy: 'Précision moyenne',
    action_recite_title: 'Pratique de récitation', action_recite_sub: "Vérifiez votre Tajweed avec l'IA",
    action_learn_title: 'Apprendre les règles du Tajweed', action_learn_sub: 'Toutes les règles avec audio, dans votre langue',
    loading: 'Chargement...', continue_practice: 'Continuer la pratique',
    streak_label: 'Jours consécutifs', overall_avg: 'Moyenne globale', best_score: 'Meilleur score', week_performance: 'Performance des 7 derniers jours',
    recent_sessions: 'Sessions récentes', no_sessions: "Aucune session de pratique pour l'instant. Commencez depuis l'onglet Réciter ! 🎤",
    guest_banner: 'Mode invité — ces données ne sont que sur ce navigateur. Connectez-vous pour les sauvegarder définitivement.', login_cta: 'Connexion →',
    reciter_title: 'Voix de récitation', reciter_sub: "Ce récitateur sera utilisé pour les boutons 🔊 dans toute l'application",
    language_title: "Langue de l'application", language_sub: "Cette langue est utilisée pour les traductions et le texte de l'application",
    theme_title: 'Apparence', theme_sub: "Choisissez l'apparence de l'application", theme_light: 'Clair', theme_dark: 'Sombre',
    data_privacy: 'Données et confidentialité', data_privacy_sub_cloud: 'Vos progrès sont maintenant enregistrés dans le cloud — synchronisés sur tous les appareils', data_privacy_sub_guest: "Votre historique de pratique n'est enregistré que sur cet appareil (navigateur)",
    clear_history: 'Effacer l\'historique des progrès', logout: 'Déconnexion',
    login_title: 'Connexion', signup_title: 'Créer un nouveau compte', login_subtitle: 'Connectez-vous pour synchroniser vos progrès et préférences sur tous les appareils',
    email_label: 'E-mail', password_label: 'Mot de passe (au moins 6 caractères)', name_label: 'Votre nom',
    login_btn: 'Connexion', signup_btn: "S'inscrire", or_divider: '— ou —', google_login: 'Continuer avec Google',
    no_account: "Vous n'avez pas de compte ?", have_account: 'Vous avez déjà un compte ?',
  },
  id: {
    nav_home: 'Beranda', nav_learn: 'Belajar', nav_recite: 'Baca', nav_progress: 'Progres', nav_profile: 'Profil',
    header_home: 'Tajwid AI', header_recite: 'Latihan Bacaan', header_learn: 'Belajar Tajwid', header_progress: 'Progres Saya', header_profile: 'Profil & Pengaturan',
    home_greeting: 'Selamat datang!', home_subtitle: 'Tingkatkan bacaan Anda hari ini, dengan Tajwid yang benar.',
    ayah_of_day: 'Ayat Hari Ini', practice_this_surah: 'Latih surah ini →', ayaat_practiced: 'Ayat yang dilatih (dalam surah ini)', avg_accuracy: 'Akurasi Rata-rata',
    action_recite_title: 'Latihan Bacaan', action_recite_sub: 'Periksa Tajwid Anda dengan AI',
    action_learn_title: 'Pelajari Aturan Tajwid', action_learn_sub: 'Semua aturan dengan audio, dalam bahasa Anda',
    loading: 'Memuat...', continue_practice: 'Lanjutkan Latihan',
    streak_label: 'Hari Berturut-turut', overall_avg: 'Rata-rata Keseluruhan', best_score: 'Skor Terbaik', week_performance: 'Performa 7 Hari Terakhir',
    recent_sessions: 'Sesi Terbaru', no_sessions: 'Belum ada sesi latihan. Mulai dari tab Baca! 🎤',
    guest_banner: 'Mode tamu — data ini hanya ada di browser ini. Masuk untuk menyimpannya selamanya.', login_cta: 'Masuk →',
    reciter_title: 'Suara Bacaan', reciter_sub: 'Qari ini akan digunakan untuk tombol 🔊 di seluruh aplikasi',
    language_title: 'Bahasa Aplikasi', language_sub: 'Bahasa ini digunakan untuk terjemahan dan teks aplikasi',
    theme_title: 'Tampilan', theme_sub: 'Pilih tampilan aplikasi', theme_light: 'Terang', theme_dark: 'Gelap',
    data_privacy: 'Data & Privasi', data_privacy_sub_cloud: 'Progres Anda kini disimpan di cloud — tersinkron di semua perangkat', data_privacy_sub_guest: 'Riwayat latihan Anda hanya disimpan di perangkat ini (browser)',
    clear_history: 'Hapus Riwayat Progres', logout: 'Keluar',
    login_title: 'Masuk', signup_title: 'Buat Akun Baru', login_subtitle: 'Masuk untuk menyinkronkan progres dan preferensi Anda di semua perangkat',
    email_label: 'Email', password_label: 'Kata sandi (minimal 6 karakter)', name_label: 'Nama Anda',
    login_btn: 'Masuk', signup_btn: 'Daftar', or_divider: '— atau —', google_login: 'Lanjutkan dengan Google',
    no_account: 'Belum punya akun?', have_account: 'Sudah punya akun?',
  },
  ms: {
    nav_home: 'Laman Utama', nav_learn: 'Belajar', nav_recite: 'Bacaan', nav_progress: 'Kemajuan', nav_profile: 'Profil',
    header_home: 'Tajwid AI', header_recite: 'Latihan Bacaan', header_learn: 'Belajar Tajwid', header_progress: 'Kemajuan Saya', header_profile: 'Profil & Tetapan',
    home_greeting: 'Selamat datang!', home_subtitle: 'Tingkatkan bacaan anda hari ini, dengan Tajwid yang betul.',
    ayah_of_day: 'Ayat Hari Ini', practice_this_surah: 'Berlatih surah ini →', ayaat_practiced: 'Ayat yang dilatih (dalam surah ini)', avg_accuracy: 'Ketepatan Purata',
    action_recite_title: 'Latihan Bacaan', action_recite_sub: 'Semak Tajwid anda dengan AI',
    action_learn_title: 'Belajar Peraturan Tajwid', action_learn_sub: 'Semua peraturan dengan audio, dalam bahasa anda',
    loading: 'Memuatkan...', continue_practice: 'Teruskan Latihan',
    streak_label: 'Hari Berturutan', overall_avg: 'Purata Keseluruhan', best_score: 'Skor Terbaik', week_performance: 'Prestasi 7 Hari Lepas',
    recent_sessions: 'Sesi Terkini', no_sessions: 'Belum ada sesi latihan. Mulakan dari tab Bacaan! 🎤',
    guest_banner: 'Mod tetamu — data ini hanya ada pada pelayar ini. Log masuk untuk menyimpannya selama-lamanya.', login_cta: 'Log Masuk →',
    reciter_title: 'Suara Bacaan', reciter_sub: 'Qari ini akan digunakan untuk butang 🔊 di seluruh aplikasi',
    language_title: 'Bahasa Aplikasi', language_sub: 'Bahasa ini digunakan untuk terjemahan dan teks aplikasi',
    theme_title: 'Rupa', theme_sub: 'Pilih rupa aplikasi', theme_light: 'Terang', theme_dark: 'Gelap',
    data_privacy: 'Data & Privasi', data_privacy_sub_cloud: 'Kemajuan anda kini disimpan di awan — disegerakkan di semua peranti', data_privacy_sub_guest: 'Sejarah latihan anda hanya disimpan pada peranti ini (pelayar)',
    clear_history: 'Kosongkan Sejarah Kemajuan', logout: 'Log Keluar',
    login_title: 'Log Masuk', signup_title: 'Cipta Akaun Baharu', login_subtitle: 'Log masuk untuk menyegerakkan kemajuan dan pilihan anda di semua peranti',
    email_label: 'E-mel', password_label: 'Kata laluan (sekurang-kurangnya 6 aksara)', name_label: 'Nama anda',
    login_btn: 'Log Masuk', signup_btn: 'Daftar', or_divider: '— atau —', google_login: 'Teruskan dengan Google',
    no_account: 'Tiada akaun?', have_account: 'Sudah ada akaun?',
  },
  es: {
    nav_home: 'Inicio', nav_learn: 'Aprender', nav_recite: 'Recitar', nav_progress: 'Progreso', nav_profile: 'Perfil',
    header_home: 'Tayid IA', header_recite: 'Práctica de Recitación', header_learn: 'Aprender Tayid', header_progress: 'Mi Progreso', header_profile: 'Perfil y Ajustes',
    home_greeting: '¡Bienvenido!', home_subtitle: 'Mejora tu recitación hoy, con el Tayid correcto.',
    ayah_of_day: 'Aleya del Día', practice_this_surah: 'Practicar esta sura →', ayaat_practiced: 'Aleyas practicadas (en esta sura)', avg_accuracy: 'Precisión Promedio',
    action_recite_title: 'Práctica de Recitación', action_recite_sub: 'Verifica tu Tayid con IA',
    action_learn_title: 'Aprender las Reglas del Tayid', action_learn_sub: 'Todas las reglas con audio, en tu idioma',
    loading: 'Cargando...', continue_practice: 'Continuar Práctica',
    streak_label: 'Días Seguidos', overall_avg: 'Promedio General', best_score: 'Mejor Puntuación', week_performance: 'Rendimiento de los Últimos 7 Días',
    recent_sessions: 'Sesiones Recientes', no_sessions: '¡Aún no hay sesiones de práctica. Empieza desde la pestaña Recitar! 🎤',
    guest_banner: 'Modo invitado — estos datos solo están en este navegador. Inicia sesión para guardarlos para siempre.', login_cta: 'Iniciar sesión →',
    reciter_title: 'Voz de Recitación', reciter_sub: 'Este recitador se usará para los botones 🔊 en toda la aplicación',
    language_title: 'Idioma de la App', language_sub: 'Este idioma se usa para las traducciones y el texto de la app',
    theme_title: 'Apariencia', theme_sub: 'Elige cómo se ve la app', theme_light: 'Claro', theme_dark: 'Oscuro',
    data_privacy: 'Datos y Privacidad', data_privacy_sub_cloud: 'Tu progreso ahora se guarda en la nube — sincronizado en todos los dispositivos', data_privacy_sub_guest: 'Tu historial de práctica solo se guarda en este dispositivo (navegador)',
    clear_history: 'Borrar Historial de Progreso', logout: 'Cerrar sesión',
    login_title: 'Iniciar Sesión', signup_title: 'Crear una Cuenta Nueva', login_subtitle: 'Inicia sesión para sincronizar tu progreso y preferencias en todos los dispositivos',
    email_label: 'Correo electrónico', password_label: 'Contraseña (mínimo 6 caracteres)', name_label: 'Tu nombre',
    login_btn: 'Iniciar Sesión', signup_btn: 'Registrarse', or_divider: '— o —', google_login: 'Continuar con Google',
    no_account: '¿No tienes una cuenta?', have_account: '¿Ya tienes una cuenta?',
  },
  de: {
    nav_home: 'Start', nav_learn: 'Lernen', nav_recite: 'Rezitieren', nav_progress: 'Fortschritt', nav_profile: 'Profil',
    header_home: 'Tajwid KI', header_recite: 'Rezitationsübung', header_learn: 'Tajwid Lernen', header_progress: 'Mein Fortschritt', header_profile: 'Profil & Einstellungen',
    home_greeting: 'Willkommen!', home_subtitle: 'Verbessere heute deine Rezitation mit korrektem Tajwid.',
    ayah_of_day: 'Vers des Tages', practice_this_surah: 'Diese Sure üben →', ayaat_practiced: 'Geübte Verse (in dieser Sure)', avg_accuracy: 'Durchschnittliche Genauigkeit',
    action_recite_title: 'Rezitationsübung', action_recite_sub: 'Überprüfe dein Tajwid mit KI',
    action_learn_title: 'Tajwid-Regeln Lernen', action_learn_sub: 'Alle Regeln mit Audio, in deiner Sprache',
    loading: 'Wird geladen...', continue_practice: 'Übung Fortsetzen',
    streak_label: 'Tage in Folge', overall_avg: 'Gesamtdurchschnitt', best_score: 'Bester Wert', week_performance: 'Leistung der letzten 7 Tage',
    recent_sessions: 'Letzte Sitzungen', no_sessions: 'Noch keine Übungssitzungen. Starte im Tab Rezitieren! 🎤',
    guest_banner: 'Gastmodus — diese Daten sind nur in diesem Browser. Melde dich an, um sie dauerhaft zu speichern.', login_cta: 'Anmelden →',
    reciter_title: 'Rezitationsstimme', reciter_sub: 'Dieser Rezitator wird für die 🔊-Schaltflächen in der gesamten App verwendet',
    language_title: 'App-Sprache', language_sub: 'Diese Sprache wird für Übersetzungen und App-Texte verwendet',
    theme_title: 'Erscheinungsbild', theme_sub: 'Wähle, wie die App aussieht', theme_light: 'Hell', theme_dark: 'Dunkel',
    data_privacy: 'Daten & Datenschutz', data_privacy_sub_cloud: 'Dein Fortschritt wird jetzt in der Cloud gespeichert — geräteübergreifend synchronisiert', data_privacy_sub_guest: 'Dein Übungsverlauf wird nur auf diesem Gerät (Browser) gespeichert',
    clear_history: 'Fortschrittsverlauf Löschen', logout: 'Abmelden',
    login_title: 'Anmelden', signup_title: 'Neues Konto Erstellen', login_subtitle: 'Melde dich an, um deinen Fortschritt und deine Einstellungen auf allen Geräten zu synchronisieren',
    email_label: 'E-Mail', password_label: 'Passwort (mindestens 6 Zeichen)', name_label: 'Dein Name',
    login_btn: 'Anmelden', signup_btn: 'Registrieren', or_divider: '— oder —', google_login: 'Mit Google fortfahren',
    no_account: 'Kein Konto?', have_account: 'Bereits ein Konto?',
  },
  ru: {
    nav_home: 'Главная', nav_learn: 'Учиться', nav_recite: 'Чтение', nav_progress: 'Прогресс', nav_profile: 'Профиль',
    header_home: 'Таджвид ИИ', header_recite: 'Практика Чтения', header_learn: 'Изучение Таджвида', header_progress: 'Мой Прогресс', header_profile: 'Профиль и Настройки',
    home_greeting: 'Добро пожаловать!', home_subtitle: 'Улучшите своё чтение сегодня, с правильным таджвидом.',
    ayah_of_day: 'Аят Дня', practice_this_surah: 'Практиковать эту суру →', ayaat_practiced: 'Проработанные аяты (в этой суре)', avg_accuracy: 'Средняя Точность',
    action_recite_title: 'Практика Чтения', action_recite_sub: 'Проверьте свой таджвид с ИИ',
    action_learn_title: 'Изучить Правила Таджвида', action_learn_sub: 'Все правила с аудио, на вашем языке',
    loading: 'Загрузка...', continue_practice: 'Продолжить Практику',
    streak_label: 'Дней Подряд', overall_avg: 'Общее Среднее', best_score: 'Лучший Результат', week_performance: 'Результаты за Последние 7 Дней',
    recent_sessions: 'Недавние Сессии', no_sessions: 'Пока нет тренировочных сессий. Начните с вкладки Чтение! 🎤',
    guest_banner: 'Гостевой режим — эти данные только в этом браузере. Войдите, чтобы сохранить их навсегда.', login_cta: 'Войти →',
    reciter_title: 'Голос Чтеца', reciter_sub: 'Этот чтец будет использоваться для кнопок 🔊 во всём приложении',
    language_title: 'Язык Приложения', language_sub: 'Этот язык используется для переводов и текста приложения',
    theme_title: 'Внешний вид', theme_sub: 'Выберите, как выглядит приложение', theme_light: 'Светлая', theme_dark: 'Тёмная',
    data_privacy: 'Данные и Конфиденциальность', data_privacy_sub_cloud: 'Ваш прогресс теперь сохраняется в облаке — синхронизируется на всех устройствах', data_privacy_sub_guest: 'История ваших тренировок сохраняется только на этом устройстве (браузере)',
    clear_history: 'Очистить Историю Прогресса', logout: 'Выйти',
    login_title: 'Вход', signup_title: 'Создать Новый Аккаунт', login_subtitle: 'Войдите, чтобы синхронизировать свой прогресс и настройки на всех устройствах',
    email_label: 'Эл. почта', password_label: 'Пароль (минимум 6 символов)', name_label: 'Ваше имя',
    login_btn: 'Войти', signup_btn: 'Зарегистрироваться', or_divider: '— или —', google_login: 'Продолжить с Google',
    no_account: 'Нет аккаунта?', have_account: 'Уже есть аккаунт?',
  },
  zh: {
    nav_home: '首页', nav_learn: '学习', nav_recite: '诵读', nav_progress: '进度', nav_profile: '个人资料',
    header_home: '塔吉威德 AI', header_recite: '诵读练习', header_learn: '学习塔吉威德', header_progress: '我的进度', header_profile: '个人资料与设置',
    home_greeting: '欢迎！', home_subtitle: '今天就用正确的塔吉威德提升你的诵读。',
    ayah_of_day: '每日经文', practice_this_surah: '练习这一章 →', ayaat_practiced: '已练习的经文（本章）', avg_accuracy: '平均准确率',
    action_recite_title: '诵读练习', action_recite_sub: '用AI检查你的塔吉威德',
    action_learn_title: '学习塔吉威德规则', action_learn_sub: '所有规则均有音频，使用你的语言',
    loading: '加载中...', continue_practice: '继续练习',
    streak_label: '连续天数', overall_avg: '总体平均分', best_score: '最高分', week_performance: '过去7天的表现',
    recent_sessions: '最近的练习', no_sessions: '还没有练习记录。从诵读标签开始吧！🎤',
    guest_banner: '访客模式 — 此数据仅保存在此浏览器中。登录以永久保存。', login_cta: '登录 →',
    reciter_title: '诵读声音', reciter_sub: '此诵读者将用于应用中所有的 🔊 按钮',
    language_title: '应用语言', language_sub: '此语言将用于翻译和应用文本',
    theme_title: '外观', theme_sub: '选择应用的外观', theme_light: '浅色', theme_dark: '深色',
    data_privacy: '数据与隐私', data_privacy_sub_cloud: '你的进度现已保存在云端 — 可在所有设备间同步', data_privacy_sub_guest: '你的练习记录仅保存在此设备（浏览器）中',
    clear_history: '清除进度记录', logout: '退出登录',
    login_title: '登录', signup_title: '创建新账户', login_subtitle: '登录以在所有设备上同步你的进度和偏好设置',
    email_label: '电子邮箱', password_label: '密码（至少6个字符）', name_label: '你的名字',
    login_btn: '登录', signup_btn: '注册', or_divider: '— 或 —', google_login: '使用 Google 继续',
    no_account: '没有账户？', have_account: '已有账户？',
  },
  so: {
    nav_home: 'Guriga', nav_learn: 'Barasho', nav_recite: 'Akhrinta', nav_progress: 'Horumarka', nav_profile: 'Astaanta',
    header_home: 'Tajwiid AI', header_recite: 'Tababarka Akhrinta', header_learn: 'Baro Tajwiidka', header_progress: 'Horumarkayga', header_profile: 'Astaanta iyo Dejinta',
    home_greeting: 'Soo dhawoow!', home_subtitle: 'Maanta hagaaji akhriskaaga, adigoo isticmaalaya Tajwiid sax ah.',
    ayah_of_day: 'Aayadda Maanta', practice_this_surah: 'Ku tababaro suuradan →', ayaat_practiced: 'Aayadaha la tababaray (suuradan)', avg_accuracy: 'Sax-celceliska',
    action_recite_title: 'Tababarka Akhrinta', action_recite_sub: 'Hubi Tajwiidkaaga adigoo isticmaalaya AI',
    action_learn_title: 'Baro Xeerarka Tajwiidka', action_learn_sub: 'Dhammaan xeerarka oo leh cod, luqaddaada',
    loading: 'Waa la soo raraya...', continue_practice: 'Sii wad Tababarka',
    streak_label: 'Maalmo isku xigxiga', overall_avg: 'Celceliska Guud', best_score: 'Dhibcaha ugu fiican', week_performance: 'Waxqabadka 7-dii Maalmood ee la soo dhaafay',
    recent_sessions: 'Fadhiyadii Dhawaa', no_sessions: 'Wali ma jiro tababar. Ka bilow tab-ka Akhrinta! 🎤',
    guest_banner: 'Habka martida — xogtan waxaa lagu keydiyay browser-kan kaliya. Gal si aad si joogto ah u keydiso.', login_cta: 'Gal →',
    reciter_title: 'Codka Akhrinta', reciter_sub: 'Aqriyahan ayaa loo isticmaali doonaa badhamada 🔊 ee app-ka oo dhan',
    language_title: 'Luqadda App-ka', language_sub: 'Luqaddan waxaa loo isticmaali doonaa turjumaadda iyo qoraalka app-ka',
    theme_title: 'Muuqaalka', theme_sub: 'Dooro sida app-ku u eegayo', theme_light: 'Iftiin', theme_dark: 'Madow',
    data_privacy: 'Xogta iyo Sirta', data_privacy_sub_cloud: 'Horumarkaaga hadda waxaa lagu keydiyay daruurta — waxaana la isu geeynayaa dhammaan qalabka', data_privacy_sub_guest: 'Taariikhda tababarkaaga waxaa lagu keydiyay qalabkan kaliya (browser-ka)',
    clear_history: 'Tirtir Taariikhda Horumarka', logout: 'Ka bax',
    login_title: 'Gal', signup_title: 'Samee Akoon Cusub', login_subtitle: 'Gal si aad ugu isu geeyso horumarkaaga iyo doorbidyadaada qalab kasta',
    email_label: 'Iimayl', password_label: 'Furaha sirta ah (ugu yaraan 6 xaraf)', name_label: 'Magacaaga',
    login_btn: 'Gal', signup_btn: 'Isdiiwaangeli', or_divider: '— ama —', google_login: 'Ku sii wad Google',
    no_account: 'Ma haysid akoon?', have_account: 'Horey ma u yeelatay akoon?',
  },
};

// --- Progress history: localStorage mein practice sessions save karna (koi backend DB nahi hai) ---
const PROGRESS_KEY = 'tajweed_practice_history';
const RECITER_KEY = 'tajweed_preferred_reciter';
const TRANSLATION_KEY = 'tajweed_preferred_translation';
const THEME_KEY = 'tajweed_preferred_theme';

const loadProgressHistory = () => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

const saveProgressRecord = (record) => {
  try {
    const history = loadProgressHistory();
    history.push(record);
    const trimmed = history.slice(-200); // sirf recent 200 sessions rakhte hain
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.error("Progress save error", e);
    return loadProgressHistory();
  }
};

const computeStreak = (history) => {
  if (!history.length) return 0;
  const days = new Set(history.map(r => new Date(r.timestamp).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const getLast7DaysData = (history) => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayRecords = history.filter(r => new Date(r.timestamp).toDateString() === dayStr);
    const avg = dayRecords.length ? Math.round(dayRecords.reduce((s, r) => s + r.score, 0) / dayRecords.length) : 0;
    days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), avg, count: dayRecords.length });
  }
  return days;
};

// --- TAJWEED RULES DATABASE (bilingual: English + Urdu, with speakable text) ---
const TAJWEED_CATEGORIES = [
  {
    id: 'makharij',
    icon: '🗣️',
    title_en: 'Makharij-ul-Huroof (Articulation Points)',
    title_ur: 'مخارج الحروف',
    rules: [
      {
        id: 'makharij-intro',
        name_en: 'What are Makharij?',
        name_ur: 'مخارج کیا ہیں؟',
        name_ar: 'مخارج الحروف',
        desc_en: 'Makharij are the precise points in the mouth and throat from which each Arabic letter originates. There are five main regions: the open space of mouth and throat, the throat, the tongue, the two lips, and the nasal cavity. Saying every letter from its correct point is the foundation of correct Tajweed.',
        desc_ur: 'مخارج وہ مقامات ہیں جہاں سے ہر عربی حرف کی آواز نکلتی ہے۔ ان کے پانچ بڑے مقامات ہیں: خالی جگہ، حلق، زبان، دونوں ہونٹ، اور ناک کی گہا۔ ہر حرف کو اس کے صحیح مخرج سے ادا کرنا تجوید کی بنیاد ہے۔',
        example: 'ا ب ت',
      },
      {
        id: 'halq-letters',
        name_en: 'Throat Letters (Huroof-ul-Halq)',
        name_ur: 'حلقی حروف',
        name_ar: 'حروف الحلق',
        desc_en: 'Six letters come from the throat: Hamza and Ha from the deep throat, Ain and Ha from the middle throat, Ghain and Kha from the upper throat close to the mouth. Beginners often mispronounce these, so they need extra care.',
        desc_ur: 'چھ حروف حلق سے نکلتے ہیں: ء اور ہ حلق کے گہرے حصے سے، ع اور ح درمیانی حصے سے، غ اور خ اوپری حصے سے۔ نئے سیکھنے والے اکثر انہیں غلط ادا کرتے ہیں، اس لیے خاص توجہ درکار ہے۔',
        example: 'ء ه ع ح غ خ',
      },
    ],
  },
  {
    id: 'noon-tanween',
    icon: 'ن',
    title_en: 'Noon Sakinah & Tanween Rules',
    title_ur: 'نون ساکن اور تنوین کے احکام',
    rules: [
      {
        id: 'izhar',
        name_en: 'Izhar (Clear Pronunciation)',
        name_ur: 'اظہار',
        name_ar: 'الإظهار الحلقي',
        desc_en: 'When Noon Sakinah or Tanween is followed by one of the six throat letters, it is pronounced clearly, with no nasal Ghunnah merging into the next letter.',
        desc_ur: 'جب نون ساکن یا تنوین کے بعد حلق کے چھ حروف میں سے کوئی حرف آئے تو نون کو صاف اور واضح ادا کیا جاتا ہے، بغیر غنہ ملائے۔',
        example: 'مَنْ آمَنَ',
      },
      {
        id: 'idgham-ghunnah',
        name_en: 'Idgham with Ghunnah',
        name_ur: 'اِدغام بالغنہ',
        name_ar: 'الإدغام بغنة',
        desc_en: 'When Noon Sakinah or Tanween is followed by ya, noon, meem, or waw, the Noon sound merges into the next letter and is held with a nasal hum for about two counts.',
        desc_ur: 'جب نون ساکن یا تنوین کے بعد ی، ن، م یا و آئے تو نون کی آواز اگلے حرف میں مل جاتی ہے اور تقریباً دو حرکت کے لیے ناک سے غنہ کی آواز نکالی جاتی ہے۔',
        example: 'مَنْ يَقُولُ',
      },
      {
        id: 'idgham-no-ghunnah',
        name_en: 'Idgham without Ghunnah',
        name_ur: 'اِدغام بلاغنہ',
        name_ar: 'الإدغام بغير غنة',
        desc_en: 'When Noon Sakinah or Tanween is followed by laam or ra, it merges completely into the next letter with no nasal sound at all.',
        desc_ur: 'جب نون ساکن یا تنوین کے بعد ل یا ر آئے تو نون مکمل طور پر اگلے حرف میں مل جاتا ہے اور بالکل غنہ نہیں کیا جاتا۔',
        example: 'مِن رَّبِّهِمْ',
      },
      {
        id: 'iqlab',
        name_en: 'Iqlab (Conversion)',
        name_ur: 'اِقلاب',
        name_ar: 'الإقلاب',
        desc_en: 'When Noon Sakinah or Tanween is followed by the letter ba, its sound is converted into a light Meem sound with Ghunnah, and a small meem sign is written above it in the Mushaf.',
        desc_ur: 'جب نون ساکن یا تنوین کے بعد ب آئے تو نون کی آواز کو ہلکی میم میں بدل دیا جاتا ہے، ساتھ غنہ بھی ہوتا ہے، اور مصحف میں اس پر چھوٹی میم کا نشان لکھا ہوتا ہے۔',
        example: 'مِنْ بَعْدِ',
      },
      {
        id: 'ikhfa',
        name_en: 'Ikhfa (Concealment)',
        name_ur: 'اِخفاء',
        name_ar: 'الإخفاء الحقيقي',
        desc_en: 'When Noon Sakinah or Tanween is followed by any of the remaining fifteen letters, the Noon sound is concealed — neither fully clear nor fully merged — with a nasal Ghunnah held for about two counts.',
        desc_ur: 'جب نون ساکن یا تنوین کے بعد باقی پندرہ حروف میں سے کوئی حرف آئے تو نون کی آواز چھپا دی جاتی ہے — نہ مکمل ظاہر اور نہ مکمل اِدغام — اور تقریباً دو حرکت کے لیے غنہ کیا جاتا ہے۔',
        example: 'مِنْ ثَمَرَةٍ',
      },
    ],
  },
  {
    id: 'meem-sakinah',
    icon: 'م',
    title_en: 'Meem Sakinah Rules',
    title_ur: 'میم ساکن کے احکام',
    rules: [
      {
        id: 'ikhfa-shafawi', name_en: 'Ikhfa Shafawi', name_ur: 'اِخفائے شفوی', name_ar: 'الإخفاء الشفوي',
        desc_en: 'When Meem Sakinah is followed by ba, it is concealed with a light nasal Ghunnah, since both letters share the same lip articulation point.',
        desc_ur: 'جب میم ساکن کے بعد ب آئے تو اسے ہلکے غنہ کے ساتھ چھپا کر ادا کیا جاتا ہے، کیونکہ دونوں حروف کا مخرج ہونٹ ہے۔',
        example: 'تَرْمِيهِم بِحِجَارَةٍ',
      },
      {
        id: 'idgham-shafawi', name_en: 'Idgham Shafawi', name_ur: 'اِدغامِ شفوی', name_ar: 'الإدغام الشفوي',
        desc_en: 'When Meem Sakinah is followed by another Meem, the two merge into one Meem held with Ghunnah for about two counts.',
        desc_ur: 'جب میم ساکن کے بعد ایک اور میم آئے تو دونوں ایک میم میں مل جاتے ہیں اور تقریباً دو حرکت کے لیے غنہ کیا جاتا ہے۔',
        example: 'لَهُم مَّا يَشَاءُونَ',
      },
      {
        id: 'izhar-shafawi', name_en: 'Izhar Shafawi', name_ur: 'اِظہارِ شفوی', name_ar: 'الإظهار الشفوي',
        desc_en: 'When Meem Sakinah is followed by any letter other than ba or meem, it is pronounced clearly with the lips closed, and no Ghunnah is added.',
        desc_ur: 'جب میم ساکن کے بعد ب یا م کے علاوہ کوئی اور حرف آئے تو اسے ہونٹ بند کر کے واضح طور پر ادا کیا جاتا ہے، بغیر غنہ کے۔',
        example: 'أَنْعَمْتَ عَلَيْهِمْ',
      },
    ],
  },
  {
    id: 'qalqalah',
    icon: '🔊',
    title_en: 'Qalqalah (Echoing Sound)',
    title_ur: 'قلقلہ',
    rules: [
      {
        id: 'qalqalah-letters', name_en: 'The Five Qalqalah Letters', name_ur: 'قلقلہ کے پانچ حروف', name_ar: 'قطب جد',
        desc_en: 'The letters qaaf, taa, baa, jeem, and daal produce a slight bouncing echo whenever they carry a Sukoon, because air is momentarily trapped and then released at their articulation point.',
        desc_ur: 'حروف ق ط ب ج د جب ساکن ہوں تو ان سے ہلکی سی گونجدار آواز نکلتی ہے، کیونکہ ادائیگی کے وقت ہوا مخرج پر تھوڑی دیر رک کر پھر خارج ہوتی ہے۔',
        example: 'يَجْعَلُونَ',
      },
      {
        id: 'qalqalah-sughra-kubra', name_en: 'Qalqalah Sughra & Kubra', name_ur: 'قلقلہ صغریٰ و کبریٰ', name_ar: 'قلقلة صغرى وكبرى',
        desc_en: 'Qalqalah Sughra (minor) happens when the letter is sakin in the middle of a word — a light bounce. Qalqalah Kubra (major) happens when the letter becomes sakin at the end of a word because of stopping — a stronger, clearer bounce.',
        desc_ur: 'قلقلہ صغریٰ اس وقت ہوتا ہے جب یہ حرف لفظ کے درمیان میں ساکن ہو — ہلکی گونج۔ قلقلہ کبریٰ اس وقت ہوتا ہے جب وقف کی وجہ سے یہ حرف لفظ کے آخر میں ساکن ہو جائے — زیادہ مضبوط گونج۔',
        example: 'الْفَلَقْ',
      },
    ],
  },
  {
    id: 'ghunnah',
    icon: '👃',
    title_en: 'Ghunnah (Nasal Sound)',
    title_ur: 'غنہ',
    rules: [
      {
        id: 'ghunnah-mushaddad', name_en: 'Ghunnah on Mushaddad Noon/Meem', name_ur: 'نون اور میم مشدد پر غنہ', name_ar: 'غنة النون والميم المشددتين',
        desc_en: 'Whenever a Noon or Meem carries a Shaddah, a compulsory nasal Ghunnah is held for about two counts, produced entirely through the nose.',
        desc_ur: 'جب بھی نون یا میم پر شد ہو تو تقریباً دو حرکت کے لیے لازمی طور پر غنہ کیا جاتا ہے، جو مکمل طور پر ناک سے نکالی جاتی ہے۔',
        example: 'إِنَّ ثُمَّ',
      },
    ],
  },
  {
    id: 'madd',
    icon: '〰️',
    title_en: 'Madd (Elongation) Rules',
    title_ur: 'مدّ کے احکام',
    rules: [
      {
        id: 'madd-asli', name_en: 'Madd Asli / Tabee (Natural Madd)', name_ur: 'مدِ اصلی / طبیعی', name_ar: 'المد الطبيعي',
        desc_en: 'The basic elongation of two counts on alif, waw, or ya when they follow a matching short vowel, with no Hamza or Sukoon right after them.',
        desc_ur: 'جب الف، واو یا یا سے پہلے ان سے مناسبت رکھنے والی حرکت ہو اور بعد میں ہمزہ یا سکون نہ ہو تو دو حرکت تک بنیادی مد کی جاتی ہے۔',
        example: 'قَالَ',
      },
      {
        id: 'madd-muttasil', name_en: 'Madd Muttasil (Connected Madd)', name_ur: 'مدِ متصل', name_ar: 'المد المتصل',
        desc_en: 'When a Madd letter is followed by a Hamza within the same word, it must be elongated for four to five counts.',
        desc_ur: 'جب مد کا حرف اور ہمزہ ایک ہی لفظ میں اکٹھے آ جائیں تو اسے چار سے پانچ حرکت تک لازمی طور پر کھینچا جاتا ہے۔',
        example: 'السَّمَاءِ',
      },
      {
        id: 'madd-munfasil', name_en: 'Madd Munfasil (Separated Madd)', name_ur: 'مدِ منفصل', name_ar: 'المد المنفصل',
        desc_en: 'When a word ends with a Madd letter and the next word begins with a Hamza, it is elongated for four to five counts.',
        desc_ur: 'جب کسی لفظ کے آخر میں مد کا حرف ہو اور اگلا لفظ ہمزہ سے شروع ہو تو اسے چار سے پانچ حرکت تک کھینچا جاتا ہے۔',
        example: 'قُوا أَنفُسَكُمْ',
      },
      {
        id: 'madd-lazim', name_en: 'Madd Lazim (Necessary Madd)', name_ur: 'مدِ لازم', name_ar: 'المد اللازم',
        desc_en: 'When a Madd letter is followed by a permanent Sukoon or Shaddah in the same word, it must always be elongated for six counts — the longest and strictest Madd.',
        desc_ur: 'جب مد کے حرف کے بعد اسی لفظ میں مستقل سکون یا شد ہو تو اسے ہمیشہ چھ حرکت تک کھینچا جاتا ہے — یہ سب سے لمبا اور سخت مد ہے۔',
        example: 'الْحَاقَّةُ',
      },
      {
        id: 'madd-aarid', name_en: 'Madd Aarid Lissukoon (Madd due to Stopping)', name_ur: 'مدِ عارض للسکون', name_ar: 'المد العارض للسكون',
        desc_en: 'When stopping at the end of an ayah makes the last letter sakin, and a Madd letter comes right before it, the reciter may choose two, four, or six counts.',
        desc_ur: 'جب آیت کے آخر پر وقف کرنے سے آخری حرف ساکن ہو جائے اور اس سے پہلے مد کا حرف ہو تو قاری دو، چار یا چھ حرکت میں سے کسی کا انتخاب کر سکتا ہے۔',
        example: 'الرَّحِيمْ',
      },
      {
        id: 'madd-badal', name_en: 'Madd Badal (Substitute Madd)', name_ur: 'مدِ بدل', name_ar: 'مد البدل',
        desc_en: 'A Hamza is followed directly by a Madd letter with no Sukoon after it; it is elongated for the basic two counts.',
        desc_ur: 'جب ہمزہ کے بعد براہ راست مد کا حرف آئے اور اس کے بعد سکون نہ ہو تو بنیادی دو حرکت تک کھینچا جاتا ہے۔',
        example: 'آمَنُوا',
      },
    ],
  },
  {
    id: 'laam-ra',
    icon: 'ل',
    title_en: 'Laam & Ra Rules',
    title_ur: 'لام اور را کے احکام',
    rules: [
      {
        id: 'lafzul-jalalah', name_en: 'Lafzul Jalalah (The word Allah)', name_ur: 'لفظِ جلالہ', name_ar: 'تفخيم وترقيق لام لفظ الجلالة',
        desc_en: 'The Laam in the word Allah is pronounced heavy when it is preceded by a Fatha or Damma, and light when it is preceded by a Kasra.',
        desc_ur: 'لفظ اللہ میں لام کو بھاری پڑھا جاتا ہے جب اس سے پہلے زبر یا پیش ہو، اور ہلکا پڑھا جاتا ہے جب اس سے پہلے زیر ہو۔',
        example: 'قَالَ اللّٰهُ / بِاللّٰهِ',
      },
      {
        id: 'ra-tafkhim', name_en: 'Ra — Heavy (Tafkhim)', name_ur: 'را کی تفخیم', name_ar: 'تفخيم الراء',
        desc_en: 'The letter Ra is pronounced heavy when it carries a Fatha or Damma, or is sakin after a Fatha or Damma.',
        desc_ur: 'حرف را کو بھاری پڑھا جاتا ہے جب اس پر زبر یا پیش ہو، یا زبر یا پیش کے بعد ساکن ہو۔',
        example: 'رَبَّنَا',
      },
      {
        id: 'ra-tarqeeq', name_en: 'Ra — Light (Tarqeeq)', name_ur: 'را کی ترقیق', name_ar: 'ترقيق الراء',
        desc_en: 'The letter Ra is pronounced light when it carries a Kasra, or is sakin after a Kasra with no heavy letter following it.',
        desc_ur: 'حرف را کو ہلکا پڑھا جاتا ہے جب اس پر زیر ہو، یا زیر کے بعد ساکن ہو اور بعد میں کوئی بھاری حرف نہ ہو۔',
        example: 'مِرْيَةٍ',
      },
    ],
  },
  {
    id: 'idgham-general',
    icon: '🔗',
    title_en: 'General Idgham Types',
    title_ur: 'اِدغام کی عمومی اقسام',
    rules: [
      {
        id: 'mutamathilain', name_en: 'Idgham Mutamathilain (Identical Letters)', name_ur: 'اِدغامِ متماثلین', name_ar: 'إدغام المتماثلين',
        desc_en: 'Two identical letters occur in a row, the first sakin and the second moving; the two merge into one letter with a Shaddah.',
        desc_ur: 'جب دو ایک جیسے حروف اکٹھے آئیں، پہلا ساکن اور دوسرا متحرک، تو دونوں مل کر ایک حرف مشدد بن جاتے ہیں۔',
        example: 'اضْرِب بِّعَصَاكَ',
      },
      {
        id: 'mutajanisain', name_en: 'Idgham Mutajanisain (Same Articulation Point)', name_ur: 'اِدغامِ متجانسین', name_ar: 'إدغام المتجانسين',
        desc_en: 'Two different letters that share the same articulation point but differ in some characteristics merge into one.',
        desc_ur: 'دو مختلف حروف جن کا مخرج ایک ہو لیکن صفات میں فرق ہو، آپس میں مل کر ایک ہو جاتے ہیں۔',
        example: 'قَد تَّبَيَّنَ',
      },
      {
        id: 'mutaqaribain', name_en: 'Idgham Mutaqaribain (Close Articulation Points)', name_ur: 'اِدغامِ متقاربین', name_ar: 'إدغام المتقاربين',
        desc_en: 'Two letters with close but not identical articulation points and similar characteristics merge into one in specific recitation situations.',
        desc_ur: 'وہ دو حروف جن کے مخارج قریب قریب ہوں اور صفات بھی ملتی جلتی ہوں، مخصوص مواقع پر آپس میں مل جاتے ہیں۔',
        example: 'يَلْهَث ذَّلِكَ',
      },
    ],
  },
  {
    id: 'waqf',
    icon: '⏸️',
    title_en: 'Waqf (Stopping) Signs',
    title_ur: 'علاماتِ وقف',
    rules: [
      {
        id: 'waqf-lazim', name_en: 'Waqf Lazim — Compulsory Stop', name_ur: 'وقفِ لازم', name_ar: 'الوقف اللازم',
        desc_en: 'Marked with the letter meem, the reciter must stop here; continuing without pausing can change the meaning of the ayah.',
        desc_ur: 'اس مقام پر م کا نشان ہوتا ہے، یہاں رکنا لازمی ہے؛ بغیر رکے آگے پڑھنے سے معنی بدل سکتے ہیں۔',
        example: 'مـ',
      },
      {
        id: 'waqf-la', name_en: 'Laa — No Stop', name_ur: 'علامتِ لا', name_ar: 'لا الوقف',
        desc_en: 'Marked with laa, stopping here is not appropriate; the reciter should continue on to the next word.',
        desc_ur: 'اس نشان پر رکنا مناسب نہیں ہے؛ قاری کو اگلے لفظ کی طرف جاری رہنا چاہیے۔',
        example: 'لا',
      },
      {
        id: 'waqf-jaiz', name_en: 'Jeem — Permissible Stop', name_ur: 'وقفِ جائز', name_ar: 'الوقف الجائز',
        desc_en: 'Marked with jeem, both stopping and continuing are equally acceptable at this point.',
        desc_ur: 'اس نشان پر رکنا اور جاری رکھنا دونوں یکساں طور پر جائز ہیں۔',
        example: 'ج',
      },
      {
        id: 'waqf-qila', name_en: 'Qeela — Better to Stop', name_ur: 'وقفِ اولیٰ', name_ar: 'قلى',
        desc_en: 'Marked with qeela, stopping is preferred here, though continuing is also allowed.',
        desc_ur: 'اس نشان پر رکنا بہتر سمجھا جاتا ہے، اگرچہ جاری رکھنا بھی جائز ہے۔',
        example: 'قلى',
      },
      {
        id: 'waqf-sila', name_en: 'Sila — Better to Continue', name_ur: 'وقفِ غیر اولیٰ', name_ar: 'صلى',
        desc_en: 'Marked with sila, continuing without stopping is preferred here, though a pause is also allowed.',
        desc_ur: 'اس نشان پر جاری رکھنا بہتر سمجھا جاتا ہے، اگرچہ رکنا بھی جائز ہے۔',
        example: 'صلى',
      },
      {
        id: 'muanaqah', name_en: 'Muanaqah — Paired Stop Points', name_ur: 'معانقہ', name_ar: 'المعانقة',
        desc_en: 'Two sets of three dots appear close together at two nearby points; the reciter should stop at only one of the two, never both.',
        desc_ur: 'دو مقامات پر تین تین نقطوں کے جوڑے ہوتے ہیں؛ قاری کو ان میں سے صرف ایک جگہ رکنا چاہیے، دونوں جگہ نہیں۔',
        example: '∴ ∴',
      },
    ],
  },
  {
    id: 'sifaat',
    icon: '✨',
    title_en: 'Sifaat-ul-Huroof (Letter Characteristics)',
    title_ur: 'صفاتِ حروف',
    rules: [
      {
        id: 'hams-jahr', name_en: 'Hams & Jahr (Breath vs Voice)', name_ur: 'ہمس اور جہر', name_ar: 'الهمس والجهر',
        desc_en: 'Hams letters release extra breath because the vocal cords stay relaxed; Jahr letters are pronounced with the vocal cords vibrating fully, producing a stronger, clearer sound.',
        desc_ur: 'ہمس والے حروف میں آواز کی ڈوریاں ڈھیلی رہتی ہیں، اس لیے اضافی سانس نکلتی ہے؛ جہر والے حروف میں آواز کی ڈوریاں پوری طرح حرکت کرتی ہیں، جس سے مضبوط اور واضح آواز پیدا ہوتی ہے۔',
        example: 'ف ح ث ه ش خ ص س ك ت',
      },
      {
        id: 'shiddah-rakhawah', name_en: 'Shiddah, Tawassut & Rakhawah (Sound Flow)', name_ur: 'شدت، توسط اور رخاوت', name_ar: 'الشدة والتوسط والرخاوة',
        desc_en: 'Shiddah letters completely stop the airflow at their point of articulation. Rakhawah letters let the sound flow freely. Tawassut letters sit in between, with a partial stop.',
        desc_ur: 'شدت والے حروف میں مخرج پر ہوا مکمل طور پر رک جاتی ہے۔ رخاوت والے حروف میں آواز آزادانہ بہتی ہے۔ توسط والے حروف ان دونوں کے درمیان ہیں، جزوی رکاوٹ کے ساتھ۔',
        example: 'أ ج د ق ط ب ك ت',
      },
      {
        id: 'istila-istifal', name_en: "Isti'la & Istifal (Raised vs Lowered Tongue)", name_ur: 'استعلاء اور استفال', name_ar: 'الاستعلاء والاستفال',
        desc_en: "Isti'la letters are pronounced with the back of the tongue raised toward the roof of the mouth, giving a heavier sound. Istifal letters keep the tongue lowered, giving a lighter sound.",
        desc_ur: 'استعلاء والے حروف میں زبان کا پچھلا حصہ اوپر کی طرف اٹھتا ہے، جس سے آواز بھاری ہوتی ہے۔ استفال والے حروف میں زبان نیچے رہتی ہے، جس سے آواز ہلکی ہوتی ہے۔',
        example: 'خ ص ض غ ط ق ظ',
      },
      {
        id: 'safeer', name_en: 'Safeer (Whistling Sound)', name_ur: 'صفیر', name_ar: 'الصفير',
        desc_en: 'The letters Seen, Saad, and Zaa produce a sharp whistling sound as air is forced through a narrow gap between the tongue and the teeth.',
        desc_ur: 'س، ص اور ز حروف میں زبان اور دانتوں کے درمیان تنگ راستے سے ہوا گزرنے پر ایک تیز سیٹی جیسی آواز پیدا ہوتی ہے۔',
        example: 'س ص ز',
      },
      {
        id: 'leen', name_en: 'Leen (Soft Letters)', name_ur: 'حروفِ لین', name_ar: 'حروف اللين',
        desc_en: 'A sakin Waw or Ya preceded by a Fatha is pronounced softly and smoothly, without any strain, especially noticeable when stopping at the end of a word.',
        desc_ur: 'زبر کے بعد ساکن واو یا یا کو نرمی اور آسانی سے ادا کیا جاتا ہے، بغیر کسی دباؤ کے، خاص طور پر جب لفظ کے آخر پر وقف کیا جائے۔',
        example: 'خَوْف / بَيْت',
      },
    ],
  },
  {
    id: 'tafkhim-tarqeeq-general',
    icon: '⚖️',
    title_en: 'Tafkhim & Tarqeeq (Heavy vs Light Letters)',
    title_ur: 'تفخیم و ترقیق',
    rules: [
      {
        id: 'always-heavy', name_en: 'Always-Heavy Letters', name_ur: 'ہمیشہ بھاری حروف', name_ar: 'حروف التفخيم الدائم',
        desc_en: "The seven Isti'la letters are always pronounced heavy, with the back of the tongue raised, no matter what vowel they carry.",
        desc_ur: 'استعلاء کے سات حروف ہمیشہ بھاری ادا کیے جاتے ہیں، زبان کا پچھلا حصہ ہمیشہ اوپر اٹھا رہتا ہے، چاہے ان پر کوئی بھی حرکت ہو۔',
        example: 'خُصَّ ضَغْطٍ قِظ',
      },
      {
        id: 'always-light', name_en: 'Always-Light Letters', name_ur: 'ہمیشہ ہلکے حروف', name_ar: 'حروف الترقيق الدائم',
        desc_en: 'All the remaining Istifal letters are pronounced light and thin, with the tongue kept low, in every position.',
        desc_ur: 'باقی تمام استفال کے حروف ہمیشہ ہلکے اور پتلے ادا کیے جاتے ہیں، زبان ہمیشہ نیچے رہتی ہے، ہر حالت میں۔',
        example: 'ت ث ج د ذ',
      },
    ],
  },
  {
    id: 'special-rules',
    icon: '🧩',
    title_en: 'Special Recitation Rules',
    title_ur: 'قرات کے خصوصی قواعد',
    rules: [
      {
        id: 'saktah', name_en: 'Saktah (Brief Silent Pause)', name_ur: 'سکتہ', name_ar: 'السكتة',
        desc_en: 'A short pause without taking a fresh breath, held for about two counts at a few fixed places in the Quran, done to avoid confusion in meaning.',
        desc_ur: 'یہ ایک مختصر توقف ہے جس میں نیا سانس نہیں لیا جاتا، قرآن میں چند مقررہ مقامات پر تقریباً دو حرکت کے لیے کیا جاتا ہے، تاکہ معنی میں الجھن پیدا نہ ہو۔',
        example: 'عِوَجًا ۜ قَيِّمًا',
      },
      {
        id: 'imalah', name_en: 'Imalah (Vowel Tilting)', name_ur: 'اِمالہ', name_ar: 'الإمالة',
        desc_en: 'At one specific place in the Quran, a Fatha is tilted slightly toward a Kasra sound, softening the vowel rather than pronouncing it fully open.',
        desc_ur: 'قرآن میں ایک مخصوص مقام پر زبر کی آواز کو ہلکا سا زیر کی طرف جھکایا جاتا ہے، جس سے آواز نرم ہو جاتی ہے۔',
        example: 'مَجْرِيهَا',
      },
      {
        id: 'ishmam', name_en: 'Ishmam (Lip Gesture)', name_ur: 'اِشمام', name_ar: 'الإشمام',
        desc_en: 'While pronouncing a sakin letter, the lips are gently rounded as if hinting at a Damma, though no sound of Damma is actually produced.',
        desc_ur: 'ساکن حرف ادا کرتے وقت ہونٹوں کو ہلکا سا گول کیا جاتا ہے جیسے پیش کی طرف اشارہ ہو، حالانکہ پیش کی آواز حقیقت میں نہیں نکلتی۔',
        example: 'لَا تَأْمَنَّا',
      },
      {
        id: 'naql', name_en: 'Naql (Transferring a Vowel)', name_ur: 'نقل', name_ar: 'النقل',
        desc_en: 'The vowel of a Hamza is transferred onto the preceding sakin letter, and the Hamza itself is dropped, joining the two words smoothly.',
        desc_ur: 'ہمزہ کی حرکت کو اس سے پہلے والے ساکن حرف پر منتقل کر دیا جاتا ہے اور ہمزہ خود گرا دیا جاتا ہے، تاکہ دونوں الفاظ آسانی سے مل جائیں۔',
        example: 'مِنَ الِاسْمِ',
      },
    ],
  },
  {
    id: 'maraatib',
    icon: '⏱️',
    title_en: 'Maraatib (Speeds of Recitation)',
    title_ur: 'مراتبِ قرات',
    rules: [
      {
        id: 'tahqiq', name_en: 'Tahqiq (Very Slow, Precise)', name_ur: 'تحقیق', name_ar: 'التحقيق',
        desc_en: 'The slowest style, used mainly for teaching and learning, where every rule of Tajweed is applied with full precision and every Madd is held to its complete count.',
        desc_ur: 'یہ سب سے سست انداز ہے، عام طور پر سیکھنے سکھانے کے لیے استعمال ہوتا ہے، جس میں تجوید کے ہر قاعدے کو پوری باریکی سے لاگو کیا جاتا ہے اور ہر مد کو مکمل شمار تک کھینچا جاتا ہے۔',
        example: 'تعلیمی تلاوت',
      },
      {
        id: 'tadwir', name_en: 'Tadwir (Moderate Speed)', name_ur: 'تدویر', name_ar: 'التدوير',
        desc_en: 'A balanced, medium-paced style of recitation, faster than Tahqiq but slower than Hadr, commonly used by most reciters in daily recitation.',
        desc_ur: 'یہ ایک متوازن اور درمیانی رفتار کا انداز ہے، تحقیق سے تیز مگر حدر سے سست، اور زیادہ تر قاری اسے روزمرہ تلاوت میں استعمال کرتے ہیں۔',
        example: 'عام روزانہ تلاوت',
      },
      {
        id: 'hadr', name_en: 'Hadr (Fast Recitation)', name_ur: 'حدر', name_ar: 'الحدر',
        desc_en: 'A fast style of recitation used by those who have already memorized the Tajweed rules well, while still observing the essential rules like Madd and Ghunnah correctly.',
        desc_ur: 'یہ تیز رفتار انداز ہے جو ان قاریوں کے لیے مناسب ہے جو تجوید کے قواعد پر مکمل عبور رکھتے ہیں، پھر بھی مد اور غنہ جیسے بنیادی قواعد کا خیال رکھا جاتا ہے۔',
        example: 'حفاظ کی تیز تلاوت',
      },
    ],
  },
  {
    id: 'etiquette',
    icon: '🤲',
    title_en: 'Etiquette Before Recitation',
    title_ur: 'تلاوت سے پہلے کے آداب',
    rules: [
      {
        id: 'istiaza', name_en: "Isti'aza (Seeking Refuge)", name_ur: 'استعاذہ', name_ar: 'الاستعاذة',
        desc_en: 'Before starting recitation, the reciter says "A\'oozu Billahi minash Shaitanir Rajeem" to seek Allah\'s protection from Satan, as instructed in the Quran itself.',
        desc_ur: 'تلاوت شروع کرنے سے پہلے قاری "اعوذ باللہ من الشیطن الرجیم" پڑھتا ہے تاکہ اللہ کی پناہ شیطان سے حاصل کی جا سکے، جیسا کہ قرآن میں خود اس کا حکم دیا گیا ہے۔',
        example: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
      },
      {
        id: 'basmala', name_en: 'Basmala (Starting with Bismillah)', name_ur: 'بسملہ', name_ar: 'البسملة',
        desc_en: 'Reciters say "Bismillahir Rahmanir Raheem" at the start of every Surah except Surah At-Tawbah, seeking blessing before beginning the recitation.',
        desc_ur: 'سورہ توبہ کے علاوہ ہر سورت کے آغاز پر قاری "بسم اللہ الرحمن الرحیم" پڑھتے ہیں، تاکہ تلاوت شروع کرنے سے پہلے برکت حاصل ہو۔',
        example: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      },
    ],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState('Home');

  // Quran States
  const [surahs, setSurahs] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [ayahsList, setAyahsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAyah, setActiveAyah] = useState(null);

  // Audio (recording) States
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState(null); // POPUP STATE

  // Ayah recitation playback States
  const [playingAyah, setPlayingAyah] = useState(null);
  const [loadingAyahAudio, setLoadingAyahAudio] = useState(null);

  // Home Tab States
  const [dailyAyah, setDailyAyah] = useState(null);
  const [dailyAyahLoading, setDailyAyahLoading] = useState(true);

  // Progress & Profile Tab States
  const [progressHistory, setProgressHistory] = useState([]);
  const [reciter, setReciter] = useState(() => {
    try { return localStorage.getItem(RECITER_KEY) || 'ar.alafasy'; } catch (e) { return 'ar.alafasy'; }
  });
  const [translationLang, setTranslationLang] = useState(() => {
    try { return localStorage.getItem(TRANSLATION_KEY) || DEFAULT_TRANSLATION_CODE; } catch (e) { return DEFAULT_TRANSLATION_CODE; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  });

  // Poori app ki UI text isi function se aati hai — App Language ke hisab se
  const t = (key) => (UI_STRINGS[translationLang] && UI_STRINGS[translationLang][key]) || UI_STRINGS.en[key] || key;
  const isRTL = ['ur', 'ps', 'fa'].includes(translationLang);

  // Firebase Auth States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Learn Tab States
  const [activeCategory, setActiveCategory] = useState(TAJWEED_CATEGORIES[0].id);
  const [speakingKey, setSpeakingKey] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const ayahPlayerRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);

  useEffect(() => {
    // Ayah-recitation ke liye ek hi <audio> element reuse karte hain
    ayahPlayerRef.current = new Audio();
    const player = ayahPlayerRef.current;
    player.onended = () => setPlayingAyah(null);
    player.onerror = () => {
      setPlayingAyah(null);
      setLoadingAyahAudio(null);
    };
    return () => {
      player.pause();
      player.src = '';
    };
  }, []);

  // --- Best available Urdu/Arabic browser voice dhoondna ---
  const pickVoice = (langPrefix) => {
    if (!synthRef.current) return null;
    const voices = synthRef.current.getVoices() || [];
    return voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || null;
  };

  // --- Learn Tab: kisi bhi rule ke text/example ko bolna, dobara click par rokna ---
  const toggleSpeak = (key, text, lang, rate = 1) => {
    if (!synthRef.current || !text) return;
    if (speakingKey === key) {
      synthRef.current.cancel();
      setSpeakingKey(null);
      return;
    }
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    const voice = pickVoice(lang.split('-')[0]);
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.onend = () => setSpeakingKey(null);
    utter.onerror = () => setSpeakingKey(null);
    synthRef.current.speak(utter);
    setSpeakingKey(key);
  };

  useEffect(() => {
    // Kuch browsers voices ko async load karte hain, unhein warm-up kar dete hain
    if (synthRef.current) synthRef.current.getVoices();
  }, []);

  useEffect(() => {
    // Tab badalte hi koi bhi chal rahi awaaz (rule ya feedback) rok dena
    if (synthRef.current) synthRef.current.cancel();
    setSpeakingKey(null);
  }, [activeTab]);

  // --- Firebase Auth listener: user login/logout track karna ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Progress history: agar login hai toh Firestore se realtime, warna localStorage (guest) se ---
  useEffect(() => {
    if (!user) {
      setProgressHistory(loadProgressHistory());
      return;
    }

    // Login hote hi saved reciter/translation/theme preference Firestore se utha lein
    const loadPreferences = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          if (snap.data().reciter) setReciter(snap.data().reciter);
          if (snap.data().translationLang) setTranslationLang(snap.data().translationLang);
          if (snap.data().theme) setTheme(snap.data().theme);
        }
      } catch (e) { console.error("Preferences load error:", e); }
    };
    loadPreferences();

    // Practice history par realtime listener (naya session save hote hi UI khud update ho jayegi)
    const q = query(
      collection(db, 'users', user.uid, 'practice_history'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); // ascending order
      setProgressHistory(records);
    }, (error) => {
      console.error("Progress listener error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Reciter preference save karna: login hai toh Firestore mein, warna localStorage mein ---
  useEffect(() => {
    if (user) {
      setDoc(doc(db, 'users', user.uid), { reciter }, { merge: true }).catch(e => console.error("Reciter save error:", e));
    } else {
      try { localStorage.setItem(RECITER_KEY, reciter); } catch (e) { /* ignore */ }
    }
  }, [reciter, user]);

  // --- Translation/App language preference save karna: login hai toh Firestore mein, warna localStorage mein ---
  useEffect(() => {
    if (user) {
      setDoc(doc(db, 'users', user.uid), { translationLang }, { merge: true }).catch(e => console.error("Translation pref save error:", e));
    } else {
      try { localStorage.setItem(TRANSLATION_KEY, translationLang); } catch (e) { /* ignore */ }
    }
  }, [translationLang, user]);

  // --- Theme (light/dark) save karna: guest ho ya login, dono ke liye kaam karta hai ---
  useEffect(() => {
    if (user) {
      setDoc(doc(db, 'users', user.uid), { theme }, { merge: true }).catch(e => console.error("Theme save error:", e));
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    // Body ka background bhi theme ke sath sync karte hain (app-shell ke bahar ka hissa)
    try { document.body.style.backgroundColor = theme === 'dark' ? '#0F1712' : '#FAF8F5'; } catch (e) { /* ignore */ }
  }, [theme, user]);


  useEffect(() => {
    const fetchSurahsList = async () => {
      try {
        const response = await fetch("https://api.alquran.cloud/v1/surah");
        const data = await response.json();
        setSurahs(data.data);
      } catch (error) { console.error("Error fetching surahs"); }
    };
    fetchSurahsList();
  }, []);

  const [dailyAyahNumber, setDailyAyahNumber] = useState(() => Math.floor(Math.random() * 6236) + 1);

  useEffect(() => {
    // Home tab ke liye ek random "Ayah of the Day" (Arabic + selected language ka translation)
    const fetchDailyAyah = async () => {
      setDailyAyahLoading(true);
      const selectedEdition = TRANSLATIONS.find(t => t.code === translationLang)?.edition || 'en.sahih';

      const tryFetch = async (edition) => {
        const response = await fetch(`https://api.alquran.cloud/v1/ayah/${dailyAyahNumber}/editions/quran-uthmani,${edition}`);
        const data = await response.json();
        const arabicEd = data.data.find(d => d.edition.identifier === 'quran-uthmani');
        const translationEd = data.data.find(d => d.edition.identifier === edition);
        if (!arabicEd || !translationEd) throw new Error('Edition not found');
        return { arabicEd, translationEd };
      };

      try {
        let result;
        try {
          result = await tryFetch(selectedEdition);
        } catch (e) {
          // Agar selected language ki translation edition na milay, English par wapas chale jayein
          if (selectedEdition !== 'en.sahih') {
            result = await tryFetch('en.sahih');
          } else {
            throw e;
          }
        }
        const { arabicEd, translationEd } = result;
        setDailyAyah({
          number: arabicEd.number,
          text: arabicEd.text,
          translation: translationEd.text,
          surahName: arabicEd.surah.englishName,
          surahNumber: arabicEd.surah.number,
          numberInSurah: arabicEd.numberInSurah,
        });
      } catch (error) { console.error("Error fetching daily ayah:", error); }
      finally { setDailyAyahLoading(false); }
    };
    fetchDailyAyah();
  }, [dailyAyahNumber, translationLang]);

  useEffect(() => {
    const fetchFullSurah = async () => {
      setIsLoading(true); setSessionFeedback(null); setActiveAyah(null);
      if (ayahPlayerRef.current) { ayahPlayerRef.current.pause(); }
      setPlayingAyah(null);
      try {
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}`);
        const data = await response.json();
        const formattedAyahs = data.data.ayahs.map(ayah => ({
          ...ayah, score: null,
          words: ayah.text.split(/\s+/).filter(Boolean).map((w, index) => ({ id: `${ayah.numberInSurah}-${index}`, text: w, status: "pending" }))
        }));
        setAyahsList(formattedAyahs);
      } catch (error) { console.error("Error fetching ayahs"); }
      finally { setIsLoading(false); }
    };
    fetchFullSurah();
  }, [selectedSurah]);

  // --- Shared helper: kisi bhi ayah ki recitation chalana, agar ek bitrate na chale toh doosra try karna ---
  // (Kuch reciters — jaise Abdul Basit, As-Sudais — har bitrate par available nahi hotay, is liye fallback zaroori hai)
  const playRecitationAudio = (globalAyahNumber, stateKey) => {
    const player = ayahPlayerRef.current;
    if (!player) return;

    if (playingAyah === stateKey) {
      player.pause();
      setPlayingAyah(null);
      return;
    }

    player.pause();
    setPlayingAyah(null);
    setLoadingAyahAudio(stateKey);

    let bitrateIdx = 0;

    const tryNextBitrate = () => {
      if (bitrateIdx >= AUDIO_BITRATE_FALLBACKS.length) {
        setLoadingAyahAudio(null);
        alert("Is reciter ki audio filhaal load nahi ho pa rahi. Profile se koi doosra reciter try karein.");
        return;
      }
      const bitrate = AUDIO_BITRATE_FALLBACKS[bitrateIdx];
      player.src = ayahAudioUrl(globalAyahNumber, reciter, bitrate);
      player.play().catch(() => {
        bitrateIdx += 1;
        tryNextBitrate();
      });
    };

    player.oncanplay = () => {
      setLoadingAyahAudio(null);
      setPlayingAyah(stateKey);
    };
    player.onerror = () => {
      bitrateIdx += 1;
      tryNextBitrate();
    };

    tryNextBitrate();
  };

  // --- Home tab: Ayah of the Day ko sunana ---
  const playDailyAyahAudio = () => {
    if (!dailyAyah) return;
    playRecitationAudio(dailyAyah.number, 'daily');
  };

  // --- Speaker button: selected ayah ko tajweed ke sath sunata hai ---
  const playAyahRecitation = (ayah) => {
    playRecitationAudio(ayah.number, ayah.numberInSurah);
  };

  // --- Recording ke baad backend se result process karna ---
  const sendAudioToBackend = async (audioBlob) => {
    setIsAnalyzing(true); setSessionFeedback(null);

    // Sirf focus-mode wali ayah, warna poori surah check hogi
    const ayahsToCheck = activeAyah !== null
      ? ayahsList.filter(a => a.numberInSurah === activeAyah)
      : ayahsList;

    const expectedWordsFlat = ayahsToCheck.flatMap(a => a.words.map(w => w.text));
    const wordCountsPerAyah = ayahsToCheck.map(a => a.words.length);

    const formData = new FormData();
    formData.append("audio", audioBlob, "tilawat.wav");
    formData.append("expected_text", expectedWordsFlat.join(" "));

    try {
      const response = await fetch("https://quran-ai-g9mz.onrender.com/api/analyze-audio", { method: "POST", body: formData });
      const data = await response.json();

      if (data.status === "success") {
        const flatResults = data.word_results || [];

        // Backend se aaye flat word_results ko wapas har ayah mein slice karna
        let cursor = 0;
        const resultsByAyah = {};
        ayahsToCheck.forEach((ayah, idx) => {
          const count = wordCountsPerAyah[idx];
          resultsByAyah[ayah.numberInSurah] = flatResults.slice(cursor, cursor + count);
          cursor += count;
        });

        setAyahsList(prevAyahs => prevAyahs.map(ayah => {
          const sliceResults = resultsByAyah[ayah.numberInSurah];
          if (!sliceResults) return ayah;

          const updatedWords = ayah.words.map((word, idx) => {
            const r = sliceResults[idx];
            return r ? { ...word, status: r.status } : word;
          });

          const correctCount = updatedWords.filter(w => w.status === 'correct').length;
          const ayahAccuracy = updatedWords.length > 0
            ? Math.round((correctCount / updatedWords.length) * 100)
            : ayah.score;

          return { ...ayah, words: updatedWords, score: ayahAccuracy };
        }));

        const finalAccuracy = typeof data.score === 'number' ? data.score : 0;

        const record = {
          timestamp: Date.now(),
          surahNumber: selectedSurah,
          surahName: surahs.find(s => s.number === selectedSurah)?.englishName || `Surah ${selectedSurah}`,
          score: finalAccuracy,
          ayahCount: ayahsToCheck.length,
        };

        if (user) {
          // Firestore mein save — onSnapshot listener khud progressHistory update kar dega
          addDoc(collection(db, 'users', user.uid, 'practice_history'), record).catch(e => console.error("Firestore save error:", e));
        } else {
          const updatedHistory = saveProgressRecord(record);
          setProgressHistory(updatedHistory);
        }

        setSessionFeedback({
          textHeard: data.recognized_text,
          score: finalAccuracy,
          remarks: finalAccuracy === 100
            ? "Masha'Allah! Perfect Tajweed 🌟"
            : (finalAccuracy >= 60 ? "Good Try! Need minor fixes 👍" : "Needs Tajweed Improvement 📖"),
          tajweedFeedback: data.tajweed_feedback || [],
        });

      } else {
        setSessionFeedback({ textHeard: "Aawaz saaf nahi aayi...", score: 0, remarks: "Please try again.", tajweedFeedback: [] });
      }
    } catch (error) { alert("Backend connection error!"); }
    finally { setIsAnalyzing(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        sendAudioToBackend(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true); setSessionFeedback(null);
    } catch (err) { alert("Microphone permission required!"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // --- LEARN TAB: Bilingual Tajweed rules, listenable in English/Urdu, with Arabic examples ---
  const renderLearnTab = () => {
    const currentCategory = TAJWEED_CATEGORIES.find(c => c.id === activeCategory) || TAJWEED_CATEGORIES[0];
    return (
      <div style={{ paddingBottom: '120px', animation: 'slideUp 0.4s' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px' }}>
          {TAJWEED_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: '20px',
                border: activeCategory === cat.id ? '2px solid #16A34A' : '1px solid var(--border-color)',
                backgroundColor: activeCategory === cat.id ? 'var(--accent-soft)' : 'var(--card-bg)',
                color: 'var(--text-heading)', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {cat.icon} {cat.title_en}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-heading)' }}>{currentCategory.title_en}</div>
          <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{currentCategory.title_ur}</div>
        </div>

        <div className="grid-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {currentCategory.rules.map(rule => {
            const enKey = `${rule.id}-en`;
            const urKey = `${rule.id}-ur`;
            const arKey = `${rule.id}-ar`;
            return (
              <div key={rule.id} style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-heading)', fontSize: '16px' }}>{rule.name_en}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{rule.name_ur}</div>
                  </div>
                  <strong style={{ fontFamily: '"Traditional Arabic", serif', fontSize: '22px', color: '#16A34A', flexShrink: 0 }}>{rule.name_ar}</strong>
                </div>

                <p style={{ fontSize: '14px', color: 'var(--text-body)', lineHeight: '1.6', marginBottom: '8px' }}>{rule.desc_en}</p>
                <p dir="rtl" style={{ fontSize: '14px', color: 'var(--text-body)', lineHeight: '1.8', marginBottom: '12px', textAlign: 'right' }}>{rule.desc_ur}</p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' }}>
                  <span style={{ fontFamily: '"Traditional Arabic", serif', fontSize: '22px', color: 'var(--text-heading)' }}>{rule.example}</span>
                  <button
                    className={`speaker-btn ${speakingKey === arKey ? 'playing' : ''}`}
                    onClick={() => toggleSpeak(arKey, rule.example, 'ar-SA', 0.8)}
                    title="Misaal suniye"
                  >
                    🕌
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => toggleSpeak(enKey, rule.desc_en, 'en-US')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: speakingKey === enKey ? '#1B4332' : 'var(--track-bg)', color: speakingKey === enKey ? 'white' : 'var(--text-heading)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🔊 {speakingKey === enKey ? 'Stop' : 'Listen English'}
                  </button>
                  <button
                    onClick={() => toggleSpeak(urKey, rule.desc_ur, 'ur-PK')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: speakingKey === urKey ? '#1B4332' : 'var(--track-bg)', color: speakingKey === urKey ? 'white' : 'var(--text-heading)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🔊 {speakingKey === urKey ? 'روکیں' : 'اردو سنیں'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- HOME TAB: greeting, Ayah of the Day, quick stats, quick actions ---
  const renderHomeTab = () => {
    const practicedCount = ayahsList.filter(a => a.score !== null).length;
    const avgScore = practicedCount > 0
      ? Math.round(ayahsList.filter(a => a.score !== null).reduce((sum, a) => sum + a.score, 0) / practicedCount)
      : null;
    const isDailyPlaying = playingAyah === 'daily';
    const isDailyLoading = loadingAyahAudio === 'daily';

    const goToSurah = (surahNumber) => {
      setSelectedSurah(surahNumber);
      setActiveTab('Quran');
    };

    return (
      <div style={{ paddingBottom: '120px', animation: 'slideUp 0.4s' }}>
        <div style={{ backgroundColor: '#1B4332', borderRadius: '20px', padding: '25px 20px', color: 'white', marginBottom: '15px' }}>
          <div style={{ fontFamily: '"Traditional Arabic", serif', fontSize: '18px', opacity: 0.9 }}>السَّلَامُ عَلَيْكُمْ</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '6px' }}>{t('home_greeting')} 🌙</div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>{t('home_subtitle')}</div>
        </div>

        {/* Ayah of the Day */}
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>📖 {t('ayah_of_day')}</span>
            {dailyAyah && (
              <button
                className={`speaker-btn ${isDailyPlaying ? 'playing' : ''} ${isDailyLoading ? 'loading' : ''}`}
                onClick={playDailyAyahAudio}
                title={t('ayah_of_day')}
              >
                {isDailyLoading ? '⏳' : (isDailyPlaying ? '⏸' : '🔊')}
              </button>
            )}
          </div>

          {dailyAyahLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '15px', fontSize: '13px' }}>{t('loading')}</div>
          ) : dailyAyah ? (
            <>
              <div style={{ fontFamily: '"Traditional Arabic", serif', fontSize: '26px', textAlign: 'right', color: 'var(--text-heading)', lineHeight: '1.9', marginBottom: '10px' }}>{dailyAyah.text}</div>
              <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontSize: '13px', color: 'var(--text-body)', fontStyle: 'italic', marginBottom: '8px' }}>"{dailyAyah.translation}"</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{dailyAyah.surahName} — {dailyAyah.surahNumber}:{dailyAyah.numberInSurah}</div>
              <button
                onClick={() => goToSurah(dailyAyah.surahNumber)}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: '#F0FDF4', color: '#166534', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                {t('practice_this_surah')}
              </button>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</div>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
          <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '15px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-heading)' }}>{practicedCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('ayaat_practiced')}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '15px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-heading)' }}>{avgScore !== null ? `${avgScore}%` : '—'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('avg_accuracy')}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => setActiveTab('Quran')} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: '26px' }}>🎤</span>
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--text-heading)', fontSize: '14px' }}>{t('action_recite_title')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('action_recite_sub')}</div>
            </div>
          </button>
          <button onClick={() => setActiveTab('Learn')} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: '26px' }}>📖</span>
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--text-heading)', fontSize: '14px' }}>{t('action_learn_title')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('action_learn_sub')}</div>
            </div>
          </button>
        </div>
      </div>
    );
  };

  // --- PROGRESS TAB: practice history, streak, weekly chart, recent sessions ---
  const renderProgressTab = () => {
    const totalSessions = progressHistory.length;
    const overallAvg = totalSessions > 0
      ? Math.round(progressHistory.reduce((s, r) => s + r.score, 0) / totalSessions)
      : null;
    const bestScore = totalSessions > 0 ? Math.max(...progressHistory.map(r => r.score)) : null;
    const streak = computeStreak(progressHistory);
    const weekData = getLast7DaysData(progressHistory);
    const recentSessions = [...progressHistory].reverse().slice(0, 10);

    return (
      <div style={{ paddingBottom: '120px', animation: 'slideUp 0.4s' }}>
        {!user && (
          <div
            onClick={() => setActiveTab('Profile')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '12px 14px', marginBottom: '15px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '12px', color: '#92400E' }}>👤 {t('guest_banner')}</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400E' }}>{t('login_cta')}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
          <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '15px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-heading)' }}>{streak} 🔥</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('streak_label')}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '15px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-heading)' }}>{overallAvg !== null ? `${overallAvg}%` : '—'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('overall_avg')}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '15px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-heading)' }}>{bestScore !== null ? `${bestScore}%` : '—'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('best_score')}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '15px' }}>{t('week_performance')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100px', gap: '8px' }}>
            {weekData.map((day, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '100%', height: '75px', display: 'flex', alignItems: 'flex-end', backgroundColor: 'var(--track-bg)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: '100%',
                    height: `${day.count > 0 ? Math.max(day.avg, 6) : 0}%`,
                    backgroundColor: day.avg >= 80 ? '#16A34A' : day.avg >= 60 ? '#F59E0B' : (day.count > 0 ? '#EF4444' : 'transparent'),
                    transition: 'height 0.4s',
                  }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('recent_sessions')}</div>
          {recentSessions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>
              {t('no_sessions')}
            </div>
          ) : (
            <div className="grid-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentSessions.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-heading)' }}>{r.surahName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(r.timestamp).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: r.score >= 80 ? '#dcfce7' : (r.score >= 60 ? '#fef9c3' : '#fee2e2'), color: r.score >= 80 ? '#166534' : (r.score >= 60 ? '#854d0e' : '#991b1b') }}>
                    {r.score}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- PROFILE TAB: reciter preference + settings ---
  const renderProfileTab = () => {
    const totalAyaatAllTime = progressHistory.reduce((sum, r) => sum + (r.ayahCount || 0), 0);
    const inputStyle = { padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: 'var(--bg-app)', color: 'var(--text-body)' };

    const handleEmailAuth = async (e) => {
      e.preventDefault();
      setAuthError('');
      setAuthSubmitting(true);
      try {
        if (authMode === 'signup') {
          const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
          if (authName) await updateProfile(cred.user, { displayName: authName });
        } else {
          await signInWithEmailAndPassword(auth, authEmail, authPassword);
        }
      } catch (err) {
        setAuthError((err.message || 'Something went wrong').replace('Firebase: ', ''));
      } finally {
        setAuthSubmitting(false);
      }
    };

    const handleGoogleAuth = async () => {
      setAuthError('');
      setAuthSubmitting(true);
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        setAuthError((err.message || 'Google login failed').replace('Firebase: ', ''));
      } finally {
        setAuthSubmitting(false);
      }
    };

    const handleLogout = async () => {
      try { await signOut(auth); } catch (err) { console.error(err); }
    };

    const clearProgressHistory = async () => {
      if (!window.confirm("Are you sure you want to delete all your practice history? This cannot be undone.")) return;
      if (user) {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'practice_history'));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        } catch (e) { console.error("Clear history error:", e); }
      } else {
        try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* ignore */ }
      }
      setProgressHistory([]);
    };

    if (authLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          {t('loading')}
        </div>
      );
    }

    // --- Reciter / Language / Theme: guest ho ya login, sabko available ---
    const settingsSection = (
      <>
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-heading)', marginBottom: '4px' }}>{t('reciter_title')}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('reciter_sub')}</div>
          <div className="grid-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {RECITERS.map(r => (
              <button
                key={r.id}
                onClick={() => setReciter(r.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  border: reciter === r.id ? '2px solid #16A34A' : '1px solid var(--border-color)',
                  backgroundColor: reciter === r.id ? 'var(--accent-soft)' : 'var(--bg-app)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-heading)' }}>{r.name_en}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.name_ur}</div>
                </div>
                {reciter === r.id && <span style={{ color: '#16A34A', fontSize: '18px', fontWeight: 'bold' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-heading)', marginBottom: '4px' }}>{t('language_title')}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('language_sub')}</div>
          <div className="grid-list grid-list-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TRANSLATIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => setTranslationLang(lang.code)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                  padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  flex: '1 1 140px', minWidth: '140px',
                  border: translationLang === lang.code ? '2px solid #16A34A' : '1px solid var(--border-color)',
                  backgroundColor: translationLang === lang.code ? 'var(--accent-soft)' : 'var(--bg-app)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-heading)' }}>
                  {lang.name_en} {translationLang === lang.code && <span style={{ color: '#16A34A' }}>✓</span>}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lang.name_native}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-heading)', marginBottom: '4px' }}>{t('theme_title')}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('theme_sub')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setTheme('light')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: theme === 'light' ? '2px solid #16A34A' : '1px solid var(--border-color)', backgroundColor: theme === 'light' ? 'var(--accent-soft)' : 'var(--bg-app)', color: 'var(--text-heading)', fontWeight: 'bold', fontSize: '13px' }}
            >
              ☀️ {t('theme_light')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: theme === 'dark' ? '2px solid #16A34A' : '1px solid var(--border-color)', backgroundColor: theme === 'dark' ? 'var(--accent-soft)' : 'var(--bg-app)', color: 'var(--text-heading)', fontWeight: 'bold', fontSize: '13px' }}
            >
              🌙 {t('theme_dark')}
            </button>
          </div>
        </div>
      </>
    );

    // --- User logged in nahi hai: account header ki jagah login/signup form, phir settings ---
    if (!user) {
      return (
        <div style={{ paddingBottom: '120px', animation: 'slideUp 0.4s' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '25px 20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px' }}>🔐</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-heading)', marginTop: '8px' }}>
                {authMode === 'login' ? t('login_title') : t('signup_title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {t('login_subtitle')}
              </div>
            </div>

            <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {authMode === 'signup' && (
                <input type="text" placeholder={t('name_label')} value={authName} onChange={(e) => setAuthName(e.target.value)} style={inputStyle} />
              )}
              <input type="email" required placeholder={t('email_label')} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={inputStyle} />
              <input type="password" required placeholder={t('password_label')} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={inputStyle} />

              {authError && <div style={{ color: '#EF4444', fontSize: '12px', textAlign: 'center' }}>{authError}</div>}

              <button type="submit" disabled={authSubmitting} style={{ backgroundColor: '#1B4332', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginTop: '4px' }}>
                {authSubmitting ? '...' : (authMode === 'login' ? t('login_btn') : t('signup_btn'))}
              </button>
            </form>

            <div style={{ textAlign: 'center', margin: '15px 0', color: 'var(--text-muted)', fontSize: '12px' }}>{t('or_divider')}</div>

            <button
              onClick={handleGoogleAuth}
              disabled={authSubmitting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-heading)', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
            >
              🔵 {t('google_login')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--text-body)' }}>
              {authMode === 'login' ? (
                <span>{t('no_account')}{' '}
                  <span onClick={() => { setAuthError(''); setAuthMode('signup'); }} style={{ color: '#16A34A', fontWeight: 'bold', cursor: 'pointer' }}>{t('signup_btn')}</span>
                </span>
              ) : (
                <span>{t('have_account')}{' '}
                  <span onClick={() => { setAuthError(''); setAuthMode('login'); }} style={{ color: '#16A34A', fontWeight: 'bold', cursor: 'pointer' }}>{t('login_btn')}</span>
                </span>
              )}
            </div>
          </div>

          {settingsSection}

          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-heading)', marginBottom: '4px' }}>{t('data_privacy')}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('data_privacy_sub_guest')}</div>
            <button
              onClick={clearProgressHistory}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#991B1B', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
            >
              🗑️ {t('clear_history')}
            </button>
          </div>
        </div>
      );
    }

    // --- User logged in hai: account header, phir settings, phir data/logout ---
    return (
      <div style={{ paddingBottom: '120px', animation: 'slideUp 0.4s' }}>
        <div style={{ backgroundColor: '#1B4332', borderRadius: '20px', padding: '25px 20px', color: 'white', marginBottom: '15px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>👤</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{user.displayName || user.email}</div>
          {user.displayName && <div style={{ fontSize: '12px', opacity: 0.75 }}>{user.email}</div>}
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>{totalAyaatAllTime} — {t('ayaat_practiced')}</div>
        </div>

        {settingsSection}

        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-heading)', marginBottom: '4px' }}>{t('data_privacy')}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('data_privacy_sub_cloud')}</div>
          <button
            onClick={clearProgressHistory}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#991B1B', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            🗑️ {t('clear_history')}
          </button>
        </div>

        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-body)', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
        >
          {t('logout')}
        </button>
      </div>
    );
  };

  // --- CORE FEATURE VIEW (QURAN AI TAB ONLY) ---
  const renderQuranTab = () => (
    <div style={{ paddingBottom: '180px', animation: 'slideUp 0.4s' }}>
      <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '20px', marginBottom: '15px' }}>
        <select value={selectedSurah} onChange={(e) => setSelectedSurah(Number(e.target.value))} style={{ padding: '12px', fontSize: '16px', borderRadius: '10px', width: '100%', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', fontWeight: 'bold', color: 'var(--text-heading)' }}>
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.englishName}</option>)}
        </select>
      </div>

      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
        {activeAyah ? `Focus Mode: Recording Ayah ${activeAyah} only. Tap again to cancel.` : `Tap any Ayah to focus, or record to evaluate all. Speaker icon se sahi tajweed sunein.`}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-heading)', fontWeight: 'bold' }}>Surah load ho rahi hai... ⏳</div>
      ) : (
        <div className="grid-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {ayahsList.map((ayah) => {
            const isSelected = activeAyah === ayah.numberInSurah;
            const isPlaying = playingAyah === ayah.numberInSurah;
            const isAudioLoading = loadingAyahAudio === ayah.numberInSurah;
            return (
              <div
                key={ayah.numberInSurah} onClick={() => setActiveAyah(isSelected ? null : ayah.numberInSurah)}
                style={{ backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--card-bg)', padding: '25px 20px', borderRadius: '20px', border: isSelected ? '2px solid #16A34A' : '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.3s ease' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  {ayah.score !== null ? (
                    <div style={{ display: 'inline-block', backgroundColor: ayah.score >= 80 ? '#dcfce7' : '#fee2e2', color: ayah.score >= 80 ? '#166534' : '#991b1b', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                      Score: {ayah.score}%
                    </div>
                  ) : <span />}

                  <button
                    className={`speaker-btn ${isPlaying ? 'playing' : ''} ${isAudioLoading ? 'loading' : ''}`}
                    onClick={(e) => { e.stopPropagation(); playAyahRecitation(ayah); }}
                    title="Sahi tajweed ke sath yeh ayah sunein"
                  >
                    {isAudioLoading ? '⏳' : (isPlaying ? '⏸' : '🔊')}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', alignContent: 'flex-start', gap: '8px', lineHeight: '2.8' }}>
                  {ayah.words.map((word) => {
                    // Agar test ke baad galat hai toh Red, chhoot gaya hai toh Orange, sahi hai toh Green, nahi toh default Dark Green
                    let wordColor = 'var(--text-heading)';
                    if (word.status === 'correct') wordColor = '#16A34A';
                    if (word.status === 'incorrect') wordColor = '#EF4444';
                    if (word.status === 'missing') wordColor = '#F59E0B';

                    return (
                      <span key={word.id} style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 'bold', color: wordColor, transition: 'color 0.4s', fontFamily: '"Traditional Arabic", serif' }}>
                        {word.text}
                      </span>
                    )
                  })}
                  <span style={{ fontSize: '24px', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '5px' }}>{` \u06DD${toArabicNumber(ayah.numberInSurah)}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Record Button */}
      <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isAnalyzing && <div style={{ backgroundColor: '#1B4332', color: 'white', padding: '8px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>AI Listening & Checking Tajweed... 🧠</div>}
        <button onClick={isRecording ? stopRecording : startRecording} disabled={isLoading || isAnalyzing} className={isRecording ? "record-btn-active" : ""} style={{ width: '70px', height: '70px', borderRadius: '50%', border: 'none', backgroundColor: (isLoading || isAnalyzing) ? '#9CA3AF' : '#10B981', color: 'white', fontSize: '28px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)' }}>
          {isRecording ? "⏹" : "🎤"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
      <style>{premiumStyles}</style>

      {/* CORE FEATURE: DETAILED TAJWEED FEEDBACK MODAL */}
      {sessionFeedback && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ fontSize: '45px', marginBottom: '5px' }}>{sessionFeedback.score === 100 ? '🌟' : (sessionFeedback.score >= 60 ? '👍' : '⚠️')}</div>
            <h2 style={{ color: sessionFeedback.score >= 60 ? '#16A34A' : '#EF4444', margin: '0 0 5px 0', fontSize: '22px' }}>{sessionFeedback.remarks}</h2>
            <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-heading)', marginBottom: '15px' }}>{sessionFeedback.score}% Accuracy</div>

            {/* TAJWEED MISTAKES + CORRECTIONS SECTION */}
            {sessionFeedback.tajweedFeedback && sessionFeedback.tajweedFeedback.length > 0 && (
              <div style={{ backgroundColor: '#FEF2F2', padding: '15px', borderRadius: '15px', marginBottom: '15px', textAlign: 'right' }}>
                <div style={{ color: '#991B1B', fontWeight: 'bold', marginBottom: '10px', fontSize: '14px', textAlign: 'center' }}>🚨 Tajweed Corrections</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {sessionFeedback.tajweedFeedback.map((item, idx) => (
                    <div key={idx} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#991B1B', fontWeight: 'bold' }}>Aap ne galat pronounce kiya:</span>
                        <strong style={{ fontSize: '24px', fontFamily: '"Traditional Arabic", serif', color: '#EF4444' }}>
                          {item.word}
                        </strong>
                      </div>
                      {item.issue && (
                        <div style={{ fontSize: '13px', color: '#7F1D1D', marginBottom: '4px' }}>{item.issue}</div>
                      )}
                      {item.correction && (
                        <div style={{ fontSize: '13px', color: '#166534', backgroundColor: '#F0FDF4', borderRadius: '8px', padding: '6px 8px' }}>
                          ✅ {item.correction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ backgroundColor: 'var(--track-bg)', padding: '15px', borderRadius: '15px', marginBottom: '20px', fontSize: '13px', color: 'var(--text-body)' }}>
              <strong>AI Heard:</strong><br />
              <span style={{ fontFamily: '"Traditional Arabic", serif', fontSize: '18px', display: 'block', marginTop: '5px' }}>{sessionFeedback.textHeard || "Kuch sunayi nahi diya"}</span>
            </div>

            <button onClick={() => setSessionFeedback(null)} style={{ backgroundColor: '#1B4332', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '50px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', width: '100%' }}>{t('continue_practice')}</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>
          {activeTab === 'Quran' ? t('header_recite') : activeTab === 'Learn' ? t('header_learn') : activeTab === 'Home' ? t('header_home') : activeTab === 'Progress' ? t('header_progress') : activeTab === 'Profile' ? t('header_profile') : activeTab}
        </h2>
      </div>

      <div style={{ padding: '0 20px' }}>
        {activeTab === 'Quran' && renderQuranTab()}
        {activeTab === 'Learn' && renderLearnTab()}
        {activeTab === 'Home' && renderHomeTab()}
        {(activeTab === 'Progress') && renderProgressTab()}
        {(activeTab === 'Profile') && renderProfileTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', display: 'flex', justifyContent: 'space-around', padding: '15px 0', zIndex: 999, paddingBottom: '25px' }}>
        <div className={`nav-item ${activeTab === 'Home' ? 'active' : ''}`} onClick={() => setActiveTab('Home')}><span className="nav-icon">🏠</span><span>{t('nav_home')}</span></div>
        <div className={`nav-item ${activeTab === 'Learn' ? 'active' : ''}`} onClick={() => setActiveTab('Learn')}><span className="nav-icon">📖</span><span>{t('nav_learn')}</span></div>
        <div className={`nav-item ${activeTab === 'Quran' ? 'active' : ''}`} onClick={() => setActiveTab('Quran')}><span className="nav-icon">🎤</span><span>{t('nav_recite')}</span></div>
        <div className={`nav-item ${activeTab === 'Progress' ? 'active' : ''}`} onClick={() => setActiveTab('Progress')}><span className="nav-icon">📈</span><span>{t('nav_progress')}</span></div>
        <div className={`nav-item ${activeTab === 'Profile' ? 'active' : ''}`} onClick={() => setActiveTab('Profile')}><span className="nav-icon">👤</span><span>{t('nav_profile')}</span></div>
      </div>
    </div>
  );
}

export default App;
