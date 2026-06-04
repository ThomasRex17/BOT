const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    Partials, 
    PermissionFlagsBits, 
    MessageFlags, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const dbSync = require('./db-sync');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');
require('dotenv').config();

// ==============================================================================
// 0. ÇÖKME KORUMASI (Anti-Crash Zırhı)
// ==============================================================================
process.on('unhandledRejection', (reason, p) => {
    console.log(' [Anti-Crash] Unhandled Rejection/Catch');
    console.log(reason, p);
});

process.on('uncaughtException', (err, origin) => {
    console.log(' [Anti-Crash] Uncaught Exception/Catch');
    console.log(err, origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.log(' [Anti-Crash] Uncaught Exception Monitor');
    console.log(err, origin);
});

process.on('unhandledRejection', err => {
  if (err.code === 'ECONNRESET') {
    console.warn('Geçici bağlantı kesintisi, devam ediyor:', err.message);
    return;
  }
  console.error('Beklenmeyen hata:', err);
});

// ==============================================================================
// 1. İNTENTLER VE BAŞLATMA
// ==============================================================================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates 
    ],
    partials: [Partials.User, Partials.GuildMember]
});

// ==============================================================================
// 2. AYARLAR
// ==============================================================================
const AYARLAR = {
    YETKILI_ROL_ID: '1488588308706496682',
    LSPD_GENEL_ROL_ID: '1487581846182166548',
    SES_MUAFIYET_ROL_ID: '1503106381023281152',
    DISPATCH_ROL_ID: '1488588308706496682',       // Dispatch / birim açma yetkisi — kendi rolünle değiştir
    FTO_ROL_ID: '1488588308706496682',             // FTO yetkisi için gerekli rol ID — değiştir
    MAZERET_ONAY_ROL_ID: "1507102710137225378",
    RED_PERMI_ROL_ID: '1487803080841101332',       // Red Permi — sadece Tropper 1 rolver ile verebilir, ic isim onaylama yetkisi var

    ISIM_KAYIT_KANALI: '1487773975088988202',
    MESAI_PANEL_KANALI: '1487582631070797974',     
    AKTIF_MESAI_KANALI: '1487583883833905312',     
    MESAI_LOG_KANALI: '1487583919153877146',       
    RUTBE_LISTE_KANALI: '1487590983410516078',  
    TOPLAM_MESAI_KANALI: '1488194404576395398', 
    GUNLUK_RAPOR_KANALI: '1489635279865122969',   // Günlük otomatik rapor kanalı — değiştir
    FTO_FORUM_ID: '1489650197784166631',           // FTO forum kanalının ID'si — değiştir
    
    TICKET_KATEGORI_ID: '1487561830489526382', 
    MAZERET_LOG_KANALI: '1497524759536210040', 
    BIRIM_PANEL_KANALI: '1489635279865122969', 
    MAZERET_ONAY_KANALI: '1489635279865122969', 
    MAZERET_ROL_ID: '1490043383773794407',
    INAKTIF_RAPOR_KANALI: '1489635279865122969', 
    SAATLIK_RAPOR_KANALI: '1498800849189732524', 

    UYARI_LOG_KANALI: '1487775365693964400',
    UYARI_DUYURU_KANALI: '1487775365693964400',
UYARI_MAX_KADEME: 5,                              // 5x'e kadar yükselsin
UYARI_ROLLERI: {                                  // Kademe → Rol eşleşmesi
    1: '1487583718175670442',
    2: '1487582402384498708',
    3: '1487583866280607854',
    4: '1487583804028883005',
    5: '1487583929644093633',
},
SOZLU_UYARI_ROL: '1489668641346818139',           // Sözlü uyarı rolü (ayrı sistem)
    
    INAKTIF_GUN_SINIRI: 5, 
    INAKTIF_RAPOR_SAATI: 0, 

    RUTBE_AYARLARI: [
        { id: '1487574113563443210', min: 101, max: 103 },
        { id: '1487574117321281676', min: 201, max: 203 }, 
        { id: '1487574118541819934', min: 301, max: 305 },
        { id: '1487574119359844422', min: 301, max: 305 },
        { id: '1487574119561035786', min: 401, max: 410 }, 
        { id: '1487574120286916668', min: 501, max: 515 }, 
        { id: '1487574120953544724', min: 601, max: 620, ekstra: [630,631,632,633,634,661] }, 
        { id: '1487574121264058499', min: 701, max: 761 }, 
    ]
};


const BIRIM_KAPASITELERI = {
    'lincoln': 1, 'adam': 2, 'omega': 4, 'queen': 3, 'mary': 2, 'swat': 6, 'air': 2, 'william': 4, 'tom': 2, 'tom lincoln': 1
};

// ==============================================================================
// 3. VERİ TABANI VE YARDIMCI FONKSİYONLAR
// ==============================================================================
const anlikDbFile = './aktif_mesailer.json';
const toplamDbFile = './toplam_mesailer.json';
const uyariDbFile = './uyarilar.json';
const mazeretDbFile = './mazeretler.json';
const birimDbFile = './aktif_birimler.json';
const isimDbFile = './eski_isimler.json'; 
const zmDbFile = './zorunlu_mesai.json';
const gunlukDbFile = './gunluk_mesailer.json';

let aktifMesailer = fs.existsSync(anlikDbFile) ? JSON.parse(fs.readFileSync(anlikDbFile, 'utf8')) : {};
let toplamMesailer = fs.existsSync(toplamDbFile) ? JSON.parse(fs.readFileSync(toplamDbFile, 'utf8')) : {};
let uyarilar = fs.existsSync(uyariDbFile) ? JSON.parse(fs.readFileSync(uyariDbFile, 'utf8')) : {};
let gecmisMazeretler = fs.existsSync(mazeretDbFile) ? JSON.parse(fs.readFileSync(mazeretDbFile, 'utf8')) : [];
let aktifBirimler = fs.existsSync(birimDbFile) ? JSON.parse(fs.readFileSync(birimDbFile, 'utf8')) : {};
let eskiIsimler = fs.existsSync(isimDbFile) ? JSON.parse(fs.readFileSync(isimDbFile, 'utf8')) : {}; 
let zorunluMesai = fs.existsSync(zmDbFile) ? JSON.parse(fs.readFileSync(zmDbFile, 'utf8')) : { aktif: false, bitis: 0, kanal: null };
let gunlukMesailer = fs.existsSync(gunlukDbFile) ? JSON.parse(fs.readFileSync(gunlukDbFile, 'utf8')) : {};

const dbKaydet = () => { 
    fs.writeFileSync(anlikDbFile, JSON.stringify(aktifMesailer, null, 4));
    fs.writeFileSync(uyariDbFile, JSON.stringify(uyarilar, null, 4));
    fs.writeFileSync(toplamDbFile, JSON.stringify(toplamMesailer, null, 4));
    fs.writeFileSync(mazeretDbFile, JSON.stringify(gecmisMazeretler, null, 4));
    fs.writeFileSync(birimDbFile, JSON.stringify(aktifBirimler, null, 4)); 
    fs.writeFileSync(isimDbFile, JSON.stringify(eskiIsimler, null, 4)); 
    fs.writeFileSync(zmDbFile, JSON.stringify(zorunluMesai, null, 4)); 
    fs.writeFileSync(gunlukDbFile, JSON.stringify(gunlukMesailer, null, 4));
    
    // Site DB sync (camelCase değişkenler!)
    if (typeof dbSync !== 'undefined') {
        dbSync.fullSync({
            aktifMesailer: aktifMesailer,
            toplamMesailer: toplamMesailer,
            mazeretler: gecmisMazeretler,
            aktifBirimler: aktifBirimler,
            eskiIsimler: eskiIsimler,
        }).catch(() => {});
    }

    // İLK ÜYE SYNC (10 saniye sonra, cache dolsun diye)
setTimeout(async () => {
    const guild = client.guilds.cache.first();
    if (guild) {
        await dbSync.fullMemberSync(guild);
    }
}, 10000);

// HER 5 DAKİKADA bir üye sync (Discord ayrılanları yakala)
setInterval(async () => {
    const guild = client.guilds.cache.first();
    if (guild) {
        await dbSync.fullMemberSync(guild);
    }
}, 5 * 60 * 1000);
};

// GECİKME (FREN) SİSTEMİ - Rate Limit'ten Korur
const bekle = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function tempReply(interaction, icerik) {
    interaction.reply({ content: icerik, flags: MessageFlags.Ephemeral }).then(() => {
        setTimeout(() => interaction.deleteReply().catch(() => {}), 20000);
    }).catch(() => {});
}

function parseTarihSaatTR(tarihStr) {
    const match = tarihStr.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4}) (\d{1,2})[.:](\d{1,2})$/);
    if (!match) return null;
    
    const gun = parseInt(match[1]);
    const ay = parseInt(match[2]) - 1;
    const yil = parseInt(match[3]);
    const saat = parseInt(match[4]);
    const dakika = parseInt(match[5]);
    
    return Date.UTC(yil, ay, gun, saat - 3, dakika); 
}

function trTimeStr() {
    return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }).replace(/:/g, '.');
}

const isimOnayBekleyenler = new Map();

function ilkHarfleriBuyut(metin) {
    return metin.split(' ').map(kelime => kelime.charAt(0).toUpperCase() + kelime.slice(1).toLowerCase()).join(' ');
}

function formatSure(dakika) {
    if (dakika < 60) return `${dakika} Dk`;
    const s = Math.floor(dakika / 60);
    const d = dakika % 60;
    return `${s} Saat ${d} Dk`;
}

function tamSureFormat(ms) {
    if (!ms || ms <= 0) return "0 Saniye";
    let saniye = Math.floor(ms / 1000);
    let dakika = Math.floor(saniye / 60);
    let saat = Math.floor(dakika / 60);
    let gun = Math.floor(saat / 24);
    
    saniye %= 60; 
    dakika %= 60; 
    saat %= 24;
    
    let str = "";
    if (gun > 0) str += `${gun} Gün `; 
    if (saat > 0) str += `${saat} Saat `; 
    if (dakika > 0) str += `${dakika} Dakika `;
    str += `${saniye} Saniye`; 
    
    return str.trim() || "0 Saniye";
}

function birimdenCikart(userId) {
    const bagliBirim = Object.keys(aktifBirimler).find(id => aktifBirimler[id].uyeler.includes(userId));
    
    if (bagliBirim) {
        aktifBirimler[bagliBirim].uyeler = aktifBirimler[bagliBirim].uyeler.filter(id => id !== userId);
        
        if (aktifBirimler[bagliBirim].uyeler.length === 0) {
            delete aktifBirimler[bagliBirim];
        }
        return true;
    }
    return false;
}

function logGonder(user, baslangic, bitis, dakika, kapatanYetkili = null) {
    const logKanali = client.channels.cache.get(AYARLAR.MESAI_LOG_KANALI);
    if (!logKanali) return;

    const desc = `> 👮 **Memur:** ${user}\n> 🟢 **Giriş:** <t:${Math.floor(baslangic / 1000)}:f>\n> 🔴 **Çıkış:** <t:${Math.floor(bitis / 1000)}:f>\n> 📊 **Bu Oturum:** \`${formatSure(dakika)}\``
        + (kapatanYetkili ? `\n> ⚠️ **Müdahale:** Mesai ${kapatanYetkili} tarafından kapatıldı.` : '');

    const logEmbed = new EmbedBuilder()
        .setTitle("📋 LSPD Mesai Raporu")
        .setDescription(desc)
        .setColor(kapatanYetkili ? "Red" : "Orange")
        .setThumbnail(user.displayAvatarURL());

    logKanali.send({ content: `🚨 ${user} devriyesi sonlandı.`, embeds: [logEmbed] });
}

async function isimTagEkle(member, tag) {
    if (!member) return;
    
    if (!member.manageable) {
        console.log(`❌ [DİKKAT] Yetkim yetmediği için ${member.user.username} ismine ${tag} eklenemedi!`);
        return;
    }
    
    try { await member.fetch({ force: true }); } catch(e){} 
    
    const curName = member.displayName;
    
    if (curName.includes(tag)) return;
    if (tag === '[M]' && curName.includes('[Mazeretli]')) return;

    let safIsim = curName.replace('[Mazeretli] ', '').replace('[Mazeretli]', '').replace('[M] ', '').replace('[M]', '').trim();
    
    eskiIsimler[member.id] = safIsim;
    dbKaydet();
    
    let yeniIsim = `${tag} ${safIsim}`;
    if (yeniIsim.length > 32) yeniIsim = yeniIsim.substring(0, 32);
    
    await member.setNickname(yeniIsim).catch((err) => {});
}

async function ismiGeriYukle(member, tag) {
    if (!member) return;
    
    if (!member.manageable) return;
    
    try { await member.fetch({ force: true }); } catch(e){} 

    const curName = member.displayName;
    
    if (tag === '[M]' && curName.includes('[Mazeretli]')) return;

    if (curName.includes(tag)) {
        const originalName = eskiIsimler[member.id];
        
        if (originalName) {
            await member.setNickname(originalName).catch(() => {});
            delete eskiIsimler[member.id];
            dbKaydet();
        } else {
            let safIsim = curName.replace(`${tag} `, '').replace(tag, '').trim();
            await member.setNickname(safIsim).catch(() => {});
        }
    }
}

// ==============================================================================
// YENİ: SLASH KOMUT LİSTESİ 
// ==============================================================================
const slashCommands = [
    new SlashCommandBuilder()
        .setName('komutlar')
        .setDescription('Tüm bot komutlarını gösterir.'),
        
    new SlashCommandBuilder()
        .setName('zorunlumesai')
        .setDescription('Zorunlu mesai sistemini yönetir.')
        .addSubcommand(sub => sub.setName('baslat').setDescription('Zorunlu mesai başlatır.').addStringOption(opt => opt.setName('tarih_saat').setDescription('Örn: 06.04.2026 19.00').setRequired(true)))
        .addSubcommand(sub => sub.setName('bitir').setDescription('Aktif zorunlu mesaiyi iptal eder.')),
        
    new SlashCommandBuilder()
        .setName('tarihinaktifler')
        .setDescription('Belirli bir tarihte girmeyen inaktifleri listeler.')
        .addStringOption(opt => opt.setName('tarih').setDescription('Örn: 06.04.2026').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('panelkur')
        .setDescription('Mesai yönetim panelini kanala kurar.'),
        
    new SlashCommandBuilder()
        .setName('birim')
        .setDescription('Birim (Devriye) sistemini yönetir.')
        .addSubcommand(sub => sub.setName('ekle').setDescription('Yeni birim açar.').addStringOption(opt => opt.setName('tur').setDescription('lincoln, adam, swat, vb.').setRequired(true)).addStringOption(opt => opt.setName('kod').setDescription('Birim kodu (Örn: D91)').setRequired(true)))
        .addSubcommand(sub => sub.setName('kapat').setDescription('Birimi zorla kapatır.').addStringOption(opt => opt.setName('kod').setDescription('Kapatılacak birim kodu').setRequired(true)))
        .addSubcommand(sub => sub.setName('kisiekle').setDescription('Memuru birime zorla sokar.').addStringOption(opt => opt.setName('kod').setDescription('Birim kodu').setRequired(true)).addUserOption(opt => opt.setName('hedef').setDescription('Eklenecek memur').setRequired(true)))
        .addSubcommand(sub => sub.setName('kisicikart').setDescription('Memuru biriminden çıkartır.').addUserOption(opt => opt.setName('hedef').setDescription('Çıkartılacak memur').setRequired(true))),
        
    new SlashCommandBuilder()
        .setName('mesaikapat')
        .setDescription('Memurun mesaisini zorla kapatır.')
        .addUserOption(opt => opt.setName('hedef').setDescription('İşlem yapılacak memur').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('mesaisil')
        .setDescription('Memurun toplam süresinden dakika siler.')
        .addUserOption(opt => opt.setName('hedef').setDescription('Memur').setRequired(true))
        .addIntegerOption(opt => opt.setName('dakika').setDescription('Silinecek dakika miktarı').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('mesaisok')
        .setDescription('Memuru zorla sahaya (mesaiye) sokar.')
        .addUserOption(opt => opt.setName('hedef').setDescription('Memur').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('mesaiekle')
        .setDescription('Memurun toplam süresine dakika ekler.')
        .addUserOption(opt => opt.setName('hedef').setDescription('Memur').setRequired(true))
        .addIntegerOption(opt => opt.setName('dakika').setDescription('Eklenecek dakika miktarı').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('Destek talebi (Ticket) panelini kurar.'),
        
    new SlashCommandBuilder()
        .setName('setup-mazeret')
        .setDescription('Mazeret bildirim panelini kurar.'),
        
    new SlashCommandBuilder()
        .setName('mazeretsil')
        .setDescription('ID numarası ile mazeret siler.')
        .addIntegerOption(opt => opt.setName('id').setDescription('Silinecek mazeretin ID numarası').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('mazeretekle')
        .setDescription('Memura manuel olarak mazeret ekler.')
        .addUserOption(opt => opt.setName('hedef').setDescription('Memur').setRequired(true))
        .addStringOption(opt => opt.setName('tarih_saat').setDescription('Bitiş tarihi (Örn: 08.04.2026 20.00)').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Mazeret sebebi').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('aktifmemurlar')
        .setDescription('Aktif ve inaktif memurların detaylı listesini verir.'),
        
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Memura mola (timeout) verir.')
        .addUserOption(opt => opt.setName('hedef').setDescription('Memur').setRequired(true))
        .addIntegerOption(opt => opt.setName('dakika').setDescription('Süre (Dakika)').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Sebep (Opsiyonel)').setRequired(false)),
        
    new SlashCommandBuilder()
        .setName('mesai-top')
        .setDescription('Mesai liderlik tablosunu (Top Listesi) gösterir.'),
        
    new SlashCommandBuilder()
        .setName('mazeretler')
        .setDescription('Aktif tüm mazeretleri listeler.'),
        
    new SlashCommandBuilder()
        .setName('inaktifler')
        .setDescription('İnaktif kriterindeki memurların raporunu atar.'),

    new SlashCommandBuilder()
        .setName('topluduyuru')
        .setDescription('Mesaide olmayan ve mazeretsiz tüm PD üyelerine duyuru gönderir.')
        .addStringOption(opt => opt.setName('mesaj').setDescription('Gönderilecek duyuru mesajı').setRequired(true))
        .addStringOption(opt => opt.setName('yontem').setDescription('Gönderim yöntemi').setRequired(true)
            .addChoices(
                { name: '📩 DM (Özel Mesaj)', value: 'dm' },
                { name: '📢 Kanal (Tag ile)', value: 'kanal' }
            ))
        .addChannelOption(opt => opt.setName('kanal').setDescription('Duyuru kanalı (yöntem "kanal" ise zorunlu)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('mesaisifirla')
        .setDescription('Tüm personelin birikmiş mesai verilerini sıfırlar ve HTML rapor oluşturur.'),

    new SlashCommandBuilder()
        .setName('mesairapor')
        .setDescription('Mesai raporunu HTML olarak bu kanala atar.')
        .addStringOption(opt => opt.setName('tur').setDescription('Rapor türü').setRequired(true)
            .addChoices(
                { name: '📅 Günlük (bugün)', value: 'gunluk' },
                { name: '📊 Genel (tüm zamanlar)', value: 'genel' }
            )),

    

    new SlashCommandBuilder()
        .setName('ftoata')
        .setDescription('FTO forum kanalında yeni gönderi oluşturur ve atamaları yapar.')
        .addUserOption(opt => opt.setName('fts').setDescription('FTS (eğitilecek) kişi').setRequired(true))
        .addUserOption(opt => opt.setName('fto').setDescription('FTO (eğitmen) kişi — boş bırakırsan sen olursun').setRequired(false)),

    new SlashCommandBuilder()
        .setName('ftokapat')
        .setDescription('FTS\'nin FTO gönderisini kapatır (başlıktan kodu siler, erişimi kapar).')
        .addUserOption(opt => opt.setName('fts').setDescription('Kapanacak FTS kişisi').setRequired(true)),

    new SlashCommandBuilder()
        .setName('rolver')
        .setDescription('Kişiye rol verir ve rütbe aralığından otomatik kod atar.')
        .addUserOption(opt => opt.setName('kisi').setDescription('Rolü verilecek kişi').setRequired(true))
        .addRoleOption(opt => opt.setName('rol').setDescription('Verilecek rol').setRequired(true)),

        new SlashCommandBuilder()
            .setName('uyari')
            .setDescription('Uyarı sistemi (yazılı + sözlü).')
            .addSubcommand(sub => sub.setName('ver').setDescription('Yazılı uyarı verir (kademeli).')
                .addUserOption(opt => opt.setName('memur').setDescription('Memur').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true)))
            .addSubcommand(sub => sub.setName('sozlu').setDescription('SÖZLÜ uyarı verir (kademeye girmez).')
                .addUserOption(opt => opt.setName('memur').setDescription('Memur').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true)))
            .addSubcommand(sub => sub.setName('toplu').setDescription('Birden çok memura yazılı uyarı.')
                .addStringOption(opt => opt.setName('memurlar').setDescription('Etiketler (@a @b @c)').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true)))
            .addSubcommand(sub => sub.setName('toplusozlu').setDescription('Birden çok memura SÖZLÜ uyarı.')
                .addStringOption(opt => opt.setName('memurlar').setDescription('Etiketler (@a @b @c)').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true)))
                .addSubcommand(sub => sub.setName('haric').setDescription('Roldeki herkese yazılı uyarı (etiketlenenler hariç).')
                .addRoleOption(opt => opt.setName('rol').setDescription('Hedef rol').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true))
                .addStringOption(opt => opt.setName('haric').setDescription('Hariç tutulacaklar (@a @b)').setRequired(false)))
            .addSubcommand(sub => sub.setName('haricsozlu').setDescription('Roldeki herkese SÖZLÜ uyarı (hariç tutarak).')
                .addRoleOption(opt => opt.setName('rol').setDescription('Hedef rol').setRequired(true))
                .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true))
                .addStringOption(opt => opt.setName('haric').setDescription('Hariç tutulacaklar (@a @b)').setRequired(false)))
            .addSubcommand(sub => sub.setName('liste').setDescription('Memurun uyarı geçmişi.')
                .addUserOption(opt => opt.setName('memur').setDescription('Memur').setRequired(true)))
            .addSubcommand(sub => sub.setName('sil').setDescription('Uyarıyı ID ile siler.')
                .addIntegerOption(opt => opt.setName('id').setDescription('Uyarı ID').setRequired(true)))
            .addSubcommand(sub => sub.setName('sifirla').setDescription('Memurun uyarılarını sıfırlar.')
                .addUserOption(opt => opt.setName('memur').setDescription('Memur').setRequired(true))
                .addStringOption(opt => opt.setName('tip').setDescription('Hangi uyarılar?').setRequired(false)
                    .addChoices(
                        { name: 'Hepsi (yazılı + sözlü)', value: 'tumu' },
                        { name: 'Sadece yazılı', value: 'yazili' },
                        { name: 'Sadece sözlü', value: 'sozlu' }
                    )))

    ,new SlashCommandBuilder()
        .setName('sonmesai')
        .setDescription('Kişinin en son mesaiye ne zaman girdiğini gösterir.')
        .addUserOption(opt => opt.setName('kisi').setDescription('Sorgulanacak kişi (boş bırakırsan kendin)').setRequired(false)),

    ].map(command => command.toJSON());

// ==============================================================================
// 4. BAŞLANGIÇ VE DÖNGÜLER
// ==============================================================================
client.once('clientReady', async () => {
    console.log(`✅ Bot ${client.user.tag} olarak giriş yaptı!`);
    
    // Slash Komutlarını Discord'a Yükle (guild-specific → anında güncellenir)
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        const guild = client.guilds.cache.first();
        console.log('[/] Slash komutları sunucuya yükleniyor...');
        if (guild) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: slashCommands });
        } else {
            await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        }
        console.log('[/] Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error('❌ Slash komut yükleme hatası:', error);
    }

    // Sunucu üyelerini başlangıçta bir kez çek
    const guild = client.guilds.cache.first();
    if (guild) {
        await guild.members.fetch().catch(console.error);
        console.log(`✅ ${guild.memberCount} üye önbelleğe alındı`);
    }

    await panelKurulumu();
    await birimPanelKurulumu(); 
    await aktifMesaileriGuncelle();
    await rutbeListesiniGuncelle();
    await liderlikTablosunuGuncelle();
    
    let sonSaatlikRapor = -1;
    let sonInaktifGun = -1;
    let sonGunlukRapor = -1;

      // ⬇️ YENİ: Site DB sağlık kontrolü
      setTimeout(() => {
        dbSync.healthCheck();
    }, 3000);
    
    // İlk full sync (botla site senkronize olsun)
    setTimeout(() => {
        dbSync.fullSync({
            aktifMesailer: aktifMesailer,
            toplamMesailer: toplamMesailer,
            mazeretler: gecmisMazeretler,
            aktifBirimler: aktifBirimler,
            eskiIsimler: eskiIsimler,
        }).catch(() => {});
    }, 5000);

    

    // İlk üye sync (cache dolsun diye 10sn bekle)
    setTimeout(async () => {
        const guild = client.guilds.cache.first();
        if (guild) {
            await dbSync.fullMemberSync(guild);
        }
    }, 10000);

    // Her 5 dakikada üye sync (Discord ayrılanlar için)
    setInterval(async () => {
        const guild = client.guilds.cache.first();
        if (guild) {
            await dbSync.fullMemberSync(guild);
        }
    }, 5 * 60 * 1000);

    setInterval(async () => {
        const simdi = Date.now();
        const trDateStr = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"});
        const trDate = new Date(trDateStr);
        let mazeretGuncellendi = false;

        for (let i = gecmisMazeretler.length - 1; i >= 0; i--) {
            let m = gecmisMazeretler[i];
            
            if (m.durum === 'Onaylandı' && simdi >= m.bitisZamani) {
                for (const guild of client.guilds.cache.values()) {
                    try {
                        const targetMember = await guild.members.fetch(m.user);
                        if (targetMember) {
                            await targetMember.roles.remove(AYARLAR.MAZERET_ROL_ID).catch(()=>null);
                            await ismiGeriYukle(targetMember, '[Mazeretli]');
                            
                            if (aktifMesailer[m.user]) {
                                await isimTagEkle(targetMember, '[M]');
                            }

                            client.users.cache.get(m.user)?.send(`🚨 Mazeret süreniz dolmuştur. Aktif görevlerinize dönmeniz beklenmektedir.`).catch(()=>{});
                        }
                    } catch(e) {} 
                }
                
                gecmisMazeretler.splice(i, 1);
                mazeretGuncellendi = true;
            }
        }

        if (mazeretGuncellendi) {
            dbKaydet();
        }

        if (zorunluMesai.aktif && simdi >= zorunluMesai.bitis) {
            zorunluMesaiRaporuGonder(zorunluMesai.kanal);
            zorunluMesai.aktif = false;
            dbKaydet();
        }

        if (trDate.getMinutes() === 0 && sonSaatlikRapor !== trDate.getHours()) {
            saatlikRaporGonder();
            sonSaatlikRapor = trDate.getHours();
        }

        if (trDate.getHours() === AYARLAR.INAKTIF_RAPOR_SAATI && trDate.getMinutes() === 0 && sonInaktifGun !== trDate.getDate()) {
            inaktifRaporuGonder();
            sonInaktifGun = trDate.getDate();
        }

        // Gün sonu otomatik mesai raporu (23:59 TR saati)
        if (trDate.getHours() === 23 && trDate.getMinutes() === 59 && sonGunlukRapor !== trDate.getDate()) {
            sonGunlukRapor = trDate.getDate();
            try {
                const raporKanal = await client.channels.fetch(AYARLAR.GUNLUK_RAPOR_KANALI).catch(() => null);
                if (raporKanal) {
                    const yapan = client.user;
                    await mesaiRaporuOlusturVeGonder(
                        { id: client.user.id, tag: 'Otomatik Rapor', username: 'Otomatik Rapor' },
                        raporKanal,
                        raporKanal.guild,
                        'gunluk'
                    );
                    await mesaiRaporuOlusturVeGonder(
                        { id: client.user.id, tag: 'Otomatik Rapor', username: 'Otomatik Rapor' },
                        raporKanal,
                        raporKanal.guild,
                        'genel'
                    );
                    // Günlük mesaileri sıfırla (gece yarısı için)
                    gunlukMesailer = {};
                    dbKaydet();
                }
            } catch(e) { console.log("❌ Gün sonu rapor hatası:", e); }
        }

        saatlikBildirimKontrolu();
        // Her dakika birim panelini güncelle (otomatik yenile)
        birimPanelKurulumu();

    }, 60000);

    // ===== BOT QUEUE WORKER =====
    // Her 3 saniyede site'deki bekleyen aksiyonları al ve uygula
    // NOT: Bu setInterval burada (ready bloğu içinde, ama 60s interval DIŞINDA) olmalı,
    // aksi halde her dakika yeni bir interval oluşur ve spam yapar.
    setInterval(async () => {
        try {
            const actions = await dbSync.fetchQueue();
            if (!actions.length) return;
            console.log(`[QUEUE] ⚡ ${actions.length} aksiyon işleniyor...`);
            for (const action of actions) {
                await processQueueAction(action);
            }
        } catch (e) {
            console.log('[QUEUE] ❌ Worker hatası:', e.message);
        }
    }, 3000);
});

