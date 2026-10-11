// Inhalte für den Bereich „Sprachen & Schriften“ (Phase 4): Buchstaben-Tabellen, Lerngruppen, Tipps.
// Wird von scripts/geo/build-sprachen.mjs gelesen. Umschrift jeweils so, wie man es auf Deutsch ausspricht.
//
// Aufbau eines Zeichens: [Zeichen, Antwort (kurz), Hinweis (lang, optional), Gruppe, weitere akzeptierte Antworten (optional)]

/* ───────────── Kyrillisch (Russisch) ───────────── */

export const KYRILLISCH = {
  groups: [
    ['gleich', 'Wie bei uns', 'Sehen aus wie lateinische Buchstaben und klingen auch so.'],
    ['falsch', 'Falsche Freunde', 'Sehen bekannt aus, klingen aber anders – die wichtigste Gruppe!'],
    ['neu', 'Neue Buchstaben', 'Gibt es im lateinischen Alphabet nicht.'],
    ['zeichen', 'Zeichen ohne eigenen Laut', 'Ändern nur die Aussprache des Buchstabens davor.'],
  ],
  letters: [
    ['А', 'a', 'wie in „Abend“', 'gleich'],
    ['Е', 'je', 'am Wortanfang „je“, sonst „e“', 'gleich', ['e']],
    ['К', 'k', 'wie in „Katze“', 'gleich'],
    ['М', 'm', 'wie in „Mama“', 'gleich'],
    ['О', 'o', 'betont „o“, unbetont oft „a“', 'gleich'],
    ['Т', 't', 'wie in „Tag“', 'gleich'],
    ['В', 'w', 'sieht aus wie B, klingt wie W', 'falsch', ['v']],
    ['Н', 'n', 'sieht aus wie H, klingt wie N', 'falsch'],
    ['Р', 'r', 'sieht aus wie P, klingt wie gerolltes R', 'falsch'],
    ['С', 's', 'sieht aus wie C, klingt wie scharfes S (ß)', 'falsch'],
    ['У', 'u', 'sieht aus wie Y, klingt wie U', 'falsch'],
    ['Х', 'ch', 'sieht aus wie X, klingt wie „ch“ in „Bach“', 'falsch', ['kh', 'h']],
    ['Б', 'b', 'wie B – eckige 6', 'neu'],
    ['Г', 'g', 'wie G in „Gans“', 'neu'],
    ['Д', 'd', 'wie D – ein kleines Haus', 'neu'],
    ['Ж', 'sch', 'weiches „sch“ wie in „Journal“ (stimmhaft)', 'neu', ['zh', 'j']],
    ['З', 's', 'weiches „s“ wie in „Sonne“ (stimmhaft) – sieht aus wie eine 3', 'neu', ['z']],
    ['И', 'i', 'wie I – ein gespiegeltes N', 'neu'],
    ['Й', 'j', 'kurzes „j“ wie in „Mai“', 'neu', ['i', 'y']],
    ['Л', 'l', 'wie L', 'neu'],
    ['П', 'p', 'wie P – ein Tor', 'neu'],
    ['Ф', 'f', 'wie F', 'neu'],
    ['Ц', 'z', 'wie „z“ in „Zahn“ (ts)', 'neu', ['ts', 'c']],
    ['Ч', 'tsch', 'wie „tsch“ in „Matsch“', 'neu', ['ch']],
    ['Ш', 'sch', 'wie „sch“ in „Schule“ (stimmlos)', 'neu', ['sh']],
    ['Щ', 'schtsch', 'langes, weiches „schtsch“', 'neu', ['shch', 'sch']],
    ['Ы', 'y', 'dumpfes „i“, mit nach hinten gezogener Zunge', 'neu', ['i']],
    ['Э', 'e', 'offenes „e“ wie in „Ende“', 'neu'],
    ['Ю', 'ju', 'wie „ju“ in „Jubel“', 'neu', ['yu']],
    ['Я', 'ja', 'wie „ja“ – ein gespiegeltes R', 'neu', ['ya']],
    ['Ё', 'jo', 'wie „jo“ – immer betont', 'neu', ['yo']],
    ['Ъ', '(hart)', 'Härtezeichen – trennt Silben, eigener Laut: keiner', 'zeichen'],
    ['Ь', '(weich)', 'Weichheitszeichen – macht den Buchstaben davor weich', 'zeichen'],
  ],
  tips: [
    'Lern zuerst die sechs „falschen Freunde“ В Н Р С У Х – sie sind die häufigste Fehlerquelle.',
    'Viele Städte enden auf -ск (-sk), -град (-grad), -бург (-burg) oder -поль (-pol).',
    'Auf Schildern heißt Ausfahrt „ВЫХОД“, Zentrum „ЦЕНТР“ und Straße „УЛИЦА“ (oft „ул.“).',
  ],
}

/* ───────────── Kyrillisch: Buchstaben, die ein Land verraten ───────────── */

// Nur Buchstaben, die es (unter den hier gezeigten Sprachen) in genau einer Sprache gibt
export const KYRILLISCH_LAENDER = {
  groups: [
    ['ukr', 'Ukrainisch', 'Є, І, Ї und Ґ – und kein Ы, Э, Ё oder Ъ.'],
    ['bel', 'Belarussisch', 'Ў (kurzes u) und І – aber kein И und kein Щ.'],
    ['srb', 'Serbisch', 'Ђ und Ћ gibt es nur im Serbischen. Dazu Ј, Љ, Њ, Џ (auch Mazedonisch).'],
    ['mkd', 'Mazedonisch', 'Ѓ, Ќ und Ѕ gibt es nur im Mazedonischen.'],
    ['kaz', 'Kasachisch', 'Ә, Ғ, Қ, Ң, Ұ, Һ und І – viele Buchstaben mit Haken und Strichen.'],
    ['rus', 'Russisch', 'Ы, Э, Ё und Ъ – und keine Sonderbuchstaben.'],
  ],
  letters: [
    ['Є', 'Ukrainisch', '„je“', 'ukr'], ['Ї', 'Ukrainisch', '„ji“', 'ukr'], ['Ґ', 'Ukrainisch', '„g“ (Г ist im Ukrainischen ein „h“)', 'ukr'],
    ['Ў', 'Belarussisch', 'kurzes „u“', 'bel'],
    ['Ђ', 'Serbisch', '„dj“', 'srb'], ['Ћ', 'Serbisch', '„tch“ (wie ć)', 'srb'],
    ['Ѓ', 'Mazedonisch', '„gj“', 'mkd'], ['Ќ', 'Mazedonisch', '„kj“', 'mkd'], ['Ѕ', 'Mazedonisch', '„dz“', 'mkd'],
    ['Ә', 'Kasachisch', 'offenes „ä“', 'kaz'], ['Ғ', 'Kasachisch', 'Rachen-„gh“', 'kaz'], ['Қ', 'Kasachisch', 'tiefes „q“', 'kaz'],
    ['Ң', 'Kasachisch', '„ng“', 'kaz'], ['Ұ', 'Kasachisch', 'kurzes „u“', 'kaz'], ['Һ', 'Kasachisch', '„h“', 'kaz'],
  ],
  tips: [
    'Bulgarisch erkennst du daran, dass Ъ mitten im Wort als Vokal steht (z.B. „Търговище“) und Ы und Э fehlen.',
    'Ein einzelnes І (mit Punkt) heißt: Ukraine, Belarus oder Kasachstan – nie Russland.',
    'Mongolisch hat Ө und Ү (wie Kasachisch), aber kein Қ oder Ғ.',
  ],
}

