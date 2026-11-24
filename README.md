# Deal Hunter 🔎

**Caçador automatizado de ofertas, monitoramento de preços e identificação de possíveis erros de precificação.**

O Deal Hunter é um projeto em desenvolvimento que busca oportunidades de compra em diferentes lojas de comércio eletrônico.

A proposta é construir uma plataforma capaz de coletar preços continuamente, criar históricos de produtos, identificar quedas relevantes e enviar alertas automaticamente.

O objetivo é encontrar oportunidades reais, não apenas preços aparentemente baixos.

## 🎯 Funcionalidades planejadas

- Monitoramento automatizado de lojas online.
- Coleta recorrente de produtos e preços.
- Histórico de preços por produto e variante.
- Comparação de preços ao longo do tempo.
- Identificação de quedas expressivas.
- Detecção de possíveis erros de precificação.
- Verificação de vendedores, disponibilidade e anúncios.
- Notificações automáticas pelo Discord.
- Execução independente do computador do usuário, por meio de infraestrutura cloud.

## 🛒 Lojas no planejamento

| Loja | Situação |
|---|---|
| Mercado Livre | Integração a desenvolver |
| Shopee | Integração a desenvolver |
| Magazine Luiza | Integração a desenvolver |
| KaBuM! | Coleta em validação |
| TerabyteShop | Integração a desenvolver |
| Pichau | Integração a desenvolver |
| AliExpress | Integração a desenvolver |
| Casas Bahia | Integração a desenvolver |

Cada integração será desenvolvida e testada individualmente.

## 🏗️ Arquitetura

```text
                 DEAL HUNTER
                      |
                CLOUD SERVER
                      |
             COLETORES POR LOJA
                      |
               BANCO DE DADOS
                      |
              MOTOR DE ANÁLISE
                      |
             VALIDAÇÃO DE OFERTAS
                      |
                DISCORD ALERTS
```

## 🧰 Tecnologias

- JavaScript
- Node.js
- Playwright
- Discord Webhooks
- JSON
- Git e GitHub

## 📂 Estrutura do projeto

```text
Deal-Hunter/
├── extension/
│   ├── background.js
│   ├── manifest.json
│   ├── scanner.js
│   └── ...
│
├── webhook/
│   ├── config.json
│   ├── detect.mjs
│   ├── extract.mjs
│   ├── scan.mjs
│   ├── stores.mjs
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🚧 Desenvolvimento

O projeto está em fase de evolução.

As prioridades atuais são:

1. Migrar a execução para um servidor cloud.
2. Implementar coletores específicos para cada loja.
3. Construir um histórico confiável de preços.
4. Melhorar a identificação de produtos e variantes.
5. Reduzir falsos positivos.
6. Implementar um sistema inteligente de alertas.

## 🔐 Segurança

Credenciais, tokens, webhooks e arquivos `.env` não devem ser publicados.

## ⚠️ Observações

- Preços podem mudar a qualquer momento.
- Uma queda de preço não significa necessariamente um erro de precificação.
- Ofertas devem ser verificadas diretamente na loja.
- A disponibilidade de coleta depende das condições e dos mecanismos de acesso de cada plataforma.

## 📜 Direitos autorais

Copyright © 2026. Todos os direitos reservados.

Este repositório é público para consulta e avaliação de portfólio. Sua publicação não concede licença ou autorização para copiar, modificar, distribuir ou utilizar comercialmente o código sem autorização expressa do titular dos direitos autorais.

---

**Deal Hunter — procurando oportunidades além das ofertas anunciadas.**