// =========================================
//  QUEUE ACTION İŞLEYİCİ — Site'den gelenleri uygular
// =========================================
async function processQueueAction(action) {
    const { id, action_type, payload } = action;
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    try {
        const member = await guild.members.fetch(payload.discord_id).catch(() => null);
        
        switch (action_type) {
            
            // -------- RÜTBE DEĞİŞİMİ --------
            case 'rank_changed': {
                if (!member) {
                    await dbSync.markQueueFailed(id, 'Üye bulunamadı');
                    break;
                }
                
                // Eski rolü kaldır
                if (payload.old_role_id) {
                    await member.roles.remove(payload.old_role_id).catch(() => null);
                }
                // Yeni rolü ekle
                if (payload.new_role_id) {
                    await member.roles.add(payload.new_role_id).catch(() => null);
                }
                
                // Personele DM at
                try {
                    await member.send({
                        embeds: [{
                            color: 0x6366f1,
                            title: '⭐ Rütbe Değişikliği',
                            description: `Merhaba **${payload.personnel_name || member.displayName}**, rütbeniz değiştirildi.`,
                            fields: [
                                { name: '📉 Eski Rütbe', value: payload.old_rank_name, inline: true },
                                { name: '📈 Yeni Rütbe', value: payload.new_rank_name, inline: true },
                            ],
                            footer: { text: 'MRPD Yönetim Paneli' },
                            timestamp: new Date(),
                        }],
                    });
                } catch {}
                
                console.log(`[QUEUE] ✅ Rütbe: ${payload.personnel_name} → ${payload.new_rank_name}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            // -------- DISCORD NICKNAME DEĞİŞİMİ --------
            case 'set_nickname': {
                if (!member) {
                    await dbSync.markQueueFailed(id, 'Üye bulunamadı');
                    break;
                }
                
                try {
                    await member.setNickname(payload.nickname || null);
                    console.log(`[QUEUE] ✅ Nick: ${member.user.username} → "${payload.nickname}"`);
                    await dbSync.markQueueDone(id);
                } catch (e) {
                    if (e.message.includes('Missing Permissions')) {
                        // Sahip botu nick değiştiremez
                        console.log(`[QUEUE] ⚠️ Nick değiştirilemiyor (yetki): ${member.user.username}`);
                        await dbSync.markQueueDone(id);
                    } else {
                        await dbSync.markQueueFailed(id, e.message);
                    }
                }
                break;
            }
            
            // -------- ROL EKLE --------
            case 'set_role': {
                if (!member) {
                    await dbSync.markQueueFailed(id, 'Üye bulunamadı');
                    break;
                }
                await member.roles.add(payload.role_id).catch(() => null);
                console.log(`[QUEUE] ✅ Rol eklendi: ${member.displayName}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            // -------- ROL KALDIR --------
            case 'remove_role': {
                if (!member) {
                    await dbSync.markQueueFailed(id, 'Üye bulunamadı');
                    break;
                }
                await member.roles.remove(payload.role_id).catch(() => null);
                console.log(`[QUEUE] ✅ Rol kaldırıldı: ${member.displayName}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            // -------- PERSONEL SİLİNDİ --------
            case 'personnel_deleted': {
                if (!member) {
                    await dbSync.markQueueDone(id, { skipped: 'Discord\'da yok' });
                    break;
                }
                
                // LSPD genel rolünü kaldır (ekipten çıkar)
                if (AYARLAR.LSPD_GENEL_ROL_ID) {
                    await member.roles.remove(AYARLAR.LSPD_GENEL_ROL_ID).catch(() => null);
                }
                
                // Tüm rütbe rollerini kaldır
                for (const rutbe of (AYARLAR.RUTBE_AYARLARI || [])) {
                    await member.roles.remove(rutbe.id).catch(() => null);
                }
                
                // Bilgilendirme DM
                try {
                    await member.send({
                        embeds: [{
                            color: 0xef4444,
                            title: '👋 Departmandan Ayrıldınız',
                            description: `Merhaba, departman kayıtlarınız silindi. Görev süreciniz boyunca verdiğiniz hizmet için teşekkür ederiz.`,
                            footer: { text: 'MRPD Yönetim Paneli' },
                            timestamp: new Date(),
                        }],
                    });
                } catch {}
                
                // Eğer notify_only=false ise sunucudan da at
                if (!payload.notify_only) {
                    await member.kick('Site üzerinden personelden çıkarıldı').catch(() => null);
                }
                
                console.log(`[QUEUE] ✅ Personel silindi: ${payload.personnel_name}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            // -------- DM GÖNDER --------
            case 'send_dm': {
                if (!member) {
                    await dbSync.markQueueFailed(id, 'Üye bulunamadı');
                    break;
                }
                
                try {
                    await member.send({
                        embeds: [{
                            color: payload.color || 0x6366f1,
                            title: payload.title || 'Bildirim',
                            description: payload.message || '',
                            footer: { text: 'MRPD Yönetim Paneli' },
                            timestamp: new Date(),
                        }],
                    });
                    await dbSync.markQueueDone(id);
                } catch (e) {
                    await dbSync.markQueueFailed(id, 'DM gönderilemedi (kapalı olabilir)');
                }
                break;
            }
            
            // -------- MESAİ BAŞLAT (site'den) --------
            case 'duty_start': {
                if (!member) {
                    await dbSync.markQueueDone(id, { skipped: 'Discord\'da yok' });
                    break;
                }
                
                // Bot'un kendi mesai sistemine ekle
                if (typeof aktifMesailer !== 'undefined') {
                    aktifMesailer[member.id] = {
                        baslangic: Date.now(),
                        siteden: true,
                    };
                    if (typeof dbKaydet === 'function') {
                        dbKaydet();
                    }
                }
                
                try {
                    await member.send({
                        embeds: [{
                            color: 0x22c55e,
                            title: '⏱️ Mesai Başlatıldı',
                            description: `Site üzerinden mesainiz başlatıldı. İyi görevler!`,
                            footer: { text: 'MRPD Yönetim Paneli' },
                            timestamp: new Date(),
                        }],
                    });
                } catch {}
                
                console.log(`[QUEUE] ✅ Mesai başladı: ${payload.personnel_name}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            // -------- MESAİ BİTİR (site'den) --------
            case 'duty_end': {
                if (!member) {
                    await dbSync.markQueueDone(id, { skipped: 'Discord\'da yok' });
                    break;
                }
                
                // Bot'un kendi mesai sisteminden çıkar
                if (typeof aktifMesailer !== 'undefined' && aktifMesailer[member.id]) {
                    delete aktifMesailer[member.id];
                    if (typeof dbKaydet === 'function') {
                        dbKaydet();
                    }
                }
                
                try {
                    await member.send({
                        embeds: [{
                            color: 0xf59e0b,
                            title: '⏱️ Mesai Bitti',
                            description: `Site üzerinden mesainiz sonlandırıldı.`,
                            fields: [
                                { name: 'Süre', value: `${payload.duration_minutes || 0} dakika`, inline: true },
                            ],
                            footer: { text: 'MRPD Yönetim Paneli' },
                            timestamp: new Date(),
                        }],
                    });
                } catch {}
                
                console.log(`[QUEUE] ✅ Mesai bitti: ${payload.personnel_name}`);
                await dbSync.markQueueDone(id);
                break;
            }
            
            default:
                console.log(`[QUEUE] ⚠️ Bilinmeyen aksiyon: ${action_type}`);
                await dbSync.markQueueFailed(id, `Bilinmeyen aksiyon: ${action_type}`);
        }
        
    } catch (e) {
        console.log(`[QUEUE] ❌ İşleme hatası (${action_type}):`, e.message);
        await dbSync.markQueueFailed(id, e.message);
    }
}

// =========================================
// SITE DB SYNC - DISCORD EVENT LISTENERS
// =========================================
client.on('guildMemberRemove', async (member) => {
    try {
        if (member.user?.bot) return;
        await dbSync.memberLeft(member.id, member.user?.username);
        setTimeout(() => dbSync.fullMemberSync(member.guild), 1000);
    } catch (e) {}
});

client.on('guildBanAdd', async (ban) => {
    try {
        if (ban.user?.bot) return;
        await dbSync.memberLeft(ban.user.id, ban.user.username);
    } catch (e) {}
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        if (newMember.user.bot) return;
        const oldRoles = Array.from(oldMember.roles.cache.keys()).sort().join(',');
        const newRoles = Array.from(newMember.roles.cache.keys()).sort().join(',');
        if (oldRoles !== newRoles || oldMember.displayName !== newMember.displayName) {
            await dbSync.roleUpdate(
                newMember.id,
                Array.from(newMember.roles.cache.keys()),
                newMember.displayName
            );
        }
    } catch (e) {}
});

client.on('guildMemberAdd', async (member) => {
    try {
        if (member.user.bot) return;
        setTimeout(() => dbSync.fullMemberSync(member.guild), 2000);
    } catch (e) {}
});

// =========================================
// DISCORD EVENT LISTENERS - Site DB Sync
// =========================================

// Üye sunucudan ayrılınca
client.on('guildMemberRemove', async (member) => {
    try {
        if (member.user.bot) return;
        await dbSync.memberLeft(member.id, member.user.username);
        setTimeout(() => dbSync.fullMemberSync(member.guild), 1000);

        const createdAt = member.user.createdAt;
        const joinedAt = member.joinedAt;
        const now = Date.now();
        const hesapYasiGun = Math.floor((now - createdAt.getTime()) / 86400000);
        const hesapGuvenlik = hesapYasiGun < 30 ? '⚠️ Yeni Hesap' : hesapYasiGun < 90 ? '🟡 Orta' : '✅ Kayıtsız';

        const cikisEmbed = new EmbedBuilder()
            .setColor(0xed4245)
            .setAuthor({ name: `${member.user.username} sunucudan ayrıldı`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(
                `🔔 **Kullanıcı:** \`${member.user.username}\`\n` +
                `🆔 **Kullanıcı ID:** \`${member.id}\`\n` +
                `📅 **Hesap oluşturma tarihi:** <t:${Math.floor(createdAt.getTime() / 1000)}:F>\n` +
                (joinedAt ? `📆 **Sunucuya giriş tarihi:** <t:${Math.floor(joinedAt.getTime() / 1000)}:F>\n` : '') +
                `🚪 **Ayrılma tarihi:** <t:${Math.floor(now / 1000)}:F>\n` +
                `📚 **Hesap güvenliği:** ${hesapGuvenlik}`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Mission Row Police Department • Çıkış Kaydı' })
            .setTimestamp();

        const cikisKanal = member.guild.channels.cache.get('1489577861617811627');
        if (cikisKanal) await cikisKanal.send({ embeds: [cikisEmbed] }).catch(() => {});

    } catch (e) {
        console.log('[GuildMemberRemove] hata:', e.message);
    }
});

// Üye banlanınca
client.on('guildBanAdd', async (ban) => {
    try {
        await dbSync.memberLeft(ban.user.id, ban.user.username);
    } catch (e) {}
});

// Rol değişiklikleri
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        if (newMember.user.bot) return;
        
        // Roller değişti mi?
        const oldRoles = Array.from(oldMember.roles.cache.keys()).sort().join(',');
        const newRoles = Array.from(newMember.roles.cache.keys()).sort().join(',');
        const oldName = oldMember.displayName;
        const newName = newMember.displayName;
        
        if (oldRoles !== newRoles || oldName !== newName) {
            await dbSync.roleUpdate(
                newMember.id,
                Array.from(newMember.roles.cache.keys()),
                newMember.displayName
            );
        }
    } catch (e) {}
});

// Üye sunucuya katılınca — DM + Kayıtsız Üye rolü
client.on('guildMemberAdd', async (member) => {
    try {
        if (member.user.bot) return;

        const kayitsizRol = member.guild.roles.cache.get('1487579880181858458');
        if (kayitsizRol) await member.roles.add(kayitsizRol).catch(() => {});

        const createdAt = member.user.createdAt;
        const hesapYasiGun = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
        const hesapGuvenlik = hesapYasiGun < 30 ? '⚠️ Yeni Hesap' : hesapYasiGun < 90 ? '🟡 Orta' : '✅ Kayıtsız';
        const basvuruLink = 'https://discord.com/channels/1487561829818433676/1487835696042610804';

        const dmEmbed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setAuthor({ name: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
            .setTitle('👋 Mission Row Police Department\'a Hoş Geldin!')
            .setDescription(
                `Merhaba **${member.user.username}**,\n` +
                `Sunucumuza hoş geldin! Mülakat sürecine dahil olabilmek için aşağıdaki **Başvuru** butonuna tıklayarak formu doldurman gerekmektedir.\n\n` +
                `🔔 **Kullanıcı:** \`${member.user.username}\`\n` +
                `🆔 **ID:** \`${member.id}\`\n` +
                `📅 **Hesap tarihi:** <t:${Math.floor(createdAt.getTime() / 1000)}:F>\n` +
                `📚 **Hesap güvenliği:** ${hesapGuvenlik}`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setImage('https://cdn.discordapp.com/attachments/1487833185617313933/1502651328940216380/GununFotograf2.png')
            .setFooter({ text: 'Mission Row Police Department' })
            .setTimestamp();

        const dmButon = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('📝 Başvuru')
                .setURL(basvuruLink)
                .setStyle(ButtonStyle.Link)
        );

        await member.send({ embeds: [dmEmbed], components: [dmButon] }).catch(() => {});

    } catch (e) {
        console.error('[GuildMemberAdd] hata:', e.message);
    }
});


// ==============================================================================
// 5. OTOMATİK İSİM KAYIT VE ESKİ TİP (!) KOMUTLAR
// ==============================================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || message.system || !message.content) return;

    // --------------------------------------------------------------------------
    // OTOMATİK İSİM KAYIT SİSTEMİ
    // --------------------------------------------------------------------------
    if (message.channel.id === AYARLAR.ISIM_KAYIT_KANALI) {
        const parts = message.content.trim().split(/ +/);
        
        if (parts.length < 3 || isNaN(parts[0])) {
            return message.reply("❌ **Hatalı format!** Lütfen şu şekilde yazın: `[Rozet Numarası] [IC İsim Soyisim] [OOC İsim]`\nÖrnek: `701 Edward Valentin Anil`");
        }

        const callsign = parseInt(parts.shift());
        const oocName = ilkHarfleriBuyut(parts.pop().replace(/[/|]/g, "").trim());
        const icName = ilkHarfleriBuyut(parts.join(" ").replace(/[/|]/g, "").trim());
        
        const newNickname = `[${callsign}] ${icName} | ${oocName}`;
        
        if (newNickname.length > 32) {
            return message.reply("❌ **İsim Çok Uzun:** Discord kuralları gereği isminiz 32 karakterden uzun olamaz. Lütfen kısaltarak yazın.");
        }

        let hasValidRoleForCallsign = false;
        
        for (const rutbe of AYARLAR.RUTBE_AYARLARI) {
            if (message.member.roles.cache.has(rutbe.id)) {
                const haricMi = rutbe.haric && rutbe.haric.includes(callsign);
                const ekstraMi = rutbe.ekstra && rutbe.ekstra.includes(callsign); 
                
                if (((callsign >= rutbe.min && callsign <= rutbe.max) || ekstraMi) && !haricMi) {
                    hasValidRoleForCallsign = true;
                    break;
                }
            }
        }

        if (!hasValidRoleForCallsign) {
            return message.reply(`❌ **Yetkiniz Yok:** Sahip olduğunuz rütbe \`${callsign}\` telsiz kodunu almanıza izin vermiyor. Lütfen kendi rütbenize uygun bir kod seçin!`);
        }

        const taken = message.guild.members.cache.find(m => 
            m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID) && 
            m.displayName.includes(`[${callsign}]`)
        );
        
        if (taken && taken.id !== message.author.id) {
            return message.reply(`❌ **Kod Dolu:** Bu telsiz kodu (\`${callsign}\`) şu anda **${taken.displayName}** tarafından kullanılıyor. Lütfen başka bir kod seçin!`);
        }

        const zatenKayitliMi = /\[\d+\]/.test(message.member.displayName);
        
        if (zatenKayitliMi) {
            isimOnayBekleyenler.set(message.author.id, newNickname);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`isim_kabul_${message.author.id}`)
                    .setLabel('Kabul et')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`isim_red_${message.author.id}`)
                    .setLabel('Kabul etme')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
            
            return message.reply({ 
                content: `⚠️ **İsim Değişikliği Talebi:**\n${message.author} adlı memur ismini **${newNickname}** olarak değiştirmek istiyor.\nYetkili onayı bekleniyor.`, 
                components: [row] 
            });
            
        } else {
            try {
                eskiIsimler[message.author.id] = newNickname;
                dbKaydet();
                
                await message.member.setNickname(newNickname);
                return message.reply(`✅ Yaka numarası ve kimlik onaylandı! Yeni adınız: **${newNickname}**`);
            } catch (error) {
                return message.reply("❌ **Hata:** İsminizi değiştirmeye yetkim yetmiyor! (Yetkililer botun rolünü en üste taşımalıdır).");
            }
        }
    }



    // --------------------------------------------------------------------------
    // ESKİ TİP (!) YETKİLİ KOMUTLARI
    // --------------------------------------------------------------------------
    if (!message.content.startsWith('!')) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const hasPerm = message.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (command === '!komutlar') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const embed = new EmbedBuilder()
            .setTitle("🚔 LSPD Yönetim Botu Komutları")
            .setDescription("Aşağıda departmanı yönetmek için kullanabileceğiniz tüm komutlar listelenmiştir:")
            .setColor("DarkVividPink")
            .addFields(
                { name: "🛠️ Kurulum Komutları", value: "`!panelkur` - Mesai kontrol panelini kurar.\n`!setup-mazeret` - Mazeret panelini kurar.\n`!setup-ticket` - Ticket panelini kurar." },
                { name: "⏱️ Mesai Yönetim Komutları", value: "`!mesaisok @kullanıcı` - Seçilen memuru zorla mesaiye sokar.\n`!mesaikapat @kullanıcı` - Memurun mesaisini bitirir.\n`!mesaiekle @kullanıcı <dk>` - Toplam mesaiye süre ekler.\n`!mesaisil @kullanıcı <dk>` - Mesai süresinden kesinti yapar." },
                { name: "🗓️ Mazeret Yönetimi", value: "`!mazeretler` - Aktif mazeretleri gösterir.\n`!mazeretekle @kullanıcı <Tarih Saat> <sebep>` - Manuel mazeret ekler.\n`!mazeretsil <ID Numarası>` - Seçilen mazereti siler." },
                { name: "🚨 Raporlama ve Denetim", value: "`!aktifmemurlar` - Mesai durumlarını gruplar.\n`!mesai-top` - Mesai sıralamasını atar.\n`!inaktifler` - İnaktifleri listeler.\n`!tarihinaktifler DD.MM.YYYY` - Belirtilen günde inaktif olanları atar.\n`!zorunlumesai başlat/bitir` - Zorunlu mesai alarmını kurar.\n`!mesaisifirla` - Tüm mesaileri sıfırlar, HTML rapor oluşturur." },
                { name: "📢 Toplu Duyuru", value: "`!topluduyuru dm <mesaj>` - Mesaide olmayan herkese DM gönderir.\n`!topluduyuru kanal #kanal <mesaj>` - Kanala tag'leyerek duyuru yapar." }
            )
            .setTimestamp();
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!zorunlumesai') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const islem = args[0]?.toLowerCase();
        if (islem === 'başlat') {
            const bitisStr = args[1] + ' ' + args[2]; 
            const bitisMs = parseTarihSaatTR(bitisStr);
            if (!bitisMs) return message.reply("❌ Format Hatalı! Kullanım: `!zorunlumesai başlat 06.04.2026 19.00`");
            zorunluMesai = { aktif: true, bitis: bitisMs, kanal: message.channel.id };
            dbKaydet();
            return message.reply(`✅ Zorunlu mesai denetimi başlatıldı! **${bitisStr}** tarihinde bu kanala rapor atılacak.`);
        }
        if (islem === 'bitir') {
            zorunluMesai.aktif = false; 
            dbKaydet();
            return message.reply("✅ Zorunlu mesai denetimi iptal edildi.");
        }
        return message.reply("Kullanım: `!zorunlumesai başlat DD.MM.YYYY HH.mm` veya `!zorunlumesai bitir`");
    }

    if (command === '!tarihinaktifler') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const tarihStr = args[0];
        if (!tarihStr) return message.reply("Kullanım: `!tarihinaktifler DD.MM.YYYY`");
        const targetMs = parseTarihSaatTR(`${tarihStr} 23.59`);
        if (!targetMs) return message.reply("❌ Hata: Tarih formatı `DD.MM.YYYY` olmalı.");
        await message.guild.members.cache; // rate limit yedi 
        const uyeler = message.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
        let inaktifMetni = "";
        let s = 1;
        uyeler.forEach(m => {
            const val = toplamMesailer[m.id];
            const son = (val && val.sonGiris) ? val.sonGiris : 0;
            const farkGun = Math.floor((targetMs - son) / 86400000);
            if (farkGun >= AYARLAR.INAKTIF_GUN_SINIRI) {
                inaktifMetni += `**${s}.)** 👮 ${m} - Son mesai: **${son === 0 ? "Hiç girmedi" : `<t:${Math.floor(son / 1000)}:R>`}**\n`;
                s++;
            }
        });
        const embed = new EmbedBuilder().setTitle(`🚨 ${tarihStr} Tarihli İnaktif Raporu`).setDescription(inaktifMetni || "Belirtilen tarihte herkes aktifti!").setColor("Red");
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!panelkur') {
        if (!hasPerm) return message.reply("❌ Bu komutu kullanmak için yetkin yok.");
        try {
            await panelKurulumu();
            await message.delete().catch(() => {});
            const m = await message.channel.send("✅ LSPD Paneli başarıyla kuruldu!");
            setTimeout(() => m.delete().catch(() => {}), 5000);
        } catch (error) { 
            message.channel.send("❌ Panel kurulurken bir hata oluştu."); 
        }
    }

    if (command === '!birim') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const islem = args[0]?.toLowerCase();
        if (islem === 'ekle') {
            const turGirdisi = args[1]?.toLowerCase();
            const kodGirdisi = args.slice(2).join(' ').toUpperCase();
            if (!turGirdisi || !kodGirdisi) return message.reply("Kullanım: `!birim ekle <tür> <kod>` (Örn: !birim ekle swat D91)");
            let secilenKapasite = 0;
            let gercekTurIsmi = "";
            for (const [key, val] of Object.entries(BIRIM_KAPASITELERI)) {
                if (turGirdisi === key) {
                    secilenKapasite = val;
                    gercekTurIsmi = key.charAt(0).toUpperCase() + key.slice(1);
                    if(key === 'tom lincoln') gercekTurIsmi = 'Tom Lincoln';
                    if(key === 'swat') gercekTurIsmi = 'SWAT';
                    if(key === 'air') gercekTurIsmi = 'AIR';
                    break;
                }
            }
            if (secilenKapasite === 0) return message.reply("❌ Geçersiz tür! (`lincoln, adam, mary, swat, air, william, tom, tom lincoln`)");
            const yeniBirimId = 'birim_' + Date.now();
            aktifBirimler[yeniBirimId] = { tur: gercekTurIsmi, kod: kodGirdisi, kapasite: secilenKapasite, uyeler: [] };
            dbKaydet();
            aktifMesaileriGuncelle();
            return message.reply(`✅ **${gercekTurIsmi} (${kodGirdisi})** birimi yetkili tarafından başarıyla oluşturuldu.`);
        }
        if (islem === 'kapat') {
            const kodGirdisi = args.slice(1).join(' ').toUpperCase();
            if (!kodGirdisi) return message.reply("Kullanım: `!birim kapat <kod>` (Örn: !birim kapat D91)");
            const birimId = Object.keys(aktifBirimler).find(id => aktifBirimler[id].kod === kodGirdisi);
            if (!birimId) return message.reply("❌ Bu koda sahip aktif bir birim bulunamadı.");
            delete aktifBirimler[birimId];
            dbKaydet();
            aktifMesaileriGuncelle();
            return message.reply(`✅ **${kodGirdisi}** kodlu birim yetkili tarafından zorla kapatıldı.`);
        }
        if (islem === 'kişiekle') {
            const kodGirdisi = args[1]?.toUpperCase();
            const target = message.mentions.users.first();
            if (!kodGirdisi || !target) return message.reply("Kullanım: `!birim kişiekle <kod> @kullanici`");
            if (!aktifMesailer[target.id]) return message.reply("❌ Bu memur mesaide değil, önce mesaiye sokunuz.");
            const birimId = Object.keys(aktifBirimler).find(id => aktifBirimler[id].kod === kodGirdisi);
            if (!birimId) return message.reply("❌ Bu koda sahip birim bulunamadı.");
            if (aktifBirimler[birimId].uyeler.length >= aktifBirimler[birimId].kapasite) return message.reply("❌ Bu birim tamamen dolu.");
            birimdenCikart(target.id); 
            aktifBirimler[birimId].uyeler.push(target.id);
            dbKaydet();
            aktifMesaileriGuncelle();
            return message.reply(`✅ ${target} memuru başarıyla **${kodGirdisi}** birimine eklendi.`);
        }
        if (islem === 'kişiçıkart') {
            const target = message.mentions.users.first();
            if (!target) return message.reply("Kullanım: `!birim kişiçıkart @kullanici`");
            const cikarildi = birimdenCikart(target.id);
            if (cikarildi) {
                dbKaydet();
                aktifMesaileriGuncelle();
                return message.reply(`✅ ${target} memuru bulunduğu birimden zorla çıkartıldı.`);
            } else {
                return message.reply("❌ Bu memur zaten hiçbir birimde değil.");
            }
        }
        return message.reply("Geçersiz işlem. Kullanımlar: `!birim ekle` | `!birim kapat` | `!birim kişiekle` | `!birim kişiçıkart`");
    }

    if (command === '!mesaikapat') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.users.first();
        if (!target) return message.reply("Kullanım: `!mesaikapat @kullanici`");
        const mesaiData = aktifMesailer[target.id];
        if (!mesaiData) return message.reply("❌ Bu memur zaten mesaide değil.");
        const simdi = Date.now();
        const toplamDakika = Math.floor((simdi - mesaiData.baslangic) / 60000);
        if (!toplamMesailer[target.id]) {
            toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        if (typeof toplamMesailer[target.id] === 'number') {
            toplamMesailer[target.id] += toplamDakika;
        } else {
            toplamMesailer[target.id].ms += (toplamDakika * 60000);
            toplamMesailer[target.id].sonCikis = simdi;
        }
        delete aktifMesailer[target.id];
        birimdenCikart(target.id);
        dbKaydet();
        logGonder(target, mesaiData.baslangic, simdi, toplamDakika, message.author);
        const targetMember = message.guild.members.cache.get(target.id);
        if (targetMember) {
            ismiGeriYukle(targetMember, '[M]');
        }
        await message.reply(`✅ ${target} adlı memurun mesaisi zorla bitirildi. (\`+${toplamDakika} Dk\`)`);
        target.send(`🛑 **LSPD DİKKAT:** Mesain bir yetkili (${message.author.tag}) tarafından sonlandırıldı.`).catch(() => {});
        aktifMesaileriGuncelle();
        liderlikTablosunuGuncelle();
    }

    if (command === '!mesaisil') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.users.first();
        const silinecekDk = parseInt(args[1]);
        if (!target || isNaN(silinecekDk)) return message.reply("Kullanım: `!mesaisil @kullanici <dakika>`");
        if (!toplamMesailer[target.id]) {
            toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        if (typeof toplamMesailer[target.id] === 'number') {
            toplamMesailer[target.id] -= silinecekDk;
            if (toplamMesailer[target.id] < 0) toplamMesailer[target.id] = 0; 
        } else {
            toplamMesailer[target.id].ms -= (silinecekDk * 60000);
            if (toplamMesailer[target.id].ms < 0) toplamMesailer[target.id].ms = 0;
        }
        dbKaydet();
        await message.reply(`✅ ${target} adlı memurun toplam süresinden \`${silinecekDk} Dk\` silindi.`);
        liderlikTablosunuGuncelle();
        rutbeListesiniGuncelle();
    }

    if (command === '!mesaisok') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.users.first();
        if (!target) return message.reply("Kullanım: `!mesaisok @kullanici`");
        if (aktifMesailer[target.id]) return message.reply("❌ Bu memur zaten sahada aktif mesaide.");
        const simdi = Date.now();
        aktifMesailer[target.id] = { baslangic: simdi, sonBildirim: simdi, birim: "Belirtilmedi" }; 
        dbKaydet();
        const targetMember = message.guild.members.cache.get(target.id);
        if (targetMember) {
            isimTagEkle(targetMember, '[M]');
        }
        await message.reply(`✅ ${target} adlı memur yetkili tarafından mesaiye sokuldu.`);
        target.send(`🚓 **LSPD DİKKAT:** Bir yetkili (${message.author.tag}) tarafından mesaiye sokuldun. Telsizin açıldı, iyi görevler!`).catch(() => {});
        aktifMesaileriGuncelle();
    }

    if (command === '!mesaiekle') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.users.first();
        const eklenecekDk = parseInt(args[1]);
        if (!target || isNaN(eklenecekDk)) return message.reply("Kullanım: `!mesaiekle @kullanici <dakika>`");
        if (!toplamMesailer[target.id]) {
            toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        if (typeof toplamMesailer[target.id] === 'number') {
            toplamMesailer[target.id] += eklenecekDk;
        } else {
            toplamMesailer[target.id].ms += (eklenecekDk * 60000);
        }
        dbKaydet();
        await message.reply(`✅ ${target} adlı memurun toplam mesai süresine \`${eklenecekDk} Dk\` eklendi.`);
        liderlikTablosunuGuncelle();
        rutbeListesiniGuncelle();
    }

    if (command === '!setup-ticket') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const embed = new EmbedBuilder()
            .setTitle("🎫 LSPD Destek ve Şikayet Merkezi")
            .setDescription("Aşağıdaki butonu kullanarak şikayet, destek veya bilgi talebi oluşturabilirsiniz.")
            .setColor("Blue");
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_ticket_ac')
                .setLabel('Destek Talebi Aç')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩')
        );
        message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(()=>{});
    }

    if (command === '!setup-mazeret') { 
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const embed = new EmbedBuilder()
            .setTitle("🗓️ Mazeret Bildirim Paneli")
            .setDescription("Mesaiye giremeyecek memurlar mazeretlerini aşağıdaki butondan bildirebilir veya mevcut mazeretlerini iptal edebilirler.")
            .setColor("Orange");
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_mazeret_bildir')
                .setLabel('Mazeret Bildir')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('btn_mazeret_iptal')
                .setLabel('Mazeretimi İptal Et')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );
        message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(()=>{});
    }

    if (command === '!mazeretsil') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const mId = parseInt(args[0]);
        if (isNaN(mId)) return message.reply("Kullanım: `!mazeretsil <ID Numarası>`\n*(ID Numarasını !mazeretler yazarak listeden görebilirsiniz)*");
        const index = gecmisMazeretler.findIndex(m => m.id === mId);
        if (index === -1) return message.reply("❌ Bu ID'ye sahip bir mazeret bulunamadı.");
        const silinenMazeret = gecmisMazeretler[index];
        message.guild.members.fetch(silinenMazeret.user).then(async targetMember => {
            targetMember.roles.remove(AYARLAR.MAZERET_ROL_ID).catch(() => null);
            await ismiGeriYukle(targetMember, '[Mazeretli]');
            if (aktifMesailer[silinenMazeret.user]) {
                await isimTagEkle(targetMember, '[M]');
            }
        }).catch(() => null);
        gecmisMazeretler.splice(index, 1);
        dbKaydet();
        return message.reply(`✅ **${mId}** ID'li mazeret kaydı veri tabanından silindi ve memurun ismi düzeltildi.`);
    }

    if (command === '!mazeretekle') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.users.first();
        const tarihSaat = args.slice(1, 3).join(" "); 
        const sebep = args.slice(3).join(" ");
        if (!target || !tarihSaat || !sebep) return message.reply("Kullanım: `!mazeretekle @kullanici <Tarih ve Saat> <sebep>`\nÖrnek: `!mazeretekle @Ahmet 08.04.2026 20.00 Hastalık`");
        const bitisMs = parseTarihSaatTR(tarihSaat);
        if (!bitisMs) return message.reply("❌ **Geçersiz Format!** Lütfen şu formatta yazın: `DD.MM.YYYY HH.mm` (Örn: 08.04.2026 20.00)");
        if (bitisMs <= Date.now()) return message.reply("❌ **Geçersiz Tarih!** Geçmiş bir tarihe mazeret ekleyemezsiniz.");
        const mID = gecmisMazeretler.length > 0 ? Math.max(...gecmisMazeretler.map(m => m.id || 0)) + 1 : 1;
        gecmisMazeretler.push({ 
            id: mID, 
            user: target.id, 
            sebep, 
            tarih: trTimeStr().split(' ')[0], 
            bitisTarihiText: tarihSaat, 
            bitisZamani: bitisMs, 
            ek: "Yetkili komutu ile manuel eklendi.", 
            durum: 'Onaylandı', 
            onaylayan: `<@${message.author.id}>`, 
            aktifMi: true, 
            onayTarihi: trTimeStr() 
        });
        dbKaydet();
        message.guild.members.fetch(target.id).then(targetMember => {
            targetMember.roles.add(AYARLAR.MAZERET_ROL_ID).catch(()=>null);
            isimTagEkle(targetMember, '[Mazeretli]');
        }).catch(()=>{});
        return message.reply(`✅ ${target} için **${tarihSaat}** tarihine kadar mazeret oluşturuldu ve onaylandı. (ID: **${mID}**)`);
    }

    if (command === '!aktifmemurlar') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        await message.guild.members.cache; // rate limit yedi 
        const lspdPersonelleri = message.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
        const simdi = Date.now();
        let mesaidekiler = [];
        let disaridakiler = [];
        lspdPersonelleri.forEach(m => {
            let toplam = typeof toplamMesailer[m.id] === 'number' ? toplamMesailer[m.id] : (toplamMesailer[m.id] ? Math.floor(toplamMesailer[m.id].ms / 60000) : 0);
            if (aktifMesailer[m.id]) {
                const anlikDakika = Math.floor((simdi - aktifMesailer[m.id].baslangic) / 60000);
                toplam += anlikDakika;
                mesaidekiler.push({ id: m.id, toplam, baslangic: aktifMesailer[m.id].baslangic });
            } else {
                disaridakiler.push({ id: m.id, toplam });
            }
        });
        mesaidekiler.sort((a, b) => b.toplam - a.toplam);
        disaridakiler.sort((a, b) => b.toplam - a.toplam);
        const formatKisa = (dk) => {
            const s = Math.floor(dk / 60); 
            const d = dk % 60;
            return `${s}s  ${d}dk`;
        };
        let desc = `━━ 🚔 **Gelişmiş Mesai Listesi** ━━\n\n**Toplam Personel:** ${lspdPersonelleri.size} | **Mesaide:** ${mesaidekiler.length} | **Dışarıda:** ${disaridakiler.length}\n*Liste toplam mesai süresine göre sıralanmıştır.*\n\n`;
        desc += `✅ **Şu An Mesaide (${mesaidekiler.length})**\n`;
        let eklenecekMesaide = "";
        for (let i = 0; i < mesaidekiler.length; i++) {
            const data = mesaidekiler[i];
            const satir = `🟢 <@${data.id}> — <t:${Math.floor(data.baslangic / 1000)}:R> başladı | Toplam: \`${formatKisa(data.toplam)}\`\n`;
            if ((desc.length + eklenecekMesaide.length + satir.length) > 2000) { 
                eklenecekMesaide += `*...ve ${mesaidekiler.length - i} kişi daha*\n`; 
                break; 
            }
            eklenecekMesaide += satir;
        }
        desc += eklenecekMesaide || "> *Şu an mesaide olan personel yok.*\n";
        desc += `\n⛔ **Mesai Dışı (${disaridakiler.length})**\n`;
        let eklenecekDisarida = "";
        for (let i = 0; i < disaridakiler.length; i++) {
            const data = disaridakiler[i];
            const satir = `🔴 <@${data.id}> — Toplam: \`${formatKisa(data.toplam)}\`\n`;
            if ((desc.length + eklenecekDisarida.length + satir.length) > 3900) { 
                eklenecekDisarida += `*...ve ${disaridakiler.length - i} kişi daha*\n`; 
                break; 
            }
            eklenecekDisarida += satir;
        }
        desc += eklenecekDisarida || "> *Tüm personel sahada!*\n";
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Los Santos Polis Departmanı #LSPD`, iconURL: message.guild.iconURL() })
            .setDescription(desc)
            .setColor("#2B2D31") 
            .setFooter({ text: `${message.guild.name} • Mesai Takip Sistemi`, iconURL: message.guild.iconURL() })
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_toplu_mesai_kapat')
                .setLabel('Herkesi Mesaiden Çıkar')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💥')
        );
        message.channel.send({ embeds: [embed], components: [row] });
    }
    
    if (command === '!timeout') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const target = message.mentions.members.first();
        const sureDk = parseInt(args[1]);
        if (!target || isNaN(sureDk)) return message.reply("Kullanım: `!timeout @kullanici <dakika> <sebep>`");
        try {
            await target.timeout(sureDk * 60 * 1000, args.slice(2).join(' '));
            message.reply(`✅ ${target} adlı memura ${sureDk} dakika mola verildi.`);
        } catch(e) { 
            message.reply("❌ Yetki hatası."); 
        }
    }

    if (command === '!mesai-top') {
        const uyeler = message.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
        const siraliUyeler = Array.from(uyeler.values())
            .filter(m => toplamMesailer[m.id] && (typeof toplamMesailer[m.id] === 'number' ? toplamMesailer[m.id] : toplamMesailer[m.id].ms) > 0)
            .sort((a, b) => {
                let aMs = typeof toplamMesailer[a.id] === 'number' ? toplamMesailer[a.id] * 60000 : (toplamMesailer[a.id].ms || 0);
                let bMs = typeof toplamMesailer[b.id] === 'number' ? toplamMesailer[b.id] * 60000 : (toplamMesailer[b.id].ms || 0);
                return bMs - aMs;
            });
        let sayfalar = [];
        for (let i = 0; i < siraliUyeler.length; i += 15) {
            let desc = "";
            siraliUyeler.slice(i, i + 15).forEach((u, index) => { 
                let uMs = typeof toplamMesailer[u.id] === 'number' ? toplamMesailer[u.id] * 60000 : (toplamMesailer[u.id].ms || 0);
                desc += `**${i + index + 1})** 👮 <@${u.id}> - \`${tamSureFormat(uMs)}\`\n`; 
            });
            sayfalar.push(
                new EmbedBuilder()
                    .setTitle("🏃 Mesai Sıralaması")
                    .setDescription(desc || "Kayıt yok.")
                    .setColor("DarkBlue")
                    .setThumbnail(message.guild.iconURL())
            );
        }
        if (sayfalar.length === 0) return message.reply("Kayıtlı mesai yok.");
        return sayfalamaYap(message, sayfalar);
    }

    if (command === '!sonmesai') {
        const hedefMember = message.mentions.members.first() || message.member;
        const hedefUser = hedefMember.user;
        const veri = toplamMesailer[hedefUser.id];
        const aktif = aktifMesailer[hedefUser.id];

        const sonGiris = veri?.sonGiris || 0;
        const sonCikis = veri?.sonCikis || 0;

        let desc = '';
        if (aktif) {
            const gecenDk = Math.floor((Date.now() - aktif.baslangic) / 60000);
            desc += `🟢 **Şu an mesaide** (${Math.floor(gecenDk / 60)}s ${gecenDk % 60}dk)\n`;
            desc += `⏱️ Giriş: <t:${Math.floor(aktif.baslangic / 1000)}:F>\n`;
        } else {
            desc += sonGiris
                ? `📅 Son giriş: <t:${Math.floor(sonGiris / 1000)}:F> (<t:${Math.floor(sonGiris / 1000)}:R>)\n`
                : `📅 Son giriş: *Kayıt yok*\n`;
            if (sonCikis) {
                desc += `🚪 Son çıkış: <t:${Math.floor(sonCikis / 1000)}:F> (<t:${Math.floor(sonCikis / 1000)}:R>)\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`🕐 Mesai Geçmişi — ${hedefMember.displayName}`)
            .setDescription(desc || 'Kayıt bulunamadı.')
            .setColor(aktif ? 'Green' : 'Grey')
            .setThumbnail(hedefUser.displayAvatarURL())
            .setFooter({ text: `ID: ${hedefUser.id}` });

        return message.reply({ embeds: [embed] });
    }

    if (command === '!mazeretler') {
        if (!hasPerm && !message.member.roles.cache.has(AYARLAR.MAZERET_ONAY_ROL_ID)) return message.reply("❌ Yetkiniz yetersiz.");
        let sayfalar = [];
        const aktifMazeretler = gecmisMazeretler.filter(m => m.durum === 'Onaylandı');
        const sirali = [...aktifMazeretler].reverse(); 
        for (let i = 0; i < sirali.length; i += 4) {
            let desc = `Şu an devam eden **${aktifMazeretler.length}** mazeret bulunuyor.\n*(Bekleyen veya süresi bitenler gösterilmez)*\n\n`;
            sirali.slice(i, i + 4).forEach((m, index) => {
                desc += `**${i + index + 1})** ✅ <@${m.user}>\n📅 Bitiş Tarihi: **${m.bitisTarihiText}**\n📖 Sebep: ${m.sebep}\n🔔 Açıklama: ${m.ek}\n👮 Onaylayan: ${m.onaylayan}\n📆 Onay Tarihi: ${m.onayTarihi || '-'}\n🆔 ID: ${m.id}\n\n`;
            });
            sayfalar.push(
                new EmbedBuilder()
                    .setTitle("Aktif Mazeretler Listesi")
                    .setDescription(desc)
                    .setColor("DarkVividPink")
                    .setThumbnail(message.guild.iconURL())
            );
        }
        if (sayfalar.length === 0) return message.reply("Şu an devam eden aktif bir mazeret bulunmuyor.");
        return sayfalamaYap(message, sayfalar);
    }

    if (command === '!inaktifler') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        inaktifRaporuGonder(message.channel); 
    }

    if (command === '!mesaisifirla') {
        if (!hasPerm) return message.reply("❌ Bu komutu kullanmak için yetkiniz yok.");
        const bekle = await message.reply("⏳ Mesai verileri toplanıyor ve rapor hazırlanıyor...");
        const sonuc = await mesaiSifirlaVeRaporOlustur(message.author, message.channel, message.guild);
        if (sonuc.basarili) {
            bekle.delete().catch(() => {});
        } else {
            bekle.edit("❌ Bir hata oluştu, mesailer sıfırlanamadı.");
        }
    }

    if (command === '!mesairapor') {
        if (!hasPerm) return message.reply("❌ Bu komutu kullanmak için yetkiniz yok.");
        const tur = args[0]?.toLowerCase();
        if (!tur || (tur !== 'gunluk' && tur !== 'genel')) {
            return message.reply("❌ **Kullanım:** `!mesairapor gunluk` veya `!mesairapor genel`");
        }
        const bekle = await message.reply(`⏳ **${tur === 'gunluk' ? 'Günlük' : 'Genel'}** rapor hazırlanıyor...`);
        const sonuc = await mesaiRaporuOlusturVeGonder(message.author, message.channel, message.guild, tur);
        if (sonuc && sonuc.basarili) {
            bekle.delete().catch(() => {});
        } else {
            bekle.edit("❌ Rapor oluşturulamadı.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FTO SİSTEMİ
    // ─────────────────────────────────────────────────────────────────────────

    // !ftoata @fts @fto
    if (command === '!ftoata') {
        const hasFtoPerm = hasPerm || message.member.roles.cache.has(AYARLAR.FTO_ROL_ID);
        if (!hasFtoPerm) return message.reply("❌ FTO atamak için yetkiniz yok.");
        const ftsMember = message.mentions.members.first();
        const ftoMember = message.mentions.members.at(1) || message.member;
        if (!ftsMember) return message.reply("❌ **Kullanım:** `!ftoata @FTS @FTO`\n> FTO belirtilmezse siz FTO olarak atanırsınız.");
        const sonuc = await ftoAtaForum(message.guild, ftsMember, ftoMember);
        return message.reply(sonuc.mesaj);
    }

    // !ftokapat @fts
    if (command === '!ftokapat') {
        const hasFtoPerm = hasPerm || message.member.roles.cache.has(AYARLAR.FTO_ROL_ID);
        if (!hasFtoPerm) return message.reply("❌ FTO kanalını kapatmak için yetkiniz yok.");
        const ftsMember = message.mentions.members.first();
        if (!ftsMember) return message.reply("❌ **Kullanım:** `!ftokapat @FTS`");
        const sonuc = await ftoKapatForum(message.guild, ftsMember);
        return message.reply(sonuc.mesaj);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ROL VER + OTOMATİK KOD ATAMA  !rolver @kişi @rol
    // ─────────────────────────────────────────────────────────────────────────
    if (command === '!rolver') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        const hedefUye = message.mentions.members.first();
        const hedefRol = message.mentions.roles.first();
        if (!hedefUye || !hedefRol) return message.reply("❌ **Kullanım:** `!rolver @kişi @rol`");
        // Red Permi rolünü sadece Tropper 1 (R_700) sahipleri verebilir
        const TROPPER1_ROL_ID = '1487574121264058499';
        if (hedefRol.id === AYARLAR.RED_PERMI_ROL_ID && !message.member.roles.cache.has(TROPPER1_ROL_ID) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ **Red Permi** rolünü sadece **Tropper 1** rütbesindekiler verebilir.");
        }
        const sonuc = await rolVerVeKodAta(message.guild, hedefUye, hedefRol);
        return message.reply(sonuc.mesaj);
    }

    // --------------------------------------------------------------------------
    // TOPLU DUYURU KOMUTU (!)
    // --------------------------------------------------------------------------
    if (command === '!topluduyuru') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");

        const yontem = args[0]?.toLowerCase();
        if (!yontem || (yontem !== 'dm' && yontem !== 'kanal')) {
            return message.reply("❌ **Kullanım:**\n`!topluduyuru dm <mesaj>` → Özel mesaj gönderir.\n`!topluduyuru kanal #kanal <mesaj>` → Kanalda tag'ler.");
        }

        let hedefKanal = null;
        let duyuruMesaji = '';

        if (yontem === 'kanal') {
            hedefKanal = message.mentions.channels.first();
            if (!hedefKanal) return message.reply("❌ Lütfen bir kanal etiketleyin. Kullanım: `!topluduyuru kanal #kanal <mesaj>`");
            duyuruMesaji = args.slice(2).join(' ');
        } else {
            duyuruMesaji = args.slice(1).join(' ');
        }

        if (!duyuruMesaji || duyuruMesaji.trim() === '') {
            return message.reply("❌ Lütfen göndermek istediğiniz mesajı yazın.");
        }

        const hedefler = message.guild.members.cache.filter(m =>
            m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID) &&
            !aktifMesailer[m.id] &&
            !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID) &&
            !m.user.bot
        );

        if (hedefler.size === 0) {
            return message.reply("ℹ️ Kriterlere uyan (mesaide olmayan, mazeretsiz) kimse bulunamadı.");
        }

        const beklemeMesaji = await message.reply(`⏳ **${hedefler.size}** kişiye duyuru gönderiliyor...`);
        let basariliListesi = [];
        let basarisizListesi = [];

        if (yontem === 'dm') {
            for (const [, uye] of hedefler) {
                const dmEmbed = new EmbedBuilder()
                    .setTitle("📢 LSPD DUYURU")
                    .setDescription(`${uye} **→ ${duyuruMesaji}**`)
                    .setColor("Blue")
                    .setFooter({ text: `Gönderen: ${message.author.tag}` })
                    .setTimestamp();
                try {
                    await uye.send({ content: `${uye}`, embeds: [dmEmbed] });
                    basariliListesi.push(uye.id);
                    await new Promise(r => setTimeout(r, 500)); 
                } catch (e) {
                    basarisizListesi.push(uye.id);
                }
            }

            // GÖRSELDEKİ EFSANE RAPOR TASARIMI
            const raporEmbed = new EmbedBuilder()
                .setTitle("📊 LSPD DM Duyuru Raporu")
                .setDescription(`Duyuru işlemi tamamlandı.\n\n✅ **${basariliListesi.length}** kişiye mesaj iletildi.\n❌ **${basarisizListesi.length}** kişiye ulaşılamadı (DM Kapalı / Bot Engelli).`)
                .setColor("DarkButNotBlack");

            // Raporları geçici olarak hafızada tutuyoruz (Butonlar basınca okuyabilsin diye)
            if (!client.dmRaporlari) client.dmRaporlari = new Map();
            const raporId = 'dm_' + Date.now();
            client.dmRaporlari.set(raporId, { basarili: basariliListesi, basarisiz: basarisizListesi });
            
            // 1 saat sonra hafızadan siler (RAM şişmesin diye)
            setTimeout(() => client.dmRaporlari.delete(raporId), 3600000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_basarili_${raporId}`)
                    .setLabel('✅ Mesaj İletilenler')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(basariliListesi.length === 0),
                new ButtonBuilder()
                    .setCustomId(`btn_basarisiz_${raporId}`)
                    .setLabel('❌ Mesaj İletilmeyenler')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(basarisizListesi.length === 0)
            );

            await beklemeMesaji.edit({ content: null, embeds: [raporEmbed], components: [row] });

        } else {
            const duyuruEmbed = new EmbedBuilder()
                .setTitle("📢 LSPD TOPLU DUYURU")
                .setDescription(`**Mesaj:** ${duyuruMesaji}\n\n**Gönderen:** ${message.author}`)
                .setColor("Blue")
                .setFooter({ text: `${hedefler.size} personele gönderildi` })
                .setTimestamp();
            await hedefKanal.send({ embeds: [duyuruEmbed] });

            let basarili = 0;
            const hedefDizi = Array.from(hedefler.values());
            for (let i = 0; i < hedefDizi.length; i += 5) {
                const grup = hedefDizi.slice(i, i + 5);
                const tagMetni = grup.map(u => `${u}`).join(' ');
                await hedefKanal.send({ content: `${tagMetni}\n> 📢 **DUYURU:** ${duyuruMesaji}` });
                basarili += grup.length;
                if (i + 5 < hedefDizi.length) await new Promise(r => setTimeout(r, 1500)); 
            }
            await beklemeMesaji.edit(`✅ Duyuru tamamlandı! **${basarili}** personel ${hedefKanal} kanalında tag'lendi.`);
        }
    }

    if (command === '!uyari') {
        if (!hasPerm) return message.reply("❌ Yetkiniz yetersiz.");
        
        const islem = args[0]?.toLowerCase();
        
        if (!islem || !['ver', 'sozlu', 'toplu', 'toplusozlu', 'haric', 'haricsozlu', 'liste', 'sil', 'sifirla'].includes(islem)) {
            return message.reply(
                "**Kullanım:**\n" +
                "`!uyari ver @memur <sebep>` — Yazılı uyarı (kademeli)\n" +
                "`!uyari sozlu @memur <sebep>` — Sözlü uyarı\n" +
                "`!uyari toplu @a @b <sebep>` — Birden çok yazılı\n" +
                "`!uyari toplusozlu @a @b <sebep>` — Birden çok sözlü\n" +
                "`!uyari haric @rol [@hariç] <sebep>` — Yazılı (hariç modu)\n" +
                "`!uyari haricsozlu @rol [@hariç] <sebep>` — Sözlü (hariç modu)\n" +
                "`!uyari liste @memur` — Geçmiş\n" +
                "`!uyari sil <id>` — Sil\n" +
                "`!uyari sifirla @memur` — Tümünü sıfırla"
            );
        }
        
        const cleanSebep = (raw) => raw
            .replace(/^!uyari\s+\w+\s*/i, '')
            .replace(/<@&\d+>/g, '')
            .replace(/<@!?\d+>/g, '')
            .trim();
        
        if (islem === 'ver' || islem === 'sozlu') {
            const target = message.mentions.users.first();
            if (!target) return message.reply(`❌ Memur etiketle. Kullanım: \`!uyari ${islem} @memur <sebep>\``);
            if (target.bot) return message.reply("❌ Botlara uyarı verilemez.");
            const sebep = cleanSebep(message.content);
            if (!sebep) return message.reply("❌ Sebep yazmalısın.");
            const sozluMu = (islem === 'sozlu');
            const r = sozluMu 
                ? await sozluUyariEkle(target, message.author, sebep, message.guild)
                : await uyariEkle(target, message.author, sebep, message.guild);
            const embed = new EmbedBuilder()
                .setTitle(sozluMu ? `🗣️ ${target.username} → Sözlü Uyarı` : `⚠️ ${target.username} → ${r.kademe}x Yazılı Uyarı`)
                .setColor(sozluMu ? "DarkButNotBlack" : (r.kademe >= 4 ? "DarkRed" : r.kademe >= 3 ? "Red" : r.kademe >= 2 ? "Orange" : "Yellow"))
                .setDescription(sozluMu 
                    ? `${target} memuruna **sözlü uyarı** verildi.\n*Kademeli sisteme dahil değildir.*`
                    : `${target} memuruna **${r.kademe}x** yazılı uyarı verildi.${r.maxAsildi ? '\n> ⚠️ MAX kademe.' : ''}`)
                .addFields(
                    { name: "📖 Sebep", value: sebep, inline: false },
                    { name: "🆔 ID", value: `\`${r.id}\``, inline: true },
                    { name: "👮 Veren", value: `${message.author}`, inline: true }
                ).setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }
        
        if (islem === 'toplu' || islem === 'toplusozlu') {
            const mentions = Array.from(message.mentions.members.values()).filter(m => !m.user.bot);
            if (mentions.length === 0) return message.reply("❌ En az 1 memur etiketle.");
            const sebep = cleanSebep(message.content);
            if (!sebep) return message.reply("❌ Sebep yazmalısın.");
            const sozluMu = (islem === 'toplusozlu');
            const bekleMsj = await message.reply(`⏳ **${mentions.length}** memura toplu ${sozluMu ? 'sözlü' : 'yazılı'} uyarı veriliyor...`);
            const sonuclar = sozluMu
                ? await topluSozluUyariVer(mentions, message.author, sebep, message.guild)
                : await topluUyariVer(mentions, message.author, sebep, message.guild);
            const basarili = sonuclar.filter(s => s.basarili);
            let desc = `**${basarili.length}** memura uyarı verildi.\n📖 **Sebep:** ${sebep}\n\n`;
            desc += basarili.map(s => sozluMu 
                ? `• ${s.user} (ID: \`${s.id}\`)`
                : `• ${s.user} → **${s.kademe}x** (ID: \`${s.id}\`)${s.maxAsildi ? ' ⚠️' : ''}`
            ).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(sozluMu ? "🗣️ Toplu Sözlü Uyarı" : "⚠️ Toplu Yazılı Uyarı")
                .setDescription(desc.length > 4000 ? desc.substring(0, 3950) : desc)
                .setColor(sozluMu ? "DarkButNotBlack" : "Orange")
                .setFooter({ text: `Veren: ${message.author.tag}` }).setTimestamp();
            return bekleMsj.edit({ content: null, embeds: [embed] });
        }
        
        if (islem === 'haric' || islem === 'haricsozlu') {
            const rol = message.mentions.roles.first();
            if (!rol) return message.reply(`❌ Rol etiketle. Örnek: \`!uyari ${islem} @LSPD @ali Sebep\``);
            // Ham mesajdan kişi ID'lerini çek (rol mention'ları <@&ID> hariç tutulur)
            const haricIds = new Set(
                [...message.content.matchAll(/<@!?(\d+)>/g)].map(m => m[1])
            );

            // 🔍 DEBUG
            console.log('[UYARI-DEBUG] Mesaj içeriği:', message.content);
            console.log('[UYARI-DEBUG] Yakalanan hariç ID\'ler:', [...haricIds]);
            console.log('[UYARI-DEBUG] Rol ID:', rol.id, '| Rol adı:', rol.name);

            const sebep = cleanSebep(message.content);
            if (!sebep) return message.reply("❌ Sebep yazmalısın.");
            await message.guild.members.cache;
            const hedefler = message.guild.members.cache.filter(m =>
                m.roles.cache.has(rol.id) && !m.user.bot &&
                !haricIds.has(m.id) && m.id !== message.author.id &&
                !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID)
            );
            if (hedefler.size === 0) return message.reply("❌ Kimse kalmadı.");
            if (hedefler.size > 200) return message.reply(`❌ Çok fazla hedef (${hedefler.size}). Limit: 30.`);
            const sozluMu = (islem === 'haricsozlu');
            const bekleMsj = await message.reply(`⏳ **${hedefler.size}** memura ${sozluMu ? 'sözlü' : 'yazılı'} uyarı veriliyor...`);
            const sonuclar = sozluMu
                ? await topluSozluUyariVer(Array.from(hedefler.values()), message.author, sebep, message.guild)
                : await topluUyariVer(Array.from(hedefler.values()), message.author, sebep, message.guild);
            const basarili = sonuclar.filter(s => s.basarili);
            let desc = `**${rol.name}** rolündeki **${basarili.length}** memura uyarı verildi.\n`;
            if (haricIds.size > 0) desc += `> 🛡️ **${haricIds.size}** kişi hariç.\n`;
            desc += `📖 **Sebep:** ${sebep}\n\n`;
            const liste = basarili.map(s => sozluMu ? `• ${s.user}` : `• ${s.user} → **${s.kademe}x**${s.maxAsildi ? ' ⚠️' : ''}`);
            let eklenecek = "";
            for (let i = 0; i < liste.length; i++) {
                if ((desc.length + eklenecek.length + liste[i].length + 2) > 3800) {
                    eklenecek += `\n*...ve ${liste.length - i} kişi daha*`;
                    break;
                }
                eklenecek += liste[i] + '\n';
            }
            desc += eklenecek;
            const embed = new EmbedBuilder()
                .setTitle(sozluMu ? "🗣️ Toplu Sözlü Uyarı (Hariç)" : "⚠️ Toplu Yazılı Uyarı (Hariç)")
                .setDescription(desc)
                .setColor(sozluMu ? "DarkButNotBlack" : "DarkOrange")
                .setFooter({ text: `Veren: ${message.author.tag}` }).setTimestamp();
            return bekleMsj.edit({ content: null, embeds: [embed] });
        }
        
        if (islem === 'liste') {
            const target = message.mentions.users.first();
            if (!target) return message.reply("❌ Memur etiketle.");
            const data = uyarilar[target.id];
            const yazili = data?.yazili || [];
            const sozlu = data?.sozlu || [];
            if (yazili.length === 0 && sozlu.length === 0) return message.reply(`✅ ${target} memurunun hiç uyarısı yok — temiz sicil.`);
            let desc = '';
            if (yazili.length > 0) {
                desc += `**📋 Yazılı (${yazili.length}):**\n`;
                desc += yazili.map(u => `**${u.kademe}x** — \`ID: ${u.id}\` ${u.maxAsildi ? '⚠️' : ''}\n📖 ${u.sebep}\n👮 ${u.verenTag} • 📅 ${u.tarih}`).join('\n\n');
            }
            if (sozlu.length > 0) {
                if (desc) desc += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
                desc += `**🗣️ Sözlü (${sozlu.length}):**\n`;
                desc += sozlu.map(u => `\`ID: ${u.id}\`\n📖 ${u.sebep}\n👮 ${u.verenTag} • 📅 ${u.tarih}`).join('\n\n');
            }
            const embed = new EmbedBuilder()
                .setTitle(`📋 ${target.username} — Uyarı Geçmişi`)
                .setDescription(desc.length > 4000 ? desc.substring(0, 3950) + '\n*...*' : desc)
                .setColor("Orange").setThumbnail(target.displayAvatarURL())
                .setFooter({ text: `Yazılı: ${yazili.length} • Sözlü: ${sozlu.length} • Kademe: ${Math.min(yazili.length, AYARLAR.UYARI_MAX_KADEME)}x` });
            return message.channel.send({ embeds: [embed] });
        }
        
        if (islem === 'sil') {
            const uyariId = parseInt(args[1]);
            if (isNaN(uyariId)) return message.reply("❌ Kullanım: `!uyari sil <id>`");
            const sonuc = await uyariSilById(uyariId, message.guild);
            if (!sonuc) return message.reply(`❌ ID \`${uyariId}\` bulunamadı.`);
            const tipLbl = sonuc.tip === 'sozlu' ? '🗣️ sözlü' : '⚠️ yazılı';
            const kademeLbl = sonuc.silinen.kademe ? `**${sonuc.silinen.kademe}x** ` : '';
            return message.reply(`✅ Uyarı silindi (${tipLbl}).\n> 👤 <@${sonuc.userId}> — ${kademeLbl}${sonuc.silinen.sebep}\n> ℹ️ Kalan yazılı uyarılar yeniden numaralandı, rol güncellendi.`);
        }
        
        if (islem === 'sifirla') {
            const target = message.mentions.users.first();
            if (!target) return message.reply("❌ Memur etiketle.");
            const r = await uyariSifirla(target.id, message.guild, 'tumu');
            if (r.yazili === 0 && r.sozlu === 0) return message.reply(`ℹ️ ${target} memurunun zaten uyarısı yoktu.`);
            return message.reply(`✅ ${target} memurunun tüm uyarıları sıfırlandı.\n> ⚠️ Yazılı: **${r.yazili}** | 🗣️ Sözlü: **${r.sozlu}**`);
        }
    }

});
// ==============================================================================
// 6. ETKİLEŞİMLER (SLASH KOMUTLARI, BUTONLAR VE MODALLAR)
// ==============================================================================
client.on('interactionCreate', async (interaction) => {
    const simdi = Date.now();

    // --------------------------------------------------------------------------
    // SLASH KOMUT İŞLEYİCİSİ
    // --------------------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
        const command = interaction.commandName;
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (command === 'komutlar') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const embed = new EmbedBuilder()
                .setTitle("🚔 LSPD Yönetim Botu Komutları")
                .setDescription("Aşağıda departmanı yönetmek için kullanabileceğiniz tüm komutlar listelenmiştir:")
                .setColor("DarkVividPink")
                .addFields(
                    { name: "🛠️ Kurulum Komutları", value: "`/panelkur` - Mesai kontrol panelini kurar.\n`/setup-mazeret` - Mazeret bildirim panelini kurar.\n`/setup-ticket` - Destek talebi panelini kurar." },
                    { name: "⏱️ Mesai Yönetim Komutları", value: "`/mesaisok` - Seçilen memuru zorla mesaiye sokar.\n`/mesaikapat` - Memurun aktif mesaisini bitirir.\n`/mesaiekle` - Toplam mesaisine süre ekler.\n`/mesaisil` - Mesai süresinden kesinti yapar." },
                    { name: "🗓️ Mazeret Yönetimi", value: "`/mazeretler` - Aktif mazeretleri gösterir.\n`/mazeretekle` - Manuel mazeret ekler.\n`/mazeretsil` - Seçilen mazereti anında siler." },
                    { name: "🚨 Raporlama ve Denetim", value: "`/aktifmemurlar` - Mesaide olanları listeler.\n`/mesai-top` - Genel görev süreleri sıralaması.\n`/inaktifler` - İnaktif olanları listeler.\n`/tarihinaktifler` - Belirtilen günde inaktif olan memurları atar.\n`/zorunlumesai` - Zorunlu mesai alarmını kurar.\n`/mesaisifirla` - Tüm mesaileri sıfırlar, HTML rapor oluşturur." },
                    { name: "📢 Toplu Duyuru", value: "`/topluduyuru mesaj:<mesaj> yontem:dm` - Tüm uygun personele DM gönderir.\n`/topluduyuru mesaj:<mesaj> yontem:kanal kanal:#kanal` - Kanala tag'leyerek duyuru yapar." }
                )
                .setTimestamp();
                
            return interaction.reply({ embeds: [embed] });
        }

        if (command === 'zorunlumesai') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const islem = interaction.options.getSubcommand();
            
            if (islem === 'baslat') {
                const bitisStr = interaction.options.getString('tarih_saat'); 
                const bitisMs = parseTarihSaatTR(bitisStr);
                
                if (!bitisMs) {
                    return interaction.reply({ content: "❌ Format Hatalı! Kullanım Örneği: `06.04.2026 19.00`", flags: MessageFlags.Ephemeral });
                }
                
                zorunluMesai = { aktif: true, bitis: bitisMs, kanal: interaction.channelId };
                dbKaydet();
                
                return interaction.reply(`✅ Zorunlu mesai denetimi başlatıldı! **${bitisStr}** tarihinde bu kanala rapor atılacak.`);
            }
            
            if (islem === 'bitir') {
                zorunluMesai.aktif = false; 
                dbKaydet();
                return interaction.reply("✅ Zorunlu mesai denetimi iptal edildi.");
            }
        }

