/**
 * Dados Reais da Paróquia Santa Teresa d'Ávila (Base de Produção / Testes Reais)
 * - Coordenação Geral: Natália Faria de Souza (nataliafariasouza13@gmail.com)
 * - Pastorais separadas: Coroinhas (6 funções) e Acólitos (5 funções), além das demais pastorais paroquiais
 * - 40 contas reais (47 integrantes): individuais, contas familiares e contas familiares inter-pastorais
 * - Sem dados fictícios de escalas, avisos, formulários, respostas, notificações ou presenças
 */

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

function makeIndividualUser({ id, name, email, pastoralId, password = 'teresa123' }) {
  const member = { id, name, birthDate: '', pastoralId };
  return {
    id,
    name,
    email,
    password,
    phone: '',
    birthDate: '',
    isGeneralAdmin: false,
    status: 'Ativo',
    memberships: [{ pastoralId, role: 'Membro' }],
    integrantes: [member],
    familyMembers: [member],
  };
}

function makeFamilyUser({ id, name, email, members, password = 'teresa123' }) {
  const pastoralIds = Array.from(new Set(members.map((m) => m.pastoralId).filter(Boolean)));
  const normalized = members.map((m) => ({
    id: m.id,
    name: m.name,
    birthDate: m.birthDate || '',
    pastoralId: m.pastoralId || '',
  }));
  return {
    id,
    name,
    email,
    password,
    phone: '',
    birthDate: '',
    isGeneralAdmin: false,
    status: 'Ativo',
    memberships: pastoralIds.map((pid) => ({ pastoralId: pid, role: 'Membro' })),
    integrantes: normalized,
    familyMembers: normalized,
  };
}

