/**
 * Vercel Serverless Function: /api/liturgia-paulus
 * Busca a Liturgia Diária oficial diretamente dos servidores da Paulus (sem bloqueio de CORS),
 * extrai todos os blocos litúrgicos do HTML e retorna JSON padronizado com cache HTTP na borda.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const WEEKDAY_SLUGS = [
  'domingo',
  'segunda-feira',
  'terca-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sabado',
];

function getTodaySaoPauloISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function parseDateParam(rawDate) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || '').trim())
    ? String(rawDate).trim()
    : getTodaySaoPauloISO();
  const [ano, mes, dia] = iso.split('-');
  const dt = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return {
    iso,
    ano,
    mes,
    dia,
    dayNum: Number(dia),
    monthNum: Number(mes),
    yearNum: Number(ano),
    dow: dt.getDay(),
    weekdaySlug: WEEKDAY_SLUGS[dt.getDay()],
  };
}

function decodeHtmlEntities(str) {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    ndash: '–',
    mdash: '—',
    ldquo: '“',
    rdquo: '”',
    lsquo: '‘',
    rsquo: '’',
    hellip: '…',
    ordf: 'ª',
    ordm: 'º',
    aacute: 'á',
    Aacute: 'Á',
    agrave: 'à',
    acirc: 'â',
    atilde: 'ã',
    eacute: 'é',
    Eacute: 'É',
    ecirc: 'ê',
    iacute: 'í',
    Iacute: 'Í',
    oacute: 'ó',
    Oacute: 'Ó',
    ocirc: 'ô',
    otilde: 'õ',
    uacute: 'ú',
    Uacute: 'Ú',
    ccedil: 'ç',
    Ccedil: 'Ç',
  };

  return String(str || '')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name) => (name in named ? named[name] : full));
}

function stripTagsToText(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function extractParagraphs(htmlFragment) {
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(htmlFragment)) !== null) {
    const text = stripTagsToText(m[1]).trim();
    if (text) paragraphs.push(text);
  }
  if (paragraphs.length === 0) {
    const fallback = stripTagsToText(htmlFragment);
    if (fallback) {
      fallback
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => paragraphs.push(l));
    }
  }
  return paragraphs;
}

function detectLiturgicalColor(text) {
  const t = String(text || '').toLowerCase();
  if (/vermelh/.test(t)) return 'Vermelho';
  if (/branc/.test(t)) return 'Branco';
  if (/rox/.test(t)) return 'Roxo';
  if (/ros/.test(t)) return 'Rosa';
  if (/verd/.test(t)) return 'Verde';
  return 'Verde';
}

function detectEucharisticPrayer(fullText) {
  const txt = String(fullText || '');
  const patterns = [
    { id: 'oe_cri_3', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:para\s+)?missas?\s+com\s+crian[çc]as\s+iii\b/i },
    { id: 'oe_cri_2', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:para\s+)?missas?\s+com\s+crian[çc]as\s+ii\b/i },
    { id: 'oe_cri_1', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:para\s+)?missas?\s+com\s+crian[çc]as\s+i\b/i },
    { id: 'oe_rec_2', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:da\s+)?reconcilia[çc][ãa]o\s+ii\b/i },
    { id: 'oe_rec_1', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:da\s+)?reconcilia[çc][ãa]o\s+i\b/i },
    { id: 'oe_4', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:iv|4)\b/i },
    { id: 'oe_3', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:iii|3)\b/i },
    { id: 'oe_2', re: /ora[çc][ãa]o\s+eucar[íi]stica\s+(?:ii|2)\b/i },
    { id: 'oe_1', re: /(?:ora[çc][ãa]o\s+eucar[íi]stica\s+(?:i|1)\b|c[âa]non\s+romano)/i },
  ];
  for (const item of patterns) {
    if (item.re.test(txt)) return item.id;
  }
  return null;
}

async function fetchTextWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extrai a liturgia estruturada do HTML oficial do Portal Paulus (`<div class="titulo-liturgia">` + `<div id="texto">`).
 */
