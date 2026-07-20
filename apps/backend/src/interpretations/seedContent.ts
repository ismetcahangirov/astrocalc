import {
  aspectSubjectKey,
  INTERPRETED_BODIES,
  numerologySubjectKey,
  planetHouseSubjectKey,
  planetSignSubjectKey,
  SUPPORTED_LOCALES,
  type AspectType,
  type CelestialBody,
  type InterpretationCategory,
  type InterpretationLocale,
  type NumerologyNumberKind,
  type ZodiacSign,
} from '@astrocalc/calc-engine';

/**
 * Original (not copied from any other site) interpretation text, generated for
 * every (category, subjectKey) combination {@link listInterpretationSubjects}
 * enumerates, in all four {@link SUPPORTED_LOCALES}. Each language sentence is
 * composed from a small bank of hand-written phrases — for astrology the
 * planet's core theme, the sign/house's quality, the aspect's dynamic; for
 * numerology the position's frame and the number's meaning — plugged into a
 * fixed per-locale sentence template, so every one of the 2,600 rows (650
 * subjects × 4 locales) is unique, complete prose rather than a copy-pasted
 * placeholder.
 *
 * Coverage: 465 astrology subjects (#18) + 185 numerology subjects (content
 * epic #76: #77/#78/#79). Matrix of Destiny (#67) joins once #68 fixes its
 * position list — see `listInterpretationSubjects()` in calc-engine.
 *
 * This is a *baseline*: the admin panel (EPIC 10) can overwrite any row with
 * bespoke copy later without touching this generator, via the same
 * `PUT /interpretations/:category/:subjectKey/:locale` upsert the seed script
 * uses (see `seed.ts`, which only fills rows that don't already exist).
 */

type LocalizedText = Record<InterpretationLocale, string>;

const SIGNS: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const HOUSES: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1);

const ASPECT_TYPES: readonly AspectType[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
];

const PLANET_NAME: Record<CelestialBody, LocalizedText> = {
  sun: { en: 'The Sun', az: 'Günəş', tr: 'Güneş', ru: 'Солнце' },
  moon: { en: 'The Moon', az: 'Ay', tr: 'Ay', ru: 'Луна' },
  mercury: { en: 'Mercury', az: 'Merkuri', tr: 'Merkür', ru: 'Меркурий' },
  venus: { en: 'Venus', az: 'Venera', tr: 'Venüs', ru: 'Венера' },
  mars: { en: 'Mars', az: 'Mars', tr: 'Mars', ru: 'Марс' },
  jupiter: { en: 'Jupiter', az: 'Yupiter', tr: 'Jüpiter', ru: 'Юпитер' },
  saturn: { en: 'Saturn', az: 'Saturn', tr: 'Satürn', ru: 'Сатурн' },
  uranus: { en: 'Uranus', az: 'Uran', tr: 'Uranüs', ru: 'Уран' },
  neptune: { en: 'Neptune', az: 'Neptun', tr: 'Neptün', ru: 'Нептун' },
  pluto: { en: 'Pluto', az: 'Pluton', tr: 'Plüton', ru: 'Плутон' },
  northNode: { en: 'The North Node', az: 'Şimal Ayı', tr: 'Kuzey Ayı', ru: 'Северный узел' },
  southNode: { en: 'The South Node', az: 'Cənub Ayı', tr: 'Güney Ayı', ru: 'Южный узел' },
  chiron: { en: 'Chiron', az: 'Xiron', tr: 'Chiron', ru: 'Хирон' },
};

/** What each planet governs — written as a bare noun phrase (English "relates to X" /
 * Azerbaijani-Turkish "X ilə bağlıdır" object / Russian instrumental case for "связана с X"). */
const BODY_THEME: Record<CelestialBody, LocalizedText> = {
  sun: {
    en: 'your core identity, willpower, and vitality',
    az: 'sizin əsas kimliyiniz, iradəniz və canlılığınız',
    tr: 'temel kimliğiniz, iradeniz ve canlılığınız',
    ru: 'вашей ключевой идентичностью, волей и жизненной силой',
  },
  moon: {
    en: 'your emotional instincts, inner needs, and sense of security',
    az: 'sizin emosional instinktləriniz, daxili ehtiyaclarınız və təhlükəsizlik hissiniz',
    tr: 'duygusal içgüdüleriniz, iç ihtiyaçlarınız ve güvenlik duygunuz',
    ru: 'вашими эмоциональными инстинктами, внутренними потребностями и чувством безопасности',
  },
  mercury: {
    en: 'your thinking style, communication, and how you process information',
    az: 'sizin düşüncə tərziniz, ünsiyyətiniz və məlumatı necə emal etməyiniz',
    tr: 'düşünme tarzınız, iletişiminiz ve bilgiyi işleme biçiminiz',
    ru: 'вашим стилем мышления, общением и тем, как вы обрабатываете информацию',
  },
  venus: {
    en: 'your sense of love, beauty, and what you value',
    az: 'sizin sevgi anlayışınız, gözəllik hissiniz və dəyər verdiyiniz şeylər',
    tr: 'sevgi anlayışınız, güzellik duygunuz ve değer verdiğiniz şeyler',
    ru: 'вашим пониманием любви, красоты и тем, что вы цените',
  },
  mars: {
    en: 'your drive, assertiveness, and how you pursue what you want',
    az: 'sizin həvəsiniz, qətiyyətiniz və istədiyinizə necə nail olmağınız',
    tr: 'hırsınız, atılganlığınız ve istediğinizi elde etme biçiminiz',
    ru: 'вашей энергией, напористостью и тем, как вы добиваетесь желаемого',
  },
  jupiter: {
    en: 'your search for meaning, growth, and where you find opportunity',
    az: 'sizin məna axtarışınız, inkişafınız və fürsət tapdığınız sahələr',
    tr: 'anlam arayışınız, gelişiminiz ve fırsat bulduğunuz alanlar',
    ru: 'вашим поиском смысла, ростом и тем, где вы находите возможности',
  },
  saturn: {
    en: 'your discipline, responsibility, and the structures you build to last',
    az: 'sizin intizamınız, məsuliyyət hissiniz və qurduğunuz davamlı struktur',
    tr: 'disiplininiz, sorumluluk duygunuz ve kurduğunuz kalıcı yapılar',
    ru: 'вашей дисциплиной, ответственностью и прочными структурами, которые вы строите',
  },
  uranus: {
    en: 'your need for independence, originality, and sudden change',
    az: 'sizin müstəqillik ehtiyacınız, orijinallığınız və qəfil dəyişikliklər',
    tr: 'bağımsızlık ihtiyacınız, özgünlüğünüz ve ani değişim eğiliminiz',
    ru: 'вашей потребностью в независимости, оригинальностью и внезапными переменами',
  },
  neptune: {
    en: 'your imagination, intuition, and longing for the ideal',
    az: 'sizin təxəyyülünüz, intuisiyanız və ideala can atmağınız',
    tr: 'hayal gücünüz, sezgileriniz ve ideale duyduğunuz özlem',
    ru: 'вашим воображением, интуицией и стремлением к идеалу',
  },
  pluto: {
    en: 'your capacity for transformation, intensity, and deep control',
    az: 'sizin transformasiya qabiliyyətiniz, intensivliyiniz və dərin nəzarət',
    tr: 'dönüşüm kapasiteniz, yoğunluğunuz ve derin kontrol arayışınız',
    ru: 'вашей способностью к трансформации, интенсивностью и глубоким контролем',
  },
  northNode: {
    en: 'the direction you are growing toward in this lifetime',
    az: 'bu həyatda inkişaf etdiyiniz istiqamət',
    tr: 'bu hayatta geliştiğiniz yön',
    ru: 'направлением, в котором вы развиваетесь в этой жизни',
  },
  southNode: {
    en: 'the instincts and habits you already carry from the past',
    az: 'keçmişdən daşıdığınız instinkt və vərdişlər',
    tr: 'geçmişten taşıdığınız içgüdüler ve alışkanlıklar',
    ru: 'инстинктами и привычками, которые вы уже несёте из прошлого',
  },
  chiron: {
    en: 'your deepest wound and where you learn to heal others by healing yourself',
    az: 'sizin ən dərin yaranız və özünüzü sağaldaraq başqalarına necə kömək etməyiniz',
    tr: 'en derin yaranız ve kendinizi iyileştirerek başkalarına nasıl şifa verdiğiniz',
    ru: 'вашей глубочайшей раной и тем, как вы исцеляете других, исцеляя себя',
  },
};

