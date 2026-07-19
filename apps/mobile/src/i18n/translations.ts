export type Locale = 'en' | 'az';

export const SUPPORTED_LOCALES: readonly { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycan' },
];

const en = {
  'login.title': 'AstroCalc',
  'login.subtitle': 'Sign in to save your charts and readings',
  'login.continueWithGoogle': 'Continue with Google',
  'login.continueWithWhatsApp': 'Continue with WhatsApp',
  'login.accountExists':
    'An account already exists for this email. Continue with WhatsApp to sign in and link it:',
  'login.linkHint': 'Verify your number to link your Google account to this one.',
  'login.linkFailed': "Signed in, but couldn't link your Google account. You can try again later.",

  'otp.phone.title': 'Enter your phone number',
  'otp.phone.placeholder': '+15551234567',
  'otp.phone.invalid': 'Enter a valid phone number in international format, e.g. +15551234567.',
  'otp.phone.send': 'Send code',
  'otp.code.title': 'Enter the code we sent you',
  'otp.code.placeholder': '······',
  'otp.code.invalid': 'Enter the 6-digit code.',
  'otp.code.verify': 'Verify',
  'otp.code.resend': 'Resend code',
  'otp.code.resendIn': 'Resend available in',
  'otp.code.expiresIn': 'Code expires in',
  'otp.attemptsRemaining': 'attempts remaining',
  'otp.useGoogleInstead': 'Use Google instead',

  'otp.error.generic': 'Something went wrong. Please try again.',
  'otp.error.notFound': 'No verification code was requested for this number.',
  'otp.error.expired': 'This code has expired. Request a new one.',
  'otp.error.invalidCode': 'That code is incorrect.',
  'otp.error.maxAttempts': 'Too many incorrect attempts. Request a new code.',
  'otp.error.cooldown': 'Please wait before requesting another code:',
  'otp.error.accountLocked': 'Too many failed attempts. Try again in:',
  'otp.error.rateLimited': 'Too many codes requested. Please try again in:',
  'otp.error.quotaExceeded':
    'WhatsApp verification is temporarily unavailable. Please continue with Google.',
  'otp.error.sendFailed': 'Could not send the WhatsApp verification code. Please try again.',
  'otp.error.network': 'Could not reach the server. Check your connection.',

  'account.manageLink': 'Manage account',
  'account.title': 'Account',
  'account.export.title': 'Export your data',
  'account.export.description':
    "Request a copy of your personal data. We'll prepare it and notify you once it's ready to download.",
  'account.export.request': 'Request data export',
  'account.export.error': "Couldn't start your data export. Please try again.",
  'account.export.status.inProgress': "Preparing your export — we'll notify you when it's ready.",
  'account.export.status.ready':
    'Your export is ready. Check your notifications for the download link.',
  'account.export.status.failed': "We couldn't prepare your export. Please try again.",
  'account.delete.title': 'Delete account',
  'account.delete.description':
    'This permanently deletes your account and all related data — natal charts, Matrix results, and generated PDFs. This cannot be undone.',
  'account.delete.placeholder': 'Type DELETE to confirm',
  'account.delete.confirm': 'Permanently delete my account',
  'account.delete.error': "Couldn't delete your account. Please try again.",

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

  'onboarding.step.name.title': 'What should we call you?',
  'onboarding.step.birthDate.title': 'When were you born?',
  'onboarding.step.birthTime.title': 'What time were you born?',
  'onboarding.step.birthTime.unknownExplain':
    "We'll skip your Ascendant, Midheaven, and house placements until you add an exact time — everything else still works.",
  'onboarding.step.birthPlace.title': 'Where were you born?',
  'onboarding.step.language.title': 'Choose your language',
  'onboarding.name.required': 'Enter your name to continue.',
  'onboarding.birthPlace.required': 'Choose a birth place to continue.',
  'onboarding.language.required': 'Choose a language to continue.',
  'onboarding.back': 'Back',
  'onboarding.next': 'Next',
  'onboarding.finish': 'Finish',
  'onboarding.finishLater': "I'll finish this later",
  'onboarding.progressHint': 'Step',
  'onboarding.saveError': "Couldn't save. Please try again.",

  'birthPlaceSearch.placeholder': 'Search for a city…',
  'birthPlaceSearch.noResults': 'No matches found.',
  'birthPlaceSearch.manualToggle': "Can't find it? Enter manually",
  'birthPlaceSearch.manualHide': 'Hide manual entry',
  'birthPlaceSearch.error': "Couldn't search right now — you can still enter it manually.",
  'birthPlaceSearch.pickOnMap': 'Pick on map',

  'birthDate.select': 'Select date',
  'birthTime.select': 'Select time',
  'common.done': 'Done',
  'common.cancel': 'Cancel',

  'birthPlaceMap.title': 'Tap the map to set your birth place',
  'birthPlaceMap.tapHint': 'Tap anywhere on the map to drop a pin.',
  'birthPlaceMap.locating': 'Finding place…',
  'birthPlaceMap.timezoneLabel': 'Time zone',
  'birthPlaceMap.use': 'Use this location',

  'profile.viewChart': 'View my natal chart',

  'natalChart.title': 'Your Natal Chart',
  'natalChart.loadError': "Couldn't load your chart. Please try again.",
  'natalChart.incompleteProfile': 'Complete your birth details in your profile to see your chart.',
  'natalChart.retry': 'Try again',
  'natalChart.housesUnavailable': "Houses aren't shown because your exact birth time is unknown.",
  'natalChart.offlineNotice':
    "You're viewing a chart computed on this device. Reconnect for your full reading.",
  'natalChart.retrogradeHint': '"R" marks a planet in retrograde.',
  'natalChart.readingTitle': 'Your Reading',
  'natalChart.aspectsTitle': 'Aspects',
  'natalChart.readingError': "Couldn't load your reading. Please try again.",
  'natalChart.readingUnavailableOffline': 'Your reading needs an internet connection.',
} as const;