/* ───────────── Griechisch ───────────── */

export const GRIECHISCH = {
  groups: [
    ['gleich', 'Wie bei uns', 'Sehen aus wie lateinische Buchstaben und klingen auch so.'],
    ['falsch', 'Falsche Freunde', 'Sehen bekannt aus, klingen aber anders.'],
    ['neu', 'Neue Buchstaben', 'Kennst du vielleicht aus Mathe und Physik.'],
  ],
  letters: [
    ['Α α', 'a', 'Alpha', 'gleich'], ['Ε ε', 'e', 'Epsilon', 'gleich'], ['Ζ ζ', 's', 'Zita – weiches „s“ (stimmhaft)', 'gleich', ['z']],
    ['Ι ι', 'i', 'Jota', 'gleich'], ['Κ κ', 'k', 'Kappa', 'gleich'], ['Μ μ', 'm', 'Mi', 'gleich'], ['Ο ο', 'o', 'Omikron', 'gleich'], ['Τ τ', 't', 'Taf', 'gleich'],
    ['Β β', 'w', 'Vita – sieht aus wie B, klingt wie W', 'falsch', ['v']],
    ['Η η', 'i', 'Ita – sieht aus wie H, klingt wie I', 'falsch'],
    ['Ν ν', 'n', 'Ni – klein sieht es aus wie ein v', 'falsch'],
    ['Ρ ρ', 'r', 'Ro – sieht aus wie P, klingt wie R', 'falsch'],
    ['Υ υ', 'i', 'Ypsilon – klingt wie I', 'falsch', ['y']],
    ['Χ χ', 'ch', 'Chi – sieht aus wie X, klingt wie „ch“', 'falsch', ['h', 'kh']],
    ['Γ γ', 'g', 'Gamma – vor e/i wie „j“', 'neu', ['gh', 'y']],
    ['Δ δ', 'd', 'Delta – wie englisches „th“ in „this“', 'neu', ['dh']],
    ['Θ θ', 'th', 'Thita – wie englisches „th“ in „think“', 'neu'],
    ['Λ λ', 'l', 'Lamda', 'neu'], ['Ξ ξ', 'x', 'Xi – „ks“', 'neu', ['ks']], ['Π π', 'p', 'Pi', 'neu'],
    ['Σ σ ς', 's', 'Sigma – ς nur am Wortende', 'neu'], ['Φ φ', 'f', 'Phi', 'neu', ['ph']], ['Ψ ψ', 'ps', 'Psi', 'neu'], ['Ω ω', 'o', 'Omega', 'neu'],
  ],
  tips: [
    'ΜΠ klingt wie „b“ und ΝΤ wie „d“ – „ΝΤΟΜΑΤΑ“ ist die Tomate.',
    'ΟΥ wird zu „u“: „ΚΕΡΚΥΡΑ“ ist Korfu, „ΑΘΗΝΑ“ ist Athen.',
    'Griechische Ortsschilder sind fast immer zweisprachig: oben Griechisch, darunter lateinisch.',
  ],
}

/* ───────────── Georgisch (Mchedruli) ───────────── */

export const GEORGISCH = {
  groups: [
    ['vokal', 'Vokale', 'Fünf Vokale – fast wie im Deutschen.'],
    ['einfach', 'Einfache Konsonanten', 'Klingen ähnlich wie im Deutschen.'],
    ['ausgestossen', 'Mit Knacklaut', 'Werden mit einem kurzen Knacken („ejektiv“) gesprochen – Umschrift mit Apostroph.'],
    ['zisch', 'Zisch- und Rachenlaute', 'sch, tsch, dz, gh, ch …'],
  ],
  letters: [
    ['ა', 'a', '', 'vokal'], ['ე', 'e', '', 'vokal'], ['ი', 'i', '', 'vokal'], ['ო', 'o', '', 'vokal'], ['უ', 'u', '', 'vokal'],
    ['ბ', 'b', '', 'einfach'], ['გ', 'g', '', 'einfach'], ['დ', 'd', '', 'einfach'], ['ვ', 'w', 'wie W', 'einfach', ['v']], ['ზ', 's', 'weiches s (z)', 'einfach', ['z']],
    ['თ', 't', 'behauchtes t', 'einfach'], ['ლ', 'l', '', 'einfach'], ['მ', 'm', '', 'einfach'], ['ნ', 'n', '', 'einfach'], ['რ', 'r', '', 'einfach'],
    ['ს', 's', 'scharfes s', 'einfach'], ['ფ', 'p', 'behauchtes p', 'einfach'], ['ქ', 'k', 'behauchtes k', 'einfach'], ['ჰ', 'h', '', 'einfach'],
    ['კ', "k'", 'k mit Knacklaut', 'ausgestossen', ['k']], ['პ', "p'", 'p mit Knacklaut', 'ausgestossen', ['p']], ['ტ', "t'", 't mit Knacklaut', 'ausgestossen', ['t']],
    ['ყ', "q'", 'tiefes q mit Knacklaut', 'ausgestossen', ['q']], ['წ', "ts'", 'ts mit Knacklaut', 'ausgestossen', ['ts']], ['ჭ', "tsch'", 'tsch mit Knacklaut', 'ausgestossen', ["ch'", 'tsch']],
    ['ჟ', 'sch', 'weiches sch wie in „Journal“', 'zisch', ['zh']], ['შ', 'sch', 'hartes sch wie in „Schule“', 'zisch', ['sh']], ['ჩ', 'tsch', 'behauchtes tsch', 'zisch', ['ch']],
    ['ც', 'ts', 'behauchtes ts (z)', 'zisch', ['z']], ['ძ', 'dz', 'ds', 'zisch'], ['ჯ', 'dsch', 'wie „j“ in „Jeans“', 'zisch', ['j']],
    ['ღ', 'gh', 'Rachen-„r“, wie französisches r', 'zisch'], ['ხ', 'ch', 'wie „ch“ in „Bach“', 'zisch', ['kh']],
  ],
  tips: [
    'Georgisch hat keine Groß- und Kleinbuchstaben – alles sieht rund und „geschwungen“ aus.',
    'Viele Ortsnamen enden auf -ი (-i), z.B. თბილისი = Tbilissi, ბათუმი = Batumi.',
    'Rund mit vielen Bögen = Georgisch. Eckiger mit Haken nach unten = Armenisch.',
  ],
}