const SIGN_NAME: Record<ZodiacSign, LocalizedText> = {
  Aries: { en: 'Aries', az: 'Qoç', tr: 'Koç', ru: 'Овен' },
  Taurus: { en: 'Taurus', az: 'Buğa', tr: 'Boğa', ru: 'Телец' },
  Gemini: { en: 'Gemini', az: 'Əkizlər', tr: 'İkizler', ru: 'Близнецы' },
  Cancer: { en: 'Cancer', az: 'Xərçəng', tr: 'Yengeç', ru: 'Рак' },
  Leo: { en: 'Leo', az: 'Şir', tr: 'Aslan', ru: 'Лев' },
  Virgo: { en: 'Virgo', az: 'Qız', tr: 'Başak', ru: 'Дева' },
  Libra: { en: 'Libra', az: 'Tərəzi', tr: 'Terazi', ru: 'Весы' },
  Scorpio: { en: 'Scorpio', az: 'Əqrəb', tr: 'Akrep', ru: 'Скорпион' },
  Sagittarius: { en: 'Sagittarius', az: 'Oxatan', tr: 'Yay', ru: 'Стрелец' },
  Capricorn: { en: 'Capricorn', az: 'Oğlaq', tr: 'Oğlak', ru: 'Козерог' },
  Aquarius: { en: 'Aquarius', az: 'Dolça', tr: 'Kova', ru: 'Водолей' },
  Pisces: { en: 'Pisces', az: 'Balıqlar', tr: 'Balık', ru: 'Рыбы' },
};

/** How a sign's energy tends to come across — English adjective phrase, Azerbaijani/Turkish
 * adjective + "şəkildə/şekilde" (in a ... way), Russian adverb phrase. */
const SIGN_TRAIT: Record<ZodiacSign, LocalizedText> = {
  Aries: {
    en: 'bold, direct, and quick to act',
    az: 'cəsarətli, birbaşa və tez hərəkətə keçən',
    tr: 'cesur, doğrudan ve hızlı hareket eden',
    ru: 'смело, прямолинейно и стремительно',
  },
  Taurus: {
    en: 'steady, patient, and grounded',
    az: 'sabit, səbirli və reallığa bağlı',
    tr: 'istikrarlı, sabırlı ve gerçekçi',
    ru: 'устойчиво, терпеливо и приземлённо',
  },
  Gemini: {
    en: 'curious, adaptable, and quick to exchange ideas',
    az: 'maraqlı, uyğunlaşan və fikir mübadiləsinə tələsən',
    tr: 'meraklı, uyum sağlayan ve fikir alışverişine hevesli',
    ru: 'любознательно, гибко и с готовностью к обмену идеями',
  },
  Cancer: {
    en: 'protective, sensitive, and guided by feeling',
    az: 'qoruyucu, həssas və hisslərlə idarə olunan',
    tr: 'koruyucu, hassas ve duygularla yönlenen',
    ru: 'заботливо, чутко и через призму чувств',
  },
  Leo: {
    en: 'warm, expressive, and eager to be seen',
    az: 'isti, ifadəli və diqqət mərkəzində olmaq istəyən',
    tr: 'sıcak, ifade gücü yüksek ve ilgi odağı olmak isteyen',
    ru: 'тепло, ярко и с желанием быть замеченным',
  },
  Virgo: {
    en: 'precise, practical, and focused on improvement',
    az: 'dəqiq, praktik və təkmilləşməyə yönəlmiş',
    tr: 'titiz, pratik ve gelişime odaklanan',
    ru: 'точно, практично и с фокусом на улучшение',
  },
  Libra: {
    en: 'diplomatic, fair-minded, and drawn to balance',
    az: 'diplomatik, ədalətli və tarazlığa meyilli',
    tr: 'diplomatik, adil ve dengeye yönelen',
    ru: 'дипломатично, справедливо и с тягой к балансу',
  },
  Scorpio: {
    en: 'intense, private, and searching beneath the surface',
    az: 'intensiv, gizli və dərinliyi axtaran',
    tr: 'yoğun, gizemli ve yüzeyin altını arayan',
    ru: 'напряжённо, скрытно и с поиском того, что скрыто внутри',
  },
  Sagittarius: {
    en: 'expansive, optimistic, and hungry for new horizons',
    az: 'geniş düşünən, nikbin və yeni üfüqlərə can atan',
    tr: 'geniş ufuklu, iyimser ve yeni ufuklara meraklı',
    ru: 'масштабно, оптимистично и с жаждой новых горизонтов',
  },
  Capricorn: {
    en: 'disciplined, ambitious, and patient about long-term results',
    az: 'intizamlı, məqsədyönlü və uzunmüddətli nəticələr üçün səbirli',
    tr: 'disiplinli, hırslı ve uzun vadeli sonuçlar için sabırlı',
    ru: 'дисциплинированно, амбициозно и терпеливо ради долгосрочного результата',
  },
  Aquarius: {
    en: 'independent, inventive, and drawn to the unconventional',
    az: 'müstəqil, yaradıcı və qeyri-adi olana meyilli',
    tr: 'bağımsız, yaratıcı ve sıra dışı olana yönelen',
    ru: 'независимо, изобретательно и с тягой к необычному',
  },
  Pisces: {
    en: 'dreamy, compassionate, and receptive to the unseen',
    az: 'xəyalpərəst, mərhəmətli və görünməyənə açıq',
    tr: 'hayalperest, şefkatli ve görünmeyene açık',
    ru: 'мечтательно, сострадательно и восприимчиво к незримому',
  },
};

/** English/Azerbaijani/Turkish ordinal used with "the ... house / ... evdə / ... evde".
 * Russian sidesteps ordinal declension by using the bare house number instead (see the RU template). */