function parsePaulusPortalHtml(html, dateInfo) {
  if (!html || html.length < 500) return null;

  // Verifica o dia exibido no título para garantir que corresponde à data solicitada
  const titleBannerMatch = html.match(/<div[^>]*class="[^"]*titulo-liturgia[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const bannerTitleRaw = titleBannerMatch
    ? stripTagsToText(titleBannerMatch[1].replace(/<div[^>]*class="[^"]*botoes-zoom[\s\S]*$/i, ''))
    : '';

  if (bannerTitleRaw) {
    const dayNumMatch = bannerTitleRaw.match(/\b(\d{1,2})\b/);
    if (dayNumMatch && Number(dayNumMatch[1]) !== dateInfo.dayNum) {
      return null;
    }
  }

  // Isola o bloco principal `<div id="texto">...`
  const textStart = html.search(/<div[^>]*id="texto"[^>]*>/i);
  if (textStart < 0) return null;

  let bodyHtml = html.slice(textStart);
  const stopMarkers = [
    /<div[^>]*id="sidebar-liturgia"/i,
    /<div[^>]*class="[^"]*compartilhe/i,
    /<div[^>]*class="[^"]*navegacao/i,
    /<footer\b/i,
  ];
  for (const re of stopMarkers) {
    const m = bodyHtml.search(re);
    if (m > 0) bodyHtml = bodyHtml.slice(0, m);
  }

  // Divide em seções pelos marcadores `<div class="subtitulo-liturgia">...</div>`
  const sectionRegex = /<div[^>]*class="[^"]*subtitulo-liturgia[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const markers = [];
  let match;
  while ((match = sectionRegex.exec(bodyHtml)) !== null) {
    markers.push({
      heading: stripTagsToText(match[1]),
      start: match.index,
      contentStart: match.index + match[0].length,
    });
  }

  if (markers.length === 0) return null;

  const introHtml = bodyHtml.slice(0, markers[0].start);
  const introParagraphs = extractParagraphs(introHtml);

  let liturgiaTitle = '';
  let liturgicalColor = 'Verde';
  let antifonaEntrada = '';
  let oracaoDia = '';
  let oracaoOferendas = '';
  let antifonaComunhao = '';
  let oracaoComunhao = '';

  introParagraphs.forEach((p) => {
    if (!liturgiaTitle && !p.startsWith('(') && p.length < 140) {
      liturgiaTitle = p;
      return;
    }
    if (/^\([^)]*(verde|branc|rox|vermelh|ros)/i.test(p)) {
      liturgicalColor = detectLiturgicalColor(p);
      return;
    }
    if (!antifonaEntrada && p.length >= 20) {
      antifonaEntrada = p;
    }
  });

  let primeiraLeitura = null;
  let salmo = null;
  let segundaLeitura = null;
  let evangelho = null;

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const nextStart = i + 1 < markers.length ? markers[i + 1].start : bodyHtml.length;
    const chunkHtml = bodyHtml.slice(cur.contentStart, nextStart);
    const heading = cur.heading;
    const hLow = heading.toLowerCase();

    if (/reflex[ãa]o|coment[áa]rio|santo\s+do\s+dia/i.test(hLow)) {
      break;
    }

    const paragraphs = extractParagraphs(chunkHtml);
    if (paragraphs.length === 0) continue;

    const refFromHeading = heading.includes(':') ? heading.split(':').slice(1).join(':').trim() : '';

    if (/^(?:primeira|1[ªa])\s+leitura/i.test(hLow)) {
      const full = paragraphs.join('\n\n');
      const dashIdx = full.indexOf(' – ');
      const titulo =
        dashIdx > 0 && dashIdx < 110 ? full.slice(0, dashIdx).trim() : 'Primeira Leitura';
      const texto = dashIdx > 0 && dashIdx < 110 ? full.slice(dashIdx + 3).trim() : full;
      primeiraLeitura = { referencia: refFromHeading, titulo, texto };
    } else if (/^salmo\s+responsorial/i.test(hLow)) {
      const refrao = paragraphs[0].replace(/^r\.\s*/i, '').trim();
      const texto = paragraphs.slice(1).join('\n');
      salmo = {
        referencia: refFromHeading ? (refFromHeading.toLowerCase().startsWith('sl') ? refFromHeading : `Sl ${refFromHeading}`) : 'Salmo Responsorial',
        refrao,
        texto,
      };
    } else if (/^(?:segunda|2[ªa])\s+leitura/i.test(hLow)) {
      const full = paragraphs.join('\n\n');
      const dashIdx = full.indexOf(' – ');
      const titulo =
        dashIdx > 0 && dashIdx < 110 ? full.slice(0, dashIdx).trim() : 'Segunda Leitura';
      const texto = dashIdx > 0 && dashIdx < 110 ? full.slice(dashIdx + 3).trim() : full;
      segundaLeitura = { referencia: refFromHeading, titulo, texto };
    } else if (/^evangelho/i.test(hLow)) {
      const acclLines = [];
      const gospelLines = [];
      let reachedProclamation = false;
      paragraphs.forEach((p) => {
        if (!reachedProclamation && /^(proclama[çc][ãa]o|naquele tempo|evangelho de)/i.test(p)) {
          reachedProclamation = true;
        }
        if (reachedProclamation) gospelLines.push(p);
        else acclLines.push(p);
      });
      if (gospelLines.length === 0) {
        gospelLines.push(...acclLines.splice(0));
      }
      const fullGospel = gospelLines.join('\n\n');
      const dashIdx = fullGospel.indexOf(' – ');
      const titulo =
        dashIdx > 0 && dashIdx < 120
          ? fullGospel.slice(0, dashIdx).trim()
          : 'Proclamação do Evangelho de Jesus Cristo';
      const texto = dashIdx > 0 && dashIdx < 120 ? fullGospel.slice(dashIdx + 3).trim() : fullGospel;
      evangelho = {
        referencia: refFromHeading,
        titulo,
        aclamacao: acclLines.join('\n') || 'Aleluia, aleluia, aleluia!',
        texto,
      };
    } else if (/ant[íi]fona\s+da?\s+entrada/i.test(hLow)) {
      antifonaEntrada = paragraphs.join('\n');
    } else if (/ora[çc][ãa]o\s+do\s+dia|coleta/i.test(hLow)) {
      oracaoDia = paragraphs.join('\n');
    } else if (/oferendas/i.test(hLow)) {
      oracaoOferendas = paragraphs.join('\n');
    } else if (/ant[íi]fona\s+da?\s+comunh[ãa]o/i.test(hLow)) {
      antifonaComunhao = paragraphs.join('\n');
    } else if (/depois\s+da\s+comunh[ãa]o/i.test(hLow)) {
      oracaoComunhao = paragraphs.join('\n');
    }
  }

  if (!primeiraLeitura && !evangelho) return null;

  const fullPlainText = stripTagsToText(bodyHtml);
  const detectedOE = detectEucharisticPrayer(fullPlainText);

  return {
    dateISO: dateInfo.iso,
    source: 'paulus',
    sourceLabel: '📖 Fonte: Liturgia Diária Oficial • Paulus',
    liturgiaTitle: liturgiaTitle || bannerTitleRaw || 'Liturgia Diária — Paulus',
    liturgicalSeason: liturgiaTitle || bannerTitleRaw || '',
    liturgicalColor,
    antifonas: {
      entrada: antifonaEntrada || '',
      comunhao: antifonaComunhao || '',
    },
    oracoes: {
      dia: oracaoDia || '',
      oferendas: oracaoOferendas || '',
      comunhao: oracaoComunhao || '',
      prefacio: `Prefácio de ${liturgiaTitle || 'hoje'} — Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso.`,
    },
    leituras: {
      primeiraLeitura,
      salmo,
      segundaLeitura,
      evangelho,
    },
    detectedEucharisticPrayerInPaulus: Boolean(detectedOE),
    detectedOEId: detectedOE || null,
  };
}