/* ───────────── Armenisch ───────────── */

export const ARMENISCH = {
  groups: [
    ['vokal', 'Vokale', 'Ա Ե Է Ը Ի Ո Օ – und ՈՒ für „u“.'],
    ['kons1', 'Konsonanten 1', 'Die häufigsten.'],
    ['kons2', 'Konsonanten 2', 'Behauchte und Zischlaute.'],
  ],
  letters: [
    ['Ա ա', 'a', '', 'vokal'], ['Ե ե', 'e', 'am Wortanfang „je“', 'vokal', ['je', 'ye']], ['Է է', 'e', '', 'vokal'], ['Ը ը', 'ë', 'dumpfes e (wie in „bitte“)', 'vokal', ['e', 'y']],
    ['Ի ի', 'i', '', 'vokal'], ['Ո ո', 'o', 'am Wortanfang „wo“', 'vokal', ['vo', 'wo']], ['Օ օ', 'o', '', 'vokal'], ['Ւ ւ', 'w', 'zusammen mit Ո: ՈՒ = „u“', 'vokal', ['u', 'v']],
    ['Բ բ', 'b', '', 'kons1'], ['Գ գ', 'g', '', 'kons1'], ['Դ դ', 'd', '', 'kons1'], ['Զ զ', 's', 'weiches s (z)', 'kons1', ['z']], ['Լ լ', 'l', '', 'kons1'],
    ['Կ կ', 'k', '', 'kons1'], ['Հ հ', 'h', '', 'kons1'], ['Մ մ', 'm', '', 'kons1'], ['Յ յ', 'j', '', 'kons1', ['y']], ['Ն ն', 'n', '', 'kons1'],
    ['Պ պ', 'p', '', 'kons1'], ['Ռ ռ', 'rr', 'gerolltes r', 'kons1', ['r']], ['Ս ս', 's', '', 'kons1'], ['Վ վ', 'w', '', 'kons1', ['v']], ['Տ տ', 't', '', 'kons1'], ['Ր ր', 'r', '', 'kons1'], ['Ֆ ֆ', 'f', '', 'kons1'],
    ['Թ թ', "t'", 'behauchtes t', 'kons2', ['t']], ['Ժ ժ', 'sch', 'weiches sch (zh)', 'kons2', ['zh']], ['Խ խ', 'ch', 'wie in „Bach“', 'kons2', ['kh']], ['Ծ ծ', 'ts', '', 'kons2'],
    ['Ձ ձ', 'dz', '', 'kons2'], ['Ղ ղ', 'gh', 'Rachen-r', 'kons2'], ['Ճ ճ', 'tsch', '', 'kons2', ['ch']], ['Շ շ', 'sch', '', 'kons2', ['sh']], ['Չ չ', "tsch'", 'behauchtes tsch', 'kons2', ["ch'", 'tsch']],
    ['Ջ ջ', 'dsch', 'wie „j“ in „Jeans“', 'kons2', ['j']], ['Ց ց', "ts'", 'behauchtes ts', 'kons2', ['ts']], ['Փ փ', "p'", 'behauchtes p', 'kons2', ['p']], ['Ք ք', "k'", 'behauchtes k', 'kons2', ['k']],
  ],
  tips: [
    'Armenisch hat viele Buchstaben, die wie „u“, „n“ und „h“ aussehen – achte auf die Haken unten.',
    'Die Hauptstadt Jerewan schreibt sich Երևան, die Endung -յան (-jan) steckt in fast jedem Familiennamen.',
  ],
}

/* ───────────── Hebräisch ───────────── */

export const HEBRAEISCH = {
  groups: [
    ['a', 'Buchstaben 1', 'Von Alef bis Jod.'],
    ['b', 'Buchstaben 2', 'Von Kaf bis Taw.'],
    ['ende', 'Endformen', 'Fünf Buchstaben sehen am Wortende anders aus.'],
  ],
  letters: [
    ['א', 'Alef', 'stumm – trägt einen Vokal', 'a'], ['ב', 'b', 'Bet – ohne Punkt „w“', 'a', ['v', 'w']], ['ג', 'g', 'Gimel', 'a'], ['ד', 'd', 'Dalet', 'a'],
    ['ה', 'h', 'He', 'a'], ['ו', 'w', 'Waw – auch „o“ oder „u“', 'a', ['v', 'o', 'u']], ['ז', 's', 'Sajin – weiches s', 'a', ['z']], ['ח', 'ch', 'Chet – wie in „Bach“', 'a', ['h']],
    ['ט', 't', 'Tet', 'a'], ['י', 'j', 'Jod – auch „i“', 'a', ['y', 'i']],
    ['כ', 'k', 'Kaf – ohne Punkt „ch“', 'b', ['ch']], ['ל', 'l', 'Lamed – ragt nach oben', 'b'], ['מ', 'm', 'Mem', 'b'], ['נ', 'n', 'Nun', 'b'], ['ס', 's', 'Samech', 'b'],
    ['ע', 'Ajin', 'stumm (früher ein Kehllaut)', 'b'], ['פ', 'p', 'Pe – ohne Punkt „f“', 'b', ['f']], ['צ', 'z', 'Zadi – „ts“', 'b', ['ts']], ['ק', 'k', 'Qof', 'b', ['q']],
    ['ר', 'r', 'Resch', 'b'], ['ש', 'sch', 'Schin – auch „s“', 'b', ['sh', 's']], ['ת', 't', 'Taw', 'b'],
    ['ך', 'ch', 'Kaf am Wortende', 'ende', ['k']], ['ם', 'm', 'Mem am Wortende – ein geschlossenes Viereck', 'ende'], ['ן', 'n', 'Nun am Wortende – ein langer Strich', 'ende'],
    ['ף', 'f', 'Pe am Wortende', 'ende'], ['ץ', 'z', 'Zadi am Wortende', 'ende', ['ts']],
  ],
  tips: [
    'Hebräisch wird von rechts nach links gelesen und meist ohne Vokale geschrieben.',
    'Hebräisch ist eckig und „blockig“, Arabisch ist rund und verbunden.',
    'Schilder in Israel sind meist dreisprachig: Hebräisch, Arabisch, Englisch.',
  ],
}

/* ───────────── Arabisch ───────────── */

