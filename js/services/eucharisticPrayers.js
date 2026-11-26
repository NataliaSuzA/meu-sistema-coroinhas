/**
 * Biblioteca completa das Orações Eucarísticas do Missal Romano (3ª Edição Brasileira)
 * para leitura integral na tela de Liturgia Diária e vinculação ao Roteiro do Celebrante.
 */

const DIALOGO_E_SANTO = {
  heading: 'Diálogo Inicial & Santo',
  paragraphs: [
    'P. O Senhor esteja convosco. — T. Ele está no meio de nós.',
    'P. Corações ao alto. — T. O nosso coração está em Deus.',
    'P. Demos graças ao Senhor, nosso Deus. — T. É nosso dever e nossa salvação.',
    '(Segue o Prefácio do dia, concluído com o Santo:)',
    'T. Santo, Santo, Santo, Senhor, Deus do universo. O céu e a terra proclamam a vossa glória. Hosana nas alturas! Bendito o que vem em nome do Senhor. Hosana nas alturas!',
  ],
};

const DOXOLOGIA_FINAL = {
  heading: 'Doxologia Final',
  paragraphs: [
    'P. Por Cristo, com Cristo, e em Cristo, a vós, Deus Pai todo-poderoso, na unidade do Espírito Santo, toda honra e toda glória, por todos os séculos dos séculos.',
    'T. Amém!',
  ],
};