/**
 * Resolve e busca a página oficial da Paulus para a data solicitada.
 */
async function fetchOfficialPaulusHtml(dateInfo) {
  const { dia, mes, ano, dayNum, weekdaySlug } = dateInfo;

  // 1. Tentativa direta no endpoint clássico Paulus (liturgia.paulus.com.br)
  const legacyUrl = `https://liturgia.paulus.com.br/liturgia/pagina/liturgia.php?dia=${dia}&mes=${mes}&ano=${ano}`;
  const legacyHtml = await fetchTextWithTimeout(legacyUrl, 4500);
  if (legacyHtml && legacyHtml.length > 500) {
    const parsedLegacy = parsePaulusPortalHtml(legacyHtml, dateInfo);
    if (parsedLegacy) return parsedLegacy;
  }

  // 2. Portal Oficial Paulus (https://www.paulus.com.br/portal/liturgia-diaria/)
  const portalUrl = 'https://www.paulus.com.br/portal/liturgia-diaria/';
  const portalHtml = await fetchTextWithTimeout(portalUrl, 8000);
  if (portalHtml) {
    // 2a. Verifica se a página principal já exibe exatamente a data solicitada
    const parsedDirect = parsePaulusPortalHtml(portalHtml, dateInfo);
    if (parsedDirect) {
      // Confirma que estamos no mês/ano atual para evitar falso positivo de outro mês com mesmo dia
      const todaySP = getTodaySaoPauloISO();
      if (dateInfo.iso.slice(0, 7) === todaySP.slice(0, 7)) {
        return parsedDirect;
      }
    }

    // 2b. Busca link direto para a data dentro do portal (ex: /portal/liturgia-diaria/26-quinta-feira-11/)
    const slugPattern = new RegExp(
      `href="(https://www\\.paulus\\.com\\.br/portal/liturgia-diaria/0?${dayNum}-${weekdaySlug}[^"]*)"`,
      'i',
    );
    const linkMatch = portalHtml.match(slugPattern);
    if (linkMatch && linkMatch[1]) {
      const todaySP = getTodaySaoPauloISO();
      // Links do portal principal correspondem à semana corrente / mês corrente
      const diffDays = Math.abs(
        (new Date(`${dateInfo.iso}T12:00:00Z`).getTime() - new Date(`${todaySP}T12:00:00Z`).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (diffDays <= 10) {
        const dayHtml = await fetchTextWithTimeout(linkMatch[1], 8000);
        const parsedDay = parsePaulusPortalHtml(dayHtml, dateInfo);
        if (parsedDay) return parsedDay;
      }
    }
  }

  // 3. Arquivo por data oficial do WordPress da Paulus (/portal/YYYY/MM/DD/?post_type=liturgia-diaria)
  const archiveUrl = `https://www.paulus.com.br/portal/${ano}/${mes}/${dia}/?post_type=liturgia-diaria`;
  const archiveHtml = await fetchTextWithTimeout(archiveUrl, 7000);
  if (archiveHtml) {
    const parsedArchive = parsePaulusPortalHtml(archiveHtml, dateInfo);
    if (parsedArchive) return parsedArchive;

    const postLinkMatch = archiveHtml.match(
      /href="(https:\/\/www\.paulus\.com\.br\/portal\/liturgia-diaria\/[^"]+\/)"/i,
    );
    if (postLinkMatch && postLinkMatch[1]) {
      const postHtml = await fetchTextWithTimeout(postLinkMatch[1], 7000);
      const parsedPost = parsePaulusPortalHtml(postHtml, dateInfo);
      if (parsedPost) return parsedPost;
    }
  }

  return null;
}

