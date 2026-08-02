/**
 * Controlador — Combate ao Fogo
 * www.horadaseguranca.com
 */

class CombateApp {
    constructor() {
        this.faseIndex = 0;
        this.pontos = 0;
        this.fasesVencidas = 0;
        this.focosTotal = 0;
        this.precisoes = [];
        this.desafioAcertos = 0;
        this.desafioTotal = 0;
        this.desafiosUsados = [];

        this.engine = null;
        this.dom();
        this.eventos();

        this.desafios = new Desafios({
            som: (t) => this.tocar(t),
            onPonto: (p) => { this.pontos = Math.max(0, this.pontos + p); },
            onConcluir: (a, t) => { this.desafioAcertos += a; this.desafioTotal += t; }
        });
    }

    dom() {
        this.telas = {
            welcome:  document.getElementById('screen-welcome'),
            briefing: document.getElementById('screen-briefing'),
            game:     document.getElementById('screen-game'),
            ad:       document.getElementById('screen-ad'),
            quiz:     document.getElementById('screen-quiz'),
            end:      document.getElementById('screen-end'),
            lose:     document.getElementById('screen-lose')
        };

        this.regName = document.getElementById('reg-name');
        this.regEmail = document.getElementById('reg-email');
        this.regCompany = document.getElementById('reg-company');
        this.setupError = document.getElementById('setup-error');

        this.canvas = document.getElementById('game-canvas');
        this.toast = document.getElementById('toast');
        this.countdown = document.getElementById('countdown');

        this.hudPhase = document.getElementById('hud-phase');
        this.hudScene = document.getElementById('hud-scene');
        this.hudTime = document.getElementById('hud-time');
        this.hudScore = document.getElementById('hud-score');
        this.hudApagados = document.getElementById('hud-apagados');
        this.hudAlvo = document.getElementById('hud-alvo');
        this.hudFail = document.getElementById('hud-fail');
        this.aguaFill = document.getElementById('agua-fill');
        this.controleFill = document.getElementById('controle-fill');
        this.hudControle = document.getElementById('hud-controle');
        this.hudRescaldo = document.getElementById('hud-rescaldo');
        this.focosFill = document.getElementById('focos-fill');
    }