export const ARABISCH = {
  groups: [
    ['punkte', 'Gleiche Form, andere Punkte', 'ب ت ث ن ي – die Punkte machen den Unterschied.'],
    ['rest', 'Weitere Buchstaben', ''],
    ['emph', 'Dunkle Laute', 'Werden „dunkel“, mit zurückgezogener Zunge gesprochen.'],
    ['pers', 'Nur Persisch & Urdu', 'Verraten: Das ist kein Arabisch!'],
    ['zahl', 'Zahlen', 'Ostarabische Ziffern – auf Kennzeichen und Preisschildern.'],
  ],
  letters: [
    ['ب', 'b', 'ein Punkt unten', 'punkte'], ['ت', 't', 'zwei Punkte oben', 'punkte'], ['ث', 'th', 'drei Punkte oben – engl. „th“', 'punkte'], ['ن', 'n', 'ein Punkt oben, tiefer Bogen', 'punkte'], ['ي', 'j', 'zwei Punkte unten – auch „i“', 'punkte', ['y', 'i']],
    ['ج', 'dsch', 'Punkt im Bauch', 'punkte', ['j', 'g']], ['ح', 'h', 'ohne Punkt – raues h', 'punkte'], ['خ', 'ch', 'Punkt oben – wie „Bach“', 'punkte', ['kh']],
    ['ا', 'a', 'Alif – ein senkrechter Strich', 'rest'], ['د', 'd', '', 'rest'], ['ذ', 'dh', 'engl. „th“ in „this“', 'rest'], ['ر', 'r', '', 'rest'], ['ز', 's', 'weiches s (z)', 'rest', ['z']],
    ['س', 's', 'drei Zacken', 'rest'], ['ش', 'sch', 'drei Zacken, drei Punkte', 'rest', ['sh']], ['ع', 'Ain', 'Kehllaut', 'rest'], ['غ', 'gh', 'Rachen-r', 'rest'], ['ف', 'f', 'Kreis mit einem Punkt', 'rest'],
    ['ق', 'q', 'Kreis mit zwei Punkten', 'rest'], ['ك', 'k', '', 'rest'], ['ل', 'l', 'wie ein J', 'rest'], ['م', 'm', '', 'rest'], ['ه', 'h', '', 'rest'], ['و', 'w', 'auch „u“', 'rest', ['u', 'o']],
    ['ص', 's', 'dunkles s', 'emph'], ['ض', 'd', 'dunkles d', 'emph'], ['ط', 't', 'dunkles t', 'emph'], ['ظ', 'z', 'dunkles z', 'emph'],
    ['پ', 'p', 'drei Punkte unten', 'pers'], ['چ', 'tsch', 'drei Punkte im Bauch', 'pers', ['ch']], ['ژ', 'sch', 'weiches sch (zh)', 'pers', ['zh']], ['گ', 'g', 'k mit zweitem Strich', 'pers'],
    ['ٹ', 't', 'Urdu – mit kleinem ط oben', 'pers'], ['ے', 'e', 'Urdu – Bogen nach links am Wortende', 'pers'],
    ['٠', '0', '', 'zahl'], ['١', '1', '', 'zahl'], ['٢', '2', '', 'zahl'], ['٣', '3', '', 'zahl'], ['٤', '4', 'Persisch: ۴', 'zahl'],
    ['٥', '5', 'sieht aus wie eine 0!', 'zahl'], ['٦', '6', 'Persisch: ۶', 'zahl'], ['٧', '7', 'ein V', 'zahl'], ['٨', '8', 'ein umgedrehtes V', 'zahl'], ['٩', '9', '', 'zahl'],
  ],
  tips: [
    'Arabisch wird von rechts nach links geschrieben, die Zahlen aber von links nach rechts.',
    'پ چ ژ گ gibt es nicht im Arabischen: Mit ihnen ist es Persisch (Iran, Afghanistan) oder Urdu (Pakistan).',
    'Der Punkt „٥“ ist eine 5 und „٠“ eine 0 – Achtung bei Kennzeichen!',
  ],
}

/* ───────────── Thai (Konsonanten) ───────────── */

export const THAI = {
  groups: [
    ['mittel', 'Mittelklasse', 'Neun Konsonanten – bestimmen mit den Tonzeichen den Ton.'],
    ['hoch', 'Hochklasse', 'Elf Konsonanten.'],
    ['tief', 'Tiefklasse', 'Die meisten Konsonanten – viele klingen wie ein Hoch-Konsonant.'],
    ['zahl', 'Zahlen', 'Thai-Ziffern – auf Schildern und Preisen.'],
  ],
  letters: [
    ['ก', 'k', 'gai (Huhn)', 'mittel', ['g']], ['จ', 'tsch', 'jaan (Teller)', 'mittel', ['ch', 'j']], ['ฎ', 'd', 'chada (Kopfschmuck)', 'mittel'], ['ฏ', 't', 'patak (Speer)', 'mittel'],
    ['ด', 'd', 'dek (Kind)', 'mittel'], ['ต', 't', 'tao (Schildkröte)', 'mittel'], ['บ', 'b', 'baimai (Blatt)', 'mittel'], ['ป', 'p', 'plaa (Fisch)', 'mittel'], ['อ', '(stumm)', 'ang (Schüssel) – trägt Vokale', 'mittel', ['o']],
    ['ข', 'kh', 'khai (Ei)', 'hoch', ['k']], ['ฃ', 'kh', 'veraltet', 'hoch', ['k']], ['ฉ', 'tsch', 'ching (Becken)', 'hoch', ['ch']], ['ฐ', 'th', 'than (Sockel)', 'hoch', ['t']],
    ['ถ', 'th', 'thung (Sack)', 'hoch', ['t']], ['ผ', 'ph', 'phueng (Biene)', 'hoch', ['p']], ['ฝ', 'f', 'faa (Deckel)', 'hoch'], ['ศ', 's', 'saala (Pavillon)', 'hoch'],
    ['ษ', 's', 'rue-si (Einsiedler)', 'hoch'], ['ส', 's', 'suea (Tiger)', 'hoch'], ['ห', 'h', 'hiip (Truhe)', 'hoch'],
    ['ค', 'kh', 'khwaai (Büffel)', 'tief', ['k']], ['ฅ', 'kh', 'veraltet', 'tief', ['k']], ['ฆ', 'kh', 'rakhang (Glocke)', 'tief', ['k']], ['ง', 'ng', 'nguu (Schlange)', 'tief'],
    ['ช', 'tsch', 'chaang (Elefant)', 'tief', ['ch']], ['ซ', 's', 'soo (Kette)', 'tief'], ['ฌ', 'tsch', 'choe (Baum)', 'tief', ['ch']], ['ญ', 'j', 'ying (Frau)', 'tief', ['y']],
    ['ฑ', 'th', 'montho (Riesin)', 'tief', ['t']], ['ฒ', 'th', 'phuthao (alter Mann)', 'tief', ['t']], ['ณ', 'n', 'nen (Novize)', 'tief'], ['ท', 'th', 'thahaan (Soldat)', 'tief', ['t']],
    ['ธ', 'th', 'thong (Fahne)', 'tief', ['t']], ['น', 'n', 'nuu (Maus)', 'tief'], ['พ', 'ph', 'phaan (Schale)', 'tief', ['p']], ['ฟ', 'f', 'fan (Zahn)', 'tief'],
    ['ภ', 'ph', 'samphao (Segelschiff)', 'tief', ['p']], ['ม', 'm', 'maa (Pferd)', 'tief'], ['ย', 'j', 'yak (Riese)', 'tief', ['y']], ['ร', 'r', 'ruea (Boot)', 'tief'],
    ['ล', 'l', 'ling (Affe)', 'tief'], ['ว', 'w', 'waen (Ring)', 'tief'], ['ฬ', 'l', 'chulaa (Drachen)', 'tief'], ['ฮ', 'h', 'nokhuuk (Eule)', 'tief'],
    ['๐', '0', '', 'zahl'], ['๑', '1', '', 'zahl'], ['๒', '2', '', 'zahl'], ['๓', '3', '', 'zahl'], ['๔', '4', '', 'zahl'],
    ['๕', '5', '', 'zahl'], ['๖', '6', '', 'zahl'], ['๗', '7', '', 'zahl'], ['๘', '8', '', 'zahl'], ['๙', '9', '', 'zahl'],
  ],
  tips: [
    'Thai-Buchstaben haben kleine Kreise („Köpfe“) – Laotisch ist runder und hat weniger Kreise, Khmer hat „Hüte“ und hängende Zeichen darunter.',
    'Jeder Buchstabe hat ein Merkwort: ก ไก่ (gai, Huhn), ข ไข่ (khai, Ei) …',
    'Thailand fährt links – Laos und Kambodscha rechts.',
  ],
}

