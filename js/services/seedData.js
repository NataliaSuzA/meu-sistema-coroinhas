/**
 * Dados iniciais realistas (Mock Seed v3) para demonstrar:
 * - Meu Perfil + Troca de senha (senha inicial: pastoral2026)
 * - Matriz de Permissões configurável por perfil
 * - Formulários segmentados por pastoral(is) com prazo (deadline), respostas validadas,
 *   editáveis e relatório de membros pendentes
 * - Mural de Parabéns em Aniversariantes + banner festivo no Início
 * - Isolamento de Escalas + tela dedicada "Minhas Datas"
 * - Bloco de Notas e Avisos segmentados N:N por pastoral
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

export const PERMISSION_DEFINITIONS = [
  { key: 'dashboard', label: 'Início (Dashboard)', group: 'Geral' },
  { key: 'agenda', label: 'Agenda', group: 'Geral' },
  { key: 'my_dates', label: 'Minhas Datas', group: 'Escalas' },
  { key: 'schedules_view', label: 'Escalas da Pastoral', group: 'Escalas' },
  { key: 'schedules_manage', label: 'Criar / Editar Escalas', group: 'Gestão' },
  { key: 'roles', label: 'Pastorais & Funções', group: 'Gestão' },
  { key: 'users', label: 'Gestão de Usuários', group: 'Gestão' },
  { key: 'forms_answer', label: 'Formulários (Responder)', group: 'Formulários' },
  { key: 'forms_manage', label: 'Formulários (Criar / Editar)', group: 'Gestão' },
  { key: 'responses', label: 'Respostas de Formulários', group: 'Gestão' },
  { key: 'attendance_manage', label: 'Presença (Lançar Chamada)', group: 'Gestão' },
  { key: 'attendance_self', label: 'Presença (Ver Própria Frequência)', group: 'Geral' },
  { key: 'notes', label: 'Bloco de Notas', group: 'Comunicação' },
  { key: 'notices_publish', label: 'Avisos (Publicar / Fixar)', group: 'Gestão' },
  { key: 'birthdays', label: 'Aniversariantes & Mural de Parabéns', group: 'Comunicação' },
];

export function buildDefaultPermissions() {
  return {
    coordinator: {
      dashboard: true,
      agenda: true,
      my_dates: true,
      schedules_view: true,
      schedules_manage: true,
      roles: true,
      users: true,
      forms_answer: true,
      forms_manage: true,
      responses: true,
      attendance_manage: true,
      attendance_self: true,
      notes: true,
      notices_publish: true,
      birthdays: true,
    },
    member: {
      dashboard: true,
      agenda: true,
      my_dates: true,
      schedules_view: true,
      schedules_manage: false,
      roles: false,
      users: false,
      forms_answer: true,
      forms_manage: false,
      responses: false,
      attendance_manage: false,
      attendance_self: true,
      notes: true,
      notices_publish: false,
      birthdays: true,
    },
  };
}

export function buildSeedData() {
  const today = new Date();
  const curMonth = today.getMonth();
  const curDay = today.getDate();

  const dToday = formatISO(today);
  const dMinus4 = formatISO(addDays(today, -4));
  const dMinus2 = formatISO(addDays(today, -2));
  const dMinus1 = formatISO(addDays(today, -1));
  const dPlus1 = formatISO(addDays(today, 1));
  const dPlus3 = formatISO(addDays(today, 3));
  const dPlus6 = formatISO(addDays(today, 6));
  const dPlus9 = formatISO(addDays(today, 9));
  const dPlus10 = formatISO(addDays(today, 10));

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

  const defaultPass = 'pastoral2026';

  const users = [
    {
      id: 'usr_admin',
      name: 'Pe. Marcos Antônio',
      email: 'admin@santateresa.org.br',
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      password: defaultPass,
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
      id: 'sch_today',
      date: dToday,
      time: '19:30',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_coroinhas',
      notes: 'Missa comunitária da semana. Chegar às 19:00.',
      assignments: [
        { id: 'asg_t1', pastoralId: 'pas_coroinhas', roleId: 'role_coord_missa', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_t2', pastoralId: 'pas_coroinhas', roleId: 'role_cruz', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
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
      notes: 'Oração breve na capela do Santíssimo às 18:40.',
      assignments: [
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

  // Notas com vínculo N:N obrigatório (pastoralIds)
  const notes = [
    {
      id: 'note_1',
      title: 'Orientações Gerais da Paróquia Santa Teresa',
      content: 'Todas as equipes devem chegar com no mínimo 25 minutos de antecedência para um momento breve de oração antes da Santa Missa.',
      authorId: 'usr_admin',
      pastoralIds: ['all'],
      coordinatorsOnly: false,
      createdAt: `${dMinus4}T14:20:00`,
    },
    {
      id: 'note_2',
      title: 'Checklist da Sacristia (Coroinhas e Liturgia)',
      content: 'Conferir galhetas, cálice, corporal, Lecionário marcado nas leituras do domingo e velas do altar acesas 15 minutos antes.',
      authorId: 'usr_natalia',
      pastoralIds: ['pas_coroinhas', 'pas_liturgia'],
      coordinatorsOnly: false,
      createdAt: `${dMinus2}T16:10:00`,
    },
    {
      id: 'note_3',
      title: 'Repertório e Cifras da Semana (Música)',
      content: 'Entrada: Eis-me aqui Senhor (Tom G) • Ofertório: Sabes Senhor (Tom D) • Comunhão: Pão da Vida (Tom C).',
      authorId: 'usr_carlos',
      pastoralIds: ['pas_musica'],
      coordinatorsOnly: false,
      createdAt: `${dMinus2}T18:45:00`,
    },
    {
      id: 'note_4',
      title: 'Protocolo de Acolhimento — Portas da Matriz',
      content: 'Distribuir folhetos nas duas entradas 20 minutos antes e orientar idosos aos bancos reservados.',
      authorId: 'usr_carlos',
      pastoralIds: ['pas_acolhida'],
      coordinatorsOnly: false,
      createdAt: `${dMinus1}T10:30:00`,
    },
    {
      id: 'note_5',
      title: 'Pauta Interna — Coordenação Coroinhas',
      content: 'Revisar estoque de túnicas novas e confirmar escala do tríduo com Rafael.',
      authorId: 'usr_natalia',
      pastoralIds: ['pas_coroinhas'],
      coordinatorsOnly: true,
      createdAt: `${dMinus2}T20:00:00`,
    },
  ];

  // Formulários com segmentação N:N (pastoralIds) e prazo de encerramento (deadline)
  const forms = [
    {
      id: 'form_1',
      title: 'Disponibilidade para Escalas — Coroinhas e Liturgia',
      description: 'Informe seus horários preferenciais para montarmos as escalas do próximo mês.',
      pastoralIds: ['pas_coroinhas', 'pas_liturgia'],
      deadline: `${dPlus10}T23:59`,
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
      description: 'Atualização do levantamento de instrumentistas, cantores e equipe de som.',
      pastoralIds: ['pas_musica'],
      deadline: `${dPlus6}T22:00`,
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
      pastoralIds: ['all'],
      deadline: `${dPlus9}T20:00`,
      active: true,
      createdAt: dMinus2,
      questions: [
        { id: 'q_6', text: 'Você participará do Encontro Geral das Pastorais?', type: 'boolean', required: true, options: [] },
        { id: 'q_7', text: 'Sugestão de tema para nossa formação paroquial:', type: 'text', required: false, options: [] },
      ],
    },
    {
      id: 'form_4',
      title: 'Inscrição — Retiro Litúrgico (Prazo Encerrado)',
      description: 'Formulário demonstrativo com data/hora de encerramento já expirada automaticamente.',
      pastoralIds: ['pas_coroinhas'],
      deadline: `${dMinus1}T18:00`,
      active: true,
      createdAt: dMinus4,
      questions: [
        { id: 'q_8', text: 'Você participou do retiro anterior?', type: 'boolean', required: true, options: [] },
      ],
    },
  ];

  // Respostas: inclui resposta JÁ VALIDADA (bloqueada) e resposta PENDENTE DE VALIDAÇÃO (editável pelo membro)
  const responses = [
    {
      id: 'resp_1',
      formId: 'form_1',
      userId: 'usr_joao',
      submittedAt: `${dMinus2}T10:15:00`,
      validated: false, // João ainda pode editar até a Coordenação validar!
      validatedBy: null,
      validatedAt: null,
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
      validated: true, // Validada pela Coordenação (bloqueada para edição)
      validatedBy: 'usr_natalia',
      validatedAt: `${dMinus1}T09:10:00`,
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
      validated: true, // Validada por Carlos — bloqueada para edição por João!
      validatedBy: 'usr_carlos',
      validatedAt: `${dMinus1}T11:20:00`,
      answers: {
        q_4: 'Violão',
        q_5: 'Sim',
      },
    },
    {
      id: 'resp_4',
      formId: 'form_4',
      userId: 'usr_joao',
      submittedAt: `${dMinus2}T12:00:00`,
      validated: true,
      validatedBy: 'usr_natalia',
      validatedAt: `${dMinus2}T15:00:00`,
      answers: {
        q_8: 'Sim',
      },
    },
  ];

  // Avisos segmentados N:N por pastoral (pastoralIds)
  const notices = [
    {
      id: 'not_1',
      title: 'Encontro Paroquial das Pastorais com o Pároco',
      content: 'Queridos coordenadores e membros, convocamos todas as pastorais para o nosso encontro mensal no Salão Paroquial Santa Teresa. Sua presença fortalece a unidade da nossa comunidade!',
      authorId: 'usr_admin',
      pastoralIds: ['all'],
      pinned: true,
      createdAt: `${dMinus2}T09:00:00`,
    },
    {
      id: 'not_2',
      title: 'Ensaio Conjunto — Coroinhas e Liturgia',
      content: 'Lembramos aos membros de Coroinhas e Liturgia que o ensaio prático será na Matriz Santa Teresa às 17:30. Tragam o caderno litúrgico.',
      authorId: 'usr_natalia',
      pastoralIds: ['pas_coroinhas', 'pas_liturgia'],
      pinned: false,
      createdAt: `${dMinus4}T18:30:00`,
    },
    {
      id: 'not_3',
      title: 'Passagem de Som e Recepção — Música e Acolhida',
      content: 'Equipes de Música e Acolhida: neste domingo chegaremos 40 minutos antes da Solenidade para passagem de som e alinhamento das portas da Matriz.',
      authorId: 'usr_carlos',
      pastoralIds: ['pas_musica', 'pas_acolhida'],
      pinned: false,
      createdAt: `${dMinus1}T11:15:00`,
    },
  ];

  const attendance = {
    sch_past_1: {
      usr_joao: 'Presente',
      usr_lucas: 'Presente',
      usr_maria: 'Falta Justificada',
    },
    evt_1: {
      usr_joao: 'Presente',
      usr_maria: 'Presente',
      usr_lucas: 'Falta',
    },
  };

  const birthdayMessages = [
    {
      id: 'bmsg_1',
      recipientUserId: 'usr_joao',
      authorId: 'usr_natalia',
      authorPastoralLabel: 'Coroinhas e Acólitos',
      message: "Feliz aniversário, João! Que Deus e Santa Teresa d'Ávila abençoem muito sua vida, seus estudos e sua linda missão no altar!",
      createdAt: `${dToday}T08:15:00`,
    },
    {
      id: 'bmsg_2',
      recipientUserId: 'usr_joao',
      authorId: 'usr_carlos',
      authorPastoralLabel: 'Música',
      message: 'Parabéns, João! Obrigado pela dedicação no violão e em todas as celebrações. Muita saúde e paz!',
      createdAt: `${dToday}T09:40:00`,
    },
    {
      id: 'bmsg_3',
      recipientUserId: 'usr_natalia',
      authorId: 'usr_rafael',
      authorPastoralLabel: 'Coroinhas e Acólitos',
      message: 'Já deixando os parabéns adiantados pelo mês do seu aniversário, Natália! Obrigado por todo carinho na coordenação!',
      createdAt: `${dMinus1}T16:20:00`,
    },
  ];

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
    permissions: buildDefaultPermissions(),
    birthdayMessages,
    settings,
  };
}
