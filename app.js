(function () {
  'use strict';
  const R = window.Recibo;
  const CHAVE = 'reciboFrete.v1';
  const NOVO = '__novo__';

  const PADRAO = {
    listas: {
      contratantes: ['Soles Revestimentos (Cejatel)'],
      materiais: ['areia', 'pallets', 'pedra', 'cimento'],
      locaisColeta: ['Mineração Bom Retiro'],
      locaisEntrega: ['Cerâmica Sales'],
      cidades: ['Leme/SP', 'Santa Gertrudes/SP', 'Cordeirópolis/SP', 'Rio Claro/SP',
        'Limeira/SP', 'Porto Ferreira/SP', 'Araras/SP'],
    },
    // Dados pessoais ficam fora do código: vêm do link (#d=...) ou do que
    // for digitado em "Meus dados", e ficam salvos só no celular.
    prestador: {
      prestador: '',
      telefone: '',
      formaPagamento: 'PIX',
      chavePix: '',
      banco: '',
      titular: '',
      localEmissao: '',
    },
    ultimos: {
      contratante: 'Soles Revestimentos (Cejatel)',
      material: 'areia',
      coletaEmpresa: 'Mineração Bom Retiro',
      coletaCidade: 'Leme/SP',
      entregaEmpresa: 'Cerâmica Sales',
      entregaCidade: 'Santa Gertrudes/SP',
    },
  };

  const NOMES_LISTA = {
    contratantes: { titulo: 'Novo contratante', dica: 'Ex.: Cerâmica Exemplo (Nome Fantasia)', grupo: 'Contratantes' },
    materiais: { titulo: 'O que foi transportado', dica: 'Ex.: tijolo. Aparece assim: “transporte de tijolo”', grupo: 'Cargas' },
    locaisColeta: { titulo: 'Nova empresa de coleta', dica: 'Ex.: Mineração Santa Rita', grupo: 'Empresas de coleta' },
    locaisEntrega: { titulo: 'Nova empresa de entrega', dica: 'Ex.: Cerâmica Santa Clara', grupo: 'Empresas de entrega' },
    cidades: { titulo: 'Nova cidade', dica: 'Ex.: Piracicaba (o “/SP” é colocado sozinho)', grupo: 'Cidades' },
  };

  const CAMPOS_PRESTADOR = Object.keys(PADRAO.prestador);
  const SELECTS = ['contratante', 'material', 'coletaEmpresa', 'coletaCidade', 'entregaEmpresa', 'entregaCidade'];
  const $ = (id) => document.getElementById(id);

  // ---------- Armazenamento no celular ----------

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && salvo.listas) {
        return {
          listas: Object.assign({}, PADRAO.listas, salvo.listas),
          prestador: Object.assign({}, PADRAO.prestador, salvo.prestador),
          ultimos: Object.assign({}, PADRAO.ultimos, salvo.ultimos),
        };
      }
    } catch (e) { /* sem armazenamento: usa o padrão */ }
    return JSON.parse(JSON.stringify(PADRAO));
  }

  let estado = carregar();

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* ignora */ }
  }

  // Dados que vieram no link têm prioridade sobre o que está salvo
  function lerLink() {
    const m = location.hash.match(/[#&]d=([A-Za-z0-9_-]+)/);
    if (!m) return false;
    const doLink = R.decodificarDados(m[1]);
    if (!doLink) return false;
    Object.assign(estado.prestador, doLink);
    salvar();
    return true;
  }
  const temLink = lerLink();

  function linkComDados() {
    return location.origin + location.pathname + '#d=' + R.codificarDados(estado.prestador);
  }

  // ---------- Listas ----------

  function preencherSelect(sel, valor) {
    const lista = estado.listas[sel.dataset.lista];
    sel.innerHTML = '';
    lista.forEach((item) => sel.add(new Option(item, item)));
    sel.add(new Option('➕ Adicionar novo…', NOVO));
    sel.value = lista.includes(valor) ? valor : (lista[0] || '');
    sel.dataset.anterior = sel.value;
  }

  function preencherTodos() {
    SELECTS.forEach((id) => preencherSelect($(id), estado.ultimos[id]));
  }

  function montarGerenciar() {
    const box = $('gerenciar');
    box.innerHTML = '';
    Object.keys(NOMES_LISTA).forEach((nome) => {
      const div = document.createElement('div');
      div.className = 'lista-ger';
      const h = document.createElement('h4');
      h.textContent = NOMES_LISTA[nome].grupo;
      div.appendChild(h);
      estado.listas[nome].forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = item;
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '✕';
        x.setAttribute('aria-label', 'Apagar ' + item);
        x.onclick = () => {
          if (!confirm(`Apagar “${item}” da lista?`)) return;
          estado.listas[nome] = estado.listas[nome].filter((i) => i !== item);
          salvar();
          SELECTS.forEach((id) => {
            const s = $(id);
            if (s.dataset.lista === nome) preencherSelect(s, s.value);
          });
          montarGerenciar();
          atualizar();
        };
        chip.appendChild(x);
        div.appendChild(chip);
      });
      box.appendChild(div);
    });
  }

  function pedirNovo(nomeLista) {
    return new Promise((resolve) => {
      const dlg = $('dlgNovo');
      const info = NOMES_LISTA[nomeLista];
      $('dlgTitulo').textContent = info.titulo;
      $('dlgDica').textContent = info.dica;
      $('dlgInput').value = '';
      dlg.returnValue = '';
      dlg.onclose = () => {
        let v = $('dlgInput').value.trim().replace(/\s+/g, ' ');
        if (dlg.returnValue !== 'ok' || !v) return resolve(null);
        if (nomeLista === 'cidades' && !v.includes('/')) v += '/SP';
        resolve(v);
      };
      if (dlg.showModal) dlg.showModal();
      else { // navegador muito antigo
        const v = prompt(info.titulo + '\n' + info.dica);
        $('dlgInput').value = v || '';
        dlg.returnValue = v ? 'ok' : '';
        dlg.onclose();
      }
      setTimeout(() => $('dlgInput').focus(), 50);
    });
  }

  async function aoMudarSelect(e) {
    const sel = e.target;
    if (sel.value === NOVO) {
      const nomeLista = sel.dataset.lista;
      const novo = await pedirNovo(nomeLista);
      if (novo) {
        const lista = estado.listas[nomeLista];
        const existente = lista.find((i) => i.toLowerCase() === novo.toLowerCase());
        const valor = existente || novo;
        if (!existente) lista.push(novo);
        // atualiza todos os campos que usam a mesma lista
        SELECTS.forEach((id) => {
          const s = $(id);
          if (s.dataset.lista === nomeLista) preencherSelect(s, s === sel ? valor : s.value);
        });
        montarGerenciar();
      } else {
        sel.value = sel.dataset.anterior || '';
      }
    }
    sel.dataset.anterior = sel.value;
    estado.ultimos[sel.id] = sel.value;
    salvar();
    atualizar();
  }

  // ---------- Dados e prévia ----------

  function dados() {
    const d = {};
    SELECTS.forEach((id) => { d[id] = $(id).value; });
    CAMPOS_PRESTADOR.forEach((id) => { d[id] = $(id).value.trim(); });
    d.valor = R.parseValor($('valor').value);
    d.dataServico = $('dataServico').value;
    d.dataRecibo = $('dataRecibo').value;
    d.referente = R.textoReferente(d);
    return d;
  }

  function problemas(d) {
    const faltando = [];
    const marcar = (id, ruim) => { $(id).classList.toggle('invalido', ruim); if (ruim) faltando.push(id); };
    SELECTS.forEach((id) => marcar(id, !d[id] || d[id] === NOVO));
    marcar('valor', !(d.valor > 0));
    marcar('dataServico', !d.dataServico);
    marcar('dataRecibo', !d.dataRecibo);
    CAMPOS_PRESTADOR.forEach((id) => marcar(id, !d[id]));
    return faltando;
  }

  const faltaDadoPessoal = () => CAMPOS_PRESTADOR.some((id) => !estado.prestador[id].trim());

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function atualizar() {
    const d = dados();
    $('valorExtenso').textContent = d.valor > 0 ? R.textoValor(d.valor) : 'Digite só o número. Ex.: 1000 ou 1250,50';

    const vis = Object.assign({}, d, {
      valor: d.valor > 0 ? d.valor : 0,
    });
    const linhas = R.linhasRecibo(vis).map((segs) =>
      '<p>' + segs.map((s) => (s.b ? '<b>' + esc(s.t) + '</b>' : esc(s.t))).join('') + '</p>');
    $('previa').innerHTML = '<h4>Recibo de Prestação de Serviços de Frete</h4>' + linhas.join('');
    $('erro').hidden = true;
    $('aviso').hidden = !faltaDadoPessoal();
  }

  function gerar() {
    const d = dados();
    if (problemas(d).length) {
      const msg = !(d.valor > 0) ? 'Coloque o valor do frete.'
        : faltaDadoPessoal() ? 'Faltam seus dados em “Meus dados e listas” (marcado em vermelho).'
          : 'Falta preencher algum campo (marcado em vermelho).';
      if (faltaDadoPessoal()) $('config').open = true;
      $('erro').textContent = msg;
      $('erro').hidden = false;
      const primeiro = document.querySelector('.invalido');
      if (primeiro) { primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' }); primeiro.focus({ preventScroll: true }); }
      return null;
    }
    const doc = R.gerarPdf(window.jspdf.jsPDF, d);
    return { doc, nome: R.nomeArquivo(d) };
  }

  function baixar(doc, nome) {
    doc.save(nome);
  }

  async function enviarWhats() {
    const r = gerar();
    if (!r) return;
    const blob = r.doc.output('blob');
    const arquivo = new File([blob], r.nome, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo] });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // ele fechou a janela de compartilhar
      }
    }
    baixar(r.doc, r.nome);
    alert('O PDF foi baixado.\n\nAbra a conversa no WhatsApp, toque no clipe (📎) → Documento e escolha o recibo.');
  }

  // ---------- Início ----------

  function iniciar() {
    preencherTodos();
    CAMPOS_PRESTADOR.forEach((id) => {
      $(id).value = estado.prestador[id];
      $(id).addEventListener('input', () => {
        estado.prestador[id] = $(id).value;
        $(id).classList.remove('invalido');
        salvar();
        // mantém o link aberto em dia com o que foi digitado
        if (temLink) history.replaceState(null, '', linkComDados());
        atualizar();
      });
    });
    if (faltaDadoPessoal()) $('config').open = true;

    $('btnLink').addEventListener('click', async () => {
      if (faltaDadoPessoal() && !confirm('Alguns dados estão em branco. Gerar o link mesmo assim?')) return;
      const url = linkComDados();
      if (navigator.share) {
        try { await navigator.share({ url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copiado. Cole no WhatsApp para enviar.');
      } catch (e) {
        prompt('Copie o link:', url);
      }
    });
    const hoje = R.hojeISO();
    $('dataServico').value = hoje;
    $('dataRecibo').value = hoje;

    SELECTS.forEach((id) => $(id).addEventListener('change', aoMudarSelect));
    ['valor', 'dataServico', 'dataRecibo'].forEach((id) => $(id).addEventListener('input', () => {
      $(id).classList.remove('invalido');
      atualizar();
    }));

    $('btnWhats').addEventListener('click', enviarWhats);
    $('btnBaixar').addEventListener('click', () => { const r = gerar(); if (r) baixar(r.doc, r.nome); });
    $('form').addEventListener('submit', (e) => e.preventDefault());
    $('dlgInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('dlgNovo').close('ok'); }
    });
    $('restaurar').addEventListener('click', () => {
      if (!confirm('Isso apaga o que foi adicionado nas listas e volta elas ao padrão. Seus dados continuam. Continuar?')) return;
      estado.listas = JSON.parse(JSON.stringify(PADRAO.listas));
      estado.ultimos = JSON.parse(JSON.stringify(PADRAO.ultimos));
      salvar();
      preencherTodos();
      montarGerenciar();
      atualizar();
    });

    montarGerenciar();
    atualizar();
  }

  iniciar();
})();