/* ───────────── Koreanisch (Hangul) ───────────── */

export const HANGUL = {
  groups: [
    ['kons', 'Grund-Konsonanten', 'Die Form zeigt, wie Mund und Zunge stehen.'],
    ['doppel', 'Doppel-Konsonanten', 'Angespannt gesprochen.'],
    ['vokal', 'Grund-Vokale', 'Senkrechte und waagrechte Striche.'],
    ['vokal2', 'Zusammengesetzte Vokale', ''],
  ],
  letters: [
    ['ㄱ', 'g', 'am Silbenende „k“', 'kons', ['k']], ['ㄴ', 'n', '', 'kons'], ['ㄷ', 'd', 'am Silbenende „t“', 'kons', ['t']], ['ㄹ', 'r', 'auch „l“', 'kons', ['l']],
    ['ㅁ', 'm', '', 'kons'], ['ㅂ', 'b', 'am Silbenende „p“', 'kons', ['p']], ['ㅅ', 's', '', 'kons'], ['ㅇ', 'ng', 'am Silbenanfang stumm', 'kons'],
    ['ㅈ', 'dsch', 'wie „j“ in „Jeans“', 'kons', ['j']], ['ㅊ', 'tsch', 'behaucht', 'kons', ['ch']], ['ㅋ', 'k', 'behaucht', 'kons'], ['ㅌ', 't', 'behaucht', 'kons'], ['ㅍ', 'p', 'behaucht', 'kons'], ['ㅎ', 'h', '', 'kons'],
    ['ㄲ', 'kk', '', 'doppel'], ['ㄸ', 'tt', '', 'doppel'], ['ㅃ', 'pp', '', 'doppel'], ['ㅆ', 'ss', '', 'doppel'], ['ㅉ', 'jj', '', 'doppel'],
    ['ㅏ', 'a', '', 'vokal'], ['ㅑ', 'ja', '', 'vokal', ['ya']], ['ㅓ', 'eo', 'offenes o', 'vokal', ['o']], ['ㅕ', 'jeo', '', 'vokal', ['yeo']], ['ㅗ', 'o', '', 'vokal'],
    ['ㅛ', 'jo', '', 'vokal', ['yo']], ['ㅜ', 'u', '', 'vokal'], ['ㅠ', 'ju', '', 'vokal', ['yu']], ['ㅡ', 'eu', 'ungerundetes u', 'vokal'], ['ㅣ', 'i', '', 'vokal'],
    ['ㅐ', 'ae', 'offenes ä', 'vokal2'], ['ㅔ', 'e', '', 'vokal2'], ['ㅘ', 'wa', '', 'vokal2'], ['ㅝ', 'wo', '', 'vokal2'], ['ㅚ', 'oe', '', 'vokal2'], ['ㅟ', 'wi', '', 'vokal2'], ['ㅢ', 'ui', '', 'vokal2'],
  ],
  tips: [
    'Hangul-Buchstaben stehen in Silbenblöcken zusammen: 서울 = ㅅ+ㅓ / ㅇ+ㅜ+ㄹ = Seo-ul.',
    'Kreise (ㅇ) und eckige Blöcke = Koreanisch. Japanisch hat keine Kreise, Chinesisch ist viel dichter.',
    'Viele Städte enden auf 시 (-si, Stadt) oder 군 (-gun, Landkreis).',
  ],
}

/* ───────────── Japanisch: Hiragana & Katakana ───────────── */

