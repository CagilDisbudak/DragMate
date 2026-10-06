// Per-game rules content shown in the lobby before entering a game.
// Wording reflects how each game is ACTUALLY implemented in this app
// (deal sizes, turn flow, win conditions, AI levels) — verified against the logic.

export type GameKey = 'chess' | 'backgammon' | 'okey' | '101';

export type RuleAccent = 'indigo' | 'emerald' | 'amber' | 'rose';

export interface RuleSection {
    heading: string;
    items: string[];
}

export interface GameRules {
    key: GameKey;
    title: string;
    tagline: string;
    objective: string;
    accent: RuleAccent;
    sections: RuleSection[];
    tips: string[];
}

export const GAME_RULES: Record<GameKey, GameRules> = {
    chess: {
        key: 'chess',
        title: 'Satranç',
        tagline: 'Klasik satranç — yapay zekâya veya çevrimiçi bir rakibe karşı.',
        accent: 'indigo',
        objective:
            'Rakibin şahını mat ederek (kaçışı olmayan bir tehdit altına alarak) oyunu kazan.',
        sections: [
            {
                heading: 'Kurulum',
                items: [
                    "8×8'lik tahtada her oyuncunun 16 taşı vardır: şah, vezir, 2 fil, 2 at, 2 kale ve 8 piyon.",
                    'Tek oyuncu modunda sen beyazsın, yapay zekâ siyah; ilk hamle senindir.',
                ],
            },
            {
                heading: 'Nasıl Oynanır',
                items: [
                    'Bir taşı sürükleyip hedef kareye bırakarak hamle yap; geçerli kareler vurgulanır.',
                    "Taşlar klasik kurallarla gider: piyon ileri, kale düz, fil çapraz, at 'L', vezir her yöne, şah bir kare.",
                    'Karşı kenara ulaşan piyon otomatik olarak vezire terfi eder.',
                    "Şahın tehdit altındaysa 'şah' uyarısı çıkar; hamlenle tehdidi kaldırmalısın.",
                ],
            },
            {
                heading: 'Kazanma',
                items: [
                    'Rakibin şahı mat olursa (tehdit altında ve hamlesi yoksa) kazanırsın.',
                    'Hamle kalmaz ama şah tehdit altında değilse ya da yeterli taş kalmazsa oyun berabere biter.',
                ],
            },
            {
                heading: 'Zorluk Seviyeleri',
                items: [
                    'Kolay: yapay zekâ çoğunlukla rastgele oynar.',
                    'Normal: 2 hamle ileriyi hesaplar.',
                    'Zor: 3 hamle ileriyi hesaplar ve en güçlü hamleyi seçer.',
                ],
            },
        ],
        tips: [
            'Açılışta merkezi (d4-d5-e4-e5) kontrol etmeye çalış.',
            'Şahını erken güvene al; açıkta bırakma.',
            'Her hamleden önce rakibin tehditlerini kontrol et.',
        ],
    },

    backgammon: {
        key: 'backgammon',
        title: 'Tavla',
        tagline: 'Zar at, taşlarını yürüt, rakibini vur ve hepsini topla.',
        accent: 'emerald',
        objective:
            '15 taşının tümünü kendi ev bölgene getirip tahtadan toplayan (çıkaran) ilk oyuncu ol.',
        sections: [
            {
                heading: 'Kurulum',
                items: [
                    "Her oyuncunun 15 taşı vardır; beyaz 0'dan 23'e, siyah 23'ten 0'a doğru ilerler.",
                    'Oyuna her zaman beyaz başlar.',
                ],
            },
            {
                heading: 'Nasıl Oynanır',
                items: [
                    'Sıran gelince iki zar atarsın; farklı gelirse 2, çift (aynı sayı) gelirse 4 hamle hakkın olur.',
                    'Her zar değeri kadar bir taşı ileri taşırsın; zarları ayrı ayrı kullanabilirsin.',
                    'Rakibin 2 veya daha fazla taşının olduğu noktalara giremezsin.',
                    "Rakibin tek taşının (blot) üstüne gelirsen onu kırar, bar'a (ortaya) gönderirsin.",
                    "Bar'da taşın varsa önce onu oyuna sokmalısın.",
                    'Geçerli hamlen yoksa sıra rakibe geçer.',
                ],
            },
            {
                heading: 'Ev Bölgesi ve Toplama',
                items: [
                    'Ev bölgesi: beyaz için 18-23, siyah için 0-5 noktalarıdır.',
                    'Tüm taşların eve girince toplamaya (çıkarmaya) başlarsın.',
                    "Bar'da taşın varken toplama yapamazsın.",
                ],
            },
            {
                heading: 'Kazanma',
                items: ['15 taşının tümünü tahtadan ilk toplayan oyunu kazanır.'],
            },
        ],
        tips: [
            'Tek taş (blot) bırakmamaya çalış; kırılabilir.',
            "Bir noktaya 2 taş koyarak 'kapı' tut; rakip oraya giremez.",
            'Rakibin taşını kırmak ona ciddi zaman kaybettirir.',
        ],
    },

    okey: {
        key: 'okey',
        title: 'Okey',
        tagline: 'Renkli taşları seri ve gruplara dizip eli ilk bitiren ol.',
        accent: 'amber',
        objective:
            'Taşlarını seri (aynı renk ardışık) ve gruplara (aynı sayı, farklı renk) ayır; geçerli bir el tamamlayıp bir taş atarak oyunu bitir.',
        sections: [
            {
                heading: 'Kurulum',
                items: [
                    'Oyun 4 kişiliktir: sen ve 3 bilgisayar oyuncusu.',
                    'Toplam 106 taş vardır (4 renkte 1-13, ikişer kopya + 2 sahte okey).',
                    'Başlayan oyuncu 15, diğerleri 14 taşla başlar.',
                    "Bir gösterge taşı açılır; onun bir üstü (aynı renk) o elin 'okey'i olur — gösterge 13 ise okey 1'dir.",
                ],
            },
            {
                heading: 'Nasıl Oynanır',
                items: [
                    'Sıran gelince ortadaki desteden ya da kendinden önceki oyuncunun ıskartasından bir taş çekersin.',
                    'Elin 15 taşa ulaşınca bir taş atarak sıranı bitirirsin.',
                    'Seri: aynı renkten ardışık 3 veya daha fazla taş (örn. kırmızı 5-6-7).',
                    "13'ten sonra 1 gelebilir (örn. 11-12-13-1); fakat 13-1-2 şeklinde devam edemez.",
                    'Grup: aynı sayıdan farklı renklerde 3-4 taş (örn. 8 kırmızı, 8 siyah, 8 mavi).',
                    'Okey taşı jokerdir; seri veya gruptaki eksik herhangi bir taşın yerine geçer.',
                    'Sahte okey (yonca desenli taş) joker değildir; okeyin rengi ve sayısı yerine geçer.',
                    "'Düzenle' düğmesiyle taşların otomatik olarak dizilir.",
                ],
            },
            {
                heading: 'Kazanma',
                items: [
                    'Elindeki 14 taşı tümüyle geçerli seri/gruplara dizip son taşı atınca kazanırsın.',
                    "El geçerli değilse 'Eliniz okey değil!' uyarısı çıkar ve oyun sürer.",
                    'Ortadaki taşlar biterse ıskartalar karıştırılıp devam edilir ya da el berabere biter.',
                ],
            },
        ],
        tips: [
            'Okey taşını koru; bir önceki oyuncu ıskartandan çalabilir.',
            'Iskartalara dikkat et; rakiplerin ne topladığına dair ipucu verir.',
            'Sadece 2 okey (joker) taşı var; en kritik seri/grup için sakla.',
        ],
    },

    '101': {
        key: '101',
        title: '101 Okey',
        tagline: 'Perlerini aç, elini bitir; en az ceza puanıyla oyunu kazan.',
        accent: 'rose',
        objective:
            'Elindeki taşları kurallı perler halinde masaya açıp ıstakandaki taşları bitirmek. El bitince en az ceza puanına sahip olan oyuncu önde gider; biri 101 puana ulaşınca oyun biter ve en düşük puanlı oyuncu kazanır.',
        sections: [
            {
                heading: 'Taş Dağıtımı ve Başlangıç',
                items: [
                    'Oyun 4 kişiliktir. Dağıtıcı taşları 7’şerli bloklar halinde dizer.',
                    'Bir gösterge taşı belirlenir; bu taşın bir üstü (aynı renk) o elin Okey (Joker) taşıdır. Gösterge 13 ise okey 1’dir.',
                    'Okey her taşın yerine geçebilir. Sahte okey joker değildir: okeyin rengi ve sayısı yerine geçer.',
                    'Dağıtıcının sağındaki oyuncuya 22, diğer 3 oyuncuya 21 taş dağıtılır.',
                    '22 taşı olan oyuncu taş çekmeden yere bir taş atarak oyunu başlatır.',
                    'Eli kazanan bir sonraki eli dağıtır; kazanan çıkmazsa dağıtım sıradaki oyuncuya geçer.',
                ],
            },
            {
                heading: 'Per (Grup) Çeşitleri',
                items: [
                    'Yere taş açmak için en az 3 taştan oluşan geçerli perler gerekir.',
                    'Seri per: aynı renkten ardışık sayılar (örn. Mavi 7-8-9 veya Siyah 1-2-3).',
                    '13’ten sonra 1 gelebilir (12-13-1); fakat 13-1-2 şeklinde devam edemez.',
                    'Renk per: farklı renklerdeki aynı sayılar (örn. Kırmızı 5, Mavi 5, Siyah 5).',
                    'Okey, perdeki eksik taşın yerine geçer ve onun puanını alır.',
                ],
            },
            {
                heading: 'El Açma (Normal ve Çift)',
                items: [
                    'Normal açış: açtığın perlerin üzerindeki sayıların toplamı en az 101 olmalıdır. Barajı geçiyorsan taşlarını masaya açabilirsin.',
                    'Çift açış: aynı renk ve sayıdan çiftler biriktirirsen (örn. iki Mavi 4, iki Kırmızı 9) en az 5 çiftle masaya açabilirsin; 101 şartı aranmaz. Okey tek kalan bir taşı çifte tamamlayabilir.',
                    'Açılış perlerini aynı tur içinde tek tek indirebilirsin. 101’e ulaşamazsan "Geri Al" ile bu tur indirdiğin perleri ıstakana geri alırsın. Normal açış ile çift açış aynı turda karıştırılamaz.',
                ],
            },
            {
                heading: 'Taş Çekme ve İşleme',
                items: [
                    'Sıran gelince ya desteden gizli bir taş çekersin ya da bir önceki oyuncunun attığı taşı alırsın.',
                    'Elini henüz açmadıysan yandaki (önceki oyuncunun) taşı ancak o taşı kullanarak aynı tur elini açabileceksen alabilirsin; aldıysan turu açmadan bitiremezsin. Vazgeçersen "Geri Al" taşı yerine koyar ve desteden çekebilirsin.',
                    'Elini açtıktan sonra yan taşı serbestçe alabilirsin.',
                    'Elini açtıktan sonra (normal veya çift) kendinin veya rakiplerin perlerine uygun taş ekleyebilirsin (örn. Mavi 7-8-9’a Mavi 6 veya 10).',
                    'Elini açmayan oyuncu taş işleyemez.',
                    'Sıranı bitirmek için kendi ıskartana bir taş atarsın.',
                ],
            },
            {
                heading: 'Puanlama ve Ceza',
                items: [
                    'Elini bitiren oyuncu (tüm taşlarını perlere açarak veya son taşını atarak) 0 ceza puanı alır.',
                    'Hiç el açamayanlar: oyun bittiğinde masaya hiç taş açmamış oyunculara +202 ceza yazılır.',
                    'El açıp bitiremeyenler: ıstakada kalan taşların sayı toplamı kadar ceza alır (Okey 25, sahte okey okeyin sayısı kadar sayılır).',
                    'Çift açıp bitiremeyenler: kalan taş toplamının iki katı ceza alır.',
                    'Çift açıp eli bitiren oyuncu varsa, diğer tüm oyuncuların o eldeki cezaları ikiye katlanır.',
                    'Deste biterse el kazanansız biter; herkesin cezası yukarıdaki kurallarla yazılır (katlama olmaz).',
                    'Bir oyuncu 101 ceza puanına ulaşınca oyun biter; en düşük puanlı oyuncu kazanır.',
                ],
            },
            {
                heading: 'Katlama Cezaları (+101)',
                items: [
                    'Okeyi yere atmak: Okey ıskartaya atılamaz; yalnızca elinde Okey’den başka taş kalmadıysa atabilirsin ve +101 ceza yazılır.',
                    'Oyun, pere uymayan taşın işlenmesine ve 101’e ulaşmayan açışın tamamlanmasına izin vermez; eksik açış "Geri Al" ile cezasız geri alınır.',
                ],
            },
        ],
        tips: [
            'Normal açış için toplamı 101’i geçen yüksek perler biriktir; acele açma.',
            'Çift açmayı düşünüyorsan en az 5 sağlam çift hedefle; bitiremezsen ceza ikiye katlanır.',
            'Yan taşı ancak o taşla açabileceksen al; aksi halde desteden çek.',
            'Okey taşını ıskartaya atma — yalnızca başka taşın kalmadıysa atılabilir ve +101 ceza gelir.',
        ],
    },
};