const az: Record<keyof typeof en, string> = {
  'login.title': 'AstroCalc',
  'login.subtitle': 'Xəritələrinizi və şərhlərinizi saxlamaq üçün daxil olun',
  'login.continueWithGoogle': 'Google ilə davam et',
  'login.continueWithWhatsApp': 'WhatsApp ilə davam et',
  'login.accountExists':
    'Bu e-poçt üçün artıq hesab mövcuddur. Daxil olub əlaqələndirmək üçün WhatsApp ilə davam edin:',
  'login.linkHint': 'Google hesabınızı bu hesabla əlaqələndirmək üçün nömrənizi təsdiqləyin.',
  'login.linkFailed':
    'Daxil oldunuz, lakin Google hesabınızı əlaqələndirə bilmədik. Sonra yenidən cəhd edə bilərsiniz.',

  'otp.phone.title': 'Telefon nömrənizi daxil edin',
  'otp.phone.placeholder': '+15551234567',
  'otp.phone.invalid': 'Beynəlxalq formatda düzgün telefon nömrəsi daxil edin, məs. +15551234567.',
  'otp.phone.send': 'Kod göndər',
  'otp.code.title': 'Sizə göndərdiyimiz kodu daxil edin',
  'otp.code.placeholder': '······',
  'otp.code.invalid': '6 rəqəmli kodu daxil edin.',
  'otp.code.verify': 'Təsdiqlə',
  'otp.code.resend': 'Kodu yenidən göndər',
  'otp.code.resendIn': 'Yenidən göndərmə',
  'otp.code.expiresIn': 'Kodun etibarlılıq müddəti',
  'otp.attemptsRemaining': 'cəhd qalıb',
  'otp.useGoogleInstead': 'Bunun əvəzinə Google-dan istifadə et',

  'otp.error.generic': 'Xəta baş verdi. Yenidən cəhd edin.',
  'otp.error.notFound': 'Bu nömrə üçün heç bir təsdiq kodu tələb edilməyib.',
  'otp.error.expired': 'Bu kodun müddəti bitib. Yeni kod tələb edin.',
  'otp.error.invalidCode': 'Bu kod yanlışdır.',
  'otp.error.maxAttempts': 'Çox sayda yanlış cəhd. Yeni kod tələb edin.',
  'otp.error.cooldown': 'Yeni kod tələb etmək üçün gözləyin:',
  'otp.error.accountLocked': 'Çox sayda uğursuz cəhd. Yenidən cəhd edin:',
  'otp.error.rateLimited': 'Çox sayda kod tələb edilib. Zəhmət olmasa sonra cəhd edin:',
  'otp.error.quotaExceeded':
    'WhatsApp təsdiqi müvəqqəti əlçatan deyil. Zəhmət olmasa Google ilə davam edin.',
  'otp.error.sendFailed': 'WhatsApp təsdiq kodu göndərilə bilmədi. Yenidən cəhd edin.',
  'otp.error.network': 'Serverə qoşula bilmədik. İnternet bağlantınızı yoxlayın.',

  'account.manageLink': 'Hesabı idarə et',
  'account.title': 'Hesab',
  'account.export.title': 'Məlumatlarınızı ixrac edin',
  'account.export.description':
    'Şəxsi məlumatlarınızın surətini tələb edin. Hazır olduqda onu yükləmək üçün sizə bildiriş göndərəcəyik.',
  'account.export.request': 'Məlumat ixracı tələb et',
  'account.export.error': 'Məlumat ixracını başlada bilmədik. Yenidən cəhd edin.',
  'account.export.status.inProgress':
    'İxracınız hazırlanır — hazır olduqda sizə bildiriş göndərəcəyik.',
  'account.export.status.ready':
    'İxracınız hazırdır. Yükləmə linki üçün bildirişlərinizi yoxlayın.',
  'account.export.status.failed': 'İxracınızı hazırlaya bilmədik. Yenidən cəhd edin.',
  'account.delete.title': 'Hesabı sil',
  'account.delete.description':
    'Bu, hesabınızı və bütün əlaqəli məlumatları — natal xəritələr, Matris nəticələri və yaradılan PDF-lər — həmişəlik siləcək. Bu geri qaytarıla bilməz.',
  'account.delete.placeholder': 'Təsdiq üçün DELETE yazın',
  'account.delete.confirm': 'Hesabımı həmişəlik sil',
  'account.delete.error': 'Hesabınızı silə bilmədik. Yenidən cəhd edin.',

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

  'onboarding.step.name.title': 'Sizə necə müraciət edək?',
  'onboarding.step.birthDate.title': 'Nə vaxt anadan olmusunuz?',
  'onboarding.step.birthTime.title': 'Neçədə anadan olmusunuz?',
  'onboarding.step.birthTime.unknownExplain':
    'Dəqiq vaxt əlavə edənə qədər Asenden, Zenit nöqtəsi və evləri hesablamayacağıq — qalan hər şey normal işləyir.',
  'onboarding.step.birthPlace.title': 'Harada anadan olmusunuz?',
  'onboarding.step.language.title': 'Dilinizi seçin',
  'onboarding.name.required': 'Davam etmək üçün adınızı daxil edin.',
  'onboarding.birthPlace.required': 'Davam etmək üçün doğum yerini seçin.',
  'onboarding.language.required': 'Davam etmək üçün dil seçin.',
  'onboarding.back': 'Geri',
  'onboarding.next': 'Növbəti',
  'onboarding.finish': 'Bitir',
  'onboarding.finishLater': 'Bunu sonra bitirəcəyəm',
  'onboarding.progressHint': 'Addım',
  'onboarding.saveError': 'Yadda saxlanmadı. Yenidən cəhd edin.',

  'birthPlaceSearch.placeholder': 'Şəhər axtarın…',
  'birthPlaceSearch.noResults': 'Nəticə tapılmadı.',
  'birthPlaceSearch.manualToggle': 'Tapa bilmirsiniz? Əl ilə daxil edin',
  'birthPlaceSearch.manualHide': 'Əl ilə daxiletməni gizlət',
  'birthPlaceSearch.error': 'Hazırda axtarış edilmədi — yenə də əl ilə daxil edə bilərsiniz.',
  'birthPlaceSearch.pickOnMap': 'Xəritədə seçin',

  'birthDate.select': 'Tarixi seçin',
  'birthTime.select': 'Vaxtı seçin',
  'common.done': 'Hazırdır',
  'common.cancel': 'Ləğv et',

  'birthPlaceMap.title': 'Doğum yerinizi xəritəyə toxunaraq seçin',
  'birthPlaceMap.tapHint': 'Nişan qoymaq üçün xəritədə istənilən yerə toxunun.',
  'birthPlaceMap.locating': 'Yer axtarılır…',
  'birthPlaceMap.timezoneLabel': 'Saat qurşağı',
  'birthPlaceMap.use': 'Bu yeri istifadə et',

  'profile.viewChart': 'Natal xəritəmə bax',

  'natalChart.title': 'Sizin Natal Xəritəniz',
  'natalChart.loadError': 'Xəritəniz yüklənmədi. Yenidən cəhd edin.',
  'natalChart.incompleteProfile':
    'Xəritənizi görmək üçün profilinizdə doğum məlumatlarınızı tamamlayın.',
  'natalChart.retry': 'Yenidən cəhd et',
  'natalChart.housesUnavailable': 'Dəqiq doğum vaxtınız bilinmədiyi üçün evlər göstərilmir.',
  'natalChart.offlineNotice':
    'Bu cihazda hesablanmış xəritəyə baxırsınız. Tam şərh üçün internetə qoşulun.',
  'natalChart.retrogradeHint': '"R" retroqrad planeti bildirir.',
  'natalChart.readingTitle': 'Sizin Şərhiniz',
  'natalChart.aspectsTitle': 'Aspektlər',
  'natalChart.readingError': 'Şərhiniz yüklənmədi. Yenidən cəhd edin.',
  'natalChart.readingUnavailableOffline': 'Şərhiniz üçün internet bağlantısı lazımdır.',
};

export type TranslationKey = keyof typeof en;

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, az };

export const DEFAULT_LOCALE: Locale = 'en';

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((l) => l.code === value);
}