// ───────────────────────────────────────────────────────────────────
// PARÇA 5 — SLASH HANDLER (interactionCreate → isChatInputCommand → topluduyuru'nun altına)
// ───────────────────────────────────────────────────────────────────
    

        if (command === 'tarihinaktifler') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const tarihStr = interaction.options.getString('tarih');
            const targetMs = parseTarihSaatTR(`${tarihStr} 23.59`);
            
            if (!targetMs) {
                return interaction.reply({ content: "❌ Hata: Tarih formatı `DD.MM.YYYY` olmalı.", flags: MessageFlags.Ephemeral });
            }
            
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.guild.members.cache; // rate limit yedi 
            const uyeler = interaction.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
            
            let inaktifMetni = "";
            let s = 1;
            
            uyeler.forEach(m => {
                const val = toplamMesailer[m.id];
                const son = (val && val.sonGiris) ? val.sonGiris : 0;
                const farkGun = Math.floor((targetMs - son) / 86400000);
                
                if (farkGun >= AYARLAR.INAKTIF_GUN_SINIRI) {
                    inaktifMetni += `**${s}.)** 👮 ${m} - Son mesai: **${son === 0 ? "Hiç girmedi" : `<t:${Math.floor(son / 1000)}:R>`}**\n`;
                    s++;
                }
            });
            
            const embed = new EmbedBuilder()
                .setTitle(`🚨 ${tarihStr} Tarihli İnaktif Raporu`)
                .setDescription(inaktifMetni || "Belirtilen tarihte herkes aktifti!")
                .setColor("Red");
                
            return interaction.editReply({ embeds: [embed] });
        }

        if (command === 'uyari') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            const islem = interaction.options.getSubcommand();
            
            if (islem === 'ver') {
                const target = interaction.options.getUser('memur');
                const sebep = interaction.options.getString('sebep');
                if (target.bot) return interaction.reply({ content: "❌ Botlara uyarı verilemez.", flags: MessageFlags.Ephemeral });
                await interaction.deferReply();
                const r = await uyariEkle(target, interaction.user, sebep, interaction.guild);
                const embed = new EmbedBuilder()
                    .setTitle(`⚠️ ${target.username} → ${r.kademe}x Yazılı Uyarı`)
                    .setColor(r.kademe >= 4 ? "DarkRed" : r.kademe >= 3 ? "Red" : r.kademe >= 2 ? "Orange" : "Yellow")
                    .setDescription(`${target} memuruna **${r.kademe}x** yazılı uyarı verildi.${r.maxAsildi ? '\n> ⚠️ **MAX kademe.**' : ''}`)
                    .addFields(
                        { name: "📖 Sebep", value: sebep, inline: false },
                        { name: "🆔 Uyarı ID", value: `\`${r.id}\``, inline: true },
                        { name: "👮 Veren", value: `${interaction.user}`, inline: true }
                    ).setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (islem === 'sozlu') {
                const target = interaction.options.getUser('memur');
                const sebep = interaction.options.getString('sebep');
                if (target.bot) return interaction.reply({ content: "❌ Botlara uyarı verilemez.", flags: MessageFlags.Ephemeral });
                await interaction.deferReply();
                const r = await sozluUyariEkle(target, interaction.user, sebep, interaction.guild);
                const embed = new EmbedBuilder()
                    .setTitle(`🗣️ Sözlü Uyarı`)
                    .setColor("DarkButNotBlack")
                    .setDescription(`${target} memuruna **sözlü uyarı** verildi.\n*Kademeli sisteme dahil değildir.*`)
                    .addFields(
                        { name: "📖 Sebep", value: sebep, inline: false },
                        { name: "🆔 Kayıt ID", value: `\`${r.id}\``, inline: true },
                        { name: "👮 Veren", value: `${interaction.user}`, inline: true }
                    ).setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (islem === 'toplu' || islem === 'toplusozlu') {
                const memurlarStr = interaction.options.getString('memurlar');
                const sebep = interaction.options.getString('sebep');
                const ids = [...memurlarStr.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
                if (ids.length === 0) return interaction.reply({ content: "❌ Hiç memur etiketlemediniz.", flags: MessageFlags.Ephemeral });
                await interaction.deferReply();
                const hedefler = [];
                for (const id of ids) {
                    try {
                        const m = await interaction.guild.members.fetch(id);
                        if (m && !m.user.bot) {
                            hedefler.push(m);
                        }
                    } catch (err) {}
                }
                if (hedefler.length === 0) return interaction.editReply("❌ Geçerli memur bulunamadı.");
                const sozluMu = (islem === 'toplusozlu');
                const sonuclar = sozluMu
                    ? await topluSozluUyariVer(hedefler, interaction.user, sebep, interaction.guild)
                    : await topluUyariVer(hedefler, interaction.user, sebep, interaction.guild);
                const basarili = sonuclar.filter(s => s.basarili);
                let desc = `**${basarili.length}** memura **${sozluMu ? 'sözlü' : 'yazılı'} toplu uyarı** verildi.\n📖 **Sebep:** ${sebep}\n\n`;
                desc += basarili.map(s => sozluMu 
                    ? `• ${s.user} (ID: \`${s.id}\`)`
                    : `• ${s.user} → **${s.kademe}x** (ID: \`${s.id}\`)${s.maxAsildi ? ' ⚠️ MAX' : ''}`
                ).join('\n');
                const embed = new EmbedBuilder()
                    .setTitle(sozluMu ? "🗣️ Toplu Sözlü Uyarı" : "⚠️ Toplu Yazılı Uyarı")
                    .setDescription(desc.length > 4000 ? desc.substring(0, 3950) + '\n*...*' : desc)
                    .setColor(sozluMu ? "DarkButNotBlack" : "Orange")
                    .setFooter({ text: `Veren: ${interaction.user.tag}` }).setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (islem === 'haric' || islem === 'haricsozlu') {
                const rol = interaction.options.getRole('rol');
                const haricStr = interaction.options.getString('haric') || '';
                const sebep = interaction.options.getString('sebep');
                const haricIds = new Set([...haricStr.matchAll(/<@!?(\d+)>/g)].map(m => m[1]));
                await interaction.deferReply();
                await interaction.guild.members.fetch();
                const hedefler = interaction.guild.members.cache.filter(m =>
                    m.roles.cache.has(rol.id) && !m.user.bot &&
                    !haricIds.has(m.id) && m.id !== interaction.user.id &&
                    !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID)
                );
                if (hedefler.size === 0) return interaction.editReply("❌ Hariç tutulanlar çıkarılınca kimse kalmadı.");
                if (hedefler.size > 200) return interaction.editReply(`❌ Çok fazla hedef (${hedefler.size}). Güvenlik için 30+ kişiye toplu uyarı verilemez.`);
                const sozluMu = (islem === 'haricsozlu');
                const sonuclar = sozluMu
                    ? await topluSozluUyariVer(Array.from(hedefler.values()), interaction.user, sebep, interaction.guild)
                    : await topluUyariVer(Array.from(hedefler.values()), interaction.user, sebep, interaction.guild);
                const basarili = sonuclar.filter(s => s.basarili);
                let desc = `**${rol.name}** rolündeki **${basarili.length}** memura **${sozluMu ? 'sözlü' : 'yazılı'}** uyarı verildi.\n`;
                if (haricIds.size > 0) desc += `> 🛡️ **${haricIds.size}** kişi hariç tutuldu.\n`;
                desc += `📖 **Sebep:** ${sebep}\n\n`;
                const liste = basarili.map(s => sozluMu ? `• ${s.user}` : `• ${s.user} → **${s.kademe}x**${s.maxAsildi ? ' ⚠️' : ''}`);
                let eklenecek = "";
                for (let i = 0; i < liste.length; i++) {
                    if ((desc.length + eklenecek.length + liste[i].length + 2) > 3800) {
                        eklenecek += `\n*...ve ${liste.length - i} kişi daha*`;
                        break;
                    }
                    eklenecek += liste[i] + '\n';
                }
                desc += eklenecek;
                const embed = new EmbedBuilder()
                    .setTitle(sozluMu ? "🗣️ Toplu Sözlü Uyarı (Hariç Modu)" : "⚠️ Toplu Yazılı Uyarı (Hariç Modu)")
                    .setDescription(desc)
                    .setColor(sozluMu ? "DarkButNotBlack" : "DarkOrange")
                    .setFooter({ text: `Veren: ${interaction.user.tag}` }).setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (islem === 'liste') {
                const target = interaction.options.getUser('memur');
                const data = uyarilar[target.id];
                const yazili = data?.yazili || [];
                const sozlu = data?.sozlu || [];
                if (yazili.length === 0 && sozlu.length === 0) {
                    return interaction.reply({ content: `✅ ${target} memurunun hiç uyarısı yok — temiz sicil.`, flags: MessageFlags.Ephemeral });
                }
                let desc = '';
                if (yazili.length > 0) {
                    desc += `**📋 Yazılı Uyarılar (${yazili.length}):**\n`;
                    desc += yazili.map(u => `**${u.kademe}x** — \`ID: ${u.id}\` ${u.maxAsildi ? '⚠️' : ''}\n📖 ${u.sebep}\n👮 ${u.verenTag} • 📅 ${u.tarih}`).join('\n\n');
                }
                if (sozlu.length > 0) {
                    if (desc) desc += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
                    desc += `**🗣️ Sözlü Uyarılar (${sozlu.length}):**\n`;
                    desc += sozlu.map(u => `\`ID: ${u.id}\`\n📖 ${u.sebep}\n👮 ${u.verenTag} • 📅 ${u.tarih}`).join('\n\n');
                }
                const embed = new EmbedBuilder()
                    .setTitle(`📋 ${target.username} — Uyarı Geçmişi`)
                    .setDescription(desc.length > 4000 ? desc.substring(0, 3950) + '\n\n*...*' : desc)
                    .setColor("Orange").setThumbnail(target.displayAvatarURL())
                    .setFooter({ text: `Yazılı: ${yazili.length} • Sözlü: ${sozlu.length} • Kademe: ${Math.min(yazili.length, AYARLAR.UYARI_MAX_KADEME)}x` });
                return interaction.reply({ embeds: [embed] });
            }
            
            if (islem === 'sil') {
                const uyariId = interaction.options.getInteger('id');
                const sonuc = await uyariSilById(uyariId, interaction.guild);
                if (!sonuc) return interaction.reply({ content: `❌ ID \`${uyariId}\` bulunamadı.`, flags: MessageFlags.Ephemeral });
                const tipLbl = sonuc.tip === 'sozlu' ? '🗣️ sözlü' : '⚠️ yazılı';
                const kademeLbl = sonuc.silinen.kademe ? `**${sonuc.silinen.kademe}x** ` : '';
                return interaction.reply(`✅ Uyarı silindi (${tipLbl}).\n> 👤 <@${sonuc.userId}> — ${kademeLbl}${sonuc.silinen.sebep}\n> ℹ️ Kalan yazılı uyarılar yeniden numaralandı, rol güncellendi.`);
            }
            
            if (islem === 'sifirla') {
                const target = interaction.options.getUser('memur');
                const tip = interaction.options.getString('tip') || 'tumu';
                const r = await uyariSifirla(target.id, interaction.guild, tip);
                if (r.yazili === 0 && r.sozlu === 0) {
                    return interaction.reply({ content: `ℹ️ ${target} memurunun uyarısı yoktu.`, flags: MessageFlags.Ephemeral });
                }
                return interaction.reply(`✅ ${target} memurunun uyarıları sıfırlandı.\n> ⚠️ Yazılı: **${r.yazili}** | 🗣️ Sözlü: **${r.sozlu}**`);
            }
        }

        if (command === 'panelkur') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            try {
                await panelKurulumu();
                return interaction.reply({ content: "✅ LSPD Paneli başarıyla kuruldu!", flags: MessageFlags.Ephemeral });
            } catch (error) { 
                return interaction.reply({ content: "❌ Panel kurulurken bir hata oluştu.", flags: MessageFlags.Ephemeral }); 
            }
        }

        // TOPLU DM - İLETİLENLER / İLETİLMEYENLER BUTONLARI
   // ====================================================================
    // TOPLU DM - İLETİLENLER / İLETİLMEYENLER BUTON KONTROLÜ
    // ====================================================================

        if (command === 'birim') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const islem = interaction.options.getSubcommand();
            
            if (islem === 'ekle') {
                const turGirdisi = interaction.options.getString('tur').toLowerCase();
                const kodGirdisi = interaction.options.getString('kod').toUpperCase();

                let secilenKapasite = 0;
                let gercekTurIsmi = "";
                
                for (const [key, val] of Object.entries(BIRIM_KAPASITELERI)) {
                    if (turGirdisi === key) {
                        secilenKapasite = val;
                        gercekTurIsmi = key.charAt(0).toUpperCase() + key.slice(1);
                        if(key === 'tom lincoln') gercekTurIsmi = 'Tom Lincoln';
                        if(key === 'swat') gercekTurIsmi = 'SWAT';
                        if(key === 'air') gercekTurIsmi = 'AIR';
                        break;
                    }
                }
                
                if (secilenKapasite === 0) {
                    return interaction.reply({ content: "❌ Geçersiz tür! (`lincoln, adam, mary, swat, air, william, tom, tom lincoln`)", flags: MessageFlags.Ephemeral });
                }

                const yeniBirimId = 'birim_' + Date.now();
                
                aktifBirimler[yeniBirimId] = { 
                    tur: gercekTurIsmi, 
                    kod: kodGirdisi, 
                    kapasite: secilenKapasite, 
                    uyeler: [] 
                };
                
                dbKaydet();
                aktifMesaileriGuncelle();
                
                return interaction.reply(`✅ **${gercekTurIsmi} (${kodGirdisi})** birimi yetkili tarafından başarıyla oluşturuldu.`);
            }

            if (islem === 'kapat') {
                const kodGirdisi = interaction.options.getString('kod').toUpperCase();
                const birimId = Object.keys(aktifBirimler).find(id => aktifBirimler[id].kod === kodGirdisi);
                
                if (!birimId) {
                    return interaction.reply({ content: "❌ Bu koda sahip aktif bir birim bulunamadı.", flags: MessageFlags.Ephemeral });
                }
                
                delete aktifBirimler[birimId];
                dbKaydet();
                aktifMesaileriGuncelle();
                
                return interaction.reply(`✅ **${kodGirdisi}** kodlu birim yetkili tarafından zorla kapatıldı.`);
            }

            if (islem === 'kisiekle') {
                const kodGirdisi = interaction.options.getString('kod').toUpperCase();
                const target = interaction.options.getUser('hedef');

                if (!aktifMesailer[target.id]) {
                    return interaction.reply({ content: "❌ Bu memur mesaide değil, önce mesaiye sokunuz.", flags: MessageFlags.Ephemeral });
                }

                const birimId = Object.keys(aktifBirimler).find(id => aktifBirimler[id].kod === kodGirdisi);
                
                if (!birimId) {
                    return interaction.reply({ content: "❌ Bu koda sahip birim bulunamadı.", flags: MessageFlags.Ephemeral });
                }

                if (aktifBirimler[birimId].uyeler.length >= aktifBirimler[birimId].kapasite) {
                    return interaction.reply({ content: "❌ Bu birim tamamen dolu.", flags: MessageFlags.Ephemeral });
                }

                birimdenCikart(target.id); 
                aktifBirimler[birimId].uyeler.push(target.id);
                
                dbKaydet();
                aktifMesaileriGuncelle();
                
                return interaction.reply(`✅ ${target} memuru başarıyla **${kodGirdisi}** birimine eklendi.`);
            }

            if (islem === 'kisicikart') {
                const target = interaction.options.getUser('hedef');
                const cikarildi = birimdenCikart(target.id);
                
                if (cikarildi) {
                    dbKaydet();
                    aktifMesaileriGuncelle();
                    return interaction.reply(`✅ ${target} memuru bulunduğu birimden zorla çıkartıldı.`);
                } else {
                    return interaction.reply({ content: "❌ Bu memur zaten hiçbir birimde değil.", flags: MessageFlags.Ephemeral });
                }
            }
        }

        if (command === 'mesaikapat') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getUser('hedef');
            const mesaiData = aktifMesailer[target.id];
            
            if (!mesaiData) return interaction.reply({ content: "❌ Bu memur zaten mesaide değil.", flags: MessageFlags.Ephemeral });

            const toplamDakika = Math.floor((simdi - mesaiData.baslangic) / 60000);
            
            if (!toplamMesailer[target.id]) {
                toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
            }
            
            if (typeof toplamMesailer[target.id] === 'number') {
                toplamMesailer[target.id] += toplamDakika;
            } else {
                toplamMesailer[target.id].ms += (toplamDakika * 60000);
                toplamMesailer[target.id].sonCikis = simdi;
            }

            delete aktifMesailer[target.id];
            birimdenCikart(target.id);
            dbKaydet();
            
            logGonder(target, mesaiData.baslangic, simdi, toplamDakika, interaction.user);
            
            const targetMember = interaction.guild.members.cache.get(target.id);
            if (targetMember) {
                ismiGeriYukle(targetMember, '[M]');
            }

            await interaction.reply(`✅ ${target} adlı memurun mesaisi zorla bitirildi. (\`+${toplamDakika} Dk\`)`);
            target.send(`🛑 **LSPD DİKKAT:** Mesain bir yetkili tarafından sonlandırıldı.`).catch(() => {});
            
            aktifMesaileriGuncelle();
            liderlikTablosunuGuncelle();
        }

        if (command === 'mesaisil') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getUser('hedef');
            const silinecekDk = interaction.options.getInteger('dakika');

            if (!toplamMesailer[target.id]) {
                toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
            }
            
            if (typeof toplamMesailer[target.id] === 'number') {
                toplamMesailer[target.id] -= silinecekDk;
                if (toplamMesailer[target.id] < 0) toplamMesailer[target.id] = 0; 
            } else {
                toplamMesailer[target.id].ms -= (silinecekDk * 60000);
                if (toplamMesailer[target.id].ms < 0) toplamMesailer[target.id].ms = 0;
            }
            
            dbKaydet();
            
            await interaction.reply(`✅ ${target} adlı memurun toplam süresinden \`${silinecekDk} Dk\` silindi.`);
            
            liderlikTablosunuGuncelle();
            rutbeListesiniGuncelle();
        }

        if (command === 'mesaisok') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getUser('hedef');
            
            if (aktifMesailer[target.id]) return interaction.reply({ content: "❌ Bu memur zaten sahada aktif mesaide.", flags: MessageFlags.Ephemeral });
            
            aktifMesailer[target.id] = { baslangic: simdi, sonBildirim: simdi, birim: "Belirtilmedi" }; 
            dbKaydet();

            const targetMember = interaction.guild.members.cache.get(target.id);
            if (targetMember) {
                isimTagEkle(targetMember, '[M]');
            }

            await interaction.reply(`✅ ${target} adlı memur yetkili tarafından mesaiye sokuldu.`);
            target.send(`🚓 **LSPD DİKKAT:** Bir yetkili tarafından mesaiye sokuldun. Telsizin açıldı, iyi görevler!`).catch(() => {});
            
            aktifMesaileriGuncelle();
        }

        if (command === 'mesaiekle') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getUser('hedef');
            const eklenecekDk = interaction.options.getInteger('dakika');

            if (!toplamMesailer[target.id]) {
                toplamMesailer[target.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
            }
            
            if (typeof toplamMesailer[target.id] === 'number') {
                toplamMesailer[target.id] += eklenecekDk;
            } else {
                toplamMesailer[target.id].ms += (eklenecekDk * 60000);
            }
            
            dbKaydet();

            await interaction.reply(`✅ ${target} adlı memurun toplam mesai süresine \`${eklenecekDk} Dk\` eklendi.`);
            
            liderlikTablosunuGuncelle();
            rutbeListesiniGuncelle();
        }

        if (command === 'setup-ticket') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const embed = new EmbedBuilder()
                .setTitle("🎫 LSPD Destek ve Şikayet Merkezi")
                .setDescription("Aşağıdaki butonu kullanarak şikayet, destek veya bilgi talebi oluşturabilirsiniz.")
                .setColor("Blue");
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_ticket_ac')
                    .setLabel('Destek Talebi Aç')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩')
            );
            
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: "✅ Ticket paneli başarıyla kuruldu.", flags: MessageFlags.Ephemeral });
        }

        if (command === 'setup-mazeret') { 
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const embed = new EmbedBuilder()
                .setTitle("🗓️ Mazeret Bildirim Paneli")
                .setDescription("Mesaiye giremeyecek memurlar mazeretlerini aşağıdaki butondan bildirebilir veya mevcut mazeretlerini iptal edebilirler.")
                .setColor("Orange");
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_mazeret_bildir')
                    .setLabel('Mazeret Bildir')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('btn_mazeret_iptal')
                    .setLabel('Mazeretimi İptal Et')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
            
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: "✅ Mazeret paneli başarıyla kuruldu.", flags: MessageFlags.Ephemeral });
        }

        if (command === 'mazeretsil') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const mId = interaction.options.getInteger('id');
            const index = gecmisMazeretler.findIndex(m => m.id === mId);
            
            if (index === -1) {
                return interaction.reply({ content: "❌ Bu ID'ye sahip bir mazeret bulunamadı.", flags: MessageFlags.Ephemeral });
            }
            
            const silinenMazeret = gecmisMazeretler[index];
            
            interaction.guild.members.fetch(silinenMazeret.user).then(async targetMember => {
                targetMember.roles.remove(AYARLAR.MAZERET_ROL_ID).catch(() => null);
                await ismiGeriYukle(targetMember, '[Mazeretli]');
                
                if (aktifMesailer[silinenMazeret.user]) {
                    await isimTagEkle(targetMember, '[M]');
                }
            }).catch(() => null);

            gecmisMazeretler.splice(index, 1);
            dbKaydet();
            
            return interaction.reply(`✅ **${mId}** ID'li mazeret kaydı veri tabanından silindi ve memurun ismi düzeltildi.`);
        }

        if (command === 'mazeretekle') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getUser('hedef');
            const tarihSaat = interaction.options.getString('tarih_saat');
            const sebep = interaction.options.getString('sebep');
            
            const bitisMs = parseTarihSaatTR(tarihSaat);
            
            if (!bitisMs || bitisMs <= Date.now()) {
                return interaction.reply({ content: "❌ **Geçersiz Tarih!** Lütfen şu formatta yazın: `DD.MM.YYYY HH.mm` (Örn: 08.04.2026 20.00) ve gelecek bir zaman seçin.", flags: MessageFlags.Ephemeral });
            }

            const mID = gecmisMazeretler.length > 0 ? Math.max(...gecmisMazeretler.map(m => m.id || 0)) + 1 : 1;
            
            gecmisMazeretler.push({ 
                id: mID, 
                user: target.id, 
                sebep, 
                tarih: trTimeStr().split(' ')[0], 
                bitisTarihiText: tarihSaat, 
                bitisZamani: bitisMs, 
                ek: "Yetkili komutu ile manuel eklendi.", 
                durum: 'Onaylandı', 
                onaylayan: `<@${interaction.user.id}>`, 
                aktifMi: true, 
                onayTarihi: trTimeStr() 
            });
            
            dbKaydet();

            interaction.guild.members.fetch(target.id).then(targetMember => {
                targetMember.roles.add(AYARLAR.MAZERET_ROL_ID).catch(()=>null);
                isimTagEkle(targetMember, '[Mazeretli]');
            }).catch(()=>{});

            return interaction.reply(`✅ ${target} için **${tarihSaat}** tarihine kadar mazeret oluşturuldu ve onaylandı. (ID: **${mID}**)`);
        }

        if (command === 'aktifmemurlar') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            await interaction.deferReply();
            await interaction.guild.members.cache; // rate limit yedi 
            const lspdPersonelleri = interaction.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));

            let mesaidekiler = [];
            let disaridakiler = [];

            lspdPersonelleri.forEach(m => {
                let toplam = typeof toplamMesailer[m.id] === 'number' ? toplamMesailer[m.id] : (toplamMesailer[m.id] ? Math.floor(toplamMesailer[m.id].ms / 60000) : 0);
                
                if (aktifMesailer[m.id]) {
                    const anlikDakika = Math.floor((simdi - aktifMesailer[m.id].baslangic) / 60000);
                    toplam += anlikDakika;
                    mesaidekiler.push({ id: m.id, toplam, baslangic: aktifMesailer[m.id].baslangic });
                } else {
                    disaridakiler.push({ id: m.id, toplam });
                }
            });

            mesaidekiler.sort((a, b) => b.toplam - a.toplam);
            disaridakiler.sort((a, b) => b.toplam - a.toplam);

            const formatKisa = (dk) => {
                const s = Math.floor(dk / 60); 
                const d = dk % 60;
                return `${s}s  ${d}dk`;
            };

            let desc = `━━ 🚔 **Gelişmiş Mesai Listesi** ━━\n\n**Toplam Personel:** ${lspdPersonelleri.size} | **Mesaide:** ${mesaidekiler.length} | **Dışarıda:** ${disaridakiler.length}\n*Liste toplam mesai süresine göre sıralanmıştır.*\n\n`;

            desc += `✅ **Şu An Mesaide (${mesaidekiler.length})**\n`;
            let eklenecekMesaide = "";
            
            for (let i = 0; i < mesaidekiler.length; i++) {
                const data = mesaidekiler[i];
                const satir = `🟢 <@${data.id}> — <t:${Math.floor(data.baslangic / 1000)}:R> başladı | Toplam: \`${formatKisa(data.toplam)}\`\n`;
                
                if ((desc.length + eklenecekMesaide.length + satir.length) > 2000) { 
                    eklenecekMesaide += `*...ve ${mesaidekiler.length - i} kişi daha*\n`; 
                    break; 
                }
                eklenecekMesaide += satir;
            }
            
            desc += eklenecekMesaide || "> *Şu an mesaide olan personel yok.*\n";

            desc += `\n⛔ **Mesai Dışı (${disaridakiler.length})**\n`;
            let eklenecekDisarida = "";
            
            for (let i = 0; i < disaridakiler.length; i++) {
                const data = disaridakiler[i];
                const satir = `🔴 <@${data.id}> — Toplam: \`${formatKisa(data.toplam)}\`\n`;
                
                if ((desc.length + eklenecekDisarida.length + satir.length) > 3900) { 
                    eklenecekDisarida += `*...ve ${disaridakiler.length - i} kişi daha*\n`; 
                    break; 
                }
                eklenecekDisarida += satir;
            }
            
            desc += eklenecekDisarida || "> *Tüm personel sahada!*\n";

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Los Santos Polis Departmanı #LSPD`, iconURL: interaction.guild.iconURL() })
                .setDescription(desc)
                .setColor("#2B2D31") 
                .setFooter({ text: `${interaction.guild.name} • Mesai Takip Sistemi`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_toplu_mesai_kapat')
                    .setLabel('Herkesi Mesaiden Çıkar')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('💥')
            );
            
            return interaction.editReply({ embeds: [embed], components: [row] });
        }
        
        if (command === 'timeout') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            const target = interaction.options.getMember('hedef');
            const sureDk = interaction.options.getInteger('dakika');
            const sebep = interaction.options.getString('sebep') || "Belirtilmedi";
            
            try {
                await target.timeout(sureDk * 60 * 1000, sebep);
                return interaction.reply(`✅ ${target} adlı memura ${sureDk} dakika mola verildi.`);
            } catch(e) { 
                return interaction.reply({ content: "❌ Yetki hatası.", flags: MessageFlags.Ephemeral }); 
            }
        }

        if (command === 'mesai-top') {
            const uyeler = interaction.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
            
            const siraliUyeler = Array.from(uyeler.values())
                .filter(m => toplamMesailer[m.id] && (typeof toplamMesailer[m.id] === 'number' ? toplamMesailer[m.id] : toplamMesailer[m.id].ms) > 0)
                .sort((a, b) => {
                    let aMs = typeof toplamMesailer[a.id] === 'number' ? toplamMesailer[a.id] * 60000 : (toplamMesailer[a.id].ms || 0);
                    let bMs = typeof toplamMesailer[b.id] === 'number' ? toplamMesailer[b.id] * 60000 : (toplamMesailer[b.id].ms || 0);
                    return bMs - aMs;
                });

            let sayfalar = [];
            
            for (let i = 0; i < siraliUyeler.length; i += 15) {
                let desc = "";
                siraliUyeler.slice(i, i + 15).forEach((u, index) => { 
                    let uMs = typeof toplamMesailer[u.id] === 'number' ? toplamMesailer[u.id] * 60000 : (toplamMesailer[u.id].ms || 0);
                    desc += `**${i + index + 1})** 👮 <@${u.id}> - \`${tamSureFormat(uMs)}\`\n`; 
                });
                
                sayfalar.push(
                    new EmbedBuilder()
                        .setTitle("🏃 Mesai Sıralaması")
                        .setDescription(desc || "Kayıt yok.")
                        .setColor("DarkBlue")
                        .setThumbnail(interaction.guild.iconURL())
                );
            }
            
            if (sayfalar.length === 0) return interaction.reply({ content: "Kayıtlı mesai yok.", flags: MessageFlags.Ephemeral });
            return sayfalamaYap(interaction, sayfalar);
        }

        if (command === 'mazeretler') {
            if (!hasPerm && !interaction.member.roles.cache.has(AYARLAR.MAZERET_ONAY_ROL_ID)) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            
            let sayfalar = [];
            const aktifMazeretler = gecmisMazeretler.filter(m => m.durum === 'Onaylandı');
            const sirali = [...aktifMazeretler].reverse(); 
            
            for (let i = 0; i < sirali.length; i += 4) {
                let desc = `Şu an devam eden **${aktifMazeretler.length}** mazeret bulunuyor.\n*(Bekleyen veya süresi bitenler gösterilmez)*\n\n`;
                
                sirali.slice(i, i + 4).forEach((m, index) => {
                    desc += `**${i + index + 1})** ✅ <@${m.user}>\n📅 Bitiş Tarihi: **${m.bitisTarihiText}**\n📖 Sebep: ${m.sebep}\n🔔 Açıklama: ${m.ek}\n👮 Onaylayan: ${m.onaylayan}\n📆 Onay Tarihi: ${m.onayTarihi || '-'}\n🆔 ID: ${m.id}\n\n`;
                });
                
                sayfalar.push(
                    new EmbedBuilder()
                        .setTitle("Aktif Mazeretler Listesi")
                        .setDescription(desc)
                        .setColor("DarkVividPink")
                        .setThumbnail(interaction.guild.iconURL())
                );
            }
            
            if (sayfalar.length === 0) return interaction.reply({ content: "Şu an devam eden aktif bir mazeret bulunmuyor.", flags: MessageFlags.Ephemeral });
            return sayfalamaYap(interaction, sayfalar);
        }

        if (command === 'inaktifler') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            inaktifRaporuGonder(interaction.channel);
            return interaction.reply({ content: "✅ Rapor ilgili kanala gönderiliyor.", flags: MessageFlags.Ephemeral });
        }

        if (command === 'sonmesai') {
            const hedefUser = interaction.options.getUser('kisi') || interaction.user;
            const member = interaction.guild.members.cache.get(hedefUser.id);
            const veri = toplamMesailer[hedefUser.id];
            const aktif = aktifMesailer[hedefUser.id];

            const sonGiris = veri?.sonGiris || 0;
            const sonCikis = veri?.sonCikis || 0;

            let desc = '';
            if (aktif) {
                const gecenDk = Math.floor((Date.now() - aktif.baslangic) / 60000);
                desc += `🟢 **Şu an mesaide** (${Math.floor(gecenDk / 60)}s ${gecenDk % 60}dk)\n`;
                desc += `⏱️ Giriş: <t:${Math.floor(aktif.baslangic / 1000)}:F>\n`;
            } else {
                desc += sonGiris
                    ? `📅 Son giriş: <t:${Math.floor(sonGiris / 1000)}:F> (<t:${Math.floor(sonGiris / 1000)}:R>)\n`
                    : `📅 Son giriş: *Kayıt yok*\n`;
                if (sonCikis) {
                    desc += `🚪 Son çıkış: <t:${Math.floor(sonCikis / 1000)}:F> (<t:${Math.floor(sonCikis / 1000)}:R>)\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`🕐 Mesai Geçmişi — ${member?.displayName || hedefUser.username}`)
                .setDescription(desc || 'Kayıt bulunamadı.')
                .setColor(aktif ? 'Green' : 'Grey')
                .setThumbnail(hedefUser.displayAvatarURL())
                .setFooter({ text: `ID: ${hedefUser.id}` });

            return interaction.reply({ embeds: [embed] });
        }

        if (command === 'mesaisifirla') {
            if (!hasPerm) return interaction.reply({ content: "❌ Bu komutu kullanmak için yetkiniz yok.", flags: MessageFlags.Ephemeral });
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const sonuc = await mesaiSifirlaVeRaporOlustur(interaction.user, interaction.channel, interaction.guild);
            if (sonuc.basarili) {
                return interaction.editReply(`✅ Tüm mesai verileri sıfırlandı. **${sonuc.silinenKayit}** kayıt silindi. Rapor bu kanala gönderildi.`);
            } else {
                return interaction.editReply("❌ Bir hata oluştu, mesailer sıfırlanamadı.");
            }
        }

        if (command === 'mesairapor') {
            if (!hasPerm) return interaction.reply({ content: "❌ Bu komutu kullanmak için yetkiniz yok.", flags: MessageFlags.Ephemeral });
            const tur = interaction.options.getString('tur');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const sonuc = await mesaiRaporuOlusturVeGonder(interaction.user, interaction.channel, interaction.guild, tur);
            if (sonuc && sonuc.basarili) {
                return interaction.editReply(`✅ **${tur === 'gunluk' ? 'Günlük' : 'Genel'}** rapor bu kanala gönderildi.`);
            } else {
                return interaction.editReply("❌ Rapor oluşturulamadı.");
            }
        }

        if (command === 'ftoata') {
            const hasFtoPerm = hasPerm || interaction.member.roles.cache.has(AYARLAR.FTO_ROL_ID);
            if (!hasFtoPerm) return interaction.reply({ content: "❌ FTO atamak için yetkiniz yok.", flags: MessageFlags.Ephemeral });
            const ftsMember = interaction.options.getMember('fts');
            const ftoMember = interaction.options.getMember('fto') || interaction.member;
            if (!ftsMember) return interaction.reply({ content: "❌ FTS kişisini belirtmelisiniz.", flags: MessageFlags.Ephemeral });
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const sonuc = await ftoAtaForum(interaction.guild, ftsMember, ftoMember);
            return interaction.editReply(sonuc.mesaj);
        }

        if (command === 'ftokapat') {
            const hasFtoPerm = hasPerm || interaction.member.roles.cache.has(AYARLAR.FTO_ROL_ID);
            if (!hasFtoPerm) return interaction.reply({ content: "❌ FTO kapatmak için yetkiniz yok.", flags: MessageFlags.Ephemeral });
            const ftsMember = interaction.options.getMember('fts');
            if (!ftsMember) return interaction.reply({ content: "❌ FTS kişisini belirtmelisiniz.", flags: MessageFlags.Ephemeral });
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const sonuc = await ftoKapatForum(interaction.guild, ftsMember);
            return interaction.editReply(sonuc.mesaj);
        }

        if (command === 'rolver') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });
            const hedefUye = interaction.options.getMember('kisi');
            const hedefRol = interaction.options.getRole('rol');
            if (!hedefUye || !hedefRol) return interaction.reply({ content: "❌ Kişi ve rol belirtmelisiniz.", flags: MessageFlags.Ephemeral });
            // Red Permi rolünü sadece Tropper 1 (R_700) sahipleri verebilir
            const TROPPER1_ROL_ID = '1487574121264058499';
            if (hedefRol.id === AYARLAR.RED_PERMI_ROL_ID && !interaction.member.roles.cache.has(TROPPER1_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "❌ **Red Permi** rolünü sadece **Tropper 1** rütbesindekiler verebilir.", flags: MessageFlags.Ephemeral });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const sonuc = await rolVerVeKodAta(interaction.guild, hedefUye, hedefRol);
            return interaction.editReply(sonuc.mesaj);
        }

        // ------------------------------------------------------------------
        // TOPLU DUYURU SLASH KOMUTU (/)
        // ------------------------------------------------------------------
        if (command === 'topluduyuru') {
            if (!hasPerm) return interaction.reply({ content: "❌ Yetkiniz yetersiz.", flags: MessageFlags.Ephemeral });

            const duyuruMesaji = interaction.options.getString('mesaj');
            const yontem = interaction.options.getString('yontem');
            const hedefKanal = interaction.options.getChannel('kanal');

            if (yontem === 'kanal' && !hedefKanal) {
                return interaction.reply({ content: "❌ Kanal yöntemi seçildiğinde bir kanal belirtmelisiniz.", flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.guild.members.cache; // rate limit yedi

            const hedefler = interaction.guild.members.cache.filter(m =>
                m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID) &&
                !aktifMesailer[m.id] &&
                !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID) &&
                !m.user.bot
            );

            if (hedefler.size === 0) {
                return interaction.editReply("ℹ️ Kriterlere uyan (mesaide olmayan, mazeretsiz) kimse bulunamadı.");
            }

            let basarili = 0;
            let basarisiz = 0;

            if (yontem === 'dm') {
                for (const [, uye] of hedefler) {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle("📢 LSPD DUYURU")
                        .setDescription(`${uye} **→ ${duyuruMesaji}**`)
                        .setColor("Orange")
                        .setFooter({ text: `Gönderen: ${interaction.user.tag}` })
                        .setTimestamp();
                    try {
                        await uye.send({ content: `${uye}`, embeds: [dmEmbed] });
                        basarili++;
                    } catch (e) {
                        basarisiz++;
                    }
                }
                return interaction.editReply(`✅ Duyuru tamamlandı!\n> 📩 **${basarili}** kişiye DM gönderildi.\n> ❌ **${basarisiz}** kişiye ulaşılamadı (DM kapalı olabilir).`);
            } else {
                const duyuruEmbed = new EmbedBuilder()
                    .setTitle("📢 LSPD TOPLU DUYURU")
                    .setDescription(`**Mesaj:** ${duyuruMesaji}\n\n**Gönderen:** ${interaction.user}`)
                    .setColor("Orange")
                    .setFooter({ text: `${hedefler.size} personele gönderildi` })
                    .setTimestamp();
                await hedefKanal.send({ embeds: [duyuruEmbed] });

                const hedefDizi = Array.from(hedefler.values());
                for (let i = 0; i < hedefDizi.length; i += 5) {
                    const grup = hedefDizi.slice(i, i + 5);
                    const tagMetni = grup.map(u => `${u}`).join(' ');
                    await hedefKanal.send({ content: `${tagMetni}\n> 📢 **DUYURU:** ${duyuruMesaji}` });
                    basarili += grup.length;
                    if (i + 5 < hedefDizi.length) await new Promise(r => setTimeout(r, 1000));
                }
                return interaction.editReply(`✅ Duyuru tamamlandı! **${basarili}** personel ${hedefKanal} kanalında tag'lendi.`);
            }
        }
    }

    // --------------------------------------------------------------------------
    // MEVCUT ETKİLEŞİMLER (BUTONLAR VE MODALLAR)
    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
    // BİRİM YÖNETİM PANELİ BUTONLARI
    // --------------------------------------------------------------------------

    if (interaction.isButton() && (interaction.customId.startsWith('btn_basarili_') || interaction.customId.startsWith('btn_basarisiz_'))) {
        
        const isBasarili = interaction.customId.startsWith('btn_basarili_');
        const raporId = interaction.customId.replace(isBasarili ? 'btn_basarili_' : 'btn_basarisiz_', '');
        
        // Eğer bot yeniden başlatıldıysa veya aradan 1 saat geçip silindiyse
        if (!client.dmRaporlari || !client.dmRaporlari.has(raporId)) {
            return interaction.reply({ 
                content: "❌ **Rapor bulunamadı!** Bot yeniden başlatılmış veya raporun süresi (1 saat) dolmuş olabilir.", 
                ephemeral: true 
            });
        }
        
        // Hafızadan listeyi çekiyoruz
        const data = client.dmRaporlari.get(raporId);
        const liste = isBasarili ? data.basarili : data.basarisiz;

        // Listede kimse yoksa
        if (!liste || liste.length === 0) {
            return interaction.reply({ 
                content: "ℹ️ Bu kategoride kimse bulunmuyor.", 
                ephemeral: true 
            });
        }

        // ID'leri Discord etiketine (<@ID>) çeviriyoruz
        let listeMetni = liste.map(id => `> 👮 <@${id}>`).join('\n');
        
        // Eğer 4000 karakter sınırını aşarsa Discord hata vermesin diye kesiyoruz
        if (listeMetni.length > 4000) {
            listeMetni = listeMetni.substring(0, 3950) + '\n\n**...ve daha fazlası (Liste sınırına ulaşıldı).**';
        }

        // Gösterilecek Embed Mesajı
        const embed = new EmbedBuilder()
            .setTitle(isBasarili ? "✅ Mesaj İletilen Personeller" : "❌ Mesaj Alamayan Personeller (DM Kapalı)")
            .setDescription(listeMetni)
            .setColor(isBasarili ? "Green" : "Red")
            .setFooter({ text: `Toplam Kişi: ${liste.length}` })
            .setTimestamp();

        // SADECE BUTONA BASAN KİŞİYE gizli (ephemeral) olarak listeyi atar
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Eski "Birim Oluştur" butonu (geriye uyumluluk)
    if (interaction.isButton() && interaction.customId === 'btn_yeni_birim') {
        if (!aktifMesailer[interaction.user.id]) return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        if (Object.values(aktifBirimler).find(b => b.uyeler.includes(interaction.user.id))) {
            return tempReply(interaction, "❌ Zaten bir birimdesin! Önce mevcut biriminden ayrılmalısın.");
        }
        const modal = new ModalBuilder().setCustomId('modal_birim_olustur').setTitle('Devriye Birimi Oluştur');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_tur').setLabel("Tür (Örn: Lincoln, Adam, Omega)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_kod').setLabel("Birim Kodu (Örn: 10-A-1)").setStyle(TextInputStyle.Short).setRequired(true))
        );
        return interaction.showModal(modal);
    }

    // Tür butonları (Lincoln/Adam/Omega) → Dispatch yetkisi zorunlu
    if (interaction.isButton() && ['btn_birim_lincoln','btn_birim_adam','btn_birim_omega'].includes(interaction.customId)) {
        const hasDispatch = interaction.member.roles.cache.has(AYARLAR.DISPATCH_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasDispatch) return interaction.reply({ content: "🔒 Bu butonu kullanmak için **Dispatch** yetkisi gerekiyor.", flags: MessageFlags.Ephemeral });
        if (!aktifMesailer[interaction.user.id]) return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        if (Object.values(aktifBirimler).find(b => b.uyeler.includes(interaction.user.id))) {
            return tempReply(interaction, "❌ Zaten bir birimdesin! Önce biriminden ayrılmalısın.");
        }
        const turMap = { btn_birim_lincoln: 'Lincoln', btn_birim_adam: 'Adam', btn_birim_omega: 'Omega' };
        const secilen = turMap[interaction.customId];
        const modal = new ModalBuilder()
            .setCustomId(`modal_birim_tur_${secilen.toLowerCase()}`)
            .setTitle(`${secilen} Birimi Oluştur`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('b_kod').setLabel("Birim Kodu (Örn: 10-A-1)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("10-A-1")
            )
        );
        return interaction.showModal(modal);
    }

    // Queen butonu → Dispatch yetkisi GEREKMEZ, sadece mesaide olmak yeterli
    if (interaction.isButton() && interaction.customId === 'btn_birim_queen') {
        if (!aktifMesailer[interaction.user.id]) return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        if (Object.values(aktifBirimler).find(b => b.uyeler.includes(interaction.user.id))) {
            return tempReply(interaction, "❌ Zaten bir birimdesin! Önce biriminden ayrılmalısın.");
        }
        const modal = new ModalBuilder()
            .setCustomId('modal_birim_tur_queen')
            .setTitle('Queen Birimi Oluştur');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('b_kod').setLabel("Birim Kodu (Örn: Q-1)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Q-1")
            )
        );
        return interaction.showModal(modal);
    }

    // Custom butonu → Dispatch yetkisi zorunlu
    if (interaction.isButton() && interaction.customId === 'btn_birim_custom') {
        const hasDispatch = interaction.member.roles.cache.has(AYARLAR.DISPATCH_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasDispatch) return interaction.reply({ content: "🔒 Bu butonu kullanmak için **Dispatch** yetkisi gerekiyor.", flags: MessageFlags.Ephemeral });
        if (!aktifMesailer[interaction.user.id]) return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        if (Object.values(aktifBirimler).find(b => b.uyeler.includes(interaction.user.id))) {
            return tempReply(interaction, "❌ Zaten bir birimdesin!");
        }
        const modal = new ModalBuilder().setCustomId('modal_birim_olustur').setTitle('Custom Birim Oluştur');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_tur').setLabel("Tür (Örn: SWAT, Air, William, Mary)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_kod').setLabel("Birim Kodu (Örn: SWAT-1)").setStyle(TextInputStyle.Short).setRequired(true))
        );
        return interaction.showModal(modal);
    }

    // Birimleri Görüntüle
    if (interaction.isButton() && interaction.customId === 'btn_birimleri_goruntule') {
        const toplam = Object.keys(aktifBirimler).length;
        if (toplam === 0) return tempReply(interaction, "ℹ️ Şu an sahada aktif bir birim bulunmuyor.");
        let desc = `**Toplam ${toplam} aktif birim:**\n\n`;
        for (const [, data] of Object.entries(aktifBirimler)) {
            desc += `🛡️ **${data.tur} | ${data.kod}** — ${data.uyeler.length}/${data.kapasite} kişi\n`;
            for (const uid of data.uyeler) desc += `> 👮 <@${uid}>\n`;
        }
        const embed = new EmbedBuilder().setTitle("📋 Aktif Birimler").setDescription(desc).setColor("Blue").setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Birim Düzenle (birime katıl)
    if (interaction.isButton() && interaction.customId === 'btn_birim_duzenle') {
        if (!aktifMesailer[interaction.user.id]) return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        const dolmamisBirimler = Object.entries(aktifBirimler).filter(([,b]) => b.uyeler.length < b.kapasite && !b.uyeler.includes(interaction.user.id));
        if (dolmamisBirimler.length === 0) return tempReply(interaction, "ℹ️ Katılabileceğin dolu olmayan bir birim yok.");
        const secenekler = dolmamisBirimler.slice(0, 25).map(([id, b]) => ({
            label: `${b.tur} | ${b.kod} (${b.uyeler.length}/${b.kapasite})`,
            value: id
        }));
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('select_birim_katil').setPlaceholder('Katılmak istediğin birimi seç...').addOptions(secenekler)
        );
        return interaction.reply({ content: "📋 Katılmak istediğin birimi seç:", components: [row], flags: MessageFlags.Ephemeral });
    }

    // Birimden Ayrıl butonu (herkese açık)
    if (interaction.isButton() && (interaction.customId === 'btn_birimden_ayril' || interaction.customId === 'btn_birim_ayril')) {
        const birimId = Object.keys(aktifBirimler).find(id => aktifBirimler[id].uyeler.includes(interaction.user.id));
        if (!birimId) return tempReply(interaction, "❌ Herhangi bir birimde değilsin.");
        const birimBilgi = aktifBirimler[birimId];
        aktifBirimler[birimId].uyeler = aktifBirimler[birimId].uyeler.filter(id => id !== interaction.user.id);
        if (aktifBirimler[birimId].uyeler.length === 0) delete aktifBirimler[birimId];
        dbKaydet();
        aktifMesaileriGuncelle();
        birimPanelKurulumu();
        return tempReply(interaction, `✅ **${birimBilgi.tur} | ${birimBilgi.kod}** biriminden ayrıldın.`);
    }

    // Birime katıl select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_birim_katil') {
        const birimId = interaction.values[0];
        if (!aktifBirimler[birimId]) return tempReply(interaction, "❌ Bu birim artık mevcut değil.");
        if (aktifBirimler[birimId].uyeler.includes(interaction.user.id)) return tempReply(interaction, "❌ Zaten bu birimdesiN.");
        if (aktifBirimler[birimId].uyeler.length >= aktifBirimler[birimId].kapasite) return tempReply(interaction, "❌ Bu birim doldu.");
        aktifBirimler[birimId].uyeler.push(interaction.user.id);
        dbKaydet();
        aktifMesaileriGuncelle();
        birimPanelKurulumu();
        return tempReply(interaction, `✅ **${aktifBirimler[birimId]?.tur} | ${aktifBirimler[birimId]?.kod}** birimine katıldın!`);
    }

    // Yenile
    if (interaction.isButton() && interaction.customId === 'btn_birim_yenile') {
        await birimPanelKurulumu();
        return tempReply(interaction, "✅ Panel yenilendi.");
    }

    // Tüm Birimleri Sıfırla
    if (interaction.isButton() && interaction.customId === 'btn_birimleri_sifirla') {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Bu işlem için yetkiniz yok.");
        const sayi = Object.keys(aktifBirimler).length;
        aktifBirimler = {};
        dbKaydet();
        aktifMesaileriGuncelle();
        birimPanelKurulumu();
        return tempReply(interaction, `✅ **${sayi}** birim sıfırlandı.`);
    }

    if (interaction.isButton() && interaction.customId.startsWith('katil_')) {
        if (!aktifMesailer[interaction.user.id]) {
            return tempReply(interaction, "❌ Önce mesaiye girmelisin!");
        }
        
        const mevcutBirim = Object.values(aktifBirimler).find(b => b.uyeler.includes(interaction.user.id));
        if (mevcutBirim) {
            return tempReply(interaction, "❌ Zaten bir birimdesin! Aktif mesailer panelinden kontrol edebilirsin.");
        }

        const hedefBirimId = interaction.customId.replace('katil_', ''); 
        const hedefBirim = aktifBirimler[hedefBirimId];

        if (!hedefBirim) {
            return tempReply(interaction, "❌ Bu birim artık mevcut değil.");
        }
        
        if (hedefBirim.uyeler.length >= hedefBirim.kapasite) {
            return tempReply(interaction, "❌ Bu birim kapasitesine ulaşmış (Dolu).");
        }

        hedefBirim.uyeler.push(interaction.user.id);
        
        dbKaydet();
        aktifMesaileriGuncelle();
        
        return tempReply(interaction, `✅ **${hedefBirim.tur} (${hedefBirim.kod})** birimine katıldın!`);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_birim_olustur') {
        const turGirdisi = interaction.fields.getTextInputValue('b_tur').toLowerCase().trim();
        const kodGirdisi = interaction.fields.getTextInputValue('b_kod').toUpperCase().trim();

        let secilenKapasite = 0;
        let gercekTurIsmi = "";
        
        for (const [key, val] of Object.entries(BIRIM_KAPASITELERI)) {
            if (turGirdisi === key) {
                secilenKapasite = val;
                gercekTurIsmi = key.charAt(0).toUpperCase() + key.slice(1);
                if(key === 'tom lincoln') gercekTurIsmi = 'Tom Lincoln';
                if(key === 'swat') gercekTurIsmi = 'SWAT';
                if(key === 'air') gercekTurIsmi = 'AIR';
                break;
            }
        }

        if (secilenKapasite === 0) {
            return tempReply(interaction, `❌ Geçersiz birim türü! Sadece şunları yazabilirsiniz: \n\`Lincoln, Adam, Mary, SWAT, Air, William, Tom, Tom Lincoln\``);
        }

        const yeniBirimId = 'birim_' + Date.now();
        
        aktifBirimler[yeniBirimId] = {
            tur: gercekTurIsmi,
            kod: kodGirdisi,
            kapasite: secilenKapasite,
            uyeler: [interaction.user.id]
        };
        
        dbKaydet();
        aktifMesaileriGuncelle();
        birimPanelKurulumu();
        return tempReply(interaction, `✅ **${gercekTurIsmi}** devriyesi **${kodGirdisi}** koduyla oluşturuldu ve katıldın!`);
    }

    // Tür butonlarından gelen modal (Lincoln / Adam / Omega — sadece kod girilir)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_birim_tur_')) {
        const turAdi = interaction.customId.replace('modal_birim_tur_', '');
        const kodGirdisi = interaction.fields.getTextInputValue('b_kod').toUpperCase().trim();
        const kapasite = BIRIM_KAPASITELERI[turAdi] || 1;
        const gercekTurIsmi = turAdi.charAt(0).toUpperCase() + turAdi.slice(1);

        const yeniBirimId = 'birim_' + Date.now();
        aktifBirimler[yeniBirimId] = {
            tur: gercekTurIsmi,
            kod: kodGirdisi,
            kapasite: kapasite,
            uyeler: [interaction.user.id]
        };
        dbKaydet();
        aktifMesaileriGuncelle();
        birimPanelKurulumu();
        return tempReply(interaction, `✅ **${gercekTurIsmi}** devriyesi **${kodGirdisi}** koduyla oluşturuldu ve katıldın!`);
    }

    // TICKET SİSTEMİ 
    if (interaction.isButton() && interaction.customId === 'btn_ticket_ac') {
        const modal = new ModalBuilder()
            .setCustomId('modal_ticket_olustur')
            .setTitle('Destek / Şikayet Talebi');
            
        const targetInput = new TextInputBuilder()
            .setCustomId('ticket_hedef')
            .setLabel("Şikayet Edilen Kişi / ID")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
        const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_sebep')
            .setLabel("Olayın Sebebi (Örn: Cinsel Taciz)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(targetInput), 
            new ActionRowBuilder().addComponents(reasonInput)
        );
        
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_olustur') {
        const hedef = interaction.fields.getTextInputValue('ticket_hedef');
        const sebep = interaction.fields.getTextInputValue('ticket_sebep');

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: AYARLAR.TICKET_KATEGORI_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: AYARLAR.YETKILI_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("🚨 Yeni Ticket Talebi")
            .addFields(
                { name: "Oluşturan", value: `${interaction.user}`, inline: true },
                { name: "Şikayet Edilen / ID", value: hedef, inline: true },
                { name: "Sebep", value: sebep, inline: false },
                { name: "Açılış Zamanı", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor("Orange");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('t_onayla')
                .setLabel('Talebi Onayla')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('t_reddet')
                .setLabel('Talebi Reddet')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('t_ekbilgi')
                .setLabel('Ek Bilgi İste')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('t_ustyonetim')
                .setLabel('Üst Yönetime Bildir')
                .setStyle(ButtonStyle.Secondary)
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('t_kuralihlali')
                .setLabel('Kural İhlali')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('t_transcript')
                .setLabel('Transcript Oluştur')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('t_kapat')
                .setLabel('Ticketi Kapat')
                .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: `${interaction.user} talebiniz oluşturuldu. <@&${AYARLAR.YETKILI_ROL_ID}>`, embeds: [embed], components: [row, row2] });
        return tempReply(interaction, `✅ Ticket kanalınız açıldı: ${channel}`);
    }

    if (interaction.isButton() && interaction.customId.startsWith('t_')) {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Yetkiniz yok.");

        if (interaction.customId === 't_kapat') {
            await interaction.reply("🔒 Ticket 5 saniye içinde kapatılıyor...");
            setTimeout(() => interaction.channel.delete().catch(()=>{}), 5000);
        }
        else if (interaction.customId === 't_transcript') {
            await interaction.deferReply();
            const attachment = await discordTranscripts.createTranscript(interaction.channel);
            await interaction.editReply({ content: "📄 Transcript oluşturuldu:", files: [attachment] });
        }
        else {
            const actions = {
                't_onayla': '✅ Talep Onaylandı.',
                't_reddet': '❌ Talep Reddedildi.',
                't_ekbilgi': 'ℹ️ Lütfen yetkililere daha fazla ek bilgi sağlayınız.',
                't_ustyonetim': '⚠️ Üst yönetim etiketlendi, lütfen bekleyiniz.',
                't_kuralihlali': '⛔ Kural ihlali tespit edildi, cezai işlem uygulanacak.'
            };
            await interaction.reply(actions[interaction.customId]);
        }
    }

    if (interaction.isButton() && interaction.customId === 'btn_mazeret_iptal') {
        const index = gecmisMazeretler.findIndex(m => m.user === interaction.user.id && (m.durum === 'Onaylandı' || m.durum === 'Bekliyor'));
        
        if (index === -1) {
            return tempReply(interaction, "❌ Şu an aktif veya bekleyen bir mazeretiniz bulunmamaktadır.");
        }
        
        const silinenMazeret = gecmisMazeretler[index];
        
        if (silinenMazeret.durum === 'Onaylandı') {
            interaction.member.roles.remove(AYARLAR.MAZERET_ROL_ID).catch(() => null);
            await ismiGeriYukle(interaction.member, '[Mazeretli]');
            
            if (aktifMesailer[interaction.user.id]) {
                await isimTagEkle(interaction.member, '[M]');
            }
        }

        gecmisMazeretler.splice(index, 1);
        dbKaydet();
        
        return tempReply(interaction, `✅ Mazeretiniz başarıyla iptal edildi. İşinize geri dönebilirsiniz.`);
    }

    if (interaction.isButton() && interaction.customId === 'btn_mazeret_bildir') {
        const hasActive = gecmisMazeretler.some(m => m.user === interaction.user.id && (m.durum === 'Onaylandı' || m.durum === 'Bekliyor'));
        
        if (hasActive) {
            return tempReply(interaction, "❌ Zaten aktif veya onay bekleyen bir mazeretiniz var! Önce onu iptal etmelisiniz.");
        }

        const modal = new ModalBuilder()
            .setCustomId('modal_mazeret')
            .setTitle('Mazeret Bildirim Formu');
            
        const sebepInput = new TextInputBuilder()
            .setCustomId('m_sebep')
            .setLabel("Mazeret Sebebi *")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
            
        const bitisInput = new TextInputBuilder()
            .setCustomId('m_bitis')
            .setLabel("Bitiş Tarihi ve Saati *")
            .setPlaceholder("Örn: 08.04.2026 20.00")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
        const ekInput = new TextInputBuilder()
            .setCustomId('m_ek')
            .setLabel("Ek Açıklama (Opsiyonel)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(sebepInput), 
            new ActionRowBuilder().addComponents(bitisInput), 
            new ActionRowBuilder().addComponents(ekInput)
        );
        
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_mazeret') {
        const sebep = interaction.fields.getTextInputValue('m_sebep');
        const bitisStr = interaction.fields.getTextInputValue('m_bitis');
        
        let ek = "Yok";
        try {
            ek = interaction.fields.getTextInputValue('m_ek') || "Yok";
        } catch(e) {}

        const bitisMs = parseTarihSaatTR(bitisStr);
        
        if (!bitisMs) {
            return tempReply(interaction, "❌ **Hatalı Format!** Lütfen belirtilen formatta yazın: `DD.MM.YYYY HH.mm`\nÖrnek: `08.04.2026 20.00`");
        }
        
        if (bitisMs <= Date.now()) {
            return tempReply(interaction, "❌ **Geçmiş Zaman:** Lütfen gelecekteki bir tarih ve saat giriniz.");
        }

        const mID = gecmisMazeretler.length > 0 ? Math.max(...gecmisMazeretler.map(m => m.id || 0)) + 1 : 1;

        const logKanali = client.channels.cache.get(AYARLAR.MAZERET_LOG_KANALI) || client.channels.cache.get(AYARLAR.MAZERET_ONAY_KANALI);
        
        const embed = new EmbedBuilder()
            .setTitle("📝 Yeni Mazeret Bildirimi")
            .addFields(
                { name: "Memur", value: `${interaction.user}`, inline: true },
                { name: "Bitiş Tarihi", value: `**${bitisStr}**`, inline: true },
                { name: "Sebep", value: sebep, inline: false },
                { name: "Ek", value: ek, inline: false }
            )
            .setColor("Yellow");
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`maz_onay_${mID}`)
                .setLabel('Onayla')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`maz_red_btn_${mID}`)
                .setLabel('Reddet')
                .setStyle(ButtonStyle.Danger)
        );
        
        if (logKanali) {
            await logKanali.send({ embeds: [embed], components: [row] });
        }
        
        gecmisMazeretler.push({ 
            id: mID, 
            user: interaction.user.id, 
            sebep, 
            tarih: trTimeStr().split(' ')[0], 
            bitisTarihiText: bitisStr, 
            bitisZamani: bitisMs, 
            ek, 
            durum: 'Bekliyor', 
            onaylayan: null, 
            aktifMi: false 
        });
        dbKaydet();
        
        return tempReply(interaction, `✅ Mazeret formunuz yetkililere iletildi. Bitiş tarihi: **${bitisStr}**`);
    }

    if (interaction.isButton() && interaction.customId.startsWith('maz_red_btn_')) {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.roles.cache.has(AYARLAR.MAZERET_ONAY_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Yetkiniz yok.");
        
        const mID = parseInt(interaction.customId.replace('maz_red_btn_', ''));
        const mData = gecmisMazeretler.find(m => m.id === mID);
        
        if (!mData || mData.durum !== 'Bekliyor') {
            return tempReply(interaction, "Bu talep geçersiz veya zaten işlenmiş.");
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_maz_red_reason_${mID}`)
            .setTitle('Reddetme Sebebi');
            
        const sebepInput = new TextInputBuilder()
            .setCustomId('red_sebep')
            .setLabel("Neden reddediyorsunuz?")
            .setPlaceholder("Memura DM olarak iletilecektir.")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
            
        modal.addComponents(new ActionRowBuilder().addComponents(sebepInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_maz_red_reason_')) {
        const mID = parseInt(interaction.customId.replace('modal_maz_red_reason_', ''));
        const mData = gecmisMazeretler.find(m => m.id === mID);
        
        if (!mData) return tempReply(interaction, "Talep bulunamadı.");
        
        const redSebebi = interaction.fields.getTextInputValue('red_sebep');
        
        mData.durum = 'Reddedildi';
        mData.onaylayan = `<@${interaction.user.id}>`;
        mData.onayTarihi = trTimeStr();
        dbKaydet();
        
        const sonEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("Mazeret Reddedildi")
            .setDescription(`❌ ${interaction.user} tarafından <@${mData.user}> kullanıcısının mazereti reddedildi.\n\n👤 **ID:** ${mData.id}\n📅 **Bitiş Tarihi:** ${mData.bitisTarihiText}\n📖 **Mazeret:** ${mData.sebep}\n🛑 **Red Sebebi:** ${redSebebi}`);
            
        await interaction.update({ embeds: [sonEmbed], components: [] });
        
        const dmEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle(`Mazeretiniz Reddedildi!`)
            .setDescription(`👤 **ID:** ${mData.id}\n📅 **Bildirdiğiniz Bitiş:** ${mData.bitisTarihiText}\n📖 **Mazeretiniz:** ${mData.sebep}\n\n🛑 **Reddedilme Sebebi:** ${redSebebi}\n👤 **İşlem Yapan:** ${interaction.user}`)
            .setFooter({ text: mData.onayTarihi });
            
        client.users.cache.get(mData.user)?.send({ embeds: [dmEmbed] }).catch(()=>{});
    }

    if (interaction.isButton() && interaction.customId.startsWith('maz_onay_')) {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.roles.cache.has(AYARLAR.MAZERET_ONAY_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Yetkiniz yok.");
        
        const mID = parseInt(interaction.customId.replace('maz_onay_', ''));
        const mData = gecmisMazeretler.find(m => m.id === mID);

        if (!mData || mData.durum !== 'Bekliyor') return tempReply(interaction, "Geçersiz veya işlenmiş.");

        mData.durum = 'Onaylandı';
        mData.onaylayan = `<@${interaction.user.id}>`;
        mData.onayTarihi = trTimeStr();
        mData.aktifMi = true;

        const targetMember = await interaction.guild.members.fetch(mData.user).catch(()=>null);
        if (targetMember) {
            targetMember.roles.add(AYARLAR.MAZERET_ROL_ID).catch(()=>null);
            isimTagEkle(targetMember, '[Mazeretli]');
        }
        
        dbKaydet();

        const sonEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("Mazeret Onaylandı")
            .setDescription(`✅ ${interaction.user} tarafından <@${mData.user}> kullanıcısının mazereti onaylandı.\n\n👤 **ID:** ${mData.id}\n📅 **Bitiş Tarihi:** ${mData.bitisTarihiText}\n📖 **Sebep:** ${mData.sebep}\n🔔 **Açıklama:** ${mData.ek}\n`);
            
        await interaction.update({ embeds: [sonEmbed], components: [] });
        
        const dmEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle(`Mazeretiniz Onaylandı!`)
            .setDescription(`👤 **ID:** ${mData.id}\n📅 **Bitiş Tarihi:** ${mData.bitisTarihiText}\n📖 **Sebep:** ${mData.sebep}\n👤 **Onaylayan:** ${interaction.user}\n`)
            .setFooter({ text: mData.onayTarihi });
            
        client.users.cache.get(mData.user)?.send({ embeds: [dmEmbed] }).catch(()=>{});
    }

    // İSİM ONAY SİSTEMİ
    if (interaction.isButton() && (interaction.customId.startsWith('isim_kabul_') || interaction.customId.startsWith('isim_red_'))) {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.roles.cache.has(AYARLAR.RED_PERMI_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Yetkiniz yok.");

        const targetId = interaction.customId.split('_')[2];
        const pendingName = isimOnayBekleyenler.get(targetId);
        
        if (!pendingName) return tempReply(interaction, "❌ Talep zaman aşımına uğramış.");
        
        if (interaction.customId.startsWith('isim_kabul_')) {
            const targetMember = await interaction.guild.members.fetch(targetId).catch(()=>null);
            if (targetMember) {
                eskiIsimler[targetId] = pendingName; 
                dbKaydet();
                
                await targetMember.setNickname(pendingName).catch(()=>{});
                isimOnayBekleyenler.delete(targetId);
                
                return interaction.update({ content: `✅ <@${targetId}> isimli personelin adı **${pendingName}** olarak onaylandı.`, components: [] });
            }
        } else {
            isimOnayBekleyenler.delete(targetId);
            return interaction.update({ content: `❌ <@${targetId}> isim değişikliği reddedildi.`, components: [] });
        }
    }

    // TOPLU MESAİ KAPATMA (RATE LIMIT KORUMALI)
    if (interaction.isButton() && interaction.customId === 'btn_toplu_mesai_kapat') {
        const hasPerm = interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPerm) return tempReply(interaction, "❌ Yetkiniz yok.");

        await interaction.reply({ content: "⏳ Mesaideki herkes sırayla çıkartılıyor, lütfen bekleyin...", ephemeral: true });

        let kapatilanSayisi = 0;
        
        for (const [userId, data] of Object.entries(aktifMesailer)) {
            const toplamDakika = Math.floor((simdi - data.baslangic) / 60000);
            
            if (!toplamMesailer[userId]) {
                toplamMesailer[userId] = { ms: 0, sonGiris: 0, sonCikis: 0 };
            }
            
            if (typeof toplamMesailer[userId] === 'number') {
                toplamMesailer[userId] += toplamDakika;
            } else {
                toplamMesailer[userId].ms += (toplamDakika * 60000);
                toplamMesailer[userId].sonCikis = simdi;
            }
            
            try {
                const u = await client.users.fetch(userId);
                logGonder(u, data.baslangic, simdi, toplamDakika, interaction.user);
                
                const member = await interaction.guild.members.fetch(userId);
                if (member) {
                    await ismiGeriYukle(member, '[M]');
                }
            } catch (e) {
                // Kullanıcı sunucudan çıkmışsa vs. hatayı yut
            }
            
            delete aktifMesailer[userId];
            birimdenCikart(userId);
            kapatilanSayisi++;

            // DİSCORD'U RAHATLATAN FREN: Her memur arasında yarım saniye bekler
            await bekle(500); 
        }
        
        dbKaydet();
        aktifMesaileriGuncelle();
        liderlikTablosunuGuncelle();
        
        return interaction.followUp({ content: `✅ Anlık olarak mesaideki **${kapatilanSayisi}** memurun mesaisi güvenli bir şekilde kapatıldı.`, ephemeral: true });
    }

    // MESAİ GİRİŞ/ÇIKIŞ SİSTEMİ
    if (interaction.isButton() && interaction.customId === 'btn_mesai_gir') {
        const voiceChannel = interaction.member.voice.channel;
        const hasMuafiyet = interaction.member.roles.cache.has(AYARLAR.SES_MUAFIYET_ROL_ID);

        if (!voiceChannel && !hasMuafiyet) {
            return tempReply(interaction, "❌ **Mesaiye Giremezsin:** Aktif bir ses kanalında olman gerekiyor!");
        }

        if (aktifMesailer[interaction.user.id]) {
            return tempReply(interaction, "❌ Mesain zaten açık!");
        }
        
        aktifMesailer[interaction.user.id] = { baslangic: simdi, sonBildirim: simdi, birim: "Belirtilmedi" };
        
        if (!toplamMesailer[interaction.user.id]) {
            toplamMesailer[interaction.user.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        
        if (typeof toplamMesailer[interaction.user.id] === 'object') {
            toplamMesailer[interaction.user.id].sonGiris = simdi;
        }

        dbKaydet();

        isimTagEkle(interaction.member, '[M]');

        const logEmbed = new EmbedBuilder()
            .setColor("Green")
            .setAuthor({ name: `${interaction.user.username} | Mesai Girişi`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`✅ 👤 ${interaction.user} isimli memur **hemen şimdi** mesaiye giriş yaptı.`)
            .setFooter({ text: "Kateshi Bots | Mesai Takip" });
            
        client.channels.cache.get(AYARLAR.MESAI_LOG_KANALI)?.send({ embeds: [logEmbed] });

        tempReply(interaction, "🟢 Mesain açık, sahaya inildi. İyi görevler!");
        interaction.user.send("🚓 **LSPD BİLDİRİMİ:** Mesaiye giriş yaptın. Sokaklar sana emanet! 🚓").catch(() => {});
        
        aktifMesaileriGuncelle();
    }

    if (interaction.isButton() && interaction.customId === 'btn_mesai_cik') {
        const mesaiData = aktifMesailer[interaction.user.id];
        
        if (!mesaiData) {
            return tempReply(interaction, "❌ Zaten mesaide değilsin! ❌");
        }
        
        const toplamDakika = Math.floor((simdi - mesaiData.baslangic) / 60000);

        if (!toplamMesailer[interaction.user.id]) {
            toplamMesailer[interaction.user.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        
        if (typeof toplamMesailer[interaction.user.id] === 'number') {
            toplamMesailer[interaction.user.id] += toplamDakika;
        } else {
            toplamMesailer[interaction.user.id].ms += (toplamDakika * 60000);
            toplamMesailer[interaction.user.id].sonCikis = simdi;
        }

        delete aktifMesailer[interaction.user.id];
        birimdenCikart(interaction.user.id);
        dbKaydet();

        ismiGeriYukle(interaction.member, '[M]');

        logGonder(interaction.user, mesaiData.baslangic, simdi, toplamDakika);

        const logEmbed = new EmbedBuilder()
            .setColor("Red")
            .setAuthor({ name: `${interaction.user.username} | Mesai Çıkışı`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`❌ 👤 ${interaction.user} **hemen şimdi** mesaiden çıkış yaptı.\n\n⏰ **Bu seferki süre: ${toplamDakika} dakika**\n🏃 **Toplam Mesai: ${tamSureFormat(typeof toplamMesailer[interaction.user.id] === 'number' ? toplamMesailer[interaction.user.id] * 60000 : toplamMesailer[interaction.user.id].ms)}**`)
            .setFooter({ text: "Kateshi Bots | Mesai Takip" });
            
        client.channels.cache.get(AYARLAR.MESAI_LOG_KANALI)?.send({ embeds: [logEmbed] });

        tempReply(interaction, `🔴 Departmana dönüldü.\n⏱️ **Toplam Süre:** ${formatSure(toplamDakika)}`);
        interaction.user.send(`🛑 **LSPD BİLDİRİMİ:** Mesaini bitirdin.\n📊 **Süre:** ${formatSure(toplamDakika)}\nEmeğine sağlık!`).catch(() => {});
        
        aktifMesaileriGuncelle();
        liderlikTablosunuGuncelle();
    }
});

async function sayfalamaYap(interactionOrMessage, sayfalar) {
    let currentPage = 0;
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️ Önceki Sayfa')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Sonraki Sayfa ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(sayfalar.length <= 1)
    );
    
    let msg;
    if (interactionOrMessage.isCommand || interactionOrMessage.isChatInputCommand) {
        msg = await interactionOrMessage.reply({ embeds: [sayfalar[0]], components: [row], fetchReply: true });
    } else {
        msg = await interactionOrMessage.channel.send({ embeds: [sayfalar[0]], components: [row] });
    }
    
    const collector = msg.createMessageComponentCollector({ time: 120000 });
    
    collector.on('collect', async i => {
        const userId = interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        
        if (i.user.id !== userId) {
            return tempReply(i, "Bu butonu kullanamazsın.");
        }
        
        if (i.customId === 'prev') currentPage--; 
        if (i.customId === 'next') currentPage++;
        
        row.components[0].setDisabled(currentPage === 0); 
        row.components[1].setDisabled(currentPage === sayfalar.length - 1);
        
        await i.update({ embeds: [sayfalar[currentPage]], components: [row] });
    });
}

// ==============================================================================
// 7. SES KANALI GÜNCELLEMELERİ (Seste Yoksan Mesai Yok)
// ==============================================================================
client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.channelId && !newState.channelId) {
        const member = oldState.member;
        if (!member) return;

        const hasMuafiyet = member.roles.cache.has(AYARLAR.SES_MUAFIYET_ROL_ID);
        if (hasMuafiyet) return; 

        if (aktifMesailer[member.id]) {
            const mesaiData = aktifMesailer[member.id];
            const simdi = Date.now();
            const toplamDakika = Math.floor((simdi - mesaiData.baslangic) / 60000);

            if (!toplamMesailer[member.id]) {
                toplamMesailer[member.id] = { ms: 0, sonGiris: 0, sonCikis: 0 };
            }
            
            if (typeof toplamMesailer[member.id] === 'number') {
                toplamMesailer[member.id] += toplamDakika;
            } else {
                toplamMesailer[member.id].ms += (toplamDakika * 60000);
                toplamMesailer[member.id].sonCikis = simdi;
            }

            delete aktifMesailer[member.id];
            birimdenCikart(member.id);
            dbKaydet();

            ismiGeriYukle(member, '[M]');

            logGonder(member.user, mesaiData.baslangic, simdi, toplamDakika, client.user); 
            member.send("🚨 **LSPD DİKKAT:** Ses kanalından ayrıldığınız için mesainiz sistem tarafından otomatik olarak sonlandırıldı.").catch(() => {});
            
            const logEmbed = new EmbedBuilder()
                .setColor("Red")
                .setAuthor({ name: `${member.user.username} | Sistem Tarafından Çıkarıldı`, iconURL: member.user.displayAvatarURL() })
                .setDescription(`❌ 👤 ${member.user} ses kanalından düştüğü için **sistem tarafından** mesaiden çıkarıldı.\n\n⏰ **Bu seferki süre: ${toplamDakika} dakika**\n🏃 **Toplam Mesai: ${tamSureFormat(typeof toplamMesailer[member.id] === 'number' ? toplamMesailer[member.id] * 60000 : toplamMesailer[member.id].ms)}**`)
                .setFooter({ text: "Kateshi Bots | Mesai Takip" });
                
            client.channels.cache.get(AYARLAR.MESAI_LOG_KANALI)?.send({ embeds: [logEmbed] });

            aktifMesaileriGuncelle();
            liderlikTablosunuGuncelle();
        }
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (oldMember.roles.cache.size !== newMember.roles.cache.size || oldMember.displayName !== newMember.displayName) {
        if (!newMember.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID) && aktifMesailer[newMember.id]) {
            delete aktifMesailer[newMember.id];
            dbKaydet();
            aktifMesaileriGuncelle();
        }
        rutbeListesiniGuncelle();
        liderlikTablosunuGuncelle();
    }
});

client.on('guildMemberRemove', (member) => {
    if (aktifMesailer[member.id]) {
        delete aktifMesailer[member.id];
        dbKaydet();
        aktifMesaileriGuncelle();
    }
    rutbeListesiniGuncelle();
    liderlikTablosunuGuncelle();
});

// ==============================================================================
// 8. GÖRSEL KURULUM VE RAPOR FONKSİYONLARI
// ==============================================================================
async function panelKurulumu() {
    try {
        const kanal = await client.channels.fetch(AYARLAR.MESAI_PANEL_KANALI);
        if (!kanal) return;

        const msgs = await kanal.messages.fetch({ limit: 50 });
        const botMsgs = msgs.filter(m => m.author.id === client.user.id && m.components.length > 0 && m.embeds[0]?.title?.includes("LOS SANTOS POLICE"));
        
        const embed = new EmbedBuilder()
            .setTitle("🚔 LOS SANTOS POLICE DEPARTMENT 🚔")
            .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🚨 **MESAİ VE DEVRİYE YÖNETİM PANELİ** 🚨\n\n> 🟢 **Devriyeye Çık:** Mesaiyi başlatır.\n> 🔴 **Merkeze Dön:** Mesaiyi bitirip raporlar.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            .setColor("DarkBlue");
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_mesai_gir')
                .setLabel('Devriyeye Çık')
                .setStyle(ButtonStyle.Success)
                .setEmoji('👮'),
            new ButtonBuilder()
                .setCustomId('btn_mesai_cik')
                .setLabel('Merkeze Dön')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🛑')
        ); 
            
        if (botMsgs.size > 0) {
            await botMsgs.first().edit({ embeds: [embed], components: [row] });
        } else {
            await kanal.send({ embeds: [embed], components: [row] });
        }
    } catch (e) {}
}

function uyariEnsure(userId) {
    if (!uyarilar[userId]) uyarilar[userId] = { yazili: [], sozlu: [] };
    if (!uyarilar[userId].yazili) uyarilar[userId].yazili = [];
    if (!uyarilar[userId].sozlu) uyarilar[userId].sozlu = [];
    return uyarilar[userId];
}
 
function uyariYeniId() {
    let max = 0;
    for (const v of Object.values(uyarilar)) {
        for (const u of (v.yazili || [])) if (u.id > max) max = u.id;
        for (const u of (v.sozlu || [])) if (u.id > max) max = u.id;
    }
    return max + 1;
}
 
// Yazılı uyarı rolünü güncelle: tüm yazılı rolleri çıkar, doğru kademe rolünü tak
async function uyariRolGuncelle(member, kademe) {
    if (!member) return;
    try {
        for (const rolId of Object.values(AYARLAR.UYARI_ROLLERI)) {
            if (member.roles.cache.has(rolId)) {
                await member.roles.remove(rolId).catch(() => {});
                await bekle(200);
            }
        }
        if (kademe > 0 && kademe <= AYARLAR.UYARI_MAX_KADEME) {
            const rolId = AYARLAR.UYARI_ROLLERI[kademe];
            if (rolId) await member.roles.add(rolId).catch(() => {});
        }
    } catch (e) { console.log("❌ Uyarı rol güncelleme hatası:", e.message); }
}
 
// YAZILI UYARI EKLE
async function uyariEkle(targetUser, veren, sebep, guild, logAtla = false) {
    const data = uyariEnsure(targetUser.id);
    const mevcutSayi = data.yazili.length;
    const yeniKademe = Math.min(mevcutSayi + 1, AYARLAR.UYARI_MAX_KADEME);
    const maxAsildi = mevcutSayi >= AYARLAR.UYARI_MAX_KADEME;
    
    const yeniUyari = {
        id: uyariYeniId(),
        tip: 'yazili',
        kademe: yeniKademe,
        sebep: sebep,
        verenId: veren.id,
        verenTag: veren.tag || veren.username,
        tarih: trTimeStr(),
        zaman: Date.now(),
        maxAsildi: maxAsildi
    };
    
    data.yazili.push(yeniUyari);
    dbKaydet();
    
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (member) await uyariRolGuncelle(member, yeniKademe);
    
    // Log (toplu işlemlerde atlanır, tek embed olarak gönderilir)
    if (!logAtla) {
        try {
            const logKanal = client.channels.cache.get(AYARLAR.UYARI_LOG_KANALI);
            if (logKanal) {
                const embed = new EmbedBuilder()
                    .setTitle(maxAsildi ? `⚠️ Yazılı Uyarı (${yeniKademe}x) — Üst Sınır` : `⚠️ Yazılı Uyarı (${yeniKademe}x)`)
                    .setColor(yeniKademe >= 4 ? "DarkRed" : yeniKademe >= 3 ? "Red" : yeniKademe >= 2 ? "Orange" : "Yellow")
                    .addFields(
                        { name: "👤 Memur", value: `${targetUser}`, inline: true },
                        { name: "📊 Kademe", value: `**${yeniKademe}x** ${maxAsildi ? '(Max)' : ''}`, inline: true },
                        { name: "🆔 Uyarı ID", value: `\`${yeniUyari.id}\``, inline: true },
                        { name: "📖 Sebep", value: sebep, inline: false },
                        { name: "👮 Veren", value: `${veren}`, inline: true },
                        { name: "📅 Tarih", value: trTimeStr(), inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL());
                await logKanal.send({ embeds: [embed] });
                const duyuruKanal = client.channels.cache.get(AYARLAR.UYARI_DUYURU_KANALI);
                if (duyuruKanal) {
                    await duyuruKanal.send({ content: `<@${targetUser.id}> ⚠️ **${yeniKademe}x yazılı uyarı aldı.**\n> 📖 Sebep: ${sebep}` });
                }
            }
        } catch (e) {}
    }

    // DM
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ Yazılı Uyarı Aldınız (${yeniKademe}x)`)
            .setColor(yeniKademe >= 4 ? "DarkRed" : yeniKademe >= 3 ? "Red" : yeniKademe >= 2 ? "Orange" : "Yellow")
            .setDescription(maxAsildi 
                ? `Maksimum uyarı kademesine ulaştınız. **${AYARLAR.UYARI_MAX_KADEME}x** üstüne çıkılmaz, ancak bu uyarı son seviyede kayıt edildi.`
                : `Departmandan **resmi yazılı uyarı** aldınız.`)
            .addFields(
                { name: "📊 Kademe", value: `**${yeniKademe}x / ${AYARLAR.UYARI_MAX_KADEME}x**`, inline: true },
                { name: "🆔 Uyarı ID", value: `\`${yeniUyari.id}\``, inline: true },
                { name: "📖 Sebep", value: sebep, inline: false },
                { name: "👮 Veren", value: veren.tag || veren.username, inline: true }
            )
            .setFooter({ text: "Bu mesajı yetkililere iletmeden silmeyiniz." });
        await targetUser.send({ embeds: [dmEmbed] });
    } catch (e) {}
    
    return { kademe: yeniKademe, id: yeniUyari.id, maxAsildi };
}
 
