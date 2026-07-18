export type Locale = 'en' | 'az';

export const SUPPORTED_LOCALES: readonly { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycan' },
];

const en = {
  'login.title': 'AstroCalc',
  'login.subtitle': 'Sign in to save your charts and readings',
  'login.continueWithGoogle': 'Continue with Google',

  'profile.titleCreate': 'Set up your profile',
  'profile.titleEdit': 'Your profile',
  'profile.subtitleCreate': 'This is what your chart and Matrix of Destiny are calculated from.',
  'profile.subtitleEdit': 'Update any field — your chart is recalculated automatically.',

  'profile.name.label': 'Name',
  'profile.name.placeholder': 'Your name',

  'profile.avatarUrl.label': 'Avatar URL',
  'profile.avatarUrl.placeholder': 'https://…',
  'profile.avatarUrl.invalid': 'Enter a valid URL, or leave this blank.',

  'profile.language.label': 'Language',

  'profile.birthDate.label': 'Birth date',
  'profile.birthDate.placeholder': 'YYYY-MM-DD',
  'profile.birthDate.invalid': 'Enter a date as YYYY-MM-DD.',

  'profile.birthTime.label': 'Birth time',
  'profile.birthTime.placeholder': 'HH:MM',
  'profile.birthTime.invalid': 'Enter a time as HH:MM.',
  'profile.birthTimeUnknown.label': "I don't know my exact birth time",

  'profile.birthPlace.label': 'Birth place',
  'profile.birthPlace.placeholder': 'City, Country',
  'profile.birthPlaceAdvanced.label': 'Coordinates & time zone (advanced)',
  'profile.birthPlaceLat.placeholder': 'Latitude',
  'profile.birthPlaceLng.placeholder': 'Longitude',
  'profile.birthPlaceTimezone.placeholder': 'IANA time zone, e.g. Asia/Baku',

  'profile.save': 'Save changes',
  'profile.saving': 'Saving…',
  'profile.saved': 'Profile updated.',
  'profile.birthDataChangedNotice':
    'Your natal chart and Matrix of Destiny will be recalculated with your new birth data.',
  'profile.loadError': "Couldn't load your profile.",
  'profile.saveError': "Couldn't save your changes. Please try again.",
  'profile.retry': 'Try again',
} as const;

const az: Record<keyof typeof en, string> = {
  'login.title': 'AstroCalc',
  'login.subtitle': 'Xəritələrinizi və şərhlərinizi saxlamaq üçün daxil olun',
  'login.continueWithGoogle': 'Google ilə davam et',

  'profile.titleCreate': 'Profilinizi qurun',
  'profile.titleEdit': 'Profiliniz',
  'profile.subtitleCreate': 'Xəritəniz və Taleyin Matrisi bu məlumatlar əsasında hesablanır.',
  'profile.subtitleEdit': 'İstənilən sahəni dəyişin — xəritəniz avtomatik yenidən hesablanır.',

  'profile.name.label': 'Ad',
  'profile.name.placeholder': 'Adınız',

  'profile.avatarUrl.label': 'Avatar URL',
  'profile.avatarUrl.placeholder': 'https://…',
  'profile.avatarUrl.invalid': 'Düzgün URL daxil edin, ya da boş buraxın.',

  'profile.language.label': 'Dil',

  'profile.birthDate.label': 'Doğum tarixi',
  'profile.birthDate.placeholder': 'İİİİ-AA-GG',
  'profile.birthDate.invalid': 'Tarixi İİİİ-AA-GG formatında daxil edin.',

  'profile.birthTime.label': 'Doğum vaxtı',
  'profile.birthTime.placeholder': 'SS:DD',
  'profile.birthTime.invalid': 'Vaxtı SS:DD formatında daxil edin.',
  'profile.birthTimeUnknown.label': 'Dəqiq doğum vaxtımı bilmirəm',

  'profile.birthPlace.label': 'Doğum yeri',
  'profile.birthPlace.placeholder': 'Şəhər, Ölkə',
  'profile.birthPlaceAdvanced.label': 'Koordinatlar və saat qurşağı (əlavə)',
  'profile.birthPlaceLat.placeholder': 'En dairəsi',
  'profile.birthPlaceLng.placeholder': 'Uzunluq dairəsi',
  'profile.birthPlaceTimezone.placeholder': 'IANA saat qurşağı, məs. Asia/Baku',

  'profile.save': 'Dəyişiklikləri yadda saxla',
  'profile.saving': 'Yadda saxlanılır…',
  'profile.saved': 'Profil yeniləndi.',
  'profile.birthDataChangedNotice':
    'Yeni doğum məlumatlarınızla xəritəniz və Taleyin Matrisi yenidən hesablanacaq.',
  'profile.loadError': 'Profiliniz yüklənmədi.',
  'profile.saveError': 'Dəyişikliklər yadda saxlanmadı. Yenidən cəhd edin.',
  'profile.retry': 'Yenidən cəhd et',
};

export type TranslationKey = keyof typeof en;

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, az };

export const DEFAULT_LOCALE: Locale = 'en';

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((l) => l.code === value);
}
