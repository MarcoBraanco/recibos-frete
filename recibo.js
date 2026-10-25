/* Lógica do recibo: valor por extenso, textos e geração do PDF.
   Não depende da página, então também roda no Node para testes. */
(function (root) {
  'use strict';

  // ---------- Valor ----------

  // Aceita "1000", "1000,50", "1.000", "1.000,50", "1000.50"
  function parseValor(txt) {
    if (txt == null) return NaN;
    let s = String(txt).trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes('.')) {
      const partes = s.split('.');
      const ultima = partes[partes.length - 1];
      // "1.000" ou "12.500.000" -> separador de milhar
      if (partes.length > 2 || ultima.length === 3) s = s.replace(/\./g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function formatarMoeda(n) {
    const [int, dec] = n.toFixed(2).split('.');
    return 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
  }

  const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  // 0..999
  function extensoGrupo(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100;
    const partes = [];
    if (c) partes.push(CENTENAS[c]);
    if (r) {
      if (r < 20) partes.push(UNIDADES[r]);
      else {
        const d = Math.floor(r / 10), u = r % 10;
        partes.push(u ? DEZENAS[d] + ' e ' + UNIDADES[u] : DEZENAS[d]);
      }
    }
    return partes.join(' e ');
  }

  // Inteiro por extenso (até centenas de bilhões)
  function extensoInteiro(n) {
    if (n === 0) return 'zero';
    const escalas = [
      ['', ''],
      ['mil', 'mil'],
      ['milhão', 'milhões'],
      ['bilhão', 'bilhões'],
    ];
    const grupos = [];
    let x = n;
    while (x > 0) { grupos.push(x % 1000); x = Math.floor(x / 1000); }

    const pedacos = [];
    for (let i = grupos.length - 1; i >= 0; i--) {
      const g = grupos[i];
      if (!g) continue;
      let txt;
      if (i === 1) txt = g === 1 ? 'mil' : extensoGrupo(g) + ' mil';
      else if (i >= 2) txt = extensoGrupo(g) + ' ' + (g === 1 ? escalas[i][0] : escalas[i][1]);
      else txt = extensoGrupo(g);
      pedacos.push({ txt, g, i });
    }

    let out = '';
    pedacos.forEach((p, idx) => {
      if (idx === 0) { out = p.txt; return; }
      const ultimo = idx === pedacos.length - 1;
      // "mil e quinhentos", "mil e vinte", mas "mil duzentos e cinquenta"
      const usaE = ultimo && (p.g < 100 || p.g % 100 === 0);
      out += (usaE ? ' e ' : ' ') + p.txt;
    });
    return out;
  }

  function valorPorExtenso(valor) {
    const totalCentavos = Math.round(valor * 100);
    const reais = Math.floor(totalCentavos / 100);
    const cent = totalCentavos % 100;
    const partes = [];
    if (reais > 0) {
      let r = extensoInteiro(reais);
      // "um milhão de reais", "dois milhões de reais"
      const redondoMilhao = reais >= 1000000 && reais % 1000000 === 0;
      r += redondoMilhao ? ' de reais' : (reais === 1 ? ' real' : ' reais');
      partes.push(r);
    }
    if (cent > 0) partes.push(extensoInteiro(cent) + (cent === 1 ? ' centavo' : ' centavos'));
    if (!partes.length) return 'zero real';
    return partes.join(' e ');
  }

  function textoValor(valor) {
    return formatarMoeda(valor) + ' (' + valorPorExtenso(valor) + ').';
  }

  // ---------- Datas ----------

  // "2026-10-20" -> "20/10/2026"
  function dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function hojeISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ---------- Textos ----------

  function textoReferente(d) {
    return `Prestação de serviço de transporte de ${d.material}, com coleta na ${d.coletaEmpresa}, ` +
      `em ${d.coletaCidade}, e entrega na ${d.entregaEmpresa}, em ${d.entregaCidade}.`;
  }

  // Linhas do recibo, na mesma ordem do modelo
  function linhasRecibo(d) {
    return [
      [{ t: 'Prestador do serviço: ', b: true }, { t: d.prestador }],
      [{ t: 'Telefone: ', b: true }, { t: d.telefone }],
      [{ t: 'Contratante: ' + d.contratante, b: true }],
      [{ t: 'Referente: ', b: true }, { t: d.referente }],
      [{ t: 'Valor total: ', b: true }, { t: textoValor(d.valor) }],
      [{ t: 'Data de realização do serviço: ', b: true }, { t: dataBR(d.dataServico) + '.' }],
      [{ t: 'Forma de pagamento: ', b: true }, { t: d.formaPagamento }],
      [{ t: 'Chave PIX: ', b: true }, { t: d.chavePix }],
      [{ t: 'Banco: ', b: true }, { t: d.banco }],
      [{ t: 'Titular: ', b: true }, { t: d.titular }],
      [{ t: 'Local e data: ', b: true }, { t: `${d.localEmissao}, ${dataBR(d.dataRecibo)}.` }],
    ];
  }

  function nomeArquivo(d) {
    const data = dataBR(d.dataServico).replace(/\//g, '-');
    return `Recibo de Prestação de Serviços_${data}_${d.prestador}.pdf`;
  }

  // ---------- PDF ----------

  // Mesma geometria do modelo do Word: A4, margem esquerda 3 cm,
  // direita 2 cm, topo 2,5 cm, fonte 11, espaço de 8 pt entre parágrafos.
  function gerarPdf(jsPDF, d) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const ML = 85.05, MR = 56.7, TOPO = 70.9;
    const largura = doc.internal.pageSize.getWidth() - ML - MR;
    const FONTE = 11, ALTURA_LINHA = 14.2, ESPACO = 7.9;

    doc.setProperties({ title: 'Recibo de Prestação de Serviços de Frete', author: d.prestador });
    doc.setFontSize(FONTE);

    let y = TOPO + FONTE;

    // Título centralizado em negrito
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de Prestação de Serviços de Frete', ML + largura / 2, y, { align: 'center' });
    y += ALTURA_LINHA + ESPACO;

    // Parágrafos com trechos em negrito e quebra de linha automática
    for (const segmentos of linhasRecibo(d)) {
      const palavras = [];
      segmentos.forEach((s) => {
        s.t.split(/(\s+)/).forEach((w) => { if (w) palavras.push({ w, b: !!s.b }); });
      });

      let linha = [], larguraLinha = 0;
      const desenhar = () => {
        let x = ML;
        // remove espaços no fim da linha
        while (linha.length && /^\s+$/.test(linha[linha.length - 1].w)) linha.pop();
        // junta palavras seguidas do mesmo estilo num trecho só
        const trechos = [];
        linha.forEach((p) => {
          const ult = trechos[trechos.length - 1];
          if (ult && ult.b === p.b) ult.w += p.w; else trechos.push({ w: p.w, b: p.b });
        });
        trechos.forEach((p) => {
          doc.setFont('helvetica', p.b ? 'bold' : 'normal');
          doc.text(p.w, x, y);
          x += doc.getTextWidth(p.w);
        });
        y += ALTURA_LINHA;
        linha = []; larguraLinha = 0;
      };

      palavras.forEach((p) => {
        doc.setFont('helvetica', p.b ? 'bold' : 'normal');
        const w = doc.getTextWidth(p.w);
        const espaco = /^\s+$/.test(p.w);
        if (!espaco && larguraLinha + w > largura && linha.length) desenhar();
        if (espaco && !linha.length) return;
        linha.push(p);
        larguraLinha += w;
      });
      if (linha.length) desenhar();
      y += ESPACO;
    }
    return doc;
  }

  // ---------- Dados do prestador no link (#d=...) ----------
  // Só codifica (base64 de URL), não é criptografia: quem tem o link lê os dados.
  // Vai depois do "#", então não é enviado ao servidor.

  const CHAVES_LINK = {
    prestador: 'p', telefone: 't', formaPagamento: 'f', chavePix: 'k',
    banco: 'b', titular: 'h', localEmissao: 'l',
  };

  function codificarDados(dados) {
    const curto = {};
    Object.keys(CHAVES_LINK).forEach((k) => { if (dados[k]) curto[CHAVES_LINK[k]] = dados[k]; });
    const bytes = new TextEncoder().encode(JSON.stringify(curto));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodificarDados(txt) {
    try {
      const b64 = txt.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const curto = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      const dados = {};
      Object.keys(CHAVES_LINK).forEach((k) => {
        const v = curto[CHAVES_LINK[k]];
        if (typeof v === 'string') dados[k] = v;
      });
      return dados;
    } catch (e) {
      return null;
    }
  }

  const api = {
    parseValor, formatarMoeda, valorPorExtenso, textoValor,
    dataBR, hojeISO, textoReferente, linhasRecibo, nomeArquivo, gerarPdf,
    codificarDados, decodificarDados,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Recibo = api;
})(typeof window !== 'undefined' ? window : globalThis);
