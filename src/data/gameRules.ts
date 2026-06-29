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
                    'Grup: aynı sayıdan farklı renklerde 3-4 taş (örn. 8 kırmızı, 8 siyah, 8 mavi).',
                    'Okey taşı ve sahte okey joker gibidir; eksik taşın yerine geçer.',
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
            'Sadece 2 joker var; en kritik seri/grup için sakla.',
        ],
    },

    '101': {
        key: '101',
        title: '101 Okey',
        tagline: "Perlerini aç, elini boşalt; puanın 101'e ulaşmasın.",
        accent: 'rose',
        objective:
            "Taşlarını perlere (seri/grup) ayırıp elini ilk bitiren eli kazanır. Biri 101 puana ulaşınca oyun biter ve en düşük puanlı oyuncu kazanır.",
        sections: [
            {
                heading: 'Kurulum',
                items: [
                    'Oyun 4 kişiliktir; herkesin 30 yuvalı (2×15) bir ıstakası vardır.',
                    'Başlayan oyuncu 15, diğerleri 14 taşla başlar.',
                    "Bir gösterge taşı açılır; onun bir üstü o elin 'okey'i (joker) olur — gösterge 13 ise okey 1'dir.",
                ],
            },
            {
                heading: 'Nasıl Oynanır',
                items: [
                    'Sıran gelince ortadaki desteden ya da kendinden önceki oyuncunun ıskartasından bir taş çekersin.',
                    'Henüz açmadıysan, açmak için tek seferde en az 51 puanlık geçerli per indirmelisin.',
                    'Per türleri: Grup (aynı sayı, 3-4 farklı renk) ve Seri (aynı renk, 3+ ardışık sayı).',
                    'Açtıktan sonra masadaki perlere taş ekleyebilirsin (tur başına her pere en fazla 1 taş).',
                    'Okey/sahte okey joker olarak perlerdeki eksikleri tamamlar.',
                    'Sıranı bitirmek için kendi ıskartana bir taş atarsın.',
                    'Taşlarını Seri / Çift / Akıllı düğmeleriyle dizebilirsin.',
                ],
            },
            {
                heading: 'Puanlama',
                items: [
                    '1 → 1 puan, 2-10 → kendi değeri, 11-12-13 → 10’ar puan; joker elde kalırsa 25 puan.',
                    'İlk açışta jokerler temsil ettiği taşın değerini sayar.',
                ],
            },
            {
                heading: 'Kazanma',
                items: [
                    'Elini ilk bitiren (0 taş) o eli kazanır ve puan almaz.',
                    'Kaybedenler elde kalan taşların puanını toplam puanlarına ekler.',
                    "Bir oyuncu 101'e ulaşınca oyun biter; en düşük puanlı oyuncu kazanır.",
                ],
            },
        ],
        tips: [
            'İlk açış için yüksek taşları (11-12-13) ve hazır perleri biriktir.',
            'Düşük puanlı taşları (1-2) elde tutmak daha az risklidir.',
            'Rakiplerin ıskartalarını takip et; ellerini tahmin etmene yardım eder.',
        ],
    },
};
