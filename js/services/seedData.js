/**
 * Dados iniciais realistas (Mock Seed v2 Multi-Pastoral)
 * Demonstra claramente:
 * - Coordenação Geral (Admin Paroquial): Pe. Marcos Antônio
 * - Coordenadora 1: Natália Faria Souza (coordena Coroinhas e Liturgia; membro em Ministros)
 * - Coordenador 2: Carlos Eduardo Lima (coordena Música e Acolhida)
 * - Membro Simples Multi-Pastoral: João Pedro Almeida (membro de Coroinhas, Música e Liturgia)
 * - Múltiplos Coordenadores na mesma pastoral: Natália + Rafael coordenam Coroinhas e Acólitos
 */

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function makeBirthDate(year, monthIndex, day) {
  const safeDay = Math.min(day, new Date(year, monthIndex + 1, 0).getDate());
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function buildSeedData() {
  const today = new Date();
  const curMonth = today.getMonth();
  const curDay = today.getDate();

  const dMinus4 = formatISO(addDays(today, -4));
  const dMinus2 = formatISO(addDays(today, -2));
  const dPlus1 = formatISO(addDays(today, 1));
  const dPlus3 = formatISO(addDays(today, 3));
  const dPlus6 = formatISO(addDays(today, 6));
  const dPlus9 = formatISO(addDays(today, 9));

  const pastorals = [
    {
      id: 'pas_coroinhas',
      name: 'Pastoral dos Coroinhas e Acólitos',
      shortName: 'Coroinhas e Acólitos',
      color: '#B45309',
      description: 'Serviço ao altar nas celebrações dominicais, semanais e solenidades.',
      active: true,
    },
    {
      id: 'pas_liturgia',
      name: 'Pastoral da Liturgia',
      shortName: 'Liturgia',
      color: '#9A3412',
      description: 'Proclamação da Palavra, salmos, preces e preparação litúrgica das missas.',
      active: true,
    },
    {
      id: 'pas_musica',
      name: 'Pastoral da Música',
      shortName: 'Música',
      color: '#0F766E',
      description: 'Animação litúrgica através dos cantos e ministério de música.',
      active: true,
    },
    {
      id: 'pas_ministros',
      name: 'Ministros Extraordinários da Comunhão',
      shortName: 'Ministros',
      color: '#881337',
      description: 'Auxílio na distribuição da Eucaristia nas missas e visita aos enfermos.',
      active: true,
    },
    {
      id: 'pas_acolhida',
      name: 'Pastoral da Acolhida',
      shortName: 'Acolhida',
      color: '#5D4037',
      description: 'Recepção fraterna dos fiéis nas portas da Matriz e capelas.',
      active: true,
    },
  ];

  const roles = [
    // Coroinhas e Acólitos
    { id: 'role_missal', pastoralId: 'pas_coroinhas', name: 'Missal', description: 'Sustenta o Missal Romano junto ao celebrante.', active: true },
    { id: 'role_credencia', pastoralId: 'pas_coroinhas', name: 'Credência', description: 'Prepara vasos sagrados, galhetas e lavabo.', active: true },
    { id: 'role_turiferario', pastoralId: 'pas_coroinhas', name: 'Turiferário', description: 'Conduz o turíbulo nas incensações solenes.', active: true },
    { id: 'role_naviculario', pastoralId: 'pas_coroinhas', name: 'Naviculário', description: 'Auxilia o turiferário com a naveta de incenso.', active: true },
    { id: 'role_librifero', pastoralId: 'pas_coroinhas', name: 'Librífero', description: 'Conduz os livros litúrgicos nas solenidades.', active: true },
    { id: 'role_cruz', pastoralId: 'pas_coroinhas', name: 'Cruz Processional', description: 'Abre a procissão de entrada e saída.', active: true },
    { id: 'role_ceroferario', pastoralId: 'pas_coroinhas', name: 'Ceroferário', description: 'Conduz as tochas na procissão e no Evangelho.', active: true },
    { id: 'role_cerimonialista', pastoralId: 'pas_coroinhas', name: 'Cerimonialista', description: 'Coordena o rito e orienta os servidores.', active: true },
    { id: 'role_coord_missa', pastoralId: 'pas_coroinhas', name: 'Coordenador de Missa', description: 'Organiza a equipe na sacristia.', active: true },

    // Liturgia
    { id: 'role_leitura1', pastoralId: 'pas_liturgia', name: '1ª Leitura', description: 'Proclamação da Primeira Leitura.', active: true },
    { id: 'role_leitura2', pastoralId: 'pas_liturgia', name: '2ª Leitura', description: 'Proclamação da Segunda Leitura.', active: true },
    { id: 'role_salmo', pastoralId: 'pas_liturgia', name: 'Salmista', description: 'Entoação ou proclamação do Salmo Responsorial.', active: true },
    { id: 'role_comentarista', pastoralId: 'pas_liturgia', name: 'Comentarista e Preces', description: 'Comentários iniciais e oração da assembleia.', active: true },

    // Música
    { id: 'role_violao', pastoralId: 'pas_musica', name: 'Violão / Instrumento', description: 'Acompanhamento harmônico da celebração.', active: true },
    { id: 'role_teclado', pastoralId: 'pas_musica', name: 'Teclado', description: 'Base musical e prelúdios litúrgicos.', active: true },
    { id: 'role_voz', pastoralId: 'pas_musica', name: 'Voz Principal', description: 'Condução dos cantos litúrgicos.', active: true },
    { id: 'role_som', pastoralId: 'pas_musica', name: 'Mesa de Som', description: 'Operação e equalização de microfones.', active: true },

    // Ministros
    { id: 'role_min_altar', pastoralId: 'pas_ministros', name: 'Ministro do Altar', description: 'Auxilia o sacerdote no presbitério.', active: true },
    { id: 'role_min_nave', pastoralId: 'pas_ministros', name: 'Ministro da Nave', description: 'Distribuição da Comunhão na nave da igreja.', active: true },

    // Acolhida
    { id: 'role_porta_principal', pastoralId: 'pas_acolhida', name: 'Recepção Porta Principal', description: 'Acolhimento dos fiéis e entrega de folhetos.', active: true },
    { id: 'role_ofertorio', pastoralId: 'pas_acolhida', name: 'Coleta e Ofertório', description: 'Organização das ofertas e procissão das oferendas.', active: true },
  ];

  const users = [
    {
      id: 'usr_admin',
      name: 'Pe. Marcos Antônio',
      email: 'admin@santateresa.org.br',
      phone: '(11) 99900-0001',
      birthDate: makeBirthDate(1980, (curMonth + 1) % 12, 15),
      isGeneralAdmin: true,
      status: 'Ativo',
      memberships: [],
    },
    {
      id: 'usr_natalia',
      name: 'Natália Faria Souza',
      email: 'natalia@santateresa.org.br',
      phone: '(11) 99812-4410',
      birthDate: makeBirthDate(1998, curMonth, Math.min(curDay + 4, 28)),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_liturgia', role: 'Coordenador' },
        { pastoralId: 'pas_ministros', role: 'Membro' },
      ],
    },
    {
      id: 'usr_carlos',
      name: 'Carlos Eduardo Lima',
      email: 'carlos@santateresa.org.br',
      phone: '(11) 99722-5519',
      birthDate: makeBirthDate(1994, (curMonth + 2) % 12, 18),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_musica', role: 'Coordenador' },
        { pastoralId: 'pas_acolhida', role: 'Coordenador' },
      ],
    },
    {
      id: 'usr_joao',
      name: 'João Pedro Almeida',
      email: 'joao@santateresa.org.br',
      phone: '(11) 99655-8831',
      birthDate: makeBirthDate(2005, curMonth, curDay), // Aniversariante de hoje!
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Membro' },
        { pastoralId: 'pas_musica', role: 'Membro' },
        { pastoralId: 'pas_liturgia', role: 'Membro' },
      ],
    },
    {
      id: 'usr_rafael',
      name: 'Rafael Mendes Oliveira',
      email: 'rafael@santateresa.org.br',
      phone: '(11) 99741-2208',
      birthDate: makeBirthDate(1995, (curMonth + 3) % 12, 10),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_ministros', role: 'Coordenador' },
      ],
    },
    {
      id: 'usr_maria',
      name: 'Maria Clara Santos',
      email: 'maria@santateresa.org.br',
      phone: '(11) 99511-6024',
      birthDate: makeBirthDate(2010, curMonth, Math.max(1, curDay > 12 ? 8 : 20)),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Membro' },
        { pastoralId: 'pas_acolhida', role: 'Membro' },
      ],
    },
    {
      id: 'usr_lucas',
      name: 'Lucas Henrique Costa',
      email: 'lucas@santateresa.org.br',
      phone: '(11) 99420-1190',
      birthDate: makeBirthDate(2004, curMonth, curDay > 5 ? curDay - 2 : curDay + 6),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Membro' },
        { pastoralId: 'pas_musica', role: 'Membro' },
      ],
    },
    {
      id: 'usr_sofia',
      name: 'Sofia Beatriz Ferreira',
      email: 'sofia@santateresa.org.br',
      phone: '(11) 99310-5419',
      birthDate: makeBirthDate(2001, (curMonth + 4) % 12, 22),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_liturgia', role: 'Membro' },
        { pastoralId: 'pas_acolhida', role: 'Membro' },
      ],
    },
    {
      id: 'usr_gabriel',
      name: 'Gabriel Martins Rocha',
      email: 'gabriel@santateresa.org.br',
      phone: '(11) 99180-3321',
      birthDate: makeBirthDate(1999, (curMonth + 5) % 12, 12),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_ministros', role: 'Membro' },
        { pastoralId: 'pas_musica', role: 'Membro' },
      ],
    },
    {
      id: 'usr_thiago',
      name: 'Thiago Ribeiro Lima',
      email: 'thiago@santateresa.org.br',
      phone: '(11) 98840-7712',
      birthDate: makeBirthDate(2003, (curMonth + 6) % 12, 7),
      isGeneralAdmin: false,
      status: 'Inativo',
      memberships: [{ pastoralId: 'pas_coroinhas', role: 'Membro' }],
    },
    {
      id: 'usr_helena',
      name: 'Helena Vitória Duarte',
      email: 'helena@santateresa.org.br',
      phone: '(11) 98765-9001',
      birthDate: makeBirthDate(2002, (curMonth + 7) % 12, 5),
      isGeneralAdmin: false,
      status: 'Bloqueado',
      memberships: [{ pastoralId: 'pas_liturgia', role: 'Membro' }],
    },
  ];

  const schedules = [
    {
      id: 'sch_past_1',
      date: dMinus4,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_coroinhas',
      notes: 'Chegar 30 minutos antes na sacristia.',
      assignments: [
        { id: 'asg_p1', pastoralId: 'pas_coroinhas', roleId: 'role_missal', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p2', pastoralId: 'pas_coroinhas', roleId: 'role_credencia', userId: 'usr_lucas', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p3', pastoralId: 'pas_coroinhas', roleId: 'role_cruz', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_past_2',
      date: dMinus2,
      time: '19:30',
      location: 'Igreja São Francisco',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_musica',
      notes: 'Passagem de som às 18:45.',
      assignments: [
        { id: 'asg_p4', pastoralId: 'pas_musica', roleId: 'role_violao', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p5', pastoralId: 'pas_musica', roleId: 'role_voz', userId: 'usr_carlos', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_1',
      date: dPlus1,
      time: '19:00',
      location: 'Igreja São Francisco',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_coroinhas',
      notes: 'Chegar às 18:30 para organização do altar.',
      assignments: [
        { id: 'asg_1', pastoralId: 'pas_coroinhas', roleId: 'role_missal', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_2', pastoralId: 'pas_coroinhas', roleId: 'role_credencia', userId: 'usr_lucas', substitutionRequested: true, substitutionReason: 'Compromisso acadêmico no horário.' },
        { id: 'asg_3', pastoralId: 'pas_coroinhas', roleId: 'role_coord_missa', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_2',
      date: dPlus1,
      time: '19:00',
      location: 'Igreja São Francisco',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_musica',
      notes: 'Repertório do Tempo Comum — conferir cifra no Bloco de Notas.',
      assignments: [
        // Mesmo dia e horário que sch_1 para João -> demonstra alerta visual amigável de conflito!
        { id: 'asg_4', pastoralId: 'pas_musica', roleId: 'role_violao', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_5', pastoralId: 'pas_musica', roleId: 'role_voz', userId: 'usr_carlos', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_6', pastoralId: 'pas_musica', roleId: 'role_som', userId: 'usr_gabriel', substitutionRequested: true, substitutionReason: 'Atraso no trabalho, preciso de cobertura no som.' },
      ],
    },
    {
      id: 'sch_3',
      date: dPlus3,
      time: '09:30',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_liturgia',
      notes: 'Confirmar leituras do domingo no lecionário.',
      assignments: [
        { id: 'asg_7', pastoralId: 'pas_liturgia', roleId: 'role_leitura1', userId: 'usr_sofia', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_8', pastoralId: 'pas_liturgia', roleId: 'role_salmo', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_9', pastoralId: 'pas_liturgia', roleId: 'role_comentarista', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_4',
      date: dPlus3,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Solenidade',
      pastoralId: 'pas_acolhida',
      notes: 'Recepção festiva nas duas entradas da Matriz.',
      assignments: [
        { id: 'asg_10', pastoralId: 'pas_acolhida', roleId: 'role_porta_principal', userId: 'usr_carlos', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_11', pastoralId: 'pas_acolhida', roleId: 'role_ofertorio', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_5',
      date: dPlus6,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_ministros',
      notes: 'Reunião rápida de oração na capela do Santíssimo às 18:40.',
      assignments: [
        // Natália atua aqui apenas como Membro simples (não coordena Ministros!)
        { id: 'asg_12', pastoralId: 'pas_ministros', roleId: 'role_min_altar', userId: 'usr_rafael', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_13', pastoralId: 'pas_ministros', roleId: 'role_min_nave', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_14', pastoralId: 'pas_ministros', roleId: 'role_min_nave', userId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_6',
      date: dPlus9,
      time: '10:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_coroinhas',
      notes: 'Missa solene com participação das famílias.',
      assignments: [
        { id: 'asg_15', pastoralId: 'pas_coroinhas', roleId: 'role_turiferario', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_16', pastoralId: 'pas_coroinhas', roleId: 'role_cruz', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_17', pastoralId: 'pas_coroinhas', roleId: 'role_cerimonialista', userId: 'usr_rafael', substitutionRequested: false, substitutionReason: '' },
      ],
    },
  ];

  const events = [
    {
      id: 'evt_1',
      title: 'Ensaio Litúrgico — Coroinhas e Liturgia',
      type: 'Ensaio',
      date: dPlus1,
      time: '17:30',
      location: 'Matriz Santa Teresa',
      description: 'Ensaio prático de procissão de entrada e proclamação das leituras.',
      pastoralId: 'pas_coroinhas',
    },
    {
      id: 'evt_2',
      title: 'Ensaio do Ministério de Música',
      type: 'Ensaio',
      date: dPlus3,
      time: '17:00',
      location: 'Salão Paroquial Santa Teresa',
      description: 'Passagem do repertório da Solenidade e afinação dos instrumentos.',
      pastoralId: 'pas_musica',
    },
    {
      id: 'evt_3',
      title: 'Encontro Geral das Pastorais com o Pároco',
      type: 'Reunião',
      date: dPlus6,
      time: '20:15',
      location: 'Salão Paroquial Santa Teresa',
      description: 'Alinhamento do calendário litúrgico paroquial com todas as pastorais.',
      pastoralId: 'all',
    },
  ];

  const notes = [
    {
      id: 'note_1',
      title: 'Orientações Gerais da Paróquia Santa Teresa',
      content: 'Todas as equipes devem chegar com no mínimo 25 minutos de antecedência para um momento breve de oração antes da Santa Missa.',
      authorId: 'usr_admin',
      visibilityMode: 'Todos',
      visiblePastoralIds: ['all'],
      coordinatorsOnly: false,
      createdAt: `${dMinus4}T14:20:00`,
    },
    {
      id: 'note_2',
      title: 'Checklist da Sacristia (Coroinhas e Liturgia)',
      content: 'Conferir galhetas, cálice, corporal, Lecionário marcado nas leituras do domingo e velas do altar acesas 15 minutos antes.',
      authorId: 'usr_natalia',
      visibilityMode: 'Personalizado',
      visiblePastoralIds: ['pas_coroinhas', 'pas_liturgia'],
      coordinatorsOnly: false,
      createdAt: `${dMinus2}T16:10:00`,
    },
    {
      id: 'note_3',
      title: 'Repertório e Cifras da Semana (Música)',
      content: 'Entrada: Eis-me aqui Senhor (Tom G) • Ofertório: Sabes Senhor (Tom D) • Comunhão: Pão da Vida (Tom C).',
      authorId: 'usr_carlos',
      visibilityMode: 'Personalizado',
      visiblePastoralIds: ['pas_musica'],
      coordinatorsOnly: false,
      createdAt: `${dMinus2}T18:45:00`,
    },
    {
      id: 'note_4',
      title: 'Pauta de Coordenação — Coroinhas',
      content: 'Revisar estoque de túnicas novas e confirmar escala do tríduo com Rafael.',
      authorId: 'usr_natalia',
      visibilityMode: 'Apenas Coordenadores',
      visiblePastoralIds: ['pas_coroinhas'],
      coordinatorsOnly: true,
      createdAt: `${dMinus2}T20:00:00`,
    },
  ];

  const forms = [
    {
      id: 'form_1',
      title: 'Disponibilidade para Escalas — Coroinhas e Acólitos',
      description: 'Informe os horários em que você pode servir ao altar no próximo mês.',
      pastoralId: 'pas_coroinhas',
      audience: 'Todos',
      active: true,
      createdAt: dMinus4,
      questions: [
        { id: 'q_1', text: 'Qual horário você tem maior disponibilidade?', type: 'choice', required: true, options: ['Domingo 09:30 (Matriz)', 'Domingo 19:00 (Matriz)', 'Semana 19:00 (São Francisco)', 'Qualquer horário'] },
        { id: 'q_2', text: 'Pode servir em solenidades durante a semana?', type: 'boolean', required: true, options: [] },
        { id: 'q_3', text: 'Datas indisponíveis ou observações:', type: 'text', required: false, options: [] },
      ],
    },
    {
      id: 'form_2',
      title: 'Cadastro de Instrumentos e Vozes — Pastoral da Música',
      description: 'Atualização do levantamento de instrumentistas e cantores para as missas.',
      pastoralId: 'pas_musica',
      audience: 'Todos',
      active: true,
      createdAt: dMinus2,
      questions: [
        { id: 'q_4', text: 'Qual sua principal atuação na música?', type: 'choice', required: true, options: ['Violão', 'Teclado', 'Voz Principal / Apoio', 'Mesa de Som'] },
        { id: 'q_5', text: 'Tem disponibilidade para ensaios aos sábados?', type: 'boolean', required: true, options: [] },
      ],
    },
    {
      id: 'form_3',
      title: 'Pesquisa Geral — Encontro Paroquial de Santa Teresa',
      description: 'Confirme sua presença no encontro formativo de todas as pastorais.',
      pastoralId: 'all',
      audience: 'Todos',
      active: true,
      createdAt: dMinus2,
      questions: [
        { id: 'q_6', text: 'Você participará do Encontro Geral das Pastorais?', type: 'boolean', required: true, options: [] },
        { id: 'q_7', text: 'Sugestão de tema para nossa formação paroquial:', type: 'text', required: false, options: [] },
      ],
    },
  ];

  const responses = [
    {
      id: 'resp_1',
      formId: 'form_1',
      userId: 'usr_joao',
      submittedAt: `${dMinus2}T10:15:00`,
      answers: {
        q_1: 'Domingo 19:00 (Matriz)',
        q_2: 'Sim',
        q_3: 'Sem restrições para este mês.',
      },
    },
    {
      id: 'resp_2',
      formId: 'form_1',
      userId: 'usr_maria',
      submittedAt: `${dMinus2}T14:40:00`,
      answers: {
        q_1: 'Domingo 09:30 (Matriz)',
        q_2: 'Sim',
        q_3: 'Disponível aos domingos pela manhã.',
      },
    },
    {
      id: 'resp_3',
      formId: 'form_2',
      userId: 'usr_joao',
      submittedAt: `${dMinus2}T19:05:00`,
      answers: {
        q_4: 'Violão',
        q_5: 'Sim',
      },
    },
  ];

  const notices = [
    {
      id: 'not_1',
      title: 'Encontro Paroquial das Pastorais com o Pároco',
      content: 'Queridos coordenadores e membros, convocamos todas as pastorais para o nosso encontro mensal no Salão Paroquial Santa Teresa. Sua presença fortalece a unidade da nossa comunidade!',
      authorId: 'usr_admin',
      pastoralId: 'all',
      pinned: true,
      createdAt: `${dMinus2}T09:00:00`,
    },
    {
      id: 'not_2',
      title: 'Ensaio dos Coroinhas e Acólitos nesta semana',
      content: 'Lembramos a todos os coroinhas e acólitos que o ensaio prático será na Matriz Santa Teresa às 17:30. Tragam o caderno litúrgico.',
      authorId: 'usr_natalia',
      pastoralId: 'pas_coroinhas',
      pinned: false,
      createdAt: `${dMinus4}T18:30:00`,
    },
    {
      id: 'not_3',
      title: 'Novo repertório publicado para a Pastoral da Música',
      content: 'Pessoal da Música, as cifras e letras da próxima missa já estão disponíveis no Bloco de Notas. Cheguem 40 minutos antes para passagem de som.',
      authorId: 'usr_carlos',
      pastoralId: 'pas_musica',
      pinned: false,
      createdAt: `${dMinus4}T11:15:00`,
    },
  ];

  const attendance = {
    sch_past_1: {
      usr_joao: 'Presente',
      usr_lucas: 'Presente',
      usr_maria: 'Falta Justificada',
    },
    sch_past_2: {
      usr_joao: 'Presente',
      usr_carlos: 'Presente',
    },
    evt_1: {
      usr_joao: 'Presente',
      usr_maria: 'Presente',
      usr_lucas: 'Falta',
    },
  };

  const settings = {
    instagramUrl: 'https://www.instagram.com/',
    parishName: "Paróquia Santa Teresa d'Ávila",
    subtitle: 'Gestão Pastoral',
  };

  return {
    pastorals,
    users,
    roles,
    schedules,
    events,
    notes,
    forms,
    responses,
    notices,
    attendance,
    settings,
  };
}
