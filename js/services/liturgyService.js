/**
 * Serviço de Liturgia Diária com extração direta da Paulus (paulus.com.br)
 * - 1ª tentativa: Paulus via proxy CORS AllOrigins (https://api.allorigins.win/get?url=...)
 * - 2ª tentativa: Paulus via proxy CORS corsproxy.io (https://corsproxy.io/?...)
 * - Parse HTML completo via DOMParser extraindo todos os blocos e detectando a Oração Eucarística exata
 * - Backup automático: API Liturgia Diária v2 (https://liturgia.up.railway.app/v2/?dia=DD&mes=MM&ano=AAAA)
 * - Referência local offline caso todas as fontes estejam temporariamente indisponíveis.
 */

import { getRecommendedEucharisticPrayerId } from './eucharisticPrayers.js';

const memoryCache = new Map();

async function fetchWithTimeout(url, timeoutMs = 8000, asJson = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return asJson ? await res.json() : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(str) {
  return String(str || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Detecta exatamente qual Oração Eucarística está indicada/transcrita no texto da Paulus.
 * Ordem do mais específico para o mais genérico (ex: III antes de II antes de I; IV antes de I).
 */
export function detectEucharisticPrayerFromText(fullText) {
  const txt = String(fullText || '');
  if (!txt) return null;

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

function detectLiturgicalColor(text) {
  const t = String(text || '').toLowerCase();
  if (/cor\s+lit[úu]rgica\s*:?\s*vermelh|vermelho/.test(t)) return 'Vermelho';
  if (/cor\s+lit[úu]rgica\s*:?\s*branc|branco/.test(t)) return 'Branco';
  if (/cor\s+lit[úu]rgica\s*:?\s*rox|roxo/.test(t)) return 'Roxo';
  if (/cor\s+lit[úu]rgica\s*:?\s*ros|rosa/.test(t)) return 'Rosa';
  if (/cor\s+lit[úu]rgica\s*:?\s*verd|verde/.test(t)) return 'Verde';
  return 'Verde';
}

function extractSectionBlock(lines, startPatterns, stopPatterns) {
  const startIdx = lines.findIndex((line) => startPatterns.some((re) => re.test(line)));
  if (startIdx < 0) return '';

  const collected = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (stopPatterns.some((re) => re.test(line))) break;
    collected.push(line);
  }
  return cleanText(collected.join('\n'));
}

function parseReadingBlock(blockText, fallbackTitle) {
  if (!blockText) return null;
  const lines = blockText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let referencia = '';
  let titulo = fallbackTitle;
  let bodyStart = 0;

  if (lines[0].length <= 90) {
    // Primeira linha geralmente traz a referência ou introdução (ex: "Leitura do Livro..." ou "Ap 15,1-4")
    const refMatch = lines[0].match(/\(([^)]+)\)$/);
    if (refMatch) {
      referencia = refMatch[1].trim();
      titulo = lines[0];
      bodyStart = 1;
    } else if (/^[0-9]?[A-ZÁÉÍÓÚ][a-zA-Zçãõéíóú]{1,5}\s*\d+/.test(lines[0]) && lines[0].length < 40) {
      referencia = lines[0];
      if (lines[1] && lines[1].length < 130) {
        titulo = lines[1];
        bodyStart = 2;
      } else {
        bodyStart = 1;
      }
    } else {
      titulo = lines[0];
      bodyStart = 1;
    }
  }

  const texto = cleanText(lines.slice(bodyStart).join('\n'));
  if (!texto || texto.length < 25) return null;
  return { referencia, titulo, texto };
}

function parsePsalmBlock(blockText) {
  if (!blockText) return null;
  const lines = blockText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let referencia = '';
  let refrao = '';
  const stanzas = [];

  lines.forEach((line, idx) => {
    if (idx === 0 && /sl\s*\d+|salmo\s*\d+/i.test(line) && line.length < 45) {
      referencia = line;
    } else if (!refrao && (/^r\.|^refr[ãa]o|^\s*—/i.test(line) || idx <= 2)) {
      refrao = line.replace(/^r\.\s*|^refr[ãa]o:?\s*/i, '').trim();
    } else {
      stanzas.push(line);
    }
  });

  if (!refrao && stanzas.length === 0) return null;
  return {
    referencia: referencia || 'Salmo Responsorial',
    refrao,
    texto: cleanText(stanzas.join('\n')),
  };
}

function parsePaulusHtml(html, isoDate) {
  if (!html || html.length < 500) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Remove scripts, styles, nav, footer para limpar o conteúdo principal
  doc.querySelectorAll('script, style, nav, footer, header, form, iframe, .menu, .sidebar').forEach((el) => el.remove());

  const mainRoot =
    doc.querySelector('.liturgia-diaria, #liturgia-diaria, .entry-content, article, main') || doc.body;
  if (!mainRoot) return null;

  const titleEl =
    mainRoot.querySelector('h1, h2.titulo-liturgia, .titulo-liturgia, h2') ||
    doc.querySelector('h1');
  const rawTitle = cleanText(titleEl?.textContent || '');

  // Coleta blocos de texto preservando quebras de parágrafo
  const rawLines = [];
  mainRoot.querySelectorAll('h1, h2, h3, h4, p, div.texto, li, blockquote').forEach((el) => {
    // Evita duplicação de contêineres pai que já possuem filhos p/h*
    if (el.tagName === 'DIV' && el.querySelector('p, h1, h2, h3, h4')) return;
    const t = cleanText(el.textContent);
    if (t && t.length > 1) {
      if (rawLines[rawLines.length - 1] !== t) rawLines.push(t);
    }
  });

  const fullText = rawLines.join('\n');
  if (!/evangelho/i.test(fullText) || !/(primeira leitura|1ª leitura|salmo)/i.test(fullText)) {
    return null;
  }

  const ANY_HEADING = [
    /^ant[íi]fona\s+da?\s+entrada/i,
    /^ora[çc][ãa]o\s+do\s+dia|^coleta/i,
    /^(?:primeira|1[ªa])\s+leitura/i,
    /^salmo\s+responsorial/i,
    /^(?:segunda|2[ªa])\s+leitura/i,
    /^aclama[çc][ãa]o\s+ao\s+evangelho/i,
    /^evangelho(?:\s+de|\s*\(|$)/i,
    /^ora[çc][ãa]o\s+sobre\s+as\s+oferendas/i,
    /^pref[áa]cio/i,
    /^ora[çc][ãa]o\s+eucar[íi]stica/i,
    /^ant[íi]fona\s+da\s+comunh[ãa]o/i,
    /^(?:ora[çc][ãa]o\s+)?depois\s+da\s+comunh[ãa]o/i,
    /^reflex[ãa]o|^coment[áa]rio|^santo\s+do\s+dia/i,
  ];

  const entrada = extractSectionBlock(rawLines, [/^ant[íi]fona\s+da?\s+entrada/i], ANY_HEADING);
  const coleta = extractSectionBlock(rawLines, [/^ora[çc][ãa]o\s+do\s+dia|^coleta/i], ANY_HEADING);
  const l1Block = extractSectionBlock(rawLines, [/^(?:primeira|1[ªa])\s+leitura/i], ANY_HEADING);
  const salmoBlock = extractSectionBlock(rawLines, [/^salmo\s+responsorial/i], ANY_HEADING);
  const l2Block = extractSectionBlock(rawLines, [/^(?:segunda|2[ªa])\s+leitura/i], ANY_HEADING);
  const aclamacao = extractSectionBlock(rawLines, [/^aclama[çc][ãa]o\s+ao\s+evangelho/i], ANY_HEADING);
  const evBlock = extractSectionBlock(rawLines, [/^evangelho(?:\s+de|\s*\(|$)/i], ANY_HEADING);
  const oferendas = extractSectionBlock(rawLines, [/^ora[çc][ãa]o\s+sobre\s+as\s+oferendas/i], ANY_HEADING);
  const prefacio = extractSectionBlock(rawLines, [/^pref[áa]cio/i], ANY_HEADING);
  const antComunhao = extractSectionBlock(rawLines, [/^ant[íi]fona\s+da\s+comunh[ãa]o/i], ANY_HEADING);
  const orComunhao = extractSectionBlock(rawLines, [/^(?:ora[çc][ãa]o\s+)?depois\s+da\s+comunh[ãa]o/i], ANY_HEADING);

  const l1 = parseReadingBlock(l1Block, 'Primeira Leitura');
  const salmo = parsePsalmBlock(salmoBlock);
  const l2 = parseReadingBlock(l2Block, 'Segunda Leitura');
  const evParsed = parseReadingBlock(evBlock, 'Proclamação do Evangelho');

  if (!l1 && !evParsed) return null;

  const liturgicalColor = detectLiturgicalColor(fullText);
  const tempoLine = rawLines.find((l) => /tempo\s+(?:comum|pascal|do\s+advento|do\s+natal|da\s+quaresma)|semana\s+do\s+tempo/i.test(l) && l.length < 110) || '';
  const liturgiaTitle =
    rawTitle && !/^liturgia\s+di[áa]ria$/i.test(rawTitle)
      ? rawTitle
      : tempoLine || 'Liturgia Diária — Paulus';

  const detectedOE = detectEucharisticPrayerFromText(fullText);

  const normalized = {
    dateISO: isoDate,
    source: 'paulus',
    sourceLabel: 'Fonte: Liturgia Diária Paulus',
    liturgiaTitle,
    liturgicalSeason: tempoLine,
    liturgicalColor,
    antifonas: {
      entrada: entrada || 'O Senhor é a minha luz e a minha salvação; a quem temerei?',
      comunhao: antComunhao || 'Provai e vede como o Senhor é bom; feliz quem nele confia.',
    },
    oracoes: {
      dia: coleta || '',
      oferendas: oferendas || '',
      comunhao: orComunhao || '',
      prefacio:
        prefacio ||
        `Prefácio de ${liturgiaTitle} — Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso.`,
    },
    leituras: {
      primeiraLeitura: l1,
      salmo,
      segundaLeitura: l2,
      evangelho: evParsed
        ? { ...evParsed, aclamacao: aclamacao || 'Aleluia, Aleluia, Aleluia!' }
        : null,
    },
    detectedEucharisticPrayerInPaulus: Boolean(detectedOE),
  };

  normalized.defaultEucharisticPrayerId =
    detectedOE || getRecommendedEucharisticPrayerId(isoDate, normalized);
  return normalized;
}

function firstItem(val) {
  if (Array.isArray(val)) return val[0] || null;
  if (val && typeof val === 'object') return val;
  return null;
}

function normalizeRailwayV2Backup(raw, isoDate) {
  const leituras = raw?.leituras || {};
  const l1 = firstItem(leituras.primeiraLeitura);
  const salmo = firstItem(leituras.salmo);
  const l2 = firstItem(leituras.segundaLeitura);
  const ev = firstItem(leituras.evangelho);

  const oracoes = raw?.oracoes || {};
  const antifonas = raw?.antifonas || {};
  const cor = raw?.cor || 'Verde';
  const liturgiaTitle = raw?.liturgia || 'Liturgia Diária';

  const normalized = {
    dateISO: isoDate,
    source: 'backup-api-v2',
    sourceLabel: 'Backup: API Liturgia Diária v2 (Paulus temporariamente indisponível)',
    liturgiaTitle,
    liturgicalSeason: liturgiaTitle,
    liturgicalColor: cor,
    antifonas: {
      entrada: antifonas.entrada || 'O Senhor é a minha luz e a minha salvação; a quem temerei?',
      comunhao: antifonas.comunhao || 'Provai e vede como o Senhor é bom; feliz o homem que nele confia.',
    },
    oracoes: {
      dia: oracoes.coleta || oracoes.dia || '',
      oferendas: oracoes.oferendas || '',
      comunhao: oracoes.comunhao || '',
      prefacio:
        oracoes.extras?.[0]?.texto ||
        `Prefácio próprio de ${liturgiaTitle} — Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso, por Cristo, Senhor nosso.`,
    },
    leituras: {
      primeiraLeitura: l1
        ? { referencia: l1.referencia || '', titulo: l1.titulo || 'Primeira Leitura', texto: l1.texto || '' }
        : null,
      salmo: salmo
        ? { referencia: salmo.referencia || '', refrao: salmo.refrao || '', texto: salmo.texto || '' }
        : null,
      segundaLeitura:
        l2 && l2.texto && !String(l2.texto).toLowerCase().includes('não há')
          ? { referencia: l2.referencia || '', titulo: l2.titulo || 'Segunda Leitura', texto: l2.texto || '' }
          : null,
      evangelho: ev
        ? {
            referencia: ev.referencia || '',
            titulo: ev.titulo || 'Proclamação do Evangelho de Jesus Cristo',
            aclamacao: ev.aclamacao || 'Aleluia, Aleluia, Aleluia!',
            texto: ev.texto || '',
          }
        : null,
    },
    detectedEucharisticPrayerInPaulus: false,
  };

  normalized.defaultEucharisticPrayerId = getRecommendedEucharisticPrayerId(isoDate, normalized);
  return normalized;
}

function buildOfflineFallbackLiturgy(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const isSunday = dt.getDay() === 0;
  const liturgiaTitle = isSunday
    ? 'Domingo do Tempo Comum (Referência Litúrgica Local)'
    : 'Féria do Tempo Comum (Referência Litúrgica Local)';

  const data = {
    dateISO: isoDate,
    source: 'offline-fallback',
    sourceLabel: 'Modo Offline / Referência Local',
    liturgiaTitle,
    liturgicalSeason: 'Tempo Comum',
    liturgicalColor: 'Verde',
    antifonas: {
      entrada: 'O Senhor pensa em nós com projetos de paz e não de aflição; vós me invocareis e eu vos atenderei (Jr 29,11-12).',
      comunhao: 'Em verdade vos digo: tudo o que pedirdes na oração, crede que já o recebestes e vos será concedido (Mc 11,24).',
    },
    oracoes: {
      dia: 'Concedei-nos, ó Deus todo-poderoso, a alegria de servir-vos constantemente, pois só há verdadeira e permanente felicidade em servir a vós, criador de todo bem. Por nosso Senhor Jesus Cristo, vosso Filho, que é Deus, e convosco vive e reina, na unidade do Espírito Santo, por todos os séculos dos séculos. Amém.',
      oferendas: 'Concedei, ó Deus, que as oferendas apresentadas diante da vossa majestade nos obtenham a graça de servir-vos fielmente e nos alcancem o prêmio da vida eterna. Por Cristo, nosso Senhor. Amém.',
      comunhao: 'Alimentados pelos dons deste sagrado mistério, nós vos suplicamos, ó Deus, que o serviço que prestamos ao vosso altar nos faça crescer na caridade fraterna. Por Cristo, nosso Senhor. Amém.',
      prefacio:
        'Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso, por Cristo, Senhor nosso.',
    },
    leituras: {
      primeiraLeitura: {
        referencia: 'Rm 12,1-2.9-13',
        titulo: 'Leitura da Carta de São Paulo aos Romanos',
        texto:
          'Irmãos, exorto-vos, pela misericórdia de Deus, a oferecerdes vossos corpos como sacrifício vivo, santo e agradável a Deus: este é o vosso culto espiritual. Não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso espírito. Sede diligentes, sem preguiça; fervorosos no espírito, servi ao Senhor. — Palavra do Senhor.',
      },
      salmo: {
        referencia: 'Sl 99(100)',
        refrao: 'Servi ao Senhor com alegria, vinde a ele cantando de júbilo!',
        texto:
          '1. Aclamai o Senhor, ó terra inteira, servi ao Senhor com alegria!\n2. Sabei que o Senhor, só ele, é Deus, Ele mesmo nos fez, e somos seus.',
      },
      segundaLeitura: isSunday
        ? {
            referencia: 'Fl 2,1-5',
            titulo: 'Leitura da Carta de São Paulo aos Filipenses',
            texto:
              'Irmãos, completai a minha alegria, deixando-vos guiar pelos mesmos sentimentos, no mesmo amor. Tende em vós os mesmos sentimentos de Cristo Jesus. — Palavra do Senhor.',
          }
        : null,
      evangelho: {
        referencia: 'Mc 10,42-45',
        titulo: 'Proclamação do Evangelho de Jesus Cristo segundo Marcos',
        aclamacao: 'Aleluia, Aleluia, Aleluia! O Filho do Homem veio para servir.',
        texto:
          'Naquele tempo, chamando os discípulos, Jesus disse-lhes: “Quem quiser ser grande, seja vosso servo; porque o Filho do Homem não veio para ser servido, mas para servir e dar a sua vida como resgate para muitos”. — Palavra da Salvação.',
      },
    },
    detectedEucharisticPrayerInPaulus: false,
  };

  data.defaultEucharisticPrayerId = getRecommendedEucharisticPrayerId(isoDate, data);
  return data;
}

export const liturgyService = {
  async fetchLiturgyByDate(isoDate) {
    if (!isoDate) return buildOfflineFallbackLiturgy(new Date().toISOString().slice(0, 10));

    if (memoryCache.has(isoDate)) {
      return memoryCache.get(isoDate);
    }

    const sessionKey = `psta_liturgy_v7_${isoDate}`;
    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryCache.set(isoDate, parsed);
        return parsed;
      }
    } catch {
      // ignora sessionStorage
    }

    const [ano, mes, dia] = isoDate.split('-');
    let result = null;

    // 1) Fonte Primária Oficial: Serverless Function Vercel `/api/liturgia-paulus` (Paulus direto sem CORS)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const apiRes = await fetch(`/api/liturgia-paulus?date=${encodeURIComponent(isoDate)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      const contentType = apiRes.headers.get('content-type') || '';
      if (apiRes.ok && contentType.includes('application/json')) {
        const payload = await apiRes.json();
        if (payload?.ok && payload.data) {
          const d = payload.data;
          const suggestedOE = d.oracaoEucaristicaSugerida || d.detectedOEId || null;
          result = {
            ...d,
            source: 'paulus',
            sourceLabel: '📖 Fonte: Liturgia Diária Oficial • Paulus',
            oracaoEucaristicaSugerida: suggestedOE,
            defaultEucharisticPrayerId:
              suggestedOE || getRecommendedEucharisticPrayerId(isoDate, d),
          };
        }
      }
    } catch {
      // fallback silencioso (ex: servidor estático local sem /api ou data futura ainda não publicada pela Paulus)
    }

    // 2) Fallback Automático: API Liturgia Diária v2 (CORS nativo)
    if (!result) {
      try {
        const rawApi = await fetchWithTimeout(
          `https://liturgia.up.railway.app/v2/?dia=${encodeURIComponent(dia)}&mes=${encodeURIComponent(mes)}&ano=${encodeURIComponent(ano)}`,
          6500,
          true,
        );
        if (rawApi && (rawApi.leituras || rawApi.liturgia)) {
          result = normalizeRailwayV2Backup(rawApi, isoDate);
          result.sourceLabel = 'Fonte: Liturgia Diária (Fallback API v2)';
        }
      } catch {
        // fallback silencioso
      }
    }

    // 3) Referência offline local
    if (!result) {
      result = buildOfflineFallbackLiturgy(isoDate);
    }

    memoryCache.set(isoDate, result);
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(result));
    } catch {
      // ignora cota
    }

    return result;
  },
};
