/**
 * Dados iniciais realistas (Mock Seed) da Pastoral dos Coroinhas e Acólitos
 * da Paróquia Santa Teresa d'Ávila.
 * Datas geradas dinamicamente em relação à data atual para que Agenda,
 * Próximas Escalas e Aniversariantes estejam sempre vivos na demonstração.
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
  const dPlus12 = formatISO(addDays(today, 12));

  const users = [
    {
      id: 'usr_natalia',
      name: 'Natália Faria Souza',
      email: 'natalia@santateresa.org.br',
      phone: '(11) 99812-4410',
      birthDate: makeBirthDate(1998, curMonth, Math.min(curDay + 4, 28)),
      category: 'Coordenador',
      status: 'Ativo',
    },
    {
      id: 'usr_rafael',
      name: 'Rafael Mendes Oliveira',
      email: 'rafael.coord@santateresa.org.br',
      phone: '(11) 99741-2208',
      birthDate: makeBirthDate(1995, (curMonth + 2) % 12, 14),
      category: 'Coordenador',
      status: 'Ativo',
    },
    {
      id: 'usr_joao',
      name: 'João Pedro Almeida',
      email: 'joao.acolito@santateresa.org.br',
      phone: '(11) 99655-8831',
      birthDate: makeBirthDate(2007, curMonth, curDay), // Aniversariante de hoje!
      category: 'Acólito',
      status: 'Ativo',
    },
    {
      id: 'usr_lucas',
      name: 'Lucas Henrique Costa',
      email: 'lucas.acolito@santateresa.org.br',
      phone: '(11) 99420-1190',
      birthDate: makeBirthDate(2006, curMonth, curDay > 5 ? curDay - 3 : curDay + 7),
      category: 'Acólito',
      status: 'Ativo',
    },
    {
      id: 'usr_gabriel',
      name: 'Gabriel Martins Rocha',
      email: 'gabriel.acolito@santateresa.org.br',
      phone: '(11) 99180-3321',
      birthDate: makeBirthDate(2005, (curMonth + 1) % 12, 19),
      category: 'Acólito',
      status: 'Ativo',
    },
    {
      id: 'usr_thiago',
      name: 'Thiago Ribeiro Lima',
      email: 'thiago.acolito@santateresa.org.br',
      phone: '(11) 98840-7712',
      birthDate: makeBirthDate(2006, (curMonth + 4) % 12, 8),
      category: 'Acólito',
      status: 'Inativo',
    },
    {
      id: 'usr_maria',
      name: 'Maria Clara Santos',
      email: 'maria.coroinha@santateresa.org.br',
      phone: '(11) 99511-6024',
      birthDate: makeBirthDate(2012, curMonth, Math.max(1, curDay > 12 ? 9 : 21)),
      category: 'Coroinha',
      status: 'Ativo',
    },
    {
      id: 'usr_sofia',
      name: 'Sofia Beatriz Ferreira',
      email: 'sofia.coroinha@santateresa.org.br',
      phone: '(11) 99310-5419',
      birthDate: makeBirthDate(2013, (curMonth + 3) % 12, 22),
      category: 'Coroinha',
      status: 'Ativo',
    },
    {
      id: 'usr_pedro',
      name: 'Pedro Miguel Cardoso',
      email: 'pedro.coroinha@santateresa.org.br',
      phone: '(11) 99277-4098',
      birthDate: makeBirthDate(2011, (curMonth + 5) % 12, 11),
      category: 'Coroinha',
      status: 'Ativo',
    },
    {
      id: 'usr_helena',
      name: 'Helena Vitória Duarte',
      email: 'helena.coroinha@santateresa.org.br',
      phone: '(11) 98765-9001',
      birthDate: makeBirthDate(2012, (curMonth + 6) % 12, 5),
      category: 'Coroinha',
      status: 'Bloqueado',
    },
  ];

  const roles = [
    { id: 'role_missal', name: 'Missal', description: 'Responsável pelo Missal Romano junto ao celebrante.', active: true },
    { id: 'role_credencia', name: 'Credência', description: 'Prepara os vasos sagrados, galhetas e lavabo na credência.', active: true },
    { id: 'role_turiferario', name: 'Turiferário', description: 'Conduz o turíbulo nas procissões e incensações solenes.', active: true },
    { id: 'role_naviculario', name: 'Naviculário', description: 'Auxilia o turiferário conduzindo a naveta com incenso.', active: true },
    { id: 'role_librifero', name: 'Librífero', description: 'Sustenta os livros litúrgicos nas celebrações solenes.', active: true },
    { id: 'role_cruz', name: 'Cruz Processional', description: 'Abre a procissão de entrada e saída conduzindo a cruz.', active: true },
    { id: 'role_ceroferario', name: 'Ceroferário', description: 'Conduz as tochas/velas na procissão e durante o Evangelho.', active: true },
    { id: 'role_cerimonialista', name: 'Cerimonialista', description: 'Organiza o rito e orienta os servidores durante a celebração.', active: true },
    { id: 'role_coord_missa', name: 'Coordenador de Missa', description: 'Acompanha a chegada dos servidores e a organização da sacristia.', active: true },
  ];

  const schedules = [
    {
      id: 'sch_past_1',
      date: dMinus4,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      category: 'Acólito',
      notes: 'Chegar 30 minutos antes para paramentação.',
      assignments: [
        { id: 'asg_p1', roleId: 'role_missal', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p2', roleId: 'role_credencia', userId: 'usr_lucas', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p3', roleId: 'role_turiferario', userId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_past_2',
      date: dMinus2,
      time: '19:30',
      location: 'Igreja São Francisco',
      celebrationType: 'Missa Semanal',
      category: 'Coroinha',
      notes: 'Túnica branca e cíngulo vermelho.',
      assignments: [
        { id: 'asg_p4', roleId: 'role_cruz', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_p5', roleId: 'role_ceroferario', userId: 'usr_sofia', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_1',
      date: dPlus1,
      time: '19:00',
      location: 'Igreja São Francisco',
      celebrationType: 'Missa Semanal',
      category: 'Acólito',
      notes: 'Chegar às 18:30 na sacristia para organização do altar.',
      assignments: [
        { id: 'asg_1', roleId: 'role_missal', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_2', roleId: 'role_credencia', userId: 'usr_lucas', substitutionRequested: true, substitutionReason: 'Compromisso escolar no período noturno.' },
        { id: 'asg_3', roleId: 'role_cruz', userId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_2',
      date: dPlus3,
      time: '09:30',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      category: 'Coroinha',
      notes: 'Missa com as crianças. Chegar 30 min antes.',
      assignments: [
        { id: 'asg_4', roleId: 'role_cruz', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_5', roleId: 'role_ceroferario', userId: 'usr_sofia', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_6', roleId: 'role_credencia', userId: 'usr_pedro', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_3',
      date: dPlus3,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Solenidade',
      category: 'Acólito',
      notes: 'Celebração solene com incenso. Traje litúrgico completo.',
      assignments: [
        { id: 'asg_7', roleId: 'role_turiferario', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_8', roleId: 'role_naviculario', userId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_9', roleId: 'role_cerimonialista', userId: 'usr_lucas', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_4',
      date: dPlus3,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Solenidade',
      category: 'Coordenador',
      notes: 'Acompanhamento geral da equipe na sacristia e entrada solene.',
      assignments: [
        { id: 'asg_10', roleId: 'role_coord_missa', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_11', roleId: 'role_cerimonialista', userId: 'usr_rafael', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_5',
      date: dPlus6,
      time: '18:00',
      location: 'Igreja São Francisco',
      celebrationType: 'Tríduo',
      category: 'Coroinha',
      notes: '1º dia do Tríduo Paroquial.',
      assignments: [
        { id: 'asg_12', roleId: 'role_librifero', userId: 'usr_maria', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_13', roleId: 'role_ceroferario', userId: 'usr_pedro', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_6',
      date: dPlus9,
      time: '10:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      category: 'Acólito',
      notes: 'Missa Solene da Comunidade.',
      assignments: [
        { id: 'asg_14', roleId: 'role_missal', userId: 'usr_joao', substitutionRequested: false, substitutionReason: '' },
        { id: 'asg_15', roleId: 'role_credencia', userId: 'usr_gabriel', substitutionRequested: false, substitutionReason: '' },
      ],
    },
    {
      id: 'sch_7',
      date: dPlus12,
      time: '19:00',
      location: 'Matriz Santa Teresa',
      celebrationType: 'Missa Dominical',
      category: 'Coordenador',
      notes: 'Recepção dos novos coroinhas na sacristia.',
      assignments: [
        { id: 'asg_16', roleId: 'role_coord_missa', userId: 'usr_natalia', substitutionRequested: false, substitutionReason: '' },
      ],
    },
  ];

  const events = [
    {
      id: 'evt_1',
      title: 'Ensaio Geral para Solenidade',
      type: 'Ensaio',
      date: dPlus1,
      time: '17:30',
      location: 'Matriz Santa Teresa',
      description: 'Ensaio prático de procissão de entrada, turíbulo e movimentação no presbitério.',
      audience: 'Todos',
    },
    {
      id: 'evt_2',
      title: 'Reunião Mensal da Coordenação',
      type: 'Reunião',
      date: dPlus6,
      time: '20:00',
      location: 'Salão Paroquial Santa Teresa',
      description: 'Planejamento das escalas do próximo mês e avaliação da formação.',
      audience: 'Coordenador',
    },
    {
      id: 'evt_3',
      title: 'Formação Litúrgica de Coroinhas',
      type: 'Formação',
      date: dPlus9,
      time: '15:00',
      location: 'Matriz Santa Teresa',
      description: 'Encontro formativo sobre objetos litúrgicos e postura no altar.',
      audience: 'Coroinha',
    },
  ];

  const notes = [
    {
      id: 'note_1',
      title: 'Checklist da Sacristia antes da Missa',
      content: 'Conferir 30 minutos antes: vinho e água nas galhetas, cálice com sanguíneo, pala e corporal, Missal marcado nas leituras do dia e velas do altar acesas.',
      authorId: 'usr_natalia',
      visibilityMode: 'Todos',
      visibleCategories: ['Coordenador', 'Acólito', 'Coroinha'],
      createdAt: `${dMinus4}T14:20:00`,
    },
    {
      id: 'note_2',
      title: 'Orientações sobre o Turíbulo e Incenso',
      content: 'Acender o carvão com 20 minutos de antecedência no pátio externo da sacristia. Garantir que a brasa esteja bem viva antes de colocar o incenso na procissão.',
      authorId: 'usr_joao',
      visibilityMode: 'Apenas Acólitos',
      visibleCategories: ['Acólito'],
      createdAt: `${dMinus2}T16:10:00`,
    },
    {
      id: 'note_3',
      title: 'Cuidados com a Túnica e Pontualidade',
      content: 'Lembrar sempre de trazer a túnica passada, sapato escuro fechado e chegar 25 minutos antes da celebração para rezar juntos na sacristia.',
      authorId: 'usr_natalia',
      visibilityMode: 'Apenas Coroinhas',
      visibleCategories: ['Coroinha'],
      createdAt: `${dMinus2}T18:45:00`,
    },
    {
      id: 'note_4',
      title: 'Pauta interna da Coordenação',
      content: 'Revisar estoque de cíngulos brancos e vermelhos, atualizar lista de tamanhos para novos coroinhas e confirmar a escala do tríduo com o Padre.',
      authorId: 'usr_rafael',
      visibilityMode: 'Apenas Coordenadores',
      visibleCategories: ['Coordenador'],
      createdAt: `${dMinus2}T20:00:00`,
    },
  ];

  const forms = [
    {
      id: 'form_1',
      title: 'Disponibilidade para Escalas do Próximo Mês',
      description: 'Informe seus horários preferenciais nas celebrações da Matriz Santa Teresa e da Igreja São Francisco.',
      audience: 'Todos',
      active: true,
      createdAt: dMinus4,
      questions: [
        { id: 'q_1', text: 'Qual horário de missa você tem maior disponibilidade?', type: 'choice', required: true, options: ['Domingo 09:30 (Matriz)', 'Domingo 19:00 (Matriz)', 'Semana 19:00 (São Francisco)', 'Qualquer horário'] },
        { id: 'q_2', text: 'Você tem disponibilidade para servir em solenidades durante a semana?', type: 'boolean', required: true, options: [] },
        { id: 'q_3', text: 'Há alguma data em que você NÃO poderá servir? Informe abaixo:', type: 'text', required: false, options: [] },
      ],
    },
    {
      id: 'form_2',
      title: 'Confirmação de Presença — Formação de Coroinhas',
      description: 'Confirme sua participação no próximo encontro formativo dos coroinhas.',
      audience: 'Coroinha',
      active: true,
      createdAt: dMinus2,
      questions: [
        { id: 'q_4', text: 'Você participará da Formação Litúrgica deste mês?', type: 'boolean', required: true, options: [] },
        { id: 'q_5', text: 'Qual tema você gostaria de aprender mais?', type: 'choice', required: true, options: ['Objetos Litúrgicos', 'Tempos do Ano Litúrgico', 'Postura no Altar'] },
      ],
    },
    {
      id: 'form_3',
      title: 'Avaliação do Serviço de Incenso (Acólitos)',
      description: 'Levantamento de acólitos aptos para turiferário e cerimonialista nas próximas solenidades.',
      audience: 'Acólito',
      active: true,
      createdAt: dMinus2,
      questions: [
        { id: 'q_6', text: 'Você já se sente seguro para atuar como Turiferário?', type: 'boolean', required: true, options: [] },
        { id: 'q_7', text: 'Observações ou sugestões para os ensaios de acólitos:', type: 'text', required: false, options: [] },
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
        q_3: 'Indisponível apenas na última sexta-feira do mês.',
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
        q_3: 'Sem restrições no momento.',
      },
    },
    {
      id: 'resp_3',
      formId: 'form_3',
      userId: 'usr_lucas',
      submittedAt: `${dMinus2}T19:05:00`,
      answers: {
        q_6: 'Sim',
        q_7: 'Sugiro fazermos mais 10 minutos de prática na incensação do altar.',
      },
    },
  ];

  const notices = [
    {
      id: 'not_1',
      title: 'Ensaio Geral Obrigatório para a Solenidade',
      content: 'Queridos coroinhas e acólitos, lembramos que teremos ensaio geral na Matriz Santa Teresa para preparar a celebração solene. Tragam caderno de anotações e cheguem com 15 minutos de antecedência!',
      authorId: 'usr_natalia',
      pinned: true,
      createdAt: `${dMinus2}T09:00:00`,
    },
    {
      id: 'not_2',
      title: 'Novas Escalas Publicadas',
      content: 'As próximas escalas da Matriz Santa Teresa e da Igreja São Francisco já estão disponíveis no sistema. Confiram a aba "Minhas Escalas" e, caso precisem de substituição, solicitem com antecedência.',
      authorId: 'usr_natalia',
      pinned: false,
      createdAt: `${dMinus4}T18:30:00`,
    },
    {
      id: 'not_3',
      title: 'Zelo pelas Vestes Litúrgicas',
      content: 'Após cada celebração, pendurem as túnicas e sobrepelizes corretamente nos cabides da sacristia e verifiquem se o cíngulo foi guardado na gaveta correspondente.',
      authorId: 'usr_rafael',
      pinned: false,
      createdAt: `${dMinus4}T11:15:00`,
    },
  ];

  // Registro de presença indexado por sourceId (escala ou evento)
  const attendance = {
    sch_past_1: {
      usr_joao: 'Presente',
      usr_lucas: 'Presente',
      usr_gabriel: 'Falta Justificada',
    },
    sch_past_2: {
      usr_maria: 'Presente',
      usr_sofia: 'Presente',
    },
    evt_1: {
      usr_joao: 'Presente',
      usr_maria: 'Presente',
      usr_lucas: 'Falta',
      usr_sofia: 'Presente',
      usr_pedro: 'Falta Justificada',
    },
  };

  const settings = {
    instagramUrl: 'https://www.instagram.com/',
    parishName: "Paróquia Santa Teresa d'Ávila",
    pastoralName: 'Pastoral dos Coroinhas e Acólitos',
  };

  return {
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