const HOUSE_ORDINAL: Record<number, { en: string; az: string; tr: string }> = {
  1: { en: 'first', az: 'birinci', tr: 'birinci' },
  2: { en: 'second', az: 'ikinci', tr: 'ikinci' },
  3: { en: 'third', az: 'üçüncü', tr: 'üçüncü' },
  4: { en: 'fourth', az: 'dördüncü', tr: 'dördüncü' },
  5: { en: 'fifth', az: 'beşinci', tr: 'beşinci' },
  6: { en: 'sixth', az: 'altıncı', tr: 'altıncı' },
  7: { en: 'seventh', az: 'yeddinci', tr: 'yedinci' },
  8: { en: 'eighth', az: 'səkkizinci', tr: 'sekizinci' },
  9: { en: 'ninth', az: 'doqquzuncu', tr: 'dokuzuncu' },
  10: { en: 'tenth', az: 'onuncu', tr: 'onuncu' },
  11: { en: 'eleventh', az: 'on birinci', tr: 'on birinci' },
  12: { en: 'twelfth', az: 'on ikinci', tr: 'on ikinci' },
};

/** The house's life area — English "through X" object, Azerbaijani "X vasitəsilə",
 * Turkish "X üzerinden", Russian accusative case for "через X". */
const HOUSE_AREA: Record<number, LocalizedText> = {
  1: {
    en: 'your sense of self and how you meet the world',
    az: 'özünüzü necə göstərməyiniz və dünya ilə ilk təmasınız',
    tr: 'kendinizi ifade ediş biçiminiz ve dünyayla ilk temasınız',
    ru: 'ваше самоощущение и то, как вы предстаёте перед миром',
  },
  2: {
    en: 'money, possessions, and your sense of personal worth',
    az: 'pul, əmlak və şəxsi dəyər hissiniz',
    tr: 'para, mülkiyet ve kişisel değer duygunuz',
    ru: 'деньги, имущество и ваше чувство собственной ценности',
  },
  3: {
    en: 'everyday communication, learning, and the people close to home',
    az: 'gündəlik ünsiyyət, təhsil və yaxınlarınızla münasibətlər',
    tr: 'günlük iletişim, öğrenme ve yakın çevrenizle ilişkiler',
    ru: 'повседневное общение, обучение и отношения с близким окружением',
  },
  4: {
    en: 'home, family, and your emotional foundations',
    az: 'ev, ailə və emosional təməliniz',
    tr: 'ev, aile ve duygusal temelleriniz',
    ru: 'дом, семью и ваши эмоциональные основы',
  },
  5: {
    en: 'creativity, romance, and self-expression',
    az: 'yaradıcılıq, romantika və özünüifadə',
    tr: 'yaratıcılık, romantizm ve kendini ifade',
    ru: 'творчество, романтику и самовыражение',
  },
  6: {
    en: 'daily routines, work, and physical well-being',
    az: 'gündəlik rutin, iş və fiziki sağlamlığınız',
    tr: 'günlük rutinler, iş ve fiziksel iyi olma hâli',
    ru: 'повседневные дела, работу и физическое благополучие',
  },
  7: {
    en: 'partnerships, marriage, and one-to-one relationships',
    az: 'tərəfdaşlıq, nikah və bir-birinə bağlı münasibətlər',
    tr: 'ortaklıklar, evlilik ve birebir ilişkiler',
    ru: 'партнёрство, брак и отношения один на один',
  },
  8: {
    en: 'shared resources, intimacy, and deep transformation',
    az: 'ortaq resurslar, yaxınlıq və dərin transformasiya',
    tr: 'paylaşılan kaynaklar, yakınlık ve derin dönüşüm',
    ru: 'общие ресурсы, близость и глубокую трансформацию',
  },
  9: {
    en: 'higher learning, travel, and your search for meaning',
    az: 'ali təhsil, səyahət və məna axtarışınız',
    tr: 'yüksek öğrenim, seyahat ve anlam arayışınız',
    ru: 'высшее образование, путешествия и поиск смысла',
  },
  10: {
    en: 'career, reputation, and public standing',
    az: 'karyera, nüfuz və ictimai mövqeyiniz',
    tr: 'kariyer, itibar ve toplumsal konumunuz',
    ru: 'карьеру, репутацию и общественное положение',
  },
  11: {
    en: 'friendships, communities, and hopes for the future',
    az: 'dostluqlar, icmalar və gələcəyə dair ümidləriniz',
    tr: 'arkadaşlıklar, topluluklar ve geleceğe dair umutlar',
    ru: 'дружбу, сообщества и надежды на будущее',
  },
  12: {
    en: 'solitude, the subconscious, and what remains hidden',
    az: 'tənhalıq, şüuraltı və gizli qalan şeylər',
    tr: 'yalnızlık, bilinçaltı ve gizli kalan şeyler',
    ru: 'уединение, подсознание и то, что остаётся скрытым',
  },
};

const ASPECT_NAME: Record<AspectType, LocalizedText> = {
  conjunction: { en: 'conjunction', az: 'konyunksiya', tr: 'kavuşum', ru: 'соединение' },
  sextile: { en: 'sextile', az: 'sekstil', tr: 'sekstil', ru: 'секстиль' },
  square: { en: 'square', az: 'kvadrat', tr: 'kare', ru: 'квадрат' },
  trine: { en: 'trine', az: 'trin', tr: 'üçgen', ru: 'трин' },
  // Accusative form (required after Russian "образуют") — all other aspect names are
  // inanimate masculine/neuter, whose accusative equals the nominative shown above.
  opposition: { en: 'opposition', az: 'oppozisiya', tr: 'karşıtlık', ru: 'оппозицию' },
};

/** The aspect's dynamic — English/Azerbaijani/Turkish adjective phrase describing the
 * connection, Russian feminine short-adjective phrase agreeing with "связь" (bond, fem.). */
const ASPECT_DYNAMIC: Record<AspectType, LocalizedText> = {
  conjunction: {
    en: 'tightly fused, blending the two energies into one combined force',
    az: 'sıx birləşmiş və iki enerjini tək bir qüvvədə birləşdirən',
    tr: 'iki enerjiyi tek bir güçte birleştiren, sıkı bir şekilde kaynaşmış',
    ru: 'плотно слитная, объединяющая обе энергии в одну силу',
  },
  sextile: {
    en: 'easy and supportive, offering a gentle opportunity to work together',
    az: 'asan və dəstəkləyici, əməkdaşlıq üçün yumşaq imkan yaradan',
    tr: 'kolay ve destekleyici, iş birliği için nazik bir fırsat sunan',
    ru: 'лёгкая и благоприятная, дающая мягкую возможность для сотрудничества',
  },
  square: {
    en: 'tense and demanding, creating friction that pushes for growth',
    az: 'gərgin və tələbkar, inkişafa təkan verən sürtünmə yaradan',
    tr: 'gergin ve talepkâr, gelişimi zorlayan bir sürtünme yaratan',
    ru: 'напряжённая и требовательная, создающая трение, которое подталкивает к росту',
  },
  trine: {
    en: 'flowing and harmonious, letting the two energies reinforce each other with ease',
    az: 'axıcı və harmonik, iki enerjinin bir-birini rahatlıqla gücləndirdiyi',
    tr: 'akıcı ve uyumlu, iki enerjinin birbirini kolayca güçlendirdiği',
    ru: 'плавная и гармоничная, позволяющая энергиям легко усиливать друг друга',
  },
  opposition: {
    en: 'pulling in opposite directions, calling for balance between two competing needs',
    az: 'əks istiqamətlərə çəkən və iki rəqib ehtiyac arasında tarazlıq tələb edən',
    tr: 'zıt yönlere çeken ve iki rakip ihtiyaç arasında denge isteyen',
    ru: 'тянущая в противоположные стороны и требующая баланса между двумя конкурирующими потребностями',
  },
};

