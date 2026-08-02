/**
 * Desafios entre fases: arrastar, ligar pontos, V ou F e memória.
 * Cada montador devolve o controle ao chamador via onConcluir(acertos, total).
 * www.horadaseguranca.com
 */

class Desafios {
    constructor(opts) {
        this.som = opts.som || (() => {});
        this.onConcluir = opts.onConcluir || (() => {});
        this.onPonto = opts.onPonto || (() => {});
    }

    limpar() {
        ['modo-arrastar', 'modo-ligar', 'modo-vf', 'modo-memoria']
            .forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById('quiz-feedback').classList.add('hidden');
        document.getElementById('btn-quiz-next').classList.add('hidden');
        if (this._svgResize) { window.removeEventListener('resize', this._svgResize); this._svgResize = null; }
    }

    montar(d) {
        this.limpar();
        this.acertos = 0;
        this.tentativas = 0;

        document.getElementById('quiz-title').textContent = d.titulo;
        document.getElementById('quiz-text').textContent = d.enunciado;

        const badge = document.getElementById('quiz-badge');
        const ajuda = document.getElementById('quiz-help');

        if (d.tipo === 'arrastar') {
            badge.textContent = '🖐️ Arrastar e soltar';
            ajuda.textContent = '🖱️ Arraste os cartões · 📱 no celular, toque no item e depois no destino';
            this.montarArrastar(d);
        } else if (d.tipo === 'ligar') {
            badge.textContent = '🔗 Ligar pontos';
            ajuda.textContent = 'Toque em um item da esquerda e depois no par correspondente à direita';
            this.montarLigar(d);
        } else if (d.tipo === 'vf') {
            badge.textContent = '✔️ Verdadeiro ou falso';
            ajuda.textContent = 'Julgue cada afirmação. A explicação aparece após a resposta.';
            this.montarVF(d);
        } else if (d.tipo === 'memoria') {
            badge.textContent = '🃏 Jogo da memória';
            ajuda.textContent = 'Vire duas cartas por vez e encontre todos os pares';
            this.montarMemoria(d);
        }
    }

    concluir(msg) {
        const fb = document.getElementById('quiz-feedback');
        fb.innerHTML = msg;
        fb.classList.remove('hidden');
        document.getElementById('btn-quiz-next').classList.remove('hidden');
        this.som('faseOk');
        this.onConcluir(this.acertos, this.tentativas);
    }

