# Recibo de Frete

Site simples para gerar o recibo de prestação de serviço de frete em PDF e enviar pelo WhatsApp.

- Escolha contratante, carga, empresa/cidade de coleta e de entrega (cada lista tem “Adicionar novo”).
- Digite só o número do valor — o site formata (`R$ 1.000,00 (mil reais).`).
- Data do serviço e do recibo já vêm com a data de hoje.
- **Enviar no WhatsApp** abre o compartilhamento do celular com o PDF; **Baixar PDF** salva o arquivo.

## Dados do prestador

Nome, telefone, PIX etc. **não ficam no código**. Eles são preenchidos em “Meus dados e listas”
e guardados só no celular (localStorage). O botão **Enviar link com estes dados** gera um link
`.../#d=...` que já abre o site preenchido — os dados vão depois do `#`, então não são enviados
ao servidor. É só uma codificação (base64), não criptografia: mande o link só para quem vai usar.

Para o atalho na tela inicial guardar o link completo, abra o link e use “Adicionar à tela inicial”.

As listas padrão (contratantes, cargas, empresas, cidades) estão no início de `app.js`.

Feito com HTML/CSS/JS puro + [jsPDF](https://github.com/parallax/jsPDF) (em `vendor/`).
