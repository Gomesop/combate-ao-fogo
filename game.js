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
            end:      document.getElementById('screen-end')
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
        document.getElementById('brief-dif').textContent =
            (f.crescimento / FASES[0].crescimento).toFixed(1).replace('.0', '') + 'x';
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
        this.hudFail.textContent = '🔥 0/3';
        this.hudFail.classList.remove('alerta');

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
                this.hudFail.textContent = `🔥 ${h.escaparam}/3`;
                this.hudFail.classList.toggle('alerta', h.escaparam >= 2);
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

        if (r.motivo === 'perdeu' || r.motivo === 'tempo') {
            this.tocar('derrota');
            const msg = r.motivo === 'perdeu'
                ? 'Três focos saíram de controle e o incêndio se alastrou.'
                : `O tempo acabou com ${r.apagados} de ${FASES[this.faseIndex].focosAlvo} focos apagados.`;
            setTimeout(() => {
                if (confirm(`${msg}\n\nDeseja repetir esta fase?`)) this.mostrarBriefing();
                else this.finalizar(false);
            }, 400);
            return;
        }

        this.tocar('faseOk');
        this.fasesVencidas++;

        if (this.faseIndex >= FASES.length - 1) { this.finalizar(true); return; }
        this.mostrarAnuncio();
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