const KANA = [
  ['a', 'あ', 'ア'], ['i', 'い', 'イ'], ['u', 'う', 'ウ'], ['e', 'え', 'エ'], ['o', 'お', 'オ'],
  ['ka', 'か', 'カ'], ['ki', 'き', 'キ'], ['ku', 'く', 'ク'], ['ke', 'け', 'ケ'], ['ko', 'こ', 'コ'],
  ['sa', 'さ', 'サ'], ['shi', 'し', 'シ'], ['su', 'す', 'ス'], ['se', 'せ', 'セ'], ['so', 'そ', 'ソ'],
  ['ta', 'た', 'タ'], ['chi', 'ち', 'チ'], ['tsu', 'つ', 'ツ'], ['te', 'て', 'テ'], ['to', 'と', 'ト'],
  ['na', 'な', 'ナ'], ['ni', 'に', 'ニ'], ['nu', 'ぬ', 'ヌ'], ['ne', 'ね', 'ネ'], ['no', 'の', 'ノ'],
  ['ha', 'は', 'ハ'], ['hi', 'ひ', 'ヒ'], ['fu', 'ふ', 'フ'], ['he', 'へ', 'ヘ'], ['ho', 'ほ', 'ホ'],
  ['ma', 'ま', 'マ'], ['mi', 'み', 'ミ'], ['mu', 'む', 'ム'], ['me', 'め', 'メ'], ['mo', 'も', 'モ'],
  ['ya', 'や', 'ヤ'], ['yu', 'ゆ', 'ユ'], ['yo', 'よ', 'ヨ'],
  ['ra', 'ら', 'ラ'], ['ri', 'り', 'リ'], ['ru', 'る', 'ル'], ['re', 'れ', 'レ'], ['ro', 'ろ', 'ロ'],
  ['wa', 'わ', 'ワ'], ['wo', 'を', 'ヲ'], ['n', 'ん', 'ン'],
]
const kanaGroup = r => (/^[aiueo]$/.test(r) ? 'vokal' : r === 'n' ? 'w' : r[0] === 'c' || r === 'shi' ? 's' : r === 'tsu' ? 't' : r === 'fu' ? 'h' : r[0])
const KANA_GROUPS = [
  ['vokal', 'a i u e o', ''], ['k', 'K-Reihe', ''], ['s', 'S-Reihe', 'shi statt si'], ['t', 'T-Reihe', 'chi und tsu'], ['n', 'N-Reihe', ''],
  ['h', 'H-Reihe', 'fu statt hu'], ['m', 'M-Reihe', ''], ['y', 'Y-Reihe', ''], ['r', 'R-Reihe', 'zwischen r und l'], ['w', 'W und n', ''],
]
export const HIRAGANA = {
  groups: KANA_GROUPS,
  letters: KANA.map(([r, h]) => [h, r, '', kanaGroup(r), r === 'shi' ? ['si'] : r === 'chi' ? ['ti'] : r === 'tsu' ? ['tu'] : r === 'fu' ? ['hu'] : r === 'wo' ? ['o'] : undefined]),
  tips: [
    'Hiragana sind rund und weich – für Endungen und japanische Wörter.',
    'Ortsnamen stehen meist in Kanji (chinesische Zeichen), darunter oft in lateinischer Schrift.',
    'Japan fährt links, Südkorea und China rechts.',
  ],
}
export const KATAKANA = {
  groups: KANA_GROUPS,
  letters: KANA.map(([r, , k]) => [k, r, '', kanaGroup(r), r === 'shi' ? ['si'] : r === 'chi' ? ['ti'] : r === 'tsu' ? ['tu'] : r === 'fu' ? ['hu'] : r === 'wo' ? ['o'] : undefined]),
  tips: [
    'Katakana sind eckig und kantig – für Fremdwörter: コーヒー (kōhī) = Kaffee, ホテル (hoteru) = Hotel.',
    'Verwechslungsgefahr: シ (shi) und ツ (tsu), ソ (so) und ン (n).',
  ],
}

/* ───────────── Chinesisch: traditionell oder vereinfacht ───────────── */

// [traditionell, vereinfacht, Bedeutung]
export const CHINESISCH_PAARE = [
  ['國', '国', 'Land'], ['東', '东', 'Osten'], ['門', '门', 'Tor'], ['車', '车', 'Wagen'], ['長', '长', 'lang'], ['華', '华', 'China (prächtig)'],
  ['灣', '湾', 'Bucht (Taiwan = 臺灣)'], ['縣', '县', 'Landkreis'], ['鄉', '乡', 'Gemeinde'], ['鎮', '镇', 'Kleinstadt'], ['龍', '龙', 'Drache'], ['號', '号', 'Nummer'],
  ['線', '线', 'Linie'], ['區', '区', 'Bezirk'], ['開', '开', 'öffnen'], ['關', '关', 'schließen'], ['發', '发', 'senden'], ['電', '电', 'Strom'],
  ['學', '学', 'lernen'], ['醫', '医', 'Arzt'], ['園', '园', 'Garten'], ['書', '书', 'Buch'], ['業', '业', 'Gewerbe'], ['馬', '马', 'Pferd'],
  ['鳥', '鸟', 'Vogel'], ['魚', '鱼', 'Fisch'], ['雲', '云', 'Wolke'], ['機', '机', 'Maschine'], ['場', '场', 'Platz'], ['廣', '广', 'weit (Kanton)'],
  ['島', '岛', 'Insel'], ['鐵', '铁', 'Eisen (Bahn)'], ['銀', '银', 'Silber (Bank)'], ['館', '馆', 'Haus (Museum)'], ['藥', '药', 'Medizin'], ['臺', '台', 'Plattform (Tai-wan)'],
]

/* ───────────── Inuktitut (Silbenschrift) ───────────── */

// Zeilen: Konsonant, Spalten: i, u, a, Endform
const IU = [
  ['', 'ᐃ', 'ᐅ', 'ᐊ', ''], ['p', 'ᐱ', 'ᐳ', 'ᐸ', 'ᑉ'], ['t', 'ᑎ', 'ᑐ', 'ᑕ', 'ᑦ'], ['k', 'ᑭ', 'ᑯ', 'ᑲ', 'ᒃ'], ['g', 'ᒋ', 'ᒍ', 'ᒐ', 'ᒡ'],
  ['m', 'ᒥ', 'ᒧ', 'ᒪ', 'ᒻ'], ['n', 'ᓂ', 'ᓄ', 'ᓇ', 'ᓐ'], ['s', 'ᓯ', 'ᓱ', 'ᓴ', 'ᔅ'], ['l', 'ᓕ', 'ᓗ', 'ᓚ', 'ᓪ'], ['j', 'ᔨ', 'ᔪ', 'ᔭ', 'ᔾ'],
  ['v', 'ᕕ', 'ᕗ', 'ᕙ', 'ᕝ'], ['r', 'ᕆ', 'ᕈ', 'ᕋ', 'ᕐ'], ['q', 'ᕿ', 'ᖁ', 'ᖃ', 'ᖅ'], ['ng', 'ᖏ', 'ᖑ', 'ᖓ', 'ᖕ'],
]
export const INUKTITUT = {
  groups: [
    ['i', 'Spitze nach oben/links: i', 'Die Richtung des Zeichens bestimmt den Vokal.'],
    ['u', 'Gedreht: u', ''],
    ['a', 'Gespiegelt: a', ''],
    ['ende', 'Endformen (klein, hochgestellt)', 'Konsonant ohne Vokal, z.B. am Wortende.'],
  ],
  letters: IU.flatMap(([c, i, u, a, f]) => [
    [i, `${c}i`, '', 'i'], [u, `${c}u`, '', 'u'], [a, `${c}a`, '', 'a'], ...(f ? [[f, c, 'Endform', 'ende']] : []),
  ]),
  tips: [
    'Jede Konsonanten-Form gibt es viermal: gedreht für i, u und a – und klein hochgestellt ohne Vokal.',
    'Iqaluit, die Hauptstadt von Nunavut, schreibt sich ᐃᖃᓗᐃᑦ.',
    'Auf Schildern in Nunavut steht Inuktitut meist über Englisch und Französisch.',
  ],
}

/* ───────────── Ägyptische Hieroglyphen (Einkonsonantenzeichen) ───────────── */

