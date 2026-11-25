/**
 * Serviço de Liturgia Diária do Brasil
 * - Busca real na API primária: https://liturgia.up.railway.app/v2/?dia=DD&mes=MM&ano=AAAA
 * - Fallback automático: https://api-liturgia-diaria.vercel.app/?date=AAAA-MM-DD
 * - Fallback offline elegante (sem erros no console) caso ambas estejam indisponíveis.
 */

import { getRecommendedEucharisticPrayerId } from './eucharisticPrayers.js';

const memoryCache = new Map();

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function firstItem(val) {
  if (Array.isArray(val)) return val[0] || null;
  if (val && typeof val === 'object') return val;
  return null;
}

function normalizeRailwaysV2(raw, isoDate) {
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
    source: 'api-v2',
    sourceLabel: 'Liturgia Diária (API Oficial v2)',
    liturgiaTitle,
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
  };

  normalized.defaultEucharisticPrayerId = getRecommendedEucharisticPrayerId(isoDate, normalized);
  return normalized;
}

function normalizeVercelApi(raw, isoDate) {
  const l1 = firstItem(raw?.primeiraLeitura || raw?.leituras?.primeiraLeitura);
  const salmo = firstItem(raw?.salmo || raw?.leituras?.salmo);
  const l2 = firstItem(raw?.segundaLeitura || raw?.leituras?.segundaLeitura);
  const ev = firstItem(raw?.evangelho || raw?.leituras?.evangelho);

  const liturgiaTitle = raw?.liturgia || raw?.titulo || 'Liturgia Diária';
  const cor = raw?.cor || 'Verde';

  const normalized = {
    dateISO: isoDate,
    source: 'api-vercel',
    sourceLabel: 'Liturgia Diária (API Fallback)',
    liturgiaTitle,
    liturgicalColor: cor,
    antifonas: {
      entrada: raw?.antifonas?.entrada || raw?.antifonaEntrada || 'Cantai ao Senhor um cântico novo, cantai ao Senhor, terra inteira!',
      comunhao: raw?.antifonas?.comunhao || raw?.antifonaComunhao || 'O Senhor nos alimenta com a flor do trigo e nos sacia com o mel do rochedo.',
    },
    oracoes: {
      dia: raw?.dia || raw?.oracoes?.coleta || raw?.oracaoDia || '',
      oferendas: raw?.oferendas || raw?.oracoes?.oferendas || '',
      comunhao: raw?.comunhao || raw?.oracoes?.comunhao || '',
      prefacio:
        raw?.prefacio ||
        `Prefácio de ${liturgiaTitle} — Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso.`,
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
            titulo: ev.titulo || 'Proclamação do Evangelho',
            aclamacao: ev.aclamacao || 'Aleluia, Aleluia!',
            texto: ev.texto || '',
          }
        : null,
    },
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
        'Na verdade, é justo e necessário, é nosso dever e salvação dar-vos graças, sempre e em todo lugar, Senhor, Pai santo, Deus eterno e todo-poderoso, por Cristo, Senhor nosso. Nele, quisestes restaurar todas as coisas e nos fizestes participar da sua plenitude.',
    },
    leituras: {
      primeiraLeitura: {
        referencia: 'Rm 12,1-2.9-13',
        titulo: 'Leitura da Carta de São Paulo aos Romanos',
        texto:
          'Irmãos, exorto-vos, pela misericórdia de Deus, a oferecerdes vossos corpos como sacrifício vivo, santo e agradável a Deus: este é o vosso culto espiritual. Não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso espírito, para que possais discernir qual é a vontade de Deus, o que é bom, o que lhe agrada e o que é perfeito. O amor seja sem fingimento. Detestai o mal e apegai-vos ao bem. Amai-vos mutuamente com afeição fraterna; quanto à estima, procurai antecipar-vos uns aos outros. Sede diligentes, sem preguiça; fervorosos no espírito, servi ao Senhor. — Palavra do Senhor.',
      },
      salmo: {
        referencia: 'Sl 99(100)',
        refrao: 'Servi ao Senhor com alegria, vinde a ele cantando de júbilo!',
        texto:
          '1. Aclamai o Senhor, ó terra inteira, servi ao Senhor com alegria, ide a ele cantando jubilosos!\n2. Sabei que o Senhor, só ele, é Deus, Ele mesmo nos fez, e somos seus, nós somos seu povo e seu rebanho.\n3. Entrai por suas portas dando graças, e em seus átrios com hinos de louvor; dai-lhe graças, seu nome bendizei!\n4. Sim, é bom o Senhor e nosso Deus, sua bondade perdura para sempre, seu amor é fiel eternamente!',
      },
      segundaLeitura: isSunday
        ? {
            referencia: 'Fl 2,1-5',
            titulo: 'Leitura da Carta de São Paulo aos Filipenses',
            texto:
              'Irmãos, se existe alguma consolação em Cristo, algum estímulo na caridade, alguma comunhão no Espírito, alguma ternura e compaixão, completai a minha alegria, deixando-vos guiar pelos mesmos sentimentos, no mesmo amor, numa só alma, num só pensamento. Nada façais por rivalidade ou vanglória, mas, com humildade, cada um considere os outros superiores a si mesmo. Tende em vós os mesmos sentimentos de Cristo Jesus. — Palavra do Senhor.',
          }
        : null,
      evangelho: {
        referencia: 'Mc 10,42-45',
        titulo: 'Proclamação do Evangelho de Jesus Cristo segundo Marcos',
        aclamacao: 'Aleluia, Aleluia, Aleluia! O Filho do Homem veio para servir e dar a vida em resgate por muitos.',
        texto:
          'Naquele tempo, chamando os discípulos, Jesus disse-lhes: “Vós sabeis que os chefes das nações as oprimem e os grandes as tiranizam. Mas, entre vós, não deve ser assim: quem quiser ser grande, seja vosso servo; e quem quiser ser o primeiro, seja o escravo de todos. Porque o Filho do Homem não veio para ser servido, mas para servir e dar a sua vida como resgate para muitos”. — Palavra da Salvação.',
      },
    },
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

    const sessionKey = `psta_liturgy_cache_${isoDate}`;
    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryCache.set(isoDate, parsed);
        return parsed;
      }
    } catch {
      // ignora erro de sessionStorage
    }

    const [ano, mes, dia] = isoDate.split('-');
    let result = null;

    // 1) API Primária: Liturgia Diária v2 (Railway)
    try {
      const raw1 = await fetchJsonWithTimeout(
        `https://liturgia.up.railway.app/v2/?dia=${encodeURIComponent(dia)}&mes=${encodeURIComponent(mes)}&ano=${encodeURIComponent(ano)}`,
        6500,
      );
      if (raw1 && (raw1.leituras || raw1.liturgia)) {
        result = normalizeRailwaysV2(raw1, isoDate);
      }
    } catch {
      // Fallback silencioso para a segunda API
    }

    // 2) Fallback Automático: API Liturgia Diária (Vercel)
    if (!result) {
      try {
        const raw2 = await fetchJsonWithTimeout(
          `https://api-liturgia-diaria.vercel.app/?date=${encodeURIComponent(isoDate)}`,
          6500,
        );
        if (raw2 && (raw2.evangelho || raw2.leituras || raw2.liturgia)) {
          result = normalizeVercelApi(raw2, isoDate);
        }
      } catch {
        // Fallback silencioso para referência local
      }
    }

    // 3) Referência offline elegante
    if (!result) {
      result = buildOfflineFallbackLiturgy(isoDate);
    }

    memoryCache.set(isoDate, result);
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(result));
    } catch {
      // ignora cota cheia
    }

    return result;
  },
};