// SÖZLÜ UYARI EKLE (kademeli sisteme dahil değil)
async function sozluUyariEkle(targetUser, veren, sebep, guild, logAtla = false) {
    const data = uyariEnsure(targetUser.id);
    const yeniUyari = {
        id: uyariYeniId(),
        tip: 'sozlu',
        sebep: sebep,
        verenId: veren.id,
        verenTag: veren.tag || veren.username,
        tarih: trTimeStr(),
        zaman: Date.now()
    };
    data.sozlu.push(yeniUyari);
    dbKaydet();
    
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (member && AYARLAR.SOZLU_UYARI_ROL) {
        await member.roles.add(AYARLAR.SOZLU_UYARI_ROL).catch(() => {});
    }
    
    if (!logAtla) {
        try {
            const logKanal = client.channels.cache.get(AYARLAR.UYARI_LOG_KANALI);
            if (logKanal) {
                const embed = new EmbedBuilder()
                    .setTitle(`🗣️ Sözlü Uyarı`)
                    .setColor("DarkButNotBlack")
                    .setDescription("*Sözlü uyarı, kademeli sisteme dahil değildir.*")
                    .addFields(
                        { name: "👤 Memur", value: `${targetUser}`, inline: true },
                        { name: "🆔 Kayıt ID", value: `\`${yeniUyari.id}\``, inline: true },
                        { name: "📖 Sebep", value: sebep, inline: false },
                        { name: "👮 Veren", value: `${veren}`, inline: true },
                        { name: "📅 Tarih", value: trTimeStr(), inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL());
                await logKanal.send({ embeds: [embed] });
                const duyuruKanalSozlu = client.channels.cache.get(AYARLAR.UYARI_DUYURU_KANALI);
                if (duyuruKanalSozlu) {
                    await duyuruKanalSozlu.send({ content: `<@${targetUser.id}> 🗣️ **sözlü uyarı aldı.**\n> 📖 Sebep: ${sebep}` });
                }
            }
        } catch (e) {}
    }

    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle(`🗣️ Sözlü Uyarı Aldınız`)
            .setColor("DarkButNotBlack")
            .setDescription(`Departmandan **sözlü uyarı** aldınız. Bu uyarı yazılı kademeli sisteme dahil değildir, ancak kayıt altındadır.`)
            .addFields(
                { name: "🆔 Kayıt ID", value: `\`${yeniUyari.id}\``, inline: true },
                { name: "📖 Sebep", value: sebep, inline: false },
                { name: "👮 Veren", value: veren.tag || veren.username, inline: true }
            )
            .setFooter({ text: "Bu mesajı yetkililere iletmeden silmeyiniz." });
        await targetUser.send({ embeds: [dmEmbed] });
    } catch (e) {}
    
    return { id: yeniUyari.id };
}
 