    eventos() {
        document.getElementById('form-register').addEventListener('submit', e => {
            e.preventDefault(); this.cadastrar();
        });

        [this.regName, this.regEmail, this.regCompany].forEach(el => {
            el.addEventListener('input', () => {
                el.classList.remove('invalid');
                this.setupError.classList.add('hidden');
            });
        });

        document.getElementById('btn-start-phase').addEventListener('click', () => this.iniciarFase());
        document.getElementById('btn-skip-ad').addEventListener('click', () => this.depoisDoAnuncio());
        document.getElementById('btn-quiz-next').addEventListener('click', () => this.depoisDoDesafio());
        document.getElementById('btn-retry-phase').addEventListener('click', () => this.repetirFase());
        document.getElementById('btn-give-up').addEventListener('click', () => this.desistir());
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.tocar('clique'); this.tela('welcome');
        });

        const bs = document.getElementById('btn-sound');
        bs.addEventListener('click', () => {
            sons.enabled = !sons.enabled;
            bs.textContent = sons.enabled ? '🔊' : '🔇';
            bs.classList.toggle('muted', !sons.enabled);
        });

        window.addEventListener('resize', () => this.ajustarCanvas());
    }

    tocar(t) {
        try {
            const mapa = {
                clique: 'clique', acerto: 'acerto', erro: 'erro',
                apagou: 'coleta', escapou: 'batida', faseOk: 'faseOk',
                vitoria: 'vitoria', derrota: 'derrota'
            };
            const m = mapa[t] || t;
            if (sons && typeof sons[m] === 'function') sons[m]();
        } catch (e) {}
    }

    tela(nome) {
        Object.values(this.telas).forEach(t => t.classList.remove('active'));
        this.telas[nome].classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ============================================================
       CADASTRO
       ============================================================ */

    erroCadastro(msg, campo) {
        [this.regName, this.regEmail, this.regCompany].forEach(el => el.classList.remove('invalid'));
        this.setupError.innerHTML = `⚠️ ${msg}`;
        this.setupError.classList.remove('hidden');
        if (campo) {
            campo.classList.add('invalid');
            campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => campo.focus(), 250);
        }
        this.tocar('erro');
    }

    cadastrar() {
        const nome = this.regName.value.trim();
        const email = this.regEmail.value.trim();
        const empresa = this.regCompany.value.trim();

        if (nome.length < 3)       return this.erroCadastro('Informe o seu <strong>nome completo</strong>.', this.regName);
        if (!isEmailValido(email)) return this.erroCadastro('Informe um <strong>e-mail válido</strong>.', this.regEmail);
        if (empresa.length < 2)    return this.erroCadastro('Informe a <strong>empresa ou instituição</strong>.', this.regCompany);

        this.setupError.classList.add('hidden');
        this.participante = registro.inscrever(nome, email, empresa);

        this.faseIndex = 0;
        this.pontos = 0;
        this.fasesVencidas = 0;
        this.focosTotal = 0;
        this.precisoes = [];
        this.desafioAcertos = 0;
        this.desafioTotal = 0;
        this.desafiosUsados = [];

        this.tocar('clique');
        this.mostrarBriefing();
    }

    /* ============================================================
       BRIEFING
       ============================================================ */

    mostrarBriefing() {
        const f = FASES[this.faseIndex];
        document.getElementById('brief-badge').textContent = `FASE ${f.n} DE ${FASES.length}`;
        document.getElementById('brief-ico').textContent = ['🍳','📦','🔧','🏭','🛢️','⚗️'][this.faseIndex] || '🔥';
        document.getElementById('brief-title').textContent = f.nome;
        document.getElementById('brief-sub').textContent = f.subtitulo;
        document.getElementById('brief-text').textContent = f.briefing;
        document.getElementById('brief-tip').innerHTML = `💡 <strong>Dica:</strong> ${f.dica}`;
        document.getElementById('brief-alvo').textContent = f.focosAlvo;
        document.getElementById('brief-dur').textContent = f.duracao;
        // a intensidade combina o quanto o fogo resiste com a frequência dos
        // surgimentos: só o crescimento não descreve mais a curva das fases
        const media = (x) => (x.intervalo[0] + x.intervalo[1]) / 2;
        const base = FASES[0];
        const dif = ((f.resistencia || 1) / (base.resistencia || 1)) * (media(base) / media(f));
        document.getElementById('brief-dif').textContent = dif.toFixed(1).replace('.0', '') + 'x';
        document.getElementById('brief-res').textContent =
            (1 / (0.78 / (f.resistencia || 1))).toFixed(1).replace('.', ',') + 's';
        // a regra da derrota fica escrita, com o número desta fase
        document.getElementById('brief-regra').innerHTML =
            `🚨 <strong>Quando o fogo se espalha:</strong> se um foco cruza a marca vermelha da barra, ` +
            `ele entra em contagem regressiva de <strong>${f.janela || 7} segundos</strong>. ` +
            `Apague-o antes do zero e ele é contido. Se o tempo acabar, conta uma <strong>propagação</strong> — ` +
            `com <strong>3 propagações</strong> a fase é perdida.<br>` +
            `🏁 <strong>Para vencer</strong> não basta apagar os ${f.focosAlvo} focos: ao acabar o tempo a área ` +
            `precisa estar <strong>controlada</strong> — nenhum foco em contagem regressiva e o medidor ` +
            `🛡️ Controle no alto. Fogo grande na cena no fim é derrota.`;
        this.tela('briefing');
    }

    /* ============================================================
       FASE
       ============================================================ */

    ajustarCanvas() {
        if (!this.canvas) return;
        const wrap = this.canvas.parentElement;
        const larg = Math.min(900, Math.max(320, wrap.clientWidth || 900));
        const alt = Math.round(Math.min(520, Math.max(320, larg * 0.58)));
        if (this.canvas.width !== larg || this.canvas.height !== alt) {
            this.canvas.width = larg;
            this.canvas.height = alt;
            if (this.engine) {
                this.engine.W = larg;
                this.engine.H = alt;
                this.engine.mira.x = Math.min(this.engine.mira.x, larg - 20);
                this.engine.mira.y = Math.min(this.engine.mira.y, alt - 20);
            }
        }
    }

    iniciarFase() {
        const f = FASES[this.faseIndex];
        this.tela('game');
        this.ajustarCanvas();

        this.hudPhase.textContent = `Fase ${f.n}/${FASES.length}`;
        this.hudScene.textContent = f.nome;
        this.hudAlvo.textContent = f.focosAlvo;
        this.hudApagados.textContent = '0';
        this.hudFail.textContent = '🔥 Propagações 0/3';
        this.hudFail.classList.remove('alerta');
        this.hudControle.textContent = '100';
        this.controleFill.style.width = '100%';
        this.controleFill.classList.remove('atencao', 'critico');
        this.hudRescaldo.classList.add('hidden');

        if (this.engine) this.engine.destruir();

        this.engine = new CombateEngine(this.canvas, {
            som: (t) => this.tocar(t),
            onHud: (h) => {
                this.hudTime.textContent = h.tempo;
                this.hudScore.textContent = this.pontos + h.pontos;
                this.hudApagados.textContent = h.apagados;
                this.aguaFill.style.width = `${h.agua}%`;
                this.aguaFill.classList.toggle('baixa', h.agua < 25);
                this.focosFill.style.width = `${Math.min(100, (h.apagados / h.alvo) * 100)}%`;
                this.hudFail.textContent = `🔥 Propagações ${h.escaparam}/3`;
                this.hudFail.classList.toggle('alerta', h.escaparam >= 1);
                // medidor de controle da área: é ele que decide a vitória
                this.hudControle.textContent = h.controle;
                this.controleFill.style.width = `${h.controle}%`;
                this.controleFill.classList.toggle('atencao', h.controle < 60 && h.controle >= 30);
                this.controleFill.classList.toggle('critico', h.controle < 30);
                this.hudRescaldo.classList.toggle('hidden', !h.rescaldo);
            },
            onApagou: (b) => this.aviso(`💧 Foco apagado +${b}`, 'ok'),
            onAlerta: (m) => this.aviso(m, 'ruim'),
            onEnd: (r) => this.fimDaFase(r)
        });

        this.engine.carregarFase(f);
        this.contagem(3, () => this.engine.iniciar());
    }

    contagem(n, pronto) {
        const el = this.countdown;
        el.classList.remove('hidden');
        let i = n;
        const passo = () => {
            el.textContent = i > 0 ? i : 'ÁGUA!';
            el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
            this.tocar('clique');
            if (i < 0) { el.classList.add('hidden'); pronto(); return; }
            i--;
            setTimeout(passo, 700);
        };
        passo();
    }

    aviso(texto, tipo) {
        this.toast.textContent = texto;
        this.toast.className = `toast ${tipo}`;
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => this.toast.classList.add('hidden'), 1300);
    }

    fimDaFase(r) {
        this.pontos += r.pontos;
        this.focosTotal += r.apagados;
        if (r.precisao > 0) this.precisoes.push(r.precisao);

        if (r.motivo !== 'completou') {
            this.tocar('derrota');
            this.mostrarDerrota(r);
            return;
        }

        this.tocar('faseOk');
        this.fasesVencidas++;

        if (this.faseIndex >= FASES.length - 1) { this.finalizar(true); return; }
        this.mostrarAnuncio();
    }

    /* ============================================================
       DERROTA DA FASE — explica exatamente o que aconteceu
       ============================================================ */

    mostrarDerrota(r) {
        const f = FASES[this.faseIndex];
        const ico = { perdeu: '🔥', descontrole: '🚨', tempo: '⏱️' };
        const titulo = {
            perdeu: 'O incêndio se alastrou',
            descontrole: 'Área entregue fora de controle',
            tempo: 'Tempo esgotado'
        };
        const texto = {
            perdeu:
                `Três focos ficaram em contagem regressiva até o fim e <strong>propagaram</strong>. ` +
                `Quando a barra de um foco cruza a marca vermelha, você tem <strong>${f.janela || 7} segundos</strong> ` +
                `para apagá-lo — se o contador zerar, conta uma propagação. Três encerram a fase.`,
            descontrole:
                `O tempo acabou com o fogo ainda alto: o controle da área ficou em <strong>${r.controle || 0}%</strong>. ` +
                `Não basta apagar a cota de focos — a cena precisa terminar <strong>controlada</strong>, ` +
                `sem nenhum foco em contagem regressiva e com pouca chama viva.`,
            tempo:
                `A área ficou controlada, mas o tempo acabou antes de você fechar a cota: ` +
                `<strong>${r.apagados} de ${f.focosAlvo}</strong> focos apagados. ` +
                `Mire na base da chama, onde o jato é cerca de três vezes mais eficaz.`
        };

        document.getElementById('lose-ico').textContent = ico[r.motivo] || '⏱️';
        document.getElementById('lose-title').textContent = titulo[r.motivo] || 'Fase não concluída';
        document.getElementById('lose-text').innerHTML = texto[r.motivo] || '';

        document.getElementById('lose-m1').textContent = `${r.apagados}/${f.focosAlvo}`;
        document.getElementById('lose-m2').textContent = `${r.escaparam || 0}/3`;
        document.getElementById('lose-m3').textContent = `${r.controle || 0}%`;

        this.tela('lose');
    }

    repetirFase() {
        this.tocar('clique');
        this.mostrarBriefing();
    }

    desistir() {
        this.tocar('clique');
        this.finalizar(false);
    }

    /* ============================================================
       PUBLICIDADE
       ============================================================ */

    mostrarAnuncio() {
        const a = ANUNCIOS[this.faseIndex % ANUNCIOS.length];
        const card = document.getElementById('ad-card');

        card.style.background =
            `radial-gradient(circle at 88% 8%, ${a.cor3}55 0%, transparent 55%), linear-gradient(150deg, ${a.cor1} 0%, ${a.cor2} 100%)`;

        document.getElementById('ad-logo').innerHTML = `
            <svg viewBox="0 0 100 100" width="100%" height="100%" aria-label="${a.marca}">
                <defs>
                    <linearGradient id="adg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="${a.cor3}"/><stop offset="1" stop-color="${a.cor1}"/>
                    </linearGradient>
                </defs>
                <path d="M50 6 L88 20 V50c0 22-16 36-38 44C28 86 12 72 12 50V20Z" fill="url(#adg)"/>
                <path d="M50 15 L79 26 V50c0 17-12 28-29 34C33 78 21 67 21 50V26Z" fill="#ffffff" opacity=".93"/>
                <text x="50" y="52" text-anchor="middle" font-family="Outfit, sans-serif"
                      font-size="30" font-weight="900" fill="${a.cor1}">${a.iniciais}</text>
                <text x="50" y="74" text-anchor="middle" font-size="19">${a.icone || '★'}</text>
            </svg>`;

        document.getElementById('ad-name').textContent = a.marca;
        document.getElementById('ad-segment').textContent = a.segmento;
        document.getElementById('ad-tagline').textContent = a.tagline;
        document.getElementById('ad-claim').textContent = a.claim;
        document.getElementById('ad-chips').innerHTML =
            a.beneficios.map(b => `<span class="ad-chip">${b}</span>`).join('');

        // sempre em nova aba: navegar aqui perderia a partida
        const cta = document.getElementById('ad-cta');
        cta.textContent = a.cta;
        cta.href = a.url;
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';

        const nota = document.getElementById('ad-demo-note');
        if (a.demonstracao) {
            nota.innerHTML = 'Marca fictícia, usada só para demonstrar este espaço. ' +
                '<a href="anuncie.html" target="_blank" rel="noopener noreferrer">Quer anunciar aqui?</a>';
            nota.classList.remove('hidden');
        } else {
            nota.classList.add('hidden');
        }

        // o conteúdo do botão é recriado a cada exibição: ao liberar,
        // o <span> do contador é substituído e precisa existir de novo
        const btn = document.getElementById('btn-skip-ad');
        btn.innerHTML = 'Continuar em <span id="ad-count">5</span>s';
        const cont = document.getElementById('ad-count');
        btn.disabled = true;
        let s = 5;
        cont.textContent = s;
        clearInterval(this._adT);
        this._adT = setInterval(() => {
            s--;
            if (s <= 0) { clearInterval(this._adT); btn.disabled = false; btn.innerHTML = 'Continuar ➔'; }
            else cont.textContent = s;
        }, 1000);

        this.tela('ad');
    }

    depoisDoAnuncio() {
        this.tocar('clique');
        this.mostrarDesafio();
    }

    /* ============================================================
       DESAFIO
       ============================================================ */

    mostrarDesafio() {
        const tipo = SEQUENCIA_DESAFIOS[this.faseIndex % SEQUENCIA_DESAFIOS.length];
        const d = sortearDesafio(tipo, this.desafiosUsados);
        this.desafiosUsados.push(d.titulo + d.enunciado);
        this.desafios.montar(d);
        this.tela('quiz');
    }

    depoisDoDesafio() {
        this.tocar('clique');
        this.faseIndex++;
        this.mostrarBriefing();
    }

    /* ============================================================
       FIM
       ============================================================ */

    finalizar(venceu) {
        if (this.engine) { this.engine.destruir(); this.engine = null; }

        const precisao = this.precisoes.length
            ? Math.round(this.precisoes.reduce((a, b) => a + b, 0) / this.precisoes.length) : 0;
        const acertoDesafios = this.desafioTotal
            ? Math.round((this.desafioAcertos / this.desafioTotal) * 100) : 0;

        let rank, ico;
        if (venceu && this.pontos >= 1500)      { rank = 'Chefe de Equipe'; ico = '🏅'; }
        else if (venceu && this.pontos >= 1000) { rank = 'Bombeiro Sênior'; ico = '🏆'; }
        else if (venceu)                        { rank = 'Brigadista Habilitado'; ico = '🎖️'; }
        else if (this.fasesVencidas >= 3)       { rank = 'Brigadista em formação'; ico = '🧑‍🚒'; }
        else                                    { rank = 'Aspirante'; ico = '🚒'; }

        document.getElementById('end-ico').textContent = ico;
        document.getElementById('end-title').textContent = venceu ? 'Fogo controlado!' : 'Operação encerrada';
        document.getElementById('end-sub').textContent = venceu
            ? 'Você dominou o combate nos seis cenários, da cozinha à unidade de processo.'
            : `Você venceu ${this.fasesVencidas} de ${FASES.length} cenários. Treine a mira na base do fogo e volte.`;

        document.getElementById('end-score').textContent = this.pontos;
        document.getElementById('end-rank').textContent = rank;
        document.getElementById('m-phases').textContent = `${this.fasesVencidas}/${FASES.length}`;
        document.getElementById('m-focos').textContent = this.focosTotal;
        document.getElementById('m-precisao').textContent = `${precisao}%`;
        document.getElementById('m-quiz').textContent = `${acertoDesafios}%`;

        registro.concluir(this.pontos, `${rank} — ${this.fasesVencidas}/${FASES.length} cenários`);

        this.tocar(venceu ? 'vitoria' : 'derrota');
        this.tela('end');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cfApp = new CombateApp();
});
