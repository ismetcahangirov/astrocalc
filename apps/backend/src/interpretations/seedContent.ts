import {
  ANGLE_KINDS,
  angleSubjectKey,
  ARCANA_VALUES,
  aspectSubjectKey,
  houseSubjectKey,
  INTERPRETED_BODIES,
  matrixSubjectKey,
  numerologySubjectKey,
  planetHouseSubjectKey,
  planetSignSubjectKey,
  SUPPORTED_LOCALES,
  type AngleKind,
  type AspectType,
  type CelestialBody,
  type InterpretationCategory,
  type InterpretationLocale,
  type MatrixSubjectKind,
  type NumerologyNumberKind,
  type ZodiacSign,
} from '@astrocalc/calc-engine';

/**
 * Original (not copied from any other site) interpretation text, generated for
 * every (category, subjectKey) combination {@link listInterpretationSubjects}
 * enumerates, in all four {@link SUPPORTED_LOCALES}. Each language sentence is
 * composed from a small bank of hand-written phrases — for astrology the
 * planet's core theme, the sign/house's quality, the aspect's dynamic; for
 * numerology the position's frame and the number's meaning; for the Matrix the
 * arcana's meaning and the octagram position's frame — plugged into a fixed
 * per-locale sentence template, so every one of the 5,328 rows (1,332 subjects
 * × 4 locales) is unique, complete prose rather than a copy-pasted placeholder.
 *
 * Coverage: 465 astrology subjects (#18) + 185 numerology subjects (content
 * epic #76: #77/#78/#79) + 682 Matrix subjects (#76: #80 base arcana, #81
 * position-specific) — the full set `listInterpretationSubjects()` enumerates.
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

/**
 * The generic meaning of a whole house (#106) — reuses the {@link HOUSE_AREA}
 * life-area phrase and {@link HOUSE_ORDINAL} that already back the planet-house
 * text, but reads it on its own rather than through a planet.
 */
function composeHouse(house: number, locale: InterpretationLocale): string {
  const area = HOUSE_AREA[house]![locale];

  switch (locale) {
    case 'en':
      return `The ${HOUSE_ORDINAL[house]!.en} house governs ${area}. It shows the area of life where these themes play out for you.`;
    case 'az':
      return `${HOUSE_ORDINAL[house]!.az} ev ${area} sahəsini idarə edir. Bu, həmin mövzuların həyatınızda təzahür etdiyi sahəni göstərir.`;
    case 'tr':
      return `${HOUSE_ORDINAL[house]!.tr} ev ${area} alanını yönetir. Bu temaların yaşamınızda ortaya çıktığı alanı gösterir.`;
    case 'ru':
      return `Дом ${house} управляет сферой: ${area}. Он показывает область жизни, где эти темы проявляются для вас.`;
  }
}

/** Each angle's display name, per locale. */
const ANGLE_NAME: Record<AngleKind, LocalizedText> = {
  ascendant: { en: 'The Ascendant', az: 'Yüksələn (ASC)', tr: 'Yükselen (ASC)', ru: 'Асцендент' },
  midheaven: {
    en: 'The Midheaven',
    az: 'Zenit (MC)',
    tr: 'Tepe Noktası (MC)',
    ru: 'Середина неба (MC)',
  },
};

/** What each angle governs — a verb clause following the angle name. */
const ANGLE_FRAME: Record<AngleKind, LocalizedText> = {
  ascendant: {
    en: 'shapes the first impression you make and how you meet the world',
    az: 'yaratdığınız ilk təəssüratı və dünya ilə qarşılaşma tərzinizi formalaşdırır',
    tr: 'bıraktığınız ilk izlenimi ve dünyayla karşılaşma biçiminizi şekillendirir',
    ru: 'формирует первое впечатление и то, как вы встречаете мир',
  },
  midheaven: {
    en: 'points to your public role, career direction, and reputation',
    az: 'ictimai rolunuza, karyera istiqamətinizə və nüfuzunuza işarə edir',
    tr: 'toplumsal rolünüze, kariyer yönünüze ve itibarınıza işaret eder',
    ru: 'указывает на вашу публичную роль, карьерное направление и репутацию',
  },
};

/**
 * The meaning of a chart angle in a sign (#106) — same shape as
 * {@link composePlanetSign}: the angle's frame woven with the sign's trait.
 */