    /* ============================================================
       1) ARRASTAR E SOLTAR
       ============================================================ */
    montarArrastar(d) {
        document.getElementById('modo-arrastar').classList.remove('hidden');
        const pool = document.getElementById('quiz-pool');
        const alvos = document.getElementById('quiz-targets');
        pool.innerHTML = '';
        alvos.innerHTML = '';

        let restantes = d.itens.length;
        this.selecionado = null;

        embaralhar(d.itens).forEach(item => {
            const el = document.createElement('div');
            el.className = 'q-item';
            el.draggable = true;
            el.dataset.id = item.id;
            el.dataset.cat = item.cat;
            el.innerHTML = `<span class="qi-ico">${item.icone}</span><span class="qi-txt">${item.rotulo}</span>`;

            el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', item.id); el.classList.add('dragging'); });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('click', () => {
                if (this.selecionado === el) { el.classList.remove('selected'); this.selecionado = null; return; }
                pool.querySelectorAll('.q-item').forEach(x => x.classList.remove('selected'));
                el.classList.add('selected');
                this.selecionado = el;
                this.som('clique');
            });

            pool.appendChild(el);
        });

        const soltar = (el, alvo) => {
            const certo = el.dataset.cat === alvo.dataset.cat;
            this.tentativas++;
            el.classList.remove('selected', 'dragging');
            this.selecionado = null;

            if (certo) {
                this.acertos++;
                this.onPonto(25);
                this.som('acerto');
                el.classList.add('ok');
                el.draggable = false;
                alvo.querySelector('.qt-drop').appendChild(el);
                alvo.classList.add('flash-ok');
                setTimeout(() => alvo.classList.remove('flash-ok'), 450);
                if (--restantes <= 0) {
                    this.concluir('✅ <strong>Todos os itens classificados corretamente!</strong>');
                }
            } else {
                this.som('erro');
                this.onPonto(-5);
                el.classList.add('shake');
                alvo.classList.add('flash-bad');
                setTimeout(() => { el.classList.remove('shake'); alvo.classList.remove('flash-bad'); }, 420);
            }
        };

        embaralhar(d.categorias).forEach(cat => {
            const alvo = document.createElement('div');
            alvo.className = 'q-target';
            alvo.dataset.cat = cat.id;
            alvo.innerHTML = `<div class="qt-head"><strong>${cat.nome}</strong><span>${cat.desc}</span></div><div class="qt-drop"></div>`;

            alvo.addEventListener('dragover', e => { e.preventDefault(); alvo.classList.add('over'); });
            alvo.addEventListener('dragleave', () => alvo.classList.remove('over'));
            alvo.addEventListener('drop', e => {
                e.preventDefault(); alvo.classList.remove('over');
                const el = pool.querySelector(`.q-item[data-id="${e.dataTransfer.getData('text/plain')}"]`);
                if (el) soltar(el, alvo);
            });
            alvo.addEventListener('click', () => { if (this.selecionado) soltar(this.selecionado, alvo); });

            alvos.appendChild(alvo);
        });
    }

    /* ============================================================
       2) LIGAR PONTOS
       ============================================================ */
    montarLigar(d) {
        document.getElementById('modo-ligar').classList.remove('hidden');
        const colE = document.getElementById('ligar-esq');
        const colD = document.getElementById('ligar-dir');
        const svg  = document.getElementById('ligar-svg');
        colE.innerHTML = ''; colD.innerHTML = ''; svg.innerHTML = '';

        let restantes = d.pares.length;
        let escolhidoEsq = null;

        const criar = (col, texto, id, lado) => {
            const el = document.createElement('button');
            el.className = `lig-item lig-${lado}`;
            el.dataset.id = id;
            el.textContent = texto;
            col.appendChild(el);
            return el;
        };

        const desenharLinha = (a, b, cor) => {
            const box = svg.getBoundingClientRect();
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l.setAttribute('x1', ra.right - box.left);
            l.setAttribute('y1', ra.top + ra.height / 2 - box.top);
            l.setAttribute('x2', rb.left - box.left);
            l.setAttribute('y2', rb.top + rb.height / 2 - box.top);
            l.setAttribute('stroke', cor);
            l.setAttribute('stroke-width', '3.5');
            l.setAttribute('stroke-linecap', 'round');
            l.dataset.par = a.dataset.id;
            svg.appendChild(l);
            return l;
        };

        const esqEls = embaralhar(d.pares).map(p => criar(colE, p.esq, p.id, 'esq'));
        const dirEls = embaralhar(d.pares).map(p => criar(colD, p.dir, p.id, 'dir'));

        esqEls.forEach(el => el.addEventListener('click', () => {
            if (el.classList.contains('ok')) return;
            esqEls.forEach(x => x.classList.remove('sel'));
            el.classList.add('sel');
            escolhidoEsq = el;
            this.som('clique');
        }));

        dirEls.forEach(el => el.addEventListener('click', () => {
            if (el.classList.contains('ok') || !escolhidoEsq) return;
            this.tentativas++;
            const certo = escolhidoEsq.dataset.id === el.dataset.id;

            if (certo) {
                this.acertos++;
                this.onPonto(25);
                this.som('acerto');
                escolhidoEsq.classList.remove('sel');
                escolhidoEsq.classList.add('ok');
                el.classList.add('ok');
                desenharLinha(escolhidoEsq, el, '#16a34a');
                escolhidoEsq = null;
                if (--restantes <= 0) {
                    this.concluir('✅ <strong>Todas as ligações corretas!</strong>');
                }
            } else {
                this.som('erro');
                this.onPonto(-5);
                el.classList.add('errado');
                escolhidoEsq.classList.add('errado');
                const a = escolhidoEsq;
                setTimeout(() => { el.classList.remove('errado'); a.classList.remove('errado', 'sel'); }, 450);
                escolhidoEsq = null;
            }
        }));

        // redesenha as linhas quando a tela muda de tamanho
        this._svgResize = () => {
            const feitas = [...svg.querySelectorAll('line')].map(l => l.dataset.par);
            svg.innerHTML = '';
            feitas.forEach(id => {
                const a = esqEls.find(x => x.dataset.id === id);
                const b = dirEls.find(x => x.dataset.id === id);
                if (a && b) desenharLinha(a, b, '#16a34a');
            });
        };
        window.addEventListener('resize', this._svgResize);
    }

    /* ============================================================
       3) VERDADEIRO OU FALSO
       ============================================================ */
    montarVF(d) {
        document.getElementById('modo-vf').classList.remove('hidden');
        const lista = document.getElementById('vf-lista');
        lista.innerHTML = '';

        let restantes = d.questoes.length;

        embaralhar(d.questoes).forEach((q, i) => {
            const bloco = document.createElement('div');
            bloco.className = 'vf-item';
            bloco.innerHTML = `
                <div class="vf-num">${i + 1}</div>
                <div class="vf-corpo">
                    <p class="vf-texto">${q.texto}</p>
                    <div class="vf-botoes">
                        <button class="vf-btn vf-v" data-r="true">✔️ Verdadeiro</button>
                        <button class="vf-btn vf-f" data-r="false">✖️ Falso</button>
                    </div>
                    <p class="vf-exp hidden"></p>
                </div>`;

            const botoes = bloco.querySelectorAll('.vf-btn');
            const exp = bloco.querySelector('.vf-exp');

            botoes.forEach(b => b.addEventListener('click', () => {
                if (bloco.classList.contains('respondida')) return;
                bloco.classList.add('respondida');
                this.tentativas++;

                const escolha = b.dataset.r === 'true';
                const certo = escolha === q.resposta;

                botoes.forEach(x => {
                    x.disabled = true;
                    const v = x.dataset.r === 'true';
                    if (v === q.resposta) x.classList.add('correta');
                });
                if (!certo) b.classList.add('errada');

                exp.textContent = q.explicacao;
                exp.classList.remove('hidden');
                exp.classList.add(certo ? 'exp-ok' : 'exp-bad');

                if (certo) { this.acertos++; this.onPonto(25); this.som('acerto'); }
                else { this.onPonto(-5); this.som('erro'); }

                if (--restantes <= 0) {
                    const pct = Math.round((this.acertos / this.tentativas) * 100);
                    this.concluir(`✅ <strong>Desafio concluído!</strong> Você acertou ${this.acertos} de ${this.tentativas} (${pct}%).`);
                }
            }));

            lista.appendChild(bloco);
        });
    }

    /* ============================================================
       4) JOGO DA MEMÓRIA
       ============================================================ */
    montarMemoria(d) {
        document.getElementById('modo-memoria').classList.remove('hidden');
        const grid = document.getElementById('mem-grid');
        const contador = document.getElementById('mem-pares');
        grid.innerHTML = '';

        const total = d.pares.length;
        contador.textContent = `0 / ${total}`;

        const baralho = embaralhar(
            d.pares.flatMap(p => [
                { pid: p.id, nome: p.nome, icone: p.icone, uid: p.id + 'a' },
                { pid: p.id, nome: p.nome, icone: p.icone, uid: p.id + 'b' }
            ])
        );

        let primeira = null, segunda = null, travado = false, achados = 0;

        const virar = (carta, el) => {
            if (travado || el.classList.contains('virada') || el.classList.contains('achada')) return;
            this.som('clique');
            el.classList.add('virada');
            el.querySelector('.mem-face').textContent = carta.icone;
            el.querySelector('.mem-nome').textContent = carta.nome;

            if (!primeira) { primeira = { carta, el }; return; }
            segunda = { carta, el };
            travado = true;
            this.tentativas++;

            if (primeira.carta.pid === segunda.carta.pid) {
                this.acertos++;
                this.onPonto(25);
                this.som('acerto');
                primeira.el.classList.add('achada');
                segunda.el.classList.add('achada');
                achados++;
                contador.textContent = `${achados} / ${total}`;
                primeira = segunda = null; travado = false;
                if (achados >= total) {
                    this.concluir(`✅ <strong>Todos os ${total} pares encontrados!</strong>`);
                }
            } else {
                this.som('erro');
                setTimeout(() => {
                    [primeira, segunda].forEach(o => {
                        o.el.classList.remove('virada');
                        o.el.querySelector('.mem-face').textContent = '🚒';
                        o.el.querySelector('.mem-nome').textContent = '';
                    });
                    primeira = segunda = null; travado = false;
                }, 850);
            }
        };

        baralho.forEach(carta => {
            const el = document.createElement('button');
            el.className = 'mem-carta';
            el.innerHTML = `<span class="mem-face">🚒</span><span class="mem-nome"></span>`;
            el.addEventListener('click', () => virar(carta, el));
            grid.appendChild(el);
        });
    }
}