export const EUCHARISTIC_PRAYERS = [
  {
    id: 'oe_1',
    shortName: 'OE I — Cânon Romano',
    name: 'Oração Eucarística I (Cânon Romano)',
    whenUsed: 'Indicada especialmente para Domingos, Solenidades e festas dos Santos mencionados no Cânon.',
    prefaceSuggestion: 'Prefácio próprio da Solenidade, Festa ou Domingo.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Invocação e Oferta da Igreja (Te ígitur)',
        paragraphs: [
          'Pai de misericórdia, a quem sobem nossos louvores, suplicantes, vos rogamos e pedimos por Jesus Cristo, vosso Filho e Senhor nosso, que aceiteis e abençoeis estes dons, estas oferendas, este sacrifício puro e santo, que oferecemos, antes de tudo, pela vossa Igreja santa e católica: concedei-lhe paz e proteção, unindo-a num só corpo e governando-a por toda a terra, em comunhão com vosso servo o Papa, o nosso Bispo, e todos os que guardam a fé católica que receberam dos Apóstolos.',
          'T. Abençoai nossa oferenda, ó Senhor!',
        ],
      },
      {
        heading: 'Lembrança dos Vivos e Comunhão dos Santos',
        paragraphs: [
          'Lembrai-vos, ó Pai, dos vossos filhos e filhas e de todos os que circundam este altar, dos quais conheceis a fé e a dedicação ao vosso serviço. Por eles nós vos oferecemos e também eles vos oferecem este sacrifício de louvor por si e por todos os seus, e elevam a vós as suas preces, Deus eterno, vivo e verdadeiro, para alcançar o perdão de suas faltas, a segurança em suas vidas e a salvação que esperam.',
          'Em comunhão com toda a Igreja, celebramos em primeiro lugar a memória da Mãe de nosso Deus e Senhor Jesus Cristo, a gloriosa sempre Virgem Maria, a de seu esposo São José, e também a dos Santos Apóstolos e Mártires: Pedro e Paulo, André, Tiago e João, Tomé, Tiago e Filipe, Bartolomeu e Mateus, Simão e Tadeu, Lino, Cleto, Clemente, Sisto, Cornélio e Cipriano, Lourenço e Crisógono, João e Paulo, Cosme e Damião, e a de todos os vossos Santos. Por seus méritos e preces concedei-nos sem cessar a vossa proteção.',
          'T. Em comunhão com vossos Santos vos louvamos!',
        ],
      },
      {
        heading: 'Consagração e Narrativa da Instituição',
        paragraphs: [
          'Aceitai, ó Pai, com bondade, a oblação dos vossos servos e de toda a vossa família; dai-nos sempre a vossa paz, livrai-nos da condenação eterna e acolhei-nos entre os vossos eleitos. Dignai-vos, ó Pai, aceitar, abençoar e santificar estas oferendas; recebei-as como sacrifício espiritual perfeito, a fim de que se tornem para nós o Corpo e o Sangue de vosso amado Filho, nosso Senhor Jesus Cristo.',
          'Na véspera de sua paixão, ele tomou o pão em suas santas e veneráveis mãos, elevou os olhos ao céu, a vós, ó Pai todo-poderoso, pronunciou a bênção de ação de graças, partiu o pão e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Do mesmo modo, no fim da ceia, ele tomou este precioso cálice em suas santas e veneráveis mãos, pronunciou novamente a bênção de ação de graças e o deu a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição. Vinde, Senhor Jesus!',
        ],
      },
      {
        heading: 'Anamnese, Oferta e Lembrança dos Falecidos',
        paragraphs: [
          'Celebrando, pois, a memória da bem-aventurada paixão do vosso Filho, da sua ressurreição dentre os mortos e gloriosa ascensão aos céus, nós, vossos servos, e também vosso povo santo, vos oferecemos, ó Pai, dentre os bens que nos destes, o sacrifício puro, santo e imaculado, Pão santo da vida eterna e Cálice da perpétua salvação. Recebei, ó Pai, com olhar benigno, esta oferta, como recebestes os dons do justo Abel, o sacrifício de nosso patriarca Abraão e a oblação pura e santa do sumo sacerdote Melquisedeque.',
          'Suplicantes, vos pedimos, ó Deus onipotente, que esta nossa oferenda seja levada à vossa presença, no altar do céu, pelas mãos do vosso santo Anjo, para que todos nós, participando deste altar pela comunhão do santíssimo Corpo e Sangue do vosso Filho, sejamos repletos de todas as graças e bênçãos do céu.',
          'Lembrai-vos, ó Pai, dos vossos filhos e filhas que nos precederam com o sinal da fé e dormem o sono da paz. A eles, e a todos os que descansam no Cristo, concedei o repouso, a luz e a paz. E a todos nós pecadores, que esperamos na vossa infinita misericórdia, concedei, não por nossos méritos, mas por vossa bondade, o convívio dos Apóstolos e Mártires, de João Batista e Estêvão, Matias e Barnabé, e de todos os vossos Santos.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_2',
    shortName: 'OE II',
    name: 'Oração Eucarística II',
    whenUsed: 'Indicada especialmente para dias de semana e celebrações em que se busca maior concisão.',
    prefaceSuggestion: 'Prefácio próprio da OE II ou Prefácio do Tempo Litúrgico.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Epiclese sobre as Oferendas',
        paragraphs: [
          'Na verdade, ó Pai, vós sois Santo, fonte de toda santidade. Santificai, pois, estes dons, derramando sobre eles o vosso Espírito, a fim de que se tornem para nós o Corpo e o Sangue de nosso Senhor Jesus Cristo.',
          'T. Enviai o vosso Espírito Santo!',
        ],
      },
      {
        heading: 'Narrativa da Instituição e Consagração',
        paragraphs: [
          'Estando para ser entregue e abraçando livremente a paixão, Jesus tomou o pão, pronunciou a bênção de ação de graças, partiu e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Do mesmo modo, no fim da ceia, ele tomou o cálice em suas mãos e, dando graças novamente, o entregou a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição. Vinde, Senhor Jesus!',
        ],
      },
      {
        heading: 'Anamnese e Intercessões',
        paragraphs: [
          'Celebrando, pois, o memorial da morte e ressurreição do vosso Filho, nós vos oferecemos, ó Pai, o Pão da vida e o Cálice da salvação; e vos agradecemos porque nos tornastes dignos de estar aqui na vossa presença e vos servir.',
          'Suplicantes, vos pedimos que, participando do Corpo e Sangue de Cristo, sejamos reunidos pelo Espírito Santo num só corpo. — T. O Espírito nos una num só corpo!',
          'Lembrai-vos, ó Pai, da vossa Igreja que se faz presente pelo mundo inteiro; que ela cresça na caridade, em comunhão com o Papa, com o nosso Bispo, os bispos do mundo inteiro, os presbíteros, os diáconos e todos os ministros do vosso povo. — T. Lembrai-vos, ó Pai, da vossa Igreja!',
          'Lembrai-vos também, na vossa misericórdia, dos nossos irmãos e irmãs que adormeceram na esperança da ressurreição e de todos os que partiram desta vida; acolhei-os junto a vós na luz da vossa face. — T. Concedei-lhes, ó Senhor, a luz eterna!',
          'Enfim, nós vos pedimos, tende piedade de todos nós e dai-nos participar da vida eterna, com a Virgem Maria, Mãe de Deus, São José, seu esposo, os Apóstolos, Santa Teresa d’Ávila e todos os Santos que neste mundo viveram na vossa amizade, a fim de vos louvarmos e glorificarmos por Jesus Cristo, vosso Filho.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_3',
    shortName: 'OE III',
    name: 'Oração Eucarística III',
    whenUsed: 'Recomendada para Domingos e festas, podendo ser usada com qualquer Prefácio do Missal.',
    prefaceSuggestion: 'Prefácio do Domingo, Solenidade ou Memória celebrada.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Louvor e Epiclese sobre as Oferendas',
        paragraphs: [
          'Na verdade, vós sois Santo, ó Deus do universo, e tudo o que criastes proclama o vosso louvor, porque, por Jesus Cristo, vosso Filho e Senhor nosso, e pela força do Espírito Santo, dais vida e santidade a todas as coisas e não cessais de reunir para vós um povo que vos ofereça em toda parte, do nascer ao pôr do sol, um sacrifício perfeito.',
          'Por isso, ó Pai, nós vos suplicamos: santificai pelo Espírito Santo as oferendas que vos apresentamos para serem consagradas a fim de que se tornem o Corpo e o Sangue de vosso Filho, nosso Senhor Jesus Cristo, que nos mandou celebrar estes mistérios. — T. Enviai o vosso Espírito Santo!',
        ],
      },
      {
        heading: 'Narrativa da Instituição e Consagração',
        paragraphs: [
          'Na noite em que ia ser entregue, Jesus tomou o pão, pronunciou a bênção de ação de graças, partiu e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Do mesmo modo, no fim da ceia, ele tomou o cálice em suas mãos, pronunciou a bênção de ação de graças, e o deu a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé e do amor! — T. Todas as vezes que comemos deste pão e bebemos deste cálice, anunciamos, Senhor, a vossa morte, enquanto esperamos a vossa vinda!',
        ],
      },
      {
        heading: 'Anamnese, Epiclese da Comunhão e Intercessões',
        paragraphs: [
          'Celebrando agora, ó Pai, o memorial da paixão redentora do vosso Filho, da sua gloriosa ressurreição e ascensão ao céu, e enquanto esperamos sua nova vinda, nós vos oferecemos em ação de graças este sacrifício vivo e santo. Olhai com bondade a oblação da vossa Igreja e reconhecei nela o sacrifício que nos reconciliou convosco; concedei que, alimentando-nos com o Corpo e o Sangue do vosso Filho, repletos do Espírito Santo, nos tornemos em Cristo um só corpo e um só espírito. — T. O Espírito nos una num só corpo!',
          'Que o mesmo Espírito faça de nós uma eterna oferenda para alcançarmos a herança com os vossos eleitos: a santíssima Virgem Maria, Mãe de Deus, São José, seu esposo, os vossos santos Apóstolos e gloriosos Mártires, Santa Teresa d’Ávila e todos os Santos, que não cessam de interceder por nós na vossa presença. — T. Fazei de nós uma perfeita oferenda!',
          'Nós vos suplicamos, Senhor, que este sacrifício da nossa reconciliação estenda a paz e a salvação ao mundo inteiro. Confirmai na fé e na caridade a vossa Igreja que caminha neste mundo com o vosso servo o Papa, o nosso Bispo, com os bispos do mundo inteiro, os presbíteros e diáconos, os outros ministros e o povo por vós redimido. Atendei propício às preces desta família, que reunistes em vossa presença. Reconduzi a vós, Pai de misericórdia, todos os vossos filhos e filhas dispersos pelo mundo inteiro. — T. Lembrai-vos, ó Pai, da vossa Igreja!',
          'Acolhei com bondade no vosso reino os nossos irmãos e irmãs que partiram desta vida e todos os que morreram na vossa amizade. Unidos a eles, esperamos também nós saciar-nos eternamente da vossa glória, por Cristo, Senhor nosso. Por ele dais ao mundo todo bem e toda graça.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_4',
    shortName: 'OE IV',
    name: 'Oração Eucarística IV',
    whenUsed: 'Usada com seu prefácio inseparável (síntese da História da Salvação), especialmente no Tempo Comum.',
    prefaceSuggestion: 'Prefácio próprio inseparável da Oração Eucarística IV.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'História da Salvação e Epiclese',
        paragraphs: [
          'Nós vos louvamos, Pai santo, porque sois grande e realizastes todas as coisas com sabedoria e amor. Criastes o ser humano à vossa imagem e lhe confiastes o cuidado do universo. Quando, por desobediência, perdeu a vossa amizade, não o abandonastes ao poder da morte, mas socorrestes a todos com misericórdia. Muitas vezes fizestes aliança com os homens e os instruístes pelos profetas na esperança da salvação.',
          'E de tal modo amastes o mundo, Pai santo, que, chegada a plenitude dos tempos, nos enviastes vosso próprio Filho como Salvador. Ele anunciou a boa-nova da salvação aos pobres, a libertação aos cativos, a alegria aos aflitos. Para cumprir o vosso plano, entregou-se à morte e, ressuscitando, destruiu a morte e renovou a vida. — T. A todos dai a vida, ó Senhor!',
          'Nós vos pedimos, ó Pai, que o mesmo Espírito Santo santifique estas oferendas, a fim de que se tornem o Corpo e o Sangue de nosso Senhor Jesus Cristo para celebrarmos este grande mistério que ele nos deixou em sinal da eterna aliança.',
        ],
      },
      {
        heading: 'Narrativa da Instituição e Consagração',
        paragraphs: [
          'Quando chegou a hora em que por vós, ó Pai, devia ser glorificado, tendo amado os seus que estavam no mundo, amou-os até o fim. Enquanto ceavam, ele tomou o pão, deu graças, partiu e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Do mesmo modo, ele tomou em suas mãos o cálice com vinho, deu graças novamente, e o deu a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé para a salvação do mundo! — T. Salvador do mundo, salvai-nos, vós que nos libertastes pela cruz e ressurreição!',
        ],
      },
      {
        heading: 'Anamnese e Intercessões Universais',
        paragraphs: [
          'Celebrando agora, ó Pai, o memorial da nossa redenção, anunciamos a morte de Cristo e sua descida à mansão dos mortos, proclamamos a sua ressurreição e ascensão à vossa direita e, esperando a sua vinda gloriosa, nós vos oferecemos o seu Corpo e Sangue, sacrifício digno de vós e salvação para o mundo inteiro. — T. Recebei, ó Senhor, a nossa oferta!',
          'Olhai, ó Pai, para a vítima que vós mesmo preparastes para a vossa Igreja; e concedei aos que vão participar deste único pão e deste único cálice que, reunidos pelo Espírito Santo num só corpo, se tornem em Cristo uma oferenda viva para o louvor da vossa glória.',
          'Lembrai-vos agora, ó Pai, de todos aqueles por quem oferecemos este sacrifício: do Papa, do nosso Bispo, dos bispos do mundo inteiro, dos presbíteros, dos diáconos, de todos os que fazem esta oferta e de todo o vosso povo. Lembrai-vos também dos que morreram na paz de Cristo e de todos os falecidos, cuja fé só vós conheceis. Concedei a todos nós, vossos filhos, alcançar a herança celeste com a Virgem Maria, São José, os Apóstolos e os Santos, para vos glorificarmos no vosso reino.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_rec_1',
    shortName: 'Reconciliação I',
    name: 'Oração Eucarística da Reconciliação I',
    whenUsed: 'Indicada especialmente para a Quaresma, celebrações penitenciais e tempos de conversão.',
    prefaceSuggestion: 'Prefácio próprio da Reconciliação I (Volta para Deus).',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Louvor pela Misericórdia e Epiclese',
        paragraphs: [
          'Nós vos damos graças, Pai todo-poderoso, e vos bendizemos por Jesus Cristo, vosso Filho, que veio em vosso nome. Ele é a Palavra que salva, a mão que estendeis aos pecadores, o caminho pelo qual nos é oferecida a vossa paz. Quando nos afastamos de vós pelos nossos pecados, vós nos reconduzistes à reconciliação, para que nos amássemos uns aos outros pelo vosso Filho, que entregastes à morte por nós.',
          'Celebrando agora a reconciliação que Cristo nos trouxe, nós vos suplicamos: santificai estas oferendas pela efusão do vosso Espírito, para que se tornem o Corpo e o Sangue do vosso Filho, que nos mandou celebrar estes mistérios. — T. Santificai nossa oferenda pelo Espírito!',
        ],
      },
      {
        heading: 'Narrativa da Instituição e Consagração',
        paragraphs: [
          'Antes de dar a vida para nos libertar, estando à mesa com os discípulos, Jesus tomou o pão em suas mãos, deu graças, partiu e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Naquela mesma noite, tomou o cálice em suas mãos e, proclamando a vossa misericórdia, deu-o a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição. Vinde, Senhor Jesus!',
        ],
      },
      {
        heading: 'Oferta da Reconciliação e Intercessões',
        paragraphs: [
          'Celebrando, pois, o memorial da morte e ressurreição do vosso Filho, que nos deixou este penhor de seu amor, nós vos oferecemos o que de vós recebemos: o sacrifício da perfeita reconciliação. Pai santo, nós vos pedimos que nos acolhais também com vosso Filho e que, neste banquete salvador, nos deis o seu próprio Espírito, que afasta tudo o que impede a unidade. — T. Fazei-nos instrumentos de vossa paz!',
          'Ele conserve a vossa Igreja como sinal de unidade e instrumento de paz entre os povos, em comunhão com o Papa, nosso Bispo, e todos os ministros. Assim como nos reunistes à mesa do vosso Filho, reuni-nos também com a Virgem Maria, Mãe de Deus, São José, os Apóstolos e todos os Santos, com nossos irmãos e irmãs falecidos, no banquete eterno da reconciliação.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_rec_2',
    shortName: 'Reconciliação II',
    name: 'Oração Eucarística da Reconciliação II',
    whenUsed: 'Indicada para missas pela paz, justiça, reconciliação e tempo quaresmal.',
    prefaceSuggestion: 'Prefácio próprio da Reconciliação II (Paz e reconciliação em Cristo).',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Oração pela Paz e Epiclese',
        paragraphs: [
          'Vós sois verdadeiramente santo, ó Pai, pois desde o início do mundo realizais sempre o que é bom para nós, para que sejamos santos como vós sois santo. Olhai com bondade para o vosso povo reunido e derramai sobre estas oferendas a força do vosso Espírito, para que se tornem para nós o Corpo e o Sangue do vosso amado Filho Jesus Cristo, no qual somos vossos filhos e filhas. — T. Enviai o vosso Espírito de amor!',
        ],
      },
      {
        heading: 'Narrativa da Instituição e Consagração',
        paragraphs: [
          'Quando estávamos perdidos e incapazes de voltar a vós, vós nos amastes com imenso amor: vosso Filho, único justo, entregou-se à morte e não recusou ser pregado na cruz por nós. Antes de abrir os braços entre o céu e a terra em sinal da vossa aliança, quis celebrar a Páscoa com seus discípulos.',
          'Enquanto ceava, tomou o pão, pronunciou a bênção de ação de graças, partiu e o deu a seus discípulos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Do mesmo modo, no fim da ceia, sabendo que ia reconciliar todas as coisas no seu sangue derramado na cruz, tomou o cálice com vinho, deu graças novamente e o passou a seus discípulos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição. Vinde, Senhor Jesus!',
        ],
      },
      {
        heading: 'Compromisso Fraterno e Intercessões',
        paragraphs: [
          'Celebrando o memorial do vosso Filho Jesus Cristo, nossa Páscoa e nossa paz definitiva, oferecemos a vós esta vítima que reconcilia a humanidade convosco. Olhai com ternura, Pai misericordioso, os que unis a vós pelo sacrifício do vosso Filho, e fazei que, pela força do Espírito Santo, sejamos reunidos num só corpo, curados de toda divisão. — T. Renovai a Igreja na unidade e na paz!',
          'Guardai-nos sempre em comunhão de mente e coração com o Papa e nosso Bispo. Ajudai-nos a preparar juntos a vinda do vosso Reino, até o dia em que nos encontraremos diante de vós com a Virgem Maria, São José, os Apóstolos, os Santos e todos os nossos irmãos falecidos que confiamos à vossa misericórdia.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_cri_1',
    shortName: 'Crianças I',
    name: 'Oração Eucarística para Missas com Crianças I',
    whenUsed: 'Indicada para celebrações com predominância de crianças e catequese.',
    prefaceSuggestion: 'Prefácio próprio com aclamações participativas das crianças.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Ação de Graças e Epiclese',
        paragraphs: [
          'Deus, nosso Pai, vós nos reunistes aqui para celebrarmos com alegria a nossa fé e vos agradecer por todo o bem que nos fazeis. Vosso Filho Jesus veio ao mundo para nos mostrar como vos amar e como amar uns aos outros.',
          'Por isso, Pai querido, enviamos a vós o nosso pedido: mandai o vosso Espírito Santo para que este pão e este vinho se tornem o Corpo e o Sangue de Jesus, nosso Senhor. — T. Bendito o que vem em nome do Senhor!',
        ],
      },
      {
        heading: 'Consagração',
        paragraphs: [
          'Na noite antes de morrer por nós, Jesus estava à mesa com seus amigos. Ele tomou o pão, deu graças, partiu e o deu a eles, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Depois, tomou o cálice com vinho, deu graças novamente e o deu aos seus amigos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Jesus morreu por nós e ressuscitou! — T. Glória a vós, Senhor Jesus!',
        ],
      },
      {
        heading: 'Oferta e Oração pela Igreja',
        paragraphs: [
          'Agora, Pai santo, lembrando com alegria tudo o que Jesus fez para nos salvar, nós vos oferecemos o Pão da vida e o Cálice da salvação. Acolhei também a nossa vida junto com a oferta de Jesus.',
          'Abençoai a vossa Igreja, o Papa, o nosso Bispo, nossos pais, amigos e todas as crianças do mundo inteiro. Lembrai-vos também dos que já partiram para junto de vós e reuni-nos um dia no céu com Maria, Mãe de Jesus, e todos os Santos.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_cri_2',
    shortName: 'Crianças II',
    name: 'Oração Eucarística para Missas com Crianças II',
    whenUsed: 'Celebrada em missas com crianças, com respostas curtas e vibrantes.',
    prefaceSuggestion: 'Prefácio de ação de graças pela criação e pelo amor de Jesus.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Louvor e Epiclese',
        paragraphs: [
          'Sim, Senhor, vós sois bom e nos amais! Enviastes Jesus para estar sempre conosco e nos ensinar o caminho do amor. — T. Glória e louvor a vós, Senhor!',
          'Enviai agora o vosso Espírito Santo sobre este pão e este vinho, para que se tornem o Corpo e o Sangue de Jesus Cristo.',
        ],
      },
      {
        heading: 'Consagração',
        paragraphs: [
          'Na última ceia com seus apóstolos, Jesus tomou o pão, deu graças, partiu e o deu a eles, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Depois tomou o cálice com vinho, deu graças novamente e o entregou a eles, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Jesus morreu, Jesus ressuscitou, Jesus voltará!',
        ],
      },
      {
        heading: 'Intercessões',
        paragraphs: [
          'Pai querido, nós vos oferecemos este pão e este vinho, e pedimos que nos ajudeis a viver unidos no amor. Abençoai o Papa, nosso Bispo, nossos catequistas, nossas famílias e todos os que sofrem. Concedei a paz eterna aos nossos irmãos falecidos e levai-nos todos para a alegria do céu com Maria e todos os Santos.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
  {
    id: 'oe_cri_3',
    shortName: 'Crianças III',
    name: 'Oração Eucarística para Missas com Crianças III',
    whenUsed: 'Indicada para celebrações festivas com crianças e famílias.',
    prefaceSuggestion: 'Prefácio festivo de louvor pela presença de Deus na comunidade.',
    sections: [
      DIALOGO_E_SANTO,
      {
        heading: 'Alegria da Comunidade e Epiclese',
        paragraphs: [
          'Nós vos louvamos, Deus nosso Pai, porque criastes o mundo tão belo e nos chamais para sermos vossos filhos e amigos de Jesus. — T. Jesus é nosso amigo e Salvador!',
          'Pedimos que o vosso Espírito Santo transforme este pão e este vinho no Corpo e no Sangue de Jesus Cristo, nosso Senhor.',
        ],
      },
      {
        heading: 'Consagração',
        paragraphs: [
          'Na ceia antes da sua paixão, Jesus tomou o pão, agradeceu a vós, partiu e deu aos seus amigos, dizendo: TOMAI, TODOS, E COMEI: ISTO É O MEU CORPO, QUE SERÁ ENTREGUE POR VÓS.',
          'Depois, tomou o cálice, deu graças novamente e o entregou aos seus amigos, dizendo: TOMAI, TODOS, E BEBEI: ESTE É O CÁLICE DO MEU SANGUE, O SANGUE DA NOVA E ETERNA ALIANÇA, QUE SERÁ DERRAMADO POR VÓS E POR TODOS PARA REMISSÃO DOS PECADOS. FAZEI ISTO EM MEMÓRIA DE MIM.',
          'P. Mistério da fé! — T. Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição!',
        ],
      },
      {
        heading: 'Comunhão e Intercessões',
        paragraphs: [
          'Aceitai, ó Pai, esta oferta de amor que fazemos unidos a Jesus. Ensinai-nos a partilhar e a servir como Jesus nos ensinou. Protegei a Igreja inteira, o Papa, o nosso Bispo, nossa paróquia Santa Teresa d’Ávila e todas as famílias. Acolhei no céu os nossos falecidos junto de Maria e de todos os Santos.',
        ],
      },
      DOXOLOGIA_FINAL,
    ],
  },
];

export function getEucharisticPrayerById(id) {
  return EUCHARISTIC_PRAYERS.find((p) => p.id === id) || EUCHARISTIC_PRAYERS[1]; // Default OE II
}

function normalizeLiturgicalText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Seleciona a Oração Eucarística padrão fiel ao Missal Romano e ao livrinho da Paulus:
 * 1) Se a Paulus indicar explicitamente uma OE (`oracaoEucaristicaSugerida`), usa-a diretamente.
 * 2) Advento: Domingos/Solenidades -> OE III; Dias de semana -> OE II.
 * 3) Quaresma e Celebrações Penitenciais -> Reconciliação I (nunca pela cor roxa isolada).
 * 4) Natal, Páscoa, Pentecostes e Grandes Solenidades -> OE I (Cânon Romano).
 * 5) Tempo Comum e demais dias: Domingos -> OE III; Dias de semana -> OE II.
 */
export function getRecommendedEucharisticPrayerId(isoDate, liturgyData = null) {
  const explicitId = liturgyData?.oracaoEucaristicaSugerida || liturgyData?.detectedOEId || null;
  if (explicitId && EUCHARISTIC_PRAYERS.some((p) => p.id === explicitId)) {
    return explicitId;
  }

  const text = normalizeLiturgicalText(
    `${liturgyData?.liturgiaTitle || ''} ${liturgyData?.liturgicalSeason || ''}`,
  );

  let weekday = -1;
  if (isoDate && isoDate.includes('-')) {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    weekday = new Date(y, m - 1, d).getDay();
  }
  const isSunday = weekday === 0 || text.includes('domingo');

  const isAdvent = text.includes('advento');
  const isLentOrPenitential =
    text.includes('quaresma') ||
    text.includes('cinzas') ||
    text.includes('penitencial') ||
    text.includes('reconciliacao') ||
    text.includes('semana santa') ||
    text.includes('paixao do senhor');

  const isGreatSolemnity =
    text.includes('natal') ||
    text.includes('pascoa') ||
    text.includes('pentecostes') ||
    text.includes('corpus christi') ||
    text.includes('ascensao') ||
    text.includes('santissima trindade') ||
    text.includes('cristo rei') ||
    text.includes('imaculada conceicao') ||
    text.includes('todos os santos') ||
    text.includes('solenidade');

  // 1) Advento: Domingos e Solenidades -> OE III; Dias de semana -> OE II
  if (isAdvent) {
    return isSunday || isGreatSolemnity ? 'oe_3' : 'oe_2';
  }

  // 2) Quaresma e Celebrações Penitenciais -> Oração Eucarística da Reconciliação I
  if (isLentOrPenitential) {
    return 'oe_rec_1';
  }

  // 3) Natal, Páscoa, Pentecostes e Grandes Solenidades -> OE I (Cânon Romano)
  if (isGreatSolemnity) {
    return 'oe_1';
  }

  // 4) Tempo Comum (e demais tempos): Domingos -> OE III; Dias de semana -> OE II
  if (isSunday) {
    return 'oe_3';
  }
  return 'oe_2';
}