function composePlanetSign(
  body: CelestialBody,
  sign: ZodiacSign,
  locale: InterpretationLocale,
): string {
  const planet = PLANET_NAME[body][locale];
  const theme = BODY_THEME[body][locale];
  const signName = SIGN_NAME[sign][locale];
  const trait = SIGN_TRAIT[sign][locale];

  switch (locale) {
    case 'en':
      return `${planet} relates to ${theme}. Placed in ${signName}, this comes across as ${trait}.`;
    case 'az':
      return `${planet} planeti ${theme} ilə bağlıdır. ${signName} bürcündə bu, ${trait} şəkildə özünü göstərir.`;
    case 'tr':
      return `${planet} gezegeni ${theme} ile ilgilidir. ${signName} burcunda bu, ${trait} bir şekilde kendini gösterir.`;
    case 'ru':
      return `Планета ${planet} связана с ${theme}. Знак: ${signName}. Здесь это проявляется ${trait}.`;
  }
}

function composePlanetHouse(
  body: CelestialBody,
  house: number,
  locale: InterpretationLocale,
): string {
  const planet = PLANET_NAME[body][locale];
  const theme = BODY_THEME[body][locale];
  const area = HOUSE_AREA[house]![locale];

  switch (locale) {
    case 'en':
      return `${planet} relates to ${theme}. In the ${HOUSE_ORDINAL[house]!.en} house, this plays out through ${area}.`;
    case 'az':
      return `${planet} planeti ${theme} ilə bağlıdır. ${HOUSE_ORDINAL[house]!.az} evdə bu, ${area} vasitəsilə özünü göstərir.`;
    case 'tr':
      return `${planet} gezegeni ${theme} ile ilgilidir. ${HOUSE_ORDINAL[house]!.tr} evde bu, ${area} üzerinden kendini gösterir.`;
    case 'ru':
      return `Планета ${planet} связана с ${theme}. Дом ${house}: здесь это проявляется через ${area}.`;
  }
}

function composeAspect(
  type: AspectType,
  bodyA: CelestialBody,
  bodyB: CelestialBody,
  locale: InterpretationLocale,
): string {
  const planetA = PLANET_NAME[bodyA][locale];
  const planetB = PLANET_NAME[bodyB][locale];
  const aspectName = ASPECT_NAME[type][locale];
  const dynamic = ASPECT_DYNAMIC[type][locale];

  switch (locale) {
    case 'en':
      return `${planetA} and ${planetB} form a ${aspectName}: a connection that is ${dynamic}.`;
    case 'az':
      return `${planetA} və ${planetB} arasında ${aspectName} yaranır: bu, ${dynamic} bir əlaqədir.`;
    case 'tr':
      return `${planetA} ve ${planetB} bir ${aspectName} oluşturur: bu, ${dynamic} bir bağlantıdır.`;
    case 'ru':
      return `Планеты ${planetA} и ${planetB} образуют ${aspectName} — связь, ${dynamic}.`;
  }
}

// ── Numerology (#57 content epic #76: core four #77, extended/cycles #78, ─────
//    pinnacles/challenges #79) ───────────────────────────────────────────────
//
// Same compositional approach as the astrology text above: a per-position frame
// (what this number governs) is woven with a per-number meaning, so a value
// reads differently in each position — a 7 Life Path and a 7 Personal Year are
// distinct sentences, never one shared "7" text. The 185 keys and their exact
// value ranges are owned by `listNumerologySubjects()` in calc-engine;
// `numerologySubjectKey()` rejects any value outside a kind's range, and
// `seedContent.test.ts` checks this generator against that list, so the ranges
// re-declared here cannot silently drift.

