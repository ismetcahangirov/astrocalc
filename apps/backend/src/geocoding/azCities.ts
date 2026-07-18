/**
 * Embedded offline gazetteer of Azerbaijan's cities and rayon (district)
 * centers, so birth-place search works with no network at all. Coordinates
 * are city/town-centroid precision (matching what a geocoder like Nominatim
 * would return for a place-level query, not a street address) — sufficient
 * for natal-chart house/ascendant calculation.
 *
 * This is a starting set covering the capital plus the great majority of
 * rayon centers; it is intentionally not a full GeoNames import (see the
 * issue's technical notes) — anything missing here still resolves through
 * the live Nominatim fallback in `geocodingService`.
 */
export interface AzCity {
  id: string;
  /** Canonical Azerbaijani name, correctly using dotted İ/i vs dotless I/ı. */
  name: string;
  /** Administrative context shown alongside the name in results. */
  region: string;
  /** Common alternate spellings/transliterations (e.g. English). */
  aliases?: string[];
  lat: number;
  lng: number;
}

export const AZ_CITIES: AzCity[] = [
  { id: 'baku', name: 'Bakı', region: 'Bakı şəhəri', aliases: ['Baku'], lat: 40.4093, lng: 49.8671 },
  { id: 'ganja', name: 'Gəncə', region: 'Gəncə şəhəri', aliases: ['Ganja', 'Gyandzha'], lat: 40.6828, lng: 46.3606 },
  { id: 'sumgayit', name: 'Sumqayıt', region: 'Sumqayıt şəhəri', aliases: ['Sumgayit', 'Sumgait'], lat: 40.5892, lng: 49.6686 },
  { id: 'mingachevir', name: 'Mingəçevir', region: 'Mingəçevir şəhəri', aliases: ['Mingachevir'], lat: 40.7699, lng: 47.0479 },
  { id: 'nakhchivan', name: 'Naxçıvan', region: 'Naxçıvan MR', aliases: ['Nakhchivan'], lat: 39.2089, lng: 45.4122 },
  { id: 'shaki', name: 'Şəki', region: 'Şəki rayonu', aliases: ['Sheki', 'Shaki'], lat: 41.1919, lng: 47.1706 },
  { id: 'lankaran', name: 'Lənkəran', region: 'Lənkəran rayonu', aliases: ['Lankaran', 'Lenkoran'], lat: 38.7537, lng: 48.8511 },
  { id: 'shirvan', name: 'Şirvan', region: 'Şirvan şəhəri', aliases: ['Shirvan'], lat: 39.9420, lng: 48.9226 },
  { id: 'yevlakh', name: 'Yevlax', region: 'Yevlax rayonu', aliases: ['Yevlakh', 'Evlakh'], lat: 40.6153, lng: 47.1518 },
  { id: 'khankendi', name: 'Xankəndi', region: 'Xankəndi şəhəri', aliases: ['Khankendi', 'Stepanakert'], lat: 39.8253, lng: 46.7581 },
  { id: 'quba', name: 'Quba', region: 'Quba rayonu', aliases: ['Guba'], lat: 41.3606, lng: 48.5122 },
  { id: 'qusar', name: 'Qusar', region: 'Qusar rayonu', aliases: ['Gusar'], lat: 41.4372, lng: 48.4325 },
  { id: 'zaqatala', name: 'Zaqatala', region: 'Zaqatala rayonu', aliases: ['Zakatala'], lat: 41.6309, lng: 46.6367 },
  { id: 'balakan', name: 'Balakən', region: 'Balakən rayonu', aliases: ['Balakan'], lat: 41.7285, lng: 46.4056 },
  { id: 'qakh', name: 'Qax', region: 'Qax rayonu', aliases: ['Gakh', 'Qakh'], lat: 41.4213, lng: 46.9186 },
  { id: 'oghuz', name: 'Oğuz', region: 'Oğuz rayonu', aliases: ['Oguz'], lat: 41.0725, lng: 47.4553 },
  { id: 'qabala', name: 'Qəbələ', region: 'Qəbələ rayonu', aliases: ['Qabala', 'Gabala'], lat: 40.9808, lng: 47.8467 },
  { id: 'ismayilli', name: 'İsmayıllı', region: 'İsmayıllı rayonu', aliases: ['Ismayilli', 'Ismailli'], lat: 40.7883, lng: 48.1519 },
  { id: 'shamakhi', name: 'Şamaxı', region: 'Şamaxı rayonu', aliases: ['Shamakhi', 'Shemakha'], lat: 40.6303, lng: 48.6402 },
  { id: 'aghsu', name: 'Ağsu', region: 'Ağsu rayonu', aliases: ['Aghsu'], lat: 40.5828, lng: 48.4083 },
  { id: 'gobustan', name: 'Qobustan', region: 'Qobustan rayonu', aliases: ['Gobustan'], lat: 40.5314, lng: 48.9536 },
  { id: 'khizi', name: 'Xızı', region: 'Xızı rayonu', aliases: ['Khizi'], lat: 40.9042, lng: 49.0808 },
  { id: 'siyazan', name: 'Siyəzən', region: 'Siyəzən rayonu', aliases: ['Siyazan'], lat: 41.0708, lng: 49.1094 },
  { id: 'shabran', name: 'Şabran', region: 'Şabran rayonu', aliases: ['Shabran', 'Devechi'], lat: 41.2153, lng: 48.9908 },
  { id: 'khachmaz', name: 'Xaçmaz', region: 'Xaçmaz rayonu', aliases: ['Khachmaz'], lat: 41.4636, lng: 48.8000 },
  { id: 'goranboy', name: 'Goranboy', region: 'Goranboy rayonu', lat: 40.6103, lng: 46.7511 },
  { id: 'naftalan', name: 'Naftalan', region: 'Naftalan şəhəri', lat: 40.5142, lng: 46.8158 },
  { id: 'goygol', name: 'Göygöl', region: 'Göygöl rayonu', aliases: ['Goygol', 'Khanlar'], lat: 40.5794, lng: 46.3167 },
  { id: 'dashkasan', name: 'Daşkəsən', region: 'Daşkəsən rayonu', aliases: ['Dashkasan'], lat: 40.5150, lng: 46.0781 },
  { id: 'samukh', name: 'Samux', region: 'Samux rayonu', aliases: ['Samukh'], lat: 40.7822, lng: 46.5344 },
  { id: 'shamkir', name: 'Şəmkir', region: 'Şəmkir rayonu', aliases: ['Shamkir'], lat: 40.8286, lng: 46.0175 },
  { id: 'gadabay', name: 'Gədəbəy', region: 'Gədəbəy rayonu', aliases: ['Gadabay'], lat: 40.5556, lng: 45.8161 },
  { id: 'tovuz', name: 'Tovuz', region: 'Tovuz rayonu', lat: 40.9928, lng: 45.6317 },
  { id: 'qazakh', name: 'Qazax', region: 'Qazax rayonu', aliases: ['Gazakh', 'Kazakh'], lat: 41.0942, lng: 45.3617 },
  { id: 'aghstafa', name: 'Ağstafa', region: 'Ağstafa rayonu', aliases: ['Aghstafa', 'Agstafa'], lat: 41.1150, lng: 45.4497 },
  { id: 'zangilan', name: 'Zəngilan', region: 'Zəngilan rayonu', aliases: ['Zangilan'], lat: 39.0867, lng: 46.6531 },
  { id: 'jabrayil', name: 'Cəbrayıl', region: 'Cəbrayıl rayonu', aliases: ['Jabrayil'], lat: 39.3997, lng: 47.0083 },
  { id: 'fuzuli', name: 'Füzuli', region: 'Füzuli rayonu', aliases: ['Fuzuli'], lat: 39.6011, lng: 47.1447 },
  { id: 'khojavend', name: 'Xocavənd', region: 'Xocavənd rayonu', aliases: ['Khojavend'], lat: 39.9142, lng: 47.1450 },
  { id: 'aghjabadi', name: 'Ağcabədi', region: 'Ağcabədi rayonu', aliases: ['Aghjabadi'], lat: 40.0553, lng: 47.4489 },
  { id: 'beylagan', name: 'Beyləqan', region: 'Beyləqan rayonu', aliases: ['Beylagan'], lat: 39.7728, lng: 47.6069 },
  { id: 'imishli', name: 'İmişli', region: 'İmişli rayonu', aliases: ['Imishli'], lat: 39.8686, lng: 48.0644 },
  { id: 'saatli', name: 'Saatlı', region: 'Saatlı rayonu', aliases: ['Saatli'], lat: 39.9308, lng: 48.3711 },
  { id: 'sabirabad', name: 'Sabirabad', region: 'Sabirabad rayonu', lat: 40.0083, lng: 48.4744 },
  { id: 'bilasuvar', name: 'Biləsuvar', region: 'Biləsuvar rayonu', aliases: ['Bilasuvar'], lat: 39.4589, lng: 48.5478 },
  { id: 'neftchala', name: 'Neftçala', region: 'Neftçala rayonu', aliases: ['Neftchala'], lat: 39.3833, lng: 49.2500 },
  { id: 'salyan', name: 'Salyan', region: 'Salyan rayonu', lat: 39.5892, lng: 48.9836 },
  { id: 'hajigabul', name: 'Hacıqabul', region: 'Hacıqabul rayonu', aliases: ['Hajigabul'], lat: 40.0500, lng: 48.9186 },
  { id: 'kurdamir', name: 'Kürdəmir', region: 'Kürdəmir rayonu', aliases: ['Kurdamir'], lat: 40.3389, lng: 48.1583 },
  { id: 'zardab', name: 'Zərdab', region: 'Zərdab rayonu', aliases: ['Zardab'], lat: 40.2231, lng: 47.7106 },
  { id: 'ujar', name: 'Ucar', region: 'Ucar rayonu', aliases: ['Ujar'], lat: 40.5136, lng: 47.6497 },
  { id: 'goychay', name: 'Göyçay', region: 'Göyçay rayonu', aliases: ['Goychay'], lat: 40.6539, lng: 47.7386 },
  { id: 'agdash', name: 'Ağdaş', region: 'Ağdaş rayonu', aliases: ['Agdash'], lat: 40.6469, lng: 47.4761 },
  { id: 'barda', name: 'Bərdə', region: 'Bərdə rayonu', aliases: ['Barda'], lat: 40.3789, lng: 47.1272 },
  { id: 'tartar', name: 'Tərtər', region: 'Tərtər rayonu', aliases: ['Tartar'], lat: 40.3372, lng: 46.9328 },
  { id: 'yardimli', name: 'Yardımlı', region: 'Yardımlı rayonu', aliases: ['Yardimli'], lat: 38.9161, lng: 48.2494 },
  { id: 'masalli', name: 'Masallı', region: 'Masallı rayonu', aliases: ['Masalli'], lat: 39.0339, lng: 48.6664 },
  { id: 'jalilabad', name: 'Cəlilabad', region: 'Cəlilabad rayonu', aliases: ['Jalilabad'], lat: 39.1969, lng: 48.4956 },
  { id: 'lerik', name: 'Lerik', region: 'Lerik rayonu', lat: 38.7742, lng: 48.4181 },
  { id: 'astara', name: 'Astara', region: 'Astara rayonu', lat: 38.4306, lng: 48.8703 },
  { id: 'absheron', name: 'Xırdalan', region: 'Abşeron rayonu', aliases: ['Khirdalan', 'Absheron'], lat: 40.4517, lng: 49.7461 },
  { id: 'agdam', name: 'Ağdam', region: 'Ağdam rayonu', aliases: ['Agdam'], lat: 39.9903, lng: 46.9264 },
  { id: 'kalbajar', name: 'Kəlbəcər', region: 'Kəlbəcər rayonu', aliases: ['Kalbajar'], lat: 40.1064, lng: 46.0361 },
  { id: 'lachin', name: 'Laçın', region: 'Laçın rayonu', aliases: ['Lachin'], lat: 39.6428, lng: 46.5486 },
  { id: 'gubadli', name: 'Qubadlı', region: 'Qubadlı rayonu', aliases: ['Gubadli'], lat: 39.3419, lng: 46.5686 },
  { id: 'shusha', name: 'Şuşa', region: 'Şuşa rayonu', aliases: ['Shusha'], lat: 39.7581, lng: 46.7486 },
  { id: 'khojaly', name: 'Xocalı', region: 'Xocalı rayonu', aliases: ['Khojaly'], lat: 39.9092, lng: 46.7908 },
  { id: 'julfa', name: 'Culfa', region: 'Naxçıvan MR', aliases: ['Julfa'], lat: 38.9603, lng: 45.6297 },
  { id: 'ordubad', name: 'Ordubad', region: 'Naxçıvan MR', lat: 38.9078, lng: 46.0264 },
  { id: 'shahbuz', name: 'Şahbuz', region: 'Naxçıvan MR', aliases: ['Shahbuz'], lat: 39.4111, lng: 45.4972 },
  { id: 'sharur', name: 'Şərur', region: 'Naxçıvan MR', aliases: ['Sharur'], lat: 39.5561, lng: 44.9942 },
  { id: 'babek', name: 'Babək', region: 'Naxçıvan MR', aliases: ['Babek'], lat: 39.2481, lng: 45.4056 },
  { id: 'sadarak', name: 'Sədərək', region: 'Naxçıvan MR', aliases: ['Sadarak'], lat: 39.7156, lng: 44.8672 },
  { id: 'kangarli', name: 'Kəngərli', region: 'Naxçıvan MR', aliases: ['Kangarli'], lat: 39.3378, lng: 45.2856 },
];
