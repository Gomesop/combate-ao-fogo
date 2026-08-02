/**
 * Motor de combate em 1ª pessoa — mangueira e focos de fogo
 * www.horadaseguranca.com
 */

class CombateEngine {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.onHud = opts.onHud || (() => {});
        this.onEnd = opts.onEnd || (() => {});
        this.onApagou = opts.onApagou || (() => {});
        this.onAlerta = opts.onAlerta || (() => {});
        this.som = opts.som || (() => {});

        this.W = canvas.width;
        this.H = canvas.height;

        this.running = false;
        this.jatoAberto = false;
        this.mira = { x: this.W / 2, y: this.H * 0.5 };

        this.bindInput();
    }

    /* ============================================================
       CICLO
       ============================================================ */

    carregarFase(fase) {
        this.fase = fase;
        this.tempoRestante = fase.duracao;
        this.tempoTotal = fase.duracao;

        this.agua = fase.agua;
        this.aguaMax = fase.agua;

        this.focos = [];
        this.gotas = [];
        this.vapor = [];
        this.spawnTimer = 0.8;

        this.apagados = 0;
        this.escaparam = 0;      // focos que atingiram o tamanho máximo
        this.pontos = 0;
        this.precisaoAcertos = 0;
        this.precisaoTotal = 0;

        this.jatoAberto = false;
        this.mira = { x: this.W / 2, y: this.H * 0.52 };
        this.tempoJato = 0;
        this.ultimoTs = 0;
        this.shake = 0;
        this.calor = 0;          // 0..1 — quanto o ambiente está comprometido

        this.desenhar();
    }

    iniciar() {
        this.running = true;
        this.ultimoTs = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    parar() { this.running = false; }

    destruir() {
        this.running = false;
        const c = this.canvas;
        if (this._pd) c.removeEventListener('pointerdown', this._pd);
        if (this._pm) c.removeEventListener('pointermove', this._pm);
        if (this._pu) {
            c.removeEventListener('pointerup', this._pu);
            c.removeEventListener('pointerleave', this._pu);
            c.removeEventListener('pointercancel', this._pu);
        }
        window.removeEventListener('keydown', this._kd);
        window.removeEventListener('keyup', this._ku);
    }

    loop(ts) {
        if (!this.running) return;
        const dt = Math.min(0.05, (ts - this.ultimoTs) / 1000);
        this.ultimoTs = ts;
        // uma exceção aqui dentro encerraria a cadeia de requestAnimationFrame
        // e o jogo congelaria de vez: nunca deixe o erro escapar do quadro
        try {
            this.atualizar(dt);
        } catch (e) {
            console.error('falha ao atualizar o quadro:', e);
        }
        try {
            this.desenhar();
        } catch (e) {
            console.error('falha ao desenhar o quadro:', e);
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    /* ============================================================
       ENTRADA — a mira segue o ponteiro/dedo; segurar abre o jato
       ============================================================ */

    bindInput() {
        const pos = (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.mira.x = (e.clientX - r.left) * (this.canvas.width / r.width);
            this.mira.y = (e.clientY - r.top) * (this.canvas.height / r.height);
        };

        this._pd = (e) => {
            if (!this.running) return;
            e.preventDefault();
            pos(e);
            this.jatoAberto = true;
        };
        this._pm = (e) => {
            if (!this.running) return;
            pos(e);
        };
        this._pu = (e) => { this.jatoAberto = false; };

        this.canvas.addEventListener('pointerdown', this._pd);
        this.canvas.addEventListener('pointermove', this._pm);
        this.canvas.addEventListener('pointerup', this._pu);
        this.canvas.addEventListener('pointerleave', this._pu);
        this.canvas.addEventListener('pointercancel', this._pu);

        // espaço também abre o jato (acessibilidade em teclado)
        this._kd = (e) => {
            if (!this.running) return;
            if (e.key === ' ') { this.jatoAberto = true; e.preventDefault(); }
        };
        this._ku = (e) => { if (e.key === ' ') this.jatoAberto = false; };
        window.addEventListener('keydown', this._kd);
        window.addEventListener('keyup', this._ku);
    }

    /* ============================================================
       ATUALIZAÇÃO
       ============================================================ */

    atualizar(dt) {
        this.tempoRestante -= dt;

        // água: consome com o jato aberto, recarrega fechado
        if (this.jatoAberto && this.agua > 0) {
            this.agua = Math.max(0, this.agua - this.fase.consumo * dt);
            this.tempoJato += dt;
            if (this.agua === 0) this.onAlerta('💧 Água esgotada! Feche o jato para recarregar.');
        } else {
            this.agua = Math.min(this.aguaMax, this.agua + this.fase.recarga * dt);
            this.tempoJato = 0;
        }
        const jatoAtivo = this.jatoAberto && this.agua > 0;

        // surgimento de focos
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.focos.length < 7) {
            this.gerarFoco();
            const [a, b] = this.fase.intervalo;
            this.spawnTimer = a + Math.random() * (b - a);
        }

        // focos
        for (const f of this.focos) {
            f.t += dt;
            // o raio precisa ser calculado AQUI, não no render: a colisão do jato
            // depende dele e não pode ficar refém da taxa de desenho
            // vida nunca pode ficar negativa: o raio vira negativo junto e
            // createRadialGradient lança exceção, matando o loop de animação
            f.vida = Math.max(0, Math.min(1, f.vida));
            f.raio = Math.max(8, 22 + f.vida * 58);

            // foco já apagado nunca volta a crescer: a remoção depende de um
            // setTimeout, que a aba em segundo plano estrangula, e sem isto ele
            // renasceria e ainda contaria como foco perdido
            if (f.extinto) {
                f.apagando -= dt;
                f.vida = Math.max(0, f.vida - dt * 3.4);
                continue;
            }

            if (f.apagando > 0) {
                f.apagando -= dt;
                f.vida = Math.max(0, f.vida - dt * 3.4);
                if (f.vida <= 0) this.extinguir(f);
                continue;
            }

            f.vida = Math.min(1, f.vida + dt * (this.fase.crescimento / 100));

            if (f.vida >= 1 && !f.escapou) {
                f.escapou = true;
                this.escaparam++;
                this.calor = Math.min(1, this.calor + 0.2);
                this.shake = 0.35;
                this.som('escapou');
                this.onAlerta(`🔥 Um foco saiu de controle em ${f.local}!`);
                if (this.escaparam >= 3) { this.finalizar('perdeu'); return; }
            }
        }

        // a limpeza acontece aqui, no relógio do jogo, e não num setTimeout
        this.focos = this.focos.filter(f => !(f.extinto && f.apagando <= -0.05));

        // jato molhando os focos
        if (jatoAtivo) {
            this.precisaoTotal += dt;
            let acertou = false;

            for (const f of this.focos) {
                if (f.apagando > 0) continue;
                const d = Math.hypot(f.x - this.mira.x, f.y - this.mira.y);
                const raioJato = 40 + f.raio * 0.3;
                if (d < raioJato) {
                    acertou = true;
                    // atingir a BASE do foco é muito mais eficiente que molhar as labaredas
                    const naBase = this.mira.y > f.y + f.raio * 0.1;
                    const eficiencia = naBase ? 1 : 0.3;
                    f.vida = Math.max(0, f.vida - dt * 0.78 * eficiencia);
                    f.molhado = 0.25;
                    if (Math.random() < 0.6) this.criarVapor(f.x, f.y + f.raio * 0.3);
                    if (f.vida <= 0) this.extinguir(f, naBase);
                }
            }
            if (acertou) this.precisaoAcertos += dt;

            this.criarGotas();
        }

        // partículas
        for (const g of this.gotas) {
            g.x += g.vx * dt; g.y += g.vy * dt;
            g.vy += 900 * dt; g.vida -= dt;
        }
        this.gotas = this.gotas.filter(g => g.vida > 0);

        for (const v of this.vapor) {
            v.x += v.vx * dt; v.y += v.vy * dt;
            v.r += 34 * dt; v.vida -= dt;
        }
        this.vapor = this.vapor.filter(v => v.vida > 0);

        for (const f of this.focos) if (f.molhado > 0) f.molhado -= dt;
        if (this.shake > 0) this.shake -= dt;
        this.calor = Math.max(0, this.calor - dt * 0.02);

        // fim por objetivo ou por tempo
        if (this.apagados >= this.fase.focosAlvo) { this.finalizar('completou'); return; }
        if (this.tempoRestante <= 0) {
            this.finalizar(this.apagados >= Math.ceil(this.fase.focosAlvo * 0.7) ? 'completou' : 'tempo');
            return;
        }

        this.onHud({
            tempo: Math.max(0, Math.ceil(this.tempoRestante)),
            agua: Math.round((this.agua / this.aguaMax) * 100),
            apagados: this.apagados,
            alvo: this.fase.focosAlvo,
            escaparam: this.escaparam,
            pontos: this.pontos,
            jato: jatoAtivo
        });
    }

    gerarFoco() {
        const locais = this.fase.locais || ['no piso', 'na bancada', 'na prateleira', 'junto à parede'];
        const margem = 90;
        this.focos.push({
            x: margem + Math.random() * (this.W - margem * 2),
            y: this.H * (0.34 + Math.random() * 0.34),
            vida: 0.18 + Math.random() * 0.12,
            raio: 0,
            t: Math.random() * 3,
            apagando: 0,
            molhado: 0,
            escapou: false,
            local: locais[Math.floor(Math.random() * locais.length)]
        });
    }

    extinguir(f, naBase) {
        if (f.extinto) return;
        f.extinto = true;
        f.apagando = 0.35;
        this.apagados++;
        const bonus = naBase ? 30 : 20;
        this.pontos += bonus;
        this.som('apagou');
        for (let i = 0; i < 10; i++) this.criarVapor(f.x, f.y);
        this.onApagou(bonus);
        // a remoção do foco é feita em atualizar(), pelo relógio do jogo
    }

    criarGotas() {
        const origem = this.bocalPos();
        for (let i = 0; i < 3; i++) {
            const ang = Math.atan2(this.mira.y - origem.y, this.mira.x - origem.x) + (Math.random() - 0.5) * 0.16;
            const v = 900 + Math.random() * 260;
            this.gotas.push({
                x: origem.x, y: origem.y,
                vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 90,
                vida: 0.16 + Math.random() * 0.1,
                r: 1.6 + Math.random() * 2.4
            });
        }
    }

    criarVapor(x, y) {
        this.vapor.push({
            x: x + (Math.random() - 0.5) * 26,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 40,
            vy: -50 - Math.random() * 60,
            r: 8 + Math.random() * 10,
            vida: 0.5 + Math.random() * 0.5
        });
    }

    bocalPos() {
        return { x: this.W * 0.5, y: this.H * 0.995 };
    }

    finalizar(motivo) {
        if (!this.running) return;
        this.running = false;
        const precisao = this.precisaoTotal > 0
            ? Math.round((this.precisaoAcertos / this.precisaoTotal) * 100) : 0;
        this.onEnd({
            motivo,
            pontos: this.pontos,
            apagados: this.apagados,
            escaparam: this.escaparam,
            precisao,
            tempoRestante: Math.max(0, Math.round(this.tempoRestante))
        });
    }

    /* ============================================================
       RENDER
       ============================================================ */

    desenhar() {
        const c = this.ctx;
        c.save();
        if (this.shake > 0) c.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);

        this.cenario(c);

        for (const f of this.focos) this.desenharFoco(c, f);

        // vapor
        for (const v of this.vapor) {
            c.globalAlpha = Math.max(0, v.vida * 0.6);
            c.fillStyle = '#f8fafc';
            c.beginPath(); c.arc(v.x, v.y, v.r, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;

        if (this.jatoAberto && this.agua > 0) this.desenharJato(c);

        // gotas
        c.fillStyle = 'rgba(125, 211, 252, 0.9)';
        for (const g of this.gotas) {
            c.globalAlpha = Math.max(0, g.vida * 5);
            c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;

        this.desenharMira(c);
        this.desenharMangueira(c);

        // véu quente quando o ambiente piora
        if (this.calor > 0.02) {
            c.fillStyle = `rgba(249, 115, 22, ${this.calor * 0.16})`;
            c.fillRect(0, 0, this.W, this.H);
        }

        c.restore();
    }

    /* --- cenários claros --- */
    cenario(c) {
        const W = this.W, H = this.H;
        const piso = H * 0.72;

        const g = c.createLinearGradient(0, 0, 0, piso);
        g.addColorStop(0, '#eef6fb');
        g.addColorStop(1, '#dbeafe');
        c.fillStyle = g;
        c.fillRect(0, 0, W, piso);

        const tipo = this.fase.cenario;
        if (tipo === 'cozinha')      this.cenCozinha(c, piso);
        if (tipo === 'almoxarifado') this.cenAlmoxarifado(c, piso);
        if (tipo === 'oficina')      this.cenOficina(c, piso);
        if (tipo === 'galpao')       this.cenGalpao(c, piso);
        if (tipo === 'tanques')      this.cenTanques(c, piso);
        if (tipo === 'processo')     this.cenProcesso(c, piso);

        // piso
        const gp = c.createLinearGradient(0, piso, 0, H);
        gp.addColorStop(0, '#cbd5e1');
        gp.addColorStop(1, '#94a3b8');
        c.fillStyle = gp;
        c.fillRect(0, piso, W, H - piso);
        c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
            const x = (W / 8) * i;
            c.beginPath(); c.moveTo(x, piso); c.lineTo(x + (x - W / 2) * 0.55, H); c.stroke();
        }
        c.beginPath(); c.moveTo(0, piso); c.lineTo(W, piso); c.stroke();
    }

    cenCozinha(c, piso) {
        const W = this.W;
        // azulejos
        c.strokeStyle = 'rgba(148,163,184,0.4)'; c.lineWidth = 1.4;
        for (let x = 0; x < W; x += 54) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, piso); c.stroke(); }
        for (let y = 0; y < piso; y += 54) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        // bancada
        c.fillStyle = '#e2e8f0'; c.fillRect(0, piso - 96, W, 96);
        c.fillStyle = '#94a3b8'; c.fillRect(0, piso - 100, W, 10);
        // fogão
        c.fillStyle = '#475569'; c.fillRect(W * 0.36, piso - 92, 190, 76);
        c.fillStyle = '#1e293b';
        [0, 1].forEach(i => { c.beginPath(); c.arc(W * 0.36 + 52 + i * 84, piso - 62, 24, 0, Math.PI * 2); c.fill(); });
        // armário
        c.fillStyle = '#f1f5f9'; c.fillRect(W * 0.06, piso - 260, 150, 96);
        c.strokeStyle = '#cbd5e1'; c.lineWidth = 3; c.strokeRect(W * 0.06, piso - 260, 150, 96);
    }

    cenAlmoxarifado(c, piso) {
        const W = this.W;
        c.fillStyle = '#e2e8f0'; c.fillRect(0, piso - 30, W, 30);
        for (let p = 0; p < 3; p++) {
            const x = 40 + p * (W - 120) / 2.6;
            c.fillStyle = '#94a3b8'; c.fillRect(x, piso - 250, 12, 250);
            c.fillRect(x + 180, piso - 250, 12, 250);
            [0, 1, 2].forEach(n => {
                const y = piso - 60 - n * 74;
                c.fillStyle = '#cbd5e1'; c.fillRect(x, y, 192, 10);
                for (let k = 0; k < 3; k++) {
                    c.fillStyle = ['#d6bb92', '#c8a878', '#e0cba8'][k % 3];
                    c.fillRect(x + 10 + k * 60, y - 44, 52, 44);
                    c.strokeStyle = 'rgba(120,100,70,0.45)'; c.lineWidth = 1.5;
                    c.strokeRect(x + 10 + k * 60, y - 44, 52, 44);
                }
            });
        }
    }

    cenOficina(c, piso) {
        const W = this.W;
        // bancada com ferramentas
        c.fillStyle = '#cbd5e1'; c.fillRect(W * 0.05, piso - 120, W * 0.36, 14);
        c.fillStyle = '#94a3b8'; c.fillRect(W * 0.06, piso - 106, 14, 106);
        c.fillRect(W * 0.38, piso - 106, 14, 106);
        // painel de ferramentas
        c.fillStyle = '#e2e8f0'; c.fillRect(W * 0.05, piso - 250, W * 0.36, 110);
        c.strokeStyle = '#94a3b8'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            c.beginPath();
            c.moveTo(W * 0.07 + i * 42, piso - 236); c.lineTo(W * 0.07 + i * 42, piso - 190); c.stroke();
        }
        // tambores
        [0, 1].forEach(i => {
            const x = W * 0.62 + i * 105;
            c.fillStyle = '#60a5fa'; c.fillRect(x, piso - 118, 74, 118);
            c.fillStyle = '#3b82f6';
            c.beginPath(); c.ellipse(x + 37, piso - 118, 37, 12, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#f8fafc'; c.fillRect(x + 8, piso - 82, 58, 22);
            c.fillStyle = '#ef4444'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
            c.fillText('INFL.', x + 37, piso - 66);
        });
    }

    cenGalpao(c, piso) {
        const W = this.W;
        // estrutura metálica
        c.strokeStyle = '#94a3b8'; c.lineWidth = 9;
        [0.16, 0.5, 0.84].forEach(p => {
            c.beginPath(); c.moveTo(W * p, piso); c.lineTo(W * p, 40); c.stroke();
        });
        c.lineWidth = 7;
        c.beginPath(); c.moveTo(0, 46); c.lineTo(W, 46); c.stroke();
        c.lineWidth = 4; c.strokeStyle = '#cbd5e1';
        for (let i = 0; i < 8; i++) {
            c.beginPath(); c.moveTo(W * 0.16 + i * 40, 46); c.lineTo(W * 0.16 + i * 40 + 30, 92); c.stroke();
        }
        // paletes empilhados
        for (let i = 0; i < 4; i++) {
            const x = 60 + i * (W - 180) / 3.4;
            for (let n = 0; n < 2; n++) {
                const y = piso - 56 - n * 62;
                c.fillStyle = '#d6bb92'; c.fillRect(x, y, 130, 52);
                c.strokeStyle = 'rgba(120,100,70,0.5)'; c.lineWidth = 2; c.strokeRect(x, y, 130, 52);
                c.fillStyle = '#a8845c'; c.fillRect(x, y + 52, 130, 8);
            }
        }
    }

    cenTanques(c, piso) {
        const W = this.W;
        [0.16, 0.5, 0.84].forEach((p, i) => {
            const x = W * p, r = 88 - i * 4;
            c.fillStyle = '#e2e8f0';
            c.fillRect(x - r, piso - 210, r * 2, 210);
            c.fillStyle = '#cbd5e1';
            c.beginPath(); c.ellipse(x, piso - 210, r, 26, 0, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#94a3b8'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(x - r, piso - 150); c.lineTo(x + r, piso - 150); c.stroke();
            c.beginPath(); c.moveTo(x - r, piso - 80); c.lineTo(x + r, piso - 80); c.stroke();
            c.fillStyle = '#ef4444'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
            c.fillText('⚠ INFLAMÁVEL', x, piso - 112);
        });
        // tubulação
        c.strokeStyle = '#94a3b8'; c.lineWidth = 13;
        c.beginPath(); c.moveTo(0, piso - 30); c.lineTo(W, piso - 30); c.stroke();
    }

    cenProcesso(c, piso) {
        const W = this.W;
        // torres
        [0.2, 0.78].forEach(p => {
            const x = W * p;
            c.fillStyle = '#e2e8f0'; c.fillRect(x - 32, 40, 64, piso - 40);
            c.strokeStyle = '#94a3b8'; c.lineWidth = 3;
            for (let y = 90; y < piso; y += 62) {
                c.beginPath(); c.moveTo(x - 32, y); c.lineTo(x + 32, y); c.stroke();
            }
            c.fillStyle = '#cbd5e1';
            c.beginPath(); c.ellipse(x, 40, 32, 12, 0, 0, Math.PI * 2); c.fill();
        });
        // trocadores e tubos
        c.strokeStyle = '#cbd5e1'; c.lineWidth = 15;
        c.beginPath(); c.moveTo(W * 0.2, piso - 130); c.lineTo(W * 0.78, piso - 130); c.stroke();
        c.lineWidth = 11;
        c.beginPath(); c.moveTo(W * 0.2, piso - 66); c.lineTo(W * 0.78, piso - 66); c.stroke();
        c.fillStyle = '#e2e8f0';
        c.fillRect(W * 0.42, piso - 112, 130, 60);
        c.strokeStyle = '#94a3b8'; c.lineWidth = 3;
        c.strokeRect(W * 0.42, piso - 112, 130, 60);
        // válvulas
        c.fillStyle = '#ef4444';
        [0.36, 0.62].forEach(p => { c.beginPath(); c.arc(W * p, piso - 130, 13, 0, Math.PI * 2); c.fill(); });
    }

    /* --- foco de incêndio --- */
    desenharFoco(c, f) {
        // nunca deixe chegar em zero ou negativo: os gradientes radiais quebram
        const r = Math.max(8, f.raio || (22 + f.vida * 58));   // calculado em atualizar()
        const t = f.t;
        const alpha = f.apagando > 0 ? Math.max(0, f.apagando / 0.35) : 1;

        c.save();
        c.globalAlpha = alpha;

        // brilho no piso
        const gl = c.createRadialGradient(f.x, f.y + r * 0.5, 3, f.x, f.y + r * 0.5, r * 1.7);
        gl.addColorStop(0, 'rgba(251, 146, 60, 0.42)');
        gl.addColorStop(1, 'rgba(251, 146, 60, 0)');
        c.fillStyle = gl;
        c.beginPath(); c.ellipse(f.x, f.y + r * 0.5, r * 1.7, r * 0.8, 0, 0, Math.PI * 2); c.fill();

        // labaredas: três línguas de fogo com tremulação
        const chama = (esc, cor, desl) => {
            const h = r * esc;
            const osc = Math.sin(t * 9 + desl) * (r * 0.13);
            c.fillStyle = cor;
            c.beginPath();
            c.moveTo(f.x - h * 0.52, f.y + r * 0.42);
            c.quadraticCurveTo(f.x - h * 0.62 + osc, f.y - h * 0.24, f.x + osc * 0.6, f.y - h);
            c.quadraticCurveTo(f.x + h * 0.62 + osc, f.y - h * 0.24, f.x + h * 0.52, f.y + r * 0.42);
            c.quadraticCurveTo(f.x, f.y + r * 0.62, f.x - h * 0.52, f.y + r * 0.42);
            c.fill();
        };
        chama(1.5, '#f97316', 0);
        chama(1.05, '#fb923c', 1.4);
        chama(0.62, '#fde047', 2.6);

        // base incandescente (o alvo correto)
        c.fillStyle = 'rgba(220, 38, 38, 0.55)';
        c.beginPath(); c.ellipse(f.x, f.y + r * 0.42, r * 0.55, r * 0.2, 0, 0, Math.PI * 2); c.fill();

        // quando molhado, escurece e solta vapor
        if (f.molhado > 0) {
            c.fillStyle = 'rgba(148, 163, 184, 0.45)';
            c.beginPath(); c.ellipse(f.x, f.y, r * 0.9, r * 1.1, 0, 0, Math.PI * 2); c.fill();
        }

        // barra de intensidade
        const bw = 56, bh = 6;
        c.globalAlpha = alpha * 0.95;
        c.fillStyle = 'rgba(15,23,42,0.28)';
        c.fillRect(f.x - bw / 2, f.y - r * 1.72, bw, bh);
        c.fillStyle = f.vida > 0.75 ? '#dc2626' : f.vida > 0.45 ? '#f59e0b' : '#22c55e';
        c.fillRect(f.x - bw / 2, f.y - r * 1.72, bw * Math.max(0, Math.min(1, f.vida)), bh);

        c.restore();
    }

    /* --- jato d'água em leque --- */
    desenharJato(c) {
        const o = this.bocalPos();
        const m = this.mira;
        const ang = Math.atan2(m.y - o.y, m.x - o.x);
        const dist = Math.hypot(m.x - o.x, m.y - o.y);
        const abertura = 0.1;

        const g = c.createLinearGradient(o.x, o.y, m.x, m.y);
        g.addColorStop(0, 'rgba(186, 230, 253, 0.85)');
        g.addColorStop(0.7, 'rgba(125, 211, 252, 0.55)');
        g.addColorStop(1, 'rgba(125, 211, 252, 0.15)');
        c.fillStyle = g;

        c.beginPath();
        c.moveTo(o.x + Math.cos(ang + Math.PI / 2) * 7, o.y + Math.sin(ang + Math.PI / 2) * 7);
        c.lineTo(o.x + Math.cos(ang - Math.PI / 2) * 7, o.y + Math.sin(ang - Math.PI / 2) * 7);
        c.lineTo(m.x + Math.cos(ang - abertura - Math.PI / 2) * dist * 0.13,
                 m.y + Math.sin(ang - abertura - Math.PI / 2) * dist * 0.13);
        c.lineTo(m.x + Math.cos(ang + abertura + Math.PI / 2) * dist * 0.13,
                 m.y + Math.sin(ang + abertura + Math.PI / 2) * dist * 0.13);
        c.closePath();
        c.fill();

        // névoa no ponto de impacto
        const gi = c.createRadialGradient(m.x, m.y, 3, m.x, m.y, 58);
        gi.addColorStop(0, 'rgba(224, 242, 254, 0.75)');
        gi.addColorStop(1, 'rgba(224, 242, 254, 0)');
        c.fillStyle = gi;
        c.beginPath(); c.arc(m.x, m.y, 58, 0, Math.PI * 2); c.fill();
    }

    /* --- mira --- */
    desenharMira(c) {
        const m = this.mira;
        c.save();
        c.strokeStyle = 'rgba(2, 132, 199, 0.9)';
        c.lineWidth = 2.4;
        c.beginPath(); c.arc(m.x, m.y, 26, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(m.x, m.y, 26, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(2, 132, 199, 0.9)'; c.lineWidth = 2.4;
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy]) => {
            c.beginPath();
            c.moveTo(m.x + dx * 14, m.y + dy * 14);
            c.lineTo(m.x + dx * 34, m.y + dy * 34);
            c.stroke();
        });
        c.restore();
    }

    /* --- mangueira e mãos em 1ª pessoa --- */
    desenharMangueira(c) {
        const W = this.W, H = this.H;
        const o = this.bocalPos();
        const ang = Math.atan2(this.mira.y - o.y, this.mira.x - o.x) + Math.PI / 2;

        c.save();

        // mangueira saindo do canto inferior direito
        c.strokeStyle = '#dc2626'; c.lineWidth = 30; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(W + 20, H + 10);
        c.quadraticCurveTo(W * 0.82, H * 0.94, o.x + 26, H - 18);
        c.stroke();
        c.strokeStyle = '#b91c1c'; c.lineWidth = 22;
        c.beginPath();
        c.moveTo(W + 20, H + 10);
        c.quadraticCurveTo(W * 0.82, H * 0.94, o.x + 26, H - 18);
        c.stroke();

        // esguicho apontando para a mira
        c.translate(o.x, H - 6);
        c.rotate(ang);

        c.fillStyle = '#334155';
        this.arred(c, -13, -78, 26, 62, 8); c.fill();
        c.fillStyle = '#475569';
        this.arred(c, -10, -96, 20, 26, 6); c.fill();
        c.fillStyle = '#cbd5e1';
        this.arred(c, -8, -104, 16, 12, 4); c.fill();
        // gatilho
        c.fillStyle = '#0f172a';
        this.arred(c, 10, -58, 8, 22, 3); c.fill();

        // luvas segurando
        c.fillStyle = '#1f2937';
        c.beginPath(); c.ellipse(-4, -34, 21, 17, -0.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(2, -6, 24, 19, 0.1, 0, Math.PI * 2); c.fill();
        // faixa refletiva nas mangas
        c.fillStyle = '#fde047';
        c.fillRect(-24, 10, 48, 7);

        c.restore();

        // mangas do casaco nos cantos
        c.fillStyle = '#b45309';
        c.beginPath();
        c.moveTo(W * 0.5 - 74, H); c.lineTo(W * 0.5 + 74, H);
        c.lineTo(W * 0.5 + 52, H - 44); c.lineTo(W * 0.5 - 52, H - 44);
        c.closePath(); c.fill();
        c.fillStyle = '#fde047';
        c.fillRect(W * 0.5 - 64, H - 30, 128, 9);
        c.fillStyle = '#e2e8f0';
        c.fillRect(W * 0.5 - 64, H - 21, 128, 7);
    }

    arred(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }
}
