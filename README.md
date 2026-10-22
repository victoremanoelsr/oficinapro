# Oficina Fácil 1.0

Sistema desktop para oficinas mecânicas pequenas. Funciona sem internet e armazena os dados no computador onde foi instalado.

## O que está pronto

- Painel com ordens abertas, faturamento e alerta de estoque baixo.
- Clientes, veículos vinculados, check-in e histórico de serviços.
- Ordens de serviço com peças retiradas automaticamente do estoque, mão de obra, total e finalização.
- Estoque, caixa, contas a receber/pagar, relatórios imprimíveis e backup/restauração.
- Tema profissional vermelho, preto e branco; React/TypeScript/Tailwind, Tauri e SQLite.
- Camada Node.js/TypeScript/Prisma organizada em `backend/` para evolução e integração local.

## Gerar o instalador Windows

O instalador é gerado como um único arquivo `.exe` pelo Tauri. Em um computador com internet, Node.js 20+ e Rust instalados, execute na pasta do projeto:

```powershell
npm.cmd install
npm.cmd run desktop:build
```

Como alternativa, dê duplo clique em `GERAR-INSTALADOR.bat`; ele verifica os pré-requisitos e executa os dois comandos.

O arquivo final será colocado em `src-tauri\target\release\bundle\nsis\`.

## Instalação e ativação

Execute o instalador `.exe`, aceite a instalação e abra **Oficina Fácil** pelo Menu Iniciar. Não há serial, login, chave nem ativação: o sistema começa a funcionar imediatamente e permanece offline.

## Dados e backup

O banco SQLite é criado automaticamente na primeira abertura. Use **Configurações → Fazer backup agora** com frequência e guarde o arquivo `.db` em um pendrive ou local seguro.