function composeAngle(kind: AngleKind, sign: ZodiacSign, locale: InterpretationLocale): string {
  const angle = ANGLE_NAME[kind][locale];
  const frame = ANGLE_FRAME[kind][locale];
  const signName = SIGN_NAME[sign][locale];
  const trait = SIGN_TRAIT[sign][locale];

  switch (locale) {
    case 'en':
      return `${angle} ${frame}. In ${signName}, this comes across as ${trait}.`;
    case 'az':
      return `${angle} ${frame}. ${signName} bürcündə bu, ${trait} şəkildə özünü göstərir.`;
    case 'tr':
      return `${angle} ${frame}. ${signName} burcunda bu, ${trait} bir şekilde kendini gösterir.`;
    case 'ru':
      return `${angle} ${frame}. В знаке ${signName} это проявляется ${trait}.`;
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

// ── Matrix of Destiny (#67 content epic #76: base arcana #80, position-specific ─
//    #81) ────────────────────────────────────────────────────────────────────
//
// Two blocks, same compositional approach as astrology and numerology above:
//
//  - #80 — the base meaning of each of the 22 Major Arcana, the theme it carries
//    wherever it lands (subject `arcana-{1..22}`).
//  - #81 — that same arcana read at each of the 30 named positions of the
//    octagram (subject `${position}-{1..22}`). Written per position, because the
//    Emperor on the day point and the Emperor on the father's line are different
//    readings — the position frame carries the difference, the arcana meaning is
//    the shared thread.
//
// The 682 keys are owned by `listMatrixSubjects()` in calc-engine;
// `matrixSubjectKey()` rejects any arcana outside 1–22, and `seedContent.test.ts`
// checks this generator against that list, so nothing here can drift from it.

/** The 22 Major Arcana names, per locale. Proper nouns — transliterated, not translated. */
const ARCANA_NAME: Record<number, LocalizedText> = {
  1: { en: 'the Magician', az: 'Sehrbaz', tr: 'Büyücü', ru: 'Маг' },
  2: { en: 'the High Priestess', az: 'Baş Kahin', tr: 'Başrahibe', ru: 'Верховная Жрица' },
  3: { en: 'the Empress', az: 'İmperatriça', tr: 'İmparatoriçe', ru: 'Императрица' },
  4: { en: 'the Emperor', az: 'İmperator', tr: 'İmparator', ru: 'Император' },
  5: { en: 'the Hierophant', az: 'Baş Rahib', tr: 'Başrahip', ru: 'Иерофант' },
  6: { en: 'the Lovers', az: 'Aşiqlər', tr: 'Âşıklar', ru: 'Влюблённые' },
  7: { en: 'the Chariot', az: 'Araba', tr: 'Savaş Arabası', ru: 'Колесница' },
  8: { en: 'Justice', az: 'Ədalət', tr: 'Adalet', ru: 'Справедливость' },
  9: { en: 'the Hermit', az: 'Zahid', tr: 'Ermiş', ru: 'Отшельник' },
  10: { en: 'the Wheel of Fortune', az: 'Tale Çarxı', tr: 'Kader Çarkı', ru: 'Колесо Фортуны' },
  11: { en: 'Strength', az: 'Güc', tr: 'Güç', ru: 'Сила' },
  12: { en: 'the Hanged Man', az: 'Asılmış Adam', tr: 'Asılan Adam', ru: 'Повешенный' },
  13: { en: 'Death', az: 'Ölüm', tr: 'Ölüm', ru: 'Смерть' },
  14: { en: 'Temperance', az: 'Mötədillik', tr: 'Denge', ru: 'Умеренность' },
  15: { en: 'the Devil', az: 'Şeytan', tr: 'Şeytan', ru: 'Дьявол' },
  16: { en: 'the Tower', az: 'Qüllə', tr: 'Kule', ru: 'Башня' },
  17: { en: 'the Star', az: 'Ulduz', tr: 'Yıldız', ru: 'Звезда' },
  18: { en: 'the Moon', az: 'Ay', tr: 'Ay', ru: 'Луна' },
  19: { en: 'the Sun', az: 'Günəş', tr: 'Güneş', ru: 'Солнце' },
  20: { en: 'Judgement', az: 'Mühakimə', tr: 'Mahkeme', ru: 'Суд' },
  21: { en: 'the World', az: 'Dünya', tr: 'Dünya', ru: 'Мир' },
  22: { en: 'the Fool', az: 'Dəli', tr: 'Deli', ru: 'Шут' },
};

/** Each arcana's core meaning as a noun phrase — slots into "brings …" / "проявляется как …". */
const ARCANA_MEANING: Record<number, LocalizedText> = {
  1: {
    en: 'will, skill, and the power to turn ideas into action',
    az: 'iradə, bacarıq və fikirləri əmələ çevirmə gücü',
    tr: 'irade, beceri ve fikirleri eyleme dönüştürme gücü',
    ru: 'воля, умение и сила воплощать замыслы в дела',
  },
  2: {
    en: 'intuition, inner wisdom, and knowledge kept below the surface',
    az: 'intuisiya, daxili müdriklik və səthin altında saxlanan bilik',
    tr: 'sezgi, iç bilgelik ve yüzeyin altında saklı bilgi',
    ru: 'интуиция, внутренняя мудрость и скрытое знание',
  },
  3: {
    en: 'fertility, abundance, and nurturing creativity',
    az: 'bərəkət, bolluq və qayğıkeş yaradıcılıq',
    tr: 'bereket, bolluk ve şefkatli yaratıcılık',
    ru: 'плодородие, изобилие и заботливое творчество',
  },
  4: {
    en: 'authority, structure, and stable leadership',
    az: 'hakimiyyət, struktur və sabit liderlik',
    tr: 'otorite, yapı ve istikrarlı liderlik',
    ru: 'власть, структура и устойчивое лидерство',
  },
  5: {
    en: 'tradition, teaching, and guidance by shared values',
    az: 'ənənə, təlim və ortaq dəyərlərlə istiqamətlənmə',
    tr: 'gelenek, öğreti ve ortak değerlerle yönlenme',
    ru: 'традиция, наставничество и опора на общие ценности',
  },
  6: {
    en: 'love, meaningful choice, and union',
    az: 'sevgi, mənalı seçim və birlik',
    tr: 'sevgi, anlamlı seçim ve birliktelik',
    ru: 'любовь, значимый выбор и союз',
  },
  7: {
    en: 'drive, self-command, and victory won by control',
    az: 'həvəs, özünəhakimlik və nəzarətlə qazanılan qələbə',
    tr: 'azim, öz denetimi ve denetimle kazanılan zafer',
    ru: 'напор, самообладание и победа через контроль',
  },
  8: {
    en: 'fairness, balance, and the law of cause and effect',
    az: 'ədalət, tarazlıq və səbəb-nəticə qanunu',
    tr: 'adalet, denge ve neden-sonuç yasası',
    ru: 'справедливость, равновесие и закон причины и следствия',
  },
  9: {
    en: 'introspection, solitude, and hard-won wisdom',
    az: 'daxili düşüncə, tənhalıq və çətinliklə qazanılmış müdriklik',
    tr: 'iç gözlem, yalnızlık ve zorlukla kazanılmış bilgelik',
    ru: 'самопознание, уединение и трудно добытая мудрость',
  },
  10: {
    en: 'cycles, turning points, and the turns of fate',
    az: 'dövrlər, dönüş nöqtələri və talenin gərdişi',
    tr: 'döngüler, dönüm noktaları ve kaderin dönüşleri',
    ru: 'циклы, поворотные точки и повороты судьбы',
  },
  11: {
    en: 'courage, inner strength, and patient self-mastery',
    az: 'cəsarət, daxili güc və səbirli özünəhakimlik',
    tr: 'cesaret, iç güç ve sabırlı öz hâkimiyet',
    ru: 'мужество, внутренняя сила и терпеливое владение собой',
  },
  12: {
    en: 'surrender, a fresh perspective, and letting go',
    az: 'təslimiyyət, yeni baxış və buraxma',
    tr: 'teslimiyet, yeni bir bakış ve bırakabilme',
    ru: 'смирение, новый взгляд и умение отпускать',
  },
  13: {
    en: 'endings, transformation, and rebirth',
    az: 'sonluqlar, transformasiya və yenidən doğulma',
    tr: 'sonlar, dönüşüm ve yeniden doğuş',
    ru: 'завершения, преображение и перерождение',
  },
  14: {
    en: 'balance, moderation, and quiet healing',
    az: 'tarazlıq, mötədillik və sakit şəfa',
    tr: 'denge, ölçülülük ve sakin bir şifa',
    ru: 'равновесие, умеренность и тихое исцеление',
  },
  15: {
    en: 'attachment, temptation, and the pull of the material',
    az: 'bağlılıq, şirnikləndirmə və maddiyyatın cazibəsi',
    tr: 'bağımlılık, ayartı ve maddiyatın çekimi',
    ru: 'привязанность, соблазн и притяжение материального',
  },
  16: {
    en: 'sudden upheaval, breakdown, and revealing truth',
    az: 'qəfil sarsıntı, dağılma və üzə çıxan həqiqət',
    tr: 'ani sarsıntı, çöküş ve açığa çıkan gerçek',
    ru: 'внезапное потрясение, крушение и открывшаяся правда',
  },
  17: {
    en: 'hope, inspiration, and serene renewal',
    az: 'ümid, ilham və dinc yeniləşmə',
    tr: 'umut, ilham ve huzurlu bir yenilenme',
    ru: 'надежда, вдохновение и безмятежное обновление',
  },
  18: {
    en: 'intuition, dreams, and the pull of the unconscious',
    az: 'intuisiya, xəyallar və şüuraltının cazibəsi',
    tr: 'sezgi, rüyalar ve bilinçaltının çekimi',
    ru: 'интуиция, сны и притяжение бессознательного',
  },
  19: {
    en: 'joy, vitality, and open success',
    az: 'sevinc, canlılıq və açıq uğur',
    tr: 'neşe, canlılık ve açık bir başarı',
    ru: 'радость, жизненная сила и явный успех',
  },
  20: {
    en: 'awakening, honest reckoning, and renewal',
    az: 'oyanış, dürüst hesablaşma və yeniləşmə',
    tr: 'uyanış, dürüst bir hesaplaşma ve yenilenme',
    ru: 'пробуждение, честный пересмотр и обновление',
  },
  21: {
    en: 'completion, wholeness, and fulfilment',
    az: 'tamamlanma, bütövlük və reallaşma',
    tr: 'tamamlanma, bütünlük ve gerçekleşme',
    ru: 'завершённость, целостность и осуществление',
  },
  22: {
    en: 'new beginnings, freedom, and a leap of faith',
    az: 'yeni başlanğıclar, azadlıq və inam sıçrayışı',
    tr: 'yeni başlangıçlar, özgürlük ve bir inanç sıçrayışı',
    ru: 'новые начинания, свобода и прыжок веры',
  },
};

/** The 30 named positions — every {@link MatrixSubjectKind} except the `'arcana'` base. */
type MatrixPosition = Exclude<MatrixSubjectKind, 'arcana'>;

/** Each position's display name, per locale. */
const MATRIX_LABEL: Record<MatrixPosition, LocalizedText> = {
  day: { en: 'Day point', az: 'Gün nöqtəsi', tr: 'Gün noktası', ru: 'Точка Дня' },
  month: { en: 'Month point', az: 'Ay nöqtəsi', tr: 'Ay noktası', ru: 'Точка Месяца' },
  year: { en: 'Year point', az: 'İl nöqtəsi', tr: 'Yıl noktası', ru: 'Точка Года' },
  'karmic-tail': {
    en: 'Karmic tail',
    az: 'Karmik quyruq',
    tr: 'Karmik kuyruk',
    ru: 'Кармический хвост',
  },
  'comfort-zone': {
    en: 'Comfort zone',
    az: 'Rahatlıq zonası',
    tr: 'Konfor alanı',
    ru: 'Зона комфорта',
  },
  sky: { en: 'Sky', az: 'Göy', tr: 'Gök', ru: 'Небо' },
  earth: { en: 'Earth', az: 'Yer', tr: 'Yer', ru: 'Земля' },
  'personal-purpose': {
    en: 'Personal purpose',
    az: 'Şəxsi təyinat',
    tr: 'Kişisel amaç',
    ru: 'Личное предназначение',
  },
  'social-purpose': {
    en: 'Social purpose',
    az: 'Sosial təyinat',
    tr: 'Sosyal amaç',
    ru: 'Социальное предназначение',
  },
  'spiritual-purpose': {
    en: 'Spiritual purpose',
    az: 'Mənəvi təyinat',
    tr: 'Manevi amaç',
    ru: 'Духовное предназначение',
  },
  'planetary-purpose': {
    en: 'Planetary purpose',
    az: 'Planetar təyinat',
    tr: 'Gezegensel amaç',
    ru: 'Планетарное предназначение',
  },
  'paternal-spiritual': {
    en: "Father's line — spiritual",
    az: 'Ata xətti — mənəvi',
    tr: 'Baba çizgisi — manevi',
    ru: 'Линия отца — духовная',
  },
  'paternal-material': {
    en: "Father's line — material",
    az: 'Ata xətti — maddi',
    tr: 'Baba çizgisi — maddi',
    ru: 'Линия отца — материальная',
  },
  'maternal-spiritual': {
    en: "Mother's line — spiritual",
    az: 'Ana xətti — mənəvi',
    tr: 'Anne çizgisi — manevi',
    ru: 'Линия матери — духовная',
  },
  'maternal-material': {
    en: "Mother's line — material",
    az: 'Ana xətti — maddi',
    tr: 'Anne çizgisi — maddi',
    ru: 'Линия матери — материальная',
  },
  'paternal-line': { en: "Father's line", az: 'Ata xətti', tr: 'Baba çizgisi', ru: 'Линия отца' },
  'maternal-line': { en: "Mother's line", az: 'Ana xətti', tr: 'Anne çizgisi', ru: 'Линия матери' },
  'ancestral-centre': {
    en: 'Ancestral centre',
    az: 'Nəsil mərkəzi',
    tr: 'Soy merkezi',
    ru: 'Родовой центр',
  },
  'line-entry': { en: 'Entry point', az: 'Giriş nöqtəsi', tr: 'Giriş noktası', ru: 'Точка входа' },
  'line-toward-entry': {
    en: 'Toward the entry',
    az: 'Girişə doğru',
    tr: 'Girişe doğru',
    ru: 'К точке входа',
  },
  'line-core': {
    en: 'Central energy',
    az: 'Mərkəzi enerji',
    tr: 'Merkezî enerji',
    ru: 'Центральная энергия',
  },
  'line-toward-partner': {
    en: 'Toward the partner',
    az: 'Partnyora doğru',
    tr: 'Partnere doğru',
    ru: 'К партнёру',
  },
  'line-partner': {
    en: 'Partner point',
    az: 'Partnyor nöqtəsi',
    tr: 'Partner noktası',
    ru: 'Точка партнёра',
  },
  'chakra-sahasrara': {
    en: 'Sahasrara (crown)',
    az: 'Sahasrara (tac)',
    tr: 'Sahasrara (taç)',
    ru: 'Сахасрара (венец)',
  },
  'chakra-ajna': {
    en: 'Ajna (third eye)',
    az: 'Acna (üçüncü göz)',
    tr: 'Ajna (üçüncü göz)',
    ru: 'Аджна (третий глаз)',
  },
  'chakra-vishuddha': {
    en: 'Vishuddha (throat)',
    az: 'Vişuddha (boğaz)',
    tr: 'Vişuddha (boğaz)',
    ru: 'Вишудха (горло)',
  },
  'chakra-anahata': {
    en: 'Anahata (heart)',
    az: 'Anahata (ürək)',
    tr: 'Anahata (kalp)',
    ru: 'Анахата (сердце)',
  },
  'chakra-manipura': {
    en: 'Manipura (solar plexus)',
    az: 'Manipura (günəş kələfi)',
    tr: 'Manipura (güneş sinirağı)',
    ru: 'Манипура (солнечное сплетение)',
  },
  'chakra-svadhisthana': {
    en: 'Svadhisthana (sacral)',
    az: 'Svadhistana (sakral)',
    tr: 'Svadhisthana (sakral)',
    ru: 'Свадхистана (сакральная)',
  },
  'chakra-muladhara': {
    en: 'Muladhara (root)',
    az: 'Muladhara (kök)',
    tr: 'Muladhara (kök)',
    ru: 'Муладхара (корень)',
  },
};

/** What each position governs — a noun clause following the label and a dash. */
const MATRIX_FRAME: Record<MatrixPosition, LocalizedText> = {
  day: {
    en: 'who you are at core, your inborn portrait',
    az: 'əsas kimliyiniz, anadangəlmə portretiniz',
    tr: 'özünüzdeki temel kimlik, doğuştan portreniz',
    ru: 'ваша сердцевина, врождённый портрет',
  },
  month: {
    en: 'your innate talents and gifts',
    az: 'anadangəlmə istedad və bacarıqlarınız',
    tr: 'doğuştan yetenekleriniz ve armağanlarınız',
    ru: 'ваши врождённые таланты и дары',
  },
  year: {
    en: 'the ancestral programmes you inherit',
    az: 'miras aldığınız nəsil proqramları',
    tr: 'miras aldığınız soy programları',
    ru: 'родовые программы, которые вы наследуете',
  },
  'karmic-tail': {
    en: 'the task carried over from the past',
    az: 'keçmişdən daşınan vəzifə',
    tr: 'geçmişten taşınan görev',
    ru: 'задача, перенесённая из прошлого',
  },
  'comfort-zone': {
    en: 'the centre — the energy you rest in and return to',
    az: 'mərkəz — dincəldiyiniz və qayıtdığınız enerji',
    tr: 'merkez — dinlendiğiniz ve döndüğünüz enerji',
    ru: 'центр — энергия, в которой вы отдыхаете и к которой возвращаетесь',
  },
  sky: {
    en: 'the spiritual, vertical axis of your chart',
    az: 'xəritənizin mənəvi, şaquli oxu',
    tr: 'haritanızın manevi, dikey ekseni',
    ru: 'духовная, вертикальная ось вашей карты',
  },
  earth: {
    en: 'the material, horizontal axis of your chart',
    az: 'xəritənizin maddi, üfüqi oxu',
    tr: 'haritanızın maddi, yatay ekseni',
    ru: 'материальная, горизонтальная ось вашей карты',
  },
  'personal-purpose': {
    en: 'your task in the first half of life, up to about 40',
    az: 'təxminən 40 yaşa qədər həyatın birinci yarısındakı vəzifəniz',
    tr: 'yaklaşık 40 yaşına dek yaşamın ilk yarısındaki göreviniz',
    ru: 'ваша задача в первой половине жизни, примерно до 40',
  },
  'social-purpose': {
    en: 'your purpose among others, deepening after about 40',
    az: 'təxminən 40 yaşdan sonra dərinləşən, insanlar arasındakı təyinatınız',
    tr: 'yaklaşık 40 yaşından sonra derinleşen, toplum içindeki amacınız',
    ru: 'ваше предназначение среди людей, крепнущее после 40',
  },
  'spiritual-purpose': {
    en: 'your higher, soul-level purpose',
    az: 'daha yüksək, ruh səviyyəsindəki təyinatınız',
    tr: 'daha yüksek, ruh düzeyindeki amacınız',
    ru: 'ваше высшее предназначение на уровне души',
  },
  'planetary-purpose': {
    en: 'your widest purpose — your part in the whole',
    az: 'ən geniş təyinatınız — bütövdəki payınız',
    tr: 'en geniş amacınız — bütündeki payınız',
    ru: 'ваше самое широкое предназначение — ваша часть в целом',
  },
  'paternal-spiritual': {
    en: "the spiritual inheritance of your father's line",
    az: 'ata xəttinizin mənəvi mirası',
    tr: 'baba soyunuzun manevi mirası',
    ru: 'духовное наследие вашей отцовской линии',
  },
  'paternal-material': {
    en: "the material inheritance of your father's line",
    az: 'ata xəttinizin maddi mirası',
    tr: 'baba soyunuzun maddi mirası',
    ru: 'материальное наследие вашей отцовской линии',
  },
  'maternal-spiritual': {
    en: "the spiritual inheritance of your mother's line",
    az: 'ana xəttinizin mənəvi mirası',
    tr: 'anne soyunuzun manevi mirası',
    ru: 'духовное наследие вашей материнской линии',
  },
  'maternal-material': {
    en: "the material inheritance of your mother's line",
    az: 'ana xəttinizin maddi mirası',
    tr: 'anne soyunuzun maddi mirası',
    ru: 'материальное наследие вашей материнской линии',
  },
  'paternal-line': {
    en: "the overall theme passed down your father's line",
    az: 'ata xəttiniz boyu ötürülən ümumi mövzu',
    tr: 'baba soyunuz boyunca aktarılan genel tema',
    ru: 'общая тема, передаваемая по линии отца',
  },
  'maternal-line': {
    en: "the overall theme passed down your mother's line",
    az: 'ana xəttiniz boyu ötürülən ümumi mövzu',
    tr: 'anne soyunuz boyunca aktarılan genel tema',
    ru: 'общая тема, передаваемая по линии матери',
  },
  'ancestral-centre': {
    en: 'the core of your family inheritance, where both lines meet',
    az: 'hər iki xəttin birləşdiyi ailə mirasınızın mərkəzi',
    tr: 'iki çizginin buluştuğu aile mirasınızın merkezi',
    ru: 'ядро семейного наследия, где сходятся обе линии',
  },
  'line-entry': {
    en: 'how money and love first enter your life',
    az: 'pul və sevginin həyatınıza ilk girişi',
    tr: 'para ve sevginin yaşamınıza ilk girişi',
    ru: 'как деньги и любовь впервые входят в вашу жизнь',
  },
  'line-toward-entry': {
    en: 'what draws you toward earning and connection',
    az: 'sizi qazanc və yaxınlığa çəkən şey',
    tr: 'sizi kazanca ve bağa çeken şey',
    ru: 'то, что влечёт вас к заработку и близости',
  },
  'line-core': {
    en: 'the heart of your money-and-love line',
    az: 'pul-sevgi xəttinizin qəlbi',
    tr: 'para-sevgi çizginizin kalbi',
    ru: 'сердце вашей линии денег и любви',
  },
  'line-toward-partner': {
    en: 'how you move toward partnership and wealth',
    az: 'tərəfdaşlığa və varlanmağa doğru hərəkətiniz',
    tr: 'ortaklığa ve zenginliğe doğru hareketiniz',
    ru: 'как вы движетесь к партнёрству и достатку',
  },
  'line-partner': {
    en: 'what you seek and attract in a partner',
    az: 'partnyorda axtardığınız və cəlb etdiyiniz şey',
    tr: 'bir partnerde aradığınız ve çektiğiniz şey',
    ru: 'то, что вы ищете и притягиваете в партнёре',
  },
  'chakra-sahasrara': {
    en: 'the crown chakra — purpose, the head, and spiritual health',
    az: 'tac çakrası — təyinat, baş və mənəvi sağlamlıq',
    tr: 'taç çakrası — amaç, baş ve manevi sağlık',
    ru: 'коронная чакра — предназначение, голова и духовное здоровье',
  },
  'chakra-ajna': {
    en: 'the brow chakra — intuition, vision, and the nerves',
    az: 'qaş çakrası — intuisiya, görüş və sinir sistemi',
    tr: 'kaş çakrası — sezgi, görüş ve sinirler',
    ru: 'чакра лба — интуиция, зрение и нервы',
  },
  'chakra-vishuddha': {
    en: 'the throat chakra — expression, the throat, and the thyroid',
    az: 'boğaz çakrası — ifadə, boğaz və qalxanabənzər vəzi',
    tr: 'boğaz çakrası — ifade, boğaz ve tiroit',
    ru: 'горловая чакра — самовыражение, горло и щитовидка',
  },
  'chakra-anahata': {
    en: 'the heart chakra — love, the heart, and the lungs',
    az: 'ürək çakrası — sevgi, ürək və ağciyərlər',
    tr: 'kalp çakrası — sevgi, kalp ve akciğerler',
    ru: 'сердечная чакра — любовь, сердце и лёгкие',
  },
  'chakra-manipura': {
    en: 'the solar-plexus chakra — will, status, and digestion',
    az: 'günəş kələfi çakrası — iradə, status və həzm',
    tr: 'güneş sinirağı çakrası — irade, statü ve sindirim',
    ru: 'чакра солнечного сплетения — воля, статус и пищеварение',
  },
  'chakra-svadhisthana': {
    en: 'the sacral chakra — pleasure, money, and the reproductive system',
    az: 'sakral çakra — həzz, pul və reproduktiv sistem',
    tr: 'sakral çakra — haz, para ve üreme sistemi',
    ru: 'сакральная чакра — удовольствие, деньги и репродуктивная система',
  },
  'chakra-muladhara': {
    en: "the root chakra — security, survival, and the body's foundation",
    az: 'kök çakrası — təhlükəsizlik, sağ qalma və bədənin təməli',
    tr: 'kök çakrası — güvenlik, hayatta kalma ve bedenin temeli',
    ru: 'корневая чакра — безопасность, выживание и опора тела',
  },
};

function composeMatrix(
  kind: MatrixSubjectKind,
  arcana: number,
  locale: InterpretationLocale,
): string {
  const name = ARCANA_NAME[arcana]![locale];
  const meaning = ARCANA_MEANING[arcana]![locale];

  if (kind === 'arcana') {
    switch (locale) {
      case 'en':
        return `Arcana ${arcana} — ${name} — stands for ${meaning}. This is its base meaning, the theme it carries wherever it falls in your Matrix.`;
      case 'az':
        return `${arcana}. Arkan — ${name} — ${meaning} deməkdir. Bu onun əsas mənasıdır: Matrisin hansı nöqtəsinə düşsə, həmin mövzunu daşıyır.`;
      case 'tr':
        return `${arcana}. Arkan — ${name} — ${meaning} demektir. Bu, onun temel anlamıdır: Matris'te nereye düşerse düşsün taşıdığı tema.`;
      case 'ru':
        return `${arcana}-й Аркан — ${name} — это ${meaning}. Это его базовое значение — тема, которую он несёт, где бы ни выпал в вашей Матрице.`;
    }
  }

  const label = MATRIX_LABEL[kind][locale];
  const frame = MATRIX_FRAME[kind][locale];
  switch (locale) {
    case 'en':
      return `${label} — ${frame}. Here Arcana ${arcana} (${name}) brings ${meaning}.`;
    case 'az':
      return `${label} — ${frame}. Burada ${arcana}. Arkan (${name}) ${meaning} gətirir.`;
    case 'tr':
      return `${label} — ${frame}. Burada ${arcana}. Arkan (${name}) ${meaning} getirir.`;
    case 'ru':
      return `${label} — ${frame}. Здесь ${arcana}-й Аркан (${name}) проявляется как ${meaning}.`;
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
 *   twelve houses, and every major aspect between them (465 subjects), plus the
 *   twelve generic whole-house meanings and the 24 angle-in-sign meanings
 *   (#106, categories `house` and `angle`),
 * - numerology — all 185 subjects across the sixteen numerology kinds, and
 * - Matrix of Destiny — all 682 subjects (22 base arcana + 30 positions × 22).
 *
 * Mirrors the loop structure and value ranges of `listInterpretationSubjects()`
 * / `listNumerologySubjects()` / `listMatrixSubjects()` (calc-engine) so the two
 * describe the same 1,332-subject set; see `seedContent.test.ts` for the parity
 * check.
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

  for (const house of HOUSES) {
    for (const locale of SUPPORTED_LOCALES) {
      rows.push({
        category: 'house',
        subjectKey: houseSubjectKey(house),
        locale,
        content: composeHouse(house, locale),
      });
    }
  }

  for (const kind of ANGLE_KINDS) {
    for (const sign of SIGNS) {
      for (const locale of SUPPORTED_LOCALES) {
        rows.push({
          category: 'angle',
          subjectKey: angleSubjectKey(kind, sign),
          locale,
          content: composeAngle(kind, sign, locale),
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

  // 'arcana' (base, #80) then the 30 named positions (#81). Object.keys is
  // exactly the MatrixPosition set — MATRIX_LABEL is a Record over it, so TS
  // guarantees none is missing — and matrixSubjectKey() + the parity test guard
  // against any drift from calc-engine's listMatrixSubjects().
  const matrixKinds: MatrixSubjectKind[] = [
    'arcana',
    ...(Object.keys(MATRIX_LABEL) as MatrixPosition[]),
  ];
  for (const kind of matrixKinds) {
    for (const arcana of ARCANA_VALUES) {
      for (const locale of SUPPORTED_LOCALES) {
        rows.push({
          category: 'matrix',
          subjectKey: matrixSubjectKey(kind, arcana),
          locale,
          content: composeMatrix(kind, arcana, locale),
        });
      }
    }
  }

  return rows;
}