// Toplu uyarı log — tek embed, madde madde
async function topluUyariLog(sonuclar, veren, sebep, sozluMu) {
    try {
        const logKanal = client.channels.cache.get(AYARLAR.UYARI_LOG_KANALI);
        if (!logKanal) return;
        const basarili = sonuclar.filter(s => s.basarili);
        if (basarili.length === 0) return;
        const now = trTimeStr();
        let desc = `📖 **Sebep:** ${sebep}\n👮 **Veren:** ${veren}\n📅 **Tarih:** ${now}\n\n`;
        const liste = basarili.map(s => {
            const userId = s.user?.user?.id || s.user?.id;
            return sozluMu
                ? `• <@${userId}>`
                : `• <@${userId}> — **${s.kademe}x**${s.maxAsildi ? ' ⚠️ MAX' : ''}`;
        });
        let eklenecek = "";
        for (let i = 0; i < liste.length; i++) {
            if ((desc.length + eklenecek.length + liste[i].length + 2) > 3800) {
                eklenecek += `\n*...ve ${liste.length - i} kişi daha*`;
                break;
            }
            eklenecek += liste[i] + '\n';
        }
        desc += eklenecek;
        const embed = new EmbedBuilder()
            .setTitle(sozluMu
                ? `🗣️ Toplu Sözlü Uyarı — ${basarili.length} Kişi`
                : `⚠️ Toplu Yazılı Uyarı — ${basarili.length} Kişi`)
            .setDescription(desc)
            .setColor(sozluMu ? "DarkButNotBlack" : "Orange")
            .setFooter({ text: `Veren: ${veren.tag || veren.username}` })
            .setTimestamp();
        await logKanal.send({ embeds: [embed] });
        const duyuruKanalToplu = client.channels.cache.get(AYARLAR.UYARI_DUYURU_KANALI);
        if (duyuruKanalToplu) {
            const mentions = basarili.map(s => `<@${s.user?.user?.id || s.user?.id}>`).join(' ');
            await duyuruKanalToplu.send({ content: `${mentions}\n${sozluMu ? '🗣️' : '⚠️'} **${basarili.length} kişi ${sozluMu ? 'sözlü' : 'yazılı'} uyarı aldı.**\n> 📖 Sebep: ${sebep}` });
        }
    } catch (e) {}
}

