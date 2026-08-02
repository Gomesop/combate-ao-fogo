/**
 * Dados — Combate ao Fogo (1ª pessoa)
 * www.horadaseguranca.com
 */

function embaralhar(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ============================================================
   6 FASES — cada uma com cenário e dificuldade próprios
   ============================================================ */
const FASES = [
    {
        n: 1,
        nome: 'Cozinha Residencial',
        subtitulo: 'Princípio de incêndio em panela',
        cenario: 'cozinha',
        duracao: 45,
        focosAlvo: 6,          // focos a extinguir para vencer
        intervalo: [2.2, 3.2], // tempo entre surgimentos
        crescimento: 3.4,      // velocidade com que o foco cresce
        agua: 100,
        consumo: 11,           // por segundo com o jato aberto
        recarga: 9,            // por segundo com o jato fechado
        briefing: 'Óleo superaqueceu na panela. Abra o jato em leque e resfrie a base das chamas.',
        dica: 'Mire na BASE do fogo, não nas labaredas.'
    },
    {
        n: 2,
        nome: 'Almoxarifado',
        subtitulo: 'Papelão e embalagens em chamas',
        cenario: 'almoxarifado',
        duracao: 45,
        focosAlvo: 8,
        intervalo: [1.9, 2.8],
        crescimento: 4.0,
        agua: 100,
        consumo: 12,
        recarga: 8.5,
        briefing: 'Material classe A empilhado. O fogo se alastra pelas prateleiras — não deixe nenhum foco crescer.',
        dica: 'Focos pequenos apagam rápido. Não deixe acumular.'
    },
    {
        n: 3,
        nome: 'Oficina Mecânica',
        subtitulo: 'Solventes e graxa',
        cenario: 'oficina',
        duracao: 45,
        focosAlvo: 9,
        intervalo: [1.7, 2.5],
        crescimento: 4.6,
        agua: 100,
        consumo: 13,
        recarga: 8,
        briefing: 'Líquidos inflamáveis derramados. Trabalhe da borda para o centro, sem espalhar o produto.',
        dica: 'Jato forte demais espalha líquido inflamável — modere.'
    },
    {
        n: 4,
        nome: 'Galpão Industrial',
        subtitulo: 'Fardos e paletes',
        cenario: 'galpao',
        duracao: 45,
        focosAlvo: 10,
        intervalo: [1.5, 2.2],
        crescimento: 5.2,
        agua: 100,
        consumo: 13.5,
        recarga: 7.5,
        briefing: 'Carga alta e ventilação favorecendo a propagação. Priorize os focos maiores.',
        dica: 'Priorize o foco que está prestes a estourar.'
    },
    {
        n: 5,
        nome: 'Área de Tanques',
        subtitulo: 'Risco de propagação',
        cenario: 'tanques',
        duracao: 45,
        focosAlvo: 11,
        intervalo: [1.3, 2.0],
        crescimento: 5.8,
        agua: 100,
        consumo: 14,
        recarga: 7,
        briefing: 'Chamas próximas aos tanques. Resfrie tudo antes que o calor comprometa os costados.',
        dica: 'A água aqui também serve para resfriar o entorno.'
    },
    {
        n: 6,
        nome: 'Unidade de Processo',
        subtitulo: 'Emergência de grande porte',
        cenario: 'processo',
        duracao: 45,
        focosAlvo: 13,
        intervalo: [1.1, 1.7],
        crescimento: 6.4,
        agua: 100,
        consumo: 14.5,
        recarga: 6.5,
        briefing: 'Missão final. Vários pontos de ignição simultâneos na unidade. Controle a água e não deixe nada crescer.',
        dica: 'Feche o jato para recarregar. Sem água, o fogo vence.'
    }
];

/* ============================================================
   DESAFIOS ENTRE FASES — 4 formatos, alternados
   ============================================================ */

/* --- 1) ARRASTAR E SOLTAR --- */
const DESAFIOS_ARRASTAR = [
    {
        tipo: 'arrastar',
        titulo: 'Classe de incêndio',
        enunciado: 'Arraste cada material para a classe de incêndio correspondente.',
        categorias: [
            { id: 'A', nome: 'Classe A', desc: 'Sólidos comuns' },
            { id: 'B', nome: 'Classe B', desc: 'Líquidos inflamáveis' },
            { id: 'C', nome: 'Classe C', desc: 'Equipamento energizado' }
        ],
        itens: [
            { id: 'a1', rotulo: 'Papelão',        icone: '📦', cat: 'A' },
            { id: 'a2', rotulo: 'Álcool',         icone: '🧪', cat: 'B' },
            { id: 'a3', rotulo: 'Quadro elétrico', icone: '🔌', cat: 'C' },
            { id: 'a4', rotulo: 'Madeira',        icone: '🪵', cat: 'A' },
            { id: 'a5', rotulo: 'Graxa',          icone: '🛢️', cat: 'B' },
            { id: 'a6', rotulo: 'Motor ligado',   icone: '⚙️', cat: 'C' }
        ]
    },
    {
        tipo: 'arrastar',
        titulo: 'Agente extintor',
        enunciado: 'Arraste cada situação para o agente extintor adequado.',
        categorias: [
            { id: 'agua', nome: 'Água',       desc: 'Resfriamento' },
            { id: 'po',   nome: 'Pó químico', desc: 'Abafamento' },
            { id: 'co2',  nome: 'CO₂',        desc: 'Sem resíduo' }
        ],
        itens: [
            { id: 'b1', rotulo: 'Pilha de papel',   icone: '📄', cat: 'agua' },
            { id: 'b2', rotulo: 'Poça de solvente', icone: '⛽', cat: 'po' },
            { id: 'b3', rotulo: 'Servidor ligado',  icone: '🖥️', cat: 'co2' },
            { id: 'b4', rotulo: 'Colchão',          icone: '🛏️', cat: 'agua' },
            { id: 'b5', rotulo: 'Tanque de óleo',   icone: '🛢️', cat: 'po' },
            { id: 'b6', rotulo: 'Painel de comando', icone: '🎛️', cat: 'co2' }
        ]
    }
];

/* --- 2) LIGAR PONTOS --- */
const DESAFIOS_LIGAR = [
    {
        tipo: 'ligar',
        titulo: 'Ligue os pares',
        enunciado: 'Toque em um item da esquerda e depois no correspondente da direita.',
        pares: [
            { id: 'l1', esq: 'Triângulo do fogo',   dir: 'Calor, combustível e comburente' },
            { id: 'l2', esq: 'Abafamento',          dir: 'Elimina o oxigênio' },
            { id: 'l3', esq: 'Resfriamento',        dir: 'Elimina o calor' },
            { id: 'l4', esq: 'Isolamento',          dir: 'Retira o combustível' },
            { id: 'l5', esq: 'Backdraft',           dir: 'Entrada súbita de ar no ambiente confinado' }
        ]
    },
    {
        tipo: 'ligar',
        titulo: 'Equipamento e função',
        enunciado: 'Ligue cada equipamento à sua função no combate.',
        pares: [
            { id: 'm1', esq: 'Esguicho regulável',  dir: 'Ajusta jato sólido ou neblina' },
            { id: 'm2', esq: 'Hidrante',            dir: 'Fornece água pressurizada' },
            { id: 'm3', esq: 'Chave storz',         dir: 'Acopla e trava as mangueiras' },
            { id: 'm4', esq: 'EPR autônomo',        dir: 'Protege as vias respiratórias' },
            { id: 'm5', esq: 'Divisor',             dir: 'Divide a linha em duas mangueiras' }
        ]
    }
];

/* --- 3) VERDADEIRO OU FALSO --- */
const DESAFIOS_VF = [
    {
        tipo: 'vf',
        titulo: 'Verdadeiro ou falso',
        enunciado: 'Julgue cada afirmação sobre combate a incêndio.',
        questoes: [
            { id: 'v1', texto: 'Água nunca deve ser usada em incêndio de equipamento energizado.', resposta: true,
              explicacao: 'Correto. A água conduz eletricidade e pode causar choque no operador.' },
            { id: 'v2', texto: 'O jato deve ser dirigido ao topo das chamas.', resposta: false,
              explicacao: 'Errado. O jato deve atingir a BASE do fogo, onde está o combustível queimando.' },
            { id: 'v3', texto: 'Fumaça acumulada no teto pode inflamar de uma só vez.', resposta: true,
              explicacao: 'Correto. É o flashover — gases quentes atingem a temperatura de ignição.' },
            { id: 'v4', texto: 'Abrir portas e janelas sempre ajuda a apagar o fogo.', resposta: false,
              explicacao: 'Errado. O oxigênio extra pode intensificar as chamas e provocar backdraft.' },
            { id: 'v5', texto: 'O combate deve ser feito com o vento nas costas do operador.', resposta: true,
              explicacao: 'Correto. Assim fumaça e calor são afastados de quem combate.' }
        ]
    },
    {
        tipo: 'vf',
        titulo: 'Verdadeiro ou falso',
        enunciado: 'Julgue cada afirmação sobre prevenção e emergência.',
        questoes: [
            { id: 'w1', texto: 'Extintor com lacre rompido pode ser mantido em uso normalmente.', resposta: false,
              explicacao: 'Errado. Lacre rompido indica possível uso ou perda de carga — exige inspeção.' },
            { id: 'w2', texto: 'A saída de emergência deve permanecer desobstruída e destravada.', resposta: true,
              explicacao: 'Correto. Qualquer obstrução compromete a evacuação.' },
            { id: 'w3', texto: 'Elevador é a rota mais rápida em caso de incêndio.', resposta: false,
              explicacao: 'Errado. O elevador pode parar no andar do fogo ou perder energia. Use a escada.' },
            { id: 'w4', texto: 'Combater o fogo sozinho, sem avisar ninguém, agiliza o atendimento.', resposta: false,
              explicacao: 'Errado. Acionar o alarme e a brigada vem primeiro — ninguém combate sozinho.' },
            { id: 'w5', texto: 'Ao sair de ambiente com fumaça, deve-se manter o corpo abaixado.', resposta: true,
              explicacao: 'Correto. O ar respirável e mais frio fica próximo ao piso.' }
        ]
    }
];

/* --- 4) JOGO DA MEMÓRIA --- */
const DESAFIOS_MEMORIA = [
    {
        tipo: 'memoria',
        titulo: 'Memória do combate',
        enunciado: 'Encontre os 6 pares de equipamentos de combate a incêndio.',
        pares: [
            { id: 'p1', nome: 'Extintor',   icone: '🧯' },
            { id: 'p2', nome: 'Mangueira',  icone: '🚿' },
            { id: 'p3', nome: 'Hidrante',   icone: '🚰' },
            { id: 'p4', nome: 'Capacete',   icone: '⛑️' },
            { id: 'p5', nome: 'Machado',    icone: '🪓' },
            { id: 'p6', nome: 'Alarme',     icone: '🚨' }
        ]
    },
    {
        tipo: 'memoria',
        titulo: 'Memória da sinalização',
        enunciado: 'Encontre os 6 pares de sinalização de emergência.',
        pares: [
            { id: 'q1', nome: 'Saída',        icone: '🚪' },
            { id: 'q2', nome: 'Inflamável',   icone: '⚠️' },
            { id: 'q3', nome: 'Ponto de encontro', icone: '📍' },
            { id: 'q4', nome: 'Proibido fumar', icone: '🚭' },
            { id: 'q5', nome: 'Primeiros socorros', icone: '🩹' },
            { id: 'q6', nome: 'Telefone de emergência', icone: '☎️' }
        ]
    }
];

/* Ordem dos desafios entre as fases (5 intervalos em 6 fases) */
const SEQUENCIA_DESAFIOS = ['arrastar', 'ligar', 'vf', 'memoria', 'arrastar'];

function sortearDesafio(tipo, usados) {
    const banco = {
        arrastar: DESAFIOS_ARRASTAR,
        ligar: DESAFIOS_LIGAR,
        vf: DESAFIOS_VF,
        memoria: DESAFIOS_MEMORIA
    }[tipo];
    const livres = banco.filter(d => !usados.includes(d.titulo + d.enunciado));
    const lista = livres.length ? livres : banco;
    return lista[Math.floor(Math.random() * lista.length)];
}

/* ============================================================
   ESPAÇO PUBLICITÁRIO
   Para vender: troque os dados abaixo pelos do anunciante e
   remova "demonstracao: true".
   ============================================================ */
const ANUNCIOS = [
    {
        id: 'demo-proseg',
        demonstracao: true,
        marca: 'ProSeg Soluções',
        iniciais: 'PS',
        icone: '🧯',
        segmento: 'Revenda de EPI e equipamentos de combate a incêndio',
        tagline: 'O equipamento certo, na hora certa.',
        claim: 'Linha completa de extintores, mangueiras, EPIs e sinalização de emergência com laudo e ART.',
        beneficios: ['Recarga e teste hidrostático', 'Projeto e AVCB', 'Entrega em todo o Brasil'],
        cta: 'Conhecer a ProSeg',
        url: 'anuncie.html',
        cor1: '#0369a1',
        cor2: '#075985',
        cor3: '#38bdf8'
    }
];
