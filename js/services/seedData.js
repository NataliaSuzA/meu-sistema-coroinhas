/**
 * Dados iniciais realistas (Mock Seed v5)
 * Inclui:
 * - Conta Familiar de exemplo com 2 irmãos (Pedro Lucas & João Miguel, aniversários em meses diferentes!)
 * - Pedido de substituição em aberto na Pastoral Música (Gabriel Martins Rocha -> Mesa de Som)
 *   com notificação no sino para os colegas da Música (Lucas Henrique Costa, João Pedro, Carlos)
 * - Escala de hoje com Roteiro Especial do Padre
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
  { key: 'liturgy', label: 'Liturgia Diária (Paulus) & Roteiro do Celebrante', group: 'Liturgia' },
  { key: 'agenda', label: 'Agenda', group: 'Geral' },
  { key: 'my_dates', label: 'Minhas Datas', group: 'Escalas' },
  { key: 'schedules_view', label: 'Escalas da Pastoral', group: 'Escalas' },
  { key: 'schedules_manage', label: 'Criar / Editar Escalas', group: 'Gestão' },
  { key: 'roles', label: 'Pastorais & Funções', group: 'Gestão' },
  { key: 'locations', label: 'Locais (Igrejas, Capelas e Espaços)', group: 'Gestão' },
  { key: 'celebration_types', label: 'Tipos de Celebração', group: 'Gestão' },
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
      liturgy: true,
      agenda: true,
      my_dates: true,
      schedules_view: true,
      schedules_manage: true,
      roles: true,
      locations: true,
      celebration_types: true,
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
      liturgy: true,
      agenda: true,
      my_dates: true,
      schedules_view: true,
      schedules_manage: false,
      roles: false,
      locations: false,
      celebration_types: false,
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
    { id: 'pas_coroinhas', name: 'Pastoral dos Coroinhas e Acólitos', shortName: 'Coroinhas e Acólitos', color: '#B45309', description: 'Serviço ao altar nas celebrações dominicais, semanais e solenidades.', active: true },
    { id: 'pas_liturgia', name: 'Pastoral da Liturgia', shortName: 'Liturgia', color: '#9A3412', description: 'Proclamação da Palavra, salmos, preces e preparação litúrgica das missas.', active: true },
    { id: 'pas_musica', name: 'Pastoral da Música', shortName: 'Música', color: '#0F766E', description: 'Animação litúrgica através dos cantos e ministério de música.', active: true },
    { id: 'pas_ministros', name: 'Ministros Extraordinários da Comunhão', shortName: 'Ministros', color: '#881337', description: 'Auxílio na distribuição da Eucaristia nas missas e visita aos enfermos.', active: true },
    { id: 'pas_acolhida', name: 'Pastoral da Acolhida', shortName: 'Acolhida', color: '#5D4037', description: 'Recepção fraterna dos fiéis nas portas da Matriz e capelas.', active: true },
  ];

  const locations = [
    { id: 'loc_matriz', name: "Igreja Matriz Santa Teresa d'Ávila", type: 'Matriz', address: 'Praça Santa Teresa, 100 — Centro', active: true },
    { id: 'loc_sao_francisco', name: 'Igreja São Francisco', type: 'Capela', address: 'Rua das Flores, 245 — Jardim São Francisco', active: true },
    { id: 'loc_sao_jose', name: 'Capela São José', type: 'Capela', address: 'Av. dos Trabalhadores, 890 — Vila Nova', active: true },
    { id: 'loc_salao', name: 'Salão Paroquial Santa Teresa', type: 'Salão', address: 'Anexo à Matriz — Entrada pela Rua Lateral', active: true },
    { id: 'loc_externo', name: 'Praça da Matriz (Área Externa)', type: 'Externo', address: 'Em frente à escadaria principal da Matriz', active: false },
  ];

  const celebrationTypes = [
    { id: 'ct_dominical', name: 'Missa Dominical', color: '#B45309', durationMin: 75, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_semanal', name: 'Missa Semanal', color: '#5D4037', durationMin: 60, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_solene', name: 'Missa Solene / Padroeira', color: '#991B1B', durationMin: 90, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_adoracao', name: 'Adoração ao Santíssimo', color: '#D97706', durationMin: 60, requiresLiturgyOfWord: false, active: true },
    { id: 'ct_batizado', name: 'Batizado', color: '#0F766E', durationMin: 60, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_casamento', name: 'Casamento', color: '#881337', durationMin: 75, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_novena', name: 'Via-Sacra / Novena', color: '#6D28D9', durationMin: 45, requiresLiturgyOfWord: false, active: true },
  ];

  const roles = [
    { id: 'role_missal', pastoralId: 'pas_coroinhas', name: 'Missal', description: 'Sustenta o Missal Romano junto ao celebrante.', active: true },
    { id: 'role_credencia', pastoralId: 'pas_coroinhas', name: 'Credência', description: 'Prepara vasos sagrados, galhetas e lavabo.', active: true },
    { id: 'role_turiferario', pastoralId: 'pas_coroinhas', name: 'Turiferário', description: 'Conduz o turíbulo nas incensações solenes.', active: true },
    { id: 'role_naviculario', pastoralId: 'pas_coroinhas', name: 'Naviculário', description: 'Auxilia o turiferário com a naveta de incenso.', active: true },
    { id: 'role_librifero', pastoralId: 'pas_coroinhas', name: 'Librífero', description: 'Conduz os livros litúrgicos nas solenidades.', active: true },
    { id: 'role_cruz', pastoralId: 'pas_coroinhas', name: 'Cruz Processional', description: 'Abre a procissão de entrada e saída.', active: true },
    { id: 'role_ceroferario', pastoralId: 'pas_coroinhas', name: 'Ceroferário', description: 'Conduz as tochas na procissão e no Evangelho.', active: true },
    { id: 'role_cerimonialista', pastoralId: 'pas_coroinhas', name: 'Cerimonialista', description: 'Coordena o rito e orienta os servidores.', active: true },
    { id: 'role_coord_missa', pastoralId: 'pas_coroinhas', name: 'Coordenador de Missa', description: 'Organiza a equipe na sacristia.', active: true },

    { id: 'role_leitura1', pastoralId: 'pas_liturgia', name: '1ª Leitura', description: 'Proclamação da Primeira Leitura.', active: true },
    { id: 'role_leitura2', pastoralId: 'pas_liturgia', name: '2ª Leitura', description: 'Proclamação da Segunda Leitura.', active: true },
    { id: 'role_salmo', pastoralId: 'pas_liturgia', name: 'Salmista', description: 'Entoação ou proclamação do Salmo Responsorial.', active: true },
    { id: 'role_comentarista', pastoralId: 'pas_liturgia', name: 'Comentarista e Preces', description: 'Comentários iniciais e oração da assembleia.', active: true },

    { id: 'role_violao', pastoralId: 'pas_musica', name: 'Violão / Instrumento', description: 'Acompanhamento harmônico da celebração.', active: true },
    { id: 'role_teclado', pastoralId: 'pas_musica', name: 'Teclado', description: 'Base musical e prelúdios litúrgicos.', active: true },
    { id: 'role_voz', pastoralId: 'pas_musica', name: 'Voz Principal', description: 'Condução dos cantos litúrgicos.', active: true },
    { id: 'role_som', pastoralId: 'pas_musica', name: 'Mesa de Som', description: 'Operação e equalização de microfones.', active: true },

    { id: 'role_min_altar', pastoralId: 'pas_ministros', name: 'Ministro do Altar', description: 'Auxilia o sacerdote no presbitério.', active: true },
    { id: 'role_min_nave', pastoralId: 'pas_ministros', name: 'Ministro da Nave', description: 'Distribuição da Comunhão na nave da igreja.', active: true },

    { id: 'role_porta_principal', pastoralId: 'pas_acolhida', name: 'Recepção Porta Principal', description: 'Acolhimento dos fiéis e entrega de folhetos.', active: true },
    { id: 'role_ofertorio', pastoralId: 'pas_acolhida', name: 'Coleta e Ofertório', description: 'Organização das ofertas e procissão das oferendas.', active: true },
  ];

  const defaultPass = 'pastoral2026';

  const pedroBirth = makeBirthDate(2015, curMonth, Math.min(curDay + 2, 28)); // Mês atual!
  const joaoMiguelBirth = makeBirthDate(2017, (curMonth + 4) % 12, 28); // Outro mês!

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
      familyMembers: [{ id: 'usr_admin', name: 'Pe. Marcos Antônio', birthDate: makeBirthDate(1980, (curMonth + 1) % 12, 15) }],
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
      familyMembers: [{ id: 'usr_natalia', name: 'Natália Faria Souza', birthDate: makeBirthDate(1998, curMonth, Math.min(curDay + 4, 28)) }],
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
      familyMembers: [{ id: 'usr_carlos', name: 'Carlos Eduardo Lima', birthDate: makeBirthDate(1994, (curMonth + 2) % 12, 18) }],
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
        { pastoralId: 'pas_musica', role: 'Membro' },
        { pastoralId: 'pas_ministros', role: 'Membro' },
      ],
      familyMembers: [{ id: 'usr_gabriel', name: 'Gabriel Martins Rocha', birthDate: makeBirthDate(1999, (curMonth + 5) % 12, 12) }],
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
      familyMembers: [{ id: 'usr_lucas', name: 'Lucas Henrique Costa', birthDate: makeBirthDate(2004, curMonth, curDay > 5 ? curDay - 2 : curDay + 6) }],
    },
    {
      // CONTA FAMILIAR DE EXEMPLO (2 IRMÃOS NA MESMA CONTA!)
      id: 'usr_familia_silva',
      name: 'Família Silva (Pedro Lucas & João Miguel)',
      email: 'familia.silva@santateresa.org.br',
      password: defaultPass,
      phone: '(11) 99511-6024',
      birthDate: pedroBirth,
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Membro' },
        { pastoralId: 'pas_acolhida', role: 'Membro' },
      ],
      familyMembers: [
        { id: 'mem_pedro_lucas', name: 'Pedro Lucas Silva', birthDate: pedroBirth },
        { id: 'mem_joao_miguel', name: 'João Miguel Silva', birthDate: joaoMiguelBirth },
      ],
    },
    {
      id: 'usr_joao',
      name: 'João Pedro Almeida',
      email: 'joao@santateresa.org.br',
      password: defaultPass,
      phone: '(11) 99655-8831',
      birthDate: makeBirthDate(2005, curMonth, curDay),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Membro' },
        { pastoralId: 'pas_musica', role: 'Membro' },
        { pastoralId: 'pas_liturgia', role: 'Membro' },
      ],
      familyMembers: [{ id: 'usr_joao', name: 'João Pedro Almeida', birthDate: makeBirthDate(2005, curMonth, curDay) }],
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
      familyMembers: [{ id: 'usr_rafael', name: 'Rafael Mendes Oliveira', birthDate: makeBirthDate(1995, (curMonth + 3) % 12, 10) }],
    },
    {
      id: 'usr_sofia',
      name: 'Sofia Beatriz Ferreira',
      email: 'sofia@santateresa.org.br',
      password: defaultPass,
      phone: '(11) 99310-5419',
      birthDate: makeBirthDate(2001, (curMonth + 6) % 12, 22),
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_liturgia', role: 'Membro' },
        { pastoralId: 'pas_acolhida', role: 'Membro' },
      ],
      familyMembers: [{ id: 'usr_sofia', name: 'Sofia Beatriz Ferreira', birthDate: makeBirthDate(2001, (curMonth + 6) % 12, 22) }],
    },
    {
      id: 'usr_thiago',
      name: 'Thiago Ribeiro Lima',
      email: 'thiago@santateresa.org.br',
      password: defaultPass,
      phone: '(11) 98840-7712',
      birthDate: makeBirthDate(2003, (curMonth + 7) % 12, 7),
      isGeneralAdmin: false,
      status: 'Inativo',
      memberships: [{ pastoralId: 'pas_coroinhas', role: 'Membro' }],
      familyMembers: [{ id: 'usr_thiago', name: 'Thiago Ribeiro Lima', birthDate: makeBirthDate(2003, (curMonth + 7) % 12, 7) }],
    },
  ];

  const schedules = [
    {
      id: 'sch_past_1',
      date: dMinus4,
      time: '19:00',
      locationId: 'loc_matriz',
      location: "Igreja Matriz Santa Teresa d'Ávila",
      celebrationTypeId: 'ct_dominical',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_coroinhas',
      eucharisticPrayerId: 'oe_3',
      eucharisticPrayerSource: 'default',
      celebrantScript: '',
      notes: 'Chegar 30 minutos antes na sacristia.',
      assignments: [
        { id: 'asg_p1', pastoralId: 'pas_coroinhas', roleId: 'role_missal', userId: 'usr_joao', memberId: 'usr_joao', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_p2', pastoralId: 'pas_coroinhas', roleId: 'role_credencia', userId: 'usr_lucas', memberId: 'usr_lucas', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_p3', pastoralId: 'pas_coroinhas', roleId: 'role_cruz', userId: 'usr_familia_silva', memberId: 'mem_pedro_lucas', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_today',
      date: dToday,
      time: '19:30',
      locationId: 'loc_matriz',
      location: "Igreja Matriz Santa Teresa d'Ávila",
      celebrationTypeId: 'ct_solene',
      celebrationType: 'Missa Solene / Padroeira',
      pastoralId: 'pas_coroinhas',
      eucharisticPrayerId: 'oe_3',
      eucharisticPrayerSource: 'custom',
      celebrantScript:
        '1. Entrada solene pelo corredor central com turíbulo e cruz processional.\n2. Após a homilia, bênção especial dos coroinhas.\n3. Utilizar Oração Eucarística III conforme orientação do Pároco.',
      notes: 'Roteiro Especial do Pe. Marcos — chegar às 18:50.',
      assignments: [
        { id: 'asg_t1', pastoralId: 'pas_coroinhas', roleId: 'role_coord_missa', userId: 'usr_natalia', memberId: 'usr_natalia', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_t2', pastoralId: 'pas_coroinhas', roleId: 'role_turiferario', userId: 'usr_joao', memberId: 'usr_joao', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_t3', pastoralId: 'pas_coroinhas', roleId: 'role_cruz', userId: 'usr_familia_silva', memberId: 'mem_pedro_lucas', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_t4', pastoralId: 'pas_coroinhas', roleId: 'role_ceroferario', userId: 'usr_familia_silva', memberId: 'mem_joao_miguel', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_1',
      date: dPlus1,
      time: '19:00',
      locationId: 'loc_sao_francisco',
      location: 'Igreja São Francisco',
      celebrationTypeId: 'ct_semanal',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_coroinhas',
      eucharisticPrayerId: 'oe_2',
      eucharisticPrayerSource: 'default',
      celebrantScript: '',
      notes: 'Chegar às 18:30 para organização do altar.',
      assignments: [
        { id: 'asg_1', pastoralId: 'pas_coroinhas', roleId: 'role_missal', userId: 'usr_joao', memberId: 'usr_joao', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_2', pastoralId: 'pas_coroinhas', roleId: 'role_credencia', userId: 'usr_lucas', memberId: 'usr_lucas', substitutionRequested: true, substitutionReason: 'Compromisso acadêmico no horário.', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_3', pastoralId: 'pas_coroinhas', roleId: 'role_coord_missa', userId: 'usr_natalia', memberId: 'usr_natalia', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_2',
      date: dPlus1,
      time: '19:00',
      locationId: 'loc_sao_francisco',
      location: 'Igreja São Francisco',
      celebrationTypeId: 'ct_semanal',
      celebrationType: 'Missa Semanal',
      pastoralId: 'pas_musica',
      eucharisticPrayerId: 'oe_2',
      eucharisticPrayerSource: 'default',
      celebrantScript: '',
      notes: 'Repertório do Tempo Comum — passagem de som às 18:30.',
      assignments: [
        { id: 'asg_4', pastoralId: 'pas_musica', roleId: 'role_violao', userId: 'usr_joao', memberId: 'usr_joao', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_5', pastoralId: 'pas_musica', roleId: 'role_voz', userId: 'usr_carlos', memberId: 'usr_carlos', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        // PEDIDO DE SUBSTITUIÇÃO EM ABERTO NA PASTORAL MÚSICA (Gabriel -> Mesa de Som)
        { id: 'asg_6', pastoralId: 'pas_musica', roleId: 'role_som', userId: 'usr_gabriel', memberId: 'usr_gabriel', substitutionRequested: true, substitutionReason: 'Atraso no trabalho, preciso de cobertura na Mesa de Som.', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_3',
      date: dPlus3,
      time: '09:30',
      locationId: 'loc_matriz',
      location: "Igreja Matriz Santa Teresa d'Ávila",
      celebrationTypeId: 'ct_dominical',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_liturgia',
      eucharisticPrayerId: 'oe_cri_1',
      eucharisticPrayerSource: 'custom',
      celebrantScript: 'Missa dominical com participação especial da Catequese. Utilizar Oração Eucarística para Missas com Crianças I.',
      notes: 'Confirmar leituras do domingo no lecionário.',
      assignments: [
        { id: 'asg_7', pastoralId: 'pas_liturgia', roleId: 'role_leitura1', userId: 'usr_sofia', memberId: 'usr_sofia', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_8', pastoralId: 'pas_liturgia', roleId: 'role_salmo', userId: 'usr_joao', memberId: 'usr_joao', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_9', pastoralId: 'pas_liturgia', roleId: 'role_comentarista', userId: 'usr_natalia', memberId: 'usr_natalia', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_4',
      date: dPlus3,
      time: '19:00',
      locationId: 'loc_matriz',
      location: "Igreja Matriz Santa Teresa d'Ávila",
      celebrationTypeId: 'ct_solene',
      celebrationType: 'Missa Solene / Padroeira',
      pastoralId: 'pas_acolhida',
      eucharisticPrayerId: 'oe_1',
      eucharisticPrayerSource: 'custom',
      celebrantScript: 'Recepção solene com entrega de folhetos comemorativos nas portas principal e lateral.',
      notes: 'Recepção festiva nas duas entradas da Matriz.',
      assignments: [
        { id: 'asg_10', pastoralId: 'pas_acolhida', roleId: 'role_porta_principal', userId: 'usr_carlos', memberId: 'usr_carlos', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_11', pastoralId: 'pas_acolhida', roleId: 'role_ofertorio', userId: 'usr_familia_silva', memberId: 'mem_joao_miguel', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
    {
      id: 'sch_5',
      date: dPlus6,
      time: '19:00',
      locationId: 'loc_matriz',
      location: "Igreja Matriz Santa Teresa d'Ávila",
      celebrationTypeId: 'ct_dominical',
      celebrationType: 'Missa Dominical',
      pastoralId: 'pas_ministros',
      eucharisticPrayerId: 'oe_3',
      eucharisticPrayerSource: 'default',
      celebrantScript: '',
      notes: 'Oração breve na capela do Santíssimo às 18:40.',
      assignments: [
        { id: 'asg_12', pastoralId: 'pas_ministros', roleId: 'role_min_altar', userId: 'usr_rafael', memberId: 'usr_rafael', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_13', pastoralId: 'pas_ministros', roleId: 'role_min_nave', userId: 'usr_natalia', memberId: 'usr_natalia', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
        { id: 'asg_14', pastoralId: 'pas_ministros', roleId: 'role_min_nave', userId: 'usr_gabriel', memberId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '', substitutionAccepted: false, substitutedFromName: '' },
      ],
    },
  ];

  const events = [
    { id: 'evt_1', title: 'Ensaio Litúrgico — Coroinhas e Liturgia', type: 'Ensaio', celebrationTypeId: 'ct_solene', celebrationType: 'Missa Solene / Padroeira', date: dPlus1, time: '17:30', locationId: 'loc_matriz', location: "Igreja Matriz Santa Teresa d'Ávila", description: 'Ensaio prático de procissão de entrada e proclamação das leituras.', pastoralId: 'pas_coroinhas' },
    { id: 'evt_2', title: 'Ensaio do Ministério de Música', type: 'Ensaio', celebrationTypeId: 'ct_dominical', celebrationType: 'Missa Dominical', date: dPlus3, time: '17:00', locationId: 'loc_salao', location: 'Salão Paroquial Santa Teresa', description: 'Passagem do repertório da Solenidade.', pastoralId: 'pas_musica' },
    { id: 'evt_3', title: 'Adoração Comunitária com as Pastorais', type: 'Celebração', celebrationTypeId: 'ct_adoracao', celebrationType: 'Adoração ao Santíssimo', date: dPlus6, time: '20:15', locationId: 'loc_matriz', location: "Igreja Matriz Santa Teresa d'Ávila", description: 'Momento de oração com todas as pastorais.', pastoralId: 'all' },
  ];

  const notes = [
    { id: 'note_1', title: 'Orientações Gerais da Paróquia Santa Teresa', content: 'Todas as equipes devem chegar com no mínimo 25 minutos de antecedência para oração antes da Missa.', authorId: 'usr_admin', pastoralIds: ['all'], coordinatorsOnly: false, createdAt: `${dMinus4}T14:20:00` },
    { id: 'note_2', title: 'Checklist da Sacristia (Coroinhas e Liturgia)', content: 'Conferir galhetas, cálice, corporal, Lecionário marcado e velas do altar acesas 15 minutos antes.', authorId: 'usr_natalia', pastoralIds: ['pas_coroinhas', 'pas_liturgia'], coordinatorsOnly: false, createdAt: `${dMinus2}T16:10:00` },
    { id: 'note_3', title: 'Repertório e Cifras da Semana (Música)', content: 'Entrada: Eis-me aqui Senhor (Tom G) • Ofertório: Sabes Senhor (Tom D) • Comunhão: Pão da Vida (Tom C).', authorId: 'usr_carlos', pastoralIds: ['pas_musica'], coordinatorsOnly: false, createdAt: `${dMinus2}T18:45:00` },
  ];

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
  ];

  const responses = [
    {
      id: 'resp_1',
      formId: 'form_1',
      userId: 'usr_joao',
      respondentMemberId: 'usr_joao',
      respondentLabel: 'João Pedro Almeida',
      submittedAt: `${dMinus2}T10:15:00`,
      validated: false,
      validatedBy: null,
      validatedAt: null,
      answers: { q_1: 'Domingo 19:00 (Matriz)', q_2: 'Sim', q_3: 'Sem restrições para este mês.' },
    },
    {
      id: 'resp_2',
      formId: 'form_1',
      userId: 'usr_familia_silva',
      respondentMemberId: 'all_family',
      respondentLabel: 'Ambos os irmãos (Pedro Lucas & João Miguel)',
      submittedAt: `${dMinus2}T14:40:00`,
      validated: true,
      validatedBy: 'usr_natalia',
      validatedAt: `${dMinus1}T09:10:00`,
      answers: { q_1: 'Domingo 09:30 (Matriz)', q_2: 'Sim', q_3: 'Pedro e João podem servir juntos aos domingos.' },
    },
  ];

  const notices = [
    { id: 'not_1', title: 'Encontro Paroquial das Pastorais com o Pároco', content: 'Queridos coordenadores e membros, convocamos todas as pastorais para o nosso encontro mensal no Salão Paroquial Santa Teresa.', authorId: 'usr_admin', pastoralIds: ['all'], pinned: true, createdAt: `${dMinus2}T09:00:00` },
    { id: 'not_2', title: 'Ensaio Conjunto — Coroinhas e Liturgia', content: 'Ensaio prático na Matriz Santa Teresa às 17:30.', authorId: 'usr_natalia', pastoralIds: ['pas_coroinhas', 'pas_liturgia'], pinned: false, createdAt: `${dMinus4}T18:30:00` },
    { id: 'not_3', title: 'Passagem de Som — Pastoral da Música', content: 'Cheguem 30 minutos antes na Igreja São Francisco.', authorId: 'usr_carlos', pastoralIds: ['pas_musica'], pinned: false, createdAt: `${dMinus1}T11:15:00` },
  ];

  // Notificações iniciais: inclui pedido de substituição em aberto na Música para Lucas, João e Carlos!
  const notifications = [
    {
      id: 'notif_sub_1',
      type: 'substitution_open',
      recipientUserId: 'usr_lucas',
      senderUserId: 'usr_gabriel',
      scheduleId: 'sch_2',
      assignmentId: 'asg_6',
      pastoralId: 'pas_musica',
      title: 'Pedido de Substituição em Aberto (Música)',
      message: `Gabriel Martins Rocha solicitou substituição em Mesa de Som na missa de ${dPlus1.split('-').reverse().join('/')} às 19:00 (Igreja São Francisco).`,
      createdAt: `${dToday}T11:00:00`,
      read: false,
      completed: false,
    },
    {
      id: 'notif_sub_2',
      type: 'substitution_open',
      recipientUserId: 'usr_joao',
      senderUserId: 'usr_gabriel',
      scheduleId: 'sch_2',
      assignmentId: 'asg_6',
      pastoralId: 'pas_musica',
      title: 'Pedido de Substituição em Aberto (Música)',
      message: `Gabriel Martins Rocha solicitou substituição em Mesa de Som na missa de ${dPlus1.split('-').reverse().join('/')} às 19:00 (Igreja São Francisco).`,
      createdAt: `${dToday}T11:00:00`,
      read: false,
      completed: false,
    },
    {
      id: 'notif_sub_3',
      type: 'substitution_open',
      recipientUserId: 'usr_carlos',
      senderUserId: 'usr_gabriel',
      scheduleId: 'sch_2',
      assignmentId: 'asg_6',
      pastoralId: 'pas_musica',
      title: 'Pedido de Substituição em Aberto (Música)',
      message: `Gabriel Martins Rocha solicitou substituição em Mesa de Som na missa de ${dPlus1.split('-').reverse().join('/')} às 19:00 (Igreja São Francisco).`,
      createdAt: `${dToday}T11:00:00`,
      read: false,
      completed: false,
    },
    {
      id: 'notif_form_1',
      type: 'form_reminder',
      recipientUserId: 'usr_joao',
      senderUserId: 'usr_admin',
      formId: 'form_3',
      title: 'Lembrete de Formulário Pendente',
      message: "A Coordenação enviou um lembrete: responda ao formulário 'Pesquisa Geral — Encontro Paroquial de Santa Teresa' antes do prazo.",
      createdAt: `${dToday}T10:00:00`,
      read: false,
      completed: false,
    },
  ];

  // Presença indexada por memberId individual!
  const attendance = {
    sch_past_1: {
      usr_joao: 'Presente',
      usr_lucas: 'Presente',
      mem_pedro_lucas: 'Presente',
    },
  };

  const birthdayMessages = [
    {
      id: 'bmsg_1',
      recipientUserId: 'usr_joao',
      authorId: 'usr_natalia',
      authorPastoralLabel: 'Coroinhas e Acólitos',
      message: "Feliz aniversário, João! Que Deus e Santa Teresa d'Ávila abençoem muito sua vida e missão!",
      createdAt: `${dToday}T08:15:00`,
    },
    {
      id: 'bmsg_2',
      recipientUserId: 'mem_pedro_lucas',
      authorId: 'usr_natalia',
      authorPastoralLabel: 'Coroinhas e Acólitos',
      message: 'Parabéns adiantado, Pedro Lucas! Que alegria ter você e seu irmão servindo juntos ao altar!',
      createdAt: `${dToday}T09:10:00`,
    },
  ];

  const settings = {
    instagramUrl: 'https://www.instagram.com/',
    parishName: "Paróquia Santa Teresa d'Ávila",
    subtitle: 'Gestão Pastoral',
  };

  return {
    pastorals,
    locations,
    celebrationTypes,
    users,
    roles,
    schedules,
    events,
    notes,
    forms,
    responses,
    notices,
    notifications,
    attendance,
    permissions: buildDefaultPermissions(),
    birthdayMessages,
    settings,
  };
}