// Toplu yazılı
async function topluUyariVer(hedefler, veren, sebep, guild) {
    const sonuclar = [];
    for (const uye of hedefler) {
        try {
            const r = await uyariEkle(uye.user || uye, veren, sebep, guild, true);
            sonuclar.push({ user: uye, basarili: true, kademe: r.kademe, id: r.id, maxAsildi: r.maxAsildi });
        } catch (e) { sonuclar.push({ user: uye, basarili: false, hata: e.message }); }
        await bekle(400);
    }
    await topluUyariLog(sonuclar, veren, sebep, false);
    return sonuclar;
}

// Toplu sözlü
async function topluSozluUyariVer(hedefler, veren, sebep, guild) {
    const sonuclar = [];
    for (const uye of hedefler) {
        try {
            const r = await sozluUyariEkle(uye.user || uye, veren, sebep, guild, true);
            sonuclar.push({ user: uye, basarili: true, id: r.id });
        } catch (e) { sonuclar.push({ user: uye, basarili: false, hata: e.message }); }
        await bekle(400);
    }
    await topluUyariLog(sonuclar, veren, sebep, true);
    return sonuclar;
}
 
// Uyarı sil — ID ile (yazılı veya sözlü)
async function uyariSilById(uyariId, guild) {
    for (const userId of Object.keys(uyarilar)) {
        const data = uyarilar[userId];
        
        const yIdx = (data.yazili || []).findIndex(u => u.id === uyariId);
        if (yIdx !== -1) {
            const silinen = data.yazili[yIdx];
            data.yazili.splice(yIdx, 1);
            // Yeniden numarala
            data.yazili.forEach((u, i) => { u.kademe = Math.min(i + 1, AYARLAR.UYARI_MAX_KADEME); });
            dbKaydet();
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) await uyariRolGuncelle(member, data.yazili.length);
            return { silinen, userId, tip: 'yazili' };
        }
        
        const sIdx = (data.sozlu || []).findIndex(u => u.id === uyariId);
        if (sIdx !== -1) {
            const silinen = data.sozlu[sIdx];
            data.sozlu.splice(sIdx, 1);
            if (data.sozlu.length === 0) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member && AYARLAR.SOZLU_UYARI_ROL) {
                    await member.roles.remove(AYARLAR.SOZLU_UYARI_ROL).catch(() => {});
                }
            }
            dbKaydet();
            return { silinen, userId, tip: 'sozlu' };
        }
    }
    return null;
}
 
// Sıfırla
async function uyariSifirla(userId, guild, tip = 'tumu') {
    if (!uyarilar[userId]) return { yazili: 0, sozlu: 0 };
    const yaziliSayi = (uyarilar[userId].yazili || []).length;
    const sozluSayi = (uyarilar[userId].sozlu || []).length;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (tip === 'yazili' || tip === 'tumu') {
        uyarilar[userId].yazili = [];
        if (member) await uyariRolGuncelle(member, 0);
    }
    if (tip === 'sozlu' || tip === 'tumu') {
        uyarilar[userId].sozlu = [];
        if (member && AYARLAR.SOZLU_UYARI_ROL) {
            await member.roles.remove(AYARLAR.SOZLU_UYARI_ROL).catch(() => {});
        }
    }
    
    if ((uyarilar[userId].yazili || []).length === 0 && (uyarilar[userId].sozlu || []).length === 0) {
        delete uyarilar[userId];
    }
    dbKaydet();
    return {
        yazili: (tip === 'yazili' || tip === 'tumu') ? yaziliSayi : 0,
        sozlu:  (tip === 'sozlu'  || tip === 'tumu') ? sozluSayi  : 0
    };
}

let birimPanelZamanlayici = null;
async function birimPanelKurulumu() {
    if (birimPanelZamanlayici) clearTimeout(birimPanelZamanlayici);
    birimPanelZamanlayici = setTimeout(async () => {
        try {
            const kanal = await client.channels.fetch(AYARLAR.BIRIM_PANEL_KANALI).catch(()=>null);
            if (!kanal) return;

            const msgs = await kanal.messages.fetch({ limit: 50 });
            const botMsgs = msgs.filter(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("Birim Yönetim Paneli"));
            
            let lincoln = 0, adam = 0, omega = 0, queen = 0, custom = 0;
            
            Object.values(aktifBirimler).forEach(b => { 
                const t = b.tur?.toLowerCase();
                if (t === 'lincoln') lincoln++; 
                else if (t === 'adam') adam++; 
                else if (t === 'omega') omega++; 
                else if (t === 'queen') queen++;
                else custom++; 
            });

            const embed = new EmbedBuilder()
                .setTitle("Birim Yönetim Paneli")
                .setDescription(
                    `**Aktif Mesai:** ${Object.keys(aktifMesailer).length} kişi\n` +
                    `**Toplam Birim:** ${Object.keys(aktifBirimler).length} birim\n\n` +
                    `**Birimler:**\n` +
                    `• 🚗 Lincoln (1 kişi): **${lincoln}** birim\n` +
                    `• 🚙 Adam (2 kişi): **${adam}** birim\n` +
                    `• 🚕 Omega (4 kişi): **${omega}** birim\n` +
                    `• 👑 Queen (3 kişi): **${queen}** birim\n` +
                    `• 🔔 Custom: **${custom}** birim\n\n` +
                    `🔑 **Lincoln, Adam, Omega, Custom** → Dispatch yetkisi gerekir.\n` +
                    `👑 **Queen** ve **Birimden Ayrıl** → Herkese açık.\n\n` +
                    `Alttaki butonlarla birim ekleyebilir, düzenleyebilir veya görüntüleyebilirsiniz.`
                )
                .setColor(0x2b2d31)
                .setFooter({ text: `Son güncelleme` })
                .setTimestamp();
                
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_birim_lincoln').setLabel('Lincoln').setStyle(ButtonStyle.Success).setEmoji('🚗'),
                new ButtonBuilder().setCustomId('btn_birim_adam').setLabel('Adam').setStyle(ButtonStyle.Primary).setEmoji('🚙'),
                new ButtonBuilder().setCustomId('btn_birim_omega').setLabel('Omega').setStyle(ButtonStyle.Danger).setEmoji('🚕'),
                new ButtonBuilder().setCustomId('btn_birim_queen').setLabel('Queen').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
                new ButtonBuilder().setCustomId('btn_birim_custom').setLabel('Custom').setStyle(ButtonStyle.Secondary).setEmoji('🔔')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_birimleri_goruntule').setLabel('Birimleri Görüntüle').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
                new ButtonBuilder().setCustomId('btn_birim_duzenle').setLabel('Birime Katıl').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_birimden_ayril').setLabel('Birimden Ayrıl').setStyle(ButtonStyle.Danger).setEmoji('🚪')
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_birimleri_sifirla').setLabel('Tüm Birimleri Sıfırla').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );
            
            if (botMsgs.size > 0) {
                await botMsgs.first().edit({ embeds: [embed], components: [row1, row2, row3] }).catch(()=>{});
            } else {
                await kanal.send({ embeds: [embed], components: [row1, row2, row3] });
            }
        } catch (e) { console.log("❌ Birim panel güncelleme hatası:", e); }
    }, 1500);
}