export const HIEROGLYPHEN = {
  groups: [
    ['tiere', 'Tiere', ''],
    ['koerper', 'Körperteile', ''],
    ['dinge', 'Dinge & Natur', ''],
  ],
  letters: [
    ['𓄿', 'a', 'Geier – Kehlkopf-Laut (ꜣ)', 'tiere', ['3']], ['𓅱', 'w', 'Wachtelküken – auch „u“', 'tiere', ['u']], ['𓃀', 'b', 'Fuß', 'koerper'],
    ['𓇋', 'i', 'Schilfblatt', 'dinge', ['j']], ['𓇌', 'j', 'zwei Schilfblätter – „y“', 'dinge', ['y']], ['𓂝', 'ʿa', 'Unterarm – Kehllaut (ꜥ)', 'koerper', ['a']],
    ['𓊪', 'p', 'Hocker', 'dinge'], ['𓆑', 'f', 'Hornviper', 'tiere'], ['𓅓', 'm', 'Eule', 'tiere'], ['𓈖', 'n', 'Wasser', 'dinge'],
    ['𓂋', 'r', 'Mund', 'koerper'], ['𓉔', 'h', 'Hof', 'dinge'], ['𓎛', 'ḥ', 'gedrehter Docht – kräftiges h', 'dinge', ['h']], ['𓐍', 'ch', 'Plazenta – wie „Bach“ (ḫ)', 'dinge', ['kh']],
    ['𓄡', 'ch', 'Bauch mit Schwanz – wie „ich“ (ẖ)', 'tiere', ['kh']], ['𓋴', 's', 'gefaltetes Tuch', 'dinge'], ['𓊃', 's', 'Türriegel – stimmhaft (z)', 'dinge', ['z']],
    ['𓈙', 'sch', 'Teich', 'dinge', ['sh']], ['𓈎', 'q', 'Hügel', 'dinge', ['k']], ['𓎡', 'k', 'Korb mit Henkel', 'dinge'], ['𓎼', 'g', 'Krugständer', 'dinge'],
    ['𓏏', 't', 'Brotlaib', 'dinge'], ['𓍿', 'tsch', 'Seil zum Anbinden (ṯ)', 'dinge', ['ch']], ['𓂧', 'd', 'Hand', 'koerper'], ['𓆓', 'dsch', 'Kobra (ḏ)', 'tiere', ['dj']],
  ],
  tips: [
    'Diese 25 Zeichen stehen je für einen Konsonanten – wie ein Alphabet. Vokale wurden nicht geschrieben.',
    'Königsnamen stehen in einem Oval, der „Kartusche“.',
    'Gelesen wird in die Richtung, in die die Gesichter von Menschen und Tieren schauen.',
  ],
}

/* ───────────── Lateinische Sonderzeichen: welche Sprache? ───────────── */

// Nur Zeichen, die (unter den europäischen Sprachen) praktisch eine Sprache verraten
export const LATEIN = {
  groups: [
    ['west', 'West- und Nordeuropa', ''],
    ['ost', 'Mittel- und Osteuropa', ''],
    ['sued', 'Südeuropa & Türkei', ''],
    ['asien', 'Außerhalb Europas', ''],
  ],
  letters: [
    ['ß', 'Deutsch', 'Eszett – nur im Deutschen (nicht in der Schweiz)', 'west'], ['ð þ', 'Isländisch', 'Eth und Thorn (ð auch Färöisch)', 'west'],
    ['ø', 'Dänisch/Norwegisch', 'durchgestrichenes o', 'west'], ['ŵ ŷ', 'Walisisch', 'Zirkumflex auf w und y', 'west'],
    ['ł', 'Polnisch', 'durchgestrichenes l (wie „w“)', 'ost'], ['ą ę', 'Polnisch', 'Nasal-Vokale mit Haken', 'ost'], ['ż', 'Polnisch', 'z mit Punkt (gibt es sonst nur noch im Maltesischen)', 'ost'],
    ['ő ű', 'Ungarisch', 'doppelter Akzent', 'ost'], ['ř', 'Tschechisch', 'r mit Haken', 'ost'], ['ů', 'Tschechisch', 'u mit Kreis', 'ost'],
    ['ĺ ŕ', 'Slowakisch', 'Akzent auf l und r', 'ost'], ['ľ', 'Slowakisch', 'l mit Apostroph', 'ost'],
    ['ė', 'Litauisch', 'e mit Punkt', 'ost'], ['ų į', 'Litauisch', 'Haken unten an u und i', 'ost'], ['ļ ķ ņ', 'Lettisch', 'Komma unter l, k und n', 'ost'], ['ā ē ī', 'Lettisch', 'Längenstriche auf a, e und i', 'ost'],
    ['ș ț', 'Rumänisch', 'Komma unter s und t', 'sued'], ['ı', 'Türkisch', 'i ohne Punkt', 'sued'], ['ğ', 'Türkisch', 'g mit Bogen', 'sued'],
    ['ħ', 'Maltesisch', 'durchgestrichenes h', 'sued'], ['ċ ġ', 'Maltesisch', 'c und g mit Punkt', 'sued'],
    ['ñ', 'Spanisch', 'Tilde auf n (auch Spanisch in Südamerika)', 'sued'], ['ã', 'Portugiesisch', 'Tilde auf a', 'sued'], ['ë', 'Albanisch', 'e mit Punkten – sehr häufig', 'sued'],
    ['ư ơ', 'Vietnamesisch', 'Haken an u und o', 'asien'], ['ạ ả ẫ', 'Vietnamesisch', 'Tonzeichen – oft zwei auf einem Buchstaben', 'asien'],
  ],
  tips: [
    'å, ä, ö allein reicht nicht – das gibt es in Schweden, Finnland, Estland und teils Norwegen/Dänemark.',
    'š, ž, č gibt es in vielen Sprachen (Tschechisch, Slowakisch, Slowenisch, Kroatisch, Baltisch) – dann auf weitere Zeichen achten.',
    'Kein einziges Sonderzeichen auf vielen Schildern? Dann vielleicht Englisch, Niederländisch oder Indonesisch.',
  ],
}

/* ───────────── Schilder-Wörter Spanisch · Portugiesisch · Französisch ───────────── */