const NUM_1_9: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Kind → the values it takes, mirroring calc-engine's `NUMEROLOGY_VALUE_RANGES`. */
const NUMEROLOGY_KIND_RANGES: Record<NumerologyNumberKind, readonly number[]> = {
  'life-path': [...NUM_1_9, 11, 22],
  expression: [...NUM_1_9, 11, 22, 33],
  'soul-urge': [...NUM_1_9, 11, 22, 33],
  personality: [...NUM_1_9, 11, 22, 33],
  birthday: Array.from({ length: 31 }, (_, i) => i + 1),
  maturity: [...NUM_1_9, 11, 22, 33],
  'personal-year': [...NUM_1_9],
  'personal-month': [...NUM_1_9],
  'pinnacle-1': [...NUM_1_9, 11],
  'pinnacle-2': [...NUM_1_9, 11],
  'pinnacle-3': [...NUM_1_9, 11, 22],
  'pinnacle-4': [...NUM_1_9, 11],
  'challenge-1': [0, 1, 2, 3, 4, 5, 6, 7, 8],
  'challenge-2': [0, 1, 2, 3, 4, 5, 6, 7, 8],
  'challenge-3': [0, 1, 2, 3, 4, 5, 6, 7, 8],
  'challenge-4': [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

/** Which sentence shape a kind uses — its frame carries the positional nuance. */
type NumerologyStyle = 'general' | 'challenge' | 'birthday';
const NUMEROLOGY_STYLE: Record<NumerologyNumberKind, NumerologyStyle> = {
  'life-path': 'general',
  expression: 'general',
  'soul-urge': 'general',
  personality: 'general',
  birthday: 'birthday',
  maturity: 'general',
  'personal-year': 'general',
  'personal-month': 'general',
  'pinnacle-1': 'general',
  'pinnacle-2': 'general',
  'pinnacle-3': 'general',
  'pinnacle-4': 'general',
  'challenge-1': 'challenge',
  'challenge-2': 'challenge',
  'challenge-3': 'challenge',
  'challenge-4': 'challenge',
};

/** The position's name as it appears in the sentence (RU: genitive, for "Число …"). */
const KIND_LABEL: Record<NumerologyNumberKind, LocalizedText> = {
  'life-path': { en: 'Life Path', az: 'Həyat Yolu', tr: 'Yaşam Yolu', ru: 'Жизненного Пути' },
  expression: { en: 'Expression', az: 'İfadə', tr: 'İfade', ru: 'Выражения' },
  'soul-urge': { en: 'Soul Urge', az: 'Ruhun Arzusu', tr: 'Ruh Arzusu', ru: 'Желания Души' },
  personality: { en: 'Personality', az: 'Şəxsiyyət', tr: 'Kişilik', ru: 'Личности' },
  birthday: { en: 'Birthday', az: 'Doğum Günü', tr: 'Doğum Günü', ru: 'Дня Рождения' },
  maturity: { en: 'Maturity', az: 'Yetkinlik', tr: 'Olgunluk', ru: 'Зрелости' },
  'personal-year': { en: 'Personal Year', az: 'Şəxsi İl', tr: 'Kişisel Yıl', ru: 'Личного Года' },
  'personal-month': {
    en: 'Personal Month',
    az: 'Şəxsi Ay',
    tr: 'Kişisel Ay',
    ru: 'Личного Месяца',
  },
  'pinnacle-1': {
    en: 'first Pinnacle',
    az: 'Birinci Zirvə',
    tr: 'Birinci Doruk',
    ru: 'первой Вершины',
  },
  'pinnacle-2': {
    en: 'second Pinnacle',
    az: 'İkinci Zirvə',
    tr: 'İkinci Doruk',
    ru: 'второй Вершины',
  },
  'pinnacle-3': {
    en: 'third Pinnacle',
    az: 'Üçüncü Zirvə',
    tr: 'Üçüncü Doruk',
    ru: 'третьей Вершины',
  },
  'pinnacle-4': {
    en: 'fourth Pinnacle',
    az: 'Dördüncü Zirvə',
    tr: 'Dördüncü Doruk',
    ru: 'четвёртой Вершины',
  },
  'challenge-1': {
    en: 'first Challenge',
    az: 'Birinci Sınaq',
    tr: 'Birinci Zorluk',
    ru: 'первого Испытания',
  },
  'challenge-2': {
    en: 'second Challenge',
    az: 'İkinci Sınaq',
    tr: 'İkinci Zorluk',
    ru: 'второго Испытания',
  },
  'challenge-3': {
    en: 'third Challenge',
    az: 'Üçüncü Sınaq',
    tr: 'Üçüncü Zorluk',
    ru: 'третьего Испытания',
  },
  'challenge-4': {
    en: 'fourth Challenge',
    az: 'Dördüncü Sınaq',
    tr: 'Dördüncü Zorluk',
    ru: 'четвёртого Испытания',
  },
};

/** What the position governs — a verb clause following "It / Bu rəqəm / Bu sayı / Оно". */
const KIND_FRAME: Record<NumerologyNumberKind, LocalizedText> = {
  'life-path': {
    en: 'marks the central direction your whole life is organized around',
    az: 'bütün həyatınızın qurulduğu əsas istiqaməti müəyyən edir',
    tr: 'tüm yaşamınızın etrafında şekillendiği ana yönü belirler',
    ru: 'задаёт главное направление, вокруг которого выстроена вся ваша жизнь',
  },
  expression: {
    en: 'describes the natural talents and outward style you were given to work with',
    az: 'təbii istedadlarınızı və dünyaya çıxış tərzinizi təsvir edir',
    tr: 'doğal yeteneklerinizi ve dışa dönük tarzınızı tanımlar',
    ru: 'описывает природные таланты и внешний стиль, данные вам от рождения',
  },
  'soul-urge': {
    en: 'speaks to what your heart quietly wants most, beneath the surface',
    az: 'qəlbinizin dərinlikdə ən çox istədiyi şeyi ifadə edir',
    tr: 'kalbinizin yüzeyin altında en çok istediği şeyi dile getirir',
    ru: 'говорит о том, чего ваше сердце тише всего, но сильнее всего желает',
  },
  personality: {
    en: 'shapes the first impression others form of you before they know you',
    az: 'başqalarının sizi tanımazdan əvvəl formalaşan ilk təəssüratını müəyyən edir',
    tr: 'başkalarının sizi tanımadan önce edindiği ilk izlenimi biçimlendirir',
    ru: 'формирует первое впечатление, которое другие составляют о вас ещё до знакомства',
  },
  birthday: {
    en: 'points to a specific talent you were born already carrying',
    az: 'doğularkən artıq daşıdığınız konkret bir istedada işarə edir',
    tr: 'doğarken zaten taşıdığınız belirli bir yeteneğe işaret eder',
    ru: 'указывает на особый талант, с которым вы уже родились',
  },
  maturity: {
    en: 'points to the goal your earlier and later selves are quietly working toward together',
    az: 'erkən və sonrakı mənliyinizin birgə can atdığı hədəfi göstərir',
    tr: 'erken ve sonraki benliğinizin birlikte yöneldiği hedefi işaret eder',
    ru: 'указывает на цель, к которой ваши ранняя и поздняя стороны движутся сообща',
  },
  'personal-year': {
    en: 'sets the theme of the twelve-month cycle you are currently living through',
    az: 'hazırda yaşadığınız on iki aylıq dövrün mövzusunu təyin edir',
    tr: 'şu anda içinden geçtiğiniz on iki aylık döngünün temasını belirler',
    ru: 'задаёт тему двенадцатимесячного цикла, который вы сейчас проживаете',
  },
  'personal-month': {
    en: 'colours the mood and pace of the month you are moving through right now',
    az: 'indi keçdiyiniz ayın əhval-ruhiyyəsini və tempini müəyyən edir',
    tr: 'şu an içinden geçtiğiniz ayın ruh hâlini ve temposunu renklendirir',
    ru: 'окрашивает настроение и ритм месяца, который вы проживаете прямо сейчас',
  },
  'pinnacle-1': {
    en: 'governs the opening stage of life, from childhood into early adulthood',
    az: 'uşaqlıqdan erkən yetkinliyə qədər həyatın ilk mərhələsini idarə edir',
    tr: 'çocukluktan erken yetişkinliğe uzanan yaşamın ilk evresini yönetir',
    ru: 'правит первым этапом жизни — от детства до ранней зрелости',
  },
  'pinnacle-2': {
    en: 'governs the second stage of life, through the busy middle years',
    az: 'məşğul orta illər boyunca həyatın ikinci mərhələsini idarə edir',
    tr: 'yoğun orta yıllar boyunca yaşamın ikinci evresini yönetir',
    ru: 'правит вторым этапом жизни — насыщенными средними годами',
  },
  'pinnacle-3': {
    en: 'governs the third stage of life, as maturity and responsibility deepen',
    az: 'yetkinlik və məsuliyyət dərinləşdikcə həyatın üçüncü mərhələsini idarə edir',
    tr: 'olgunluk ve sorumluluk derinleştikçe yaşamın üçüncü evresini yönetir',
    ru: 'правит третьим этапом жизни, когда крепнут зрелость и ответственность',
  },
  'pinnacle-4': {
    en: 'governs the final stage of life, the reflective later years',
    az: 'həyatın son mərhələsini, düşüncəli sonrakı illəri idarə edir',
    tr: 'yaşamın son evresini, düşünceli ileri yılları yönetir',
    ru: 'правит завершающим этапом жизни — вдумчивыми поздними годами',
  },
  'challenge-1': {
    en: 'names the main inner obstacle of your early years',
    az: 'erkən illərinizin əsas daxili maneəsini adlandırır',
    tr: 'erken yıllarınızın başlıca içsel engelini adlandırır',
    ru: 'называет главное внутреннее препятствие ваших ранних лет',
  },
  'challenge-2': {
    en: 'names a recurring difficulty that runs through your middle years',
    az: 'orta illərinizdən keçən təkrarlanan çətinliyi adlandırır',
    tr: 'orta yıllarınız boyunca yinelenen bir zorluğu adlandırır',
    ru: 'называет повторяющуюся трудность, проходящую через ваши средние годы',
  },
  'challenge-3': {
    en: 'names the central lesson you work on across your whole life',
    az: 'bütün həyatınız boyu üzərində çalışdığınız mərkəzi dərsi adlandırır',
    tr: 'tüm yaşamınız boyunca üzerinde çalıştığınız merkezi dersi adlandırır',
    ru: 'называет центральный урок, над которым вы работаете всю жизнь',
  },
  'challenge-4': {
    en: 'names the test that comes into focus in your later years',
    az: 'sonrakı illərinizdə önə çıxan sınağı adlandırır',
    tr: 'ileri yıllarınızda öne çıkan sınavı adlandırır',
    ru: 'называет испытание, которое выходит на первый план в поздние годы',
  },
};

/** A number's core meaning as a noun phrase — slots into "shows up as …" in every locale. */
const NUMBER_ESSENCE: Record<number, LocalizedText> = {
  1: {
    en: 'independence, initiative, and the will to lead',
    az: 'müstəqillik, təşəbbüs və liderlik iradəsi',
    tr: 'bağımsızlık, girişim ve liderlik iradesi',
    ru: 'независимость, инициатива и воля к лидерству',
  },
  2: {
    en: 'cooperation, sensitivity, and a gift for partnership',
    az: 'əməkdaşlıq, həssaslıq və tərəfdaşlıq bacarığı',
    tr: 'iş birliği, duyarlılık ve ortaklık yeteneği',
    ru: 'сотрудничество, чуткость и дар к партнёрству',
  },
  3: {
    en: 'self-expression, creativity, and social warmth',
    az: 'özünüifadə, yaradıcılıq və ünsiyyət istiliyi',
    tr: 'kendini ifade, yaratıcılık ve sosyal sıcaklık',
    ru: 'самовыражение, творчество и общительное тепло',
  },
  4: {
    en: 'discipline, order, and patient, practical work',
    az: 'intizam, nizam və səbirli, praktik iş',
    tr: 'disiplin, düzen ve sabırlı, pratik çalışma',
    ru: 'дисциплина, порядок и терпеливый практический труд',
  },
  5: {
    en: 'freedom, curiosity, and a hunger for change',
    az: 'azadlıq, maraq və dəyişikliyə can atma',
    tr: 'özgürlük, merak ve değişim arzusu',
    ru: 'свобода, любопытство и жажда перемен',
  },
  6: {
    en: 'responsibility, care, and devotion to home and others',
    az: 'məsuliyyət, qayğı və ev ilə yaxınlara bağlılıq',
    tr: 'sorumluluk, şefkat ve eve ile sevdiklerine bağlılık',
    ru: 'ответственность, забота и преданность дому и близким',
  },
  7: {
    en: 'analysis, introspection, and a search for deeper truth',
    az: 'təhlil, daxili düşüncə və dərin həqiqət axtarışı',
    tr: 'analiz, iç gözlem ve derin hakikat arayışı',
    ru: 'анализ, самопознание и поиск глубокой истины',
  },
  8: {
    en: 'ambition, authority, and material mastery',
    az: 'iddia, nüfuz və maddi ustalıq',
    tr: 'hırs, otorite ve maddi ustalık',
    ru: 'амбиция, авторитет и власть над материальным',
  },
  9: {
    en: 'compassion, idealism, and a wide, humanitarian view',
    az: 'mərhəmət, idealizm və geniş, humanist baxış',
    tr: 'şefkat, idealizm ve geniş, insancıl bir bakış',
    ru: 'сострадание, идеализм и широкий, человеколюбивый взгляд',
  },
  11: {
    en: 'heightened intuition, inspiration, and spiritual sensitivity',
    az: 'yüksək intuisiya, ilham və mənəvi həssaslıq',
    tr: 'yükselmiş sezgi, ilham ve manevi duyarlılık',
    ru: 'обострённая интуиция, вдохновение и духовная чуткость',
  },
  22: {
    en: 'visionary scope paired with the power to build it in the real world',
    az: 'geniş vizyon və onu real dünyada qurma gücü',
    tr: 'geniş bir vizyon ve onu gerçek dünyada inşa etme gücü',
    ru: 'масштабное видение и сила воплотить его в реальном мире',
  },
  33: {
    en: 'selfless service, healing, and compassionate teaching',
    az: 'fədakar xidmət, şəfa və mərhəmətli öyrətmə',
    tr: 'özverili hizmet, şifa ve şefkatli öğreticilik',
    ru: 'самоотверженное служение, исцеление и сострадательное наставничество',
  },
};

/** A challenge's lesson as an infinitive phrase — slots into "learning to …". Covers 0–8. */
const CHALLENGE_ESSENCE: Record<number, LocalizedText> = {
  0: {
    en: 'find your own footing when no single influence points the way',
    az: 'heç bir təsir yol göstərmədikdə öz yolunuzu tapmağı',
    tr: 'hiçbir etki yol göstermezken kendi yolunuzu bulmayı',
    ru: 'находить опору в себе, когда ни одно влияние не указывает путь',
  },
  1: {
    en: 'assert yourself without overpowering the people around you',
    az: 'ətrafınızdakıları əzmədən özünüzü təsdiq etməyi',
    tr: 'çevrenizdekileri ezmeden kendinizi ortaya koymayı',
    ru: 'утверждать себя, не подавляя окружающих',
  },
  2: {
    en: 'trust your own voice instead of over-adapting to keep the peace',
    az: 'sülhü qorumaq üçün həddindən artıq güzəştə getmək əvəzinə öz səsinizə güvənməyi',
    tr: 'huzuru korumak için fazla uyum sağlamak yerine kendi sesinize güvenmeyi',
    ru: 'доверять собственному голосу вместо того, чтобы уступать ради мира',
  },
  3: {
    en: 'focus your creativity instead of scattering or doubting it',
    az: 'yaradıcılığınızı dağıtmaq və ya ondan şübhələnmək əvəzinə cəmləməyi',
    tr: 'yaratıcılığınızı dağıtmak ya da ondan şüphe etmek yerine odaklamayı',
    ru: 'сосредоточивать творчество вместо того, чтобы распылять его или сомневаться в нём',
  },
  4: {
    en: 'build steady discipline without becoming rigid or overworked',
    az: 'sərtləşmədən və özünüzü yormadan sabit intizam qurmağı',
    tr: 'katılaşmadan ve kendinizi yıpratmadan istikrarlı bir disiplin kurmayı',
    ru: 'выстраивать устойчивую дисциплину, не становясь жёстким и не изматывая себя',
  },
  5: {
    en: 'enjoy freedom without slipping into restlessness or excess',
    az: 'narahatlığa və ya həddi aşmağa yuvarlanmadan azadlıqdan həzz almağı',
    tr: 'huzursuzluğa ya da aşırılığa kapılmadan özgürlüğün tadını çıkarmayı',
    ru: 'пользоваться свободой, не соскальзывая в беспокойство и излишества',
  },
  6: {
    en: 'care for others without carrying burdens that were never yours',
    az: 'heç vaxt sizə aid olmayan yükləri daşımadan başqalarına qayğı göstərməyi',
    tr: 'hiç size ait olmayan yükleri taşımadan başkalarına özen göstermeyi',
    ru: 'заботиться о других, не взваливая на себя чужого груза',
  },
  7: {
    en: 'open up to others instead of retreating into isolation',
    az: 'təcridə çəkilmək əvəzinə başqalarına açılmağı',
    tr: 'yalnızlığa çekilmek yerine başkalarına açılmayı',
    ru: 'открываться людям вместо того, чтобы замыкаться в одиночестве',
  },
  8: {
    en: 'handle money and power without letting them measure your worth',
    az: 'pul və gücün dəyərinizi ölçməsinə imkan vermədən onları idarə etməyi',
    tr: 'para ve gücün değerinizi ölçmesine izin vermeden onları yönetmeyi',
    ru: 'обращаться с деньгами и властью, не позволяя им мерить вашу ценность',
  },
};

/** The specific talent each birthday (1–31) confers, as a noun phrase. */
const BIRTHDAY_GIFT: Record<number, LocalizedText> = {
  1: {
    en: 'a natural drive to begin things and lead',
    az: 'işə başlamaq və öndə getmək üçün təbii bir həvəs',
    tr: 'işe başlamak ve önde gitmek için doğal bir dürtü',
    ru: 'природная тяга начинать дела и вести за собой',
  },
  2: {
    en: "a gift for cooperation and reading people's feelings",
    az: 'əməkdaşlıq və insanların hisslərini oxumaq bacarığı',
    tr: 'iş birliği ve insanların duygularını okuma yeteneği',
    ru: 'дар к сотрудничеству и чуткость к чувствам людей',
  },
  3: {
    en: 'an easy, expressive creativity and social charm',
    az: 'rahat, ifadəli yaradıcılıq və ünsiyyət cazibəsi',
    tr: 'rahat, ifadeli bir yaratıcılık ve sosyal çekicilik',
    ru: 'лёгкое, выразительное творчество и обаяние в общении',
  },
  4: {
    en: 'a reliable, methodical way of building things to last',
    az: 'davamlı şeylər qurmağın etibarlı, sistemli yolu',
    tr: 'kalıcı şeyler inşa etmenin güvenilir, düzenli yolu',
    ru: 'надёжная, методичная способность строить на века',
  },
  5: {
    en: 'a versatile, adventurous love of variety and freedom',
    az: 'çoxşaxəli, macəraçı müxtəliflik və azadlıq sevgisi',
    tr: 'çok yönlü, maceracı bir çeşitlilik ve özgürlük sevgisi',
    ru: 'разносторонняя, авантюрная любовь к разнообразию и свободе',
  },
  6: {
    en: 'a caring, responsible devotion to home and others',
    az: 'ev və yaxınlara qayğılı, məsuliyyətli bağlılıq',
    tr: 'eve ve sevdiklerine şefkatli, sorumlu bir bağlılık',
    ru: 'заботливая, ответственная преданность дому и близким',
  },
  7: {
    en: 'an analytical, reflective mind drawn to deeper questions',
    az: 'dərin suallara meyilli təhlilçi, düşüncəli zehin',
    tr: 'derin sorulara yönelen analitik, düşünceli bir zihin',
    ru: 'аналитический, вдумчивый ум, тянущийся к глубоким вопросам',
  },
  8: {
    en: 'a capable head for business, ambition, and organisation',
    az: 'biznes, iddia və təşkilatçılıq üçün bacarıqlı zehin',
    tr: 'iş, hırs ve organizasyon için yetkin bir kafa',
    ru: 'деловая хватка, амбиция и умение организовывать',
  },
  9: {
    en: 'a broad, compassionate concern for the wider world',
    az: 'geniş dünyaya qarşı geniş, mərhəmətli maraq',
    tr: 'daha geniş dünyaya karşı geniş, şefkatli bir ilgi',
    ru: 'широкое, сострадательное участие к большому миру',
  },
  10: {
    en: 'strong leadership steadied by focus and self-reliance',
    az: 'diqqət və özünə güvənlə möhkəmlənmiş güclü liderlik',
    tr: 'odak ve öz güvenle sağlamlaşmış güçlü bir liderlik',
    ru: 'сильное лидерство, укреплённое собранностью и опорой на себя',
  },
  11: {
    en: 'heightened intuition and a quietly inspiring presence',
    az: 'yüksək intuisiya və sakitcə ilham verən mövcudluq',
    tr: 'yükselmiş sezgi ve sessizce ilham veren bir varlık',
    ru: 'обострённая интуиция и тихо вдохновляющее присутствие',
  },
  12: {
    en: 'a lively imagination expressed with warmth and wit',
    az: 'istilik və zəka ilə ifadə olunan canlı təxəyyül',
    tr: 'sıcaklık ve zekâyla ifade edilen canlı bir hayal gücü',
    ru: 'живое воображение, выраженное с теплотой и остроумием',
  },
  13: {
    en: 'the discipline to turn steady, honest effort into results',
    az: 'sabit, dürüst zəhməti nəticəyə çevirən intizam',
    tr: 'istikrarlı, dürüst emeği sonuca dönüştüren disiplin',
    ru: 'дисциплина, обращающая упорный честный труд в результат',
  },
  14: {
    en: 'an adaptable, restless energy that thrives on change',
    az: 'dəyişiklikdən güc alan uyğunlaşan, narahat enerji',
    tr: 'değişimden beslenen uyumlu, huzursuz bir enerji',
    ru: 'гибкая, беспокойная энергия, живущая переменами',
  },
  15: {
    en: 'a warm sense of responsibility for those you love',
    az: 'sevdikləriniz üçün isti məsuliyyət hissi',
    tr: 'sevdikleriniz için sıcak bir sorumluluk duygusu',
    ru: 'тёплое чувство ответственности за тех, кого любишь',
  },
  16: {
    en: 'a reflective, self-searching depth of insight',
    az: 'düşüncəli, öz-özünü axtaran dərin idrak',
    tr: 'düşünceli, kendini arayan derin bir kavrayış',
    ru: 'вдумчивая, обращённая внутрь глубина понимания',
  },
  17: {
    en: 'ambition matched by endurance and self-control',
    az: 'dözüm və özünüidarə ilə tamamlanan iddia',
    tr: 'dayanıklılık ve öz denetimle desteklenen hırs',
    ru: 'амбиция в паре с выдержкой и самоконтролем',
  },
  18: {
    en: 'a generous drive to help on a larger scale',
    az: 'daha geniş miqyasda kömək etmək üçün comərd həvəs',
    tr: 'daha büyük ölçekte yardım etmeye dönük cömert bir dürtü',
    ru: 'щедрое стремление помогать в большом масштабе',
  },
  19: {
    en: 'independent resolve and the will to stand alone',
    az: 'müstəqil qətiyyət və tək dayanmaq iradəsi',
    tr: 'bağımsız bir kararlılık ve tek başına durma iradesi',
    ru: 'независимая решимость и воля стоять в одиночку',
  },
  20: {
    en: 'a heightened sensitivity and a talent for harmony',
    az: 'yüksək həssaslıq və harmoniya istedadı',
    tr: 'yükselmiş bir duyarlılık ve uyum yeteneği',
    ru: 'обострённая чувствительность и талант к гармонии',
  },
  21: {
    en: 'an optimistic, sociable gift for self-expression',
    az: 'nikbin, ünsiyyətcil özünüifadə bacarığı',
    tr: 'iyimser, sosyal bir kendini ifade yeteneği',
    ru: 'оптимистичный, общительный дар самовыражения',
  },
  22: {
    en: 'the vision and grounding of a master builder',
    az: 'usta qurucunun vizyonu və reallığa bağlılığı',
    tr: 'usta bir inşacının vizyonu ve gerçekçiliği',
    ru: 'видение и основательность мастера-строителя',
  },
  23: {
    en: 'a quick, versatile mind that adapts to anything',
    az: 'hər şeyə uyğunlaşan cəld, çoxşaxəli zehin',
    tr: 'her şeye uyum sağlayan hızlı, çok yönlü bir zihin',
    ru: 'быстрый, разносторонний ум, приспосабливающийся ко всему',
  },
  24: {
    en: 'a devoted, supportive care for family and home',
    az: 'ailə və ev üçün sadiq, dəstəkləyici qayğı',
    tr: 'aile ve ev için adanmış, destekleyici bir özen',
    ru: 'преданная, поддерживающая забота о семье и доме',
  },
  25: {
    en: 'an intuitive, analytical search for understanding',
    az: 'anlamaq üçün intuitiv, təhlilçi axtarış',
    tr: 'anlamaya yönelik sezgisel, analitik bir arayış',
    ru: 'интуитивный, аналитический поиск понимания',
  },
  26: {
    en: 'practical ambition and sound judgement about resources',
    az: 'praktik iddia və resurslar barədə sağlam mühakimə',
    tr: 'pratik hırs ve kaynaklar konusunda sağlam bir muhakeme',
    ru: 'практичная амбиция и трезвое чувство ресурсов',
  },
  27: {
    en: 'a compassionate wisdom and wide-hearted generosity',
    az: 'mərhəmətli müdriklik və geniş ürəkli comərdlik',
    tr: 'şefkatli bir bilgelik ve geniş yürekli bir cömertlik',
    ru: 'сострадательная мудрость и широта душевной щедрости',
  },
  28: {
    en: 'independent leadership balanced with cooperation',
    az: 'əməkdaşlıqla tarazlanmış müstəqil liderlik',
    tr: 'iş birliğiyle dengelenmiş bağımsız bir liderlik',
    ru: 'независимое лидерство, уравновешенное сотрудничеством',
  },
  29: {
    en: 'an inspired, intuitive sensitivity to others',
    az: 'başqalarına qarşı ilhamlı, intuitiv həssaslıq',
    tr: 'başkalarına karşı ilhamlı, sezgisel bir duyarlılık',
    ru: 'вдохновенная, интуитивная чуткость к другим',
  },
  30: {
    en: 'a richly creative and expressive imagination',
    az: 'zəngin yaradıcı və ifadəli təxəyyül',
    tr: 'zengin, yaratıcı ve ifade gücü yüksek bir hayal gücü',
    ru: 'богатое, творческое и выразительное воображение',
  },
  31: {
    en: 'steady, practical discipline with a creative streak',
    az: 'yaradıcı cizgiyə malik sabit, praktik intizam',
    tr: 'yaratıcı bir yana sahip istikrarlı, pratik bir disiplin',
    ru: 'устойчивая, практичная дисциплина с творческой жилкой',
  },
};

function composeNumerology(
  kind: NumerologyNumberKind,
  value: number,
  locale: InterpretationLocale,
): string {
  const label = KIND_LABEL[kind][locale];
  const frame = KIND_FRAME[kind][locale];
  const style = NUMEROLOGY_STYLE[kind];

  if (style === 'challenge') {
    const lesson = CHALLENGE_ESSENCE[value]![locale];
    switch (locale) {
      case 'en':
        return `Your ${label} number is ${value}. It ${frame}, and the growth lies in learning to ${lesson}.`;
      case 'az':
        return `${label} rəqəminiz — ${value}. Bu rəqəm ${frame} və inkişaf ${lesson} öyrənməkdədir.`;
      case 'tr':
        return `${label} sayınız ${value}. Bu sayı ${frame} ve gelişim ${lesson} öğrenmekte yatar.`;
      case 'ru':
        return `Число ${label} — ${value}. Оно ${frame}, а рост — в том, чтобы научиться ${lesson}.`;
    }
  }

  if (style === 'birthday') {
    const gift = BIRTHDAY_GIFT[value]![locale];
    switch (locale) {
      case 'en':
        return `Your ${label} number is ${value}. It ${frame}, specifically ${gift}.`;
      case 'az':
        return `${label} rəqəminiz — ${value}. Bu rəqəm ${frame}, konkret olaraq ${gift}.`;
      case 'tr':
        return `${label} sayınız ${value}. Bu sayı ${frame}, özellikle ${gift}.`;
      case 'ru':
        return `Число ${label} — ${value}. Оно ${frame}. Это ${gift}.`;
    }
  }

  // style === 'general': the number's core meaning, differentiated by the frame.
  const essence = NUMBER_ESSENCE[value]![locale];
  switch (locale) {
    case 'en':
      return `Your ${label} number is ${value}. It ${frame}, and here that shows up as ${essence}.`;
    case 'az':
      return `${label} rəqəminiz — ${value}. Bu rəqəm ${frame} və bu enerji burada ${essence} kimi təzahür edir.`;
    case 'tr':
      return `${label} sayınız ${value}. Bu sayı ${frame} ve bu enerji burada ${essence} olarak ortaya çıkar.`;
    case 'ru':
      return `Число ${label} — ${value}. Оно ${frame}, и здесь это проявляется как ${essence}.`;
  }
}

/** One generated row, ready to be upserted into the `interpretation_texts` table. */
export interface GeneratedInterpretation {
  category: InterpretationCategory;
  subjectKey: string;
  locale: InterpretationLocale;
  content: string;
}

/**
 * Generate original interpretation content for every (category, subjectKey)
 * combination `listInterpretationSubjects()` requires, in every
 * {@link SUPPORTED_LOCALES} locale:
 *
 * - astrology — the ten {@link INTERPRETED_BODIES} across all twelve signs, all
 *   twelve houses, and every major aspect between them (465 subjects), and
 * - numerology — all 185 subjects across the sixteen numerology kinds.
 *
 * Mirrors the loop structure and value ranges of `listInterpretationSubjects()`
 * / `listNumerologySubjects()` (calc-engine) so the two describe the same
 * 650-subject set; see `seedContent.test.ts` for the parity check.
 */
export function generateSeedInterpretations(): GeneratedInterpretation[] {
  const rows: GeneratedInterpretation[] = [];

  for (const body of INTERPRETED_BODIES) {
    for (const sign of SIGNS) {
      for (const locale of SUPPORTED_LOCALES) {
        rows.push({
          category: 'planet-sign',
          subjectKey: planetSignSubjectKey(body, sign),
          locale,
          content: composePlanetSign(body, sign, locale),
        });
      }
    }
    for (const house of HOUSES) {
      for (const locale of SUPPORTED_LOCALES) {
        rows.push({
          category: 'planet-house',
          subjectKey: planetHouseSubjectKey(body, house),
          locale,
          content: composePlanetHouse(body, house, locale),
        });
      }
    }
  }

  for (let i = 0; i < INTERPRETED_BODIES.length; i++) {
    for (let j = i + 1; j < INTERPRETED_BODIES.length; j++) {
      const bodyA = INTERPRETED_BODIES[i]!;
      const bodyB = INTERPRETED_BODIES[j]!;
      const sorted = [bodyA, bodyB].sort();
      const sortedA = sorted[0]!;
      const sortedB = sorted[1]!;
      for (const type of ASPECT_TYPES) {
        for (const locale of SUPPORTED_LOCALES) {
          rows.push({
            category: 'aspect',
            // Same alphabetical order as `aspectSubjectKey`, so the sentence always
            // names the two bodies in the same order the subjectKey itself implies.
            subjectKey: aspectSubjectKey(type, bodyA, bodyB),
            locale,
            content: composeAspect(type, sortedA, sortedB, locale),
          });
        }
      }
    }
  }

  for (const kind of Object.keys(NUMEROLOGY_KIND_RANGES) as NumerologyNumberKind[]) {
    for (const value of NUMEROLOGY_KIND_RANGES[kind]) {
      for (const locale of SUPPORTED_LOCALES) {
        rows.push({
          category: 'numerology',
          subjectKey: numerologySubjectKey(kind, value),
          locale,
          content: composeNumerology(kind, value, locale),
        });
      }
    }
  }

  return rows;
}
