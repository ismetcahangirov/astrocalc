import {
  aspectSubjectKey,
  INTERPRETED_BODIES,
  planetHouseSubjectKey,
  planetSignSubjectKey,
  SUPPORTED_LOCALES,
  type AspectType,
  type CelestialBody,
  type InterpretationCategory,
  type InterpretationLocale,
  type ZodiacSign,
} from '@astrocalc/calc-engine';

/**
 * Original (not copied from any other site) natal-chart interpretation text,
 * generated for every (category, subjectKey) combination
 * {@link listInterpretationSubjects} enumerates, in all four
 * {@link SUPPORTED_LOCALES}. Each language sentence is composed from a small
 * bank of hand-written phrases — the planet's core theme, the sign/house's
 * quality, the aspect's dynamic — plugged into a fixed per-locale sentence
 * template, so every one of the 1,860 rows is unique, complete prose rather
 * than a copy-pasted placeholder.
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

/** One generated row, ready to be upserted into the `interpretation_texts` table. */
export interface GeneratedInterpretation {
  category: InterpretationCategory;
  subjectKey: string;
  locale: InterpretationLocale;
  content: string;
}

/**
 * Generate original interpretation content for every (category, subjectKey)
 * combination the ten {@link INTERPRETED_BODIES} require, across all twelve
 * signs, all twelve houses, and every major aspect between them — in every
 * {@link SUPPORTED_LOCALES} locale. Mirrors the exact loop structure of
 * `listInterpretationSubjects()` (calc-engine) so the two are guaranteed to
 * describe the same 465-subject matrix; see `seedContent.test.ts` for the
 * parity check.
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

  return rows;
}