// [Wort, Bedeutung, Sprache, Hinweis]
export const SCHILDER = [
  ['CALLE', 'Straße', 'es'], ['AVENIDA', 'Allee / große Straße', 'es'], ['SALIDA', 'Ausfahrt', 'es'], ['PELIGRO', 'Gefahr', 'es'], ['DESPACIO', 'Langsam', 'es'],
  ['CEDA EL PASO', 'Vorfahrt gewähren', 'es'], ['PROHIBIDO', 'Verboten', 'es'], ['PEAJE', 'Maut', 'es'], ['OBRAS', 'Baustelle', 'es'], ['CARRETERA', 'Landstraße', 'es'],
  ['GLORIETA', 'Kreisverkehr (Spanien, Mexiko)', 'es'], ['ROTONDA', 'Kreisverkehr', 'es'], ['TOPE', 'Bodenschwelle (Mexiko)', 'es'], ['ESCUELA', 'Schule', 'es'], ['CURVA PELIGROSA', 'Gefährliche Kurve', 'es'],
  ['RUA', 'Straße', 'pt'], ['SAÍDA', 'Ausfahrt', 'pt'], ['PERIGO', 'Gefahr', 'pt'], ['DEVAGAR', 'Langsam', 'pt'], ['PROIBIDO', 'Verboten', 'pt'],
  ['PORTAGEM', 'Maut (Portugal)', 'pt'], ['PEDÁGIO', 'Maut (Brasilien)', 'pt'], ['LOMBADA', 'Bodenschwelle (Brasilien)', 'pt'], ['ESTRADA', 'Landstraße', 'pt'], ['OBRAS', 'Baustelle', 'pt'],
  ['RUE', 'Straße', 'fr'], ['SORTIE', 'Ausfahrt', 'fr'], ['DANGER', 'Gefahr', 'fr'], ['RALENTIR', 'Langsamer fahren', 'fr'], ['CÉDEZ LE PASSAGE', 'Vorfahrt gewähren', 'fr'],
  ['INTERDIT', 'Verboten', 'fr'], ['PÉAGE', 'Maut', 'fr'], ['TRAVAUX', 'Baustelle', 'fr'], ['TOUTES DIRECTIONS', 'Alle Richtungen', 'fr'], ['CENTRE-VILLE', 'Stadtzentrum', 'fr'],
]

/* ───────────── Verwechsler: Zeichen, die sich zum Verwechseln ähnlich sehen ───────────── */

// Je Deck Gruppen von Zeichen (jeweils das erste Zeichen der Karte) – geübt wird nur innerhalb einer Gruppe
export const VERWECHSLER = {
  kyrillisch: [['В', 'Б', 'Ь', 'Ъ', 'Ы'], ['Ш', 'Щ', 'Ц'], ['И', 'Й', 'Н'], ['Е', 'Ё', 'Э'], ['Р', 'Я'], ['Ж', 'Х', 'К'], ['Г', 'П', 'Т'], ['Л', 'Д', 'П']],
  griechisch: [['Η η', 'Ν ν', 'Υ υ'], ['Ρ ρ', 'Φ φ'], ['Χ χ', 'Ξ ξ', 'Ψ ψ'], ['Ο ο', 'Θ θ', 'Ω ω'], ['Γ γ', 'Λ λ', 'Δ δ'], ['Β β', 'Ζ ζ']],
  georgisch: [['ბ', 'ზ', 'ჭ'], ['დ', 'ღ', 'ლ'], ['მ', 'ძ', 'ქ'], ['ს', 'ხ', 'წ'], ['ნ', 'ჩ', 'ც'], ['ი', 'ე', 'ვ'], ['პ', 'ფ', 'გ'], ['კ', 'ჰ', 'ჯ']],
  armenisch: [['Ո ո', 'Ս ս', 'Ռ ռ'], ['Ն ն', 'Պ պ', 'Ղ ղ'], ['Հ հ', 'Յ յ', 'Ձ ձ'], ['Կ կ', 'Դ դ', 'Ք ք'], ['Բ բ', 'Թ թ', 'Ը ը']],
  hebraeisch: [['ב', 'כ', 'פ'], ['ד', 'ר', 'ך'], ['ה', 'ח', 'ת'], ['ו', 'ז', 'ן', 'י'], ['ס', 'ם'], ['ע', 'צ', 'ט'], ['ג', 'נ']],
  arabisch: [['ب', 'ت', 'ث', 'ن', 'ي'], ['ج', 'ح', 'خ'], ['د', 'ذ'], ['ر', 'ز'], ['س', 'ش'], ['ص', 'ض'], ['ط', 'ظ'], ['ع', 'غ'], ['ف', 'ق'], ['پ', 'چ', 'ژ', 'گ']],
  thai: [['ด', 'ต', 'ค'], ['บ', 'ป', 'ษ'], ['พ', 'ฟ', 'ผ', 'ฝ'], ['ข', 'ช', 'ซ'], ['ถ', 'ภ', 'ฤ'], ['ม', 'ห', 'น', 'ฬ'], ['ร', 'ธ', 'ว'], ['อ', 'ฮ', 'ล']],
  hangul: [['ㅓ', 'ㅗ', 'ㅏ', 'ㅜ'], ['ㅕ', 'ㅛ', 'ㅑ', 'ㅠ'], ['ㅐ', 'ㅔ'], ['ㄱ', 'ㅋ', 'ㄲ'], ['ㄷ', 'ㅌ', 'ㄸ'], ['ㅂ', 'ㅍ', 'ㅃ'], ['ㅈ', 'ㅊ', 'ㅉ'], ['ㅅ', 'ㅆ'], ['ㅇ', 'ㅎ']],
  hiragana: [['ぬ', 'め'], ['ね', 'れ', 'わ'], ['は', 'ほ', 'け'], ['さ', 'ち', 'き'], ['る', 'ろ'], ['い', 'り'], ['あ', 'お'], ['こ', 'に'], ['し', 'つ']],
  katakana: [['シ', 'ツ'], ['ソ', 'ン'], ['ク', 'ケ', 'タ'], ['ワ', 'ウ', 'フ'], ['コ', 'ユ', 'ロ'], ['チ', 'テ'], ['ヌ', 'ス', 'マ'], ['ノ', 'メ']],
  inuktitut: [['ᐃ', 'ᐅ', 'ᐊ'], ['ᐱ', 'ᐳ', 'ᐸ'], ['ᑎ', 'ᑐ', 'ᑕ'], ['ᑭ', 'ᑯ', 'ᑲ'], ['ᒥ', 'ᒧ', 'ᒪ'], ['ᓂ', 'ᓄ', 'ᓇ'], ['ᓯ', 'ᓱ', 'ᓴ'], ['ᓕ', 'ᓗ', 'ᓚ']],
}

/* ───────────── Zahlen in anderen Schriften ───────────── */

// Ziffern 0–9 je Schrift (Unicode-Blöcke, jeweils fortlaufend)
export const ZAHLEN = [
  ['arabisch', 'Arabisch (Ägypten, Golf, Irak …)', '٠١٢٣٤٥٦٧٨٩'],
  ['persisch', 'Persisch & Urdu', '۰۱۲۳۴۵۶۷۸۹'],
  ['devanagari', 'Devanagari (Hindi, Marathi, Nepal)', '०१२३४५६७८९'],
  ['bengalisch', 'Bengalisch (Bangladesch, Westbengalen)', '০১২৩৪৫৬৭৮৯'],
  ['thai', 'Thai', '๐๑๒๓๔๕๖๗๘๙'],
  ['lao', 'Laotisch', '໐໑໒໓໔໕໖໗໘໙'],
  ['khmer', 'Khmer (Kambodscha)', '០១២៣៤៥៦៧៨៩'],
  ['chinesisch', 'Chinesisch & Japanisch (Zahlzeichen)', '〇一二三四五六七八九'],
]