/**
 * Complementa orações do Missal (Coleta, Oferendas, Comunhão) quando a edição web gratuita
 * da Paulus traz apenas Antífona de Entrada + Leituras + Salmo + Evangelho.
 */
async function enrichMissingPrayers(paulusData, dateInfo) {
  const needsPrayers =
    !paulusData.oracoes.dia ||
    !paulusData.oracoes.oferendas ||
    !paulusData.oracoes.comunhao ||
    !paulusData.antifonas.comunhao;
  if (!needsPrayers) return paulusData;

  const v2 = await fetchJsonWithTimeout(
    `https://liturgia.up.railway.app/v2/?dia=${dateInfo.dia}&mes=${dateInfo.mes}&ano=${dateInfo.ano}`,
    5000,
  );
  if (!v2) return paulusData;

  const oracoes = v2.oracoes || {};
  const antifonas = v2.antifonas || {};
  if (!paulusData.oracoes.dia && (oracoes.coleta || oracoes.dia)) {
    paulusData.oracoes.dia = oracoes.coleta || oracoes.dia;
  }
  if (!paulusData.oracoes.oferendas && oracoes.oferendas) {
    paulusData.oracoes.oferendas = oracoes.oferendas;
  }
  if (!paulusData.oracoes.comunhao && oracoes.comunhao) {
    paulusData.oracoes.comunhao = oracoes.comunhao;
  }
  if (!paulusData.antifonas.comunhao && antifonas.comunhao) {
    paulusData.antifonas.comunhao = antifonas.comunhao;
  }
  if (!paulusData.antifonas.entrada && antifonas.entrada) {
    paulusData.antifonas.entrada = antifonas.entrada;
  }
  return paulusData;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const dateInfo = parseDateParam(req.query?.date);
    const paulusData = await fetchOfficialPaulusHtml(dateInfo);

    if (!paulusData) {
      return res.status(200).json({
        ok: false,
        fallback: true,
        dateISO: dateInfo.iso,
        reason: 'paulus_unavailable_for_date',
      });
    }

    await enrichMissingPrayers(paulusData, dateInfo);

    return res.status(200).json({
      ok: true,
      data: paulusData,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      fallback: true,
      error: err?.message || 'Erro interno ao consultar Liturgia da Paulus',
    });
  }
};