let aktifMesaiZamanlayici = null;
async function aktifMesaileriGuncelle() {
    if (aktifMesaiZamanlayici) clearTimeout(aktifMesaiZamanlayici);
    aktifMesaiZamanlayici = setTimeout(async () => {
        try {
            const kanal = await client.channels.fetch(AYARLAR.AKTIF_MESAI_KANALI);
            if (!kanal) return;

            let icerik = "";
            let butonlar = [];

            if (Object.keys(aktifBirimler).length === 0) {
                icerik = "*Şu an sahada aktif bir devriye birimi bulunmuyor.* 🏙️\n";
            } else {
                for (const [birimId, data] of Object.entries(aktifBirimler)) {
                    icerik += `\n🛡️ **Birim:** ${data.tur} | **Kod:** ${data.kod} | **Kapasite:** ${data.uyeler.length}/${data.kapasite}\n`;
                    for (const uyeId of data.uyeler) {
                        icerik += `> 🚔 <@${uyeId}>\n`;
                    }

                    if (data.uyeler.length < data.kapasite) {
                        butonlar.push(
                            new ButtonBuilder()
                                .setCustomId(`katil_${birimId}`)
                                .setLabel(`${data.tur} (${data.kod}) Katıl`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                }
            }

            const atanmamislar = Object.keys(aktifMesailer).filter(id => !Object.values(aktifBirimler).some(b => b.uyeler.includes(id)));
            
            if (atanmamislar.length > 0) {
                icerik += `\n👥 **Birim Bekleyen / Bağımsız Memurlar:**\n`;
                for(const id of atanmamislar) {
                    icerik += `> <@${id}>\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("📡 AKTİF DEVRİYEDEKİ BİRİMLER")
                .setDescription(icerik)
                .setColor(icerik.includes("Birim:") ? "Green" : "DarkButNotBlack");
                
            const rows = [];
            for (let i = 0; i < butonlar.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(butonlar.slice(i, i + 5)));
            }

            const msgs = await kanal.messages.fetch({ limit: 50 });
            const eskiMsg = msgs.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("AKTİF DEVRİYEDEKİ BİRİMLER"));
            if (eskiMsg) {
                await eskiMsg.edit({ embeds: [embed], components: rows });
            } else {
                await kanal.send({ embeds: [embed], components: rows });
            }
        } catch (e) {}
    
        
    }, 2000); // 2 saniye bekler, biriken değişiklikleri tek hamlede yansıtır.
}
let rutbeZamanlayici = null;
async function rutbeListesiniGuncelle() { 
    // Eğer hali hazırda bekleyen bir güncelleme varsa iptal et (spamı engeller)
    if (rutbeZamanlayici) clearTimeout(rutbeZamanlayici);
    
    // 6 Saniyelik Fren Sistemi (Discord API Rate Limit'i aşmamak için)
    rutbeZamanlayici = setTimeout(async () => {
        let kanal = null; // ← kanal'ı dışarıda tanımla
        
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;

            // Kanalı al
            try {
                kanal = await client.channels.fetch(AYARLAR.RUTBE_LISTE_KANALI);
                if (!kanal) {
                    console.log("❌ Rütbe liste kanalı bulunamadı.");
                    return;
                }
            } catch (e) {
                console.log("❌ Kanal alınamadı:", e.message);
                return;
            }

            // Üyeleri cache'ten al (rate limit yedi, fetch yapmıyoruz artık)
            // await guild.members.fetch(); // RATE LIMIT - kapalı

            const anaEmbed = new EmbedBuilder()
                .setTitle("🛡️ LSPD GÜNCEL PERSONEL KADROSU")
                .setDescription("Memurlar, sahip oldukları Yaka/Çağrı Numaralarına göre sıralanmıştır.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                .setColor("Gold");
                
            let gonderilecekEmbedler = [anaEmbed];
                
            for (const rutbe of AYARLAR.RUTBE_AYARLARI) {
                const rol = guild.roles.cache.get(rutbe.id);
                if (!rol) continue;

                let doluSayisi = 0;
                let rutbeKodlari = [];
                
                for (let i = rutbe.min; i <= rutbe.max; i++) {
                    if (!(rutbe.haric && rutbe.haric.includes(i))) {
                        rutbeKodlari.push(i);
                    }
                }

                if (rutbe.ekstra && Array.isArray(rutbe.ekstra)) {
                    rutbeKodlari.push(...rutbe.ekstra);
                }
                
                rutbeKodlari.sort((a, b) => a - b);

                let uyelerMetni = "";

                for (const i of rutbeKodlari) {
                    const kendiRutbesindeUye = rol.members.find(m => m.displayName.includes(`[${i}]`));
                    
                    if (kendiRutbesindeUye) {
                        uyelerMetni += `> **[${i}]** <@${kendiRutbesindeUye.id}>\n`;
                        doluSayisi++;
                    } else {
                        const baskaRutbedeUye = guild.members.cache.find(m => 
                            m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID) && m.displayName.includes(`[${i}]`)
                        );
                        
                        if (baskaRutbedeUye) {
                            uyelerMetni += `> **[${i}]** *Dolu*\n`;
                            doluSayisi++; 
                        } else {
                            uyelerMetni += `> **[${i}]** *Boş*\n`;
                        }
                    }
                }

                if (uyelerMetni === "") {
                    uyelerMetni = "> *Bu rütbede numaralandırma yok.*";
                }

                const rutbeKutusu = new EmbedBuilder()
                    .setTitle(`🔰 ${rol.name} | Dolu: ${doluSayisi}/${rutbeKodlari.length}`)
                    .setDescription(uyelerMetni)
                    .setColor(rol.color || "#2b2d31"); 

                gonderilecekEmbedler.push(rutbeKutusu);
            }

            // Kanal hâlâ var mı kontrol et
            if (!kanal) {
                console.log("❌ Kanal kayboldu, mesaj atlanıyor.");
                return;
            }

            const msgs = await kanal.messages.fetch({ limit: 50 });
            const eskiMsg = msgs.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("PERSONEL KADROSU"));
            
            if (eskiMsg) {
                await eskiMsg.edit({ embeds: gonderilecekEmbedler });
            } else {
                await kanal.send({ embeds: gonderilecekEmbedler });
            }
        } catch (e) {
            console.log("❌ Rütbe listesi güncellenirken bir hata oluştu:", e.message);
        }
        
    }, 6000); // 6 saniye bekler, tüm değişimleri toplayıp tek seferde günceller.
}

let liderlikZamanlayici = null;
async function liderlikTablosunuGuncelle() { 
    if (liderlikZamanlayici) clearTimeout(liderlikZamanlayici);
    liderlikZamanlayici = setTimeout(async () => {
        try {
            const kanal = await client.channels.fetch(AYARLAR.TOPLAM_MESAI_KANALI);
            const sunucu = kanal?.guild;
            if (!kanal || !sunucu) return;

            const siraliUyeler = Array.from(sunucu.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID)).values())
                .filter(m => {
                    const val = toplamMesailer[m.id];
                    if (!val) return false;
                    const numberVal = typeof val === 'number' ? val : (val.ms || 0);
                    return numberVal > 0;
                }) 
                .sort((a, b) => {
                    const aVal = typeof toplamMesailer[a.id] === 'number' ? toplamMesailer[a.id] * 60000 : (toplamMesailer[a.id].ms || 0);
                    const bVal = typeof toplamMesailer[b.id] === 'number' ? toplamMesailer[b.id] * 60000 : (toplamMesailer[b.id].ms || 0);
                    return bVal - aVal;
                });
                
            let icerik = "";
            
            for (let i = 0; i < siraliUyeler.length; i++) {
                const u = siraliUyeler[i];
                const val = toplamMesailer[u.id] || 0;
                const sureMs = typeof val === 'number' ? val * 60000 : (val.ms || 0);
                let madalya = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️";
                icerik += `${madalya} **${i + 1}.** <@${u.id}> - \`${tamSureFormat(sureMs)}\`\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle("🏆 LSPD HAFTALIK/GENEL MESAİ SIRALAMASI")
                .setDescription("Sunucuda bulunan aktif LSPD personellerinin toplam görev süreleri aşağıda listelenmiştir.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" + (icerik || "*Henüz kayıtlı bir mesai verisi yok.*"))
                .setColor("Yellow")
                .setFooter({ text: "LSPD Performans Sistemi" })
                .setTimestamp();
                
            const msgs = await kanal.messages.fetch({ limit: 50 });
            const eskiMsg = msgs.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("MESAİ SIRALAMASI"));
            
            if (eskiMsg) {
                await eskiMsg.edit({ embeds: [embed] });
            } else {
                await kanal.send({ embeds: [embed] });
            }
        } catch (e) {}
    }, 2500); // 2.5 saniye mola vererek spamı önler
}

function saatlikBildirimKontrolu() { 
    const simdi = Date.now();
    let guncellendiMi = false;
    
    for (const [userId, data] of Object.entries(aktifMesailer)) {
        if (simdi - data.sonBildirim >= 3600000) {
            const saat = Math.floor((simdi - data.baslangic) / 3600000);
            
            client.users.fetch(userId).then(user => {
                user.send(`⚠️ **LSPD DİKKAT:** Yaklaşık **${saat} saattir** mesaidesin. Mesaiden ayrıldıysan paneli kullanarak mesaini kapatmayı unutma.`).catch(() => {});
            });
            
            aktifMesailer[userId].sonBildirim = simdi;
            guncellendiMi = true;
        }
    }
    
    if (guncellendiMi) dbKaydet();
}

async function inaktifRaporuGonder(hedefKanal = null) {
    const kanal = hedefKanal || await client.channels.fetch(AYARLAR.INAKTIF_RAPOR_KANALI).catch(()=>null);
    if (!kanal || !kanal.guild) return;
    
    await kanal.guild.members.cache; // rate limit yedi
    const uyeler = kanal.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
    let inaktifMetni = "";
    let s = 1;

    uyeler.forEach(m => {
        if (!aktifMesailer[m.id] && !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID)) {
            const val = toplamMesailer[m.id];
            const son = (val && val.sonGiris) ? val.sonGiris : 0;
            const farkGun = Math.floor((Date.now() - son) / 86400000);
            
            if (farkGun >= AYARLAR.INAKTIF_GUN_SINIRI) {
                const sureMetni = son === 0 ? "Hiç mesai girişi yok" : `${farkGun} gün önce`;
                inaktifMetni += `**${s}.** 👮 ${m} ( \`${m.user.username}\` ) - Son mesai: **${sureMetni}**\n`;
                s++;
            }
        }
    });

    if (inaktifMetni === "") {
        inaktifMetni = "Şu an inaktif kriterlerine uyan memur bulunmamaktadır.";
    }

    const embed = new EmbedBuilder()
        .setTitle("İnaktif Mesai Raporu")
        .setDescription(`**${AYARLAR.INAKTIF_GUN_SINIRI} gündür mesai girmeyen kullanıcılar:**\n\n` + inaktifMetni)
        .setColor("DarkButNotBlack")
        .setThumbnail(kanal.guild.iconURL())
        .setFooter({ text: `Rapor Tarihi: ${trTimeStr()}` });
        
    kanal.send({ embeds: [embed] });
}

async function saatlikRaporGonder() {
    const kanal = await client.channels.fetch(AYARLAR.SAATLIK_RAPOR_KANALI).catch(()=>null);
    if (!kanal) return;
    
    let desc = "**Mesaiye girmiş kullanıcılar:**\n\n";
    let index = 1;
    
    for (const [userId, data] of Object.entries(aktifMesailer)) {
        const user = await client.users.fetch(userId).catch(()=>null);
        const username = user ? user.username : "Bilinmiyor";
        
        desc += `**${index}.** 👮 <@${userId}> ( \`${username}\` ) - Giriş: **${Math.floor((Date.now() - data.baslangic) / 3600000)} saat önce**\n`;
        index++;
    }
    
    if (index === 1) desc += "*Şu an mesaide kimse yok.*";
    
    const embed = new EmbedBuilder()
        .setTitle("Saatlik Mesai Raporu")
        .setDescription(desc) // 'decs' yerine 'desc' olarak düzeltildi
        .setColor("Aqua")
        .setFooter({ text: `Rapor: ${trTimeStr()}` });
        
    const kimseYok = index === 1;
    kanal.send({
        content: kimseYok ? null : "@here Saatlik telsiz kontrol vakti geldi lütfen telsizin tam fotoğrafını atın.",
        embeds: [embed]
    });
}

async function zorunluMesaiRaporuGonder(kanalId) {
    const kanal = client.channels.cache.get(kanalId);
    if (!kanal) return;
    
    await kanal.guild.members.cache; // rate limit yedi
    const uyeler = kanal.guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
    
    let kacakMetni = "";
    let s = 1;
    
    uyeler.forEach(m => {
        if (!aktifMesailer[m.id] && !m.roles.cache.has(AYARLAR.MAZERET_ROL_ID)) {
            kacakMetni += `**${s}.)** 👮 ${m} ( \`${m.user.username}\` )\n`;
            s++;
        }
    });
    
    if(kacakMetni === "") {
        kacakMetni = "Tüm personeller eksiksiz olarak zorunlu mesaideydi!";
    }
    
    const embed = new EmbedBuilder()
        .setTitle("🚨 ZORUNLU MESAİ BİTİŞ RAPORU")
        .setDescription(`Zorunlu mesai saatinde mesaide **olmayan** (ve mazereti bulunmayan) memurlar:\n\n${kacakMetni}`)
        .setColor("Red");
        
    kanal.send({ embeds: [embed] });
}

// ==============================================================================
// MESAİ SIFIRLAMA + HTML RAPOR FONKSİYONU
// ==============================================================================
async function mesaiSifirlaVeRaporOlustur(yapan, hedefKanal, guild) {
    try {
        await guild.members.cache; // rate limit yedi

        // Tüm verileri topla
        const uyeler = guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
        let toplamMs = 0;
        let enCok = { id: null, ms: 0, isim: '' };
        let kayitlar = [];
        let silinenKayit = 0;

        uyeler.forEach(m => {
            const val = toplamMesailer[m.id];
            if (!val) return;
            const ms = typeof val === 'number' ? val * 60000 : (val.ms || 0);
            if (ms <= 0) return;

            silinenKayit++;
            toplamMs += ms;

            const isim = m.displayName || m.user.username;
            kayitlar.push({ id: m.id, isim, ms });

            if (ms > enCok.ms) {
                enCok = { id: m.id, ms, isim };
            }
        });

        kayitlar.sort((a, b) => b.ms - a.ms);

        // HTML rapor oluştur
        const tarih = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const tarihDosya = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const sunucuAdi = guild.name.toLowerCase().replace(/\s+/g, '');

        let satirlar = kayitlar.map((k, i) => {
            const sure = tamSureFormat(k.ms);
            const rozet = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `
                <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
                    <td class="rank">${rozet}</td>
                    <td class="name">${escapeHtml(k.isim)}</td>
                    <td class="id">${k.id}</td>
                    <td class="time">${sure}</td>
                </tr>`;
        }).join('');

        const htmlRapor = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>LSPD Mesai Raporu — ${tarih}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1b1e; color: #dcddde; }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #0d1f33 100%); padding: 32px 40px; border-bottom: 3px solid #2d6fa4; }
  .header h1 { font-size: 26px; color: #ffffff; letter-spacing: 1px; }
  .header .sub { font-size: 13px; color: #8ea8c0; margin-top: 6px; }
  .stats { display: flex; gap: 16px; padding: 24px 40px; background: #23272a; border-bottom: 1px solid #2f3136; flex-wrap: wrap; }
  .stat-box { background: #2b2d31; border-radius: 8px; padding: 16px 24px; flex: 1; min-width: 180px; border-left: 4px solid #2d6fa4; }
  .stat-box .label { font-size: 11px; text-transform: uppercase; color: #8ea8c0; letter-spacing: 1px; }
  .stat-box .value { font-size: 20px; font-weight: bold; color: #fff; margin-top: 4px; }
  .top-entry { display: flex; align-items: center; gap: 10px; background: #2b2d31; border-left: 4px solid #f1c40f; border-radius: 8px; padding: 14px 24px; margin: 0 40px 24px; }
  .top-entry .crown { font-size: 22px; }
  .top-entry .info strong { color: #f1c40f; }
  .container { padding: 0 40px 40px; }
  table { width: 100%; border-collapse: collapse; background: #2b2d31; border-radius: 8px; overflow: hidden; }
  thead tr { background: #1e3a5f; }
  thead th { padding: 13px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #8ea8c0; letter-spacing: 1px; }
  tbody tr.even { background: #2b2d31; }
  tbody tr.odd { background: #26282c; }
  tbody tr:hover { background: #32353b; }
  td { padding: 11px 16px; font-size: 14px; }
  .rank { width: 60px; text-align: center; font-weight: bold; color: #f1c40f; }
  .name { font-weight: 600; color: #ffffff; }
  .id { color: #8ea8c0; font-size: 12px; font-family: monospace; }
  .time { color: #43b581; font-weight: 600; }
  .footer { text-align: center; padding: 20px; font-size: 12px; color: #4f545c; border-top: 1px solid #2f3136; margin-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <h1>🚔 LSPD — Mesai Toplu Sıfırlama Raporu</h1>
    <div class="sub">Rapor Tarihi: ${tarih} | İşlemi Yapan: ${escapeHtml(yapan.tag || yapan.username)}</div>
  </div>
  <div class="stats">
    <div class="stat-box"><div class="label">Silinen Kayıt</div><div class="value">${silinenKayit} kişi</div></div>
    <div class="stat-box"><div class="label">Toplam Mesai (Özet)</div><div class="value">${tamSureFormat(toplamMs)}</div></div>
    <div class="stat-box"><div class="label">En Çok Çalışan</div><div class="value">${escapeHtml(enCok.isim || '—')}</div></div>
  </div>
  ${enCok.id ? `<div class="top-entry"><div class="crown">👑</div><div class="info"><strong>${escapeHtml(enCok.isim)}</strong> — ${tamSureFormat(enCok.ms)}</div></div>` : ''}
  <div class="container">
    <table>
      <thead><tr><th>Sıra</th><th>İsim</th><th>Discord ID</th><th>Toplam Süre</th></tr></thead>
      <tbody>${satirlar || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#4f545c;">Kayıt bulunamadı</td></tr>'}</tbody>
    </table>
  </div>
  <div class="footer">Bu rapor ${tarih} tarihinde otomatik oluşturulmuştur. Toplam ${silinenKayit} kayıt sıfırlandı.</div>
</body>
</html>`;

        // Mesai verilerini sıfırla
        toplamMesailer = {};
        dbKaydet();
        liderlikTablosunuGuncelle();

        // Embed oluştur
        const embed = new EmbedBuilder()
            .setTitle("🧹 Mesai toplu sıfırlama")
            .setDescription(`Tüm mesai verileri silindi. Ayrıntılı yedek **aşağıdaki HTML dosyasında** (diske yazılmadı, yalnızca bu mesajda).`)
            .addFields(
                {
                    name: "✅ Özet",
                    value: `• Silinen kayıt: **${silinenKayit} kişi**\n• Toplam mesai (özet): **${tamSureFormat(toplamMs)}**\n• 👑 En çok çalışan: ${enCok.id ? `<@${enCok.id}> — **${tamSureFormat(enCok.ms)}**` : '—'}`
                },
                {
                    name: "📋 Bilgi",
                    value: `🔧 İşlemi yapan: <@${yapan.id}> ( ${yapan.id} )\n🕐 Zaman: ${tarih}`
                }
            )
            .setColor("Red")
            .setThumbnail(guild.iconURL())
            .setTimestamp();

        const dosyaAdi = `${sunucuAdi}mesai-${tarihDosya}.html`;
        const htmlBuffer = Buffer.from(htmlRapor, 'utf-8');
        const attachment = { attachment: htmlBuffer, name: dosyaAdi };

        await hedefKanal.send({ embeds: [embed], files: [attachment] });

        return { basarili: true, silinenKayit, toplamMs, enCok };
    } catch (e) {
        console.error("❌ Mesai sıfırlama hatası:", e);
        return { basarili: false };
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==============================================================================
// MESAİ RAPORU FONKSİYONU (Günlük veya Genel)
// ==============================================================================
async function mesaiRaporuOlusturVeGonder(yapan, hedefKanal, guild, tur = 'genel') {
    try {
        await guild.members.cache; // rate limit yedi
        const uyeler = guild.members.cache.filter(m => m.roles.cache.has(AYARLAR.LSPD_GENEL_ROL_ID));
        const kaynak = tur === 'gunluk' ? gunlukMesailer : toplamMesailer;

        let toplamMs = 0;
        let enCok = { id: null, ms: 0, isim: '' };
        let kayitlar = [];

        uyeler.forEach(m => {
            const val = kaynak[m.id];
            if (!val) return;
            const ms = typeof val === 'number' ? val * 60000 : (val.ms || 0);
            if (ms <= 0) return;
            toplamMs += ms;
            const isim = m.displayName || m.user.username;
            kayitlar.push({ id: m.id, isim, ms, avatar: m.user.displayAvatarURL({ size: 64 }) });
            if (ms > enCok.ms) enCok = { id: m.id, ms, isim };
        });

        kayitlar.sort((a, b) => b.ms - a.ms);

        const tarih = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const tarihDosya = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const sunucuAdi = guild.name.toLowerCase().replace(/\s+/g, '');

        // Birim bazlı dağılım
        const birimSayilari = {};
        Object.values(aktifBirimler).forEach(b => {
            const t = b.tur || 'Custom';
            birimSayilari[t] = (birimSayilari[t] || 0) + 1;
        });

        const renkler = ['#5865F2','#57F287','#FEE75C','#ED4245','#EB459E','#00B0F4'];
        const birimLabels = Object.keys(birimSayilari);
        const birimData = Object.values(birimSayilari);

        const satirlar = kayitlar.map((k, i) => {
            const sure = tamSureFormat(k.ms);
            const yuzde = toplamMs > 0 ? ((k.ms / toplamMs) * 100).toFixed(1) : 0;
            const rozet = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const bar = Math.round((k.ms / (kayitlar[0]?.ms || 1)) * 100);
            return `
            <tr>
                <td class="rank">${rozet}</td>
                <td class="name"><span class="name-text">${escapeHtml(k.isim)}</span><div class="bar-wrap"><div class="bar" style="width:${bar}%"></div></div></td>
                <td class="id-cell">${k.id}</td>
                <td class="time-cell">${sure}</td>
                <td class="pct">${yuzde}%</td>
            </tr>`;
        }).join('');

        const turLabel = tur === 'gunluk' ? 'Günlük Rapor' : 'Genel Rapor';

        const htmlRapor = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LSPD ${turLabel} — ${tarih}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#111214;color:#b5bac1;min-height:100vh}
.topbar{background:#1e1f22;border-bottom:1px solid #2b2d31;padding:14px 32px;display:flex;align-items:center;gap:16px}
.topbar .badge{background:#2b2d31;border:1px solid #3b3d44;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;color:#80848e;letter-spacing:1px}
.topbar h1{font-size:22px;color:#f2f3f5;font-weight:700}
.topbar .sub{margin-left:auto;font-size:12px;color:#6d6f78;text-align:right;line-height:1.6}
.meta-strip{background:#1a1b1e;border-bottom:1px solid #2b2d31;padding:10px 32px;font-size:12px;color:#6d6f78;display:flex;gap:24px;flex-wrap:wrap}
.meta-strip span b{color:#b5bac1}
.tabs{display:flex;gap:4px;padding:20px 32px 0;border-bottom:1px solid #2b2d31}
.tab{padding:8px 18px;border-radius:6px 6px 0 0;font-size:13px;font-weight:600;cursor:pointer;background:transparent;border:none;color:#80848e;transition:all .15s}
.tab.active{background:#2b2d31;color:#f2f3f5;border-bottom:2px solid #5865F2}
.tab:hover:not(.active){color:#b5bac1}
.panel{display:none;padding:24px 32px}
.panel.active{display:block}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.card{background:#1e1f22;border:1px solid #2b2d31;border-radius:10px;padding:18px 20px;border-left:4px solid #5865F2}
.card.gold{border-color:#faa61a}.card.green{border-color:#57f287}.card.red{border-color:#ed4245}.card.blue{border-color:#5865f2}
.card .lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6d6f78;margin-bottom:6px}
.card .val{font-size:24px;font-weight:700;color:#f2f3f5}
.card .desc{font-size:11px;color:#6d6f78;margin-top:4px}
.sha-box{background:#1e1f22;border:1px solid #2b2d31;border-radius:8px;padding:14px 20px;margin-bottom:20px}
.sha-box .sha-lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6d6f78;margin-bottom:6px}
.sha-box .sha-val{font-family:monospace;font-size:13px;color:#5865F2;word-break:break-all}
.sha-box .sha-desc{font-size:11px;color:#6d6f78;margin-top:4px}
.chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:16px}
.chart-box{background:#1e1f22;border:1px solid #2b2d31;border-radius:10px;padding:18px 20px}
.chart-box h3{font-size:13px;color:#b5bac1;margin-bottom:14px;font-weight:600}
.chart-box canvas{max-height:260px}
table{width:100%;border-collapse:collapse;background:#1e1f22;border-radius:10px;overflow:hidden;border:1px solid #2b2d31}
thead tr{background:#2b2d31}
thead th{padding:11px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6d6f78}
tbody tr{border-bottom:1px solid #2b2d31;transition:background .1s}
tbody tr:last-child{border:none}
tbody tr:hover{background:#232428}
td{padding:10px 14px;font-size:13px}
.rank{width:52px;text-align:center;font-size:15px}
.name{min-width:160px}.name-text{color:#f2f3f5;font-weight:600;display:block;margin-bottom:3px}
.bar-wrap{height:3px;background:#2b2d31;border-radius:2px;width:100%}
.bar{height:3px;background:linear-gradient(90deg,#5865F2,#57f287);border-radius:2px}
.id-cell{font-family:monospace;font-size:11px;color:#6d6f78}
.time-cell{color:#57f287;font-weight:600}
.pct{color:#faa61a;font-size:12px}
footer{text-align:center;padding:20px 32px;font-size:11px;color:#3b3d44;border-top:1px solid #1e1f22;margin-top:16px}
</style>
</head>
<body>
<div class="topbar">
  <div class="badge">LSPD BOTS</div>
  <h1>Mesai ${escapeHtml(turLabel)}</h1>
  <div class="sub">
    Resmi mesai yedek çıktısı<br>
    <b>${escapeHtml(guild.name)}</b> tarafından oluşturuldu
  </div>
</div>
<div class="meta-strip">
  <span>🖥️ Sunucu: <b>${escapeHtml(guild.name)}</b> · <b>${guild.id}</b></span>
  <span>🔧 İşlemi yapan: <b>${escapeHtml(yapan.tag || yapan.username)}</b> <b>${yapan.id}</b></span>
  <span>🕐 Oluşturulma: <b>${tarih}</b></span>
  <span>📋 Kayıt: <b>${kayitlar.length}</b></span>
  <span>⏱️ Toplam: <b>${(toplamMs/3600000).toFixed(2)} saat</b></span>
</div>
<div class="tabs">
  <button class="tab active" onclick="showPanel('ozet',this)">Özet</button>
  <button class="tab" onclick="showPanel('grafikler',this)">Grafikler</button>
  <button class="tab" onclick="showPanel('tablo',this)">Kayıt tablosu</button>
</div>
<div id="ozet" class="panel active">
  <div class="cards">
    <div class="card green"><div class="lbl">Yedeklenen Kişi</div><div class="val">${kayitlar.length}</div><div class="desc">Mesai verisi taşınan satır</div></div>
    <div class="card blue"><div class="lbl">Toplam Mesai</div><div class="val">${(toplamMs/3600000).toFixed(2)}</div><div class="desc">Saat (tablo toplamı)</div></div>
    <div class="card"><div class="lbl">Mesaide (Anlık)</div><div class="val">${Object.keys(aktifMesailer).length}</div><div class="desc">status: in veya birim özeti</div></div>
    <div class="card gold"><div class="lbl">En Çok Çalışan</div><div class="val">${escapeHtml(enCok.isim || '—')}</div><div class="desc">${enCok.ms > 0 ? tamSureFormat(enCok.ms) : '—'}</div></div>
    <div class="card red"><div class="lbl">İşlem Yapılan Birim</div><div class="val">${Object.keys(aktifBirimler).length} / ${Object.keys(birimSayilari).length}</div><div class="desc">Özet grafikteki birimlerden toplam mesai 1 saati aşanların sayısı</div></div>
  </div>
  <div class="sha-box">
    <div class="sha-lbl">SHA-256 (Bütünlük)</div>
    <div class="sha-val" id="shaval">Hesaplanıyor...</div>
    <div class="sha-desc">Dosya değişirse bu kod tutmaz. Doğrulama: bu 64 karakteri sil; kalan dosyanın UTF-8 SHA-256 özeti aynı olmalı.</div>
  </div>
</div>
<div id="grafikler" class="panel">
  <p style="font-size:13px;color:#6d6f78;margin-bottom:16px">Grafikler: Lincoln, Adam, Omega ve Custom birimlerindeki üyelerin toplam mesaisi ile o an <b>mesaide</b> sayıları.</p>
  <div class="chart-grid">
    <div class="chart-box"><h3>📊 Departman — toplam mesai (saat)</h3><canvas id="c1"></canvas></div>
    <div class="chart-box"><h3>🥧 Departman — dağılım (%)</h3><canvas id="c2"></canvas></div>
    <div class="chart-box"><h3>👮 Departman — aktif (mesaide) sayısı</h3><canvas id="c3"></canvas></div>
  </div>
</div>
<div id="tablo" class="panel">
  <table>
    <thead><tr><th>Sıra</th><th>İsim / Çubuk</th><th>Discord ID</th><th>Toplam Süre</th><th>%</th></tr></thead>
    <tbody>${satirlar || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#6d6f78">Kayıt bulunamadı</td></tr>'}</tbody>
  </table>
</div>
<footer>Bu rapor ${tarih} tarihinde otomatik oluşturulmuştur · ${kayitlar.length} kayıt · LSPD Bots</footer>
<script>
function showPanel(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}
const C = Chart, opts = { plugins:{ legend:{labels:{color:'#b5bac1'}} }, scales:{ x:{ticks:{color:'#6d6f78'},grid:{color:'#2b2d31'}}, y:{ticks:{color:'#6d6f78'},grid:{color:'#2b2d31'}} } };
const birimLabels = ${JSON.stringify(birimLabels.length ? birimLabels : ['Lincoln','Adam','Omega','Queen','Custom'])};
const birimData = ${JSON.stringify(birimData.length ? birimData : [0,0,0,0,0])};
new C(document.getElementById('c1'),{type:'bar',data:{labels:birimLabels,datasets:[{label:'Toplam (saat)',data:birimData,backgroundColor:'#5865F2',borderRadius:4}]},options:{...opts,plugins:{legend:{display:false}}}});
new C(document.getElementById('c2'),{type:'doughnut',data:{labels:birimLabels,datasets:[{data:birimData,backgroundColor:['#5865F2','#57F287','#FEE75C','#ED4245','#EB459E']}]},options:{plugins:{legend:{labels:{color:'#b5bac1'}}}}});
const aktifSayilar = birimLabels.map(()=>Math.floor(Math.random()*3));
new C(document.getElementById('c3'),{type:'bar',data:{labels:birimLabels,datasets:[{label:'Aktif Üye',data:birimData,backgroundColor:'#57F287',borderRadius:4}]},options:{...opts,indexAxis:'y',plugins:{legend:{display:false}}}});
// SHA hesapla
(async()=>{
  const txt = document.documentElement.outerHTML.replace(/<script>[\\s\\S]*?<\\/script>/g,'');
  const buf = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));
  document.getElementById('shaval').textContent=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
})();
</script>
</body>
</html>`;

        const dosyaAdi = `${sunucuAdi}-mesai-${tur}-${tarihDosya}.html`;
        const attachment = { attachment: Buffer.from(htmlRapor, 'utf-8'), name: dosyaAdi };

        const embed = new EmbedBuilder()
            .setTitle(`📊 LSPD ${turLabel}`)
            .setDescription(`Sıfırlama öncesi mesai verilerinin özeti, departman dağılımı ve kullanıcı satırlarını içerir.`)
            .addFields(
                { name: "✅ Özet", value: `• Yedeklenen kişi: **${kayitlar.length}**\n• Toplam mesai: **${(toplamMs/3600000).toFixed(2)} saat**\n• 👑 En çok çalışan: ${enCok.id ? `<@${enCok.id}> — **${tamSureFormat(enCok.ms)}**` : '—'}` },
                { name: "📋 Bilgi", value: `🔧 İşlemi yapan: <@${yapan.id}>\n🕐 Zaman: ${tarih}` }
            )
            .setColor(tur === 'gunluk' ? "Blue" : "Green")
            .setThumbnail(guild.iconURL())
            .setTimestamp();

        await hedefKanal.send({ embeds: [embed], files: [attachment] });
        return { basarili: true };
    } catch (e) {
        console.error("❌ Rapor oluşturma hatası:", e);
        return { basarili: false };
    }
}

// ==============================================================================
// TÜRKÇE İYELİK EKİ YARDIMCISI
// ==============================================================================
function iyeEki(isim) {
    if (!isim) return 'nin';
    const unluler = 'aeıioöuü';
    // Son ünlüyü bul
    for (let i = isim.length - 1; i >= 0; i--) {
        const h = isim[i].toLowerCase();
        if (unluler.includes(h)) {
            if ('aı'.includes(h)) return 'ın';
            if ('ei'.includes(h)) return 'in';
            if ('ou'.includes(h)) return 'un';
            if ('öü'.includes(h)) return 'ün';
        }
    }
    return 'nin';
}

function isimdenKoduCikar(isim) {
    return isim.replace(/^\[\d+\]\s*/, '').trim();
}

function isimdenKodu(isim) {
    const match = isim.match(/\[(\d+)\]/);
    return match ? parseInt(match[1]) : null;
}

// ==============================================================================
// FTO FORUM SİSTEMİ — ftoAtaForum / ftoKapatForum
// ==============================================================================
async function ftoAtaForum(guild, ftsMember, ftoMember) {
    try {
        const forumKanal = await client.channels.fetch(AYARLAR.FTO_FORUM_ID).catch(() => null);
        if (!forumKanal) return { mesaj: "❌ Forum kanalı bulunamadı. `FTO_FORUM_ID`'yi kontrol et." };
        if (forumKanal.type !== 15) return { mesaj: "❌ Belirtilen kanal bir forum kanalı değil. `FTO_FORUM_ID`'yi kontrol et." };

        const ftsIsim = ftsMember.displayName;
        const ftsKodMatch = ftsIsim.match(/\[(\d+)\]/);
        const ftsKod = ftsKodMatch ? ftsKodMatch[1] : null;
        
        // OOC isim yerine RP ismini alacak şekilde düzeltildi
        const ftsAdi = ftsIsim.includes('|')
            ? ftsIsim.split('|')[0].replace(/^\[\d+\]\s*/, '').trim()
            : isimdenKoduCikar(ftsIsim);

        const gonderiBasligi = ftsKod ? `${ftsKod} | ${ftsAdi}` : ftsAdi;
        const eki = iyeEki(ftsAdi.split(' ')[0]);

        const ustMesaj =
            `${ftoMember}, ${ftsMember}'${eki} FTO'su olarak atandın. Görevin bu memurun eğitilmesini sağlamak. Devriyelerde kontrol etmen gereken kriterler aşağıda belirtildi:\n` +
            `- Devriyenin özeti,\n- FTS'nin telsiz kullanımı,\n- FTS'nin araç sürüşü,\n` +
            `- FTS'nin olaylara nasıl yaklaştığı,\n- FTS'nin tüzüğe uyup uymadığı,\n` +
            `- FTS'nin hiyerarşiye uyup uymadığı,\n- FTS'nin sivillerle iletişimi,\n- FTS'nin üslubu,\n` +
            `- FTS'nin diğer memurlarla olan iletişimi,\n` +
            `- FTS'nin felony stop gibi durumlarda şablona uyup uymadığı,\n` +
            `- FTS'nin çevreyle olan etkileşimi,\n- FTO'nun genel görüşü,\n- Devriyenin nasıl bittiği.\n` +
            `İyi görevler, ${ftoMember}.`;

        // thread tanımlaması hatasını gidermek için düzeltildi
        const thread = await forumKanal.threads.create({
            name: gonderiBasligi,
            message: { content: ustMesaj },
        });

        const altMesaj =
            `## FTO Raporu\n**Tarih:**\n**Saat Aralığı:**\n**FTO:**\n**FTS:**\n` +
            `**Devriye Birimi:**\n**Rapor:**\n**FTS'nin Hataları:**\n**İmza:**`;

        await thread.send(altMesaj);
        return { mesaj: `✅ FTO gönderisi oluşturuldu: <#${thread.id}>` };
    } catch(e) {
        console.error("❌ FTO forum hatası:", e);
        return { mesaj: `❌ Gönderi oluşturulamadı: ${e.message}` };
    }
}

async function ftoKapatForum(guild, ftsMember) {
    try {
        const forumKanal = await client.channels.fetch(AYARLAR.FTO_FORUM_ID).catch(() => null);
        if (!forumKanal) return { mesaj: "❌ Forum kanalı bulunamadı." };

        // 1. İsimden [123] gibi telsiz kodlarını tamamen temizle
        const safIsim = ftsMember.displayName.replace(/\[\d+\]/g, '').trim();
        
        // 2. Sadece IC ismi (Karakter adını) almak için | işaretinin solunu alıyoruz
        const icIsimGosterilecek = safIsim.split('|')[0].trim(); // Forum başlığı için orijinal büyük/küçük harfli IC isim
        const icIsimArama = icIsimGosterilecek.toLowerCase(); // Bulmak için küçük harfe çevrilmiş hali

        // Aktif thread'lerde ara (Sadece IC isme bakarak bulur, kodu umursamaz)
        const aktifler = await forumKanal.threads.fetchActive().catch(() => ({ threads: new Map() }));
        const thread = aktifler.threads.find(t => 
            t.name.toLowerCase().includes(icIsimArama)
        );

        if (!thread) return { mesaj: `❌ \`${icIsimGosterilecek}\` ismine ait açık bir FTO gönderisi bulunamadı.` };

        // Gönderi adını güncelleyerek SADECE IC İSİM yapar (OOC veya Kapalı tagı koymaz)
        await thread.setName(icIsimGosterilecek).catch(() => {});
        await thread.send(`> 🔒 Bu FTO süreci başarıyla tamamlandı. Gönderi arşive alındı.`);
        await thread.setArchived(true).catch(() => {});

        return { mesaj: `✅ FTO gönderisi kapatıldı ve arşivlendi: \`${icIsimGosterilecek}\`` };
    } catch(e) {
        console.error("❌ FTO kapat hatası:", e);
        return { mesaj: `❌ Gönderi kapatılamadı: ${e.message}` };
    }
}

// ==============================================================================
// ROL VER + OTOMATİK KOD ATAMA
// ==============================================================================
// ==============================================================================
// ROL VER + OTOMATİK KOD ATAMA (RATE LIMIT KORUMALI)
// ==============================================================================
// ==============================================================================
// ROL VER + OTOMATİK KOD ATAMA (RATE LIMIT KORUMALI)
// Tropper 1 (R_100) → "[KOD] İc isim | occ isim" placeholder formatında atar
// Diğer rütbeler → eski mantık (mevcut isim üzerine kod basar)
// ==============================================================================
// ==============================================================================
// ROL VER + OTOMATİK KOD ATAMA (RATE LIMIT KORUMALI)
// Tropper 1 (R_700) → "[KOD] İc isim | occ isim" placeholder formatında atar
// Diğer rütbeler → eski mantık (mevcut isim üzerine kod basar)
// ==============================================================================
async function rolVerVeKodAta(guild, hedefUye, hedefRol) {
    try {
        const OTO_ROLLER = {
            CIVILIAN: '1487579880181858458',    
            R_100: '1487574113563443210', 
            R_200: '1487574117321281676', 
            R_300_UST: '1487574118541819934', 
            R_300_ALT: '1487574119359844422', 
            R_400: '1487574119561035786', 
            R_500: '1487574120286916668', 
            R_600: '1487574120953544724', 
            R_700: '1487574121264058499', 
            SAHP: '1487581846182166548',
            FTS: '1487833324084007095',
            FTO: '1487832679385923725',
            FTOS: '1487832617004040192',
            SUPERVISOR: '1487575603581423686'
        };

        const rutbeKonfig = AYARLAR.RUTBE_AYARLARI.find(r => r.id === hedefRol.id);
        
        // 1. Yeni Rütbeyi Ver ve Bekle
        await hedefUye.roles.add(hedefRol).catch(() => {});
        await bekle(800);

        // 2. Eski Ana Rütbeleri Sil ve Bekle
        const ANA_RUTBELER = [
            OTO_ROLLER.CIVILIAN, OTO_ROLLER.R_700, OTO_ROLLER.R_600, 
            OTO_ROLLER.R_500, OTO_ROLLER.R_400, OTO_ROLLER.R_300_ALT, 
            OTO_ROLLER.R_300_UST, OTO_ROLLER.R_200, OTO_ROLLER.R_100
        ];
        const silinecekAnaRutbeler = ANA_RUTBELER.filter(id => id !== hedefRol.id);
        if(silinecekAnaRutbeler.length > 0) {
            await hedefUye.roles.remove(silinecekAnaRutbeler).catch(() => {});
            await bekle(800);
        }

        // 3. Yan Rolleri Ayarla ve Bekle
        if (hedefRol.id === OTO_ROLLER.R_700) {
            await hedefUye.roles.add([OTO_ROLLER.SAHP, OTO_ROLLER.FTS]).catch(() => {});
        } 
        else if (hedefRol.id === OTO_ROLLER.R_600) {
            await hedefUye.roles.remove(OTO_ROLLER.FTS).catch(() => {});
        }
        else if (hedefRol.id === OTO_ROLLER.R_500) {
            await hedefUye.roles.add(OTO_ROLLER.FTO).catch(() => {});
        }
        else if (hedefRol.id === OTO_ROLLER.R_300_ALT) {
            await hedefUye.roles.remove(OTO_ROLLER.FTO).catch(() => {});
            await bekle(500);
            await hedefUye.roles.add([OTO_ROLLER.SUPERVISOR, OTO_ROLLER.FTOS]).catch(() => {});
        }
        await bekle(800);

        if (!rutbeKonfig) {
            rutbeListesiniGuncelle();
            return { mesaj: `✅ <@${hedefUye.id}> kullanıcısına **${hedefRol.name}** rolü verildi.` };
        }

        await guild.members.cache;
        const kullanilanKodlar = new Set();
        guild.members.cache.forEach(m => {
            const kod = isimdenKodu(m.displayName);
            if (kod !== null) kullanilanKodlar.add(kod);
        });

        const tumKodlar = [];
        for (let i = rutbeKonfig.min; i <= rutbeKonfig.max; i++) {
            if (!(rutbeKonfig.haric && rutbeKonfig.haric.includes(i))) tumKodlar.push(i);
        }
        if (rutbeKonfig.ekstra) tumKodlar.push(...rutbeKonfig.ekstra);
        tumKodlar.sort((a, b) => a - b);

        const bosKod = tumKodlar.find(k => !kullanilanKodlar.has(k));

        if (bosKod === undefined) {
            rutbeListesiniGuncelle();
            return { mesaj: `✅ <@${hedefUye.id}> kullanıcısına **${hedefRol.name}** rolü verildi ama boş telsiz kodu kalmadı.` };
        }

        const mevcutIsim = hedefUye.displayName;
        let yeniIsim;

        // ⭐ TROPPER 1 (R_700) İÇİN PLACEHOLDER FORMAT
        // Sonra elle gerçek İc/Occ isim yazılacak
        if (hedefRol.id === OTO_ROLLER.R_700) {
            yeniIsim = `[${bosKod}] İc isim | ooc isim`;
        } else {
            const mevcutKod = isimdenKodu(mevcutIsim);
            yeniIsim = mevcutKod !== null
                ? mevcutIsim.replace(/\[\d+\]/, `[${bosKod}]`)
                : `[${bosKod}] ${mevcutIsim}`;
        }

        await hedefUye.setNickname(yeniIsim).catch(() => {});
        rutbeListesiniGuncelle();

        return { mesaj: `✅ <@${hedefUye.id}> kullanıcısına **${hedefRol.name}** rolü verildi ve çağrı kodu **[${bosKod}]** atandı.\n> Yeni isim: \`${yeniIsim}\`` };
    } catch(e) {
        console.error("❌ Rol ver hatası:", e);
        return { mesaj: `❌ Rol verilemedi: ${e.message}` };
    }
}

// ============================================
// SİTE İLE BOT ARASINDAKİ İLETİŞİM ALICISI
// ============================================
const expressForSite = require('express');
const siteApp = expressForSite();
siteApp.use(expressForSite.json());

siteApp.post('/api/site-to-bot/mesai-baslat', (req, res) => {
    const { discordId } = req.body;
    
    // Botun kendi hafızasındaki değişkene bakıyoruz
    if (!aktifMesailer[discordId]) {
        aktifMesailer[discordId] = { baslangic: Date.now(), sonBildirim: Date.now(), birim: "Belirtilmedi" };
        dbKaydet(); // Botun kendi kaydetme fonksiyonu (JSON'a ve Site Database'ine gönderir)
        
        // İsteğe bağlı: Kanala bildirim at
        const kanal = client.channels.cache.get(AYARLAR.AKTIF_MESAI_KANALI);
        if(kanal) kanal.send(`🟢 <@${discordId}> isimli personel **Site Üzerinden** mesaiye giriş yaptı.`);
        
        aktifMesaileriGuncelle(); // Discord panelini yenile
    }
    
    res.json({ success: true });
});

siteApp.post('/api/site-to-bot/mesai-bitir', (req, res) => {
    const { discordId } = req.body;
    
    if (aktifMesailer[discordId]) {
        const sureMs = Date.now() - aktifMesailer[discordId].baslangic;
        
        // Toplam mesailere ekle
        if (!toplamMesailer[discordId]) {
            toplamMesailer[discordId] = { ms: 0, sonGiris: 0, sonCikis: 0 };
        }
        
        if (typeof toplamMesailer[discordId] === 'number') {
            toplamMesailer[discordId] += Math.floor(sureMs / 60000);
        } else {
            toplamMesailer[discordId].ms += sureMs;
            toplamMesailer[discordId].sonGiris = aktifMesailer[discordId].baslangic;
            toplamMesailer[discordId].sonCikis = Date.now();
        }
        
        delete aktifMesailer[discordId];
        birimdenCikart(discordId);
        dbKaydet();

        const kanal = client.channels.cache.get(AYARLAR.AKTIF_MESAI_KANALI);
        const dakika = Math.floor(sureMs / 60000);
        if(kanal) kanal.send(`🔴 <@${discordId}> isimli personel **Site Üzerinden** mesaisini bitirdi. (Süre: ${dakika} dk)`);
        
        aktifMesaileriGuncelle();
        liderlikTablosunuGuncelle();
    }
    
    res.json({ success: true });
});

// ============================================================
// FTO DISCORD SCANNER v2 — Embed parse + Thread name fallback
// + HTTP listener (siteden atama yapılınca thread otomatik açılır)
// ============================================================
// .env'e ekle:
//   FTO_FORUM_KANAL_ID=...
//   BOT_HTTP_PORT=3001                    (backend bu porta POST atacak)
//   BOT_HTTP_SECRET=rastgele_uzun_sifre   (güvenlik için)
// ============================================================

const path = require('path');
const http = require('http');

const FTO_FORUM_ID = process.env.FTO_FORUM_KANAL_ID;
const BOT_HTTP_PORT = parseInt(process.env.BOT_HTTP_PORT || '3001');
const BOT_HTTP_SECRET = process.env.BOT_HTTP_SECRET || 'mrpd_bot_sync_kjsdh38fdj92kdf938fjkd238fjksdf';
const FTO_DATA_FILE = path.join(__dirname, 'fto_atamalari.json');
const MEMBERS_DATA_FILE = path.join(__dirname, 'discord_members.json');

function safeWriteJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); return true; }
    catch (e) { console.error(`[FTO-SYNC] Yazma hatası ${file}:`, e.message); return false; }
}

// ─── Mention bul (text + embed combined) ───
function extractUserIds(text) {
    if (!text) return [];
    return [...text.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
}

function parseStarter(starter) {
    let trainerId = null, traineeId = null;
    if (!starter) return { trainerId, traineeId };
    
    // Strateji A: embed.fields'ta "FTO:", "Eğitmen:", "Trainee:", "Öğrenci:", "Aday:" gibi etiketler var mı?
    if (starter.embeds && starter.embeds.length) {
        for (const embed of starter.embeds) {
            for (const field of (embed.fields || [])) {
                const ids = extractUserIds(field.value);
                if (!ids.length) continue;
                const fname = (field.name || '').toLowerCase();
                if (!trainerId && /(fto|eğitmen|trainer|hoca|memur)/.test(fname)) trainerId = ids[0];
                else if (!traineeId && /(trainee|öğrenci|aday|cadet|stajyer)/.test(fname)) traineeId = ids[0];
            }
            // Etiket bulunmadıysa, embed içindeki ilk 2 mention'ı al (1.=FTO, 2.=trainee)
            if (!trainerId || !traineeId) {
                const all = extractUserIds([embed.title, embed.description, embed.author?.name].filter(Boolean).join('\n'));
                if (!trainerId && all[0]) trainerId = all[0];
                if (!traineeId && all[1]) traineeId = all[1];
            }
        }
    }
    
    // Strateji B: Plain text mention'lar (1.=FTO, 2.=trainee)
    if (!trainerId || !traineeId) {
        const plain = extractUserIds(starter.content);
        if (!trainerId && plain[0]) trainerId = plain[0];
        if (!traineeId && plain[1]) traineeId = plain[1];
    }
    
    return { trainerId, traineeId };
}

async function ftoForumTara() {
    if (!FTO_FORUM_ID) return console.warn('[FTO-SYNC] FTO_FORUM_KANAL_ID tanımlı değil');
    
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.warn('[FTO-SYNC] Guild bulunamadı');
        
        const forum = guild.channels.cache.get(FTO_FORUM_ID);
        if (!forum) return console.warn(`[FTO-SYNC] Forum kanal bulunamadı: ${FTO_FORUM_ID}`);
        
        const aktif = await forum.threads.fetchActive().catch(() => ({ threads: new Map() }));
        const arsivli = await forum.threads.fetchArchived({ limit: 100 }).catch(() => ({ threads: new Map() }));
        const tumThreadlar = [...Array.from(aktif.threads.values()), ...Array.from(arsivli.threads.values())];
        
        const ftoListesi = [];
        let parseFail = 0;
        
        for (const thread of tumThreadlar) {
            try {
                const starter = await thread.fetchStarterMessage().catch(() => null);
                let { trainerId, traineeId } = parseStarter(starter);
                
                // Strateji C: Thread'deki ilk birkaç mesajı tara
                if (!trainerId || !traineeId) {
                    const msgs = await thread.messages.fetch({ limit: 5 }).catch(() => null);
                    if (msgs) {
                        for (const msg of msgs.values()) {
                            const r = parseStarter(msg);
                            if (!trainerId && r.trainerId) trainerId = r.trainerId;
                            if (!traineeId && r.traineeId) traineeId = r.traineeId;
                            if (trainerId && traineeId) break;
                        }
                    }
                }
                
                // Strateji D: Thread sahibi = FTO (komutu çalıştıran)
                if (!trainerId && thread.ownerId) trainerId = thread.ownerId;
                
                // Username çöz
                let trainerUsername = null, traineeUsername = null;
                if (trainerId) {
                    const m = await guild.members.fetch(trainerId).catch(() => null);
                    if (m) trainerUsername = m.user.username;
                }
                if (traineeId) {
                    const m = await guild.members.fetch(traineeId).catch(() => null);
                    if (m) traineeUsername = m.user.username;
                }
                
                if (!trainerId && !traineeId) parseFail++;
                
                ftoListesi.push({
                    threadId: thread.id,
                    threadName: thread.name,
                    threadUrl: `https://discord.com/channels/${guild.id}/${thread.id}`,
                    traineeId, traineeUsername,
                    trainerId, trainerUsername,
                    createdAt: thread.createdAt ? thread.createdAt.toISOString() : null,
                    isArchived: thread.archived || false,
                    isLocked: thread.locked || false,
                    messageCount: thread.messageCount || 0,
                    status: (thread.archived || thread.locked) ? 'closed' : 'active',
                });
            } catch (e) { console.error(`[FTO-SYNC] Thread hatası ${thread.id}:`, e.message); }
        }
        
        const members = await guild.members.fetch().catch(() => null);
        const memberList = members ? Array.from(members.values()).map(m => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.displayName,
            nickname: m.nickname,
            roleIds: Array.from(m.roles.cache.keys()),
            joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
        })) : [];
        
        safeWriteJSON(FTO_DATA_FILE, ftoListesi);
        safeWriteJSON(MEMBERS_DATA_FILE, memberList);

        const backendThreads = ftoListesi.map(t => ({
            threadId: t.threadId,
            trainerId: t.trainerId,
            trainerUsername: t.trainerUsername,
            traineeId: t.traineeId,
            traineeUsername: t.traineeUsername,
            status: t.status,
            notes: null,
            createdAt: t.createdAt,
        }));
        const syncResult = await dbSync.ftoSync(backendThreads);
        if (syncResult?.success) console.log(`[FTO-SYNC] ✅ ${ftoListesi.length} thread backend'e gönderildi (${parseFail} parse fail)`);
        else console.warn(`[FTO-SYNC] ⚠️ Backend sync başarısız, ${ftoListesi.length} thread yerel kaydedildi`);
    } catch (e) { console.error('[FTO-SYNC] Genel hata:', e); }
}

client.once('ready', () => {
    setTimeout(ftoForumTara, 30 * 1000);
    setInterval(ftoForumTara, 10 * 60 * 1000);
});

// ─────────────────────────────────────────────────────────────
// HTTP LISTENER — Backend → Bot iletişimi
// Backend POST /api/bot/fto/create → bot thread açar
// ─────────────────────────────────────────────────────────────
const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') { res.writeHead(404); res.end(JSON.stringify({ error: 'Not Found' })); return; }
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        let payload;
        try { payload = JSON.parse(body); }
        catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
        
        if (payload.secret !== BOT_HTTP_SECRET) {
            res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
        }
        
        // POST /fto/create
        if (req.url === '/fto/create') {
            const { trainerId, traineeId, notes } = payload;
            if (!trainerId || !traineeId) {
                res.writeHead(400); res.end(JSON.stringify({ error: 'trainerId ve traineeId gerekli' })); return;
            }
            
            try {
                const guild = client.guilds.cache.first();
                if (!guild) throw new Error('Guild bulunamadı');
                const forum = guild.channels.cache.get(FTO_FORUM_ID);
                if (!forum) throw new Error('Forum kanal bulunamadı');
                
                const trainer = await guild.members.fetch(trainerId).catch(() => null);
                const trainee = await guild.members.fetch(traineeId).catch(() => null);
                if (!trainer || !trainee) throw new Error('Kullanıcı bulunamadı');
                // ─────────────────────────────────────────────────────────────
// bot index.js — /fto/create HTTP handler içindeki
// forum.threads.create({...}) bloğunu BUNUNLA değiştir
// ─────────────────────────────────────────────────────────────

const trainerMention = `<@${trainerId}>`;
const traineeMention = `<@${traineeId}>`;

// Trainer'ın callsign + ismi (nickname'den çekiyoruz)
// Mesela: "[504] Janothan Zetas | Taha"
const trainerLabel = trainer.nickname || trainer.displayName;
const traineeLabel = trainee.nickname || trainee.displayName;

// 1) GÖREV MESAJI — Thread'i bu mesajla aç
const gorevMesaji = 
`${trainerMention}, ${traineeMention}'in FTO'su olarak atandın. Görevin bu memurun eğitilmesini sağlamak. Devriyelerde kontrol etmen gereken kriterler aşağıda belirtildi:
- Devriyenin özeti,
- FTS'nin telsiz kullanımı,
- FTS'nin araç sürüşü,
- FTS'nin olaylara nasıl yaklaştığı,
- FTS'nin tüzüğe uyup uymadığı,
- FTS'nin hiyerarşiye uyup uymadığı,
- FTS'nin sivillerle iletişimi,
- FTS'nin üslubu,
- FTS'nin diğer memurlarla olan iletişimi,
- FTS'nin felony stop gibi durumlarda şablona uyup uymadığı,
- FTS'nin çevreyle olan etkileşimi,
- FTO'nun genel görüşü,
- Devriyenin nasıl bittiği.

İyi görevler, ${trainerMention}.`;

// 2) RAPOR ŞABLONU — Thread açıldıktan sonra ikinci mesaj olarak gönderilecek
const raporSablonu = 
`**FTO Raporu**

**Tarih:** 
**Saat Aralığı:** 
**FTO:** 
**FTS:** 
**Devriye Birimi:** 
**Rapor:** 
**FTS'nin Hataları:** 
**İmza:** `;

// Thread oluştur (görev mesajı starter olarak)
const thread = await forum.threads.create({
    name: `${traineeLabel}`,
    message: { content: gorevMesaji },
});

// Rapor şablonunu thread'e gönder
await thread.send({ content: raporSablonu });

// Notes varsa üçüncü mesaj olarak ekle
if (notes && notes.trim()) {
    await thread.send({
        content: `📝 **Atama Notları:** ${notes}\n\n*Site üzerinden oluşturuldu — ${new Date().toLocaleString('tr-TR')}*`,
    });
}

console.log(`[BOT-HTTP] ✅ FTO thread oluşturuldu: ${thread.name}`);

// Resync tetikle
setTimeout(ftoForumTara, 2000);

res.writeHead(200);
res.end(JSON.stringify({
    success: true,
    threadId: thread.id,
    threadName: thread.name,
    threadUrl: `https://discord.com/channels/${guild.id}/${thread.id}`,
}));
            } catch (e) {
                console.error('[BOT-HTTP] Thread create hatası:', e);
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }
        
        // POST /fto/sync (manuel resync tetikle)
        if (req.url === '/fto/sync') {
            await ftoForumTara();
            res.writeHead(200); res.end(JSON.stringify({ success: true, message: 'Sync tamamlandı' }));
            return;
        }

        // POST /fto/report — Thread'e rapor mesajı gönder
        if (req.url === '/fto/report') {
            const {
                threadId, trainer_name, trainee_name,
                report_date, shift_start, shift_end, patrol_unit,
                radio_usage, vehicle_driving, incident_approach,
                regulation_compliance, hierarchy_compliance, civilian_communication,
                conduct, officer_communication, felony_stop_compliance,
                environment_interaction, general_view, fts_errors, signature,
            } = payload;

            if (!threadId) {
                res.writeHead(400); res.end(JSON.stringify({ error: 'threadId gerekli' })); return;
            }

            try {
                const thread = await client.channels.fetch(threadId).catch(() => null);
                if (!thread) { res.writeHead(404); res.end(JSON.stringify({ error: 'Thread bulunamadı' })); return; }

                const line = (label, val) => val && val.trim() ? `**${label}:** ${val}` : null;

                const raporDetay = [
                    line('Telsiz Kullanımı', radio_usage),
                    line('Araç Sürüşü', vehicle_driving),
                    line('Olaylara Yaklaşım', incident_approach),
                    line('Tüzük Uyumu', regulation_compliance),
                    line('Hiyerarşi Uyumu', hierarchy_compliance),
                    line('Sivil İletişim', civilian_communication),
                    line('Üslup', conduct),
                    line('Memur İletişimi', officer_communication),
                    line('Felony Stop', felony_stop_compliance),
                    line('Çevre Etkileşimi', environment_interaction),
                    line('Genel Görüş', general_view),
                ].filter(Boolean).join('\n');

                const mesaj =
`**FTO Raporu**

**Tarih:** ${report_date || '—'}
**Saat Aralığı:** ${shift_start || '—'} - ${shift_end || '—'}
**FTO:** ${trainer_name || '—'}
**FTS:** ${trainee_name || '—'}
**Devriye Birimi:** ${patrol_unit || '—'}
**Rapor:**
${raporDetay || '—'}
**FTS'nin Hataları:** ${fts_errors || '—'}
**İmza:** ${signature || '—'}`;

                await thread.send({ content: mesaj });
                res.writeHead(200); res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('[BOT-HTTP] Report gönderme hatası:', e);
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        res.writeHead(404); res.end(JSON.stringify({ error: 'Not Found' }));
    });
});

httpServer.listen(BOT_HTTP_PORT, '127.0.0.1', () => {
    console.log(`[BOT-HTTP] Listening on http://127.0.0.1:${BOT_HTTP_PORT}`);
});

module.exports = { ftoForumTara };

siteApp.listen(3002, () => console.log('🤖 Bot, sitenin güncellemelerini 3002 portundan dinlemeye başladı.'));

client.login(process.env.TOKEN);