export function buildSeedData() {
  const pastorals = [
    {
      id: 'pas_coroinhas',
      name: 'Coroinhas',
      shortName: 'Coroinhas',
      color: '#B45309',
      description: 'Crianças e adolescentes no serviço ao altar durante as celebrações paroquiais.',
      active: true,
    },
    {
      id: 'pas_acolitos',
      name: 'Acólitos',
      shortName: 'Acólitos',
      color: '#7C2D12',
      description: 'Jovens e servidores experientes no auxílio direto ao altar, à Palavra e ao cerimonial.',
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

  const locations = [
    { id: 'loc_matriz', name: 'Matriz', type: 'Matriz', address: "Igreja Matriz Santa Teresa d'Ávila — Praça Santa Teresa, 100", active: true },
    { id: 'loc_sao_francisco', name: 'Comunidade São Francisco', type: 'Capela', address: 'Comunidade São Francisco', active: true },
    { id: 'loc_sav', name: 'Comunidade SAV', type: 'Capela', address: 'Comunidade SAV', active: true },
    { id: 'loc_salao', name: 'Salão Paroquial Santa Teresa', type: 'Salão', address: 'Anexo à Matriz', active: true },
  ];

  const celebrationTypes = [
    { id: 'ct_dominical', name: 'Missa Dominical', color: '#B45309', durationMin: 75, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_semanal', name: 'Missa Semanal', color: '#5D4037', durationMin: 60, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_sagrado', name: 'Missa do Sagrado', color: '#991B1B', durationMin: 75, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_novena', name: 'Novena de Santa Teresa', color: '#6D28D9', durationMin: 60, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_finados', name: 'Missa de Finados', color: '#4B5563', durationMin: 75, requiresLiturgyOfWord: true, active: true },
    { id: 'ct_sav', name: 'Celebração SAV', color: '#0F766E', durationMin: 60, requiresLiturgyOfWord: true, active: true },
  ];

  const roles = [
    // Coroinhas (7 funções)
    { id: 'role_cor_turibulo', pastoralId: 'pas_coroinhas', name: 'Turíbulo', description: 'Conduz o turíbulo nas incensações litúrgicas.', active: true },
    { id: 'role_cor_naveta', pastoralId: 'pas_coroinhas', name: 'Naveta', description: 'Auxilia com a naveta de incenso junto ao turíbulo.', active: true },
    { id: 'role_cor_cruz', pastoralId: 'pas_coroinhas', name: 'Cruz Processional', description: 'Abre a procissão de entrada e saída.', active: true },
    { id: 'role_cor_vela', pastoralId: 'pas_coroinhas', name: 'Vela/Tocha', description: 'Conduz as velas e tochas nas procissões e no Evangelho.', active: true },
    { id: 'role_cor_credencia', pastoralId: 'pas_coroinhas', name: 'Credência', description: 'Prepara vasos sagrados, galhetas e lavabo na credência.', active: true },
    { id: 'role_cor_altar', pastoralId: 'pas_coroinhas', name: 'Altar', description: 'Auxilia no serviço próximo ao altar e ao Missal.', active: true },
    { id: 'role_cor_coord', pastoralId: 'pas_coroinhas', name: 'Coordenador de Escala / Plantão', description: 'Coordena e acompanha a equipe nesta celebração.', active: true },

    // Acólitos (7 funções)
    { id: 'role_aco_altar', pastoralId: 'pas_acolitos', name: 'Acólito do Altar', description: 'Serviço direto ao altar, preparação e purificação junto ao celebrante.', active: true },
    { id: 'role_aco_palavra', pastoralId: 'pas_acolitos', name: 'Acólito da Palavra', description: 'Serviço ao ambão, evangeliário e acompanhamento da Liturgia da Palavra.', active: true },
    { id: 'role_aco_missal', pastoralId: 'pas_acolitos', name: 'Missal', description: 'Sustenta o Missal Romano junto ao celebrante.', active: true },
    { id: 'role_aco_turiferario', pastoralId: 'pas_acolitos', name: 'Turiferário', description: 'Condução solene do turíbulo nas celebrações.', active: true },
    { id: 'role_aco_cruciferario', pastoralId: 'pas_acolitos', name: 'Cruciferário', description: 'Condução da Cruz Processional nas entradas e procissões.', active: true },
    { id: 'role_aco_cerimoniario', pastoralId: 'pas_acolitos', name: 'Cerimoniário', description: 'Coordenação do rito litúrgico e orientação dos servidores no presbitério.', active: true },
    { id: 'role_aco_coord', pastoralId: 'pas_acolitos', name: 'Coordenador de Escala / Plantão', description: 'Coordena e acompanha a equipe nesta celebração.', active: true },

    // Demais pastorais paroquiais
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

  const users = [
    // Coordenação Geral Real + Coordenadora de Coroinhas e Acólitos
    {
      id: 'usr_natalia_admin',
      name: 'Natália Faria de Souza',
      email: 'nataliafariasouza13@gmail.com',
      password: 'teresa123',
      phone: '',
      birthDate: '',
      isGeneralAdmin: true,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
      integrantes: [{ id: 'usr_natalia_admin', name: 'Natália Faria de Souza', birthDate: '', pastoralId: '' }],
      familyMembers: [{ id: 'usr_natalia_admin', name: 'Natália Faria de Souza', birthDate: '', pastoralId: '' }],
    },
    {
      id: 'usr_coord_gustavo',
      name: 'Gustavo',
      email: 'gustavo.coord@paroquia.com',
      password: 'teresa123',
      phone: '',
      birthDate: '',
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
      integrantes: [{ id: 'usr_coord_gustavo', name: 'Gustavo', birthDate: '', pastoralId: '' }],
      familyMembers: [{ id: 'usr_coord_gustavo', name: 'Gustavo', birthDate: '', pastoralId: '' }],
    },
    {
      id: 'usr_coord_joaopedro',
      name: 'João Pedro',
      email: 'joaopedro.coord@paroquia.com',
      password: 'teresa123',
      phone: '',
      birthDate: '',
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
      integrantes: [{ id: 'usr_coord_joaopedro', name: 'João Pedro', birthDate: '', pastoralId: '' }],
      familyMembers: [{ id: 'usr_coord_joaopedro', name: 'João Pedro', birthDate: '', pastoralId: '' }],
    },
    {
      id: 'usr_coord_michele',
      name: 'Michele',
      email: 'michele.coord@paroquia.com',
      password: 'teresa123',
      phone: '',
      birthDate: '',
      isGeneralAdmin: false,
      status: 'Ativo',
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
      integrantes: [{ id: 'usr_coord_michele', name: 'Michele', birthDate: '', pastoralId: '' }],
      familyMembers: [{ id: 'usr_coord_michele', name: 'Michele', birthDate: '', pastoralId: '' }],
    },

    // --- Coroinhas: Individuais (16) ---
    makeIndividualUser({ id: 'usr_cor_malu1', name: 'Malu 1', email: 'malu1@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_mariaclara1', name: 'Maria Clara 1', email: 'mariaclara1@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_mariaclara2', name: 'Maria Clara 2', email: 'mariaclara2@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_lorena', name: 'Lorena', email: 'lorena@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_eloah', name: 'Eloah', email: 'eloah@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_heloisa', name: 'Heloísa', email: 'heloisa@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_antony', name: 'Antony', email: 'antony@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_carol', name: 'Carol', email: 'carol@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_sophia', name: 'Sophia', email: 'sophia@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_giovana', name: 'Giovana', email: 'giovana@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_victor', name: 'Victor', email: 'victor@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_pedrolucas', name: 'Pedro Lucas', email: 'pedrolucas@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_helena2', name: 'Helena 2', email: 'helena2@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_gabriel', name: 'Gabriel', email: 'gabriel@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_emanuelly', name: 'Emanuelly', email: 'emanuelly@paroquia.com', pastoralId: 'pas_coroinhas' }),
    makeIndividualUser({ id: 'usr_cor_bruno', name: 'Bruno', email: 'bruno@paroquia.com', pastoralId: 'pas_coroinhas' }),

    // --- Coroinhas: Contas Familiares (4 famílias = 8 integrantes) ---
    makeFamilyUser({
      id: 'usr_fam_olivia_helena1',
      name: 'Família Olívia e Helena 1',
      email: 'familia.olivia.helena1@paroquia.com',
      members: [
        { id: 'mem_olivia', name: 'Olívia', pastoralId: 'pas_coroinhas' },
        { id: 'mem_helena1', name: 'Helena 1', pastoralId: 'pas_coroinhas' },
      ],
    }),
    makeFamilyUser({
      id: 'usr_fam_duda_isabela',
      name: 'Família Duda e Isabela',
      email: 'familia.duda.isabela@paroquia.com',
      members: [
        { id: 'mem_duda', name: 'Duda', pastoralId: 'pas_coroinhas' },
        { id: 'mem_isabela', name: 'Isabela', pastoralId: 'pas_coroinhas' },
      ],
    }),
    makeFamilyUser({
      id: 'usr_fam_miguel_pedro_cor',
      name: 'Família Miguel e Pedro - Coroinhas',
      email: 'familia.miguel.pedro@paroquia.com',
      members: [
        { id: 'mem_miguel_cor', name: 'Miguel', pastoralId: 'pas_coroinhas' },
        { id: 'mem_pedro_cor', name: 'Pedro', pastoralId: 'pas_coroinhas' },
      ],
    }),
    makeFamilyUser({
      id: 'usr_fam_bernardo_theo',
      name: 'Família Bernardo e Théo',
      email: 'familia.bernardo.theo@paroquia.com',
      members: [
        { id: 'mem_bernardo', name: 'Bernardo', pastoralId: 'pas_coroinhas' },
        { id: 'mem_theo', name: 'Théo', pastoralId: 'pas_coroinhas' },
      ],
    }),

    // --- Acólitos: Individuais (16) ---
    {
      ...makeIndividualUser({ id: 'usr_aco_milena', name: 'Milena', email: 'milena@paroquia.com', pastoralId: 'pas_acolitos' }),
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
    },
    makeIndividualUser({ id: 'usr_aco_victoriah', name: 'Victória H', email: 'victoriah@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_yasmin', name: 'Yasmin', email: 'yasmin@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_alice', name: 'Alice (Acólitos)', email: 'alice.acolitos@paroquia.com', pastoralId: 'pas_acolitos' }),
    {
      ...makeIndividualUser({ id: 'usr_aco_kauan', name: 'Kauan', email: 'kauan@paroquia.com', pastoralId: 'pas_acolitos' }),
      memberships: [
        { pastoralId: 'pas_coroinhas', role: 'Coordenador' },
        { pastoralId: 'pas_acolitos', role: 'Coordenador' },
      ],
    },
    makeIndividualUser({ id: 'usr_aco_joseflavio', name: 'José Flávio', email: 'joseflavio@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_fabinho', name: 'Fabinho', email: 'fabinho@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_ryan2', name: 'Ryan 2', email: 'ryan2@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_lorenzo', name: 'Lorenzo', email: 'lorenzo@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_guilherme', name: 'Guilherme', email: 'guilherme@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_malu2', name: 'Malu 2', email: 'malu2@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_malu3', name: 'Malu 3', email: 'malu3@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_manu', name: 'Manu', email: 'manu@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_vitoremanuel', name: 'Vitor Emanuel', email: 'vitoremanuel@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_pedro', name: 'Pedro (Acólitos)', email: 'pedro.acolitos@paroquia.com', pastoralId: 'pas_acolitos' }),
    makeIndividualUser({ id: 'usr_aco_vitorleonardo', name: 'Vitor Leonardo', email: 'vitorleonardo@paroquia.com', pastoralId: 'pas_acolitos' }),

    // --- Contas Familiares Inter-Pastorais (Coroinhas + Acólitos na mesma conta) ---
    makeFamilyUser({
      id: 'usr_fam_alice_marina',
      name: 'Família Alice e Marina',
      email: 'familia.alice.marina@paroquia.com',
      members: [
        { id: 'mem_alice_cor', name: 'Alice', pastoralId: 'pas_coroinhas' },
        { id: 'mem_marina_aco', name: 'Marina', pastoralId: 'pas_acolitos' },
      ],
    }),
    makeFamilyUser({
      id: 'usr_fam_lara_victoriaa',
      name: 'Família Lara e Victória A.',
      email: 'familia.lara.victoriaa@paroquia.com',
      members: [
        { id: 'mem_lara_cor', name: 'Lara', pastoralId: 'pas_coroinhas' },
        { id: 'mem_victoriaa_aco', name: 'Victória A.', pastoralId: 'pas_acolitos' },
      ],
    }),
    makeFamilyUser({
      id: 'usr_fam_rafaelp_miguel',
      name: 'Família Rafael P. e Miguel',
      email: 'familia.rafaelp.miguel@paroquia.com',
      members: [
        { id: 'mem_rafaelp_cor', name: 'Rafael P.', pastoralId: 'pas_coroinhas' },
        { id: 'mem_miguel_aco', name: 'Miguel', pastoralId: 'pas_acolitos' },
      ],
    }),
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
    schedules: [],
    events: [],
    notes: [],
    forms: [],
    responses: [],
    notices: [],
    notifications: [],
    attendance: {},
    permissions: buildDefaultPermissions(),
    birthdayMessages: [],
    settings,
  };
}
